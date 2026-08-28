import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Quản lý MẪU dịch vụ HCNS + danh sách công việc của từng mẫu (trang /hcns/checklist).
//   is_recurring=true  -> mẫu định kỳ hàng tháng "DV HCNS Thời Kỳ", tự áp cho mọi khách thời kỳ
//   is_recurring=false -> mẫu theo hồ sơ, chọn khi thêm dịch vụ vào hồ sơ Thời điểm/Vãng lai
//
// Sửa công việc của mẫu là áp dụng NGAY cho mọi hồ sơ/công ty đang dùng mẫu đó — giống hệt cơ chế
// task_definitions bên kế toán, không phải đụng dữ liệu từng hồ sơ.

// GET — ai xem được trang HCNS đều đọc được (cần để render checklist).
export async function GET() {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const [{ data: templates, error }, { data: tasks }] = await Promise.all([
    supabase.from('hcns_service_templates').select('*').eq('is_active', true)
      .order('is_recurring', { ascending: false }).order('sort_order').order('name'),
    supabase.from('hcns_service_template_tasks').select('*').eq('is_active', true)
      .order('sort_order').order('created_at'),
  ])
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const byTemplate = {}
  for (const t of (tasks || [])) (byTemplate[t.template_id] ||= []).push(t)

  // Đếm số nơi đang dùng mẫu, để trang cảnh báo trước khi sửa/ẩn.
  const [{ data: usedByCase }, { data: recurringClients }] = await Promise.all([
    supabase.from('hcns_case_services').select('template_id'),
    supabase.from('hcns_clients').select('id').eq('category', 'thoi_ky').eq('is_active', true),
  ])
  const caseCount = {}
  for (const r of (usedByCase || [])) caseCount[r.template_id] = (caseCount[r.template_id] || 0) + 1

  const data = (templates || []).map(t => ({
    ...t,
    tasks: byTemplate[t.id] || [],
    usageCount: t.is_recurring ? (recurringClients || []).length : (caseCount[t.id] || 0),
  }))
  return Response.json({ data })
}

// POST — thêm mẫu dịch vụ mới, hoặc thêm công việc vào 1 mẫu.
//   { name, is_recurring }              -> tạo mẫu
//   { templateId, taskName }            -> thêm công việc vào mẫu
export async function POST(request) {
  const auth = await callerHasPermission('manage_hcns_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { name, is_recurring, templateId, taskName } = await request.json()
  const supabase = getAdmin()

  if (templateId && taskName) {
    const { data: last } = await supabase.from('hcns_service_template_tasks')
      .select('sort_order').eq('template_id', templateId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await supabase.from('hcns_service_template_tasks').insert({
      template_id: templateId, name: taskName, sort_order: (last?.sort_order || 0) + 1, is_active: true,
    }).select().single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data })
  }

  if (!name) return Response.json({ error: 'Thiếu tên dịch vụ' }, { status: 400 })

  // Chỉ được có DUY NHẤT 1 mẫu định kỳ — nhiều mẫu định kỳ sẽ khiến checklist tháng của khách
  // thời kỳ không xác định được lấy theo mẫu nào.
  if (is_recurring) {
    const { data: existed } = await supabase.from('hcns_service_templates')
      .select('id, name').eq('is_recurring', true).eq('is_active', true).maybeSingle()
    if (existed) {
      return Response.json({ error: 'Đã có mẫu định kỳ "' + existed.name + '" — chỉ được phép có một mẫu định kỳ' }, { status: 400 })
    }
  }

  const { data, error } = await supabase.from('hcns_service_templates')
    .insert({ name, is_recurring: is_recurring === true, is_active: true }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// PATCH — đổi tên mẫu / đổi tên công việc / đổi thứ tự.
export async function PATCH(request) {
  const auth = await callerHasPermission('manage_hcns_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { templateId, taskId, name, sort_order } = await request.json()
  const supabase = getAdmin()

  if (taskId) {
    const patch = {}
    if (name !== undefined) patch.name = name
    if (sort_order !== undefined) patch.sort_order = Number(sort_order)
    const { error } = await supabase.from('hcns_service_template_tasks').update(patch).eq('id', taskId)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  }

  if (!templateId) return Response.json({ error: 'Thiếu templateId hoặc taskId' }, { status: 400 })
  const patch = {}
  if (name !== undefined) patch.name = name
  if (sort_order !== undefined) patch.sort_order = Number(sort_order)
  const { error } = await supabase.from('hcns_service_templates').update(patch).eq('id', templateId)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}

// DELETE — ẩn (soft-delete) mẫu hoặc công việc. KHÔNG xoá cứng: các hồ sơ đã tích công việc
// tham chiếu tới đây, xoá cứng sẽ vỡ khoá ngoại và mất lịch sử đã làm.
export async function DELETE(request) {
  const auth = await callerHasPermission('manage_hcns_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const templateId = searchParams.get('templateId')
  const taskId = searchParams.get('taskId')
  const supabase = getAdmin()

  if (taskId) {
    const { error } = await supabase.from('hcns_service_template_tasks').update({ is_active: false }).eq('id', taskId)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  }
  if (!templateId) return Response.json({ error: 'Thiếu templateId hoặc taskId' }, { status: 400 })

  // Mẫu định kỳ là xương sống của checklist khách thời kỳ — không cho ẩn, chỉ cho sửa nội dung.
  const { data: tpl } = await supabase.from('hcns_service_templates')
    .select('is_recurring').eq('id', templateId).maybeSingle()
  if (tpl?.is_recurring) {
    return Response.json({ error: 'Không thể xoá mẫu định kỳ — chỉ sửa được danh sách công việc bên trong' }, { status: 400 })
  }

  const { error } = await supabase.from('hcns_service_templates').update({ is_active: false }).eq('id', templateId)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
