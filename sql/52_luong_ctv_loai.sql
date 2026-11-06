-- Lương CTV — LOẠI một người khỏi bảng lương CTV (anh yêu cầu 06/11/2026, ca Mai Tiến Chung).
-- Bấm "Loại" ở tab Lương CTV; người bị loại hiện ở dòng "Đã loại" cuối bảng, bấm "Đưa lại" là vào bảng lại.
-- Chạy lại nhiều lần vẫn an toàn.
alter table staff add column if not exists loai_khoi_luong_ctv boolean not null default false;

select count(*) filter (where loai_khoi_luong_ctv) as so_nguoi_da_loai from staff;
