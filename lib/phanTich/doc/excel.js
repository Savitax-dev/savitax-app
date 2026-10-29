// Mở file Excel (.xlsx, .xls) thành mảng hàng cho các bộ đọc thuần (bangKe.js…). Chỉ ĐỌC.
// Dùng thư viện `xlsx` (SheetJS) có sẵn trong dự án — đọc thì được; XUẤT Excel vẫn phải dùng lib/excelDep.js (exceljs).

import * as XLSX from 'xlsx'

// Đọc workbook, chịu được file .xls có bản ghi liên kết sang file khác (SupBook) mà TÊN FILE TRỐNG: SheetJS ném
// "Unexpected SupBook type: 0" và bỏ nguyên file (HOANGTIENSG 28/10/2026: cả bảng lương 6 tháng đầu năm thành 0 người).
// Cách vá: đổi bản ghi hỏng sang loại "add-in" (cch = 0x3A01) — SheetJS đọc tới đó là trả ngay, độ dài bản ghi giữ nguyên,
// số liệu trong ô không đụng tới (bản ghi này chỉ dùng để dựng chuỗi công thức trỏ sang file khác) — rồi đọc lại.
// XL: thư viện SheetJS của nơi gọi (truyền vào để mỗi phân hệ dùng đúng bản đã nạp).
export function docWorkbook(XL, u8, opts) {
  try { return XL.read(u8, opts) } catch (e) {
    // CFB: bản .mjs (trình duyệt) có ở ngoài, bản CommonJS (node) chỉ có dưới default
    const CFB = XL.CFB || XL.default?.CFB
    if (!/SupBook/i.test(e?.message || '') || !CFB) throw e
    const cfb = CFB.read(u8, { type: 'array' })
    const luong = CFB.find(cfb, 'Workbook') || CFB.find(cfb, 'Book')
    if (!luong?.content) throw e
    const d = luong.content
    let sua = 0
    for (let i = 0; i + 4 <= d.length;) {
      const loai = d[i] | (d[i + 1] << 8), dai = d[i + 2] | (d[i + 3] << 8)
      if (loai === 0x01AE && dai >= 4 && (d[i + 6] | (d[i + 7] << 8)) === 0) { d[i + 6] = 0x01; d[i + 7] = 0x3A; sua++ }
      i += 4 + dai
    }
    if (!sua) throw e
    return XL.read(new Uint8Array(CFB.write(cfb, { type: 'array' })), opts)
  }
}

// buf: ArrayBuffer | Uint8Array → [{ ten, hang: [[ô…]] }]
export function docExcel(buf) {
  // cellDates: false — ô ngày giữ nguyên SỐ NGÀY Excel, bộ đọc tự đổi (bangKe.js ngayO). Để thư viện đổi ra Date thì
  // lệch theo múi giờ: file thật 127HOME ra 31/03 23:59:56 thay vì 01/04 → ghép hóa đơn trượt cả nghìn dòng (26/10/2026).
  const wb = docWorkbook(XLSX, buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: 'array', cellDates: false, cellText: false })
  return wb.SheetNames.map(ten => ({
    ten,
    hang: XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: true, defval: null, blankrows: true }),
  }))
}
