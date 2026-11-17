// Phân hệ Pháp lý — checklist của một hồ sơ: tích / bỏ tích, thêm việc riêng, xoá việc riêng.
import { requirePhapLy, suaDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO } from '@/lib/phaply/hoSoMayChu'
import { BUOC_DONG } from '@/lib/phaply/hoSo'

// POST { task_id, done } | { them: { title, stage } } | { xoa: task_id }
export async function POST(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const { data: hs } = await admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (!hs || !suaDuoc(auth, hs)) return loi(403, 'Bạn chỉ cập nhật được hồ sơ mình phụ trách')
  if (hs.stage >= BUOC_DONG) return loi(409, 'Hồ sơ đã đóng')
  const b = await request.json().catch(() => ({}))

  if (b.them) {
    const title = String(b.them.title || '').trim()
    const stage = Number(b.them.stage)
    if (!title || !(stage >= 1 && stage <= BUOC_DONG)) return loi(400, 'Nhập tên việc và bước')
    const { data: cuoi } = await admin.from('legal_case_tasks').select('sort').eq('case_id', id).eq('stage', stage).order('sort', { ascending: false }).limit(1)
    const { error } = await admin.from('legal_case_tasks').insert({ case_id: id, stage, title, sort: (cuoi?.[0]?.sort ?? 0) + 1 })
    return error ? loi(500, error.message) : Response.json({ ok: true })
  }
  if (b.xoa) {
    // Chỉ xoá việc tự thêm (không sinh từ mẫu) — việc theo mẫu là quy trình chung của phòng
    const { data: v } = await admin.from('legal_case_tasks').select('id, template_item_id').eq('id', b.xoa).eq('case_id', id).maybeSingle()
    if (!v) return loi(404, 'Không thấy việc')
    if (v.template_item_id) return loi(409, 'Việc theo checklist mẫu không xoá được — trưởng phòng sửa ở Mẫu & danh mục')
    await admin.from('legal_case_tasks').delete().eq('id', v.id)
    return Response.json({ ok: true })
  }
  const { data: v } = await admin.from('legal_case_tasks').select('id').eq('id', b.task_id).eq('case_id', id).maybeSingle()
  if (!v) return loi(404, 'Không thấy việc')
  const { error } = await admin.from('legal_case_tasks')
    .update(b.done ? { done_at: new Date().toISOString(), done_by: caller.staffId } : { done_at: null, done_by: null }).eq('id', v.id)
  return error ? loi(500, error.message) : Response.json({ ok: true })
}
