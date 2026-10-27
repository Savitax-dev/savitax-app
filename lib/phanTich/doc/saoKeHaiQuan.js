// Đếm giao dịch sao kê ngân hàng + tờ khai hải quan theo tháng — màn "Tăng trưởng & phí" (kế hoạch mục 3b).
// Hàm thuần, nhận mảng hàng của sheet (excel.js docExcel).
//
// Sao kê (mẫu Vietinbank eFAST thật của 127HOME, 26/10/2026): phần đầu là thông tin tài khoản, rồi bảng giao dịch
// mỗi dòng có ngày "01-07-2026 10:00:44". File tên "T07" lại chạy 30/06 → 15/07 → ĐẾM THEO NGÀY TỪNG DÒNG, không theo
// tên file; hai file chồng ngày thì bỏ trùng theo nội dung dòng.
// Tờ khai hải quan (Excel tải từ hệ thống VNACCS): "Số tờ khai | 106817379210", "Ngày đăng ký | 19/12/2024 09:44:32".
// Đếm theo SỐ tờ khai (không theo số file), quý theo NGÀY ĐĂNG KÝ.

const NGAY = /(?:^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](20\d\d)(?:\D|$)/

function ngayTuO(o) {
  if (o == null || o === '') return null
  if (typeof o === 'number' && o > 30000 && o < 80000) {          // số ngày Excel
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(o + 1e-6) * 864e5)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const m = String(o).match(NGAY)
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
const coSoTien = r => r.some(o => (typeof o === 'number' && Math.abs(o) >= 1000) || /^\s*-?[\d.,]{4,}\s*$/.test(String(o ?? '')))

// Một sheet sao kê → { giaoDich: [{ ngay, khoa }] }. Dòng giao dịch = có ngày ở 3 ô đầu có nội dung + có số tiền.
// Bỏ phần thông tin tài khoản phía trên ("Chu kỳ yêu cầu 2026-06-30 - 2026-07-15" không có số tiền đi kèm theo kiểu này).
export function demSaoKe(sheet) {
  const giaoDich = []
  for (const r of sheet.hang || []) {
    const o = (r || []).filter(x => x != null && String(x).trim() !== '')
    if (o.length < 4) continue
    const ngay = o.slice(0, 3).map(ngayTuO).find(Boolean)
    if (!ngay || !coSoTien(o)) continue
    if (o.some(x => /T[ỔO]NG|S[ỐO] D[ƯU]/i.test(String(x)) && String(x).length < 40)) continue   // dòng tổng / số dư
    giaoDich.push({ ngay, khoa: o.map(x => String(x).trim()).join('|') })
  }
  return { giaoDich }
}
export const docSaoKe = sheets => sheets.flatMap(s => demSaoKe(s).giaoDich)

// Một file tờ khai hải quan → [{ so, ngay, loai: 'nhap'|'xuat' }] (một file có thể là 1 tờ khai).
export function docToKhaiHaiQuan(sheets) {
  const ra = new Map()
  for (const s of sheets) {
    let so = null, ngay = null, loai = null
    for (const r of (s.hang || []).slice(0, 60)) {
      const o = (r || []).map(x => (x == null ? '' : String(x).trim()))
      const tieuDe = o.join(' ')
      if (!loai && /T[ờo] khai h[àa]ng h[óo]a nh[ậa]p kh[ẩa]u/i.test(tieuDe)) loai = 'nhap'
      if (!loai && /T[ờo] khai h[àa]ng h[óo]a xu[ấa]t kh[ẩa]u/i.test(tieuDe)) loai = 'xuat'
      for (let i = 0; i < o.length; i++) {
        if (!so && /^S[ốo] t[ờo] khai$/i.test(o[i])) { const v = o.slice(i + 1).find(Boolean); if (/^\d{10,12}$/.test(v || '')) so = v }
        if (!ngay && /^Ng[àa]y [đd][ăa]ng k[ýy]$/i.test(o[i])) ngay = ngayTuO(o.slice(i + 1).find(Boolean))
      }
      if (so && ngay) break
    }
    if (so && !ra.has(so)) ra.set(so, { so, ngay, loai })
  }
  return [...ra.values()]
}

// Số tờ khai từ TÊN FILE ("1ToKhaiHQ7N_QDTQ_106817379210.xlsx") — để nhận file PDF / file không đọc được nội dung
export const soToKhaiTuTen = ten => (String(ten).match(/(?:^|\D)((?:10|30)\d{10})(?:\D|$)/) || [])[1] || null
