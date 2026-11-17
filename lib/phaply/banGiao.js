// Phân hệ Pháp lý — bàn giao (bước 9) + điều kiện đóng hồ sơ (bước 10). Hàm THUẦN — kiểm offline scripts/test-phaply-ban-giao.mjs.

// Pháp nhân BÊN GIAO in trên Biên bản bàn giao — đang theo ĐNTT pháp lý (app/api/admin/phaply/ho-so/[id]/dntt). Phòng pháp lý dùng
// pháp nhân khác (VD Denali) thì sửa ở đây.
export const BEN_GIAO = {
  ten: 'Công ty Cổ phần Tư vấn Thuế Savitax',
  dia_chi: '16 Bình Lợi, Phường Bình Lợi Trung, Thành phố Hồ Chí Minh',
  mst: '0313906307',
  dien_thoai: '0989 666 253',
}

// Danh mục bàn giao gợi ý theo thủ tục (nhân viên sửa / thêm / bớt từng hồ sơ)
export const MUC_MAC_DINH = {
  tlm: [
    { ten: 'Giấy chứng nhận đăng ký doanh nghiệp (bản gốc)', so_luong: '01' },
    { ten: 'Con dấu doanh nghiệp', so_luong: '01' },
    { ten: 'Điều lệ công ty (bản gốc)', so_luong: '01' },
    { ten: 'Bộ hồ sơ đăng ký doanh nghiệp đã nộp (bản lưu)', so_luong: '01' },
    { ten: 'Bộ hồ sơ pháp lý ban đầu đã nộp cơ quan thuế (bản lưu)', so_luong: '01' },
  ],
  _: [
    { ten: 'Giấy xác nhận / kết quả thủ tục (bản gốc)', so_luong: '01' },
    { ten: 'Bộ hồ sơ đã nộp (bản lưu)', so_luong: '01' },
  ],
}
export const mucMacDinh = thuTuc => (MUC_MAC_DINH[thuTuc] || MUC_MAC_DINH._).map(m => ({ ...m, ghi_chu: '' }))

// Chuẩn hoá danh mục gửi lên (bỏ dòng trống, cắt độ dài)
export const locMuc = ds => (Array.isArray(ds) ? ds : [])
  .map(m => ({ ten: String(m?.ten || '').trim().slice(0, 300), so_luong: String(m?.so_luong || '').trim().slice(0, 20), ghi_chu: String(m?.ghi_chu || '').trim().slice(0, 200) }))
  .filter(m => m.ten)
  .slice(0, 50)

// Điều kiện đóng hồ sơ (kế hoạch bước 10): thu đủ tiền · có kết quả · đã bàn giao · có bản scan biên bản bàn giao (khi hồ sơ có Drive).
// → [{ k, muc, dat }]. Thiếu điều kiện: nhân viên KHÔNG đóng được; trưởng phòng (close_phaply_case) đóng được kèm lý do.
export function dieuKienDong({ conPhaiThu = 0, coKetQua = false, banGiaoNgay = null, coDrive = false, coScanBanGiao = false }) {
  const ds = [
    { k: 'tien', muc: conPhaiThu > 0 ? `Thu đủ tiền (còn ${Math.round(conPhaiThu).toLocaleString('vi-VN')} đ)` : 'Thu đủ tiền', dat: !(conPhaiThu > 0) },
    { k: 'ket_qua', muc: 'Có kết quả từ cơ quan (một lần nộp ghi "Đạt")', dat: !!coKetQua },
    { k: 'ban_giao', muc: 'Đã bàn giao cho khách (ghi ngày bàn giao)', dat: !!banGiaoNgay },
  ]
  if (coDrive) ds.push({ k: 'scan_bg', muc: 'Có bản scan biên bản bàn giao đã ký (thư mục 8. BÀN GIAO)', dat: !!coScanBanGiao })
  return ds
}
export const thieuDieuKien = ds => ds.filter(d => !d.dat)
