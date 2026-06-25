import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/admin/my-room?userId=xxx&year=2026&month=6
// Trả về room + clients + tasks của nhân viên đó.
// Bao gồm cả công ty mà nhân viên này là "phụ trách phụ" (client_secondary_staff) —
// chỉ để theo dõi/cập nhật công việc & công nợ, KHÔNG cộng doanh thu vào KPI cá nhân
// (doanh thu/công nợ vẫn tính cho nhân viên chính + phòng của nhân viên chính).
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const year   = Number(searchParams.get('year')  || new Date().getFullYear())
  const month  = Number(searchParams.get('month') || new Date().getMonth() + 1)

  if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 })

  const supabase = getAdmin()

  // Tìm staff record theo id HOẶC email (fallback)
  let { data: staffRecord } = await supabase
    .from('staff').select('*, rooms(id, name, type)').eq('id', userId).single()

  if (!staffRecord || !staffRecord.room_id) {
    return Response.json({ error: 'Staff not found or no room assigned' }, { status: 404 })
  }

  // Gọi room API nội bộ
  const roomId = staffRecord.room_id

  const [{ data: room }, { data: taskDefs }, { data: secondaryRows }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('task_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('client_secondary_staff').select('client_id').eq('staff_id', staffRecord.id),
  ])

  const secondaryClientIds = (secondaryRows || []).map(r => r.client_id)

  // Clients của nhân viên này: làm chính (assigned_to) HOẶC phụ (client_secondary_staff)
  const [{ data: primaryClients }, { data: secondaryClients }] = await Promise.all([
    supabase.from('clients')
      .select('id, name, tax_code, monthly_fee, report_type, status, client_code')
      .eq('assigned_to', staffRecord.id).eq('status', 'active'),
    secondaryClientIds.length > 0
      ? supabase.from('clients')
          .select('id, name, tax_code, monthly_fee, report_type, status, client_code')
          .in('id', secondaryClientIds).eq('status', 'active')
      : Promise.resolve({ data: [] }),
  ])

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

  const [{ data: taskRecords }, { data: feeKetoan }, { data: feeKhach }] = await Promise.all([
    supabase.from('task_records').select('id, client_id, task_def_id, is_done, done_at, note')
      .in('client_id', clientIds).eq('year', year).eq('month', month),
    supabase.from('service_fees').select('client_id, amount')
      .in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'ketoan'),
    supabase.from('service_fees').select('client_id, amount')
      .in('client_id', clientIds).eq('year', year).eq('month', month).eq('type', 'khach'),
  ])

  const taskRecMap = {}
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r

  const feeMap = {}
  for (const f of (feeKetoan || [])) feeMap[f.client_id] = Number(f.amount) || 0
  const feeKhachMap = {}
  for (const f of (feeKhach || [])) feeKhachMap[f.client_id] = Number(f.amount) || 0

  // Giới hạn ngày hạn không vượt quá số ngày thực có của tháng (VD: ngày 30 ở tháng 2 -> ngày 28/29)
  const deadlineDate = (d) => {
    const lastDay = new Date(year, month, 0).getDate()
    return new Date(year, month - 1, Math.min(d, lastDay))
  }
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

  const clientsWithTasks = clients.map(c => {
    const appTasks = getApplicableTasks(c)
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
      collected:      feeMap[c.id] || 0,
      collectedKhach: feeKhachMap[c.id] || 0,
    }
  })

  // KPI doanh thu/công nợ cá nhân: chỉ tính các công ty mình là nhân viên CHÍNH
  const ownedClients = clientsWithTasks.filter(c => !c.isSecondary)
  const totalTasks = clientsWithTasks.reduce((a, c) => a + c.tasks.length, 0)
  const doneTasks  = clientsWithTasks.reduce((a, c) => a + c.tasks.filter(t => t.status === 'done_ontime').length, 0)
  const totalFee   = ownedClients.reduce((a, c) => a + (Number(c.monthly_fee) || 0), 0)
  const totalCol   = ownedClients.reduce((a, c) => a + c.collected, 0)

  return Response.json({
    staff:   staffRecord,
    room,
    clients: clientsWithTasks,
    taskPct: totalTasks === 0 ? 100 : Math.round(doneTasks / totalTasks * 100),
    debtPct: totalFee   === 0 ? 0   : Math.round(totalCol  / totalFee  * 100),
    totalTasks, doneTasks, totalFee, totalCol,
  })
}
