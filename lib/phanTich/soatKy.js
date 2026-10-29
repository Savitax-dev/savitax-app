// Soát kỳ tháng / quý — Phân hệ Soát xét báo cáo, GĐ 3a lát 1 (phần thuế GTGT). Kế hoạch mục 3c.
//
// Hàm THUẦN: nhận tờ khai đã đọc (năm nay + năm trước), bảng kê đầy đủ từng hóa đơn của kỳ, hồ sơ công ty → các
// dòng kiểm tra { nhóm, kiểm tra, số 1, số 2, chênh lệch, kết quả } + danh sách hóa đơn gây lệch. Không đọc file,
// không gọi mạng → kiểm bằng node (scripts/test-phantich-soatky.mjs).
//
// Nguyên tắc (anh chốt):
// - CHỈ NÊU SỰ VIỆC: Khớp / Có chênh lệch (kèm số + hóa đơn) / Thiếu hồ sơ (kèm file cần có). Không chấm điểm.
// - Kỳ khai cố định trọn năm; nguồn đúng là KỲ TRÊN TỜ KHAI. Hồ sơ công ty khác → nhắc sửa hồ sơ (có thể tick nhầm),
//   app không tự sửa. Một năm lẫn tháng và quý → bất thường.
// - Bán ra: chỉ cần bảng kê cổng HĐĐT; mua vào: bảng kê cổng + XML (26/10/2026).
// - Bản CHƯA NỘP = tờ khai XML để trong thư mục BẢNG KÊ (xuất HTKK trước khi nộp); bản ĐÃ NỘP = trong TỜ KHAI THUẾ.
import { cacKy, moc } from './kiemKe.js'
import { loaiThuMucKy } from './thuMuc.js'
import { kyHieuDayDu } from './doc/bangKe.js'
import { doiChieuNganHang, chiTienMatTuNguong, laTkNgoaiTe, nguongTienMat } from './doc/soTien.js'

const NGUONG_THANG = 50e9   // doanh thu năm trước trên 50 tỷ → phải khai tháng
const v = x => (x == null ? 0 : x)
const lech = (a, b) => (a == null || b == null ? null : Math.round(a - b))
const khop = d => d != null && Math.abs(d) < 1
const tien = n => (n == null ? '—' : Math.round(n).toLocaleString('vi-VN'))

// ── Tờ khai ──────────────────────────────────────────────────────────────────

// Bản chưa nộp: nằm trong thư mục BẢNG KÊ của kỳ (xuất HTKK để soát trước khi nộp)
export const laBanChuaNop = tk => (tk.tep?.duongDan || []).some(seg => loaiThuMucKy(seg) === 'bang_ke')

const maCua = ky => (ky.loai === 'Q' ? 'Q' + ky.so : 'T' + String(ky.so).padStart(2, '0'))
const hon = (a, b) => (a.lanBoSung !== b.lanBoSung ? a.lanBoSung > b.lanBoSung : String(a.ngayLap) > String(b.ngayLap))

// 01/GTGT của một kỳ → { daNop: bản nộp sau cùng, chuaNop: bản chưa nộp mới nhất }
export function toKhaiCuaKy(toKhai, nam, ma) {
  const ds = toKhai.filter(t => t.loai === '01/GTGT' && t.ky?.nam === nam && maCua(t.ky) === ma)
  const pick = arr => arr.reduce((a, b) => (!a || hon(b, a) ? b : a), null)
  return { daNop: pick(ds.filter(t => !laBanChuaNop(t))), chuaNop: pick(ds.filter(laBanChuaNop)) }
}

// Loại kỳ khai của năm theo tờ khai: { loai: 'T'|'Q'|null, lan: true nếu lẫn cả tháng và quý }
export function kyKhaiNam(toKhai, nam) {
  const loai = new Set(toKhai.filter(t => t.loai === '01/GTGT' && t.ky?.nam === nam && t.ky.loai !== 'N').map(t => t.ky.loai))
  if (!loai.size) return { loai: null, lan: false }
  if (loai.size > 1) {
    // Lẫn: lấy loại có nhiều kỳ hơn làm loại chính để vẫn soát được
    const dem = l => new Set(toKhai.filter(t => t.loai === '01/GTGT' && t.ky?.nam === nam && t.ky.loai === l).map(t => t.ky.so)).size
    return { loai: dem('T') >= dem('Q') ? 'T' : 'Q', lan: true }
  }
  return { loai: [...loai][0], lan: false }
}

// Σ[34] cả năm (bản sau cùng mỗi kỳ, không tính bản chưa nộp) — để xét ngưỡng 50 tỷ
export function doanhThuNam(toKhai, nam) {
  const theoKy = new Map()
  for (const t of toKhai.filter(t => t.loai === '01/GTGT' && t.ky?.nam === nam && t.ky.loai !== 'N' && !laBanChuaNop(t))) {
    const k = maCua(t.ky)
    if (!theoKy.has(k) || hon(t, theoKy.get(k))) theoKy.set(k, t)
  }
  if (!theoKy.size) return null
  return { tong: [...theoKy.values()].reduce((s, t) => s + v(t.chiTieu['34']), 0), soKy: theoKy.size, loai: [...theoKy.values()][0].ky.loai }
}

// ── Dải kỳ ───────────────────────────────────────────────────────────────────

// Trạng thái từng kỳ cho thanh chọn: da_nop | chua_nop (chỉ có bản xuất HTKK) | thieu | cho_han | chua_den
export function daiKy(nam, loaiKy, toKhai, homNay) {
  return cacKy(nam, loaiKy === 'T' ? 'thang' : 'quy').map(k => {
    const { daNop, chuaNop } = toKhaiCuaKy(toKhai, nam, k.ma)
    const m = moc(k, { homNay })
    const tt = daNop ? 'da_nop' : chuaNop ? 'chua_nop' : m === 'chua_toi' ? 'chua_den' : m === 'chua_han' ? 'cho_han' : 'thieu'
    return { ...k, tt, lanBoSung: daNop?.lanBoSung || 0 }
  })
}

// ── Hóa đơn ──────────────────────────────────────────────────────────────────

const mst0 = s => String(s || '').replace(/\D/g, '').replace(/^0+/, '')
const khoaDu = h => { const kh = kyHieuDayDu(h.mauSo, h.kyHieu); return kh ? `${mst0(h.mst)}|${kh}|${h.so}` : null }
const khoaPhu = h => `${mst0(h.mst)}|${h.so}|${h.ngay || ''}`

// Gộp theo HÓA ĐƠN (file thật 127HOME, 26/10/2026):
// - TRONG một sheet: cộng các dòng cùng hóa đơn — bảng kê phần mềm ghi mỗi MẶT HÀNG một dòng (bản chi tiết của cổng
//   cũng vậy);
// - GIỮA các sheet / file: BỎ TRÙNG — cùng hóa đơn có ở file "DANH SÁCH" của quý và file "Tổng quan" của tháng thì
//   chỉ tính một lần (trước khi gộp, Q3 bán ra bị cộng đôi tháng 8: lệch −561 triệu).
export function gopHoaDon(cacSheet) {
  const ra = new Map()
  for (const rows of cacSheet) {
    const trongSheet = new Map()
    for (const h of rows) {
      // Thiếu MST (bảng kê cổng mua vào không có cột MST người bán) → thêm ngày, kẻo 2 người bán trùng ký hiệu + số bị cộng làm một
      const kd = khoaDu(h)
      const k = kd ? (mst0(h.mst) ? kd : `${kd}|${h.ngay || ''}`) : khoaPhu(h)
      const cu = trongSheet.get(k)
      if (!cu) trongSheet.set(k, { ...h, soDong: 1 })
      else {
        cu.tienChuaThue = cu.tienChuaThue == null && h.tienChuaThue == null ? null : v(cu.tienChuaThue) + v(h.tienChuaThue)
        cu.thue = cu.thue == null && h.thue == null ? null : v(cu.thue) + v(h.thue)
        cu.soDong++
      }
    }
    for (const [k, h] of trongSheet) {
      if (ra.has(k)) continue
      // Sheet sau có ký hiệu mà sheet trước không có (hoặc ngược lại): so theo khoá phụ MST + số + ngày — CHỈ khi một trong hai
      // hóa đơn thiếu ký hiệu. Hai hóa đơn đều có ký hiệu (khác nhau) là hai hóa đơn khác (rà soát 27/10/2026).
      const kd = khoaDu(h), phu = khoaPhu(h)
      if ([...ra.values()].some(x => x._phu === phu && (!kd || !x._kd))) continue
      ra.set(k, { ...h, _phu: phu, _kd: kd })
    }
  }
  return [...ra.values()]
}

// Trạng thái trên cổng: hóa đơn không còn hiệu lực thì không tính vào tổng, và phần mềm không được kê
const HET_HIEU_LUC = /BỊ THAY THẾ|BỊ HỦY|ĐÃ HỦY|XÓA BỎ|XOÁ BỎ|BỊ XÓA/i
export const conHieuLuc = h => !HET_HIEU_LUC.test(h.trangThai || '')

const thangCuaKy = k => (k.loai === 'T' ? [k.so] : [3 * k.so - 2, 3 * k.so - 1, 3 * k.so])
const trongKy = (ngay, nam, k) => !!ngay && Number(ngay.slice(0, 4)) === nam && thangCuaKy(k).includes(Number(ngay.slice(5, 7)))

// Bảng kê PHẦN MỀM thuộc kỳ nào: theo thư mục kỳ chứa file; không có thì theo tháng nhiều hóa đơn nhất
function kyCuaSheetPm(b, nam, loaiKy) {
  const k = b.kyThuMuc
  if (k && (k.nam == null || k.nam === nam)) return { loai: k.loai, so: k.so }
  const dem = new Map()
  for (const h of b.hoaDon) if (h.ngay?.startsWith(nam + '-')) { const t = +h.ngay.slice(5, 7); dem.set(t, (dem.get(t) || 0) + 1) }
  const t = [...dem].sort((a, c) => c[1] - a[1])[0]?.[0]
  return t ? (loaiKy === 'T' ? { loai: 'T', so: t } : { loai: 'Q', so: Math.ceil(t / 3) }) : null
}
const kyPhu = (kyFile, k) => !!kyFile && (kyFile.loai === k.loai ? kyFile.so === k.so
  : kyFile.loai === 'Q' ? Math.ceil(k.so / 3) === kyFile.so : false)

// Khoá KHÔNG MST — dùng khi một bên thiếu MST đối tác (DOEL 27/10/2026: bảng kê cổng mua vào không có cột MST người bán;
// phần mềm có khi để trống MST người mua). Bán ra: người bán luôn là chính công ty nên ký hiệu + số là đủ duy nhất.
// Mua vào: nhiều người bán có thể trùng ký hiệu + số → thêm ngày lập.
const khoaKhongMst = (h, chieu) => { const kh = kyHieuDayDu(h.mauSo, h.kyHieu); return kh ? `${kh}|${h.so}${chieu === 'ban_ra' ? '' : '|' + (h.ngay || '')}` : null }

// Đối chiếu từng hóa đơn cổng ↔ phần mềm (một chiều). Cổng: chỉ hóa đơn có ngày trong kỳ.
export function doiChieuHoaDon(cong, pm, nam, k, chieu) {
  const congKy = cong.filter(h => trongKy(h.ngay, nam, k))
  const theoDu = new Map(), theoPhu = new Map(), theoKm = new Map()
  for (const h of congKy) {
    const a = khoaDu(h); if (a) theoDu.set(a, h); theoPhu.set(khoaPhu(h), h)
    const km = khoaKhongMst(h, chieu); if (km) theoKm.set(km, theoKm.has(km) ? null : h)   // trùng khoá → không dám ghép
  }
  const daGhep = new Set(), chiPm = [], lechTien = [], hetHieuLuc = [], ngoaiKy = []
  for (const h of pm) {
    const a = khoaDu(h)
    let c = (a && theoDu.get(a)) || theoPhu.get(khoaPhu(h))
    if (!c) {
      // Chỉ ghép không-MST khi đúng là một bên THIẾU MST — hai bên đều có mà khác nhau thì là hóa đơn khác
      const km = khoaKhongMst(h, chieu), x = km && theoKm.get(km)
      if (x && !daGhep.has(x) && (!mst0(h.mst) || !mst0(x.mst))) c = x
    }
    if (!trongKy(h.ngay, nam, k)) ngoaiKy.push(h)
    if (!c) { chiPm.push({ hd: h, lyDo: !trongKy(h.ngay, nam, k) ? 'Ngày hóa đơn ngoài kỳ (hóa đơn kỳ trước kê khai kỳ này)' : 'Không tìm thấy trên bảng kê cổng' }); continue }
    daGhep.add(c)
    // Phần mềm kê hóa đơn đã bị thay thế / hủy với SỐ TIỀN 0 là kê đúng (file thật 127HOME) — chỉ báo khi còn tiền / thuế
    if (!conHieuLuc(c) && (v(h.tienChuaThue) !== 0 || v(h.thue) !== 0)) hetHieuLuc.push({ hd: h, cong: c })
    if (!conHieuLuc(c)) continue   // hóa đơn đã bị thay thế / hủy: không so tiền (kê số 0 là đúng)
    const dT = lech(h.tienChuaThue, c.tienChuaThue), dTh = lech(h.thue, c.thue)
    if ((dT != null && !khop(dT)) || (dTh != null && !khop(dTh))) lechTien.push({ hd: h, cong: c, lechTien: dT, lechThue: dTh })
  }
  const chiCong = congKy.filter(h => !daGhep.has(h) && conHieuLuc(h))
  return { soCong: congKy.filter(conHieuLuc).length, soPm: pm.length, chiCong, chiPm, lechTien, hetHieuLuc, ngoaiKy }
}

// ── Soát một kỳ ──────────────────────────────────────────────────────────────

// opt: { nam, ma: 'Q3'|'T09', toKhai, toKhaiTruoc, bangKe: [{ mau, chieu, kyThuMuc, sheet, tep, hoaDon }], cty, homNay }
// bangLuong: docBangLuongCuaNam · c12: docC12CuaNam · soSach: { coSoPhu, coSo112, coSoQuy } (có file trong thư mục)
// saoKeTien: docSaoKeCuaNam().tien · soTien: docSoTienCuaNam().dong (sổ quỹ 111 + sổ tiền gửi 112, cả năm)
export function soatKy({ nam, ma, toKhai = [], toKhaiTruoc = [], bangKe = [], bangLuong = [], c12 = [], soSach = {}, saoKeTien = [], soTien = [], cty = {} } = {}) {
  const nk = kyKhaiNam(toKhai, nam)
  const loaiKy = nk.loai || (cty.kyKhai === 'thang' ? 'T' : 'Q')
  const k = cacKy(nam, loaiKy === 'T' ? 'thang' : 'quy').find(x => x.ma === ma)
  if (!k) return { loi: `Kỳ ${ma} không thuộc dải kỳ ${loaiKy === 'T' ? 'tháng' : 'quý'} của năm ${nam}` }
  const { daNop, chuaNop } = toKhaiCuaKy(toKhai, nam, ma)
  const tk = chuaNop || daNop
  const banSoat = chuaNop ? 'chua_nop' : daNop ? 'da_nop' : null
  const dong = []
  const them = d => dong.push({ chenh: null, ghiChu: '', ...d })
  const nhanTk = tk ? `Tờ khai ${ma} (${banSoat === 'chua_nop' ? 'chưa nộp' : tk.lanBoSung ? 'bổ sung lần ' + tk.lanBoSung : 'đã nộp'})` : ''
  const ct = c => (tk ? tk.chiTieu[c] ?? null : null)
  // Kỳ chưa có tờ khai: các phép kiểm cần tờ khai gom về MỘT dòng "Thiếu hồ sơ" (đỡ lặp cả chục dòng cùng một lý do)
  const canTk = []
  const thieuTk = (nhom, ten) => canTk.push(ten)

  // 1. Kỳ khai
  const tenLoai = l => (l === 'T' ? 'Tháng' : 'Quý')
  const loaiHoSo = cty.kyKhai === 'thang' ? 'T' : cty.kyKhai === 'quy' ? 'Q' : null
  if (nk.loai && loaiHoSo) {
    them({ nhom: 'ky_khai', ten: `Loại báo cáo trong hồ sơ công ty ↔ kỳ trên tờ khai ${nam}`, so1: tenLoai(loaiHoSo), nhan1: 'Hồ sơ công ty trên app', so2: tenLoai(nk.loai), nhan2: `Tờ khai ${nam}`,
      kq: loaiHoSo === nk.loai ? 'khop' : 'chenh', ghiChu: loaiHoSo === nk.loai ? '' : 'Kỳ khai cố định cả năm — có thể tick nhầm loại báo cáo, sửa hồ sơ công ty. App soát theo kỳ trên tờ khai.' })
  }
  if (nk.lan) them({ nhom: 'ky_khai', ten: `Tờ khai năm ${nam} cùng một loại kỳ`, so1: 'Lẫn tháng và quý', so2: tenLoai(nk.loai), nhan2: 'đang soát theo', kq: 'chenh', ghiChu: 'Một năm không đổi kỳ giữa chừng — kiểm tra tờ khai nộp nhầm kỳ hoặc file để nhầm năm.' })
  const dtTruoc = doanhThuNam(toKhaiTruoc, nam - 1)
  if (!dtTruoc) them({ nhom: 'ky_khai', ten: `Ngưỡng 50 tỷ: doanh thu ${nam - 1} ↔ kỳ khai ${nam}`, kq: 'thieu', thieuFile: `Tờ khai 01/GTGT các kỳ năm ${nam - 1} (bấm "Thêm dữ liệu năm cũ")` })
  else {
    const phaiThang = dtTruoc.tong > NGUONG_THANG
    them({ nhom: 'ky_khai', ten: `Ngưỡng 50 tỷ: doanh thu ${nam - 1} ↔ kỳ khai ${nam}`, so1: dtTruoc.tong, nhan1: `Σ[34] năm ${nam - 1} (${dtTruoc.soKy} kỳ)`, so2: tenLoai(loaiKy), nhan2: phaiThang ? 'Trên 50 tỷ: phải khai tháng' : 'Từ 50 tỷ trở xuống: được khai quý',
      kq: phaiThang && loaiKy === 'Q' ? 'chenh' : 'khop' })
  }

  // 2. Chuỗi khấu trừ [22] = [43] kỳ trước
  const dsKy = cacKy(nam, loaiKy === 'T' ? 'thang' : 'quy')
  const iKy = dsKy.findIndex(x => x.ma === ma)
  let tkTruoc = null, tenTruoc = ''
  if (iKy > 0) { tkTruoc = toKhaiCuaKy(toKhai, nam, dsKy[iKy - 1].ma).daNop; tenTruoc = `${dsKy[iKy - 1].ma}/${nam}` }
  else {
    // Kỳ đầu năm nối với kỳ cuối năm trước (năm trước có thể khai khác loại kỳ)
    const nkTruoc = kyKhaiNam(toKhaiTruoc, nam - 1)
    const maCuoi = nkTruoc.loai === 'T' ? 'T12' : 'Q4'
    tkTruoc = toKhaiCuaKy(toKhaiTruoc, nam - 1, maCuoi).daNop; tenTruoc = `${maCuoi}/${nam - 1}`
  }
  if (!tk) thieuTk('gtgt', `Chuỗi khấu trừ: [22] ${ma} = [43] ${tenTruoc}`)
  else if (!tkTruoc) them({ nhom: 'gtgt', ten: `Chuỗi khấu trừ: [22] ${ma} = [43] ${tenTruoc}`, so1: ct('22'), nhan1: `[22] ${ma}`, kq: 'thieu', thieuFile: `Tờ khai 01/GTGT ${tenTruoc} (đã nộp)` })
  else {
    const d = lech(ct('22'), tkTruoc.chiTieu['43'])
    them({ nhom: 'gtgt', ten: `Chuỗi khấu trừ: [22] ${ma} = [43] ${tenTruoc}`, so1: ct('22'), nhan1: `[22] ${ma}`, so2: tkTruoc.chiTieu['43'] ?? null, nhan2: `[43] ${tenTruoc}`, chenh: d, kq: khop(d ?? 0) ? 'khop' : 'chenh' })
  }

  // 3. Tờ khai tự khớp công thức
  if (!tk) thieuTk('gtgt', 'Tờ khai tự khớp công thức')
  else {
    const c = x => v(ct(x))
    const X = c('36') - c('22') + c('37') - c('38') - c('39a')
    const congThuc = [
      ['[27] = [29] + [30] + [32] + [32a]', c('27'), c('29') + c('30') + c('32') + c('32a')],
      ['[28] = [31] + [33]', c('28'), c('31') + c('33')],
      ['[34] = [26] + [27]', c('34'), c('26') + c('27')],
      ['[35] = [28]', c('35'), c('28')],
      ['[36] = [35] − [25]', c('36'), c('35') - c('25')],
      [X >= 0 ? '[40a] = [36] − [22] + [37] − [38] − [39a]' : '[41] = −([36] − [22] + [37] − [38] − [39a])', X >= 0 ? c('40a') : c('41'), Math.abs(X)],
      ['[40] = [40a] − [40b]', c('40'), c('40a') - c('40b')],
      ['[43] = [41] − [42]', c('43'), c('41') - c('42')],
    ]
    for (const [ten, a, b] of congThuc) {
      const d = lech(a, b)
      them({ nhom: 'gtgt', ten: `Tờ khai tự khớp: ${ten}`, so1: a, nhan1: ten.split(' = ')[0], so2: b, nhan2: 'tính lại', chenh: d, kq: khop(d) ? 'khop' : 'chenh' })
    }
  }

  // 4–5. Đầu ra / đầu vào: tờ khai ↔ bảng kê cổng ↔ bảng kê phần mềm, rồi từng hóa đơn
  const chiTiet = []
  for (const [chieu, nhom, ctTien, ctThue, ten] of [['ban_ra', 'dau_ra', '34', '35', 'bán ra'], ['mua_vao', 'dau_vao', '23', '24', 'mua vào']]) {
    const sheetCong = bangKe.filter(b => b.mau === 'cong' && b.chieu === chieu)
    const cong = gopHoaDon(sheetCong.map(b => b.hoaDon))
    const congKy = cong.filter(h => trongKy(h.ngay, nam, k) && conHieuLuc(h))
    const sheetPm = bangKe.filter(b => b.mau?.startsWith('pm_') && b.chieu === chieu && kyPhu(kyCuaSheetPm(b, nam, loaiKy), k))
    // Kỳ tháng mà file phần mềm đặt theo quý: chỉ lấy hóa đơn của tháng đó
    const pm = gopHoaDon(sheetPm.map(b => (b.kyThuMuc?.loai === 'Q' && k.loai === 'T') ? b.hoaDon.filter(h => trongKy(h.ngay, nam, k)) : b.hoaDon))
    const sum = (ds, f) => ds.reduce((s, h) => s + v(h[f]), 0)
    const khongPhatSinh = tk && ct(ctTien) === 0 && ct(ctThue) === 0
    const fileCong = `Bảng kê chi tiết ${ten} tải từ cổng HĐĐT (Excel) có hóa đơn ${ma}/${nam}`
    const coCong = sheetCong.some(b => b.hoaDon.some(h => trongKy(h.ngay, nam, k)))
    for (const [c, f, nhanCt] of [[ctTien, 'tienChuaThue', 'giá trị chưa thuế'], [ctThue, 'thue', 'thuế GTGT']]) {
      const tenDong = `[${c}] tờ khai ↔ ${nhanCt} trên bảng kê cổng ${ten}`
      if (!tk) { thieuTk(nhom, tenDong); continue }
      if (!coCong && !khongPhatSinh) { them({ nhom, ten: tenDong, so1: ct(c), nhan1: nhanTk, kq: 'thieu', thieuFile: fileCong }); continue }
      const s2 = sum(congKy, f), d = lech(ct(c), s2)
      them({ nhom, ten: tenDong, so1: ct(c), nhan1: nhanTk, so2: s2, nhan2: `Bảng kê cổng · ${congKy.length} HĐ`, chenh: d, kq: khop(d) ? 'khop' : 'chenh' })
    }
    // Phần mềm ↔ tờ khai: hai dòng riêng (giá trị chưa thuế, thuế) để thấy ngay lệch ở đâu
    for (const [c, f, nhanCt] of [[ctTien, 'tienChuaThue', 'giá trị chưa thuế'], [ctThue, 'thue', 'thuế GTGT']]) {
      const tenPm = `[${c}] tờ khai ↔ ${nhanCt} trên bảng kê phần mềm ${ten}`
      if (!tk) { thieuTk(nhom, tenPm); continue }
      if (!sheetPm.length && !khongPhatSinh) { them({ nhom, ten: tenPm, so1: ct(c), nhan1: nhanTk, kq: 'thieu', thieuFile: `Bảng kê ${ten} xuất từ phần mềm kế toán (Excel) trong BAOCAOTHUE_${ma}\\BẢNG KÊ` }); continue }
      const s2 = sum(pm, f), d = lech(ct(c), s2)
      them({ nhom, ten: tenPm, so1: ct(c), nhan1: nhanTk, so2: s2, nhan2: `Bảng kê phần mềm · ${pm.length} HĐ`, chenh: d, kq: khop(d) ? 'khop' : 'chenh' })
    }
    // Từng hóa đơn
    const tenHd = `Hóa đơn ${ten}: bảng kê cổng ↔ bảng kê phần mềm`
    if (!coCong || !sheetPm.length) {
      if (!khongPhatSinh) them({ nhom: 'hoa_don', ten: tenHd, kq: 'thieu', thieuFile: !coCong ? fileCong : `Bảng kê ${ten} xuất từ phần mềm kế toán` })
    } else {
      const r = doiChieuHoaDon(cong, pm, nam, k, chieu)
      const chiPmThat = r.chiPm.filter(x => !x.lyDo.startsWith('Ngày'))
      const coLech = r.chiCong.length || chiPmThat.length || r.lechTien.length
      them({ nhom: 'hoa_don', ten: tenHd, so1: r.soCong, nhan1: 'HĐ trên cổng trong kỳ', so2: r.soPm, nhan2: 'HĐ trên bảng kê phần mềm', laSoLuong: true,
        chenhChu: coLech ? [r.chiCong.length && `${r.chiCong.length} chưa vào phần mềm`, chiPmThat.length && `${chiPmThat.length} không có trên cổng`, r.lechTien.length && `${r.lechTien.length} lệch tiền`].filter(Boolean).join(' · ') : '',
        kq: coLech ? 'chenh' : 'khop' })
      for (const h of r.chiCong) chiTiet.push({ chieu, loai: 'chi_cong', hd: h, lyDo: `Có trên cổng, chưa có trong bảng kê phần mềm` })
      for (const x of chiPmThat) chiTiet.push({ chieu, loai: 'chi_pm', hd: x.hd, lyDo: x.lyDo })
      for (const x of r.lechTien) chiTiet.push({ chieu, loai: 'lech', hd: x.hd, cong: x.cong, lyDo: `Lệch tiền ${tien(x.lechTien)} · lệch thuế ${tien(x.lechThue)} (phần mềm − cổng)` })
      // Hóa đơn đã bị thay thế / hủy trên cổng mà phần mềm vẫn kê
      them({ nhom: 'hoa_don', ten: `Hóa đơn ${ten} bị thay thế / hủy mà phần mềm vẫn kê`, chenhChu: r.hetHieuLuc.length ? `${r.hetHieuLuc.length} hóa đơn` : 'không có', kq: r.hetHieuLuc.length ? 'chenh' : 'khop' })
      for (const x of r.hetHieuLuc) chiTiet.push({ chieu, loai: 'het_hieu_luc', hd: x.hd, cong: x.cong, lyDo: `Trên cổng: ${x.cong.trangThai}` })
      // Ngày ngoài kỳ: kê khai muộn — nêu để biết, không coi là sai
      them({ nhom: 'hoa_don', ten: `Hóa đơn ${ten} ngày ngoài kỳ trên bảng kê phần mềm`, chenhChu: r.ngoaiKy.length ? `${r.ngoaiKy.length} hóa đơn · ${tien(sum(r.ngoaiKy, 'tienChuaThue'))}` : 'không có', kq: r.ngoaiKy.length ? 'thong_tin' : 'khop',
        ghiChu: r.ngoaiKy.length ? 'Hóa đơn kỳ trước kê khai kỳ này — xem lại có đúng thời hạn kê khai bổ sung không' : '' })
      for (const h of r.ngoaiKy) chiTiet.push({ chieu, loai: 'ngoai_ky', hd: h, lyDo: `Ngày ${h.ngay} ngoài kỳ ${ma}` })
    }
  }

  // ── Lát 2: TNCN ↔ bảng lương, bảo hiểm (C12) ↔ bảng lương, ngân hàng / tiền mặt (cần sổ sách) ──
  // 05/KK-TNCN của kỳ: cùng kỳ; công ty khai GTGT tháng mà TNCN quý → soát ở tháng cuối quý.
  const tncnDs = toKhai.filter(t => t.loai === '05/KK-TNCN' && t.ky?.nam === nam)
  const kyTncn = (() => {
    if (tncnDs.some(t => maCua(t.ky) === ma)) return k
    if (k.loai === 'T' && tncnDs.some(t => t.ky.loai === 'Q')) return k.so % 3 === 0 ? { loai: 'Q', so: k.so / 3, ma: 'Q' + k.so / 3 } : 'giua_quy'
    return k
  })()
  const luongNam = bangLuong.filter(b => (b.nam ?? nam) === nam)
  if (kyTncn === 'giua_quy') {
    them({ nhom: 'tncn', ten: '05/KK-TNCN ↔ bảng lương', kq: 'thong_tin', chenhChu: 'khai theo quý', ghiChu: `05/KK-TNCN khai theo quý — soát ở tháng cuối quý (T${Math.ceil(k.so / 3) * 3})` })
  } else {
    const thangTncn = thangCuaKy(kyTncn)
    const pick = arr => arr.reduce((a, b) => (!a || hon(b, a) ? b : a), null)
    const dsKyT = tncnDs.filter(t => maCua(t.ky) === kyTncn.ma)
    const tkT = pick(dsKyT.filter(laBanChuaNop)) || pick(dsKyT.filter(t => !laBanChuaNop(t)))
    const luongKy = thangTncn.map(t => luongNam.filter(b => b.thang === t))
    const thieuThang = thangTncn.filter((t, i) => !luongKy[i].length)
    // Một tháng có nhiều sheet (vd 2 file) → lấy sheet đầu, tránh cộng đôi
    const motThang = luongKy.map(ds => ds.find(b => b.nguoi.length) || ds[0]).filter(Boolean)   // sheet có người trước sheet trống
    const tenKyT = `${kyTncn.loai === 'Q' ? 'Q' + kyTncn.so : 'T' + kyTncn.so}`
    const nhanT = tkT ? `05/KK-TNCN ${tenKyT} (${laBanChuaNop(tkT) ? 'chưa nộp' : tkT.lanBoSung ? 'BS lần ' + tkT.lanBoSung : 'đã nộp'})` : ''
    const nhanL = `Bảng lương ${thangTncn.map(t => 'T' + t).join(', ')}`
    const fileLuong = `Bảng thanh toán tiền lương (Excel) các tháng ${thieuThang.map(t => 'T' + t).join(', ')} trong 6. LƯƠNG\\1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG`
    const tongL = f => motThang.reduce((s, b) => (b.tong[f] == null ? s : (s ?? 0) + b.tong[f]), null)
    const thueL = tongL('thue') ?? 0
    if (!tkT && !motThang.length) {
      // không lương, không tờ khai: không có gì để soát
    } else if (!tkT) {
      them({ nhom: 'tncn', ten: `05/KK-TNCN ${tenKyT} ↔ bảng lương`, so2: thueL, nhan2: `Thuế TNCN trên ${nhanL}`, kq: thueL > 0 ? 'chenh' : 'khop', chenhChu: thueL > 0 ? 'có khấu trừ, chưa thấy tờ khai' : 'không phát sinh khấu trừ',
        ghiChu: thueL > 0 ? 'Bảng lương có khấu trừ thuế TNCN nhưng thư mục chưa có tờ khai 05/KK-TNCN của kỳ' : 'Không khấu trừ thuế TNCN — không phải nộp 05/KK-TNCN kỳ này' })
    } else if (thieuThang.length) {
      them({ nhom: 'tncn', ten: `05/KK-TNCN ${tenKyT} ↔ bảng lương`, so1: tkT.chiTieu['21'] ?? null, nhan1: '[21] ' + nhanT, kq: 'thieu', thieuFile: fileLuong })
    } else {
      const soNguoi = new Set(motThang.flatMap(b => b.nguoi.map(p => p.mst || p.ten.toUpperCase()))).size
      for (const [c, ten, so2, nhan2] of [
        ['21', `TNCN: [21] tổng thu nhập chịu thuế ↔ bảng lương`, tongL('tnct') ?? tongL('tongThuNhap'), `${tongL('tnct') != null ? 'Thu nhập chịu thuế' : 'Tổng thu nhập'} · ${nhanL}`],
        ['29', `TNCN: [29] thuế đã khấu trừ ↔ bảng lương`, tongL('thue'), `Thuế TNCN · ${nhanL}`],
        ['16', `TNCN: [16] tổng số lao động ↔ số người trên bảng lương`, soNguoi, `Số người · ${nhanL}`],
      ]) {
        const so1 = tkT.chiTieu[c] ?? null
        if (so2 == null) { them({ nhom: 'tncn', ten, so1, nhan1: `[${c}] ` + nhanT, kq: 'thong_tin', chenhChu: 'bảng lương không có cột này' }); continue }
        const d = lech(so1, so2)
        them({ nhom: 'tncn', ten, so1, nhan1: `[${c}] ` + nhanT, so2, nhan2, chenh: d, kq: khop(d ?? 0) ? 'khop' : 'chenh', laSoLuong: c === '16' })
      }
    }
  }
  // Bảo hiểm: C12 tháng cuối kỳ ↔ bảng lương cùng tháng (số người đóng BHXH, quỹ lương đóng BHXH)
  const thangCuoi = thangCuaKy(k).slice(-1)[0]
  // Nhiều C12 cùng tháng: KHÁC mã đơn vị thì cộng (công ty có 2 mã BHXH — HOANGTIENSG: người lao động 3 + giám đốc 1),
  // CÙNG mã (bản chép trùng) thì tính một lần. Trước đây lấy file đầu tiên → so nhầm 1 người với bảng lương 3 người.
  const theoMa = new Map()
  for (const c of c12.filter(c => c.nam === nam && c.thang === thangCuoi)) { const k = c.maDonVi || c.tep?.ten || theoMa.size; if (!theoMa.has(k)) theoMa.set(k, c) }
  const dsC12 = [...theoMa.values()]
  const cong = f => (dsC12.every(c => c[f] == null) ? null : dsC12.reduce((s, c) => s + (c[f] || 0), 0))
  const c12T = dsC12.length ? { soLaoDong: cong('soLaoDong'), quyLuong: cong('quyLuong'), soMa: dsC12.length, chiTiet: dsC12.map(c => c.soLaoDong ?? '?').join(' + ') } : null
  const nhanC12 = c12T?.soMa > 1 ? `C12 tháng ${thangCuoi} · ${c12T.soMa} mã đơn vị (${c12T.chiTiet})` : `C12 tháng ${thangCuoi}`
  const luongT = luongNam.find(b => b.thang === thangCuoi && b.nguoi.length) || luongNam.find(b => b.thang === thangCuoi)
  if (c12.length || luongNam.some(b => b.tong.soNguoiDongBh > 0)) {
    const tenBh = `Bảo hiểm: người tham gia trên C12 ↔ người đóng BHXH trên bảng lương T${thangCuoi}`
    const tenQl = `Bảo hiểm: quỹ lương đóng BHXH trên C12 ↔ lương đóng BH trên bảng lương T${thangCuoi}`
    if (!c12T) them({ nhom: 'bao_hiem', ten: tenBh, so2: luongT?.tong.soNguoiDongBh ?? null, nhan2: `Bảng lương T${thangCuoi}`, kq: 'thieu', thieuFile: `C12 tháng ${String(thangCuoi).padStart(2, '0')}/${nam} (PDF tải từ cổng BHXH) trong 5. BẢO HIỂM XÃ HỘI\\1. C12` })
    else if (!luongT) them({ nhom: 'bao_hiem', ten: tenBh, so1: c12T.soLaoDong, nhan1: nhanC12, kq: 'thieu', thieuFile: `Bảng thanh toán tiền lương tháng ${thangCuoi}/${nam}` })
    else {
      const d1 = lech(c12T.soLaoDong, luongT.tong.soNguoiDongBh)
      them({ nhom: 'bao_hiem', ten: tenBh, so1: c12T.soLaoDong, nhan1: nhanC12, so2: luongT.tong.soNguoiDongBh, nhan2: `Bảng lương T${thangCuoi}`, chenh: d1, kq: khop(d1 ?? 0) ? 'khop' : 'chenh', laSoLuong: true })
      if (c12T.quyLuong != null && luongT.tong.luongDongBh != null) {
        const d2 = lech(c12T.quyLuong, luongT.tong.luongDongBh)
        them({ nhom: 'bao_hiem', ten: tenQl, so1: c12T.quyLuong, nhan1: nhanC12, so2: luongT.tong.luongDongBh, nhan2: `Bảng lương T${thangCuoi}`, chenh: d2, kq: khop(d2) ? 'khop' : 'chenh' })
      }
    }
  }
  // Ngân hàng: sổ phụ (sao kê VND) ↔ sổ tiền gửi TK 112 (bỏ tài khoản ngoại tệ — sổ ghi VND quy đổi, sao kê ghi ngoại tệ)
  const thangK = thangCuaKy(k), tuNgay = `${nam}-${String(thangK[0]).padStart(2, '0')}-01`
  const denNgay = new Date(Date.UTC(nam, thangK[thangK.length - 1], 0)).toISOString().slice(0, 10)
  const ngayVN = x => `${x.slice(8, 10)}/${x.slice(5, 7)}`
  const sk = saoKeTien.filter(g => (g.tienTe || 'VND') === 'VND')
  const so112 = soTien.filter(d => /^112/.test(d.tk) && !laTkNgoaiTe(d.tk))
  const coSkKy = sk.some(g => g.ngay >= tuNgay && g.ngay <= denNgay), coSoKy = so112.some(d => d.ngay >= tuNgay && d.ngay <= denNgay)
  if (soSach.coSoPhu || so112.length) {
    const ten = 'Sổ phụ ngân hàng ↔ sổ tiền gửi ngân hàng (TK 112)'
    if (!coSkKy && !coSoKy) {
      if (sk.length && so112.length) them({ nhom: 'ngan_hang', ten, kq: 'khop', chenhChu: 'không phát sinh trong kỳ' })
      else if (!so112.length) them({ nhom: 'ngan_hang', ten, kq: 'thieu', thieuFile: soSach.coSo112 ? 'Sổ tiền gửi / sổ chi tiết TK 112 dạng Excel (file đang có không đọc được)' : 'Sổ chi tiết TK 112 trong 8. SỔ SÁCH KẾ TOÁN\\8. SỔ CHI TIẾT CÁC TÀI KHOẢN' })
    } else if (!coSkKy) them({ nhom: 'ngan_hang', ten, so2: so112.filter(d => d.ngay >= tuNgay && d.ngay <= denNgay).length, nhan2: 'dòng trên sổ 112 trong kỳ', kq: 'thieu', thieuFile: `Sổ phụ (sao kê Excel) ngân hàng ${ma}/${nam} trong 9. SỔ PHỤ NGÂN HÀNG` })
    else if (!so112.length) them({ nhom: 'ngan_hang', ten, kq: 'thieu', thieuFile: soSach.coSo112 ? 'Sổ tiền gửi / sổ chi tiết TK 112 dạng Excel (file đang có không đọc được)' : 'Sổ chi tiết TK 112 trong 8. SỔ SÁCH KẾ TOÁN\\8. SỔ CHI TIẾT CÁC TÀI KHOẢN' })
    else {
      const r = doiChieuNganHang(sk, so112, tuNgay, denNgay)
      // Sổ phụ có tới ngày nào (tính cả giao dịch sau kỳ — có giao dịch sau kỳ nghĩa là đã phủ hết kỳ)
      const cuoiSk = sk.map(g => g.ngay).sort().slice(-1)[0]
      const thieuNgay = cuoiSk && cuoiSk < new Date(new Date(denNgay) - 3 * 864e5).toISOString().slice(0, 10)
      for (const [chieu, f1, f2, nhan] of [['vào', 'vao', 'no', 'Tiền vào'], ['ra', 'ra', 'co', 'Tiền ra']]) {
        const d = lech(r.tongSaoKe[f1], r.tongSo[f2])
        const skLe = r.chiSaoKe.filter(g => g[f1] > 0), soLe = r.chiSo.filter(x => x[f2] > 0)
        const kyLe = r.lechKy.filter(p => p.so[f2] > 0)
        const ghi = [skLe.length && `${skLe.length} giao dịch trên sổ phụ chưa thấy trên sổ`,
          soLe.length && `${soLe.length} dòng trên sổ chưa thấy trên sổ phụ (sổ ghi gộp nhiều lần chuyển, hoặc tài khoản ngân hàng khác chưa có sổ phụ)`,
          ...kyLe.map(p => `lệch kỳ: sổ ghi ${ngayVN(p.so.ngay)}, sổ phụ ghi ${ngayVN(p.saoKe.ngay)} (${(p.so[f2]).toLocaleString('vi-VN')} đ)`),
          thieuNgay && `sổ phụ chỉ có đến ${ngayVN(cuoiSk)}`].filter(Boolean).join(' · ')
        them({ nhom: 'ngan_hang', ten: `${ten}: tiền ${chieu}`, so1: r.tongSaoKe[f1], nhan1: `${nhan} trên sổ phụ (${r.soSaoKe} giao dịch)`, so2: r.tongSo[f2], nhan2: `Phát sinh ${f2 === 'no' ? 'Nợ' : 'Có'} TK 112 (VND)`, chenh: d, kq: khop(d) ? 'khop' : 'chenh', ghiChu: khop(d) ? '' : ghi })
      }
      for (const g of r.chiSaoKe) chiTiet.push({ chieu: 'ngan_hang', loai: 'nh_chi_sao_ke', hd: { ngay: g.ngay, so: '', ten: g.moTa, tienChuaThue: g.vao || g.ra, thue: null }, lyDo: `${g.vao ? 'Tiền vào' : 'Tiền ra'} trên sổ phụ — không thấy dòng cùng số tiền trên sổ 112 (lệch tới 5 ngày)` })
      for (const d of r.chiSo) chiTiet.push({ chieu: 'ngan_hang', loai: 'nh_chi_so', hd: { ngay: d.ngay, so: d.soCt, ten: d.dienGiai, tienChuaThue: d.no || d.co, thue: null }, lyDo: `${d.no ? 'Nợ' : 'Có'} TK ${d.tk} đối ứng ${d.tkDu || '—'} — không thấy giao dịch cùng số tiền trên sổ phụ` })
    }
  }
  // Tiền mặt: phiếu chi (Có 111) từ 5 triệu (gồm thuế; trước 01/07/2025 là 20 triệu) cho mua hàng / chi phí
  const coSoQuyDoc = soTien.some(d => /^111/.test(d.tk))
  if (coSoQuyDoc) {
    const pc = chiTienMatTuNguong(soTien, tuNgay, denNgay)
    const muaKy = gopHoaDon(bangKe.filter(b => b.chieu === 'mua_vao').map(b => b.hoaDon)).filter(h => conHieuLuc(h))
    const tong = pc.reduce((x, d) => x + d.co, 0)
    them({ nhom: 'hoa_don', ten: `Chi tiền mặt từ ${nguongTienMat(denNgay) / 1e6} triệu (gồm thuế) cho mua hàng / chi phí`, so1: pc.length ? tong : 0, nhan1: `${pc.length} phiếu chi trên sổ quỹ`, kq: pc.length ? 'chenh' : 'khop',
      ghiChu: pc.length ? 'Hóa đơn thanh toán bằng tiền mặt từ ngưỡng này không đủ điều kiện khấu trừ thuế GTGT và không được tính vào chi phí được trừ — xem lại cách thanh toán' : '' })
    for (const d of pc) {
      const hd = muaKy.find(h => Math.abs(v(h.tienChuaThue) + v(h.thue) - d.co) <= 1000 && (!h.ngay || h.ngay <= d.ngay))
      chiTiet.push({ chieu: 'tien_mat', loai: 'tien_mat_nguong', hd: hd ? { ...hd, tienChuaThue: hd.tienChuaThue, thue: hd.thue } : { ngay: d.ngay, so: d.soCt, ten: d.dienGiai, tienChuaThue: d.co, thue: null },
        lyDo: `Phiếu chi ${d.soCt || '—'} ngày ${ngayVN(d.ngay)} (đối ứng ${d.tkDu}) ${d.co.toLocaleString('vi-VN')} đ` + (hd ? ' — khớp số tiền hóa đơn này' : ' — chưa tìm thấy hóa đơn mua vào cùng số tiền') })
    }
  } else if (bangKe.some(b => b.chieu === 'mua_vao')) {
    them({ nhom: 'hoa_don', ten: 'Hóa đơn mua vào từ 5 triệu (gồm thuế) trả bằng tiền mặt', kq: 'thieu',
      thieuFile: soSach.coSoQuy ? 'Sổ quỹ tiền mặt dạng Excel (file đang có không đọc được)' : 'Sổ quỹ tiền mặt trong 8. SỔ SÁCH KẾ TOÁN\\1. PHIẾU THU_PHIẾU CHI' })
  }

  // 6. Bản chưa nộp ↔ bản đã nộp (có cả hai)
  if (chuaNop && daNop) {
    const khac = [...new Set([...Object.keys(chuaNop.chiTieu), ...Object.keys(daNop.chiTieu)])].filter(c => !khop(lech(v(chuaNop.chiTieu[c]), v(daNop.chiTieu[c]))))
    them({ nhom: 'gtgt', ten: 'Bản chưa nộp (BẢNG KÊ) ↔ bản đã nộp (TỜ KHAI THUẾ)', chenhChu: khac.length ? `khác ở ${khac.map(c => '[' + c + ']').join(' ')}` : 'giống nhau', kq: khac.length ? 'thong_tin' : 'khop',
      ghiChu: khac.length ? 'Đang soát bản chưa nộp (mới hơn). Nộp bổ sung nếu bản này mới đúng.' : '' })
  }

  // Sheet "TỜ KHAI THUẾ GTGT" trong file xuất từ phần mềm (cùng file 2 bảng kê) ↔ tờ khai XML: bắt trường hợp nộp một bản
  // mà sổ sách / file lưu lại là bản khác. So với bản ĐÃ NỘP nếu có, không thì bản xuất HTKK chưa nộp.
  const kyTkPm = b => (b.kyThuMuc?.loai ? b.kyThuMuc : b.ky)
  const tkSo = daNop || chuaNop
  // Có cả bản chính thức và bổ sung: lấy sheet cùng lần nộp với tờ khai đem so, không có thì lần bổ sung cao nhất
  const dsTkPm = bangKe.filter(b => b.mau === 'tk_pm' && kyTkPm(b) && (kyTkPm(b).nam == null || kyTkPm(b).nam === nam) && kyTkPm(b).loai === k.loai && kyTkPm(b).so === k.so)
  const lanBs = b => b.kyThuMuc?.boSung || 0
  const tkPm = dsTkPm.find(b => lanBs(b) === (tkSo?.lanBoSung || 0)) || dsTkPm.sort((a, b) => lanBs(b) - lanBs(a))[0]
  if (tkPm && tkSo) {
    const maSo = Object.keys(tkPm.chiTieu).filter(c => c !== '21' && tkSo.chiTieu[c] != null)
    const khac = maSo.filter(c => !khop(lech(v(tkPm.chiTieu[c]), v(tkSo.chiTieu[c]))))
    const nhanXml = daNop ? `tờ khai XML đã nộp${daNop.lanBoSung ? ' (BS lần ' + daNop.lanBoSung + ')' : ''}` : 'tờ khai XML xuất HTKK (chưa nộp)'
    const nhanPm = `Sheet tờ khai · ${tkPm.tep?.ten || 'file phần mềm'}`
    if (!khac.length) them({ nhom: 'gtgt', ten: `Tờ khai trong file phần mềm ↔ ${nhanXml}`, kq: 'khop', chenhChu: `${maSo.length} chỉ tiêu giống nhau`, ghiChu: nhanPm })
    for (const c of khac.slice(0, 8)) {
      them({ nhom: 'gtgt', ten: `[${c}] tờ khai trong file phần mềm ↔ ${nhanXml}`, so1: tkPm.chiTieu[c], nhan1: nhanPm, so2: tkSo.chiTieu[c], nhan2: nhanXml,
        chenh: lech(v(tkPm.chiTieu[c]), v(tkSo.chiTieu[c])), kq: 'chenh', ghiChu: 'File xuất từ phần mềm khác tờ khai — xem lại bản nào đúng (sổ sách theo một bản, nộp một bản khác)' })
    }
    if (khac.length > 8) them({ nhom: 'gtgt', ten: `Tờ khai trong file phần mềm ↔ ${nhanXml}: còn ${khac.length - 8} chỉ tiêu khác`, kq: 'chenh', chenhChu: khac.slice(8).map(c => '[' + c + ']').join(' ') })
  }

  if (canTk.length) them({ nhom: 'gtgt', ten: `Tờ khai 01/GTGT ${ma}/${nam} — cần cho ${canTk.length} phép kiểm`, kq: 'thieu',
    thieuFile: `Tờ khai 01/GTGT ${ma}/${nam} (XML hoặc PDF in từ cổng) trong BAOCAOTHUE_${ma}\\TỜ KHAI THUẾ, hoặc bản xuất HTKK chưa nộp trong \\BẢNG KÊ` })

  // Dòng có chênh lệch lên trước
  const thuTu = { chenh: 0, thieu: 1, thong_tin: 2, khop: 3 }
  dong.sort((a, b) => thuTu[a.kq] - thuTu[b.kq])
  const oTong = { tong: dong.length, khop: dong.filter(d => d.kq === 'khop').length, chenh: dong.filter(d => d.kq === 'chenh').length, thieu: dong.filter(d => d.kq === 'thieu').length, thongTin: dong.filter(d => d.kq === 'thong_tin').length }
  const han = k.han
  return { nam, ky: k, loaiKy, kyKhaiNam: nk, banSoat, toKhai: tk, daNop, chuaNop, han, dong, chiTiet, oTong }
}

// Thư mục năm có sổ phụ / sổ chi tiết 112 / sổ quỹ chưa (theo tên thư mục con + tên file) — để báo "Thiếu hồ sơ" đúng chỗ
export function coSoSach(quetNam) {
  const C = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const soSach = quetNam?.vung?.so_sach || []
  const co = re => soSach.some(t => re.test(C(t.duongDan.slice(-1)[0]) + '|' + C(t.ten)))
  return { coSoPhu: (quetNam?.vung?.so_phu || []).length > 0, coSo112: co(/CHITIET.*112|112|TIENGUI/), coSoQuy: co(/SOQUY|PHIEUTHU|PHIEUCHI|TIENMAT|111/) }
}

// Khoá một hóa đơn dùng chung (đếm hóa đơn duy nhất ở màn Tăng trưởng): có ký hiệu thì MST + ký hiệu + số, không thì
// MST + số + ngày — cùng cách ghép của Soát kỳ.
export const khoaGop = h => khoaDu(h) || khoaPhu(h)

// ── Bảng kê hóa đơn theo kỳ (màn "Bảng kê hóa đơn" của Soát xét năm, mockup soat-4) ─────────────────────
// Một chiều (mua_vao / ban_ra), một kỳ k = { loai: 'T'|'Q', so } trong năm: tổng 3 nguồn (bảng kê cổng HĐĐT, bảng kê phần
// mềm kế toán, tờ khai 01/GTGT) + đối chiếu từng hóa đơn — dùng đúng các bước ghép của Soát kỳ.
// bangKe: bảng kê ĐỌC ĐẦY ĐỦ (docBangKeDayDu). Trả { cong, pm, tk: {so, tien, thue}, khop, chiCong, chiPm, lech, hetHieuLuc,
// ngoaiKy, coCong, coPm, coTk, nguon: { cong, pm, tk } }
export function bangKeKy({ nam, k, loaiKy, chieu, toKhai = [], bangKe = [] }) {
  const ma = maCua(k)
  const [ctTien, ctThue] = chieu === 'ban_ra' ? ['34', '35'] : ['23', '24']
  const sheetCong = bangKe.filter(b => b.mau === 'cong' && b.chieu === chieu)
  const cong = gopHoaDon(sheetCong.map(b => b.hoaDon))
  const congKy = cong.filter(h => trongKy(h.ngay, nam, k) && conHieuLuc(h))
  const sheetPm = bangKe.filter(b => b.mau?.startsWith('pm_') && b.chieu === chieu && kyPhu(kyCuaSheetPm(b, nam, loaiKy), k))
  const pm = gopHoaDon(sheetPm.map(b => (b.kyThuMuc?.loai === 'Q' && k.loai === 'T') ? b.hoaDon.filter(h => trongKy(h.ngay, nam, k)) : b.hoaDon))
  const { daNop, chuaNop } = toKhaiCuaKy(toKhai, nam, ma)
  const tk = daNop || chuaNop
  const sum = (ds, f) => ds.reduce((s, h) => s + v(h[f]), 0)
  const coCong = sheetCong.some(b => b.hoaDon.some(h => trongKy(h.ngay, nam, k)))
  const r = coCong && sheetPm.length ? doiChieuHoaDon(cong, pm, nam, k, chieu) : null
  const chiPm = r ? r.chiPm.filter(x => !x.lyDo.startsWith('Ngày')) : []
  return {
    ky: { ...k, ma },
    cong: { so: congKy.length, tien: coCong ? sum(congKy, 'tienChuaThue') : null, thue: coCong ? sum(congKy, 'thue') : null },
    pm: { so: pm.length, tien: sheetPm.length ? sum(pm, 'tienChuaThue') : null, thue: sheetPm.length ? sum(pm, 'thue') : null },
    tk: { tien: tk ? tk.chiTieu[ctTien] ?? null : null, thue: tk ? tk.chiTieu[ctThue] ?? null : null, banChuaNop: !daNop && !!chuaNop },
    khop: r ? r.soCong - r.chiCong.length - r.lechTien.length : null,
    chiCong: r ? r.chiCong : [], chiPm, lech: r ? r.lechTien : [], hetHieuLuc: r ? r.hetHieuLuc : [], ngoaiKy: r ? r.ngoaiKy : [],
    coCong, coPm: sheetPm.length > 0, coTk: !!tk,
    nguon: { cong: [...new Set(sheetCong.filter(b => b.hoaDon.some(h => trongKy(h.ngay, nam, k))).map(b => b.tep))], pm: [...new Set(sheetPm.map(b => b.tep))], tk: tk ? [tk.tep] : [] },
  }
}

// Gộp nhiều kỳ (cả năm): cộng tổng, nối danh sách chênh lệch.
// Tổng chỉ cộng các kỳ CÓ ĐỦ bảng kê cổng và bảng kê phần mềm (kyDu); kỳ thiếu một bên để riêng ở kyBo. Trước đây cộng
// hết: DOEL 2026 cổng chỉ có Q1–Q2 mà phần mềm có Q1–Q4 → "thuế chênh với phần mềm −13 triệu" giả (27/10/2026).
// Không kỳ nào đủ thì cộng hết như cũ (kyDu rỗng).
export function gopBangKeKy(ds) {
  const cong = (a, b) => (a == null && b == null ? null : (a || 0) + (b || 0))
  const ra = { ky: { ma: 'Năm' }, cong: { so: 0, tien: null, thue: null }, pm: { so: 0, tien: null, thue: null }, tk: { tien: null, thue: null }, khop: null,
    chiCong: [], chiPm: [], lech: [], hetHieuLuc: [], ngoaiKy: [], coCong: false, coPm: false, coTk: false, nguon: { cong: [], pm: [], tk: [] },
    kyDu: [], kyBo: [] }
  const du = ds.filter(x => x.coCong && x.coPm)
  for (const x of ds) {
    if (du.length && !du.includes(x)) {
      if (x.coCong || x.coPm || x.coTk) ra.kyBo.push({ ma: x.ky.ma, thieu: !x.coCong ? 'bảng kê cổng' : 'bảng kê phần mềm' })
    } else {
      if (du.length) ra.kyDu.push(x.ky.ma)
      for (const n of ['cong', 'pm']) { ra[n].so += x[n].so; ra[n].tien = cong(ra[n].tien, x[n].tien); ra[n].thue = cong(ra[n].thue, x[n].thue) }
      ra.tk.tien = cong(ra.tk.tien, x.tk.tien); ra.tk.thue = cong(ra.tk.thue, x.tk.thue)
    }
    ra.khop = x.khop == null ? ra.khop : (ra.khop || 0) + x.khop
    for (const l of ['chiCong', 'chiPm', 'lech', 'hetHieuLuc', 'ngoaiKy']) ra[l].push(...x[l])
    for (const c of ['coCong', 'coPm', 'coTk']) ra[c] = ra[c] || x[c]
    for (const n of ['cong', 'pm', 'tk']) for (const t of x.nguon[n]) if (!ra.nguon[n].includes(t)) ra.nguon[n].push(t)
  }
  return ra
}
