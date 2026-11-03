-- Tiền lương — "KHÔNG ÁP DỤNG THUẾ TNCN" cho từng nhân viên (anh yêu cầu 03/11/2026 — ca Nguyễn Đăng Hiếu).
-- Đi theo LỊCH SỬ LƯƠNG như tham_gia_bhxh / so_nguoi_phu_thuoc: tick ở ô Lương trang Quản lý nhân viên, áp dụng từ tháng
-- của dòng lương. Tick rồi thì thuế TNCN = 0 trên bảng lương, phiếu lương, Excel. Chạy lại nhiều lần vẫn an toàn.
alter table luong_nhan_vien add column if not exists khong_tinh_thue boolean not null default false;

select count(*) filter (where khong_tinh_thue) as so_dong_khong_tinh_thue, count(*) as tong_dong
from luong_nhan_vien;
