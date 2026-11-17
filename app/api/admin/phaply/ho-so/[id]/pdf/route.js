// Phân hệ Pháp lý — xuất PDF (GĐ 3): ?dot=so|thue|ban_giao [&ma=MÃ (một file .pdf)]. Cả bộ: .zip gồm từng PDF + "00. Bo trinh ky (gop)
// .pdf" (gộp đúng thứ tự in). Dựng Word bằng lib/phaply/xuatBo.js (giống nút Word) rồi đổi PDF ở VPS (lib/phaply/pdf.js).
// Dịch vụ PDF lỗi / chưa cấu hình → báo rõ, nút Word vẫn dùng được (PDF không chặn quy trình).
import PizZip from 'pizzip'
import { requirePhapLy, xemDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { mauCuaBo } from '@/lib/phaply/word/danhMuc'
import { dungBoWord, LOAI_CO_MAU, tenFile } from '@/lib/phaply/xuatBo'
import { coPdf, doiPdf, gopPdf } from '@/lib/phaply/pdf'

export const maxDuration = 60
const TEN_DOT = { so: 'Ho so thanh lap', thue: 'Ho so phap ly ban dau', ban_giao: 'Ban giao' }
const taiVe = (buf, ten, kieu) => new Response(buf, { headers: {
  'Content-Type': kieu, 'Cache-Control': 'no-store',
  'Content-Disposition': `attachment; filename="${ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(ten)}`,
} })

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { id } = await params
  const { data: hs } = await auth.admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (!hs || hs.is_deleted || !xemDuoc(auth, hs)) return loi(404, 'Không tìm thấy hồ sơ')
  if (!coPdf()) return loi(400, 'Chưa cấu hình dịch vụ PDF — dùng nút Word')
  const u = new URL(request.url).searchParams
  const dot = u.get('dot'), ma = u.get('ma')
  if (!['so', 'thue', 'ban_giao'].includes(dot)) return loi(400, 'Chọn bộ hồ sơ (dot=so | thue | ban_giao)')
  if (!LOAI_CO_MAU.includes(hs.entity_type)) return loi(400, 'Mẫu hiện chỉ có cho công ty TNHH 1TV, 2TV và cổ phần')
  if (!mauCuaBo(dot, hs.entity_type).some(m => !ma || m.ma === ma)) return loi(404, 'Không có mẫu này cho loại hình của hồ sơ')
  try {
    const { files, dauVao } = await dungBoWord(auth.admin, hs, dot, { ma })
    const pdfs = await doiPdf(files)
    await ghiNhatKy(auth.admin, id, 'edit', null, null, auth.caller.staffId, `Xuất PDF: ${ma || 'cả bộ'} (${({ so: 'hồ sơ thành lập', thue: 'hồ sơ pháp lý ban đầu', ban_giao: 'biên bản bàn giao' })[dot]})`)
    const goc = tenFile(`${hs.code} ${dauVao.cty.ten || hs.title || ''}`)
    if (ma) return taiVe(pdfs[0].buf, `${goc} - ${pdfs[0].ten}`, 'application/pdf')
    const zip = new PizZip()
    zip.file('00. Bo trinh ky (gop).pdf', await gopPdf(pdfs.map(p => p.buf)))
    for (const p of pdfs) zip.file(p.ten, p.buf)
    return taiVe(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), `${goc} - ${TEN_DOT[dot]} (PDF).zip`, 'application/zip')
  } catch (e) { return loi(502, e.message) }
}
