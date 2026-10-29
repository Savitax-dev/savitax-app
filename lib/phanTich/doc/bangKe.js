// Đọc bảng kê hóa đơn Excel — cổng hóa đơn điện tử và phần mềm kế toán (GĐ 1).
//
// Đầu vào là MẢNG HÀNG đã đọc từ Excel (mỗi sheet: { ten, hang: [[ô, ô…], …] }) để hàm thuần, kiểm được trong
// Node; bước mở file .xlsx/.xls nằm ở lib/phanTich/doc/excel.js.
//
// Ba mẫu thật đã gặp trên Drive (kế hoạch mục 9.3):
//   'cong'       — "DANH SÁCH HÓA ĐƠN" tải từ cổng HĐĐT, tiêu đề cột dòng 6: Ký hiệu mẫu số | Ký hiệu hóa đơn | Số hóa
//                  đơn | Ngày lập | MST… | Tên… | Tổng tiền chưa thuế | Tổng tiền thuế | … | Trạng thái | Kết quả kiểm tra
//   'pm_tokhai'  — "To khai thue GTGT khau tru 01GTGT.xlsx": sheet tờ khai + 2 sheet bảng kê, tiêu đề cột 2 tầng
//                  (Hóa đơn, chứng từ → Mẫu số | Ký hiệu | Số hóa đơn | Ngày…), dòng nhóm theo thuế suất
//   'pm_quantri' — "BANG KE HOA DON CHU.xlsx" / "…mau_quan_tri.xlsx": Số hóa đơn | Ngày hóa đơn | Tên… | MST… |
//                  Mặt hàng | Giá trị/Doanh số chưa thuế | Thuế suất | Thuế GTGT | Tài khoản thuế [| Tờ khai | Kỳ kê khai]
//                  ⚠ KHÔNG có cột ký hiệu → ghép hóa đơn dùng khóa dự phòng MST + số + ngày.
//
// Nhận mẫu theo NỘI DUNG (tên cột), không theo tên file / thư mục. Chiều mua vào / bán ra:
//   - file phần mềm: theo tên cột / tên sheet ("người bán", "mua vào" ↔ "người mua", "bán ra", "doanh số bán")
//   - file cổng: tiêu đề chỉ ghi "DANH SÁCH HÓA ĐƠN" và cột đối tác luôn ghi "MST người mua" kể cả file mua vào,
//     nên chiều lấy từ gợi ý bên ngoài (tên file > thư mục), không có thì trả null để hỏi người dùng.

import { chuanHoaTen } from '../../tokhaiThuMuc.js'

// ── Số, ngày ─────────────────────────────────────────────────────────────────

// 1234567 | '1.234.567' | '1,234,567' | '(1.000)' | '-1.000' | '' → number | null
export function soO(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/\s|đ|₫|VND/gi, '')
  if (!s) return null
  const am = /^\(.*\)$/.test(s) || s.startsWith('-')
  s = s.replace(/[()]/g, '').replace(/^-/, '')
  if (!/^[\d.,]+$/.test(s)) return null
  // Có cả . và , → ký tự xuất hiện sau cùng là dấu thập phân; chỉ một loại lặp nhiều lần → dấu nghìn.
  const cuoiCham = s.lastIndexOf('.'), cuoiPhay = s.lastIndexOf(',')
  if (cuoiCham >= 0 && cuoiPhay >= 0) {
    s = cuoiCham > cuoiPhay ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  } else if (cuoiCham >= 0) {
    s = (s.match(/\./g).length > 1 || /\.\d{3}$/.test(s)) ? s.replace(/\./g, '') : s
  } else if (cuoiPhay >= 0) {
    s = (s.match(/,/g).length > 1 || /,\d{3}$/.test(s)) ? s.replace(/,/g, '') : s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? (am ? -n : n) : null
}

// Date | số ngày Excel | '12/08/2025' | '2025-08-12' → 'YYYY-MM-DD' | null
export function ngayO(v) {
  if (v == null || v === '') return null
  const p = x => String(x).padStart(2, '0')
  // Date do thư viện đổi có thể hụt vài giây theo múi giờ (31/03 23:59:56 thay vì 01/04) → cộng 1 phút trước khi lấy ngày
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 60000); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  if (typeof v === 'number' && v > 20000 && v < 80000) {       // số ngày Excel (gốc 1899-12-30)
    // Phần lẻ là giờ trong ngày → lấy phần nguyên (đệm sai số dấu phẩy động), không làm tròn lên ngày sau
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v + 1e-6) * 86400000)
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) return `${m[3]}-${p(m[2])}-${p(m[1])}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// MST: bỏ khoảng trắng; giữ đuôi chi nhánh "-001"
export const mstO = v => (v == null ? '' : String(v).replace(/\s/g, '').replace(/\.0$/, ''))
// So MST: Excel hay làm mất số 0 đầu khi ô là số ('0318…' → 318…)
const khongSo0 = v => mstO(v).replace(/^0+/, '')
// Số hóa đơn: bỏ số 0 đầu ('0000431' ≡ 431)
export const soHdO = v => (v == null || v === '' ? '' : String(v).trim().replace(/\.0$/, '').replace(/^0+(?=\d)/, ''))

// ── Nhận cột ─────────────────────────────────────────────────────────────────

// Chuẩn hoá tên cột để so: bỏ dấu, khoảng trắng VÀ mọi ký tự không phải chữ/số ("Hóa đơn, chứng từ" có dấu phẩy).
const C = s => chuanHoaTen(s).replace(/[^A-Z0-9]/g, '')
// Thứ tự quan trọng: cột cụ thể kiểm trước cột chung chung.
const COT = [
  ['mauSo', t => t.includes(C('MẪU SỐ'))],
  ['kyHieu', t => t.includes(C('KÝ HIỆU'))],
  ['soHd', t => t.includes(C('SỐ HÓA ĐƠN')) || t.includes(C('SỐ HOÁ ĐƠN')) || t === C('SỐ')],
  ['ngay', t => t.includes('NGAY')],
  // File cổng HĐĐT có CẢ hai phía: "MST người bán/MST người xuất hàng" và "MST người mua/MST người nhận hàng"
  // (đối chiếu file thật 127HOME 26/10/2026). File phần mềm chỉ có một cột MST đối tác → rơi vào 'mst'.
  ['mstBan', t => (t.startsWith('MSTNGUOIBAN') && t.includes('MSTNGUOIXUAT'))],
  ['mstMua', t => (t.startsWith('MSTNGUOIMUA') && t.includes('MSTNGUOINHAN'))],
  ['tenBan', t => (t.startsWith('TENNGUOIBAN') && t.includes('TENNGUOIXUAT'))],
  ['tenMua', t => (t.startsWith('TENNGUOIMUA') && t.includes('TENNGUOINHAN'))],
  ['mst', t => t.includes(C('MÃ SỐ THUẾ')) || t.startsWith('MST')],
  ['ten', t => t.startsWith(C('TÊN NGƯỜI')) || t.startsWith(C('TÊN ĐƠN VỊ'))],
  ['matHang', t => t.includes(C('MẶT HÀNG'))],
  ['thueKhauTru', t => t.includes(C('ĐƯỢC KHẤU TRỪ'))],
  ['thueGiam', t => t.includes(C('ĐƯỢC GIẢM')) || t.startsWith(C('HĐ GIẢM'))],
  ['thueSuat', t => t.includes(C('THUẾ SUẤT'))],
  ['tienCk', t => t.includes(C('CHIẾT KHẤU'))],
  ['tienPhi', t => t.includes(C('TỔNG TIỀN PHÍ'))],
  ['tongTt', t => t.includes(C('THANH TOÁN'))],
  ['tienChuaThue', t => t.includes(C('CHƯA THUẾ')) || t.includes(C('CHƯA CÓ THUẾ')) || t.startsWith(C('DOANH THU')) || t.startsWith(C('DOANH SỐ')) || t.startsWith(C('GIÁ TRỊ HHDV'))],
  ['thue', t => t === C('THUẾ GTGT') || t === C('TỔNG TIỀN THUẾ') || t === C('TIỀN THUẾ')],
  ['tkThue', t => t.includes(C('TÀI KHOẢN THUẾ'))],
  ['trangThai', t => t.includes(C('TRẠNG THÁI'))],
  ['ketQuaKt', t => t.includes(C('KẾT QUẢ KIỂM TRA'))],
  ['donViTien', t => t.includes(C('ĐƠN VỊ TIỀN'))],
  ['kyKeKhai', t => t.includes(C('KỲ KÊ KHAI'))],
  ['toKhai', t => t === C('TỜ KHAI')],
]

// Tìm dòng tiêu đề (có "Số hóa đơn") trong 40 dòng đầu; gộp với dòng ngay dưới nếu đó là tầng con (Mẫu số | Ký hiệu…)
// và dòng ngay trên nếu tầng trên bị gộp ô. Trả { dong, cot: {khoa: chỉ số}, tieuDe: [chuỗi] } | null.
export function timTieuDe(hang) {
  for (let i = 0; i < Math.min(hang.length, 40); i++) {
    const r = hang[i] || []
    const coSoHd = r.some(o => typeof o === 'string' && /SOHOADON|SOHOADON/.test(C(o)))
    const tren = r.some(o => typeof o === 'string' && /HOADONCHUNGTU/.test(C(o)))
    if (!coSoHd && !tren) continue
    // Tiêu đề 2 tầng: dòng i là tầng trên ("Hóa đơn, chứng từ…"), dòng i+1 có "Số hóa đơn"
    let dong = i, tang = [r]
    if (!coSoHd && tren) {
      const duoi = hang[i + 1] || []
      if (!duoi.some(o => typeof o === 'string' && /SOHOADON/.test(C(o)))) continue
      dong = i + 1; tang = [r, duoi]
    }
    const rong = Math.max(...tang.map(x => x.length))
    const tieuDe = []
    for (let c = 0; c < rong; c++) {
      const ten = tang.map(x => x[c]).filter(o => o != null && String(o).trim() !== '').map(String).pop() || ''
      tieuDe.push(ten.replace(/\s+/g, ' ').trim())
    }
    const cot = {}
    tieuDe.forEach((ten, c) => {
      const t = C(ten)
      if (!t) return
      for (const [khoa, dk] of COT) if (cot[khoa] == null && dk(t)) { cot[khoa] = c; break }
    })
    if (cot.soHd == null) continue
    return { dong, cot, tieuDe }
  }
  return null
}

// ── Nhận mẫu, chiều ──────────────────────────────────────────────────────────

function nhanMau(cot) {
  if (cot.trangThai != null || cot.ketQuaKt != null || cot.tongTt != null) return 'cong'
  if (cot.mauSo != null || cot.kyHieu != null) return 'pm_tokhai'
  if (cot.matHang != null || cot.tkThue != null) return 'pm_quantri'
  return 'khac'
}
function chieuTheoChu(...cacChu) {
  const s = C(cacChu.join(' '))
  const mua = /MUAVAO|NGUOIBAN|HHDVMUAVAO/.test(s), ban = /BANRA|NGUOIMUA|DOANHSOBAN|DOANHTHU/.test(s)
  if (mua && !ban) return 'mua_vao'
  if (ban && !mua) return 'ban_ra'
  return null
}

// Chiều theo TÊN SHEET của file cổng: "MV", "Mua vào", "HĐ mua vào", "Đầu vào" → mua vào; "BR", "Bán ra"… → bán ra
export function chieuTheoTenSheet(ten) {
  const s = C(ten)
  const mua = /^(MV|HDMV|DSMV|BKMV)\d*$|MUAVAO|DAUVAO/.test(s), ban = /^(BR|HDBR|DSBR|BKBR)\d*$|BANRA|DAURA/.test(s)
  return mua && !ban ? 'mua_vao' : ban && !mua ? 'ban_ra' : null
}

// Thuế suất từ dòng nhóm: "3. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 5%:" → 0.05 ; "không chịu thuế" → 'kct'
function thueSuatNhom(s) {
  const t = C(s)
  if (t.includes('KHONGCHIUTHUE') || t.includes('KHONGPHAIKEKHAI')) return 'kct'
  const m = String(s).match(/(\d{1,2})\s*%/)
  return m ? Number(m[1]) / 100 : undefined
}

// Ô cột "Thuế suất": 0.1 | 10 | '10%' | '8 %' → 0.1 / 0.08 ; 'KCT', 'KKKNT', '' → null
function thueSuatO(v) {
  if (typeof v === 'number') return v > 1 ? v / 100 : v
  const m = String(v ?? '').match(/^\s*(\d{1,2}(?:[.,]\d+)?)\s*%?\s*$/)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return n > 1 ? n / 100 : n
}

// ── Đọc 1 sheet bảng kê ──────────────────────────────────────────────────────

// goiY: { chieu } từ tên file / thư mục (chỉ dùng cho file cổng hoặc khi tên cột không nói rõ).
export function docSheetBangKe(sheet, goiY = {}) {
  const hang = sheet.hang || []
  const td = timTieuDe(hang)
  if (!td) return null
  const { cot, dong, tieuDe } = td
  // Phụ lục "BẢNG KÊ HÓA ĐƠN GIẢM THUẾ GTGT THEO NGHỊ QUYẾT …" trong file xuất HTKK / phần mềm: liệt kê LẠI chính các hóa
  // đơn bán ra (không có MST người mua) → không phải bảng kê thứ hai. Trước 27/10/2026 bị cộng thành bán ra, DOEL Q2 ra
  // 31 hóa đơn "không có trên cổng" oan và tổng bán ra phần mềm gấp đôi.
  const tren = C([sheet.ten || '', ...hang.slice(0, dong).flat().filter(o => typeof o === 'string')].join(' '))
  if (/HOADONGIAMTHUE/.test(tren) && !/BANRA|MUAVAO/.test(tren)) return { mau: 'pl_giam_thue', chieu: null, sheet: sheet.ten, dongTieuDe: dong + 1, hoaDon: [], thang: [], canhBao: [] }
  const mau = nhanMau(cot)
  let chieu = mau === 'cong' ? null : chieuTheoChu(sheet.ten || '', ...tieuDe)
  // File cổng gộp 2 sheet "MV" / "BR" (HONGDUC 29/10/2026: "BẢNG KÊ MV-BR.xlsx"): cột đối tác ở CẢ hai sheet đều ghi
  // "MST người mua", tên file chứa cả hai chiều → chỉ tên sheet nói được chiều. MST công ty (bên dưới) vẫn được ưu tiên.
  if (!chieu && mau === 'cong') chieu = chieuTheoTenSheet(sheet.ten)
  if (!chieu) chieu = goiY.chieu || null
  const g = (r, k) => (cot[k] == null ? undefined : r[cot[k]])
  const hoaDon = [], canhBao = []
  let nhom
  for (let i = dong + 1; i < hang.length; i++) {
    const r = hang[i] || []
    const conChu = r.filter(o => o != null && String(o).trim() !== '')
    if (!conChu.length) continue
    // Dòng đánh số cột "(1) (2) (3)…" ngay dưới tiêu đề
    if (conChu.every(o => /^\(?\d{1,2}\)?$/.test(String(o).trim()))) continue
    const so = g(r, 'soHd')
    // Số hóa đơn là một "từ" ngắn có chữ số; dòng nhóm "Nhóm HHDV mua vào: 1. …" đè lên cột số thì không phải.
    const coSo = so != null && /^[A-Za-z0-9./-]{1,20}$/.test(String(so).trim()) && /\d/.test(String(so))
    if (!coSo) {
      const chu = conChu.map(String).join(' ')
      const ts = thueSuatNhom(chu)
      if (ts !== undefined) nhom = ts
      continue                                             // dòng nhóm, dòng "Tổng", dòng ghi chú
    }
    if (/^(T[ỔO]NG|C[ỘO]NG)/i.test(String(conChu[0]).trim())) continue
    const tsCot = thueSuatO(g(r, 'thueSuat'))
    hoaDon.push({
      dong: i + 1,
      mauSo: g(r, 'mauSo') == null ? '' : String(g(r, 'mauSo')).trim().replace(/\.0$/, ''),
      kyHieu: g(r, 'kyHieu') == null ? '' : String(g(r, 'kyHieu')).trim(),
      so: soHdO(so),
      ngay: ngayO(g(r, 'ngay')),
      mst: mstO(g(r, 'mst')),
      ten: g(r, 'ten') == null ? '' : String(g(r, 'ten')).trim(),
      mstBan: mstO(g(r, 'mstBan')), mstMua: mstO(g(r, 'mstMua')),
      tenBan: g(r, 'tenBan') == null ? '' : String(g(r, 'tenBan')).trim(),
      tenMua: g(r, 'tenMua') == null ? '' : String(g(r, 'tenMua')).trim(),
      tienChuaThue: soO(g(r, 'tienChuaThue')),
      thue: soO(g(r, 'thue')),
      thueKhauTru: soO(g(r, 'thueKhauTru')),
      thueSuat: tsCot != null ? tsCot : (typeof nhom === 'number' ? nhom : null),
      khongChiuThue: nhom === 'kct' || /KCT|KHONGCHIU/i.test(String(g(r, 'thueSuat') ?? '')),
      tongTt: soO(g(r, 'tongTt')),
      trangThai: g(r, 'trangThai') == null ? '' : String(g(r, 'trangThai')).trim(),
      ketQuaKt: g(r, 'ketQuaKt') == null ? '' : String(g(r, 'ketQuaKt')).trim(),
      kyKeKhai: g(r, 'kyKeKhai') == null ? '' : String(g(r, 'kyKeKhai')).trim(),
    })
  }
  // File cổng có cả MST người bán lẫn người mua → chiều xác định bằng MST CÔNG TY (goiY.mstCty), đáng tin hơn tên
  // file: công ty là người bán trên đa số dòng → bán ra. Rồi đặt mst/ten = phía ĐỐI TÁC.
  if (cot.mstBan != null || cot.mstMua != null) {
    const mc = khongSo0(goiY.mstCty)
    if (mc) {
      const ban = hoaDon.filter(h => khongSo0(h.mstBan) === mc).length
      const mua = hoaDon.filter(h => khongSo0(h.mstMua) === mc).length
      if (ban > mua) chieu = 'ban_ra'
      else if (mua > ban) chieu = 'mua_vao'
      // Chỉ cảnh báo khi file có CẢ hai cột MST: file cổng chỉ có một cột (phía đối tác) thì không thể có MST công ty
      else if (hoaDon.length && cot.mstBan != null && cot.mstMua != null) canhBao.push('Không dòng nào có MST của công ty — có thể là bảng kê của công ty khác')
    }
    for (const h of hoaDon) {
      if (chieu === 'ban_ra') { h.mst = h.mstMua; h.ten = h.tenMua }
      else if (chieu === 'mua_vao') { h.mst = h.mstBan; h.ten = h.tenBan }
    }
  }
  if (mau === 'pm_quantri') canhBao.push('Mẫu không có cột ký hiệu hóa đơn — ghép theo MST + số + ngày')
  if (!chieu) canhBao.push('Chưa xác định được mua vào hay bán ra — cần người dùng chọn')
  // Các tháng bảng kê phủ, tính từ NGÀY LẬP từng hóa đơn — dòng "Từ ngày … đến ngày …" đầu file cổng không đáng
  // tin (file thật ghi 01/01–31/01 mà chứa hóa đơn cả quý).
  const thang = [...new Set(hoaDon.map(h => (h.ngay || '').slice(0, 7)).filter(Boolean))].sort()
  return { mau, chieu, sheet: sheet.ten, dongTieuDe: dong + 1, hoaDon, thang, canhBao }
}

// Sheet "TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG" trong file xuất từ phần mềm / HTKK (kiểu 1, cùng file với 2 bảng kê): ô mã "[24]"
// rồi số ở ô có giá trị kế bên phải (DOEL Q2/2026: mã ở cột D/G, số ở cột F/H). Trả { mau: 'tk_pm', chiTieu, ky } | null.
// mau 'tk_pm' KHÔNG bắt đầu bằng 'pm_' → không lẫn vào phần đếm / ghép hóa đơn.
export function docSheetToKhaiPm(sheet) {
  const hang = sheet.hang || []
  const dau = C([sheet.ten || '', ...hang.slice(0, 8).flat().filter(o => typeof o === 'string')].join(' '))
  if (!/TOKHAITHUEGIATRIGIATANG|TOKHAITHUEGTGT|01GTGT/.test(dau)) return null
  if (timTieuDe(hang)) return null   // bảng kê "Kèm theo tờ khai 01/GTGT" có cột Số hóa đơn → không phải tờ khai
  const chiTieu = {}
  for (const r of hang) {
    const o = r || []
    for (let j = 0; j < o.length; j++) {
      const m = typeof o[j] === 'string' && o[j].trim().match(/^\[(\d{2}[a-z]?)\]$/)
      if (!m) continue
      for (let t = j + 1; t < o.length; t++) {
        const x = o[t]
        if (x == null || String(x).trim() === '') continue
        if (typeof x === 'string' && /^\[\d{2}[a-z]?\]$/.test(x.trim())) break     // tới mã kế tiếp mà chưa gặp số
        const so = soO(x)
        if (so != null) chiTieu[m[1]] = so
        break
      }
    }
  }
  if (Object.keys(chiTieu).length < 8) return null
  // Kỳ ghi trong sheet (nếu có): "Quý 2 năm 2026", "Tháng 05 năm 2026" — không có thì lấy theo thư mục kỳ
  const chuDau = hang.slice(0, 15).flat().filter(o => typeof o === 'string').join(' ')
  const viTri = chuDau.search(/k[ỳy]\s*t[íi]nh\s*thu[ếe]/i)
  const chu = viTri < 0 ? '' : chuDau.slice(viTri)   // không có "Kỳ tính thuế" thì để kỳ theo thư mục
  const mq = chu.match(/qu[ýy]\s*(\d)\s*(?:\/|n[ăa]m)\s*(\d{4})/i), mt = chu.match(/th[áa]ng\s*(\d{1,2})\s*(?:\/|n[ăa]m)\s*(\d{4})/i)
  const ky = mq ? { loai: 'Q', so: +mq[1], nam: +mq[2] } : mt ? { loai: 'T', so: +mt[1], nam: +mt[2] } : null
  return { mau: 'tk_pm', chieu: null, sheet: sheet.ten, hoaDon: [], thang: [], chiTieu, ky, canhBao: [] }
}

// Đọc cả file (nhiều sheet). Sheet tờ khai trong file phần mềm kiểu 1 → mục 'tk_pm' (đối chiếu với tờ khai XML).
export function docBangKe(sheets, goiY = {}) {
  const ra = []
  for (const sh of sheets) {
    const tkPm = docSheetToKhaiPm(sh)
    if (tkPm) { ra.push(tkPm); continue }
    const bk = docSheetBangKe(sh, goiY)
    if (bk?.mau === 'pl_giam_thue') continue
    if (bk && bk.hoaDon.length) ra.push(bk)
    else if (bk && bk.mau !== 'khac') ra.push(bk)           // bảng kê rỗng (không phát sinh) vẫn ghi nhận
  }
  return ra
}

// ── Khóa ghép hóa đơn ────────────────────────────────────────────────────────

// Ký hiệu HĐĐT có 2 cách ghi: cột riêng "1" + "C25TSS" (cổng), hoặc gộp "1C25TSS" (một số phần mềm).
// Quy về một dạng "1C25TSS". Ký hiệu kiểu cũ (vd "AA/20E") giữ nguyên, ghép sau mẫu số.
export function kyHieuDayDu(mauSo, kyHieu) {
  const kh = String(kyHieu || '').toUpperCase().replace(/\s/g, '')
  const ms = String(mauSo || '').trim().replace(/\.0$/, '')
  if (!kh) return ''
  const m = kh.match(/^([1-9])?([CK]\d{2}[A-Z]{3,4})$/)
  if (m) return (m[1] || (/^[1-9]$/.test(ms) ? ms : '')) + m[2]
  return ms + kh
}

// Khóa chính: MST + ký hiệu đầy đủ + số. Mẫu "quản trị" không có ký hiệu → khóa dự phòng MST + số + ngày.
export function khoaHoaDon(h) {
  const kh = kyHieuDayDu(h.mauSo, h.kyHieu)
  return kh ? `${h.mst}|${kh}|${h.so}` : `${h.mst}|#|${h.so}|${h.ngay || ''}`
}
export const khoaDuPhong = h => `${h.mst}|#|${h.so}|${h.ngay || ''}`
