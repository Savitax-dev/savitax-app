// Bản rời — thay chữ trong mã màn hình của app LÚC ĐÓNG GÓI (không sửa app). Những câu nói về phạm vi phòng / nhân viên
// phụ trách, phân hệ Tờ khai… chỉ đúng trong app nội bộ; đơn vị khác dùng bản rời đọc vào sẽ khó hiểu (anh duyệt 17/11/2026).
// Mỗi mục phải khớp ĐÚNG MỘT lần — app đổi chữ là scripts/dung-ban-roi.mjs dừng và báo, để sửa danh sách này cho khớp.
//   [file trong repo, chữ gốc (chuỗi hoặc RegExp), chữ thay]
export const VA_CHU = [
  ['components/phanTich/CongTyCuaToi.js',
    'nhan="Công ty trong phạm vi" mau="xanhDuong" phu="Theo công ty phụ trách / phòng"',
    'nhan="Công ty trong danh sách" mau="xanhDuong" phu="Thêm / sửa ở mục Danh sách công ty"'],
  ['components/phanTich/CongTyCuaToi.js', 'phu="Dùng chung với Tờ khai"', 'phu="Trỏ một lần, Soát xét và Rủi ro thuế dùng chung"'],
  ['components/phanTich/CongTyCuaToi.js', 'Không có công ty nào trong phạm vi của anh/chị.', 'Chưa có công ty nào — thêm ở mục Danh sách công ty.'],
  // Cột "Phụ trách" (nhân viên · phòng · vai trò) — bản rời không có nhân viên / phòng
  ['components/phanTich/CongTyCuaToi.js', '<th>Phụ trách</th>', ''],
  ['components/phanTich/CongTyCuaToi.js', /<td className="text-xs text-gray-600">\s*<p>\{c\.nhanVien[\s\S]*?<\/td>/, ''],
  ['components/phanTich/ThanhCongTy.js', ' (dùng chung với Tờ khai)', ''],
  ['components/phanTich/ThanhCongTy.js',
    ' và gỡ khỏi chỗ dùng chung với Tờ khai (để Tờ khai không tạo nhầm thư mục lồng bên trong). Tờ khai của công ty này cần trỏ lại vào thư mục CÔNG TY.',
    '. Nên trỏ thư mục CÔNG TY (thư mục chứa “2. HỒ SƠ KẾ TOÁN”).'],
  ['components/phanTich/ThanhCongTy.js', 'Công ty này không nằm trong phạm vi của anh/chị (hoặc đã ngưng dịch vụ).', 'Không tìm thấy công ty này trong Danh sách công ty (có thể đã xoá).'],
  ['components/phanTich/ThanhCongTy.js', 'App chỉ xin quyền đọc; Tờ khai dùng chung thư mục này.', 'App chỉ xin quyền đọc, không ghi gì vào thư mục.'],
  ['components/phanTich/useHoSoCty.js', '(tầng bộ báo cáo, đủ cho Tờ khai)', '(tầng bộ báo cáo)'],
  ['components/phanTich/useHoSoCty.js', ' Tờ khai vẫn chạy bình thường với thư mục công ty.', ''],
]

// Áp danh sách cho nội dung một file. Trả nội dung mới; mục nào không khớp đúng 1 lần → ném lỗi.
export function apVaChu(tepTuongDoi, noiDung) {
  let ra = noiDung
  for (const [tep, goc, thay] of VA_CHU) {
    if (tep !== tepTuongDoi) continue
    const so = typeof goc === 'string' ? ra.split(goc).length - 1 : (ra.match(new RegExp(goc.source, 'g')) || []).length
    if (so !== 1) throw new Error(`banRoi/vaChu.mjs: "${String(goc).slice(0, 60)}…" khớp ${so} lần trong ${tep} (cần đúng 1) — app đã đổi chữ, sửa lại danh sách.`)
    ra = ra.replace(goc, thay)
  }
  return ra
}
