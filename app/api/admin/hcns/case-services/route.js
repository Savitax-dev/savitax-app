import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { HCNS_STATUSES as STATUSES, HCNS_STATUS_LABEL as STATUS_LABEL } from '@/lib/hcnsStatus'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}


// Dịch vụ trong hồ sơ Thời điểm / Vãng lai. 1 hồ sơ có thể chạy nhiều dịch vụ song song, mỗi
// dịch vụ có checklist + trạng thái + chi phí riêng.

// GET ?hcnsClientId=...  -> danh sách dịch vụ của 1 hồ sơ, kèm checklist và nhật ký trạng thái.
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const hcnsClientId = searchParams.get('hcnsClientId')
  if (!hcnsClientId) return Response.json({ error: 'Thiếu hcnsClientId' }, { status: 400 })

  const supabase = getAdmin()
  const { data: services, error } = await supabase.from('hcns_case_services')
    .select('*').eq('hcns_client_id', hcnsClientId).order('received_at', { ascending: false }).order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const ids = (services || []).map(s => s.id)
  if (!ids.length) return Response.json({ data: [] })

  const [{ data: tasks }, { data: logs }, { data: templates }, { data: tplTasks }, { data: staff }] = await Promise.all([
    supabase.from('hcns_case_service_tasks').select('*').in('case_service_id', ids),
    supabase.from('hcns_case_service_status_log').select('*').in('case_service_id', ids)
      .order('changed_at', { ascending: false }),
    supabase.from('hcns_service_templates').select('id, name'),
    supabase.from('hcns_service_template_tasks').select('id, name, sort_order, is_active'),
    supabase.from('staff').select('id, full_name'),
  ])

  const tplById = new Map((templates || []).map(t => [t.id, t]))
  const tplTaskById = new Map((tplTasks || []).map(t => [t.id, t]))
  const staffById = new Map((staff || []).map(s => [s.id, s]))

  const tasksByService = {}
  for (const t of (tasks || [])) (tasksByService[t.case_service_id] ||= []).push(t)
  const logsByService = {}
  for (const l of (logs || [])) (logsByService[l.case_service_id] ||= []).push(l)

  const data = (services || []).map(s => {
    // Chỉ hiện công việc còn active trong mẫu — công việc đã bị ẩn ở mẫu thì không bắt làm nữa,
    // nhưng dòng đã tích vẫn giữ trong DB để không mất lịch sử.
    const rows = (tasksByService[s.id] || [])
      .map(t => ({ ...t, name: tplTaskById.get(t.template_task_id)?.name || '(công việc đã bị xoá)',
        sort_order: tplTaskById.get(t.template_task_id)?.sort_order || 0,
        stillActive: tplTaskById.get(t.template_task_id)?.is_active !== false,
        doneByName: staffById.get(t.done_by)?.full_name || null }))
      .filter(t => t.stillActive || t.done)
      .sort((a, b) => a.sort_order - b.sort_order)
    const done = rows.filter(t => t.done).length
    return {
      ...s,
      cost: Number(s.cost) || 0,
      templateName: tplById.get(s.template_id)?.name || '(dịch vụ đã bị xoá)',
      statusLabel: STATUS_LABEL[s.status] || s.status,
      tasks: rows,
      doneCount: done,
      totalCount: rows.length,
      percent: rows.length ? Math.round(done / rows.length * 100) : 0,
      statusLog: (logsByService[s.id] || []).map(l => ({
        ...l, statusLabel: STATUS_LABEL[l.status] || l.status,
        changedByName: staffById.get(l.changed_by)?.full_name || null,
      })),
    }
  })
  return Response.json({ data })
}

// POST — thêm 1 dịch vụ vào hồ sơ, tự sinh đủ checklist theo mẫu đã chọn.
export async function POST(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { hcnsClientId, templateId, cost, received_at, expected_at, status, note } = await request.json()
  if (!hcnsClientId || !templateId) return Response.json({ error: 'Thiếu hồ sơ hoặc loại dịch vụ' }, { status: 400 })
  if (!received_at) return Response.json({ error: 'Thiếu thời gian nhận' }, { status: 400 })

  const initStatus = STATUSES.includes(status) ? status : 'thu_thap'
  const supabase = getAdmin()

  const { data: svc, error } = await supabase.from('hcns_case_services').insert({
    hcns_client_id: hcnsClientId,
    template_id: templateId,
    cost: Number(cost) || 0,
    received_at, expected_at: expected_at || null,
    status: initStatus,
    note: note || null,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const { data: tplTasks } = await supabase.from('hcns_service_template_tasks')
    .select('id').eq('template_id', templateId).eq('is_active', true).order('sort_order')
  if (tplTasks?.length) {
    await supabase.from('hcns_case_service_tasks').insert(
      tplTasks.map(t => ({ case_service_id: svc.id, template_task_id: t.id, done: false }))
    )
  }

  await supabase.from('hcns_case_service_status_log').insert({
    case_service_id: svc.id, status: initStatus, changed_by: auth.caller?.staffId || null,
  })

  return Response.json({ data: svc, taskCount: tplTasks?.length || 0 })
}

// PATCH — đổi trạng thái (tự ghi nhật ký) hoặc sửa chi phí / ngày dự kiến / ghi chú.
export async function PATCH(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id, status, cost, received_at, expected_at, note } = await request.json()
  if (!id) return Response.json({ error: 'Thiếu id dịch vụ' }, { status: 400 })

  const supabase = getAdmin()
  const { data: before } = await supabase.from('hcns_case_services').select('status').eq('id', id).maybeSingle()

  const patch = {}
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return Response.json({ error: 'Trạng thái không hợp lệ' }, { status: 400 })
    patch.status = status
  }
  if (cost        !== undefined) patch.cost        = Number(cost) || 0
  if (received_at !== undefined) patch.received_at = received_at || null
  if (expected_at !== undefined) patch.expected_at = expected_at || null
  if (note        !== undefined) patch.note        = note

  const { error } = await supabase.from('hcns_case_services').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Chỉ ghi nhật ký khi trạng thái THỰC SỰ đổi — tránh rác khi chỉ sửa chi phí.
  if (status !== undefined && before && before.status !== status) {
    await supabase.from('hcns_case_service_status_log').insert({
      case_service_id: id, status, changed_by: auth.caller?.staffId || null,
    })
  }
  return Response.json({ ok: true })
}

// DELETE ?id=... — xoá 1 dịch vụ khỏi hồ sơ (nhập nhầm). Checklist và nhật ký của nó xoá theo
// (on delete cascade) vì chúng chỉ có nghĩa trong phạm vi dịch vụ đó.
export async function DELETE(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('hcns_case_services').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
