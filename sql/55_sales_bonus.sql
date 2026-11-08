-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG KINH DOANH — Báo cáo doanh số và thưởng cuối tháng
-- (đề xuất Phòng Kinh doanh 04/11/2026 mục "Sửa 4", anh duyệt 07/11/2026)
--
-- Quy tắc sếp Huyền đã chốt:
--   · Doanh số tính thưởng là tiền THỰC THU trong tháng, CHƯA gồm thuế GTGT
--   · Mốc tối thiểu 30.000.000 đ (thử việc) / 35.000.000 đ (chính thức)
--   · Thưởng = 10% phần VƯỢT mốc; không đạt mốc thì không có thưởng
--   · Khoản khách trả thẳng cho bên thứ ba (MISA) KHÔNG tính doanh số
-- Mốc và tỷ lệ để trong "Cài đặt thưởng" cho sếp tự sửa khi cơ chế đổi.
--
-- ⚠ BẢN CLONE (ABS, NYD...) KHÔNG CHẠY FILE NÀY. Chạy lại nhiều lần vẫn an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Một dòng duy nhất (id = 1) giữ mốc + tỷ lệ đang áp dụng.
create table if not exists sales_bonus_settings (
  id                integer primary key default 1 check (id = 1),
  nguong_thu_viec   numeric not null default 30000000,
  nguong_chinh_thuc numeric not null default 35000000,
  ty_le             numeric not null default 10,   -- % phần vượt mốc
  vat_rate          numeric not null default 8,    -- thuế suất gợi ý khi ghi lần thu
  updated_by        uuid references staff(id) on delete set null,
  updated_at        timestamptz default now()
);
insert into sales_bonus_settings (id) values (1) on conflict (id) do nothing;

-- Cấp của từng nhân viên kinh doanh. Không có dòng = coi như chính thức (mốc 35tr).
create table if not exists sales_staff_bonus (
  staff_id   uuid primary key references staff(id) on delete cascade,
  level      text not null default 'chinh_thuc' check (level in ('thu_viec','chinh_thuc')),
  nguong     numeric,                             -- mốc riêng sếp đặt tay; null = lấy theo cấp
  note       text,
  updated_by uuid references staff(id) on delete set null,
  updated_at timestamptz default now()
);

-- Báo cáo tháng đã TRÌNH DUYỆT. Mỗi tháng mỗi người một dòng.
-- Dòng này là ẢNH CHỤP lúc bấm "Làm báo cáo tháng": ghi thêm lần thu sau đó thì app so với số đang
-- tính được và báo lệch để sếp duyệt lại — số đã duyệt không tự đổi sau lưng.
create table if not exists sales_bonus_reports (
  id          uuid primary key default gen_random_uuid(),
  period      text not null,                     -- 'YYYY-MM'
  staff_id    uuid not null references staff(id) on delete cascade,
  doanh_so    numeric not null default 0,        -- tiền thực thu trong tháng, CHƯA VAT
  nguong      numeric not null default 0,
  ty_le       numeric not null default 10,
  vuot        numeric not null default 0,
  thuong      numeric not null default 0,
  level       text,
  trang_thai  text not null default 'cho_duyet' check (trang_thai in ('cho_duyet','da_duyet','tu_choi')),
  nguoi_duyet uuid references staff(id) on delete set null,
  luc_duyet   timestamptz,
  ghi_chu     text,
  chi_tiet    jsonb,                             -- các lần thu đã cộng vào doanh số (để truy ngược)
  created_by  uuid references staff(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (period, staff_id)
);
create index if not exists sales_bonus_reports_period_idx on sales_bonus_reports (period);

-- RLS: theo đúng quy ước — mọi đọc/ghi đi qua route API dùng service_role key.
alter table sales_bonus_settings enable row level security;
alter table sales_staff_bonus    enable row level security;
alter table sales_bonus_reports  enable row level security;
do $$
declare b text;
begin
  foreach b in array array['sales_bonus_settings','sales_staff_bonus','sales_bonus_reports'] loop
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = b and policyname = 'allow_authenticated_' || b
    ) then
      execute 'create policy "allow_authenticated_' || b || '" on ' || b || ' for all '
        || 'using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')';
    end if;
  end loop;
end $$;

grant all privileges on table sales_bonus_settings to service_role, authenticated;
grant all privileges on table sales_staff_bonus    to service_role, authenticated;
grant all privileges on table sales_bonus_reports  to service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiểm tra sau khi chạy
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) from information_schema.tables
--   where table_name in ('sales_bonus_settings','sales_staff_bonus','sales_bonus_reports');   -- 3
-- select * from sales_bonus_settings;   -- 1 dòng: 30tr / 35tr / 10% / VAT 8%
