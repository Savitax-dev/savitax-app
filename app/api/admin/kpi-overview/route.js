import { createClient } from '@supabase/supabase-js'
import { startedByMonth } from '@/lib/contractDates'
import { feeCountsForMonth } from '@/lib/feeDue'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const mean = (arr) => arr.length === 0 ? 0 : Math.round(arr.reduce((a, v) => a + v, 0) / arr.length)

// GET /api/admin/kpi-overview?year=2026&month=6
// Tính KPI trực tiếp từ dữ liệu thật (clients, task_records, service_fees) — KHÔNG dùng
// bảng room_kpi/staff_kpi tĩnh (không ai cập nhật, gây lệch số liệu giữa các trang).
//
// Quy tắc:
// - % của 1 công ty = % hoàn thành công việc / % thu hồi công nợ của riêng công ty đó trong tháng.
// - KPI nhân viên = TRUNG BÌNH CỘNG của % các công ty mình phụ trách CHÍNH (không chia theo số lượng việc).
// - KPI phòng = TRUNG BÌNH CỘNG của KPI toàn bộ nhân viên trong phòng.
// - KPI toàn công ty = TRUNG BÌNH CỘNG của KPI toàn bộ phòng đang có nhân viên.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const year  = Number(searchParams.get('year')  || new Date().getFullYear())
  const month = Number(searchParams.get('month') || new Date().getMonth() + 1)

  const supabase = getAdmin()

  const [{ data: rooms }, { data: staffList }, { data: clients }, { data: taskDefs }] = await Promise.all([
    supabase.from('rooms').select('id, name, type').order('type').order('name'),
    supabase.from('staff').select('id, full_name, room_id'),
    supabase.from('clients').select('id, monthly_fee, report_type, fee_period, assigned_to, contract_start').eq('status', 'active'),
    supabase.from('task_definitions').select('id, deadline_day, month, report_type, is_active').eq('is_active', true).eq('month', month),
  ])

  // Công ty chỉ được tính từ tháng bắt đầu hợp đồng trở đi (Trình ký đã bị loại bởi status filter)
  const clientsActive = (clients || []).filter(c => startedByMonth(c.contract_start, year, month))
  const clientIds = clientsActive.map(c => c.id)

  const [{ data: taskRecords }, { data: fees }] = clientIds.length > 0
    ? await Promise.all([
        supabase.from('task_records').select('client_id, task_def_id, is_done, done_at').in('client_id', clientIds).eq('year', year).eq('month', month),
        supabase.from('service_fees').select('client_id, amount').in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'ketoan'),
      ])
    : [{ data: [] }, { data: [] }]

  const taskRecMap = {}
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r
  const feeMap = {}
  for (const f of (fees || [])) feeMap[f.client_id] = Number(f.amount) || 0

  // Giới hạn ngày hạn không vượt quá số ngày thực có của tháng
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const deadlineDate = (day) => new Date(year, month - 1, Math.min(day, lastDayOfMonth))

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

  // % thu hồi công nợ của 1 công ty
  const clientDebtPct = (client) => {
    const fee = Number(client.monthly_fee) || 0
    if (fee === 0) return 100
    const collected = feeMap[client.id] || 0
    return Math.min(100, Math.round(collected / fee * 100))
  }

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
    const debtPcts = debtCountedClients.map(clientDebtPct)
    return {
      staff_id:     s.id,
      full_name:    s.full_name,
      room_id:      s.room_id,
      client_count: myClients.length,
      task_pct:     myClients.length ? mean(taskPcts) : 100,
      debt_pct:     myClients.length ? (debtCountedClients.length ? mean(debtPcts) : 100) : 0,
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

  return Response.json({ rooms: roomResults, staff: staffResults, company })
}
