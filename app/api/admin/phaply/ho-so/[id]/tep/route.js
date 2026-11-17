// Phân hệ Pháp lý — tệp scan của hồ sơ (bản đã ký, biên nhận nộp, GCN, BBBG…) tải THẲNG lên Drive phòng pháp lý, đúng thư mục bước.
//   POST multipart { file, thu_muc } (≤ 4 MB — giới hạn Vercel; tệp lớn hơn thì kéo thả thẳng vào thư mục Drive của hồ sơ)
//   DELETE ?id= → bỏ tệp vào thùng rác Drive (khôi phục được 30 ngày) + xoá chỉ mục
// Tệp cùng tên trong cùng thư mục: GHI ĐÈ (uploadFile) — chỉ mục cũ được thay bằng dòng mới.
import { requirePhapLy, xemDuoc, suaDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { uploadFile, trashFile } from '@/lib/googleDrive'
import { coDrive, THU_MUC } from '@/lib/phaply/drive'
import { thuMucHoSo } from '@/lib/phaply/driveMayChu'
import { tenFile } from '@/lib/phaply/xuatBo'

export const maxDuration = 60
const TOI_DA = 4 * 1024 * 1024
const CHO_PHEP = /^(application\/pdf|image\/(jpeg|png|webp)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/msword|application\/zip)$/

async function moHoSo(auth, id) {
  const { data: hs } = await auth.admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  return hs && !hs.is_deleted && xemDuoc(auth, hs) ? hs : null
}

export async function POST(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  if (!suaDuoc(auth, hs)) return loi(403, 'Không có quyền sửa hồ sơ này')
  if (!coDrive(hs.procedure_code)) return loi(400, 'Chưa cấu hình thư mục Drive cho thủ tục này (bản demo không lưu Drive)')
  const form = await request.formData().catch(() => null)
  const f = form?.get('file'), thuMuc = form?.get('thu_muc')
  if (!f || typeof f === 'string' || !f.size) return loi(400, 'Chưa chọn tệp')
  if (!THU_MUC[thuMuc]) return loi(400, 'Chọn thư mục lưu')
  if (f.size > TOI_DA) return loi(400, 'Tệp quá 4 MB — kéo thả thẳng vào thư mục Drive của hồ sơ')
  if (!CHO_PHEP.test(f.type)) return loi(400, 'Chỉ nhận PDF, ảnh, Word, Excel, ZIP')
  try {
    const { con } = await thuMucHoSo(admin, hs)
    const ten = tenFile(f.name || 'tep')
    const up = await uploadFile(con[thuMuc], ten, f.type, Buffer.from(await f.arrayBuffer()))
    await admin.from('legal_case_files').delete().eq('case_id', id).eq('drive_file_id', up.id)   // ghi đè cùng tên → bỏ chỉ mục cũ
    const { error } = await admin.from('legal_case_files').insert({ case_id: id, thu_muc: thuMuc, ten, mime: f.type, kich_thuoc: f.size,
      drive_file_id: up.id, drive_url: up.webViewLink || null, uploaded_by: caller.staffId })
    if (error) throw new Error(error.message)
    await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, `Tải tệp lên Drive: ${THU_MUC[thuMuc]}/${ten}`)
    return Response.json({ ok: true, url: up.webViewLink })
  } catch (e) { return loi(500, e.message) }
}

export async function DELETE(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  if (!suaDuoc(auth, hs)) return loi(403, 'Không có quyền sửa hồ sơ này')
  const fid = new URL(request.url).searchParams.get('id')
  const { data: f } = await admin.from('legal_case_files').select('*').eq('id', fid).eq('case_id', id).maybeSingle()
  if (!f) return loi(404, 'Không thấy tệp')
  try { await trashFile(f.drive_file_id) } catch (e) { if (!/404|not found/i.test(e.message)) return loi(500, e.message) }
  await admin.from('legal_case_files').delete().eq('id', f.id)
  await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, `Bỏ tệp vào thùng rác Drive: ${THU_MUC[f.thu_muc] || f.thu_muc}/${f.ten}`)
  return Response.json({ ok: true })
}
