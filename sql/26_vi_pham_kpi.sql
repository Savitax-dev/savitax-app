-- 26. VI PHẠM: nhân viên tick việc nhưng không thực hiện, trưởng phòng phát hiện.
--
-- Mỗi nhân viên mỗi tháng tối đa MỘT dòng (anh chốt 10/10/2026: có vi phạm trong tháng là trừ 20 điểm
-- %-hoàn thành công việc của tháng đó, một lần, dù 1 hay nhiều lần vi phạm). Gỡ vi phạm = xoá dòng.

create table if not exists kpi_violations (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id),
  year        int  not null,
  month       int  not null,
  reason      text not null,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  unique (staff_id, year, month)
);
create index if not exists kpi_violations_ky_idx on kpi_violations (year, month);
alter table kpi_violations enable row level security;
grant all on kpi_violations to service_role;
