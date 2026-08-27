-- Schema đầy đủ dựng lại từ project Supabase gốc (savitax-app) qua OpenAPI spec của
-- PostgREST — dùng cho các bảng KHÔNG có sẵn CREATE TABLE trong sql/*.sql (được tạo tay
-- qua Dashboard ở project gốc, chưa từng migration hoá). Sinh tự động 2026-07-17.
--
-- GIỚI HẠN: script chỉ lấy được cột/kiểu dữ liệu/default/PK/FK/NOT NULL qua REST API —
-- KHÔNG lấy được: UNIQUE constraint, CHECK constraint, index phụ, trigger, RLS policy chi
-- tiết (RLS bên dưới dựng thủ công theo đúng pattern đã xác nhận ở project gốc).
-- Cần rà soát tay phần còn lại sau khi chạy (đối chiếu logic ứng dụng trong AGENTS.md).
--
-- LƯU Ý: staff.id KHÔNG có default (không tự sinh uuid) — theo quy ước code hiện có,
-- staff.id PHẢI trùng với auth.users.id (Supabase Auth). Thứ tự tạo tài khoản đúng:
-- (1) tạo user qua Supabase Auth trước (Dashboard > Authentication > Add user),
-- (2) copy đúng UUID đó làm id khi insert vào bảng staff.
--
-- CHẠY FILE NÀY: dán vào Supabase Dashboard > SQL Editor > Run (không có kết nối Postgres
-- trực tiếp từ máy dev, theo quy ước AGENTS.md).

create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid not null default gen_random_uuid(),
  name text not null,
  type text not null default 'main'::text
  , primary key (id)
);

create table if not exists roles (
  id text not null,
  label text not null,
  is_system boolean not null default false,
  created_at timestamptz default now()
  , primary key (id)
);

create table if not exists permissions (
  key text not null,
  label text not null,
  group_name text
  , primary key (key)
);

create table if not exists role_permissions (
  role_id text not null,
  permission_key text not null
  , primary key (role_id, permission_key)
  , foreign key (role_id) references roles(id)
  , foreign key (permission_key) references permissions(key)
);

create table if not exists staff (
  id uuid not null,
  room_id uuid,
  full_name text not null,
  email text not null,
  role text not null default 'staff'::text,
  created_at timestamptz default now(),
  is_active boolean not null default true,
  phone text
  , primary key (id)
  , foreign key (room_id) references rooms(id)
);
alter table staff add constraint staff_email_key unique (email);

create table if not exists clients (
  id uuid not null default gen_random_uuid(),
  name text not null,
  tax_code text,
  assigned_to uuid,
  room_id uuid,
  debt_cycle text not null default 'monthly'::text,
  quarter_months integer[],
  is_active boolean default true,
  created_at timestamptz default now(),
  status text default 'active'::text,
  monthly_fee numeric default 0,
  fee_period text default 'monthly'::text,
  address text,
  tax_status text,
  report_type text default 'monthly'::text,
  client_code text,
  representative text,
  other_debt numeric default 0,
  contract_start date
  , primary key (id)
  , foreign key (assigned_to) references staff(id)
  , foreign key (room_id) references rooms(id)
);

create table if not exists client_secondary_staff (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  staff_id uuid not null,
  added_by uuid,
  created_at timestamptz default now()
  , primary key (id)
  , foreign key (client_id) references clients(id)
  , foreign key (staff_id) references staff(id)
  , foreign key (added_by) references staff(id)
);

create table if not exists client_credentials (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  category text not null,
  label text,
  username text,
  password text,
  extra text,
  note text,
  sort_order integer default 0,
  updated_at timestamptz default now(),
  updated_by uuid
  , primary key (id)
  , foreign key (client_id) references clients(id)
);

create table if not exists client_change_log (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  entity text not null,
  entity_label text,
  field text,
  old_value text,
  new_value text,
  action text not null default 'update'::text,
  changed_by uuid,
  changed_at timestamptz default now()
  , primary key (id)
  , foreign key (client_id) references clients(id)
  , foreign key (changed_by) references staff(id)
);

create table if not exists task_definitions (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  deadline_day integer not null,
  sort_order integer default 0,
  applies_to text default 'monthly'::text,
  report_type text default 'monthly'::text,
  is_active boolean default true,
  month integer
  , primary key (id)
);

create table if not exists task_records (
  id uuid not null default gen_random_uuid(),
  client_id uuid,
  task_def_id uuid,
  year integer not null,
  month integer not null,
  is_done boolean default false,
  done_by uuid,
  done_at timestamptz,
  note text
  , primary key (id)
  , foreign key (client_id) references clients(id)
  , foreign key (task_def_id) references task_definitions(id)
  , foreign key (done_by) references staff(id)
);

create table if not exists service_fees (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  year integer not null,
  month integer not null,
  amount numeric not null default 0,
  note text,
  created_by uuid,
  created_at timestamptz default now(),
  type text default 'ketoan'::text
  , primary key (id)
  , foreign key (client_id) references clients(id)
);

create table if not exists debt_records (
  id uuid not null default gen_random_uuid(),
  client_id uuid,
  year integer not null,
  month integer not null,
  amount_due numeric default 0,
  amount_collected numeric default 0,
  is_quarterly_auto boolean default false,
  note text,
  updated_at timestamptz default now(),
  updated_by uuid
  , primary key (id)
  , foreign key (client_id) references clients(id)
  , foreign key (updated_by) references staff(id)
);

create table if not exists debt_rollovers (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  year integer not null,
  month integer not null,
  rolled_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  created_at timestamptz default now()
  , primary key (id)
  , foreign key (client_id) references clients(id)
);

-- Bật RLS + policy "cho phép user đã đăng nhập" — ĐÚNG pattern thật đang dùng ở project
-- gốc (xem sql/fix_staff_clients_rls_recursion.sql): không đệ quy, không phân quyền theo
-- role phức tạp trong policy (vì đọc/ghi nghiệp vụ thật đều đi qua API server-side với
-- service_role key, bỏ qua RLS hoàn toàn) — RLS ở đây chỉ chặn truy cập ẩn danh trực tiếp.
alter table rooms enable row level security;
create policy "allow_authenticated_rooms" on rooms for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table roles enable row level security;
create policy "allow_authenticated_roles" on roles for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table permissions enable row level security;
create policy "allow_authenticated_permissions" on permissions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table role_permissions enable row level security;
create policy "allow_authenticated_role_permissions" on role_permissions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table staff enable row level security;
create policy "allow_authenticated_staff" on staff for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table clients enable row level security;
create policy "allow_authenticated_clients" on clients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table client_secondary_staff enable row level security;
create policy "allow_authenticated_client_secondary_staff" on client_secondary_staff for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table client_credentials enable row level security;
create policy "allow_authenticated_client_credentials" on client_credentials for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table client_change_log enable row level security;
create policy "allow_authenticated_client_change_log" on client_change_log for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table task_definitions enable row level security;
create policy "allow_authenticated_task_definitions" on task_definitions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table task_records enable row level security;
create policy "allow_authenticated_task_records" on task_records for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table service_fees enable row level security;
create policy "allow_authenticated_service_fees" on service_fees for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table debt_records enable row level security;
create policy "allow_authenticated_debt_records" on debt_records for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table debt_rollovers enable row level security;
create policy "allow_authenticated_debt_rollovers" on debt_rollovers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');