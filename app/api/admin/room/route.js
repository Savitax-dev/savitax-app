import { createClient } from '@supabase/supabase-js'
import { ensureRollovers } from '@/lib/debtRollover'
import { effectiveDeadlineDate } from '@/lib/deadline'
import { startedByMonth } from '@/lib/contractDates'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/admin/room?roomId=xxx&year=2026&month=5
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')
  const year   = Number(searchParams.get('year')  || new Date().getFullYear())
  const month  = Number(searchParams.get('month') || new Date().getMonth() + 1)

  if (!roomId) return Response.json({ error: 'Missing roomId' }, { status: 400 })

  const supabase = getAdmin()

  // Parallel fetch: room + staff + task_definitions
  const [{ data: room }, { data: staffList }, { data: taskDefs }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('staff').select('id, full_name, role').eq('room_id', roomId).order('full_name'),
    supabase.from('task_definitions').select('id, name, deadline_day, sort_order, applies_to, report_type, is_active, month').eq('is_active', true).order('sort_order'),
  ])

  if (!room) return Response.json({ error: 'Room not found' }, { status: 404 })
  if (!staffList || staffList.length === 0) {
    return Response.json({
      room, staff: [],
      totals: { taskPct: 0, debtPct: 0, clientCount: 0, totalTasks: 0, doneTasks: 0, totalFee: 0, collected: 0 },
      taskDefs: [],
    })
  }

  const staffIds = staffList.map(s => s.id)
  // Đã gộp address/tax_status/other_debt vào select chính — bỏ hẳn round-trip "extraMap" cũ
  // (trước đây truy vấn lại y nguyên bảng clients chỉ để lấy thêm 3 cột này).
  const CLIENT_COLS = 'id, name, tax_code, assigned_to, monthly_fee, report_type, fee_period, status, client_code, address, tax_status, other_debt, contract_start'

  // Clients chính (assigned_to) và "phụ trách phụ" không phụ thuộc nhau — chạy song song
  const [{ data: ownedClients }, { data: secondaryRows }] = await Promise.all([
    supabase.from('clients').select(CLIENT_COLS).in('assigned_to', staffIds),
    supabase.from('client_secondary_staff').select('client_id, staff_id').in('staff_id', staffIds),
  ])

  const secondaryClientIds = [...new Set((secondaryRows || []).map(r => r.client_id))]
  const { data: secondaryClientRecords } = secondaryClientIds.length > 0
    ? await supabase.from('clients').select(CLIENT_COLS).in('id', secondaryClientIds)
    : { data: [] }

  const clients = [...(ownedClients || []), ...(secondaryClientRecords || [])]
  const extraMap = {}
  for (const c of clients) extraMap[c.id] = c

  // Active = đang sử dụng + đã tới mốc bắt đầu hợp đồng cho tháng đang xem (Trình ký + chưa
  // tới mốc đều bị loại khỏi tính toán tháng này)
  const isCounted = (c) => (c.status || 'active') === 'active' && startedByMonth(c.contract_start, year, month)
  const activeOwnedClients = (ownedClients || []).filter(isCounted)
  const activeSecondaryClients = (secondaryClientRecords || []).filter(isCounted)
  const clientIds = [...new Set([...activeOwnedClients, ...activeSecondaryClients].map(c => c.id))]

  if (clientIds.length === 0) {
    const staffData = staffList.map(s => ({ ...s, clientCount: 0, clients: [], taskPct: 100, debtPct: 0, totalTasks: 0, doneTasks: 0, totalFee: 0, collectedFee: 0 }))
    return Response.json({ room, staff: staffData, totals: { taskPct: 100, debtPct: 0, clientCount: 0, doneTasks: 0, totalTasks: 0, totalFee: 0, collected: 0 }, taskDefs: taskDefs || [] })
  }

  // Tự động chuyển nợ thiếu của các tháng trước thành nợ tồn — chỉ khi đang xem đúng tháng hiện tại.
  const nowDt = new Date()
  if (year === nowDt.getFullYear() && month === nowDt.getMonth() + 1) {
    await ensureRollovers(supabase, clientIds, year, month)
    // other_debt có thể vừa được cập nhật bởi ensureRollovers — refetch để extraMap không bị stale
    const { data: refreshedDebt } = await supabase.from('clients').select('id, other_debt').in('id', clientIds)
    for (const r of (refreshedDebt || [])) {
      if (extraMap[r.id]) extraMap[r.id].other_debt = r.other_debt
    }
  }

  // task_records + fee_collections for selected month (both types)
  const [{ data: taskRecords }, { data: feeCollections }, { data: feeKhach }] = await Promise.all([
    supabase.from('task_records').select('id, client_id, task_def_id, is_done, done_at, note').in('client_id', clientIds).eq('year', year).eq('month', month),
    supabase.from('service_fees').select('client_id, amount').in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'ketoan'),
    supabase.from('service_fees').select('client_id, amount').in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'khach'),
  ])

  // Build lookup maps
  const taskRecMap = {}  // clientId_taskDefId → record
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r

  const feeMap = {}
  for (const f of (feeCollections || [])) feeMap[f.client_id] = Number(f.amount) || 0
  const feeKhachMap = {}
  for (const f of (feeKhach || [])) feeKhachMap[f.client_id] = Number(f.amount) || 0

  // Deadline date helper: deadline_day of selected month/year — clamp về số ngày thực có
  // của tháng + dời sang thứ 2 nếu rơi Chủ nhật.
  const deadlineDate = (deadlineDay) => effectiveDeadlineDate(year, month, deadlineDay)
  const daysLate = (doneAt, deadlineDay) => {
    if (!doneAt) return null
    const done = new Date(doneAt)
    const deadline = deadlineDate(deadlineDay)
    return Math.floor((done - deadline) / 86400000) // diff in days
  }

  // Tasks applicable for a client in the selected month
  const getApplicableTasks = (client) => (taskDefs || []).filter(t => {
    if (t.is_active === false) return false
    // Only tasks for this specific month
    if (t.month && Number(t.month) !== month) return false
    // Match report_type — checklist mẫu đã có sẵn task riêng cho từng tháng/từng loại báo cáo
    const taskType = t.report_type || 'monthly'
    const clientType = client.report_type || 'monthly'
    return taskType === clientType
  })

  // Task status: 'done_ontime' | 'done_late1' | 'done_late3' | 'pending' | 'overdue'
  const taskStatus = (rec, deadlineDay) => {
    if (!rec || !rec.is_done) {
      const today = new Date()
      // Chỉ tính "Quá hạn" khi đã qua HẾT ngày hạn (từ 0h ngày kế tiếp)
      const deadlineEnd = new Date(deadlineDate(deadlineDay).getTime() + 86400000)
      return today >= deadlineEnd ? 'overdue' : 'pending'
    }
    const late = daysLate(rec.done_at, deadlineDay)
    if (late <= 0) return 'done_ontime'
    if (late <= 2) return 'done_late1'
    return 'done_late3'
  }

  const buildClientWithTasks = (c, isSecondary) => {
    const appTasks = getApplicableTasks(c)
    const tasksWithStatus = appTasks.map(t => {
      const rec = taskRecMap[c.id + '_' + t.id] || null
      const status = taskStatus(rec, t.deadline_day)
      return { ...t, rec, status }
    })
    const extra = extraMap[c.id] || {}
    return {
      ...c, isSecondary,
      address: extra.address || null, tax_status: extra.tax_status || null, other_debt: Number(extra.other_debt) || 0,
      collected: feeMap[c.id] || 0, collectedKhach: feeKhachMap[c.id] || 0,
      tasks: tasksWithStatus, taskTotal: tasksWithStatus.length,
      taskDone: tasksWithStatus.filter(t => t.status.startsWith('done')).length,
    }
  }

  // Build per-staff data
  const staffData = staffList.map(s => {
    const myOwnedClients = activeOwnedClients.filter(c => c.assigned_to === s.id)
    const mySecondaryClientIds = (secondaryRows || []).filter(r => r.staff_id === s.id).map(r => r.client_id)
    const mySecondaryClients = activeSecondaryClients.filter(c => mySecondaryClientIds.includes(c.id))

    let totalTasks = 0, doneTasks = 0, totalFee = 0, collectedFee = 0

    const ownedWithTasks = myOwnedClients.map(c => {
      const built = buildClientWithTasks(c, false)
      const countable = built.tasks.filter(t => t.status !== 'done_late3')
      const doneCountable = countable.filter(t => t.status === 'done_ontime' || t.status === 'done_late1')
      totalTasks += built.tasks.length
      doneTasks  += doneCountable.length + built.tasks.filter(t => t.status === 'done_late3').length
      // Doanh thu chỉ tính công ty mình là nhân viên chính
      totalFee     += Number(c.monthly_fee) || 0
      collectedFee += feeMap[c.id] || 0
      return built
    })

    const secondaryWithTasks = mySecondaryClients.map(c => {
      const built = buildClientWithTasks(c, true)
      // Việc vẫn tính để theo dõi tiến độ chung, nhưng KHÔNG cộng doanh thu/công nợ
      const countable = built.tasks.filter(t => t.status !== 'done_late3')
      const doneCountable = countable.filter(t => t.status === 'done_ontime' || t.status === 'done_late1')
      totalTasks += built.tasks.length
      doneTasks  += doneCountable.length + built.tasks.filter(t => t.status === 'done_late3').length
      return built
    })

    const clientsWithTasks = [...ownedWithTasks, ...secondaryWithTasks]

    // KPI: chỉ done_ontime mới được tính % hoàn thành — trễ hạn không tính
    let kpiDone = 0, kpiTotal = 0
    for (const c of clientsWithTasks) {
      for (const t of c.tasks) {
        kpiTotal++
        if (t.status === 'done_ontime') kpiDone++
      }
    }
    const taskPct = kpiTotal === 0 ? 100 : Math.round(kpiDone / kpiTotal * 100)
    const debtPct = totalFee  === 0 ? 0   : Math.round(collectedFee / totalFee * 100)

    return { ...s, clientCount: myOwnedClients.length, clients: clientsWithTasks, taskPct, debtPct, totalTasks, doneTasks, totalFee, collectedFee }
  })

  const sumKpiTotal = staffData.reduce((a, s) => a + s.clients.reduce((b, c) => b + c.tasks.length, 0), 0)
  const sumKpiDone  = staffData.reduce((a, s) => a + s.clients.reduce((b, c) => b + c.tasks.filter(t => t.status === 'done_ontime').length, 0), 0)
  const sumFee      = staffData.reduce((a, s) => a + s.totalFee, 0)
  const sumCollect  = staffData.reduce((a, s) => a + s.collectedFee, 0)

  const totals = {
    taskPct:     sumKpiTotal === 0 ? 100 : Math.round(sumKpiDone / sumKpiTotal * 100),
    debtPct:     sumFee      === 0 ? 0   : Math.round(sumCollect / sumFee * 100),
    totalTasks:  sumKpiTotal,
    doneTasks:   sumKpiDone,
    totalFee:    sumFee,
    collected:   sumCollect,
    clientCount: activeOwnedClients.length,
  }

  return Response.json({ room, staff: staffData, totals, taskDefs: taskDefs || [] })
}
