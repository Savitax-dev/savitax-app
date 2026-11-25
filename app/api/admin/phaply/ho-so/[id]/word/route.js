// Phân hệ Pháp lý — xuất bộ hồ sơ Word từ dữ liệu pháp nhân đã nhập: ?dot=so|thue (cả bộ, file .zip) [&ma=MÃ_MẪU (một file .docx)].
// Dựng bộ ở lib/phaply/xuatBo.js (dùng chung với nút lưu Drive) — next.config.mjs phải kèm templates/phaply/word cho route này.
// Ô thiếu dữ liệu in "…………" (không chặn): "Còn thiếu gì" ở tab Doanh nghiệp báo trước cho nhân viên.
import PizZip from 'pizzip'
import { requirePhapLy, xemDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { dungBoWord, LOAI_CO_MAU, tenFile } from '@/lib/phaply/xuatBo'
import { bienThe, coBo, tenBo } from '@/lib/phaply/boHoSo'

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
  const u = new URL(request.url).searchParams
  const dot = u.get('dot'), ma = u.get('ma')
  const bt = bienThe(hs.procedure_code, hs.entity_type)
  if (!coBo(bt, dot)) return loi(400, 'Thủ tục này không có bộ hồ sơ ' + dot)
  if (!LOAI_CO_MAU.includes(hs.entity_type)) return loi(400, 'Chưa có mẫu cho loại hình này')
  const laHuongDan = ma === 'HUONG_DAN' && dot !== 'ban_giao'   // tờ hướng dẫn in ký riêng (18/11/2026)
  try {
    const { files, huongDan, dauVao } = await dungBoWord(auth.admin, hs, dot, { ma })
    // tải lẻ một tờ: không thuộc bộ / loại hình, hoặc không đúng trường hợp (dieuKien) → 404
    if (ma && !laHuongDan && !files.length) return loi(404, 'Mẫu này không có trong bộ hồ sơ của hồ sơ này')
    await ghiNhatKy(auth.admin, id, 'edit', null, null, auth.caller.staffId, `Xuất Word: ${ma || 'cả bộ'} (${tenBo(bt, dot).toLowerCase()})`)
    const goc = tenFile(`${hs.code} ${dauVao.cty.ten || hs.title || ''}`)
    if (laHuongDan) return taiVe(huongDan.buf, `${goc} - ${huongDan.ten}`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    if (ma) return taiVe(files[0].buf, `${goc} - ${files[0].ten}`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const zip = new PizZip()
    for (const f of files) zip.file(f.ten, f.buf)
    if (huongDan) zip.file(huongDan.ten, huongDan.buf)
    return taiVe(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), `${goc} - ${tenFile(tenBo(bt, dot).split(' — ')[0] + (tenBo(bt, dot).includes(' — ') ? ' - ' + tenBo(bt, dot).split(' — ')[1] : ''))}.zip`, 'application/zip')
  } catch (e) { return loi(500, 'Không dựng được file Word: ' + e.message) }
}
