-- Phân hệ TIỀN LƯƠNG — bước 3: CHỐT bảng lương tháng.
-- Dựng 2026-10-18. Chạy MỘT LẦN trong Supabase SQL Editor (sau sql/31, sql/32). Chạy lại không hỏng gì.
--
-- Bảng lương tính từ dữ liệu SỐNG (chấm công, KPI, doanh thu, công nợ) — ai sửa công nợ / tick việc
-- tháng cũ là số đổi theo. Chốt = chụp nguyên bảng lương lúc đó vào `du_lieu`; từ lúc chốt, màn hình
-- và file Excel của tháng đó đọc bản chụp, không tính lại nữa. Mở chốt (bắt buộc lý do) thì tính lại
-- từ dữ liệu sống, chốt lại là chụp bản mới.

create table if not exists luong_bang_chot (
  nam        int  not null,
  thang      int  not null check (thang between 1 and 12),
  du_lieu    jsonb not null,                 -- nguyên kết quả tinhBangLuong lúc chốt
  chot_boi   uuid references staff(id) on delete set null,
  chot_luc   timestamptz not null default now(),
  da_mo      boolean not null default false, -- true = đã mở chốt, màn hình quay về tính sống
  mo_boi     uuid references staff(id) on delete set null,
  mo_luc     timestamptz,
  ly_do_mo   text,
  primary key (nam, thang)
);

alter table luong_bang_chot enable row level security;

select count(*) as so_thang_da_chot from luong_bang_chot;
