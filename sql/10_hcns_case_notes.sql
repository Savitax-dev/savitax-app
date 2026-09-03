-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Ghi chú nội bộ trên hồ sơ HCNS + xác nhận đã đọc
--
-- Chạy trong Supabase SQL Editor SAU sql/06_hcns_module.sql. Chạy lại nhiều lần vẫn an toàn.
-- ⚠ Bản clone KHÔNG chạy file này (thuộc module HCNS).
--
-- Vì sao cần: nhân viên, trưởng phòng và quản lý hiện trao đổi về hồ sơ qua Zalo/nói miệng —
-- người nhận việc sau không thấy được dặn dò trước đó nên dễ làm sót. Ghi chú gắn thẳng vào
-- từng dịch vụ trong hồ sơ, kèm dấu "đã đọc" của từng người để biết ai đã nắm, ai chưa.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Một dòng = một lời nhắn trên 1 dịch vụ của hồ sơ.
create table if not exists hcns_case_notes (
  id              uuid primary key default gen_random_uuid(),
  case_service_id uuid not null references hcns_case_services(id) on delete cascade,
  content         text not null,
  created_by      uuid references staff(id) on delete set null,
  created_at      timestamptz default now()
);
create index if not exists hcns_case_notes_service_idx on hcns_case_notes (case_service_id, created_at desc);

-- Xác nhận đã đọc — mỗi người 1 dòng cho mỗi lời nhắn.
-- Unique (note_id, staff_id) để bấm nhiều lần vẫn chỉ ghi 1 dòng, không sinh rác.
create table if not exists hcns_case_note_reads (
  id       uuid primary key default gen_random_uuid(),
  note_id  uuid not null references hcns_case_notes(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  read_at  timestamptz default now(),
  unique (note_id, staff_id)
);
create index if not exists hcns_case_note_reads_note_idx on hcns_case_note_reads (note_id);

alter table hcns_case_notes      enable row level security;
alter table hcns_case_note_reads enable row level security;

-- Tạo policy nếu chưa có. Dùng kiểm tra pg_policies thay cho "drop policy if exists" để file
-- KHÔNG chứa lệnh xoá nào — vừa chạy lại được nhiều lần, vừa không bị cảnh báo "destructive".
do $$
declare t text;
begin
  foreach t in array array['hcns_case_notes', 'hcns_case_note_reads']
  loop
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

-- Kiểm tra sau khi chạy — phải trả về 2
-- select count(*) from information_schema.tables
--   where table_name in ('hcns_case_notes','hcns_case_note_reads');
