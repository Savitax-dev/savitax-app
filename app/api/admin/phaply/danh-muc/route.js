// Phân hệ Pháp lý — tra danh mục (chỉ đọc): ?loai=tinh | xa&ma_tinh= | nganh&q= | goi_y&ma_tinh=&ma_xa=
import { requirePhapLy, loi, docHet } from '@/lib/phaply/quyen'
import { goiYCoQuan } from '@/lib/phaply/phapNhanMayChu'

const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export async function GET(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin } = auth
  const u = new URL(request.url).searchParams
  const loai = u.get('loai')
  try {
    if (loai === 'tinh') {
      const { data, error } = await admin.from('legal_places').select('ma, ten').eq('cap', 'tinh').order('ten')
      if (error) throw new Error(error.message)
      return Response.json({ ds: data })
    }
    if (loai === 'xa') {
      const maTinh = u.get('ma_tinh')
      if (!maTinh) return loi(400, 'Thiếu tỉnh')
      const ds = await docHet((a, b) => admin.from('legal_places').select('ma, ten').eq('cap', 'xa').eq('ma_tinh', maTinh).order('ten').order('ma').range(a, b))
      return Response.json({ ds })
    }
    if (loai === 'nganh') {
      // danh mục ngành cấp 4 (~490 dòng) — trả hết, giao diện tự lọc theo mã / tên không dấu
      const ds = await docHet((a, b) => admin.from('legal_vsic').select('ma, ten').eq('cap', 4).order('ma').range(a, b))
      const q = boDau(u.get('q'))
      return Response.json({ ds: q ? ds.filter(n => n.ma.startsWith(q) || boDau(n.ten).includes(q)) : ds })
    }
    if (loai === 'goi_y') return Response.json(await goiYCoQuan(admin, u.get('ma_tinh'), u.get('ma_xa')))
    return loi(400, 'Loại danh mục không hợp lệ')
  } catch (e) { return loi(500, e.message) }
}
