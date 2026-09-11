-- ═══════════════════════════════════════════════════════════════════════════════════════
-- MODULE PHÒNG KINH DOANH (Khách tiềm năng + Báo giá) — Savitax
--
-- Chạy 1 lần trong Supabase SQL Editor của project app.savitax.vn.
-- Chạy lại nhiều lần vẫn an toàn (idempotent: if not exists / on conflict do nothing).
--
-- ⚠ BẢN CLONE (ABS, NYD, Linh Phong...) KHÔNG CHẠY FILE NÀY.
--   Không chạy thì module không tồn tại, menu "Phòng Kinh doanh" tự ẩn (không có permission),
--   nghiệp vụ kế toán chạy bình thường.
--
-- File này KHÔNG đụng tới bảng/dữ liệu kế toán: chỉ tạo bảng mới `sales_*`, 2 vai trò, 3 quyền,
-- danh mục kênh. Không thêm cột nào vào `clients`. Code cũ không đọc tới những thứ này nên chạy
-- TRƯỚC khi deploy cũng không ảnh hưởng gì. Phòng "Kinh doanh" tách sang sql/14_sales_room.sql.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Danh mục kênh truyền thông khách đến (sửa được trên app, không cần chạy lại SQL)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists sales_channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);
create unique index if not exists sales_channels_name_uniq on sales_channels (lower(name));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Khách tiềm năng
--    stage: moi → tu_van → bao_gia → gui_hd → chot   |   that_bai (bắt buộc lost_reason)
--    Lập báo giá / đổi trạng thái hợp đồng tự đẩy stage đi TIẾN, không bao giờ tự lùi.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists sales_leads (
  id                uuid primary key default gen_random_uuid(),
  company_name      text,
  contact_name      text,
  phone             text,
  email             text,
  tax_code          text,
  -- Bản chuẩn hoá để dò trùng (API tự ghi): phone_norm = chỉ số, +84/84 → 0;
  -- tax_norm = chỉ số, BỎ SỐ 0 ĐẦU (hộ KD 12 số hay bị thừa một số 0 — bẫy đã làm sót khách).
  phone_norm        text,
  tax_norm          text,
  address           text,
  need              text,           -- ke_toan | hcns | thanh_lap | dich_vu_le | khac
  channel_id        uuid references sales_channels(id) on delete set null,
  source_note       text,           -- chiến dịch / bài đăng / tên người giới thiệu
  assigned_to       uuid references staff(id) on delete set null,
  stage             text not null default 'moi'
                    check (stage in ('moi','tu_van','bao_gia','gui_hd','chot','that_bai')),
  lost_reason       text,
  next_follow_up    date,           -- ngày hẹn chăm sóc tiếp
  note              text,
  created_by        uuid references staff(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  stage_changed_at  timestamptz default now(),
  is_deleted        boolean default false
);
create index if not exists sales_leads_stage_idx    on sales_leads (stage) where is_deleted = false;
create index if not exists sales_leads_assigned_idx on sales_leads (assigned_to);
create index if not exists sales_leads_follow_idx   on sales_leads (next_follow_up) where is_deleted = false;
create index if not exists sales_leads_phone_idx    on sales_leads (phone_norm);
create index if not exists sales_leads_tax_idx      on sales_leads (tax_norm);
create index if not exists sales_leads_created_idx  on sales_leads (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Nhật ký chăm sóc (mỗi lần gọi / nhắn / gặp) + dòng hệ thống tự ghi (đổi giai đoạn...)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists sales_lead_activities (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references sales_leads(id) on delete cascade,
  kind            text not null default 'goi'
                  check (kind in ('goi','zalo','gap','email','khac','he_thong')),
  content         text,
  next_follow_up  date,
  created_by      uuid references staff(id) on delete set null,
  created_at      timestamptz default now()
);
create index if not exists sales_lead_activities_lead_idx on sales_lead_activities (lead_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Báo giá
--    Số báo giá DDMMNN (NN = thứ tự trong ngày) KHÔNG có năm → 300801 của 2026 và 2027 trùng
--    chữ. Vì vậy khoá duy nhất là (quote_date, seq), sinh ở server lúc lưu.
--    fees = ảnh chụp kết quả tính lúc lập, để in lại về sau vẫn đúng dù biểu phí đã đổi.
--    price_status: ok (đúng biểu phí) | pending (chờ Giám đốc duyệt) | approved | rejected
--    contract_status: draft (Chưa gửi) | sent (Đã gửi HĐ) | signed (Chốt HĐ)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists sales_quotes (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid references sales_leads(id) on delete set null,
  quote_date           date not null,
  seq                  integer not null,
  quote_no             text not null,
  author_id            uuid references staff(id) on delete set null,
  author_name          text,
  company_name         text,
  tax_code             text,
  survey               jsonb not null default '{}'::jsonb,
  fees                 jsonb not null default '{}'::jsonb,
  standard_monthly     numeric default 0,
  monthly_final        numeric default 0,
  override_on          boolean default false,
  override_amount      numeric,
  override_reason      text,
  price_status         text not null default 'ok'
                       check (price_status in ('ok','pending','approved','rejected')),
  reviewed_by          uuid references staff(id) on delete set null,
  reviewed_at          timestamptz,
  review_note          text,
  contract_status      text not null default 'draft'
                       check (contract_status in ('draft','sent','signed')),
  contract_changed_at  timestamptz,
  drive_folder_id      text,
  drive_folder_url     text,
  drive_quote_file_id  text,
  drive_survey_file_id text,
  survey_file_name     text,
  is_deleted           boolean default false,   -- xoá mềm: số báo giá đã phát không bao giờ dùng lại
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create unique index if not exists sales_quotes_day_seq_uniq on sales_quotes (quote_date, seq);
create index if not exists sales_quotes_lead_idx   on sales_quotes (lead_id);
create index if not exists sales_quotes_date_idx   on sales_quotes (quote_date) where is_deleted = false;
create index if not exists sales_quotes_author_idx on sales_quotes (author_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — theo đúng quy ước sẵn có: mọi đọc/ghi nghiệp vụ đi qua route API dùng service_role
--    key (bỏ qua RLS); policy "allow_authenticated" chỉ là lớp chặn cơ bản cho anon key.
--    Viết tường minh từng bảng để trình kiểm tra của Supabase nhìn thấy đã bật RLS.
-- ─────────────────────────────────────────────────────────────────────────────
alter table sales_channels        enable row level security;
alter table sales_leads           enable row level security;
alter table sales_lead_activities enable row level security;
alter table sales_quotes          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sales_channels','sales_leads','sales_lead_activities','sales_quotes'] loop
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
-- Không grant cho anon: dữ liệu khách tiềm năng có SĐT/email, trình duyệt không cần đọc thẳng.
grant all privileges on table sales_channels, sales_leads, sales_lead_activities, sales_quotes
  to service_role, authenticated;

-- 6. Phòng Kinh doanh: KHÔNG tạo ở đây — xem sql/14_sales_room.sql (chạy SAU khi deploy code).

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Vai trò & phân quyền
-- ─────────────────────────────────────────────────────────────────────────────
insert into roles (id, label, is_system) values
  ('sales',        'Kinh doanh',              false),
  ('sales_leader', 'Trưởng phòng Kinh doanh', false)
on conflict (id) do nothing;

insert into permissions (key, label, group_name) values
  ('view_sales',          'Xem Phòng Kinh doanh, tiếp nhận khách, lập báo giá của mình',   'Phòng Kinh doanh'),
  ('manage_sales_all',    'Sửa mọi khách & báo giá, gán người phụ trách, sửa danh mục kênh','Phòng Kinh doanh'),
  ('approve_sales_quote', 'Duyệt báo giá đề xuất mức phí khác biểu phí (Giám đốc)',        'Phòng Kinh doanh')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key) values
  ('sales',        'view_sales'),
  ('sales_leader', 'view_sales'),
  ('sales_leader', 'manage_sales_all')
on conflict do nothing;

-- Duyệt giá mặc định CHỈ Giám đốc (vai trò admin, is_system=true → luôn full quyền).
-- Muốn giao cho trưởng phòng KD thì tick ở trang "Vai trò & phân quyền", không cần sửa SQL.

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Kênh truyền thông mặc định
-- ─────────────────────────────────────────────────────────────────────────────
-- Zalo tách "Zalo OA" (đứng trên) / "Zalo cá nhân", thêm Email dưới Website (chốt 2026-09-11). Database đã cài bản
-- cũ thì chạy scripts/seed-sales-channels.mjs --apply (đổi tên "Zalo" giữ nguyên id + xếp lại thứ tự).
insert into sales_channels (name, sort_order)
select v.name, v.sort_order from (values
  ('Facebook', 1), ('Zalo OA', 2), ('Zalo cá nhân', 3), ('Website', 4), ('Email', 5), ('TikTok', 6),
  ('Google', 7), ('Hotline', 8), ('Giới thiệu', 9), ('Khách cũ', 10), ('Khác', 99)
) as v(name, sort_order)
where not exists (select 1 from sales_channels c where lower(c.name) = lower(v.name));

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiểm tra sau khi chạy — các dòng phải trả về đúng như ghi chú bên cạnh.
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) from information_schema.tables
--   where table_schema='public' and table_name like 'sales_%';                    -- 4
-- select count(*) from permissions where group_name='Phòng Kinh doanh';          -- 3
-- select count(*) from sales_channels;                                           -- 11
