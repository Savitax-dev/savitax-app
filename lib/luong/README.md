# Phân hệ Tiền lương — cấu trúc mã theo 3 bước

Anh yêu cầu 18/10/2026: tách mã theo từng bước để dễ sửa, dễ phát triển. Mỗi bước có SQL, thư viện,
route API và giao diện riêng; bước sau chỉ ĐỌC kết quả của bước trước, không sửa ngược.

| Bước | Việc | SQL | Thư viện (`lib/luong/`) | API (`app/api/admin/luong/`) | Giao diện (`components/luong/`) |
|---|---|---|---|---|---|
| 1 | Cấp bậc, lương từng nhân viên, ngày lễ, chấm công | `sql/31_tien_luong.sql` | `ngayCong.js` | `route.js` | `ChamCongCuaToi`, `ChamCongPhong`, `CapBacNgayLe`, `OLuongNhanVien` (ô ở trang Quản lý nhân viên) |
| 2 | Thưởng KPI, thưởng doanh số, thưởng dịch vụ khác, bảng lương | `sql/32_luong_thuong_dvk.sql` | `thuong.js`, `bangLuong.js` | `thuong/route.js` | `ThuongDvk`, `BangLuong` |
| 3 | Khoản trừ, thuế TNCN, phụ cấp / điều chỉnh, chốt bảng lương, xuất Excel | `sql/33_luong_chot.sql`, `sql/34_…`, `sql/35_luong_thue_ngan_hang.sql` | `khauTru.js`, `thueTncn.js`, `chot.js`, `excel.js` | `chot/route.js` | `ThanhChotLuong` |
| 4 | Gửi phiếu lương, nhân viên xác nhận / báo sai | `sql/34_luong_tac_phong_phieu.sql` | — | `phieu/route.js` | `PhieuLuongCuaToi` |
| 5 | File chuyển khoản chi lương hàng loạt (mẫu ngân hàng) | `sql/36_luong_ma_ngan_hang.sql` | `fileChuyenKhoan.js` | (đọc `?viec=luong_nv`) | nút 🏦 ở `ThanhChotLuong` |

Dùng chung: `lib/luong/api.js` (quyền, đọc ngày lễ, kiểm tham số — chỉ máy chủ), `components/luong/chung.js`
(gọi API, màu, hộp thông báo — trình duyệt). Trang `app/luong/page.js` chỉ còn khung + thanh tab.

## Quy tắc đã chốt (đổi gì thì sửa đúng file của bước đó)
- **Ngày công chuẩn** = số ngày của tháng − chủ nhật − ngày lễ; thứ Bảy đủ công (`ngayCong.js`).
- **Bảng lương tháng N** lấy %-công việc **N**, %-công nợ **N−1** (đúng hàm Báo cáo KPI: `lib/kpiTongQuan.js`),
  doanh thu **N** = phí kế toán phải thu của công ty phụ trách chính, chia 1,08 (tách VAT), quý chia 3.
  (Anh đổi 19/10/2026; trước đó là việc N−1 / nợ N−2 / doanh thu N−1.)
- **Thưởng KPI** công việc / công nợ / phòng: dưới 80% → 0; 80–90% → 300.000; trên 90% → 500.000.
- **Thưởng vượt doanh số**: nhân viên (DT − tối thiểu theo cấp) × 20%; trưởng phòng 20% DT công ty tự làm.
- **Thưởng dịch vụ khác**: nhân viên tự khai (số tiền × tỉ lệ), trưởng phòng duyệt; dịch vụ ngoài app bắt buộc ghi chú.
- **Khoản trừ** (chỉ người tham gia BHXH): BHXH 10,5% + KPCĐ 0,5% × lương đóng BHXH + Đoàn phí 40.000.
- **Thuế TNCN** (`thueTncn.js`, anh chốt 20/10/2026 — trước đó không tính): người tham gia BHXH → thu nhập
  tính thuế = tổng thu nhập (lương theo công + mọi thưởng + phụ cấp + điều chỉnh) − 15,5tr − 6,2tr × người phụ
  thuộc − BHXH 10,5% → biểu lũy tiến 5 bậc; người KHÔNG tham gia BHXH (thử việc, học việc) → 10% tổng thu nhập, CỐ Ý không áp mốc 2 triệu của luật (anh
  chốt: khấu trừ mọi khoản cho chắc). Lương từng người do công ty nhập tay theo năng lực, không tự gán.
  Thực lĩnh = thu nhập − BHXH − KPCĐ − Đoàn phí − thuế. Số người phụ thuộc đi theo lịch sử lương
  (`luong_nhan_vien.so_nguoi_phu_thuoc`); tài khoản nhận lương một dòng mỗi người (`luong_ngan_hang`).
- **Tác phong** (19/10/2026): nhân viên tự khai số lần vi phạm cùng ngày công; % của người = 100 − 20 × số lần
  (sàn 0); % tác phong phòng = trung bình cả phòng. **Điểm KPI phòng** = TB(%-việc, %-nợ, %-tác phong) →
  thưởng phòng 0 / 300k / 500k, MỖI người trong phòng nhận đủ. App tự tính, Excel cũng tự tính lại.
- **Phụ cấp / điều chỉnh ngoại lệ**: kế toán nội bộ nhập trên tab Bảng lương (`luong_dieu_chinh`) TRƯỚC khi chốt.
- **Phiếu lương**: chốt → "Gửi nhân viên xác nhận" → mỗi người chỉ thấy phiếu mình (tab Phiếu lương của tôi),
  Xác nhận / Báo sai (ghi chú). Mở chốt = thu hồi phiếu. Gửi lại: ai đã xác nhận mà thực lĩnh không đổi thì giữ.

- **File chuyển khoản** (20/10/2026): đúng 12 cột mẫu ngân hàng anh gửi, tiêu đề ở dòng 1, KHÔNG thêm dòng
  tiêu đề / dòng tổng (ngân hàng từ chối file lạ). Chỉ xuất khi đã chốt; số tiền = thực lĩnh bản chốt; tên chủ TK
  HOA không dấu; mã ngân hàng là mã SỐ theo danh mục ngân hàng chi lương (`luong_ngan_hang.ma_ngan_hang`).
  Thiếu số TK / mã NH hoặc thực lĩnh ≤ 0 thì không vào file, app liệt kê để chuyển tay.

## Bộ kiểm
`node scripts/test-luong-ngay-cong.mjs` · `node --env-file=.env.local scripts/test-luong-thuong.mjs --that`
