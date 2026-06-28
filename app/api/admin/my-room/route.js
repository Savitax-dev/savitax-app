import { createClient } from '@supabase/supabase-js'
import { ensureRollovers } from '@/lib/debtRollover'
import { effectiveDeadlineDate } from '@/lib/deadline'
import { getPeriodMonths } from '@/lib/period'
import { startedByMonth } from '@/lib/contractDates'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/admin/my-room?userId=xxx&year=2026&month=6
// GET /api/admin/my-room?userId=xxx&year=2026&period=quarter&quarter=2 (chỉ tổng hợp công nợ, không có tasks)
// GET /api/admin/my-room?userId=xxx&year=2026&period=year
// Trả về room + clients + tasks của nhân viên đó.
// Bao gồm cả công ty mà nhân viên này là "phụ trách phụ" (client_secondary_staff) —
// chỉ để theo dõi/cập nhật công việc & công nợ, KHÔNG cộng doanh thu vào KPI cá nhân
// (doanh thu/công nợ vẫn tính cho nhân viên chính + phòng của nhân viên chính).
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId  = searchParams.get('userId')
  const year    = Number(searchParams.get('year')  || new Date().getFullYear())
  const period  = searchParams.get('period') || 'month'
  const month   = Number(searchParams.get('month')   || new Date().getMonth() + 1)
  const quarter = Number(searchParams.get('quarter')  || 1)
  const months  = getPeriodMonths(period, { month, quarter })

  if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 })

  const supabase = getAdmin()

  // Tìm staff record theo id HOẶC email (fallback) — đã embed sẵn thông tin phòng,
  // không cần truy vấn `rooms` riêng nữa (giảm 1 round-trip).
  let { data: staffRecord } = await supabase
    .from('staff').select('*, rooms(id, name, type)').eq('id', userId).single()

  if (!staffRecord || !staffRecord.room_id) {
    return Response.json({ error: 'Staff not found or no room assigned' }, { status: 404 })
  }

  const room = staffRecord.rooms || null

  // Chạy song song mọi truy vấn không phụ thuộc lẫn nhau trong CÙNG 1 lượt
  // (giảm round-trip tới Supabase — mỗi lượt chờ tốn ~300-800ms do khác vùng với Vercel)
  const [{ data: taskDefs }, { data: secondaryRows }, { data: primaryClients }] = await Promise.all([
    supabase.from('task_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('client_secondary_staff').select('client_id').eq('staff_id', staffRecord.id),
    supabase.from('clients')
      .select('id, name, tax_code, monthly_fee, other_debt, report_type, status, client_code')
      .eq('assigned_to', staffRecord.id).eq('status', 'active'),
  ])

  const secondaryClientIds = (secondaryRows || []).map(r => r.client_id)
  const { data: secondaryClients } = secondaryClientIds.length > 0
    ? await supabase.from('clients')
        .select('id, name, tax_code, monthly_fee, other_debt, report_type, status, client_code, contract_start')
        .in('id', secondaryClientIds).eq('status', 'active')
    : { data: [] }

  const clients = [
    ...(primaryClients || []).map(c => ({ ...c, isSecondary: false })),
    ...(secondaryClients || []).map(c => ({ ...c, isSecondary: true })),
  ]

  const clientIds = clients.map(c => c.id)

  if (clientIds.length === 0) {
    return Response.json({
      staff: staffRecord,
      room,
      clients: [],
      taskPct: 100,
      debtPct: 0,
    })
  }

  // Tự động chuyển nợ thiếu của các tháng trước thành nợ tồn — chỉ khi đang xem đúng tháng hiện tại.
  const nowDt = new Date()
  if (period === 'month' && year === nowDt.getFullYear() && month === nowDt.getMonth() + 1) {
    await ensureRollovers(supabase, clientIds, year, month)
    const { data: refreshedDebt } = await supabase.from('clients').select('id, other_debt').in('id', clientIds)
    const refreshedMap = {}
    for (const r of (refreshedDebt || [])) refreshedMap[r.id] = r.other_debt
    for (const c of clients) if (refreshedMap[c.id] !== undefined) c.other_debt = refreshedMap[c.id]
  }

  const isMonthOnly = period === 'month'

  const [{ data: taskRecords }, { data: feeKetoan }, { data: feeKhach }] = await Promise.all([
    isMonthOnly
      ? supabase.from('task_records').select('id, client_id, task_def_id, is_done, done_at, note')
          .in('client_id', clientIds).eq('year', year).eq('month', month)
      : Promise.resolve({ data: [] }),
    supabase.from('service_fees').select('client_id, amount')
      .in('client_id', clientIds).eq('year', year).in('month', months).eq('type', 'ketoan'),
    supabase.from('service_fees').select('client_id, amount')
      .in('client_id', clientIds).eq('year', year).in('month', months).eq('type', 'khach'),
  ])

  const taskRecMap = {}
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r

  // Gộp (sum) vì kỳ quý/năm có thể có nhiều dòng (nhiều tháng) cho cùng 1 công ty
  const feeMap = {}
  for (const f of (feeKetoan || [])) feeMap[f.client_id] = (feeMap[f.client_id] || 0) + (Number(f.amount) || 0)
  const feeKhachMap = {}
  for (const f of (feeKhach || [])) feeKhachMap[f.client_id] = (feeKhachMap[f.client_id] || 0) + (Number(f.amount) || 0)

  // Giới hạn ngày hạn không vượt quá số ngày thực có của tháng + dời sang thứ 2 nếu rơi Chủ nhật
  const deadlineDate = (d) => effectiveDeadlineDate(year, month, d)
  const taskStatus = (rec, deadlineDay) => {
    if (!rec || !rec.is_done) {
      // Chỉ tính "Quá hạn" khi đã qua HẾT ngày hạn (từ 0h ngày kế tiếp)
      const deadlineEnd = new Date(deadlineDate(deadlineDay).getTime() + 86400000)
      return new Date() >= deadlineEnd ? 'overdue' : 'pending'
    }
    const late = Math.floor((new Date(rec.done_at) - deadlineDate(deadlineDay)) / 86400000)
    if (late <= 0) return 'done_ontime'
    if (late <= 2) return 'done_late1'
    return 'done_late3'
  }

  const getApplicableTasks = (client) => (taskDefs || []).filter(t => {
    if (t.is_active === false) return false
    if (t.month && Number(t.month) !== month) return false
    const taskType   = t.report_type || 'monthly'
    const clientType = client.report_type || 'monthly'
    return taskType === clientType
  })

  // Số tháng trong kỳ mà công ty đã bắt đầu hợp đồng (gate theo contract_start).
  // Công ty chưa tới mốc bắt đầu trong kỳ đang xem sẽ bị loại khỏi danh sách (không tính).
  const monthsActive = (c) => months.filter(m => startedByMonth(c.contract_start, year, m)).length

  const clientsWithTasks = clients.filter(c => monthsActive(c) > 0).map(c => {
    const appTasks = isMonthOnly ? getApplicableTasks(c) : []
    const tasks = appTasks.map(t => {
      const rec    = taskRecMap[c.id + '_' + t.id] || null
      const status = taskStatus(rec, t.deadline_day)
      return { ...t, rec, status }
    })
    return {
      ...c,
      tasks,
      taskTotal:      tasks.length,
      taskDone:       tasks.filter(t => t.status.startsWith('done')).length,
      periodFee:      (Number(c.monthly_fee) || 0) * monthsActive(c),
      collected:      feeMap[c.id] || 0,
      collectedKhach: feeKhachMap[c.id] || 0,
    }
  })

  // KPI doanh thu/công nợ cá nhân: chỉ tính các công ty mình là nhân viên CHÍNH
  const ownedClients = clientsWithTasks.filter(c => !c.isSecondary)
  const totalTasks = clientsWithTasks.reduce((a, c) => a + c.tasks.length, 0)
  const doneTasks  = clientsWithTasks.reduce((a, c) => a + c.tasks.filter(t => t.status === 'done_ontime').length, 0)
  const totalFee   = ownedClients.reduce((a, c) => a + c.periodFee, 0)
  const totalCol   = ownedClients.reduce((a, c) => a + c.collected, 0)

  return Response.json({
    staff:   staffRecord,
    room,
    clients: clientsWithTasks,
    taskPct: isMonthOnly ? (totalTasks === 0 ? 100 : Math.round(doneTasks / totalTasks * 100)) : null,
    debtPct: totalFee   === 0 ? 0   : Math.round(totalCol  / totalFee  * 100),
    totalTasks, doneTasks, totalFee, totalCol,
  })
}
