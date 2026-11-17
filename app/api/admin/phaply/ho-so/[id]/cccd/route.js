// Phân hệ Pháp lý — ảnh CCCD của một hồ sơ (kế hoạch mục 6).
//   POST (multipart: truoc, sau — ảnh đã thu nhỏ ở trình duyệt) → lưu bucket PRIVATE phaply-cccd/<case_id>/… → đọc bằng Claude (nếu
//        có khoá) → trả { duong_dan, nguoi (đã chuẩn hoá), canh_bao, loi_doc }. Lưu ảnh TRƯỚC, đọc SAU: đọc lỗi không mất ảnh.
//   GET ?path= → link ký 5 phút để xem ảnh gốc — cần view_phaply_cccd_image + xem được hồ sơ.
// ⛔ Bản demo (NEXT_PUBLIC_DEMO_MODE=1) KHÔNG nhận ảnh: tài khoản demo dùng chung mật khẩu gửi cả khách — ảnh CCCD thật lên đó là lộ.
import { randomUUID } from 'node:crypto'
import { requirePhapLy, xemDuoc, suaDuoc, loi, docHet } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { veNguoi, kiemCheo } from '@/lib/phaply/cccd'
import { coKhoaDoc, docAnhCccd } from '@/lib/phaply/cccdDoc'

const BUCKET = 'phaply-cccd'
const LA_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === '1'
const KIEU = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const TOI_DA = 4 * 1024 * 1024
export const maxDuration = 60

async function moHoSo(auth, id) {
  const { data: hs } = await auth.admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  return hs && !hs.is_deleted && xemDuoc(auth, hs) ? hs : null
}

async function damBaoBucket(admin) {
  const { error } = await admin.storage.getBucket(BUCKET)
  if (!error) return
  const { error: e2 } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: TOI_DA, allowedMimeTypes: Object.keys(KIEU) })
  if (e2 && !/exist/i.test(e2.message)) throw new Error('Không tạo được kho ảnh CCCD: ' + e2.message)
}

export async function POST(request, { params }) {
  if (LA_DEMO) return loi(403, 'Bản demo không nhận ảnh CCCD (tài khoản demo dùng chung) — thử chức năng này trên app thật')
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  if (!suaDuoc(auth, hs)) return loi(403, 'Không có quyền sửa hồ sơ này')
  const form = await request.formData().catch(() => null)
  if (!form) return loi(400, 'Không đọc được ảnh gửi lên')
  const anh = []
  for (const mat of ['truoc', 'sau']) {
    const f = form.get(mat)
    if (!f || typeof f === 'string' || !f.size) continue
    if (!KIEU[f.type]) return loi(400, 'Ảnh phải là JPG, PNG hoặc WEBP')
    if (f.size > TOI_DA) return loi(400, 'Ảnh quá 4 MB')
    anh.push({ mat, mime: f.type, buf: Buffer.from(await f.arrayBuffer()) })
  }
  if (!anh.length) return loi(400, 'Chưa chọn ảnh mặt trước / mặt sau')

  try {
    await damBaoBucket(admin)
    const duongDan = {}
    for (const a of anh) {
      // khoá chỉ chữ ASCII (bẫy client-files: SDK từ chối ký tự tiếng Việt / khoảng trắng)
      const path = `${id}/${randomUUID()}-${a.mat}.${KIEU[a.mime]}`
      const { error } = await admin.storage.from(BUCKET).upload(path, a.buf, { contentType: a.mime, upsert: false })
      if (error) throw new Error('Không lưu được ảnh: ' + error.message)
      duongDan[a.mat] = path
    }
    await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, `Tải ảnh CCCD (${anh.map(a => a.mat === 'truoc' ? 'mặt trước' : 'mặt sau').join(', ')})`)

    if (!coKhoaDoc()) return Response.json({ duong_dan: duongDan, loi_doc: 'Chưa cài khoá đọc CCCD tự động — ảnh đã lưu, nhập tay các ô bên dưới' })
    let doc
    try { doc = await docAnhCccd(anh.map(a => ({ mat: a.mat, mime: a.mime, base64: a.buf.toString('base64') }))) }
    catch (e) { return Response.json({ duong_dan: duongDan, loi_doc: e.message + ' (ảnh đã lưu)' }) }

    // danh mục để tách địa chỉ thường trú về tỉnh + phường/xã mới
    const [tinh, xa] = await Promise.all([
      admin.from('legal_places').select('ma, ten').eq('cap', 'tinh').then(r => r.data || []),
      docHet((a, b) => admin.from('legal_places').select('ma, ten, ma_tinh').eq('cap', 'xa').order('ma').range(a, b)),
    ])
    const { nguoi, diaChiKhop } = veNguoi(doc, { tinh, xa })
    const canhBao = kiemCheo(nguoi, doc)
    if (doc.noi_thuong_tru && !diaChiKhop) canhBao.push({ truong: 'thuong_tru', muc: 'Địa chỉ trên thẻ là địa giới CŨ hoặc không khớp danh mục — chọn lại tỉnh + phường/xã mới' })
    if (doc.ghi_chu) canhBao.push({ truong: '', muc: 'Ghi chú khi đọc: ' + doc.ghi_chu })
    return Response.json({ duong_dan: duongDan, nguoi, canh_bao: canhBao, cccd_doc: { loai_the: doc.loai_the, mrz: doc.mrz, khong_chac: doc.khong_chac, doc_luc: new Date().toISOString() } })
  } catch (e) { return loi(500, e.message) }
}

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  if (!auth.q.cccd) return loi(403, 'Không có quyền xem ảnh CCCD gốc')
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  const path = new URL(request.url).searchParams.get('path') || ''
  if (!path.startsWith(id + '/') || path.includes('..')) return loi(400, 'Đường dẫn ảnh không thuộc hồ sơ này')
  const { data, error } = await auth.admin.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error) return loi(404, 'Không thấy ảnh (có thể đã xoá theo hạn lưu 24 tháng)')
  await ghiNhatKy(auth.admin, id, 'edit', null, null, auth.caller.staffId, 'Xem ảnh CCCD gốc')
  return Response.json({ url: data.signedUrl })
}
