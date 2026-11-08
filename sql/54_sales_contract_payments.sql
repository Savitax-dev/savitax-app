-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG KINH DOANH — Theo dõi hợp đồng: khách đã trả bao nhiêu, tháng nào
-- (đề xuất Phòng Kinh doanh 04/11/2026 mục "Sửa 3", anh duyệt 07/11/2026)
--
-- HAI THÁNG KHÁC NHAU, đừng lẫn:
--   due_month  = KỲ PHÍ      — khoản này đáng lẽ thu của tháng nào (lấy từ bảng khoản phí sql/53)
--   paid_month = THÁNG TIỀN VỀ — tiền vào tài khoản tháng nào → DOANH SỐ tính cho tháng ĐÓ
-- Chốt hợp đồng tháng 10 mà khách trả nốt tháng 11 thì phần đó là doanh số tháng 11.
--
-- SỐ CẦN THU KHÔNG LƯU Ở ĐÂY: app tính thẳng từ bảng khoản phí (dueInMonth) nên hợp đồng có phí
-- tháng tự sinh kỳ mới mỗi tháng, không phải nhập tay và không bao giờ lệch với báo giá.
--
-- ⚠ BẢN CLONE (ABS, NYD...) KHÔNG CHẠY FILE NÀY — module Phòng Kinh doanh là của riêng Savitax.
-- Chạy lại nhiều lần vẫn an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════════════

create table if not exists sales_contract_payments (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references sales_quotes(id) on delete cascade,

  due_month   text not null,                    -- 'YYYY-MM' kỳ phí mà lần thu này trả cho
  paid_month  text not null,                    -- 'YYYY-MM' tháng tiền về tài khoản (tính doanh số)

  -- Người lập nhập SỐ TIỀN VỀ TÀI KHOẢN (đã gồm VAT). net = gross / (1 + vat_rate/100), server
  -- tính lại khi lưu — không tin số trình duyệt gửi. net mới là số tính doanh số và thưởng.
  gross       numeric not null default 0,
  vat_rate    numeric not null default 8,
  net         numeric not null default 0,

  staff_id    uuid references staff(id) on delete set null,   -- người hưởng doanh số (mặc định người lập báo giá)
  note        text,
  created_by  uuid references staff(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists sales_contract_payments_quote_idx on sales_contract_payments (quote_id, due_month);
create index if not exists sales_contract_payments_paid_idx  on sales_contract_payments (paid_month, staff_id);

-- RLS: theo đúng quy ước — mọi đọc/ghi đi qua route API dùng service_role key.
alter table sales_contract_payments enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sales_contract_payments'
      and policyname = 'allow_authenticated_sales_contract_payments'
  ) then
    execute 'create policy "allow_authenticated_sales_contract_payments" on sales_contract_payments for all '
      || 'using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')';
  end if;
end $$;

grant all privileges on table sales_contract_payments to service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiểm tra sau khi chạy
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) from information_schema.tables where table_name = 'sales_contract_payments';  -- 1
