-- Số lượng nhân sự tham gia BHXH hằng tháng của công ty Thời kỳ (2026-09-22).
--
-- Việc "Cập nhật số lượng nhân sự..." trong mẫu DV HCNS Thời Kỳ không tick thẳng được: nhân viên
-- phải NHẬP số người hoặc chọn "Không thay đổi" (giữ số tháng trước). Số lưu ở đây để xuất báo cáo
-- biến động nhân sự theo quý/năm, làm căn cứ điều chỉnh phí HCNS (300.000đ/người như báo giá).
--
-- Chạy lại nhiều lần an toàn, không có lệnh xoá.

alter table hcns_service_template_tasks add column if not exists requires_headcount boolean not null default false;

create table if not exists hcns_headcount (
  id              uuid primary key default gen_random_uuid(),
  hcns_client_id  uuid not null references hcns_clients(id) on delete cascade,
  year            int  not null,
  month           int  not null check (month between 1 and 12),
  headcount       int  not null check (headcount >= 0),
  unchanged       boolean not null default false,   -- true = chọn "Không thay đổi" so với tháng trước
  entered_by      uuid references staff(id),
  entered_at      timestamptz not null default now(),
  unique (hcns_client_id, year, month)
);
create index if not exists hcns_headcount_client_idx on hcns_headcount (hcns_client_id, year, month);

alter table hcns_headcount enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hcns_headcount' and policyname = 'allow_authenticated_hcns_headcount') then
    create policy "allow_authenticated_hcns_headcount" on hcns_headcount
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Bật "bắt buộc nhập số nhân sự" cho việc đang có trong mẫu định kỳ (khớp theo tên).
update hcns_service_template_tasks t
set requires_headcount = true
from hcns_service_templates s
where t.template_id = s.id and s.is_recurring = true and t.is_active = true
  and lower(t.name) like '%số lượng nhân sự%';
