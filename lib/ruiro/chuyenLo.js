// Số lỗ còn được chuyển — đọc PL 03-2/TNDN trong XML quyết toán, thay ô bản cũ bắt nhập tay (tiêu chí R20).
//
// PL 03-2 (mẫu TT80, thẻ PLuc_03_2_TNDN, hai bảng Lo_HDSXKD / Lo_CNBDS), mỗi dòng noiDungNamThuN:
//   ct2 năm phát sinh lỗ · ct3 số lỗ phát sinh · ct4 đã chuyển các kỳ trước · ct5 chuyển kỳ này · ct6 còn chuyển sau
//   (ct3 − ct4 − ct5 = ct6; đã soát trên quyết toán thật 27/10/2026).
// Mẫu cũ (thẻ PL03_2A_TNDN / PL03_2B_TNDN): namPSinhLo, soLoPSinh, soLoDaChuyen, soLoKyNay, soLoChuyenSau.
// Lỗ được chuyển tối đa 5 năm liên tục kể từ năm sau năm phát sinh: lỗ năm X dùng được tới năm X+5.

const SO_NAM_CHUYEN = 5
const TEN = { nam: ['ct2', 'namPSinhLo'], phatSinh: ['ct3', 'soLoPSinh'], daChuyen: ['ct4', 'soLoDaChuyen'], kyNay: ['ct5', 'soLoKyNay'], conSau: ['ct6', 'soLoChuyenSau'] }

function so(s) { const v = Number(String(s ?? '').trim().replace(/,/g, '')); return Number.isFinite(v) ? v : 0 }
function the(xml, ten) { const m = xml.match(new RegExp('<(?:[\\w.-]+:)?' + ten + '>([^<]*)<')); return m ? m[1] : null }
function lay(xml, ds) { for (const t of ds) { const v = the(xml, t); if (v != null) return v } return null }

function docBang(khoi, nhom) {
  const dong = []
  for (const m of khoi.matchAll(/<(?:[\w.-]+:)?noiDungNamThu\d+>([\s\S]*?)<\/(?:[\w.-]+:)?noiDungNamThu\d+>/g)) {
    const r = m[1], nam = Number(String(lay(r, TEN.nam) || '').trim())
    const d = { nhom, nam: Number.isInteger(nam) && nam > 1990 ? nam : null, phatSinh: so(lay(r, TEN.phatSinh)), daChuyen: so(lay(r, TEN.daChuyen)), kyNay: so(lay(r, TEN.kyNay)), conSau: so(lay(r, TEN.conSau)) }
    if (d.nam && (d.phatSinh || d.daChuyen || d.kyNay || d.conSau)) dong.push(d)
  }
  return dong
}

// XML 03/TNDN → { co: false } | { co: true, dong: [{nhom:'sxkd'|'bds', nam, phatSinh, daChuyen, kyNay, conSau}] }
export function docPl032(xml) {
  const x = String(xml || ''), dong = []
  let co = false
  for (const m of x.matchAll(/<(?:[\w.-]+:)?PLuc_03_2_TNDN>([\s\S]*?)<\/(?:[\w.-]+:)?PLuc_03_2_TNDN>/g)) {
    co = true
    const sx = m[1].match(/<(?:[\w.-]+:)?Lo_HDSXKD>([\s\S]*?)<\/(?:[\w.-]+:)?Lo_HDSXKD>/)
    const bd = m[1].match(/<(?:[\w.-]+:)?Lo_CNBDS>([\s\S]*?)<\/(?:[\w.-]+:)?Lo_CNBDS>/)
    if (sx || bd) { if (sx) dong.push(...docBang(sx[1], 'sxkd')); if (bd) dong.push(...docBang(bd[1], 'bds')) } else dong.push(...docBang(m[1], 'sxkd'))
  }
  for (const m of x.matchAll(/<(?:[\w.-]+:)?PL03_2([AB]?)_TNDN>([\s\S]*?)<\/(?:[\w.-]+:)?PL03_2[AB]?_TNDN>/g)) { co = true; dong.push(...docBang(m[2], m[1] === 'B' ? 'bds' : 'sxkd')) }
  return co ? { co: true, dong } : { co: false }
}

// Có phụ lục / dấu giao dịch liên kết (Mẫu 01 NĐ 132) trong XML quyết toán không.
export function coGiaoDichLienKet(xml) { return /<(?:[\w.-]+:)?[\w.-]*(GDLK|ND_?132|NĐ_?132|GiaoDichLienKet)[\w.-]*[\s>/]/i.test(String(xml || '')) }

const cong = (ds, f) => ds.reduce((s, d) => s + f(d), 0)
const trongHan = (nam, namLo) => namLo >= nam - SO_NAM_CHUYEN && namLo <= nam - 1

// Số lỗ còn được chuyển VÀO năm `nam` (trước khi trừ phần chuyển trong năm).
//   pl  = docPl032 của quyết toán năm `nam` (bản cuối cùng) — có thể null
//   plTruoc = docPl032 của quyết toán năm `nam − 1` — có thể null
//   c3 = chỉ tiêu C3 (lỗ chuyển trong năm) trên quyết toán năm `nam`
// Ưu tiên tính từ năm trước (nguồn độc lập với tờ quyết toán đang soát): Σ "còn chuyển sau" năm trước còn trong
// hạn 5 năm + lỗ phát sinh của chính năm trước. Không có năm trước thì lấy theo PL 03-2 của chính năm `nam`.
// Trả { giaTri: number|null, nguon, ghiChu: [] }
export function tinhLoConDuocChuyen({ nam, pl, plTruoc, c3 }) {
  const ghiChu = []
  const dongNam = pl?.co ? pl.dong : null
  let tuNamNay = null, tuNamTruoc = null
  if (dongNam) tuNamNay = cong(dongNam.filter(d => trongHan(nam, d.nam)), d => Math.max(d.phatSinh - d.daChuyen, 0))
  if (plTruoc?.co) {
    const conSau = cong(plTruoc.dong.filter(d => trongHan(nam, d.nam)), d => d.conSau)
    const loNamTruoc = dongNam ? cong(dongNam.filter(d => d.nam === nam - 1), d => d.phatSinh) : 0
    tuNamTruoc = conSau + loNamTruoc
    if (!dongNam && c3 > 0) ghiChu.push(`Quyết toán ${nam} chuyển lỗ nhưng không có PL 03-2 — chưa cộng được lỗ phát sinh năm ${nam - 1} (nếu có)`)
  }
  if (dongNam) {
    const kyNay = cong(dongNam, d => d.kyNay)
    if (c3 != null && Math.abs(kyNay - c3) > 1000) ghiChu.push(`Tổng "chuyển kỳ này" trên PL 03-2 (${kyNay.toLocaleString('vi-VN')}) khác chỉ tiêu C3 (${Number(c3).toLocaleString('vi-VN')})`)
    const sai = dongNam.filter(d => Math.abs(d.phatSinh - d.daChuyen - d.kyNay - d.conSau) > 1000)
    if (sai.length) ghiChu.push(`PL 03-2 năm ${nam}: dòng lỗ năm ${sai.map(d => d.nam).join(', ')} không khớp (3) − (4) − (5) = (6)`)
    const quaHan = dongNam.filter(d => d.kyNay > 0 && d.nam < nam - SO_NAM_CHUYEN)
    if (quaHan.length) ghiChu.push(`Chuyển lỗ của năm ${quaHan.map(d => d.nam).join(', ')} — đã quá ${SO_NAM_CHUYEN} năm`)
  }
  if (tuNamTruoc != null && tuNamNay != null && Math.abs(tuNamTruoc - tuNamNay) > 1000)
    ghiChu.push(`PL 03-2 năm ${nam} kê lỗ còn chuyển ${tuNamNay.toLocaleString('vi-VN')}, theo quyết toán năm ${nam - 1} là ${tuNamTruoc.toLocaleString('vi-VN')}`)
  if (tuNamTruoc != null) return { giaTri: tuNamTruoc, nguon: `PL 03-2/TNDN năm ${nam - 1} (còn chuyển sau, trong hạn ${SO_NAM_CHUYEN} năm)` + (dongNam ? ` + lỗ năm ${nam - 1}` : ''), ghiChu }
  if (tuNamNay != null) return { giaTri: tuNamNay, nguon: `PL 03-2/TNDN năm ${nam} (lỗ phát sinh − đã chuyển các kỳ trước)`, ghiChu }
  return { giaTri: null, nguon: null, ghiChu }
}
