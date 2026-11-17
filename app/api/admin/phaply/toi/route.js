// Phân hệ Pháp lý — hồ sơ cá nhân pháp lý của CHÍNH người đăng nhập (in vào phần "người được ủy quyền" của Giấy ủy quyền
// nộp Phòng ĐKKD khi người này phụ trách hồ sơ). Mỗi nhân viên chỉ đọc / sửa dòng của mình (legal_people.staff_id).
import { requirePhapLy, loi } from '@/lib/phaply/quyen'
import { locCotNguoi, nguoiCuaNhanVien } from '@/lib/phaply/phapNhanMayChu'

export async function GET() {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const p = await nguoiCuaNhanVien(auth.admin, auth.caller.staffId)
  if (p) return Response.json({ nguoi: p })
  const { data: s } = await auth.admin.from('staff').select('full_name, phone, email').eq('id', auth.caller.staffId).maybeSingle()
  return Response.json({ nguoi: null, goi_y: { ho_ten: s?.full_name || '', dien_thoai: s?.phone || '', email: s?.email || '' } })
}

export async function PUT(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const f = locCotNguoi(await request.json().catch(() => ({})))
  const cu = await nguoiCuaNhanVien(admin, caller.staffId)
  const { error } = cu
    ? await admin.from('legal_people').update({ ...f, updated_at: new Date().toISOString() }).eq('id', cu.id)
    : await admin.from('legal_people').insert({ ...f, staff_id: caller.staffId, created_by: caller.staffId })
  if (error) return loi(500, error.message)
  return Response.json({ ok: true })
}
