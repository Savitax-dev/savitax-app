// Phân hệ Pháp lý — lưu hồ sơ lên Drive phòng pháp lý (anh duyệt 17/11/2026: lưu cả bộ Word lẫn ảnh CCCD).
//   POST { noi_dung?: ['so','thue','cccd'] } → tạo / dùng lại thư mục hồ sơ + 8 thư mục con, ghi đè file cùng tên (không sinh "(1)").
//   Bộ Word → 4. SOẠN HỒ SƠ/<bộ>/ · ảnh CCCD → 2. THU THẬP THÔNG TIN/CCCD/. Trả { url, so_file }.
// Ảnh CCCD trên Drive GIỮ LÂU DÀI (anh dặn 17/11/2026) — cron 24 tháng chỉ xoá bản trong kho của app.
import { requirePhapLy, xemDuoc, suaDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { dungBoWord, LOAI_CO_MAU, tenFile } from '@/lib/phaply/xuatBo'
import { ensureFolder, uploadFile, DOCX_MIME } from '@/lib/googleDrive'
import { coDrive, THU_MUC_BO, THU_MUC_CCCD, linkThuMuc } from '@/lib/phaply/drive'
import { thuMucHoSo } from '@/lib/phaply/driveMayChu'
import { coPdf, doiPdf, gopPdf } from '@/lib/phaply/pdf'
import { VAI_TRO } from '@/lib/phaply/phapNhan'

export const maxDuration = 60
const MIME_ANH = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function POST(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const { data: hs } = await admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (!hs || hs.is_deleted || !xemDuoc(auth, hs)) return loi(404, 'Không tìm thấy hồ sơ')
  if (!suaDuoc(auth, hs)) return loi(403, 'Không có quyền sửa hồ sơ này')
  if (!coDrive(hs.procedure_code)) return loi(400, 'Chưa cấu hình thư mục Drive cho thủ tục này (bản demo không lưu Drive)')
  const b = await request.json().catch(() => ({}))
  const noiDung = new Set(Array.isArray(b.noi_dung) && b.noi_dung.length ? b.noi_dung : ['so', 'thue', 'cccd'])

  try {
    const { folderId, con } = await thuMucHoSo(admin, hs)

    let soFile = 0
    const loiPdf = []
    if (LOAI_CO_MAU.includes(hs.entity_type)) {
      for (const dot of ['so', 'thue'].filter(x => noiDung.has(x))) {
        const { files, huongDan } = await dungBoWord(admin, hs, dot)
        const tm = (await ensureFolder(THU_MUC_BO[dot], con.soan)).id
        for (const f of [huongDan, ...files]) { await uploadFile(tm, f.ten, DOCX_MIME, f.buf); soFile++ }
        if (coPdf()) {
          try {
            const pdfs = await doiPdf(files)
            await uploadFile(tm, '00. Bo trinh ky (gop).pdf', 'application/pdf', await gopPdf(pdfs.map(x => x.buf))); soFile++
            for (const x of pdfs) { await uploadFile(tm, x.ten, 'application/pdf', x.buf); soFile++ }
          } catch (e) { loiPdf.push(e.message) }
        }
      }
      if ((hs.ban_giao_muc || []).length) {
        const { files } = await dungBoWord(admin, hs, 'ban_giao')
        for (const f of files) { await uploadFile(con.ban_giao, f.ten, DOCX_MIME, f.buf); soFile++ }
      }
    }
    if (noiDung.has('cccd') && hs.entity_id) {
      const { data: vt } = await admin.from('legal_entity_people').select('vai_tro, nguoi:legal_people(id, ho_ten, cccd_front_path, cccd_back_path)').eq('entity_id', hs.entity_id)
      const nguoi = new Map()
      for (const v of vt || []) if (v.nguoi && (v.nguoi.cccd_front_path || v.nguoi.cccd_back_path)) {
        if (!nguoi.has(v.nguoi.id)) nguoi.set(v.nguoi.id, { ...v.nguoi, vai: [] })
        nguoi.get(v.nguoi.id).vai.push(VAI_TRO[v.vai_tro].split(' /')[0])
      }
      if (nguoi.size) {
        const tm = (await ensureFolder(THU_MUC_CCCD, con.thu_thap)).id
        for (const p of nguoi.values()) {
          for (const [path, mat] of [[p.cccd_front_path, 'mặt trước'], [p.cccd_back_path, 'mặt sau']]) {
            if (!path) continue
            const { data: blob, error } = await admin.storage.from('phaply-cccd').download(path)
            if (error) continue   // ảnh đã xoá theo hạn lưu → bỏ qua
            const duoi = path.split('.').pop()
            await uploadFile(tm, tenFile(`CCCD - ${p.ho_ten || 'chưa có tên'} - ${mat}.${duoi}`), MIME_ANH[duoi] || 'image/jpeg', Buffer.from(await blob.arrayBuffer()))
            soFile++
          }
        }
      }
    }
    await admin.from('legal_cases').update({ drive_saved_at: new Date().toISOString() }).eq('id', id)
    await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, `Lưu Drive: ${soFile} file (${[...noiDung].join(', ')})`)
    return Response.json({ ok: true, url: linkThuMuc(folderId), so_file: soFile, loi_pdf: loiPdf[0] || null })
  } catch (e) { return loi(500, e.message) }
}
