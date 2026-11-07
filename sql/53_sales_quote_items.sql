-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG KINH DOANH — mỗi khoản phí trong báo giá là một dòng riêng
-- (đề xuất Phòng Kinh doanh 04/11/2026, anh duyệt 07/11/2026)
--
-- Trước đây mỗi báo giá chỉ có MỘT ô "Phí/tháng" nên khoản thu một lần cũng bị hiểu là tháng nào
-- khách cũng trả → doanh số và thưởng tính sai (RESINVA 5tr một lần bị cộng mỗi tháng; BCTC 35tr/năm
-- của Gau Gau thì không được ghi). Nay tách thành bảng dòng phí, mỗi dòng nói rõ CÁCH THU.
--
-- ⚠ BẢN CLONE (ABS, NYD...) KHÔNG CHẠY FILE NÀY — module Phòng Kinh doanh là của riêng Savitax.
-- Chạy lại nhiều lần vẫn an toàn. Chỉ THÊM bảng mới + 3 cột tổng trên sales_quotes, không đụng
-- dữ liệu cũ: báo giá chưa có dòng phí vẫn chạy theo `monthly_final` như trước.
-- ═══════════════════════════════════════════════════════════════════════════════════════

create table if not exists sales_quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references sales_quotes(id) on delete cascade,
  sort_order   integer not null default 0,
  service      text not null,                    -- tên dịch vụ (chọn trong danh sách hoặc gõ tay)

  -- CÁCH THU quyết định khoản tiền rơi vào tháng nào khi tính doanh số:
  --   monthly = hằng tháng (tính cho mọi tháng kể từ start_month)
  --   once    = một lần    (chỉ tính vào start_month)
  --   yearly  = mỗi năm    (tính vào start_month, lặp lại mỗi 12 tháng)
  --   multi   = thu dồn nhiều tháng (amount là tiền MỘT tháng, × months, thu 1 lần ở start_month)
  billing      text not null default 'monthly' check (billing in ('monthly','once','yearly','multi')),

  amount       numeric not null default 0,       -- số tiền báo khách, CHƯA gồm VAT (0 = chưa biết, nhập sau)
  months       integer,                          -- chỉ dùng cho billing='multi'
  start_month  text,                             -- 'YYYY-MM': tháng thu, phí hằng tháng thì là tháng bắt đầu

  -- false = khách trả thẳng cho bên thứ ba (vd phần mềm MISA): vẫn in trên báo giá cho khách biết
  -- nhưng KHÔNG tính vào doanh số và tiền thưởng của nhân viên.
  to_savitax   boolean not null default true,

  standard_amount numeric,                       -- mức theo biểu phí (để biết dòng nào báo khác biểu phí)
  note         text,                             -- lý do báo khác biểu phí / ghi chú in kèm
  created_at   timestamptz default now()
);
create index if not exists sales_quote_items_quote_idx on sales_quote_items (quote_id, sort_order);

-- 3 con số app tự tính từ bảng dòng phí, lưu sẵn để danh sách và báo cáo không phải cộng lại mỗi lần.
-- NULL = báo giá cũ chưa tách dòng (vẫn đọc theo monthly_final).
alter table sales_quotes add column if not exists fee_monthly numeric;  -- phí hằng tháng
alter table sales_quotes add column if not exists fee_once    numeric;  -- thu một lần (gồm cả thu dồn)
alter table sales_quotes add column if not exists fee_year1   numeric;  -- tổng tiền 12 tháng đầu

-- RLS: theo đúng quy ước — mọi đọc/ghi đi qua route API dùng service_role key.
alter table sales_quote_items enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sales_quote_items'
      and policyname = 'allow_authenticated_sales_quote_items'
  ) then
    execute 'create policy "allow_authenticated_sales_quote_items" on sales_quote_items for all '
      || 'using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')';
  end if;
end $$;

grant all privileges on table sales_quote_items to service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiểm tra sau khi chạy
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) from information_schema.tables where table_name = 'sales_quote_items';   -- 1
-- select count(*) from information_schema.columns
--   where table_name = 'sales_quotes' and column_name in ('fee_monthly','fee_once','fee_year1');  -- 3
