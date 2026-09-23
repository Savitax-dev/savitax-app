-- Đối soát ngân hàng (2026-09-22).
--
-- VPS (/root/acb_zalo/app_sync.py) đọc email biến động số dư ACB + sao kê Techcombank rồi đẩy
-- từng giao dịch TIỀN VÀO lên /api/bank/incoming. Trang /bank tự nhận ra công ty + kỳ từ
-- nội dung chuyển khoản; người có quyền bấm "Ghi" mới ghi vào công nợ — KHÔNG có gì tự ghi.
--
-- Chạy lại nhiều lần an toàn.

create table if not exists bank_transactions (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,                 -- 'acb' | 'tcb'
  ext_id       text not null,                 -- khoá chống trùng do VPS gửi (Message-ID email / số bút toán)
  tx_time      timestamptz,
  amount       numeric not null,
  memo         text,
  account      text,
  -- open = chưa xử lý | posted = đã ghi công nợ qua trang này | ignored = bỏ qua (không phải phí dịch vụ)
  state        text not null default 'open',
  -- Người dùng chọn tay khi nội dung không nhận ra công ty / kỳ
  client_id    uuid references clients(id) on delete set null,
  period_year  int,
  period_month int,
  posted_at    timestamptz,
  posted_by    uuid references staff(id) on delete set null,
  post_detail  jsonb,                         -- đã ghi những gì (để tra lại / gỡ tay khi cần)
  note         text,
  created_at   timestamptz not null default now(),
  constraint bank_transactions_ext_id_key unique (ext_id),
  constraint bank_transactions_state_chk check (state in ('open', 'posted', 'ignored'))
);

create index if not exists bank_transactions_tx_time_idx on bank_transactions (tx_time desc);
create index if not exists bank_transactions_state_idx   on bank_transactions (state);

-- Bật RLS, KHÔNG tạo policy: chỉ service role (route API) đọc/ghi được. Trình duyệt không bao giờ
-- đọc thẳng bảng này — nội dung chuyển khoản có tên/số tài khoản của khách.
alter table bank_transactions enable row level security;
grant all privileges on table bank_transactions to service_role;

-- Quyền riêng — mặc định KHÔNG gán cho vai trò nào. Quản trị (is_system) luôn có đủ quyền; cấp thêm
-- cho ai thì tích ở trang Vai trò & phân quyền.
insert into permissions (key, label, group_name) values
  ('bank_reconcile', 'Đối soát ngân hàng (xem tiền vào, ghi công nợ từ giao dịch ngân hàng)', 'Công nợ')
on conflict (key) do nothing;
