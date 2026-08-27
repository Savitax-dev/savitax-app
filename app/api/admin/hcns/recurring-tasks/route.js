import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/recurring-tasks?hcnsClientId=..&year=..&month=..
//     hoặc ?clientId=<id bảng clients>&year=..&month=..
//
// Checklist định kỳ hàng tháng của khách Thời kỳ. Danh sách công việc KHÔNG lưu sẵn theo tháng —
// nó được suy ra từ mẫu "DV HCNS Thời Kỳ" đang active, ghép với các dòng đã tích của đúng tháng
// đó. Nhờ vậy sửa mẫu là mọi công ty cập nhật ngay, không phải đụng dữ liệu từng công ty.
//
// Dùng requireLogin (không đòi view_hcns) vì nhân viên kế toán cũng xem checklist HCNS của công
// ty mình phụ trách ngay trong hồ sơ công ty.
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  let hcnsClientId = searchParams.get('hcnsClientId')
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return Response.json({ error: 'Thiếu year/month' }, { status: 400 })

  const supabase = getAdmin()

  if (!hcnsClientId && clientId) {
    const { data } = await supabase.from('hcns_clients').select('id')
      .eq('linked_client_id', clientId).eq('is_active', true).maybeSingle()
    hcnsClientId = data?.id || null
  }
  // Công ty không dùng HCNS (hoặc bản clone chưa cài module) — trả rỗng, không phải lỗi.
  if (!hcnsClientId) return Response.json({ tasks: [], doneCount: 0, totalCount: 0, percent: 0 })

  const { data: tpl } = await supabase.from('hcns_service_templates')
    .select('id, name').eq('is_recurring', true).eq('is_active', true).maybeSingle()
  if (!tpl) return Response.json({ tasks: [], doneCount: 0, totalCount: 0, percent: 0, templateName: null })

  const [{ data: tplTasks }, { data: records }, { data: staff }] = await Promise.all([
    supabase.from('hcns_service_template_tasks').select('id, name, sort_order')
      .eq('template_id', tpl.id).eq('is_active', true).order('sort_order').order('created_at'),
    supabase.from('hcns_recurring_tasks').select('template_task_id, done, done_by, done_at')
      .eq('hcns_client_id', hcnsClientId).eq('year', year).eq('month', month),
    supabase.from('staff').select('id, full_name'),
  ])

  const recByTask = new Map((records || []).map(r => [r.template_task_id, r]))
  const staffById = new Map((staff || []).map(s => [s.id, s]))

  const tasks = (tplTasks || []).map(t => {
    const rec = recByTask.get(t.id)
    return {
      templateTaskId: t.id,
      name: t.name,
      done: rec?.done === true,
      doneBy: rec?.done_by || null,
      doneByName: rec?.done_by ? (staffById.get(rec.done_by)?.full_name || null) : null,
      doneAt: rec?.done_at || null,
    }
  })
  const doneCount = tasks.filter(t => t.done).length
  return Response.json({
    tasks, doneCount, totalCount: tasks.length,
    percent: tasks.length ? Math.round(doneCount / tasks.length * 100) : 0,
    templateName: tpl.name,
    hcnsClientId,
  })
}
