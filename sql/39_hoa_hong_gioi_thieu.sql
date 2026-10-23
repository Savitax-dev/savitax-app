-- Phân hệ Tiền lương — HOA HỒNG GIỚI THIỆU KHÁCH (quy tắc anh chốt 22–23/10/2026).
-- Nhân viên đưa công ty về được hoa hồng hằng tháng = % theo bậc (số công ty đang dùng dịch vụ) × tiền khách
-- trả THÊM kể từ lần chốt lương trước (phí kế toán + HCNS + dịch vụ khác + thu nợ tồn, tách VAT ÷ 1,08).
-- Hưởng tới khi công ty ngưng dịch vụ hoặc nhân viên bị vô hiệu hóa. Xoá nợ không phải tiền thu → không hoa hồng.
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần không sao.

-- 1) Ai giới thiệu công ty nào, hưởng từ tháng nào (ngày 01 của tháng).
-- ⚠ KHÔNG đặt khoá ngoại sang staff: clients đã có assigned_to → staff; thêm khoá thứ hai làm mọi câu
--   `clients.select('…, staff(…)')` báo "more than one relationship" → trang khách hàng / công nợ ra 0 công ty
--   (dính thật 23/10/2026 trên production). Cột là uuid trơn; API kiểm nhân viên tồn tại khi ghi.
alter table clients add column if not exists gioi_thieu_boi uuid;
alter table clients drop constraint if exists clients_gioi_thieu_boi_fkey;
alter table clients add column if not exists gioi_thieu_tu  date;
create index if not exists clients_gioi_thieu_idx on clients (gioi_thieu_boi) where gioi_thieu_boi is not null;

-- 2) Bậc hoa hồng: từ N công ty trở lên → x%. Bậc áp cho TOÀN BỘ tiền thu của các công ty người đó giới thiệu.
create table if not exists luong_hoa_hong_bac (
  tu_so_cty int primary key check (tu_so_cty >= 1),
  ty_le     numeric not null check (ty_le > 0 and ty_le <= 100),
  sua_boi   uuid references staff(id) on delete set null,
  sua_luc   timestamptz not null default now()
);

-- 3) Sổ "đã tính hoa hồng tới đâu": ghi khi CHỐT bảng lương tháng (nam, thang); mở chốt xoá ghi nhận tháng đó.
--    Mỗi dòng = một nguồn tiền của một công ty: nguon ketoan | hcns | khach | no_ton (khoá ky = 'YYYY-MM')
--    hoặc dvk (khoá ky = id dòng other_service_payments). so_tien = phần thu thêm đã tính (gồm VAT).
create table if not exists luong_hoa_hong_so (
  id         uuid primary key default gen_random_uuid(),
  nam        int  not null,
  thang      int  not null check (thang between 1 and 12),
  staff_id   uuid references staff(id) on delete set null,     -- người giới thiệu lúc chốt
  client_id  uuid not null references clients(id) on delete cascade,
  nguon      text not null,
  ky         text not null,
  so_tien    numeric not null,
  ty_le      numeric not null,
  hoa_hong   numeric not null,
  tao_luc    timestamptz not null default now(),
  unique (nam, thang, client_id, nguon, ky)
);
create index if not exists luong_hoa_hong_so_client_idx on luong_hoa_hong_so (client_id, nguon, ky);

-- 4) "Đã chuyển lương" (anh chọn: hoa hồng coi là ĐÃ CHI khi kế toán bấm nút này sau khi chuyển khoản).
alter table luong_bang_chot add column if not exists da_chuyen_luong  boolean not null default false;
alter table luong_bang_chot add column if not exists chuyen_luong_luc timestamptz;
alter table luong_bang_chot add column if not exists chuyen_luong_boi uuid references staff(id) on delete set null;

alter table luong_hoa_hong_bac enable row level security;
alter table luong_hoa_hong_so  enable row level security;

select
  (select count(*) from information_schema.columns where table_name = 'clients' and column_name in ('gioi_thieu_boi', 'gioi_thieu_tu')) as cot_clients_2,
  (select count(*) from information_schema.tables where table_name in ('luong_hoa_hong_bac', 'luong_hoa_hong_so')) as bang_2,
  (select count(*) from information_schema.columns where table_name = 'luong_bang_chot' and column_name = 'da_chuyen_luong') as cot_chuyen_luong_1;
