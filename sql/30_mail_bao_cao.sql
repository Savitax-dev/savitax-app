-- Dấu vết mail "bộ báo cáo thuế" dùng để tự tick Checklist công việc.
--
-- Anh chốt 14/10/2026: "check tự động từ mail của nhân viên gửi qua cho KH để xác nhận đúng là đã
-- gửi mail hay chưa, app sẽ tick tự động nếu đúng cú pháp." Mail về hộp `congnosavitax@gmail.com`
-- (nhân viên CC 100%), VPS đọc rồi đẩy lên /api/mail/incoming.
--
-- VÌ SAO PHẢI LƯU BẢNG NÀY chứ không chỉ tick rồi thôi:
--
--   1. TICK TỰ ĐỘNG TRÔNG Y HỆT TICK TAY. Không có dấu vết thì vài tháng sau không ai trả lời
--      được "dựa vào đâu mà báo đã gửi" — đúng loại câu hỏi sẽ phát sinh khi khách kêu chưa nhận
--      được báo cáo.
--   2. MAIL KHÔNG KHỚP CŨNG PHẢI LƯU. Mail gửi rồi mà app không nhận ra (sai cú pháp tiêu đề,
--      công ty trùng tên) là thứ phải sửa được — lưu kèm LÝ DO để dựng danh sách "mail chưa khớp".
--      Không lưu thì mỗi lần hỏng là mất dấu, chỉ còn cách đi lục hộp thư bằng tay.
--   3. CHỐNG TRÙNG. `message_id` của thư là duy nhất; VPS gửi lại bao nhiêu lần cũng chỉ một dòng.
--
-- Chạy lại nhiều lần vẫn an toàn.

create table if not exists mail_evidence (
  id          uuid primary key default gen_random_uuid(),
  message_id  text not null,                 -- Message-ID của thư, khoá chống trùng
  subject     text not null,                 -- tiêu đề NGUYÊN VĂN, không chuẩn hoá
  from_email  text,                          -- người gửi (nhân viên)
  sent_at     timestamptz,                   -- giờ gửi theo thư, KHÔNG phải giờ đọc được
  -- Kết quả đối chiếu. Khớp được thì có đủ 4 cột dưới; không khớp thì để trống và ghi `reason`.
  client_id   uuid references clients(id) on delete set null,
  task_def_id uuid references task_definitions(id) on delete set null,
  year        integer,
  month       integer,
  matched     boolean not null default false,
  reason      text,                          -- vì sao không khớp (hiện cho người xem)
  -- true = chính lượt này tạo ra dấu tick. false = việc đã được tick từ trước, mail chỉ là bằng
  -- chứng thêm. Phân biệt để biết tính năng thực sự giúp được bao nhiêu.
  ticked      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Một thư chỉ một dòng. VPS cứ gửi lại khi mạng lỗi, không sợ nhân đôi.
create unique index if not exists mail_evidence_msgid_idx on mail_evidence (message_id);

-- Tra "việc này được tick nhờ mail nào" khi mở checklist.
create index if not exists mail_evidence_viec_idx on mail_evidence (client_id, year, month);

-- Dựng danh sách "mail chưa khớp" — lọc theo matched rồi sắp theo giờ gửi.
create index if not exists mail_evidence_chua_khop_idx on mail_evidence (matched, sent_at desc);

-- RLS BẬT, CỐ Ý KHÔNG POLICY — giống sql/27. Bảng này chứa tiêu đề thư gửi khách; đường duy nhất
-- vào là API đã kiểm quyền, khoá `anon` công khai không được đọc cũng không được ghi.
alter table mail_evidence enable row level security;

-- Kiểm tra sau khi chạy:
-- select matched, count(*) from mail_evidence group by matched;
