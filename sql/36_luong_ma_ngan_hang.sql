-- Phân hệ Tiền lương — mã ngân hàng cho file chuyển khoản chi lương hàng loạt (20/10/2026).
-- Mã là mã SỐ theo danh mục của ngân hàng công ty dùng để chi lương (cột "Mã ngân hàng" trong file mẫu),
-- không phải tên ngân hàng. Kế toán nội bộ nhập ở trang Quản lý nhân viên → ô Lương → Tài khoản nhận lương.
-- Chạy trong Supabase SQL Editor (sau sql/35). Chạy lại nhiều lần không sao.
alter table luong_ngan_hang add column if not exists ma_ngan_hang text;

select count(*) filter (where ma_ngan_hang is not null) as da_co_ma, count(*) as tong_tai_khoan from luong_ngan_hang;
