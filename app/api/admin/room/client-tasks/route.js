import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/room/client-tasks?clientId=xxx&month=5&year=2026&reportType=monthly
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId   = searchParams.get('clientId')
  const month      = Number(searchParams.get('month') || new Date().getMonth() + 1)
  const year       = Number(searchParams.get('year')  || new Date().getFullYear())
  const reportType = searchParams.get('reportType') || 'monthly'

  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()

  // Get tasks for this month + report type
  const { data: taskDefs, error: tdErr } = await supabase
    .from('task_definitions')
    .select('id, name, deadline_day, month, report_type, applies_to, is_active')
    .eq('is_active', true)
    .or(`month.eq.${month},month.is.null`)
    .order('deadline_day')

  if (tdErr) return Response.json({ error: tdErr.message }, { status: 400 })

  // Filter applicable tasks
  const applicable = (taskDefs || []).filter(t => {
    if (t.is_active === false) return false
    const taskType = t.report_type || 'monthly'
    return taskType === reportType
  })

  if (applicable.length === 0) return Response.json({ tasks: [] })

  // Get task records for this client + month
  const taskIds = applicable.map(t => t.id)
  const { data: records } = await supabase
    .from('task_records')
    .select('id, task_def_id, is_done, done_at, note')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('month', month)
    .in('task_def_id', taskIds)

  const recMap = {}
  for (const r of (records || [])) recMap[r.task_def_id] = r

  // Calculate status for each task
  const today = new Date()
  // Giới hạn ngày hạn không vượt quá số ngày thực có của tháng (VD: ngày 30 ở tháng 2 -> ngày 28/29)
  const deadlineDate = (day) => {
    const lastDay = new Date(year, month, 0).getDate()
    return new Date(year, month - 1, Math.min(day, lastDay))
  }
  const daysLate = (doneAt, day) => {
    if (!doneAt) return null
    return Math.floor((new Date(doneAt) - deadlineDate(day)) / 86400000)
  }

  const tasks = applicable.map(t => {
    const rec = recMap[t.id] || null
    let status = 'pending'
    if (rec && rec.is_done) {
      const late = daysLate(rec.done_at, t.deadline_day)
      if (late <= 0) status = 'done_ontime'
      else if (late <= 2) status = 'done_late1'
      else status = 'done_late3'
    } else {
      // Chỉ tính "Quá hạn" khi đã qua HẾT ngày hạn (từ 0h ngày kế tiếp), không phải ngay khi vừa tới ngày hạn
      const deadlineEnd = new Date(deadlineDate(t.deadline_day).getTime() + 86400000)
      status = today >= deadlineEnd ? 'overdue' : 'pending'
    }
    return { ...t, rec, status }
  })

  return Response.json({ tasks })
}
