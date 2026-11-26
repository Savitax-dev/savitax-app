-- Zalo Bot — BƯỚC THỬ (26/11/2026): ghi lại NGUYÊN VĂN mọi tin Zalo đẩy về /api/zalo/incoming,
-- chưa tick gì. Mục đích: xem bot trong nhóm nhận được tin nào (mọi tin hay chỉ tin @Bot), tin trông
-- thế nào, rồi mới dựng luật tự tick Checklist.
--
-- Chỉ máy chủ (service role) đọc / ghi: bật RLS, CỐ Ý không có policy nào.
-- Chạy trong Supabase SQL Editor.

create table if not exists zalo_tin_nhan (
  id            bigserial primary key,
  nhan_luc      timestamptz not null default now(),   -- lúc app nhận
  event_name    text,                                 -- message.text.received, message.file.received…
  message_id    text unique,                          -- chống trùng khi Zalo gửi lại
  chat_id       text,
  chat_type     text,                                 -- PRIVATE | GROUP
  nguoi_gui_id  text,
  nguoi_gui_ten text,
  gui_luc       timestamptz,                          -- message.date (mili giây) đổi ra giờ
  noi_dung      text,                                 -- text / caption / tên file
  du_lieu       jsonb not null                        -- nguyên body Zalo gửi
);

create index if not exists zalo_tin_nhan_chat_idx on zalo_tin_nhan (chat_id, gui_luc desc);

alter table zalo_tin_nhan enable row level security;
