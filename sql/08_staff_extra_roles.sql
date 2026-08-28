-- ═══════════════════════════════════════════════════════════════════════════════════════
-- KIÊM NHIỆM: một nhân viên thuộc NHIỀU phòng với NHIỀU vai trò khác nhau
--
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần vẫn an toàn.
--
-- Bối cảnh: `staff.role` là MỘT cột text và `staff.room_id` là MỘT khoá ngoại, nên một nhân viên
-- chỉ giữ được một vai trò ở một phòng. Thực tế có người vừa là nhân viên kế toán phòng Himalaya,
-- vừa là trưởng phòng HCNS.
--
-- Cách làm: KHÔNG đụng gì tới staff.role / staff.room_id — đó vẫn là phòng và vai trò CHÍNH.
-- Bảng này chỉ ghi thêm các phòng kiêm nhiệm. Quyền hiệu lực = HỢP của vai trò chính và mọi vai
-- trò kiêm nhiệm. Thuần cộng thêm, không bao giờ bớt — nhân viên chưa kiêm nhiệm thì mọi thứ
-- chạy y hệt như trước, không có rủi ro mất quyền.
--
-- ⚠ Bản clone (ABS, NYD, Linh Phong...) CHẠY ĐƯỢC file này nếu muốn dùng kiêm nhiệm cho nghiệp
-- vụ kế toán; nó không phụ thuộc gì vào module HCNS.
-- ═══════════════════════════════════════════════════════════════════════════════════════

create table if not exists staff_extra_roles (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  room_id    uuid not null references rooms(id) on delete cascade,
  role       text not null references roles(id),
  created_at timestamptz default now()
);

-- Mỗi nhân viên chỉ có một vai trò trong một phòng.
create unique index if not exists staff_extra_roles_uniq on staff_extra_roles (staff_id, room_id);
create index if not exists staff_extra_roles_staff_idx on staff_extra_roles (staff_id);
create index if not exists staff_extra_roles_room_idx on staff_extra_roles (room_id);

alter table staff_extra_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staff_extra_roles'
      and policyname = 'allow_authenticated_staff_extra_roles'
  ) then
    create policy "allow_authenticated_staff_extra_roles" on staff_extra_roles
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

grant all privileges on table staff_extra_roles to service_role, authenticated;
grant select on table staff_extra_roles to anon;

-- Kiểm tra sau khi chạy — phải trả về 1
-- select count(*) from information_schema.tables
--   where table_schema='public' and table_name='staff_extra_roles';
