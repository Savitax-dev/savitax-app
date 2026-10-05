-- Hồ sơ "Dịch vụ khác" (2026-10-05).
--
-- Trước đây phí thu khác chỉ là MỘT dòng `service_fees` type='khach' cho mỗi công ty mỗi tháng:
-- chỉ có số ĐÃ THU, không có số phải thu, không biết còn thiếu bao nhiêu, và hai dịch vụ phát sinh
-- trong cùng tháng bị cộng dồn thành một dòng (khoá duy nhất client+year+month+type).
--
-- Nay mỗi dịch vụ phát sinh là MỘT hồ sơ: phải thu bao nhiêu, đã thu mấy lần, còn lại tự chuyển kỳ
-- sau, thu đủ thì đóng hồ sơ. 14 khoản 'khach' cũ giữ nguyên để không mất lịch sử.
--
-- Chạy lại nhiều lần an toàn.

create table if not exists other_services (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  name         text not null,                 -- nội dung dịch vụ
  amount       numeric not null default 0,    -- số tiền phải thu
  year         int not null,                  -- kỳ phát sinh
  month        int not null,
  status       text not null default 'open',  -- open = đang thu | done = đã hoàn thành
  note         text,
  created_by   uuid references staff(id) on delete set null,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz,
  closed_by    uuid references staff(id) on delete set null,
  close_reason text,                          -- lý do đóng khi CHƯA thu đủ (chỉ TP/Quản trị)
  constraint other_services_status_chk check (status in ('open', 'done')),
  constraint other_services_month_chk  check (month between 1 and 12)
);

create index if not exists other_services_client_idx on other_services (client_id, year, month);
create index if not exists other_services_status_idx on other_services (status);

-- Mỗi lần thu một dòng: khách trả làm nhiều đợt là chuyện thường.
create table if not exists other_service_payments (
  id         uuid primary key default gen_random_uuid(),
  service_id uuid not null references other_services(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  amount     numeric not null,
  year       int not null,                    -- kỳ GHI THU (vào báo cáo tháng nào)
  month      int not null,
  note       text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint other_service_payments_month_chk check (month between 1 and 12)
);

create index if not exists other_service_payments_svc_idx    on other_service_payments (service_id);
create index if not exists other_service_payments_client_idx on other_service_payments (client_id, year, month);

-- Chỉ service role (route API) đọc/ghi — giống các bảng nghiệp vụ khác.
alter table other_services         enable row level security;
alter table other_service_payments enable row level security;
grant all privileges on table other_services, other_service_payments to service_role;
