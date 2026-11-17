// Phân hệ Pháp lý — xuất bộ hồ sơ Word từ dữ liệu pháp nhân đã nhập: ?dot=so|thue (cả bộ, file .zip) [&ma=MÃ_MẪU (một file .docx)].
// Mẫu đã dựng sẵn ở templates/phaply/word (scripts/phaply-dung-mau-word.mjs) — next.config.mjs phải kèm thư mục này cho route.
// Ô thiếu dữ liệu in "…………" (không chặn): "Còn thiếu gì" ở tab Doanh nghiệp báo trước cho nhân viên.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import PizZip from 'pizzip'
import { requirePhapLy, xemDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { dauVaoCuaHoSo } from '@/lib/phaply/phapNhanMayChu'
import { chuanBiDuLieu } from '@/lib/phaply/word/duLieu'
import { dienMau } from '@/lib/phaply/word/xuat'
import { mauCuaBo } from '@/lib/phaply/word/danhMuc'
import { nguonHuongDanInKy } from '@/lib/phaply/word/huongDanInKy'
import { dongGoi } from '@/lib/phaply/word/khung'

const TEN_DOT = { so: 'Ho so thanh lap', thue: 'Ho so phap ly ban dau' }
const tenFile = s => s.replace(/[\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
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
  if (!['so', 'thue'].includes(dot)) return loi(400, 'Chọn bộ hồ sơ (dot=so | thue)')
  if (!['1tv', '2tv', 'cp'].includes(hs.entity_type)) return loi(400, 'Mẫu Word hiện chỉ có cho công ty TNHH 1TV, 2TV và cổ phần')
  const bo = mauCuaBo(dot, hs.entity_type).filter(m => !ma || m.ma === ma)
  if (!bo.length) return loi(404, 'Không có mẫu này cho loại hình của hồ sơ')
  try {
    const { dauVao } = await dauVaoCuaHoSo(auth.admin, hs)
    const duLieu = chuanBiDuLieu(dauVao)
    const thuMuc = join(process.cwd(), 'templates', 'phaply', 'word')
    const files = bo.map(m => ({
      ten: tenFile(`${String(m.thuTu).padStart(2, '0')}. ${m.ten}.docx`),
      buf: dienMau(readFileSync(join(thuMuc, m.ma + '.docx')), duLieu),
    }))
    await ghiNhatKy(auth.admin, id, 'edit', null, null, auth.caller.staffId, `Xuất Word: ${ma || 'cả bộ'} (${dot === 'so' ? 'hồ sơ thành lập' : 'hồ sơ pháp lý ban đầu'})`)
    const goc = tenFile(`${hs.code} ${dauVao.cty.ten || hs.title || ''}`)
    if (ma) return taiVe(files[0].buf, `${goc} - ${files[0].ten}`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const zip = new PizZip()
    for (const f of files) zip.file(f.ten, f.buf)
    zip.file('00. Huong dan in ky.docx', dongGoi(nguonHuongDanInKy(dot, hs.entity_type, { tenCty: dauVao.cty.ten })))
    return taiVe(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), `${goc} - ${TEN_DOT[dot]}.zip`, 'application/zip')
  } catch (e) { return loi(500, 'Không dựng được file Word: ' + e.message) }
}
