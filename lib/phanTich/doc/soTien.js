// Đọc sổ tiền (sổ quỹ TK 111, sổ tiền gửi TK 112) và số tiền trên sao kê ngân hàng — cho màn Soát kỳ (kế hoạch mục 3c).
// Hàm thuần, nhận mảng sheet của excel.js docExcel: [{ ten, hang: [[ô…]] }].
//
// Mẫu thật đã soát (27/10/2026, chỉ xem cấu trúc cột):
//   • MISA "SỔ TIỀN GỬI NGÂN HÀNG": dòng "Tài khoản: 1121, …", tiêu đề Ngày hạch toán | Ngày chứng từ | Số chứng từ |
//     Diễn giải | TK đối ứng | Thu | Chi | Tồn; dòng "Số dư đầu kỳ".
//   • MISA "SỔ KẾ TOÁN CHI TIẾT QUỸ TIỀN MẶT": tiêu đề 2 tầng … | Tài khoản | TK đối ứng | Số phát sinh (Nợ | Có) | Số tồn;
//     số phiếu thu / phiếu chi ở 2 cột riêng.
//   • Sổ chi tiết kiểu cũ (font TCVN3): MỖI TÀI KHOẢN MỘT SHEET tên là số tài khoản (1111, 112, 1122, 131…), tiêu đề
//     Ngay_ct | Ma_ct | So_ct | Dien_giai | Ps_no | Ps_co | Tk_du.
//   • Sao kê Vietinbank eFAST: Ngày hạch toán | Mô tả | Nợ/Debit | Có/Credit | Số dư; sao kê kiểu "Số tiền rút | Số tiền
//     gửi | Số dư hiện tại" ghi số tiền dạng CHỮ "29.039.880".

const C = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '')

// Số tiền: số, hoặc chữ "1.090.575.000" / "1,090,575,000" / "(500.000)" / "-500000"
export function soTienO(o) {
  if (o == null || o === '') return null
  if (typeof o === 'number') return Number.isFinite(o) ? o : null
  let s = String(o).trim()
  if (!s) return null
  const am = /^\(.*\)$/.test(s) || /^-/.test(s)
  s = s.replace(/[()\s-]/g, '').replace(/(VND|VNĐ|đ)$/i, '')
  if (!/^\d[\d.,]*$/.test(s)) return null
  // Có cả , và . → cái đứng sau là dấu thập phân; chỉ một loại lặp nhiều lần hoặc nhóm 3 số → phân cách nghìn
  let n
  if (s.includes(',') && s.includes('.')) n = s.lastIndexOf(',') > s.lastIndexOf('.') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''))
  else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = Number(s.replace(/[.,]/g, ''))
  else n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? (am ? -n : n) : null
}

const NGAY = /(?:^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](20\d\d)(?:\D|$)/
const NGAY_ISO = /(?:^|\D)(20\d\d)-(\d{2})-(\d{2})(?:\D|$)/
export function ngayO(o) {
  if (o == null || o === '') return null
  if (typeof o === 'number' && o > 30000 && o < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(o + 1e-6) * 864e5)
    return d.toISOString().slice(0, 10)
  }
  const s = String(o)
  let m = s.match(NGAY_ISO)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(NGAY)
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Ghép tiêu đề 1–2 tầng: tầng dưới chỉ có "Nợ | Có" (hoặc trống) thì nối với tầng trên ("Số phát sinh|Nợ")
function tieuDe(hang, i) {
  const tren = (hang[i] || []).map(o => C(o)), duoi = (hang[i + 1] || []).map(o => C(o))
  const duoiLaPhu = duoi.some(Boolean) && duoi.every(x => !x || /^(NO|CO|DEBIT|CREDIT|THU|CHI)$/.test(x))
  if (!duoiLaPhu) return { cot: tren, soTang: 1 }
  let cha = ''
  return { cot: tren.map((t, k) => { if (t) cha = t; return duoi[k] ? `${cha}|${duoi[k]}` : t }), soTang: 2 }
}
const tim = (cot, ...mau) => { for (const re of mau) { const k = cot.findIndex(x => x && re.test(x)); if (k >= 0) return k } return -1 }

// ── Sổ quỹ / sổ tiền gửi / sổ chi tiết tài khoản ─────────────────────────────────

// Một sheet sổ → { tk, dong: [{ tk, ngay, soCt, dienGiai, tkDu, no, co }] } | null nếu không phải sổ tiền.
// tkMacDinh: số tài khoản suy từ tên sheet / dòng "Tài khoản: 1121".
export function docSheetSo(sheet) {
  const hang = sheet.hang || []
  let tk = /^\d{3,}$/.test(String(sheet.ten || '').trim()) ? String(sheet.ten).trim() : null
  const loaiSo = hang.slice(0, 12).map(r => C((r || []).join(' '))).join(' ')
  for (let i = 0; i < Math.min(hang.length, 40); i++) {
    const { cot, soTang } = tieuDe(hang, i)
    const iNgay = tim(cot, /^NGAYHACHTOAN/, /^NGAYCT$/, /^NGAYCHUNGTU/, /^NGAYGHISO/, /^NGAY$/)
    if (iNgay < 0) continue
    const iNo = tim(cot, /\|NO$/, /^PSNO$/, /^PHATSINHNO$/, /^THU$/, /^NO$/)
    const iCo = tim(cot, /\|CO$/, /^PSCO$/, /^PHATSINHCO$/, /^CHI$/, /^CO$/)
    if (iNo < 0 || iCo < 0) continue
    const iSoCt = tim(cot, /^SOCHUNGTU/, /^SOCT$/, /^SOPHIEUCHI/, /^SOPHIEUTHU/, /^SOHIEU/)
    const iSoCt2 = tim(cot, /^SOPHIEUTHU/)
    const iDg = tim(cot, /^DIENGIAI/, /^NOIDUNG/)
    const iTkDu = tim(cot, /^TKDOIUNG/, /^TKDU$/, /^TAIKHOANDOIUNG/)
    const iTk = tim(cot, /^TAIKHOAN$/, /^TK$/)
    // Tài khoản ghi trên đầu sổ ("Tài khoản: 1121, Loại tiền…"), không thì theo loại sổ
    for (const r of hang.slice(0, i)) { const m = (r || []).map(o => String(o ?? '')).join(' ').match(/T[àa]i kho[ảa]n\s*:?\s*(\d{3,})/i); if (m) tk = m[1] }
    if (!tk) tk = /QUYTIENMAT|SOQUY/.test(loaiSo) ? '111' : /TIENGUINGANHANG|SOTIENGUI/.test(loaiSo) ? '112' : null
    const dong = []
    for (const r of hang.slice(i + soTang)) {
      if (!r) continue
      const ngay = ngayO(r[iNgay]) || (iNgay + 1 < r.length ? ngayO(r[iNgay + 1]) : null)
      const no = soTienO(r[iNo]), co = soTienO(r[iCo])
      const dg = iDg >= 0 ? String(r[iDg] ?? '').trim() : ''
      if (!ngay || (!no && !co)) continue
      if (/S[ốoỐO] D[ưuƯU]|CỘNG|TỔNG|CONG PHAT SINH/i.test(dg) && dg.length < 40) continue
      const soCt = [iSoCt, iSoCt2].filter(k => k >= 0).map(k => String(r[k] ?? '').trim()).find(Boolean) || ''
      dong.push({ tk: iTk >= 0 && /^\d{3,}/.test(String(r[iTk] ?? '')) ? String(r[iTk]).trim() : tk, ngay, soCt, dienGiai: dg, tkDu: iTkDu >= 0 ? String(r[iTkDu] ?? '').trim() : '', no: no || 0, co: co || 0 })
    }
    return dong.length || tk ? { tk, dong } : null
  }
  return null
}

// Nhiều sheet → các dòng của TK 111* / 112*; mọi tài khoản khác bỏ qua (sổ chi tiết kiểu cũ có cả 131, 133…).
// Sổ kiểu cũ có sheet TỔNG ("112") lẫn sheet tài khoản con ("1122" ngoại tệ): dòng của tài khoản con nằm ở CẢ HAI
// (soát thật 27/10/2026) → bỏ khỏi sheet tổng các dòng đã có ở tài khoản con; phần còn lại giữ tên tài khoản tổng.
export function docSoTien(sheets) {
  const theoTk = new Map()
  for (const s of sheets || []) {
    const r = docSheetSo(s)
    if (r) for (const d of r.dong) if (/^11[12]/.test(d.tk || '')) { if (!theoTk.has(d.tk)) theoTk.set(d.tk, []); theoTk.get(d.tk).push(d) }
  }
  const khoa = d => [d.ngay, d.soCt, d.no, d.co].join('|')
  const dong = []
  for (const [tk, ds] of theoTk) {
    const con = [...theoTk.keys()].filter(t => t !== tk && t.startsWith(tk))
    if (!con.length) { dong.push(...ds); continue }
    const daCo = new Map()
    for (const t of con) for (const d of theoTk.get(t)) daCo.set(khoa(d), (daCo.get(khoa(d)) || 0) + 1)
    for (const d of ds) { const n = daCo.get(khoa(d)); if (n) daCo.set(khoa(d), n - 1); else dong.push(d) }
  }
  return dong
}
// Tài khoản ngoại tệ (1112, 1122…): số trên sổ là VND quy đổi, không so được với sao kê ngoại tệ
export const laTkNgoaiTe = tk => /^11[12][2-9]/.test(String(tk || ''))

// ── Sao kê: số tiền từng giao dịch ──────────────────────────────────────────────

// Một sheet sao kê → { giaoDich: [{ ngay, vao, ra, moTa, khoa }], tienTe } | null
export function docSaoKeTienSheet(sheet) {
  const hang = sheet.hang || []
  let tienTe = 'VND'
  for (let i = 0; i < Math.min(hang.length, 60); i++) {
    const r0 = (hang[i] || []).map(o => String(o ?? ''))
    const tt = r0.join(' ').match(/(?:Lo[ạa]i ti[ềe]n|Currency)[^A-Z]*\b(VND|USD|EUR|JPY|CNY)\b/i)
    if (tt) tienTe = tt[1].toUpperCase()
    const cot = r0.map(C)
    const iRa = tim(cot, /^NO(DEBIT)?$/, /DEBIT/, /SOTIENRUT/, /GHINO/, /^RUT/, /TIENRA/)
    const iVao = tim(cot, /^CO(CREDIT)?$/, /CREDIT/, /SOTIENGUI/, /GHICO/, /^GUI/, /TIENVAO/)
    const iNgay = tim(cot, /^NGAYHACHTOAN/, /^NGAYGIAODICH/, /ACCOUNTINGDATE/, /TRANSACTIONDATE/, /^NGAY/)
    if (iRa < 0 || iVao < 0 || iNgay < 0 || iRa === iVao) continue
    const iMoTa = tim(cot, /^MOTA/, /^NOIDUNG/, /DESCRIPTION/, /^DIENGIAI/)
    const giaoDich = []
    for (const r of hang.slice(i + 1)) {
      if (!r) continue
      // ô ngày có thể lệch 1 cột do gộp ô ("Ngày giao dịch |  | …")
      const ngay = ngayO(r[iNgay]) || ngayO(r[iNgay + 1])
      if (!ngay) continue
      // Số tiền lấy ĐÚNG cột tiêu đề — không lấy ô bên cạnh: cột kế bên thường là cột kia (Nợ ↔ Có) hoặc số dư
      const ra = soTienO(r[iRa]) || 0, vao = soTienO(r[iVao]) || 0
      if (!ra && !vao) continue
      const moTa = iMoTa >= 0 ? String(r[iMoTa] ?? r[iMoTa + 1] ?? '').trim() : ''
      giaoDich.push({ ngay, vao: Math.abs(vao), ra: Math.abs(ra), moTa, khoa: r.map(o => String(o ?? '').trim()).join('|') })
    }
    return giaoDich.length ? { giaoDich, tienTe } : null
  }
  return null
}
export function docSaoKeTien(sheets) {
  const ra = []
  for (const s of sheets || []) { const r = docSaoKeTienSheet(s); if (r) for (const g of r.giaoDich) ra.push({ ...g, tienTe: r.tienTe }) }
  return ra
}

// ── Đối chiếu ──────────────────────────────────────────────────────────────────

const trongKhoang = (ngay, tu, den) => ngay >= tu && ngay <= den
const cachNgay = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5)

// Ghép từng giao dịch sao kê với dòng sổ 112 cùng chiều, cùng số tiền (±1 đ), lệch ngày ≤ soNgay — tham lam theo ngày gần nhất.
// Truyền CẢ NĂM (không lọc kỳ trước): giao dịch cuối kỳ hay ghi sổ / báo nợ lệch sang kỳ sau (lãi tiền gửi ghi sổ 31/12,
// sao kê ghi 01/01) vẫn ghép được. Tổng và danh sách chưa ghép chỉ tính trong [tu, den].
// Trả { tongSaoKe: {vao, ra}, tongSo: {no, co}, soSaoKe, soSo, chiSaoKe: [], chiSo: [], lechKy: [{ saoKe, so }] }
export function doiChieuNganHang(saoKe, so, tu, den, { soNgay = 5 } = {}) {
  const skKy = locKy(saoKe, tu, den), soKy = locKy(so, tu, den)
  const tongSaoKe = { vao: skKy.reduce((s, g) => s + g.vao, 0), ra: skKy.reduce((s, g) => s + g.ra, 0) }
  const tongSo = { no: soKy.reduce((s, d) => s + d.no, 0), co: soKy.reduce((s, d) => s + d.co, 0) }
  const daDung = new Set(), daGhepSk = new Set()
  // Ghép theo cặp gần nhất toàn cục: duyệt các cặp ứng viên tăng dần theo số ngày lệch
  const capUngVien = []
  saoKe.forEach((g, i) => {
    const tien = g.vao || g.ra, chieu = g.vao ? 'no' : 'co'
    so.forEach((d, k) => { const c = cachNgay(d.ngay, g.ngay); if (Math.abs(d[chieu] - tien) <= 1 && c <= soNgay) capUngVien.push([c, i, k]) })
  })
  capUngVien.sort((a, b) => a[0] - b[0])
  const lechKy = []   // cặp đã ghép nhưng một bên trong kỳ, một bên ngoài kỳ (ghi sổ / báo nợ có lệch ngày qua ranh giới kỳ)
  for (const [, i, k] of capUngVien) if (!daGhepSk.has(i) && !daDung.has(k)) {
    daGhepSk.add(i); daDung.add(k)
    if (trongKhoang(saoKe[i].ngay, tu, den) !== trongKhoang(so[k].ngay, tu, den)) lechKy.push({ saoKe: saoKe[i], so: so[k] })
  }
  const chiSaoKe = saoKe.filter((g, i) => !daGhepSk.has(i) && trongKhoang(g.ngay, tu, den))
  const chiSo = so.filter((d, k) => !daDung.has(k) && trongKhoang(d.ngay, tu, den))
  return { tongSaoKe, tongSo, soSaoKe: skKy.length, soSo: soKy.length, chiSaoKe, chiSo, lechKy }
}

// Ngưỡng thanh toán không dùng tiền mặt: 5 triệu từ 01/07/2025 (Luật Thuế GTGT 48/2024), trước đó 20 triệu.
export const nguongTienMat = ngay => (ngay >= '2025-07-01' ? 5000000 : 20000000)

// Phiếu chi tiền mặt (Có 111) từ ngưỡng trở lên trả cho người bán hoặc mua thẳng hàng hóa, tài sản, chi phí (đối ứng 331, 15x,
// 21x, 241, 242, 6xx, 811, 133). Không tính nộp tiền vào ngân hàng, tạm ứng, lương, thuế, trả lại tiền khách (131)…
const TK_MUA = /^(331|15[1-8]|21[1-7]|241|242|6[0-4]\d|811|133)/
export function chiTienMatTuNguong(so, tu, den) {
  return so.filter(d => /^111/.test(d.tk) && d.co > 0 && trongKhoang(d.ngay, tu, den) && d.co >= nguongTienMat(d.ngay) && TK_MUA.test(d.tkDu || ''))
}
export const locKy = (ds, tu, den) => ds.filter(x => trongKhoang(x.ngay, tu, den))
