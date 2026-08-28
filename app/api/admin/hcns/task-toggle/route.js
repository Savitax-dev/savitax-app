import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST /api/admin/hcns/task-toggle
// Tích / bỏ tích một công việc HCNS. Hai loại checklist dùng chung route này:
//   kind='case'      -> công việc của 1 dịch vụ trong hồ sơ Thời điểm/Vãng lai
//                       Body: { kind, taskId, done, staffId }
//   kind='recurring' -> công việc định kỳ hàng tháng của khách Thời kỳ
//                       Body: { kind, hcnsClientId, templateTaskId, year, month, done, staffId }
export async function POST(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { kind, done, staffId } = body
    const supabase = getAdmin()
    const who = staffId || auth.caller?.staffId || null
    const stamp = done ? { done: true, done_by: who, done_at: new Date().toISOString() }
      : { done: false, done_by: null, done_at: null }

    if (kind === 'case') {
      if (!body.taskId) return Response.json({ error: 'Thiếu taskId' }, { status: 400 })
      const { error } = await supabase.from('hcns_case_service_tasks').update(stamp).eq('id', body.taskId)
      if (error) return Response.json({ error: error.message }, { status: 400 })
      return Response.json({ ok: true })
    }

    if (kind === 'recurring') {
      const { hcnsClientId, templateTaskId, year, month } = body
      if (!hcnsClientId || !templateTaskId || !year || !month) {
        return Response.json({ error: 'Thiếu thông tin công việc định kỳ' }, { status: 400 })
      }
      // Dòng chỉ được tạo khi tích lần đầu (giống task_records bên kế toán) — không pre-insert
      // sẵn cho mọi công ty × mọi tháng, vừa tốn vừa khó dọn khi mẫu đổi.
      const { error } = await supabase.from('hcns_recurring_tasks').upsert({
        hcns_client_id: hcnsClientId,
        template_task_id: templateTaskId,
        year: Number(year), month: Number(month),
        ...stamp,
      }, { onConflict: 'hcns_client_id,template_task_id,year,month' })
      if (error) return Response.json({ error: error.message }, { status: 400 })
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'kind phải là "case" hoặc "recurring"' }, { status: 400 })
  } catch (e) {
    console.error('hcns/task-toggle exception:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
