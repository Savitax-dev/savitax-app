-- ═══════════════════════════════════════════════════════════════════════════════════════
-- MODULE HCNS (Hành chính nhân sự) — Savitax
--
-- Chạy 1 lần trong Supabase SQL Editor của project app.savitax.vn.
-- Chạy lại nhiều lần vẫn an toàn (idempotent: if not exists / on conflict do nothing).
--
-- ⚠ BẢN CLONE (ABS, NYD, Linh Phong...) KHÔNG CHẠY FILE NÀY.
--   Bản clone chỉ lấy phần nghiệp vụ kế toán. Không chạy file này thì module HCNS không tồn
--   tại, menu tự ẩn (do không có permission), và toàn bộ nghiệp vụ kế toán chạy bình thường.
--
-- File này KHÔNG đụng tới dữ liệu kế toán đang có: chỉ tạo bảng mới + thêm đúng 1 cột
-- `clients.uses_hcns` mặc định false (mọi công ty hiện tại giữ nguyên hành vi cũ).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Khách hàng HCNS — cả 3 loại: thời kỳ / thời điểm / vãng lai
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists hcns_clients (
  id                uuid primary key default gen_random_uuid(),
  category          text not null check (category in ('thoi_ky','thoi_diem','vang_lai')),
  name              text not null,

  -- Chỉ dùng cho category='thoi_ky': trỏ về công ty kế toán đã tick "Có sử dụng DV HCNS".
  linked_client_id  uuid references clients(id) on delete cascade,
  client_code       text,

  -- Chỉ dùng cho thời điểm/vãng lai: thông tin công ty để in ĐNTT (thời kỳ lấy từ clients).
  case_code         text,          -- Mã hồ sơ, dùng làm tiền tố nội dung QR
  tax_code          text,
  address           text,
  representative    text,          -- Người đại diện pháp luật
  tax_status        text,
  phone             text,

  -- Nhân viên HCNS phụ trách — ĐỘC LẬP với clients.assigned_to bên kế toán.
  assigned_to       uuid references staff(id) on delete set null,

  -- Phí định kỳ (chỉ dùng cho thời kỳ). ĐÃ GỒM VAT, cùng quy ước với clients.monthly_fee.
  hcns_fee          numeric default 0,
  fee_period        text default 'monthly',
  other_debt        numeric default 0,

  status            text default 'active',
  note              text,
  is_active         boolean default true,   -- soft-delete khi bỏ tick, giữ lịch sử thu cũ
  created_at        timestamptz default now()
);

-- Mỗi công ty kế toán chỉ sinh đúng 1 bản ghi HCNS thời kỳ.
create unique index if not exists hcns_clients_linked_uniq
  on hcns_clients (linked_client_id) where linked_client_id is not null;
create index if not exists hcns_clients_category_idx on hcns_clients (category, is_active);
create index if not exists hcns_clients_assigned_idx on hcns_clients (assigned_to);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tiền đã thu + lịch sử đổi phí của khách thời kỳ
--    type='hcns'     -> tiền đã thu của (year, month)
--    type='fee_plan' -> đánh dấu "từ tháng này trở đi phí = amount" (không phải tiền đã thu)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists hcns_service_fees (
  id              uuid primary key default gen_random_uuid(),
  hcns_client_id  uuid not null references hcns_clients(id) on delete cascade,
  year            integer not null,
  month           integer not null,
  amount          numeric default 0,
  type            text not null default 'hcns' check (type in ('hcns','fee_plan')),
  note            text,
  created_by      uuid references staff(id) on delete set null,
  created_at      timestamptz default now()
);

-- Bắt buộc: route ghi công nợ dùng upsert onConflict theo đúng 4 cột này.
create unique index if not exists hcns_service_fees_uniq
  on hcns_service_fees (hcns_client_id, year, month, type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Cột mới trên bảng công ty kế toán — mặc định TẮT cho mọi công ty hiện có
-- ─────────────────────────────────────────────────────────────────────────────
alter table clients add column if not exists uses_hcns boolean default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Checklist HCNS — mẫu dịch vụ + công việc của từng mẫu
--    is_recurring = true  -> mẫu định kỳ hàng tháng, tự áp cho MỌI khách thời kỳ
--    is_recurring = false -> mẫu theo hồ sơ, chọn khi thêm dịch vụ vào hồ sơ
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists hcns_service_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  is_recurring  boolean not null default false,
  is_active     boolean default true,
  sort_order    integer default 0,
  created_at    timestamptz default now()
);

create table if not exists hcns_service_template_tasks (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references hcns_service_templates(id) on delete cascade,
  name         text not null,
  sort_order   integer default 0,
  -- Soft-delete giống task_definitions: KHÔNG xoá cứng vì các dòng đã tích tham chiếu tới đây.
  is_active    boolean default true,
  created_at   timestamptz default now()
);
create index if not exists hcns_tpl_tasks_idx on hcns_service_template_tasks (template_id, is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Checklist tháng của khách thời kỳ
--    Chỉ tạo dòng khi nhân viên TÍCH lần đầu (giống task_records) — không pre-insert sẵn,
--    danh sách công việc suy ra bằng cách join với hcns_service_template_tasks đang active.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists hcns_recurring_tasks (
  id                uuid primary key default gen_random_uuid(),
  hcns_client_id    uuid not null references hcns_clients(id) on delete cascade,
  template_task_id  uuid not null references hcns_service_template_tasks(id) on delete cascade,
  year              integer not null,
  month             integer not null,
  done              boolean default false,
  done_by           uuid references staff(id) on delete set null,
  done_at           timestamptz
);
create unique index if not exists hcns_recurring_tasks_uniq
  on hcns_recurring_tasks (hcns_client_id, template_task_id, year, month);
create index if not exists hcns_recurring_tasks_period_idx
  on hcns_recurring_tasks (hcns_client_id, year, month);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Dịch vụ trong hồ sơ thời điểm / vãng lai
--    1 hồ sơ (hcns_clients) có thể có NHIỀU dịch vụ chạy song song.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists hcns_case_services (
  id              uuid primary key default gen_random_uuid(),
  hcns_client_id  uuid not null references hcns_clients(id) on delete cascade,
  template_id     uuid not null references hcns_service_templates(id),
  -- Chi phí ĐÃ GỒM VAT (thống nhất với clients.monthly_fee và hcns_clients.hcns_fee).
  -- ĐNTT chia 1.08 khi in ra dòng B, rồi cộng VAT 8% chung ở cuối phiếu.
  cost            numeric default 0,
  received_at     date,          -- Thời gian nhận hồ sơ
  expected_at     date,          -- Thời gian dự kiến trả kết quả
  status          text not null default 'thu_thap'
                  check (status in ('thu_thap','trinh_ky','nop_ho_so','tra_ket_qua','hoan_thanh')),
  note            text,
  created_at      timestamptz default now()
);
create index if not exists hcns_case_services_client_idx on hcns_case_services (hcns_client_id);
create index if not exists hcns_case_services_status_idx on hcns_case_services (status);
create index if not exists hcns_case_services_received_idx on hcns_case_services (received_at);

-- Nhật ký đổi trạng thái: ghi 1 dòng mỗi lần status đổi (ai đổi, lúc nào).
create table if not exists hcns_case_service_status_log (
  id               uuid primary key default gen_random_uuid(),
  case_service_id  uuid not null references hcns_case_services(id) on delete cascade,
  status           text not null,
  changed_by       uuid references staff(id) on delete set null,
  changed_at       timestamptz default now()
);
create index if not exists hcns_status_log_idx on hcns_case_service_status_log (case_service_id, changed_at desc);

-- Checklist thực tế của 1 dịch vụ trong hồ sơ (sinh đủ dòng khi thêm dịch vụ vào hồ sơ).
create table if not exists hcns_case_service_tasks (
  id                uuid primary key default gen_random_uuid(),
  case_service_id   uuid not null references hcns_case_services(id) on delete cascade,
  template_task_id  uuid not null references hcns_service_template_tasks(id),
  done              boolean default false,
  done_by           uuid references staff(id) on delete set null,
  done_at           timestamptz
);
create unique index if not exists hcns_case_service_tasks_uniq
  on hcns_case_service_tasks (case_service_id, template_task_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS — theo đúng quy ước sẵn có của dự án.
--    Mọi đọc/ghi nghiệp vụ đi qua route API dùng service_role key (bỏ qua RLS);
--    policy "allow_authenticated" chỉ là lớp chặn cơ bản cho anon key ở trình duyệt.
-- ─────────────────────────────────────────────────────────────────────────────
-- Viết tường minh từng bảng (KHÔNG dùng vòng lặp động) để trình kiểm tra của Supabase SQL Editor
-- nhìn thấy được là đã bật RLS — nếu viết bằng execute format() trong khối do $$ ... $$ thì
-- Supabase không phân tích được và sẽ cảnh báo nhầm "creates tables without enabling RLS".
alter table hcns_clients                 enable row level security;
alter table hcns_service_fees            enable row level security;
alter table hcns_service_templates       enable row level security;
alter table hcns_service_template_tasks  enable row level security;
alter table hcns_recurring_tasks         enable row level security;
alter table hcns_case_services           enable row level security;
alter table hcns_case_service_status_log enable row level security;
alter table hcns_case_service_tasks      enable row level security;

-- Tạo policy nếu chưa có. Dùng kiểm tra pg_policies thay cho "drop policy if exists" để file
-- KHÔNG chứa lệnh xoá nào — vừa chạy lại được nhiều lần, vừa không bị cảnh báo "destructive".
do $$
declare t text;
begin
  foreach t in array array[
    'hcns_clients','hcns_service_fees','hcns_service_templates','hcns_service_template_tasks',
    'hcns_recurring_tasks','hcns_case_services','hcns_case_service_status_log','hcns_case_service_tasks'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'allow_authenticated_' || t
    ) then
      execute format(
        'create policy "allow_authenticated_%s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
        t, t);
    end if;
  end loop;
end $$;

-- GRANT: bảng tạo bằng SQL Editor KHÔNG tự có grant (xem sql/05_grants.sql).
grant all privileges on table
  hcns_clients, hcns_service_fees, hcns_service_templates, hcns_service_template_tasks,
  hcns_recurring_tasks, hcns_case_services, hcns_case_service_status_log, hcns_case_service_tasks
  to service_role, authenticated;
grant select on table
  hcns_clients, hcns_service_fees, hcns_service_templates, hcns_service_template_tasks,
  hcns_recurring_tasks, hcns_case_services, hcns_case_service_status_log, hcns_case_service_tasks
  to anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Phòng HCNS
--    Là 1 dòng rooms thật để gán staff.room_id, nhưng type='hcns' để loại khỏi mọi bảng
--    xếp hạng/KPI của phòng nghiệp vụ (giống cách type='remote' đã bị loại).
-- ─────────────────────────────────────────────────────────────────────────────
insert into rooms (name, type)
select 'HCNS', 'hcns'
where not exists (select 1 from rooms where type = 'hcns');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Vai trò & phân quyền
-- ─────────────────────────────────────────────────────────────────────────────
insert into roles (id, label, is_system) values
  ('hcns',        'HCNS',              false),
  ('hcns_leader', 'Trưởng phòng HCNS', false)
on conflict (id) do nothing;

insert into permissions (key, label, group_name) values
  ('view_hcns',            'Xem trang Phòng HCNS',                                 'Phòng HCNS'),
  ('manage_hcns',          'Thêm/sửa khách & hồ sơ HCNS, cập nhật công nợ HCNS',   'Phòng HCNS'),
  ('manage_hcns_template', 'Quản lý Checklist HCNS (mẫu dịch vụ & công việc)',     'Phòng HCNS'),
  ('view_hcns_all_staff',  'Xem báo cáo toàn phòng HCNS & gán nhân viên phụ trách','Phòng HCNS')
on conflict (key) do nothing;

-- Nhân viên HCNS: xem + thao tác nghiệp vụ của mình.
insert into role_permissions (role_id, permission_key)
select 'hcns', key from permissions where key in ('view_hcns','manage_hcns')
on conflict do nothing;

-- Trưởng phòng HCNS: đủ 4 quyền.
insert into role_permissions (role_id, permission_key)
select 'hcns_leader', key from permissions
where key in ('view_hcns','manage_hcns','manage_hcns_template','view_hcns_all_staff')
on conflict do nothing;

-- Vai trò admin có is_system=true nên luôn full quyền, KHÔNG cần gán gì thêm.

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Mẫu checklist định kỳ "DV HCNS Thời Kỳ"
--     Tạo sẵn mẫu rỗng — danh sách công việc cụ thể nhập ở trang /hcns/checklist
--     (anh gửi file danh sách sau, không cần chạy lại SQL này).
-- ─────────────────────────────────────────────────────────────────────────────
insert into hcns_service_templates (name, is_recurring, sort_order)
select 'DV HCNS Thời Kỳ', true, 0
where not exists (select 1 from hcns_service_templates where is_recurring = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiểm tra sau khi chạy — cả 4 dòng phải trả về đúng như ghi chú bên cạnh.
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) from information_schema.tables
--   where table_schema='public' and table_name like 'hcns_%';                    -- 8
-- select count(*) from information_schema.columns
--   where table_name='clients' and column_name='uses_hcns';                      -- 1
-- select count(*) from permissions where group_name='Phòng HCNS';                -- 4
-- select name, type from rooms where type='hcns';                                -- HCNS
