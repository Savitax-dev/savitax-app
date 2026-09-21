-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ TỜ KHAI (Thuế điện tử + Dịch vụ công) — Savitax
--
-- Chạy 1 lần trong Supabase SQL Editor của project app.savitax.vn.
-- Chạy lại nhiều lần vẫn an toàn (idempotent: if not exists / on conflict do nothing).
--
-- ⚠ BẢN CLONE (ABS, NYD, Linh Phong...) — chạy được, nhưng chỉ chạy khi thật sự dùng.
--   Không chạy thì phân hệ không tồn tại, menu tự ẩn (không có permission), kế toán chạy bình thường.
--
-- File này KHÔNG đụng tới bảng/dữ liệu kế toán hiện có: chỉ tạo bảng mới `tax_*`, thêm quyền và
-- một cột mã hóa vào `client_credentials`. Code cũ không đọc tới những thứ này nên chạy TRƯỚC khi
-- deploy cũng không ảnh hưởng gì.
--
-- Cơ sở: gói bàn giao PhanHe-ToKhai-Savitax-BanGiao/ + số liệu đo thật trên cổng ngày 18/09/2026,
-- xem docs/phan-he-to-khai-ke-hoach.md. DDL trong gói bàn giao viết theo bảng companies/users/files
-- của một hệ thống khác — ở đây bám đúng clients/staff của app.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Mã hóa mật khẩu đang lưu CHỮ RÕ trong client_credentials
--
--    Hiện có 62 mật khẩu (thuế, hóa đơn, ngân hàng, BHXH…) nằm chữ rõ, API trả về cho MỌI người
--    đã đăng nhập. Thêm cột mã hóa, chuyển dần bằng scripts/migrate-credentials-encrypt.mjs rồi
--    mới xóa cột cũ ở một lần chạy SQL sau — KHÔNG xóa ngay để còn đường lùi.
-- ─────────────────────────────────────────────────────────────────────────────
alter table client_credentials add column if not exists password_enc text;

-- client_change_log đang lưu nguyên văn mật khẩu cũ/mới mỗi lần sửa — tức là một kho mật khẩu thứ
-- hai, còn nguy hiểm hơn vì giữ cả lịch sử. Từ nay API chỉ ghi "đã đổi", không ghi giá trị.
-- Dọn lịch sử cũ (không xóa dòng, chỉ bỏ giá trị) — chạy lại nhiều lần vẫn an toàn:
update client_change_log
   set old_value = case when old_value is null then null else '(đã ẩn)' end,
       new_value = case when new_value is null then null else '(đã ẩn)' end
 where entity = 'credential'
   and field in ('Mật khẩu/PIN', 'password')
   and coalesce(old_value, '') <> '(đã ẩn)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tài khoản cổng thuế của từng công ty (mỗi cổng tối đa 1 bản ghi)
--    100% là tài khoản doanh nghiệp dạng <MST>-QL, không dùng tài khoản đại lý thuế.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_accounts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  portal          text not null check (portal in ('dvc', 'etax')),
  username        text not null,
  password_enc    text not null,              -- AES-256-GCM, xem lib/taxCrypto.js
  status          text not null default 'not_connected'
                  check (status in ('not_connected','active','wrong_password','locked','portal_error','vneid_only')),
  last_success_at timestamptz,
  last_error_code text,
  -- Ủy quyền nằm trong hợp đồng dịch vụ, màn hình KHÔNG hỏi lại; app ghi ngầm để có dấu vết.
  consent_by      uuid references staff(id) on delete set null,
  consent_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  updated_by      uuid references staff(id) on delete set null,
  unique (client_id, portal)
);
create index if not exists tax_accounts_status_idx on tax_accounts (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Danh mục tờ khai (Quản trị viên cấu hình trên app)
--    ma_tkhai_portal khớp với <maTKhai> trong XML tải từ cổng (VD 864 = 05/KK-TNCN).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_filing_types (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,       -- '01/GTGT', '05/KK-TNCN', '03/TNDN', '05/QTT-TNCN', 'BCTC'
  name            text not null,
  tax_kind        text not null,              -- 'GTGT','TNCN','TNDN','BCTC' → dùng đặt tên file
  period_kind     text not null check (period_kind in ('month','quarter','year','settlement','per_event')),
  ma_tkhai_portal text,                       -- mã cổng dùng, để khớp tự động khi đồng bộ
  sort_order      integer default 0,
  is_active       boolean not null default true
);
create index if not exists tax_filing_types_portal_idx on tax_filing_types (ma_tkhai_portal);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Công ty phải nộp tờ khai nào, kỳ khai gì
--    Mặc định suy từ clients.report_type (293 cty: 260 quarterly, 33 monthly), bảng này chỉ để
--    GHI ĐÈ các trường hợp riêng.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_client_filings (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  filing_type_id  uuid not null references tax_filing_types(id) on delete cascade,
  period_kind     text not null check (period_kind in ('month','quarter','year','settlement','per_event')),
  effective_from  date not null,
  approved_by     uuid references staff(id) on delete set null,
  created_at      timestamptz default now(),
  unique (client_id, filing_type_id, effective_from)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Lịch hạn nộp sinh sẵn mỗi đầu kỳ
--    due_date ĐÃ đẩy qua thứ Bảy/Chủ nhật/ngày lễ trước khi ghi vào đây.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_obligations (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  filing_type_id  uuid not null references tax_filing_types(id) on delete cascade,
  period_code     text not null,              -- 'Q1.2026' | 'T09.2026' | 'NAM.2026'
  period_start    date not null,
  period_end      date not null,
  due_date        date not null,
  state           text not null default 'not_filed'
                  check (state in ('not_filed','received','accepted','rejected','overdue','no_activity')),
  state_changed_at timestamptz,
  no_activity_by  uuid references staff(id) on delete set null,
  created_at      timestamptz default now(),
  unique (client_id, filing_type_id, period_code)
);
create index if not exists tax_obligations_due_idx    on tax_obligations (due_date);
create index if not exists tax_obligations_state_idx  on tax_obligations (state);
create index if not exists tax_obligations_client_idx on tax_obligations (client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Hồ sơ thật lấy từ cổng
--    portal_status giữ NGUYÊN VĂN chuỗi cổng trả về, bên cạnh state đã chuẩn hóa — cổng đổi nhãn
--    thì không mất dữ liệu.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_filings (
  id              uuid primary key default gen_random_uuid(),
  obligation_id   uuid references tax_obligations(id) on delete set null,
  client_id       uuid not null references clients(id) on delete cascade,
  portal          text not null check (portal in ('dvc', 'etax')),
  portal_code     text not null,              -- 'G12.18-260723-00054488'
  tthc_code       text,                       -- '2.002235'
  filing_type_id  uuid references tax_filing_types(id) on delete set null,
  period_code     text not null,              -- chuẩn hóa từ <kyKKhai> '2/2026' → 'Q2.2026'
  form_kind       text not null default 'Chính thức',
  submit_no       integer not null default 1,
  amend_no        integer not null default 0,
  tax_office      text,
  submitted_at    timestamptz,                -- Ngày nộp
  received_at     timestamptz,                -- <ngayTBao> của TB TIẾP NHẬN → dùng xét đúng hạn
  portal_status   text,
  state           text not null default 'received'
                  check (state in ('not_filed','received','accepted','rejected','overdue','no_activity')),
  on_time         boolean,
  file_path       text,                       -- khóa trong Supabase Storage bucket 'tax-files'
  synced_at       timestamptz default now(),
  unique (client_id, portal_code)
);
create index if not exists tax_filings_client_idx on tax_filings (client_id);
create index if not exists tax_filings_period_idx on tax_filings (period_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Thông báo thuế
--    Cổng phát XML (không phải PDF): <tenTBao>, <ngayTBao>, <ngayHoSo>.
--    'tiep_nhan' = 01-1/TB-TĐT (ngày trên đây xét đúng/trễ hạn) | 'xac_nhan_nop' = 01-2/TB-TĐT
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_notices (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  filing_id     uuid references tax_filings(id) on delete cascade,
  portal_id     text,                         -- data-id trên cổng, để không tải trùng
  notice_kind   text not null default 'khac'
                check (notice_kind in ('tiep_nhan','xac_nhan_nop','khac')),
  title         text not null,
  ngay_tbao     date,
  issued_at     timestamptz,
  priority      text not null default 'info' check (priority in ('cao','info')),
  file_path     text,
  handled_by    uuid references staff(id) on delete set null,
  handled_at    timestamptz,
  created_at    timestamptz default now(),
  unique (client_id, portal_id)
);
create index if not exists tax_notices_client_idx on tax_notices (client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Mỗi lượt đồng bộ — kiêm luôn hàng đợi (app không có Redis)
--    Mọi lượt đều PHẢI có captcha_entered_by: không có người gõ thì không có lượt nào chạy.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_sync_jobs (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id) on delete cascade,
  portal             text not null default 'dvc' check (portal in ('dvc', 'etax')),
  trigger_kind       text not null default 'manual'
                     check (trigger_kind in ('batch','manual','initial','backfill')),
  window_from        date,
  window_to          date,
  captcha_count      integer not null default 0,
  captcha_entered_by uuid references staff(id) on delete set null,
  started_at         timestamptz default now(),
  finished_at        timestamptz,
  result             text check (result in ('success','wrong_password','captcha_timeout','portal_error','skipped')),
  new_filings        integer not null default 0,
  changed_filings    integer not null default 0,
  error_detail       text
);
create index if not exists tax_sync_jobs_client_idx on tax_sync_jobs (client_id, started_at desc);
-- Cổng khóa mỗi tài khoản vào 1 phiên → mỗi công ty chỉ 1 lượt đang chạy tại một thời điểm.
create unique index if not exists tax_sync_jobs_one_running_idx
  on tax_sync_jobs (client_id) where finished_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Ngày lễ / gia hạn — dùng để đẩy hạn nộp sang ngày làm việc kế tiếp
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_holidays (
  id   uuid primary key default gen_random_uuid(),
  day  date not null unique,
  note text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Nhật ký truy cập tài khoản thuế (bắt buộc — khách có quyền hỏi ai đã dùng tài khoản của họ)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tax_access_logs (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid references staff(id) on delete set null,
  client_id  uuid references clients(id) on delete set null,
  action     text not null,   -- save_password | reveal_password | sync | download | bulk_download
  detail     jsonb,
  created_at timestamptz default now()
);
create index if not exists tax_access_logs_client_idx on tax_access_logs (client_id, created_at desc);
create index if not exists tax_access_logs_staff_idx  on tax_access_logs (staff_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Quyền
--     Không tạo vai trò mới: dùng luôn admin / leader / staff sẵn có, gán quyền ở trang
--     "Vai trò & phân quyền". Vai trò admin is_system=true → luôn full quyền.
-- ─────────────────────────────────────────────────────────────────────────────
insert into permissions (key, label, group_name) values
  ('view_tax_filings',   'Xem tờ khai, thông báo, lịch hạn nộp của công ty mình phụ trách', 'Phân hệ Tờ khai'),
  ('manage_tax_account', 'Nhập / cập nhật tài khoản cổng thuế của công ty',                 'Phân hệ Tờ khai'),
  ('reveal_credentials', 'XEM CHUỖI mật khẩu của khách — MỌI loại: thuế, hóa đơn, CKS, ngân hàng, BHXH…', 'Phân hệ Tờ khai'),
  ('sync_tax_filings',   'Chạy đồng bộ tờ khai từ cổng thuế',                               'Phân hệ Tờ khai'),
  ('bulk_download_tax',  'Tải tờ khai hàng loạt nhiều công ty',                             'Phân hệ Tờ khai'),
  ('manage_tax_catalog', 'Cấu hình danh mục tờ khai, kỳ khai, ngày lễ',                     'Phân hệ Tờ khai')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key) values
  ('staff',  'view_tax_filings'),
  ('staff',  'manage_tax_account'),
  ('staff',  'sync_tax_filings'),
  ('staff',  'bulk_download_tax'),
  ('leader', 'view_tax_filings'),
  ('leader', 'manage_tax_account'),
  ('leader', 'sync_tax_filings'),
  ('leader', 'bulk_download_tax'),
  ('leader', 'manage_tax_catalog')
on conflict do nothing;

-- 'reveal_credentials' — MỘT quyền chung cho mọi loại mật khẩu (anh chốt 21/09/2026). Gán cho
-- staff + leader để giữ nguyên cách làm việc hiện tại; ai bị bỏ tick thì chỉ thấy dấu chấm, API
-- KHÔNG gửi chuỗi mật khẩu về trình duyệt nữa (ẩn ở giao diện thôi là vô nghĩa, mở tab Network
-- vẫn đọc được). Phạm vi công ty xét riêng ở lib/credentialScope.js: nhân viên chỉ thấy công ty
-- mình phụ trách, trưởng phòng thấy cả phòng, quản trị viên thấy hết.
insert into role_permissions (role_id, permission_key) values
  ('staff',  'reveal_credentials'),
  ('leader', 'reveal_credentials')
on conflict do nothing;

-- Bản đầu đặt tên 'reveal_tax_password' (chỉ mật khẩu thuế) — đã thay bằng quyền chung ở trên.
delete from role_permissions where permission_key = 'reveal_tax_password';
delete from permissions      where key            = 'reveal_tax_password';

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Bật RLS cho toàn bộ bảng tax_*
--
--     Mọi đọc/ghi nghiệp vụ đi qua API route bằng khóa service_role (bỏ qua RLS), nên KHÔNG cần
--     policy nào. Bật RLS mà không có policy = khóa cửa với khóa anon phía trình duyệt: không ai
--     gọi thẳng từ ngoài vào đọc được tài khoản cổng thuế, mật khẩu hay nhật ký truy cập.
--     Giống hệt cách các bảng trong sql/00_bootstrap_core_tables.sql đang làm.
--
--     Bản đầu thiếu phần này nên Supabase SQL Editor phải hỏi "Run and enable RLS" (21/09/2026).
-- ─────────────────────────────────────────────────────────────────────────────
alter table tax_accounts       enable row level security;
alter table tax_filing_types   enable row level security;
alter table tax_client_filings enable row level security;
alter table tax_obligations    enable row level security;
alter table tax_filings        enable row level security;
alter table tax_notices        enable row level security;
alter table tax_sync_jobs      enable row level security;
alter table tax_holidays       enable row level security;
alter table tax_access_logs    enable row level security;
