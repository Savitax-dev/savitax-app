-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ PHÁP LÝ — GIAI ĐOẠN 2: dữ liệu pháp nhân (doanh nghiệp, người, vai trò, ngành nghề) + danh mục (Savitax, 17/11/2026)
-- Đi sau sql/56. Chạy lại an toàn. ⚠ Đang thử trên DATABASE DEMO — CHƯA chạy production. Bản clone không chạy.
-- Dữ liệu nhập ở đây dựng lại đúng "hồ sơ đầu vào" của mẫu Word (lib/phaply/word/duLieu.js) — đổi cột thì sửa cả
-- lib/phaply/phapNhan.js (đọc DB → hồ sơ đầu vào). RLS bật, KHÔNG policy (như sql/56): chỉ máy chủ đọc ghi.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Doanh nghiệp — thêm cột (mọi cột null được: nhập dần, "Còn thiếu gì" báo chỗ trống)
alter table legal_entities add column if not exists name_en        text;
alter table legal_entities add column if not exists name_short     text;
alter table legal_entities add column if not exists tru_so_so_nha  text;       -- số nhà, đường, tổ/ấp…
alter table legal_entities add column if not exists tru_so_ma_xa   text;       -- mã xã (danh mục legal_places)
alter table legal_entities add column if not exists tru_so_xa      text;       -- tên phường/xã (chép lúc chọn, in thẳng lên hồ sơ)
alter table legal_entities add column if not exists tru_so_ma_tinh text;
alter table legal_entities add column if not exists tru_so_tinh    text;
alter table legal_entities add column if not exists fax            text;
alter table legal_entities add column if not exists website        text;
alter table legal_entities add column if not exists von_dieu_le    numeric;
alter table legal_entities add column if not exists menh_gia       numeric;    -- công ty cổ phần (mặc định 10.000)
alter table legal_entities add column if not exists so_lao_dong    int;
alter table legal_entities add column if not exists mo_hinh        text;       -- 1TV: chu_tich | hdtv
alter table legal_entities add column if not exists csh_la_to_chuc boolean not null default false;
alter table legal_entities add column if not exists co_ndt_nuoc_ngoai boolean not null default false;
alter table legal_entities add column if not exists phong_dkkd     text;       -- tên Phòng ĐKKD ghi trên hồ sơ (tự điền theo tỉnh, sửa được)
alter table legal_entities add column if not exists co_quan_thue   text;       -- Thuế cơ sở quản lý (tự điền theo xã, sửa được)
alter table legal_entities add column if not exists ma_cqt         text;       -- mã cơ quan thuế trên tờ khai (nếu biết)
alter table legal_entities add column if not exists thue           jsonb not null default '{}'::jsonb;    -- hạch toán, PP GTGT, BHXH, năm TC, ngày bắt đầu
alter table legal_entities add column if not exists so_sach        jsonb not null default '{}'::jsonb;    -- phần mềm, kỳ KT, niên độ đầu, hình thức…
alter table legal_entities add column if not exists khau_hao       text;
alter table legal_entities add column if not exists quy_uoc_phieu  numeric;    -- biên bản họp: x đồng = 1 phiếu
alter table legal_entities add column if not exists dien_thue_san  boolean not null default false;  -- in sẵn MST + cơ quan thuế ở hồ sơ ban đầu
alter table legal_entities add column if not exists updated_at     timestamptz default now();

-- 1b. Hồ sơ — thư mục Drive phòng pháp lý (lib/phaply/drive.js; anh duyệt lưu Drive 17/11/2026)
alter table legal_cases add column if not exists drive_folder_id text;
alter table legal_cases add column if not exists drive_saved_at  timestamptz;

-- 2. Người (khách: chủ sở hữu, thành viên, cổ đông, đại diện, kế toán… — và nhân viên pháp lý Savitax: staff_id)
create table if not exists legal_people (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid references staff(id) on delete cascade,   -- có = hồ sơ cá nhân của nhân viên pháp lý (người được ủy quyền)
  ho_ten          text not null default '',
  gioi_tinh       text check (gioi_tinh in ('Nam','Nữ')),
  ngay_sinh       text,          -- dd/mm/yyyy (in thẳng lên hồ sơ)
  dan_toc         text,
  quoc_tich       text default 'Việt Nam',
  loai_giay_to    text default 'Căn cước công dân',
  so_giay_to      text,
  ngay_cap        text,
  noi_cap         text,
  ngay_het_han    text,
  thuong_tru      jsonb not null default '{}'::jsonb,   -- { so_nha, ma_xa, xa, ma_tinh, tinh, quoc_gia }
  lien_lac        jsonb not null default '{}'::jsonb,   -- như trên; trống = giống thường trú
  dien_thoai      text,
  email           text,
  cccd_front_path text,          -- ảnh CCCD (bucket private phaply-cccd) — giai đoạn 2b
  cccd_back_path  text,
  cccd_doc        jsonb,         -- kết quả đọc CCCD + độ tin cậy
  created_by      uuid references staff(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index if not exists legal_people_staff_uniq on legal_people (staff_id) where staff_id is not null;
create index if not exists legal_people_so_idx on legal_people (so_giay_to);

-- 3. Vai trò của người trong doanh nghiệp (một người nhiều vai trò = nhiều dòng)
create table if not exists legal_entity_people (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references legal_entities(id) on delete cascade,
  person_id      uuid not null references legal_people(id) on delete cascade,
  vai_tro        text not null check (vai_tro in ('dai_dien','giam_doc','chu_so_huu','thanh_vien','co_dong','ke_toan','thu_ky')),
  chuc_danh      text,           -- người đại diện / giám đốc: Giám đốc | Tổng giám đốc | Chủ tịch công ty…
  von_gop        numeric,        -- thành viên (đồng)
  so_co_phan     numeric,        -- cổ đông
  loai_co_phan   text,
  loai_tai_san   text,
  thoi_han_gop   text,
  chu_tich       boolean not null default false,   -- Chủ tịch HĐTV / HĐQT
  thu_tu         int not null default 0,
  created_at     timestamptz default now()
);
create index if not exists legal_entity_people_ent_idx on legal_entity_people (entity_id, vai_tro, thu_tu);

-- 4. Ngành nghề đăng ký
create table if not exists legal_entity_industries (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references legal_entities(id) on delete cascade,
  ma         text not null,      -- mã ngành cấp 4
  ten        text not null,
  chi_tiet   text,               -- "Chi tiết: …" (ghi rõ hoạt động, loại trừ, điều kiện)
  chinh      boolean not null default false,
  thu_tu     int not null default 0
);
create index if not exists legal_entity_industries_ent_idx on legal_entity_industries (entity_id, thu_tu);

-- 5. Danh mục (nạp từ data/phaply/danh-muc bằng scripts/phaply-nap-danh-muc.mjs — anh đã duyệt 01/11 + 17/11/2026)
create table if not exists legal_places (
  ma        text primary key,    -- mã tỉnh 2 số / mã xã 5 số (QĐ 19/2025/QĐ-TTg)
  cap       text not null check (cap in ('tinh','xa')),
  ten       text not null,
  loai      text,                -- tinh | thanh_pho | phuong | xa | dac_khu
  ma_tinh   text,                -- với xã
  ghi_chu   text
);
create index if not exists legal_places_tinh_idx on legal_places (ma_tinh);

create table if not exists legal_tax_offices (
  khoa          text primary key,  -- khoá nội bộ (T79-CS02…)
  ten           text not null,
  cap           text not null,     -- cuc | chi_cuc | tinh | co_so
  ma_tinh       text,
  khoa_cap_tren text,
  ma_cqt        text,              -- mã trên tờ khai (có thể nhiều: "71315; 71317")
  noi_dat_tru_so text
);
create table if not exists legal_place_tax (
  ma_xa     text primary key,      -- xã → Thuế cơ sở quản lý
  khoa_cqt  text not null
);
create table if not exists legal_registries (
  ma_tinh        text primary key,
  ten_ghi_ho_so  text not null,    -- "Phòng Đăng ký kinh doanh Thành phố Hồ Chí Minh" (pháp lý chốt 17/11/2026)
  dia_chi        text,
  dien_thoai     text,
  email          text
);
create table if not exists legal_vsic (
  ma       text primary key,       -- cấp 1 chữ cái / cấp 2-4 số
  cap      int  not null,
  ten      text not null,
  ma_cha   text
);
create index if not exists legal_vsic_cap_idx on legal_vsic (cap);

-- 6. RLS bật, không policy; grant service_role
alter table legal_people            enable row level security;
alter table legal_entity_people     enable row level security;
alter table legal_entity_industries enable row level security;
alter table legal_places            enable row level security;
alter table legal_tax_offices       enable row level security;
alter table legal_place_tax         enable row level security;
alter table legal_registries        enable row level security;
alter table legal_vsic              enable row level security;
grant all privileges on table legal_people, legal_entity_people, legal_entity_industries, legal_places, legal_tax_offices,
  legal_place_tax, legal_registries, legal_vsic to service_role;

-- Kiểm tra: select count(*) from information_schema.tables where table_name like 'legal_%';   -- 19
