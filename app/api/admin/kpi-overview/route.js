import { createClient } from '@supabase/supabase-js'
import { countsForMonth } from '@/lib/contractDates'
import { effectiveDeadlineDate } from '@/lib/deadline'
import { feeCountsForMonth, resolveFeeForMonth } from '@/lib/feeDue'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const mean = (arr) => arr.length === 0 ? 0 : Math.round(arr.reduce((a, v) => a + v, 0) / arr.length)

// Supabase/PostgREST giới hạn TỐI ĐA 1000 dòng mỗi query theo mặc định (im lặng cắt bớt, KHÔNG
// báo lỗi) — route này gộp dữ liệu TOÀN CÔNG TY (không lọc theo phòng như room/route.js) nên rất
// dễ vượt mốc này khi công ty có nhiều khách hàng × nhiều task/tháng (đã thực tế gặp: 1387 dòng
// task_records/tháng nhưng chỉ nhận về 1000, làm mất ngẫu nhiên việc đã làm của một số công ty,
// khiến %-KPI của đúng những công ty đó bị tính sai thành "chưa làm"). Phải phân trang lấy hết.
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

// GET /api/admin/kpi-overview?year=2026&month=6
// Tính KPI trực tiếp từ dữ liệu thật (clients, task_records, service_fees) — KHÔNG dùng
// bảng room_kpi/staff_kpi tĩnh (không ai cập nhật, gây lệch số liệu giữa các trang).
//
// Quy tắc:
// - % công việc của 1 công ty = % hoàn thành đúng hạn của riêng công ty đó trong tháng.
// - %-KPI công việc nhân viên = TRUNG BÌNH CỘNG % công việc của các công ty mình phụ trách CHÍNH
//   (mỗi công ty tính ngang nhau, không phân biệt quy mô).
// - %-KPI công nợ nhân viên (2026-08-24, đổi theo yêu cầu) = TỔNG tiền đã thu / TỔNG phí phải thu
//   GỘP TẤT CẢ công ty đến hạn của người đó — KHÔNG phải trung bình cộng % từng công ty (khác
//   công việc ở trên) — công ty phí lớn ảnh hưởng đúng theo tỉ trọng tiền thật. Khớp với cách
//   my-room/debt-overview/route.js và tab "Công nợ phòng" đã tính từ trước.
// - KPI phòng (cả công việc lẫn công nợ) = TRUNG BÌNH CỘNG của %-KPI toàn bộ nhân viên trong phòng
//   (mỗi nhân viên tính ngang nhau — bước này KHÔNG đổi, vẫn trung bình cộng như cũ).
// - KPI toàn công ty = TRUNG BÌNH CỘNG của KPI toàn bộ phòng đang có nhân viên.
// Trang chủ (Tổng quan) dùng chung API này cho MỌI nhân viên (đã xác nhận: ai cũng xem được số
// liệu toàn công ty, không riêng leader/admin) — chỉ cần đăng nhập, không cần quyền view_kpi_report.
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const year  = Number(searchParams.get('year')  || new Date().getFullYear())
  const month = Number(searchParams.get('month') || new Date().getMonth() + 1)

  const supabase = getAdmin()

  const [{ data: rooms }, { data: staffList }, { data: clients }, { data: taskDefs }] = await Promise.all([
    // Loại phòng HCNS khỏi KPI/xếp hạng phòng kế toán — phòng này có trang báo cáo riêng ở /hcns,
    // giống cách phòng Remote bị loại khỏi "Phòng xuất sắc nhất".
    supabase.from('rooms').select('id, name, type').neq('type', 'hcns').order('type').order('name'),
    supabase.from('staff').select('id, full_name, room_id, role'),
    supabase.from('clients').select('id, monthly_fee, report_type, fee_period, assigned_to, contract_start, created_at').eq('status', 'active'),
    supabase.from('task_definitions').select('id, deadline_day, month, report_type, is_active').eq('is_active', true).eq('month', month),
  ])

  // Công ty chỉ được tính từ tháng bắt đầu hợp đồng trở đi (Trình ký đã bị loại bởi status filter)
  const clientsActive = (clients || []).filter(c => countsForMonth(c, year, month))
  const clientIds = clientsActive.map(c => c.id)

  const [taskRecords, fees, feePlanRows, changeLogRows] = clientIds.length > 0
    ? await Promise.all([
        fetchAllRows(() => supabase.from('task_records').select('client_id, task_def_id, is_done, done_at').in('client_id', clientIds).eq('year', year).eq('month', month)),
        fetchAllRows(() => supabase.from('service_fees').select('client_id, amount').in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'ketoan')),
        // Lịch sử đổi phí — tra đúng phí tại tháng đang xem thay vì monthly_fee sống.
        fetchAllRows(() => supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', clientIds).eq('type', 'fee_plan')),
        fetchAllRows(() => supabase.from('client_change_log').select('client_id, old_value, changed_at').in('client_id', clientIds).eq('entity', 'monthly_fee').eq('action', 'update')),
      ])
    : [[], [], [], []]

  const taskRecMap = {}
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r
  const feeMap = {}
  for (const f of (fees || [])) feeMap[f.client_id] = Number(f.amount) || 0

  // Giới hạn ngày hạn không vượt quá số ngày thực có của tháng + dời sang thứ 2 nếu rơi Chủ nhật
  // (giống hệt room/route.js, my-room/route.js... — trước đây thiếu dời Chủ nhật, làm việc nộp
  // đúng ngày thứ 2 kế tiếp bị tính "trễ hạn" sai, %-KPI ở Trang chủ/Báo cáo KPI thấp hơn thực tế).
  const deadlineDate = (day) => effectiveDeadlineDate(year, month, day)

  const getApplicableTasks = (client) => (taskDefs || []).filter(t => {
    const taskType   = t.report_type || 'monthly'
    const clientType = client.report_type || 'monthly'
    return taskType === clientType
  })

  // % hoàn thành công việc của 1 công ty — chỉ tính việc xong ĐÚNG HẠN
  const clientTaskPct = (client) => {
    const tasks = getApplicableTasks(client)
    if (tasks.length === 0) return 100
    let doneOntime = 0
    for (const t of tasks) {
      const rec = taskRecMap[client.id + '_' + t.id]
      if (rec && rec.is_done) {
        const late = Math.floor((new Date(rec.done_at) - deadlineDate(t.deadline_day)) / 86400000)
        if (late <= 0) doneOntime++
      }
    }
    return Math.round(doneOntime / tasks.length * 100)
  }

  // Phí ĐÚNG của 1 công ty tại tháng đang xem — dùng đúng phí tại tháng đang xem, không phải
  // monthly_fee sống (tránh đổi phí hôm nay làm sai lại công nợ tháng cũ đang xem).
  const resolveClientFee = (client) =>
    resolveFeeForMonth(feePlanRows || [], client.id, year, month, client.monthly_fee, changeLogRows || [])

  const clientsByStaff = {}
  for (const c of clientsActive) {
    if (!c.assigned_to) continue
    if (!clientsByStaff[c.assigned_to]) clientsByStaff[c.assigned_to] = []
    clientsByStaff[c.assigned_to].push(c)
  }

  const staffResults = (staffList || []).map(s => {
    const myClients = clientsByStaff[s.id] || []
    const taskPcts = myClients.map(clientTaskPct)
    // Công ty quý chưa tới hạn thu (hoặc còn trong hạn khoan) không tính vào công nợ tháng này.
    const debtCountedClients = myClients.filter(c => feeCountsForMonth(c.fee_period, year, month))
    const totalDebtFee       = debtCountedClients.reduce((a, c) => a + resolveClientFee(c), 0)
    const totalDebtCollected = debtCountedClients.reduce((a, c) => a + (feeMap[c.id] || 0), 0)
    return {
      staff_id:     s.id,
      full_name:    s.full_name,
      room_id:      s.room_id,
      role:         s.role,
      client_count: myClients.length,
      // Nhân viên không phụ trách công ty nào thì % công việc = 0%, không phải 100%.
      task_pct:     myClients.length ? mean(taskPcts) : 0,
      debt_pct:     myClients.length
        ? (debtCountedClients.length ? (totalDebtFee === 0 ? 100 : Math.round(totalDebtCollected / totalDebtFee * 100)) : 100)
        : 0,
    }
  })

  const staffByRoom = {}
  for (const s of staffResults) {
    if (!s.room_id) continue
    if (!staffByRoom[s.room_id]) staffByRoom[s.room_id] = []
    staffByRoom[s.room_id].push(s)
  }

  const roomResults = (rooms || []).map(r => {
    const roomStaff = staffByRoom[r.id] || []
    return {
      room_id:      r.id,
      room_name:    r.name,
      room_type:    r.type,
      staff_count:  roomStaff.length,
      avg_task_pct: roomStaff.length ? mean(roomStaff.map(s => s.task_pct)) : 0,
      avg_debt_pct: roomStaff.length ? mean(roomStaff.map(s => s.debt_pct)) : 0,
      staff:        roomStaff,
    }
  })

  const roomsWithStaff = roomResults.filter(r => r.staff_count > 0)
  const company = {
    avg_task_pct: roomsWithStaff.length ? mean(roomsWithStaff.map(r => r.avg_task_pct)) : 0,
    avg_debt_pct: roomsWithStaff.length ? mean(roomsWithStaff.map(r => r.avg_debt_pct)) : 0,
  }

  // Trang "Phòng nghiệp vụ" (/rooms) cũng dùng chung API này để hiện tổng quan TOÀN BỘ phòng cho
  // mọi role (không phải dữ liệu cần giấu ở mức tổng hợp %) — việc giới hạn trưởng phòng chỉ thấy
  // đúng phòng mình khi xem "Báo cáo KPI" được lọc riêng ở app/report/page.js (client-side), không
  // lọc ở đây để tránh phá trang /rooms.
  return Response.json({ rooms: roomResults, staff: staffResults, company })
}
