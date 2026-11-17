// Phân hệ Pháp lý — ghi chú hồ sơ (ai thấy hồ sơ cũng ghi được; xoá: người viết hoặc trưởng phòng).
import { requirePhapLy, xemDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO } from '@/lib/phaply/hoSoMayChu'

export async function POST(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const { data: hs } = await admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (!hs || !xemDuoc(auth, hs)) return loi(404, 'Không tìm thấy hồ sơ')
  const b = await request.json().catch(() => ({}))
  if (b.xoa) {
    const { data: g } = await admin.from('legal_case_notes').select('id, created_by').eq('id', b.xoa).eq('case_id', id).maybeSingle()
    if (!g) return loi(404, 'Không thấy ghi chú')
    if (g.created_by !== caller.staffId && !auth.q.ca_phong) return loi(403, 'Chỉ người viết hoặc trưởng phòng xoá được')
    await admin.from('legal_case_notes').delete().eq('id', g.id)
    return Response.json({ ok: true })
  }
  const body = String(b.body || '').trim()
  if (!body) return loi(400, 'Nhập nội dung ghi chú')
  const { error } = await admin.from('legal_case_notes').insert({ case_id: id, body: body.slice(0, 4000), created_by: caller.staffId })
  return error ? loi(500, error.message) : Response.json({ ok: true })
}
