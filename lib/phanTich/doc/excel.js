// Mở file Excel (.xlsx, .xls) thành mảng hàng cho các bộ đọc thuần (bangKe.js…). Chỉ ĐỌC.
// Dùng thư viện `xlsx` (SheetJS) có sẵn trong dự án — đọc thì được; XUẤT Excel vẫn phải dùng lib/excelDep.js (exceljs).

import * as XLSX from 'xlsx'

// buf: ArrayBuffer | Uint8Array → [{ ten, hang: [[ô…]] }]
export function docExcel(buf) {
  // cellDates: false — ô ngày giữ nguyên SỐ NGÀY Excel, bộ đọc tự đổi (bangKe.js ngayO). Để thư viện đổi ra Date thì
  // lệch theo múi giờ: file thật 127HOME ra 31/03 23:59:56 thay vì 01/04 → ghép hóa đơn trượt cả nghìn dòng (26/10/2026).
  const wb = XLSX.read(buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: 'array', cellDates: false, cellText: false })
  return wb.SheetNames.map(ten => ({
    ten,
    hang: XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: true, defval: null, blankrows: true }),
  }))
}
