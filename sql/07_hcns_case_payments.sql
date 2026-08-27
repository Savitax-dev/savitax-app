-- ═══════════════════════════════════════════════════════════════════════════════════════
-- HCNS — Công nợ hồ sơ Thời điểm / Vãng lai
--
-- Chạy trong Supabase SQL Editor SAU sql/06_hcns_module.sql. Chạy lại nhiều lần vẫn an toàn.
-- ⚠ BẢN CLONE (ABS, NYD, Linh Phong...) KHÔNG CHẠY FILE NÀY.
--
-- Vì sao cần bảng riêng, không dùng lại hcns_service_fees:
--   hcns_service_fees khoá duy nhất theo (hcns_client_id, year, month, type) — mỗi tháng chỉ ghi
--   được MỘT dòng. Hồ sơ thời điểm/vãng lai thì khách trả NHIỀU LẦN trong cùng một tháng, mỗi lần
--   có thể cho một dịch vụ khác nhau. Nên đây là sổ ghi nối tiếp (append-only), không phải bảng
--   một-dòng-một-kỳ.
-- ═══════════════════════════════════════════════════════════════════════════════════════

create table if not exists hcns_case_payments (
  id               uuid primary key default gen_random_uuid(),
  hcns_client_id   uuid not null references hcns_clients(id) on delete cascade,
  -- NULL = thu chung cho cả hồ sơ (không tách theo dịch vụ nào).
  -- Có giá trị = thu cho đúng một dịch vụ, để đối chiếu từng loại dịch vụ.
  case_service_id  uuid references hcns_case_services(id) on delete set null,
  amount           numeric not null default 0,
  note             text,
  created_by       uuid references staff(id) on delete set null,
  created_at       timestamptz default now()
);

create index if not exists hcns_case_payments_client_idx on hcns_case_payments (hcns_client_id, created_at desc);
create index if not exists hcns_case_payments_service_idx on hcns_case_payments (case_service_id);

alter table hcns_case_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hcns_case_payments'
      and policyname = 'allow_authenticated_hcns_case_payments'
  ) then
    create policy "allow_authenticated_hcns_case_payments" on hcns_case_payments
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

grant all privileges on table hcns_case_payments to service_role, authenticated;
grant select on table hcns_case_payments to anon;

-- Kiểm tra sau khi chạy — phải trả về 1
-- select count(*) from information_schema.tables
--   where table_schema='public' and table_name='hcns_case_payments';
