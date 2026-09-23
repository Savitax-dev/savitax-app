-- Ghi chú nội bộ cho công ty Thời kỳ, theo từng tháng (2026-09-23).
--
-- Dùng LẠI bảng ghi chú sẵn có của hồ sơ Thời điểm thay vì dựng bảng mới: giữ nguyên cơ chế
-- "xác nhận đã đọc" (hcns_case_note_reads) và toàn bộ giao diện.
--   case_service_id -> ghi chú của 1 dịch vụ trong hồ sơ Thời điểm (như cũ)
--   hcns_client_id + year/month -> ghi chú của 1 công ty Thời kỳ trong 1 tháng (mới)
--
-- Chạy lại nhiều lần an toàn, không có lệnh xoá, không đụng ghi chú cũ.

alter table hcns_case_notes add column if not exists hcns_client_id uuid references hcns_clients(id) on delete cascade;
alter table hcns_case_notes add column if not exists year  int;
alter table hcns_case_notes add column if not exists month int;
alter table hcns_case_notes alter column case_service_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hcns_case_notes_target_ck') then
    alter table hcns_case_notes add constraint hcns_case_notes_target_ck
      check (case_service_id is not null or hcns_client_id is not null);
  end if;
end $$;

create index if not exists hcns_case_notes_client_idx on hcns_case_notes (hcns_client_id, year, month, created_at desc);
