// Đọc bảng thanh toán tiền lương (Excel) + C12 BHXH (PDF có chữ) — Soát kỳ lát 2 (TNCN, bảo hiểm).
//
// Hàm thuần: nhận mảng hàng của sheet (excel.js docExcel) / các dòng chữ PDF (pdfChu.js) → số liệu theo tháng.
// Mẫu dựng theo file thật (127HOME, 26/10/2026):
//   - "LƯƠNG 2026.xls": mỗi tháng một sheet "BẢNG THANH TOÁN TIỀN LƯƠNG" (LT1…LT12), ô "Tháng | 1 | Năm | 2026",
//     tiêu đề 2 tầng: "Doanh nghiệp chịu" / "Khấu trừ vào lương" mỗi nhóm có cột BHXH, BHYT, BHTN… → PHẢI ghép tầng
//     trên với tầng dưới, không thì lấy nhầm BHXH phần doanh nghiệp.
//   - C12-TS: "Tháng 09 năm 2026", "2 Quỹ lương <BHXH> …", "Đ Chuyển kỳ sau / 1 Số lao động 4 …",
//     "a) Kết quả đơn vị đã đóng BHXH bắt buộc cho 4 lao động…".
import { chuanHoaTen } from '../../tokhaiThuMuc.js'
import { soO, mstO } from './bangKe.js'

const C = s => chuanHoaTen(String(s ?? '')).replace(/[^A-Z0-9]/g, '')

// Nhận cột theo nhãn ĐÃ GHÉP 2 tầng ("KHAUTRUVAOLUONG|BHXH"). Thứ tự quan trọng: cụ thể trước.
const COT = [
  ['ten', t => /HOVATEN|HOTEN/.test(t)],
  ['tnTinhThue', t => t.includes('THUNHAPTINHTHUE')],
  ['tnct', t => t.includes('THUNHAPCHIUTHUE')],
  ['thue', t => t.includes('THUETNCN') && !t.includes('THUNHAP')],
  ['bhxhNld', t => /KHAUTRU|NLD|NGUOILAODONG/.test(t) && /\|BHXH$/.test(t)],
  ['luongDongBh', t => t.includes('LUONGDONGBH') || t.includes('MUCDONGBH') || t.includes('LUONGDONGBAOHIEM')],
  ['tongThuNhap', t => t.includes('TONGTHUNHAP')],
  ['thucLanh', t => /THUCLANH|THUCLINH|THUCNHAN/.test(t)],
  ['mst', t => t === 'MST' || /\|MST$/.test(t) || t.includes('MASOTHUE')],
]

// Tìm tiêu đề trong 25 dòng đầu: dòng có "Họ và tên" + ("Tổng thu nhập" | "Thực lãnh"); ghép với dòng dưới nếu là
// tầng con. Tầng trên được "kéo" sang phải cho các cột con của nhóm (ô gộp chỉ ghi chữ ở cột đầu).
export function timTieuDeLuong(hang) {
  for (let i = 0; i < Math.min(hang.length, 25); i++) {
    const r = hang[i] || []
    const cs = r.map(C)
    if (!cs.some(t => /HOVATEN|HOTEN/.test(t)) || !cs.some(t => /TONGTHUNHAP|THUCLANH|THUCLINH/.test(t))) continue
    const duoi = hang[i + 1] || []
    const coTangDuoi = duoi.some(o => typeof o === 'string' && /[A-Za-zÀ-ỹ]/.test(o))
    const rong = Math.max(r.length, duoi.length)
    const nhan = []
    let cha = ''
    for (let c = 0; c < rong; c++) {
      const tren = C(r[c]), con = coTangDuoi ? C(duoi[c]) : ''
      if (tren) cha = tren
      else if (!con) cha = ''                       // hết nhóm
      nhan.push(con ? `${cha}|${con}` : tren)
    }
    const cot = {}
    nhan.forEach((t, c) => { if (!t) return; for (const [k, dk] of COT) if (cot[k] == null && dk(t)) { cot[k] = c; break } })
    if (cot.ten == null) continue
    return { dong: coTangDuoi ? i + 1 : i, cot, nhan }
  }
  return null
}

// Tháng / năm của sheet: ô "Tháng" rồi số ở ô sau ("Tháng | 1 | Năm | 2026"), hoặc chữ "THÁNG 01/2026", hoặc tên sheet
// ("LT1", "T01", "Tháng 1").
export function thangCuaSheetLuong(sheet) {
  let thang = null, nam = null
  for (const r of (sheet.hang || []).slice(0, 12)) {
    for (let c = 0; c < (r || []).length; c++) {
      const t = C(r[c])
      const sau = (r.slice(c + 1).find(x => x != null && String(x).trim() !== ''))
      if (t === 'THANG' && thang == null && Number(sau) >= 1 && Number(sau) <= 12) thang = Number(sau)
      if (t === 'NAM' && nam == null && Number(sau) > 2000) nam = Number(sau)
      const m = String(r[c] ?? '').match(/TH[ÁA]NG\s*(\d{1,2})\s*[/.-]\s*(20\d\d)/i)
      if (m && thang == null) { thang = +m[1]; nam = nam ?? +m[2] }
    }
  }
  if (thang == null) {
    const m = String(sheet.ten || '').match(/(?:^|[^0-9])(\d{1,2})$/)
    if (m && +m[1] >= 1 && +m[1] <= 12) thang = +m[1]
  }
  return { thang, nam }
}

const coBangLuong = hang => hang.slice(0, 15).some(r => (r || []).some(o => /THANHTOANTIENLUONG|BANGLUONG/.test(C(o))))

// Một sheet bảng lương → { thang, nam, sheet, nguoi: [...], tong } ; không phải bảng lương → null
export function docSheetLuong(sheet, { namMacDinh = null } = {}) {
  const hang = sheet.hang || []
  if (!coBangLuong(hang)) return null
  const td = timTieuDeLuong(hang)
  if (!td) return null
  const { thang, nam } = thangCuaSheetLuong(sheet)
  const g = (r, k) => (td.cot[k] == null ? null : soO(r[td.cot[k]]))
  const nguoi = []
  for (let i = td.dong + 1; i < hang.length; i++) {
    const r = hang[i] || []
    const ten = String(r[td.cot.ten] ?? '').trim()
    // Dòng tổng cộng: chữ "Tổng cộng" có khi nằm ở cột STT chứ không ở cột họ tên (file thật 127HOME) → dừng
    if (r.slice(0, td.cot.ten + 1).some(o => /^\s*(T[ỔO]NG|C[ỘO]NG)/i.test(String(o ?? '')))) break
    if (!ten || /^\d/.test(ten)) continue                          // dòng đánh số / tỷ lệ
    // Khối chữ ký cuối bảng ("Người lập", "Kế toán trưởng", "Giám đốc") không phải người lao động
    if (/^(NG[ƯU][ỜO]I L[ẬA]P|K[ẾE] TO[ÁA]N|GI[ÁA]M [ĐD][ỐO]C|TH[ỦU] TR[ƯU][ỞO]NG|NG[ƯU][ỜO]I NH[ẬA]N)/i.test(ten)) break
    const p = { ten, mst: td.cot.mst != null ? mstO(r[td.cot.mst]) : '', tongThuNhap: g(r, 'tongThuNhap'), tnct: g(r, 'tnct'), tnTinhThue: g(r, 'tnTinhThue'),
      thue: g(r, 'thue'), bhxhNld: g(r, 'bhxhNld'), luongDongBh: g(r, 'luongDongBh'), thucLanh: g(r, 'thucLanh') }
    if (![p.tongThuNhap, p.tnct, p.thucLanh, p.luongDongBh].some(v => v)) continue   // dòng trống chỉ có tên mẫu
    nguoi.push(p)
  }
  const sum = k => nguoi.reduce((s, p) => s + (p[k] || 0), 0)
  return {
    sheet: sheet.ten, thang, nam: nam ?? namMacDinh, nguoi, cot: Object.keys(td.cot),
    tong: { soNguoi: nguoi.length, tongThuNhap: sum('tongThuNhap'), tnct: td.cot.tnct != null ? sum('tnct') : null, thue: td.cot.thue != null ? sum('thue') : null,
      luongDongBh: td.cot.luongDongBh != null ? sum('luongDongBh') : null, soNguoiDongBh: nguoi.filter(p => (p.bhxhNld || 0) > 0 || (p.luongDongBh || 0) > 0).length },
  }
}

export const docBangLuong = (sheets, opt) => sheets.map(s => docSheetLuong(s, opt)).filter(b => b && b.thang)

// ── C12 ──────────────────────────────────────────────────────────────────────

// trang: [[dòng…]] (pdfChu.js layDongPdf). → { ok, thang, nam, soLaoDong, quyLuong } | { ok:false, khongPhai | scan }
export function docC12PdfChu(trang) {
  const dong = trang.flat()
  const chu = dong.join('\n')
  if (!chu.trim()) return { ok: false, scan: true }
  if (!/C12|KẾT QUẢ ĐÓNG BHXH/i.test(chu)) return { ok: false, khongPhai: true }
  const ky = chu.match(/Th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(20\d\d)/i)
  if (!ky) return { ok: false, loi: 'Không thấy tháng của C12' }
  // Số lao động cuối kỳ: dòng "a) … đóng BHXH bắt buộc cho N lao động", không có thì mục "Đ Chuyển kỳ sau / 1 Số lao động"
  let soLaoDong = null
  const a = chu.match(/đóng BHXH bắt buộc cho\s*(\d+)\s*lao động/i)
  if (a) soLaoDong = +a[1]
  else {
    const iD = dong.findIndex(d => /^Đ\s+Chuyển kỳ sau/i.test(d.trim()))
    const d1 = iD >= 0 ? dong.slice(iD + 1).find(d => /^1\s+Số lao động/i.test(d.trim())) : null
    if (d1) soLaoDong = Number((d1.match(/Số lao động\s+(\d+)/i) || [])[1] ?? NaN) || null
  }
  // Quỹ lương phát sinh trong kỳ, cột BHXH (số đầu tiên sau chữ "Quỹ lương")
  const q = dong.find(d => /^2\s+Quỹ lương/i.test(d.trim()))
  const quyLuong = q ? soO((q.match(/Quỹ lương\s+(\(?-?\d[\d.,]*\)?)/i) || [])[1]) : null
  return { ok: true, thang: +ky[1], nam: +ky[2], soLaoDong, quyLuong }
}
