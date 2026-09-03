import { createClient } from '@supabase/supabase-js'
import { ensureRollovers } from '@/lib/debtRollover'
import { effectiveDeadlineDate } from '@/lib/deadline'
import { startedByMonth } from '@/lib/contractDates'
import { feeCountsForMonth, resolveFeeForMonth } from '@/lib/feeDue'
import { requireRoomAccess } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Supabase/PostgREST giới hạn TỐI ĐA 1000 dòng/query mặc định (im lặng cắt bớt, KHÔNG báo lỗi)
// — xem [[project_postgrest_1000row_limit]]. Route này scope theo 1 phòng nên hiện còn dư dả
// (phòng đông nhất ~490 dòng task_records/tháng), nhưng phòng sẽ tiếp tục nhận thêm nhân viên/
// khách hàng nên vẫn phân trang phòng ngừa thay vì đợi vỡ lại như kpi-overview/work-log.
async function fetchAllRows(buildQuery, pageSize = 1000) {
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

// GET /api/admin/room?roomId=xxx&year=2026&month=5
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')
  const year   = Number(searchParams.get('year')  || new Date().getFullYear())
  const month  = Number(searchParams.get('month') || new Date().getMonth() + 1)

  if (!roomId) return Response.json({ error: 'Missing roomId' }, { status: 400 })

  const auth = await requireRoomAccess(roomId)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

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

  // Phí HCNS của các công ty có tick "Có sử dụng DV HCNS". Đọc riêng, KHÔNG trộn vào
  // feeCollections — %-KPI thu hồi công nợ chỉ tính phí kế toán (yêu cầu chốt 2026-09-03).
  // Thiếu bảng hcns_* (bản clone) -> map rỗng, phần kế toán chạy nguyên vẹn.
  const hcns = await loadHcnsFees(supabase, clientIds, year, month)
  const hcnsByClient = hcns.byClient

  // task_records + fee_collections for selected month (both types)
  const [taskRecords, feeCollections, feeKhach, feePlanRows, changeLogRows] = await Promise.all([
    fetchAllRows(() => supabase.from('task_records').select('id, client_id, task_def_id, is_done, done_at, note').in('client_id', clientIds).eq('year', year).eq('month', month)),
    fetchAllRows(() => supabase.from('service_fees').select('client_id, amount').in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'ketoan')),
    // Lấy kèm `note` — tab "Công nợ phòng" hiển thị nội dung ghi chú của khoản thu khác
    // (vd "Phí làm BCTC năm 2025") để biết khoản đó thu về việc gì, không chỉ số tiền.
    fetchAllRows(() => supabase.from('service_fees').select('client_id, amount, note').in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'khach')),
    // Lịch sử đổi phí — tra đúng phí tại tháng đang xem thay vì monthly_fee sống.
    fetchAllRows(() => supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', clientIds).eq('type', 'fee_plan')),
    fetchAllRows(() => supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', clientIds).eq('entity', 'monthly_fee').eq('action', 'update')),
  ])

  // Build lookup maps
  const taskRecMap = {}  // clientId_taskDefId → record
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r

  const feeMap = {}
  for (const f of (feeCollections || [])) feeMap[f.client_id] = Number(f.amount) || 0
  const feeKhachMap = {}
  const feeKhachNoteMap = {}
  for (const f of (feeKhach || [])) {
    feeKhachMap[f.client_id] = Number(f.amount) || 0
    feeKhachNoteMap[f.client_id] = f.note || null
  }

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
      // Phí ĐÚNG tại tháng đang xem — không phải monthly_fee sống, tránh đổi phí hôm nay làm
      // sai lại công nợ của tháng cũ đang xem.
      monthly_fee: resolveFeeForMonth(feePlanRows || [], c.id, year, month, c.monthly_fee, changeLogRows || []),
      address: extra.address || null, tax_status: extra.tax_status || null, other_debt: Number(extra.other_debt) || 0,
      collected: feeMap[c.id] || 0, collectedKhach: feeKhachMap[c.id] || 0,
      collectedKhachNote: feeKhachNoteMap[c.id] || null,
      // Phí HCNS — chỉ để hiển thị/gộp vào "Còn phải thu", KHÔNG cộng vào collected.
      usesHcns: !!hcnsByClient[c.id],
      hcnsFee: hcnsByClient[c.id]?.fee || 0,
      hcnsCollected: hcnsByClient[c.id]?.collected || 0,
      hcnsDue: hcnsByClient[c.id]?.due || false,
      tasks: tasksWithStatus, taskTotal: tasksWithStatus.length,
      taskDone: tasksWithStatus.filter(t => t.status.startsWith('done')).length,
    }
  }

  const mean = (arr) => arr.length === 0 ? 0 : Math.round(arr.reduce((a, v) => a + v, 0) / arr.length)
  // % công việc của 1 công ty (dùng để tính trung bình cộng theo nhân viên) — cùng công thức với
  // app/api/admin/kpi-overview/route.js (KHÔNG dồn tổng số việc toàn bộ công ty rồi chia — cách
  // đó làm công ty nhiều việc lấn át công ty ít việc, ra số khác Trang chủ/Báo cáo KPI dù cùng 1
  // nhân viên cùng 1 tháng). %-công nợ thì NGƯỢC LẠI — xem debtPct bên dưới.
  const clientTaskPct = (built) => built.tasks.length === 0 ? 100 : Math.round(built.tasks.filter(t => t.status === 'done_ontime').length / built.tasks.length * 100)

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
      // Doanh thu chỉ tính công ty mình là nhân viên chính — công ty quý chưa tới hạn thu (hoặc
      // còn trong hạn khoan) không tính vào công nợ tháng này.
      if (feeCountsForMonth(c.fee_period, year, month)) {
        totalFee     += Number(built.monthly_fee) || 0
        collectedFee += feeMap[c.id] || 0
      }
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

    // %-KPI: TRUNG BÌNH CỘNG theo từng công ty CHÍNH (owned) — cùng công thức với kpi-overview
    // (Trang chủ, Báo cáo KPI), KHÔNG dồn tổng số việc/tổng phí rồi chia (cách cũ làm công ty
    // nhiều việc/phí lấn át công ty ít việc/phí, ra số khác 2 trang kia dù cùng 1 nhân viên/tháng).
    // Công ty phụ trách phụ vẫn hiện trong danh sách (clientsWithTasks) nhưng không tính vào %.
    const taskPcts = ownedWithTasks.map(clientTaskPct)
    const debtCountedClients = ownedWithTasks.filter(c => feeCountsForMonth(c.fee_period, year, month))
    const taskPct = myOwnedClients.length === 0 ? 0 : mean(taskPcts)
    // %-công nợ nhân viên (2026-08-24, đổi theo yêu cầu) = TỔNG tiền đã thu / TỔNG phí phải thu
    // gộp tất cả công ty đến hạn của người đó — totalFee/collectedFee đã dồn sẵn ở vòng lặp
    // ownedWithTasks.map bên trên, KHÔNG phải trung bình cộng % từng công ty (khác task ở trên).
    const debtPct = myOwnedClients.length === 0 ? 0 : (debtCountedClients.length ? (totalFee === 0 ? 100 : Math.round(collectedFee / totalFee * 100)) : 100)

    return { ...s, clientCount: myOwnedClients.length, clients: clientsWithTasks, taskPct, debtPct, totalTasks, doneTasks, totalFee, collectedFee }
  })

  const sumKpiTotal = staffData.reduce((a, s) => a + s.clients.reduce((b, c) => b + c.tasks.length, 0), 0)
  const sumKpiDone  = staffData.reduce((a, s) => a + s.clients.reduce((b, c) => b + c.tasks.filter(t => t.status === 'done_ontime').length, 0), 0)
  const sumFee      = staffData.reduce((a, s) => a + s.totalFee, 0)
  const sumCollect  = staffData.reduce((a, s) => a + s.collectedFee, 0)

  const totals = {
    // Trung bình cộng theo nhân viên trong phòng — khớp avg_task_pct/avg_debt_pct của
    // kpi-overview (Trang chủ) cho cùng phòng, thay vì dồn tổng việc/phí toàn phòng rồi chia.
    taskPct:     staffData.length ? mean(staffData.map(s => s.taskPct)) : 0,
    debtPct:     staffData.length ? mean(staffData.map(s => s.debtPct)) : 0,
    totalTasks:  sumKpiTotal,
    doneTasks:   sumKpiDone,
    totalFee:    sumFee,
    collected:   sumCollect,
    clientCount: activeOwnedClients.length,
  }

  // hcnsInstalled: bản clone không chạy sql/06_hcns_module.sql -> false -> thẻ HCNS không
  // render. Savitax thì luôn true, thẻ hiện kể cả khi chưa công ty nào dùng dịch vụ.
  return Response.json({ room, staff: staffData, totals, hcnsInstalled: hcns.installed, taskDefs: taskDefs || [] })
}

// Phí HCNS + tiền đã thu của tháng đang xem, khoá theo id công ty KẾ TOÁN.
//
// ⚠ RÀNG BUỘC CLONE-APP: bản clone không có bảng hcns_*. Thiếu bảng -> trả {} và trang Công nợ
// phòng chạy y như trước, không thẻ HCNS, không lỗi.
async function loadHcnsFees(supabase, clientIds, year, month) {
  const out = {}
  if (!clientIds?.length) return { installed: false, byClient: out }

  const { data: links, error } = await supabase.from('hcns_clients')
    .select('id, linked_client_id, hcns_fee, fee_period')
    .in('linked_client_id', clientIds).eq('category', 'thoi_ky').eq('is_active', true)
  // Lỗi = thiếu bảng (bản clone). Không lỗi mà rỗng = có module, chỉ là chưa ai bật DV HCNS.
  if (error) return { installed: false, byClient: out }
  if (!links?.length) return { installed: true, byClient: out }

  const { data: fees } = await supabase.from('hcns_service_fees')
    .select('hcns_client_id, year, month, amount, type').in('hcns_client_id', links.map(l => l.id))

  const paid = new Map()
  const plans = []
  for (const f of fees || []) {
    if (f.type === 'hcns') paid.set(f.hcns_client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)
    // resolveFeeForMonth lọc theo trường client_id — đổi tên khoá cho khớp.
    else if (f.type === 'fee_plan') plans.push({ ...f, client_id: f.hcns_client_id })
  }

  for (const l of links) {
    // Công ty HCNS thu theo quý: tháng không phải cuối quý chưa tới hạn, phí tính 0 cho tháng đó
    // — cùng luật với phí kế toán, tránh nhân sai x3.
    const due = feeCountsForMonth(l.fee_period, year, month)
    out[l.linked_client_id] = {
      due,
      fee: due ? resolveFeeForMonth(plans, l.id, year, month, Number(l.hcns_fee) || 0, []) : 0,
      collected: paid.get(l.id + '_' + year + '_' + month) || 0,
    }
  }
  return { installed: true, byClient: out }
}
