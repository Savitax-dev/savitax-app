-- Phân hệ TIỀN LƯƠNG — bước 1: cấp bậc, lương từng nhân viên, ngày lễ, chấm công.
-- Dựng 2026-10-17. Chạy MỘT LẦN trong Supabase SQL Editor. Chạy lại không hỏng gì.
--
-- Module rời như HCNS / Kinh doanh: bản clone không cần thì bỏ file này, app/luong,
-- app/api/admin/luong, lib/luong*.js, components/luong/ và mục menu + cột ở trang Quản lý nhân viên.

-- 1) Quyền (nhóm "Tiền lương").
--    cham_cong      — tự khai ngày công của MÌNH. Gán sẵn cho mọi vai trò bên dưới.
--    view_payroll   — xem cấp bậc, lương, bảng chấm công của cả công ty (ban lãnh đạo, kế toán nội bộ).
--    manage_payroll — thiết lập bảng cấp bậc, lương từng nhân viên, ngày lễ.
--    Hai quyền sau cố ý KHÔNG gán sẵn cho vai trò nào (Quản trị luôn có).
insert into permissions (key, label, group_name) values
  ('cham_cong',      'Chấm công (tự khai ngày công của mình)', 'Tiền lương'),
  ('view_payroll',   'Xem lương, cấp bậc và chấm công toàn công ty', 'Tiền lương'),
  ('manage_payroll', 'Thiết lập cấp bậc, lương nhân viên và ngày lễ', 'Tiền lương')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
select r.id, 'cham_cong' from roles r
where not r.is_system
  and not exists (select 1 from role_permissions x where x.role_id = r.id and x.permission_key = 'cham_cong');

-- 2) Bảng cấp bậc. Đổi số ở đây KHÔNG tự đổi lương người đã gán — lương từng người nằm ở
--    luong_nhan_vien (chụp số lúc gán), để bảng lương tháng cũ không chạy theo.
create table if not exists luong_cap_bac (
  ma                  text primary key,            -- 'CAP_1'…'CAP_8', 'CAP_A'…'CAP_C'
  ten                 text not null,
  nhom                text not null default 'nhan_vien',   -- nhan_vien | truong_phong
  thu_tu              int  not null default 0,
  luong_co_ban        numeric not null default 0,
  doanh_thu_toi_thieu numeric,                     -- trưởng phòng: để trống (không xét doanh số tối thiểu)
  luong_bhxh          numeric,                     -- trống = cấp này chưa đóng BHXH (Cấp 1)
  mo_ta               text,
  updated_at          timestamptz not null default now()
);

-- Số theo bảng anh gửi 14/10/2026. Chạy lại KHÔNG ghi đè số quản trị đã sửa.
insert into luong_cap_bac (ma, ten, nhom, thu_tu, luong_co_ban, doanh_thu_toi_thieu, luong_bhxh, mo_ta) values
  ('CAP_1', 'Cấp 1', 'nhan_vien',    1,  5100000, 23000000, null,    'Dưới 2 tháng'),
  ('CAP_2', 'Cấp 2', 'nhan_vien',    2,  6000000, 27000000, 5310000, 'Dưới 6 tháng'),
  ('CAP_3', 'Cấp 3', 'nhan_vien',    3,  7000000, 32000000, 5310000, 'Trên 6 tháng – dưới 1 năm'),
  ('CAP_4', 'Cấp 4', 'nhan_vien',    4,  7700000, 35200000, 5841000, 'Trên 1 năm – dưới 2 năm'),
  ('CAP_5', 'Cấp 5', 'nhan_vien',    5,  8470000, 38720000, 6425100, 'Trên 2 năm – dưới 3 năm'),
  ('CAP_6', 'Cấp 6', 'nhan_vien',    6,  9317000, 42592000, 7067610, 'Trên 3 năm – dưới 4 năm'),
  ('CAP_7', 'Cấp 7', 'nhan_vien',    7, 10248700, 46851200, 7774371, 'Trên 4 năm – dưới 5 năm'),
  ('CAP_8', 'Cấp 8', 'nhan_vien',    8, 11273570, 51536320, 8551808, 'Trên 5 năm – dưới 6 năm'),
  ('CAP_A', 'Cấp A', 'truong_phong', 11, 10000000, null,    8000000, 'Trưởng phòng'),
  ('CAP_B', 'Cấp B', 'truong_phong', 12, 12000000, null,    8800000, 'Trưởng phòng'),
  ('CAP_C', 'Cấp C', 'truong_phong', 13, 14400000, null,    9680000, 'Trưởng phòng')
on conflict (ma) do nothing;

-- 3) Lương từng nhân viên — LỊCH SỬ. Mỗi lần đổi cấp / đổi lương là một dòng mới "áp dụng từ tháng".
--    Lương của tháng N = dòng có ap_dung_tu lớn nhất mà <= ngày 01 của tháng N.
create table if not exists luong_nhan_vien (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid not null references staff(id) on delete cascade,
  ap_dung_tu          date not null,               -- luôn là ngày 01 của tháng
  cap_bac             text references luong_cap_bac(ma) on delete set null,
  luong_co_ban        numeric not null,
  doanh_thu_toi_thieu numeric,
  luong_bhxh          numeric,
  tham_gia_bhxh       boolean not null default false,   -- nhân viên chính thức có tham gia BHXH
  ghi_chu             text,
  tao_boi             uuid references staff(id) on delete set null,
  tao_luc             timestamptz not null default now(),
  unique (staff_id, ap_dung_tu)
);

-- 4) Ngày nghỉ lễ (trừ khỏi ngày công chuẩn). Riêng của phân hệ lương — bảng tax_holidays của
--    Tờ khai là lịch dời hạn nộp thuế, không phải lịch nghỉ của công ty.
create table if not exists luong_ngay_le (
  ngay  date primary key,
  ten   text not null
);
insert into luong_ngay_le (ngay, ten) values
  ('2026-01-01', 'Tết Dương lịch'),
  ('2026-04-30', 'Ngày Giải phóng miền Nam'),
  ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-09-02', 'Quốc khánh')
on conflict (ngay) do nothing;

-- 5) Chấm công theo tháng. Nhân viên khai rồi bấm xác nhận → khoá. Sai thì trưởng phòng sửa (bắt
--    buộc lý do, ghi vào luong_cham_cong_log).
create table if not exists luong_cham_cong (
  id                uuid primary key default gen_random_uuid(),
  staff_id          uuid not null references staff(id) on delete cascade,
  nam               int  not null,
  thang             int  not null check (thang between 1 and 12),
  ngay_di_lam       numeric not null default 0,
  nghi_phep         numeric not null default 0,
  nghi_khong_luong  numeric not null default 0,
  ngay_cong_chuan   numeric,                       -- chụp lúc xác nhận
  ghi_chu           text,
  trang_thai        text not null default 'nhap',  -- nhap | da_xac_nhan
  xac_nhan_luc      timestamptz,
  updated_at        timestamptz not null default now(),
  unique (staff_id, nam, thang)
);

create table if not exists luong_cham_cong_log (
  id          uuid primary key default gen_random_uuid(),
  cham_cong_id uuid references luong_cham_cong(id) on delete cascade,
  staff_id    uuid references staff(id) on delete set null,
  hanh_dong   text not null,                        -- xac_nhan | sua
  truoc       jsonb,
  sau         jsonb,
  ly_do       text,
  boi         uuid references staff(id) on delete set null,
  luc         timestamptz not null default now()
);

-- Mọi đọc/ghi đi qua API route bằng service role; bật RLS không policy để anon key không đọc được.
alter table luong_cap_bac        enable row level security;
alter table luong_nhan_vien      enable row level security;
alter table luong_ngay_le        enable row level security;
alter table luong_cham_cong      enable row level security;
alter table luong_cham_cong_log  enable row level security;

select (select count(*) from permissions where group_name = 'Tiền lương') as quyen,
       (select count(*) from role_permissions where permission_key = 'cham_cong') as vai_tro_duoc_cham_cong,
       (select count(*) from luong_cap_bac) as cap_bac,
       (select count(*) from luong_ngay_le) as ngay_le;
