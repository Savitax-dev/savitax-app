-- Nhật ký thao tác trên trang Đối soát ngân hàng (2026-09-23).
--
-- bank_transactions chỉ giữ TRẠNG THÁI CUỐI (ai đóng, lúc nào) nên không trả lời được "ai đã làm
-- gì với giao dịch này": chọn tay công ty rồi đổi lại, mở lại rồi xác nhận, ghi chú thêm... Bảng
-- này ghi TỪNG thao tác, dùng cho cả ô "Nhật ký giao dịch" trong thẻ giao dịch lẫn mục
-- "Đối soát ngân hàng" ở trang Nhật ký làm việc.
--
-- Chạy lại nhiều lần an toàn.

create table if not exists bank_action_logs (
  id         uuid primary key default gen_random_uuid(),
  tx_id      uuid not null references bank_transactions(id) on delete cascade,
  client_id  uuid references clients(id) on delete set null,
  -- post | ignore | reopen | assign | note
  action     text not null,
  detail     text,          -- tóm tắt việc đã làm (đã ghi những khoản nào, chọn công ty nào...)
  note       text,          -- ghi chú nhân viên tự nhập
  staff_id   uuid references staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bank_action_logs_tx_idx      on bank_action_logs (tx_id, created_at);
create index if not exists bank_action_logs_staff_idx   on bank_action_logs (staff_id, created_at);
create index if not exists bank_action_logs_created_idx on bank_action_logs (created_at desc);

-- Chỉ service role (route API) đọc/ghi, giống bank_transactions.
alter table bank_action_logs enable row level security;
grant all privileges on table bank_action_logs to service_role;
