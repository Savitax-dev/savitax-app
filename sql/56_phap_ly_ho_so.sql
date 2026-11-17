-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ PHÁP LÝ — GIAI ĐOẠN 1: hồ sơ, bước xử lý, checklist, công nợ theo đợt (Savitax, 17/11/2026)
-- Kế hoạch: docs/phan-he-phap-ly-ke-hoach.md (mục 3, 4, 8, 9). Đi sau sql/43 (phòng Pháp lý) + sql/44 (2 vai trò).
--
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần vẫn an toàn (if not exists / on conflict do nothing).
-- ⚠ ĐANG THỬ TRÊN DATABASE DEMO — CHƯA chạy production cho tới khi anh duyệt bản hoàn chỉnh.
-- ⚠ BẢN CLONE (ABS, NYD, Linh Phong…) KHÔNG chạy file này (phân hệ chỉ của Savitax).
--
-- BẢO MẬT: mọi bảng legal_* bật RLS và KHÔNG có policy nào → khoá anon / authenticated hoàn toàn; chỉ máy chủ
-- (service_role, qua app/api/admin/phaply/**) đọc ghi được. Cố ý khác khuôn sql/06 (policy allow_authenticated)
-- vì phân hệ này sẽ giữ CCCD khách hàng (giai đoạn 2).
-- File KHÔNG đụng dữ liệu kế toán / HCNS đang chạy: chỉ tạo bảng mới + thêm quyền.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Pháp nhân — doanh nghiệp / hộ / chi nhánh được làm thủ tục (có thể CHƯA có MST lúc nhận hồ sơ).
--    Giai đoạn 2 thêm cột (địa chỉ tách phường/xã, vốn, ngành nghề, người…) — đừng dồn vào đây trước.
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists legal_entities (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null default '1tv'
                   check (entity_type in ('1tv','2tv','cp','hkd','chi_nhanh','vpdd','ddkd','khac')),
  name             text not null default '',      -- tên doanh nghiệp (dự kiến hoặc đã đăng ký), chữ in hoa
  tax_code         text,                          -- MST / mã số doanh nghiệp (trống khi chưa có)
  address          text,
  phone            text,
  email            text,
  linked_client_id uuid references clients(id) on delete set null,  -- trùng khách kế toán đang phục vụ
  created_by       uuid references staff(id) on delete set null,
  created_at       timestamptz default now()
);
create index if not exists legal_entities_tax_idx on legal_entities (tax_code);

-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- 2. Hồ sơ — một vụ việc cho một pháp nhân. Mã PL-YYMM-NN sinh ở máy chủ theo giờ VN.
--    stage: 1 Tiếp nhận … 10 Đóng (lib/phaply/hoSo.js). wait_state: đang kẹt ở ai (tách khỏi bước).
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists legal_cases (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  procedure_code      text not null,               -- tlm | thay_doi | tam_ngung | … (lib/phaply/hoSo.js)
  entity_type         text not null default '1tv',
  entity_id           uuid references legal_entities(id) on delete set null,
  title               text not null default '',    -- tên hiển thị, VD "Thành lập mới — CÔNG TY TNHH X"
  contact_name        text,                        -- người liên hệ của khách
  contact_phone       text,
  contact_email       text,
  source              text not null default 'moi' check (source in ('moi','khach_cu','kinh_doanh','gioi_thieu','khac')),
  from_sales_quote_id uuid,                        -- báo giá Phòng Kinh doanh (không khoá ngoại: bản clone không có bảng)
  stage               int  not null default 1 check (stage between 1 and 10),
  wait_state          text check (wait_state in ('khach','so','thue','bo_sung')),
  assigned_to         uuid references staff(id) on delete set null,   -- nhân viên phụ trách chính
  received_by         uuid references staff(id) on delete set null,
  received_at         date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  due_at              date,                        -- hạn nội bộ (ngày nhận + số ngày của thủ tục, bỏ chủ nhật)
  closed_at           timestamptz,
  closed_by           uuid references staff(id) on delete set null,
  close_note          text,                        -- lý do đóng khi còn nợ / mở lại
  note                text,
  is_deleted          boolean not null default false,  -- xoá mềm (trưởng phòng), giữ mã đã phát
  created_by          uuid references staff(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create unique index if not exists legal_cases_code_uniq on legal_cases (code);
create index if not exists legal_cases_assigned_idx on legal_cases (assigned_to) where not is_deleted;
create index if not exists legal_cases_stage_idx on legal_cases (stage) where not is_deleted;

-- Nhật ký chuyển bước / đổi trạng thái chờ / giao lại người phụ trách
create table if not exists legal_case_stage_log (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references legal_cases(id) on delete cascade,
  kind        text not null default 'stage' check (kind in ('stage','wait','assign','create','close','reopen','edit')),
  from_value  text,
  to_value    text,
  note        text,
  created_by  uuid references staff(id) on delete set null,
  created_at  timestamptz default now()
);
create index if not exists legal_case_stage_log_case_idx on legal_case_stage_log (case_id, created_at);

create table if not exists legal_case_notes (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references legal_cases(id) on delete cascade,
  body        text not null,
  created_by  uuid references staff(id) on delete set null,
  created_at  timestamptz default now()
);
create index if not exists legal_case_notes_case_idx on legal_case_notes (case_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- 3. Checklist — mẫu theo thủ tục (trưởng phòng sửa ở /phaply/mau), sinh ra việc thật khi tạo hồ sơ.
--    Xoá mẫu = is_active=false (KHÔNG xoá cứng: việc của hồ sơ cũ còn trỏ tới).
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists legal_task_templates (
  id              uuid primary key default gen_random_uuid(),
  procedure_code  text not null,
  sla_days        int  not null default 7,          -- hạn nội bộ: số ngày (bỏ chủ nhật, ngày nhận là ngày 1)
  note            text,
  updated_at      timestamptz default now()
);
create unique index if not exists legal_task_templates_proc_uniq on legal_task_templates (procedure_code);

create table if not exists legal_task_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references legal_task_templates(id) on delete cascade,
  stage        int  not null check (stage between 1 and 10),
  title        text not null,
  sort         int  not null default 0,
  is_active    boolean not null default true
);
create index if not exists legal_task_template_items_tpl_idx on legal_task_template_items (template_id, stage, sort);

create table if not exists legal_case_tasks (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references legal_cases(id) on delete cascade,
  template_item_id  uuid references legal_task_template_items(id) on delete set null,
  stage             int  not null check (stage between 1 and 10),
  title             text not null,
  sort              int  not null default 0,
  done_at           timestamptz,
  done_by           uuid references staff(id) on delete set null
);
create index if not exists legal_case_tasks_case_idx on legal_case_tasks (case_id, stage, sort);

-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- 4. Tiền — TÁCH phí dịch vụ (doanh số) và thu hộ (lệ phí, dấu, chữ ký số… KHÔNG doanh số). Số tiền GỒM VAT.
--    Doanh số = phần dịch vụ ĐÃ THU theo tháng của paid_at (anh chốt 31/10/2026). Thu theo đợt.
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists legal_case_fees (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references legal_cases(id) on delete cascade,
  kind        text not null check (kind in ('dich_vu','thu_ho')),
  name        text not null,
  amount      numeric not null default 0 check (amount >= 0),
  sort        int not null default 0,
  created_at  timestamptz default now()
);
create index if not exists legal_case_fees_case_idx on legal_case_fees (case_id, sort);

-- Lịch thu từng đợt: đến hạn khi hồ sơ sang bước due_stage, hoặc tới ngày due_date.
create table if not exists legal_case_installments (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references legal_cases(id) on delete cascade,
  seq             int  not null default 1,
  name            text not null default '',
  amount_dich_vu  numeric not null default 0 check (amount_dich_vu >= 0),
  amount_thu_ho   numeric not null default 0 check (amount_thu_ho >= 0),
  due_stage       int check (due_stage between 1 and 10),
  due_date        date,
  note            text
);
create index if not exists legal_case_installments_case_idx on legal_case_installments (case_id, seq);

-- Lịch thu mẫu theo thủ tục (100% khi nhận; 50/50…): items = [{ten, pt_dich_vu, pt_thu_ho, due_stage}]
create table if not exists legal_payment_plans (
  id              uuid primary key default gen_random_uuid(),
  procedure_code  text,                 -- trống = dùng cho mọi thủ tục
  name            text not null,
  items           jsonb not null default '[]'::jsonb,
  sort            int not null default 0,
  is_active       boolean not null default true
);

-- Sổ thu GHI NỐI TIẾP. paid_at = ngày khách trả THẬT (bài học ca DT. GROUP bên HCNS). staff_id = người phụ trách
-- hồ sơ LÚC THU (doanh số nhân viên; chuyển hồ sơ cho người khác thì tiền thu trước đó vẫn tính người cũ).
-- Xoá = xoá mềm có lý do (chỉ trưởng phòng), để sổ không mất dấu.
create table if not exists legal_case_payments (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references legal_cases(id) on delete cascade,
  installment_id  uuid references legal_case_installments(id) on delete set null,
  amount_dich_vu  numeric not null default 0 check (amount_dich_vu >= 0),
  amount_thu_ho   numeric not null default 0 check (amount_thu_ho >= 0),
  paid_at         date not null,
  staff_id        uuid references staff(id) on delete set null,
  method          text check (method in ('chuyen_khoan','tien_mat','khac')),
  note            text,
  created_by      uuid references staff(id) on delete set null,
  created_at      timestamptz default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references staff(id) on delete set null,
  delete_reason   text
);
create index if not exists legal_case_payments_case_idx on legal_case_payments (case_id) where deleted_at is null;
create index if not exists legal_case_payments_paid_idx on legal_case_payments (paid_at) where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- 5. RLS bật, KHÔNG policy (chỉ service_role). Grant chỉ cho service_role.
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
alter table legal_entities            enable row level security;
alter table legal_cases               enable row level security;
alter table legal_case_stage_log      enable row level security;
alter table legal_case_notes          enable row level security;
alter table legal_task_templates      enable row level security;
alter table legal_task_template_items enable row level security;
alter table legal_case_tasks          enable row level security;
alter table legal_case_fees           enable row level security;
alter table legal_case_installments   enable row level security;
alter table legal_payment_plans       enable row level security;
alter table legal_case_payments       enable row level security;

grant all privileges on table
  legal_entities, legal_cases, legal_case_stage_log, legal_case_notes, legal_task_templates,
  legal_task_template_items, legal_case_tasks, legal_case_fees, legal_case_installments,
  legal_payment_plans, legal_case_payments
  to service_role;

-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- 6. Quyền — nhóm "Phòng Pháp lý" (kế hoạch mục 9). Gán sẵn CHỈ cho 2 vai trò pháp lý (sql/44); vai trò cũ không
--    được gán gì (tích tay ở "Vai trò & phân quyền" nếu cần). admin luôn đủ.
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
insert into permissions (key, label, group_name) values
  ('view_phaply',            'Vào phân hệ Pháp lý (thấy hồ sơ mình phụ trách + hồ sơ chưa ai nhận)', 'Phòng Pháp lý'),
  ('manage_phaply',          'Tạo / sửa hồ sơ pháp lý, chuyển bước, ghi thu (hồ sơ mình phụ trách)', 'Phòng Pháp lý'),
  ('view_phaply_fee',        'Xem số tiền phí / doanh số hồ sơ pháp lý',                              'Phòng Pháp lý'),
  ('view_phaply_all_staff',  'Xem cả phòng Pháp lý, giao / chuyển hồ sơ, báo cáo phòng',              'Phòng Pháp lý'),
  ('manage_phaply_template', 'Sửa mẫu Pháp lý: checklist, lịch thu mẫu, mẫu giấy tờ, danh mục',        'Phòng Pháp lý'),
  ('close_phaply_case',      'Đóng hồ sơ còn nợ / mở lại hồ sơ đã đóng / xoá khoản thu / xoá hồ sơ',   'Phòng Pháp lý'),
  ('view_phaply_cccd_image', 'Mở ảnh CCCD gốc của hồ sơ pháp lý',                                      'Phòng Pháp lý')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
select 'phaply', key from permissions
 where key in ('view_phaply','manage_phaply','view_phaply_fee','view_phaply_cccd_image')
   and not exists (select 1 from role_permissions x where x.role_id = 'phaply' and x.permission_key = permissions.key);

insert into role_permissions (role_id, permission_key)
select 'phaply_leader', key from permissions
 where key in ('view_phaply','manage_phaply','view_phaply_fee','view_phaply_all_staff','manage_phaply_template',
               'close_phaply_case','view_phaply_cccd_image')
   and not exists (select 1 from role_permissions x where x.role_id = 'phaply_leader' and x.permission_key = permissions.key);

-- Kiểm tra sau khi chạy:
--   select count(*) from information_schema.tables where table_name like 'legal_%';          -- 11
--   select permission_key from role_permissions where role_id like 'phaply%' order by 1;      -- 4 + 7 dòng
