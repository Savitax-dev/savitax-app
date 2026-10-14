-- Dấu "TP đã kiểm tra" trên Checklist công việc.
--
-- VẤN ĐỀ anh nêu 14/10/2026: nhân viên tự tick việc của mình, không ai soát lại. Quản trị mở ra
-- chỉ thấy "9/14 việc" — không biết trưởng phòng đã rà chưa, hay số đó là nhân viên tự khai.
--
-- GIẢI: mỗi (công ty, năm, tháng) có thêm MỘT dấu do trưởng phòng đóng. Dấu này KHÔNG đụng gì tới
-- task_records — không sửa việc nào, không ảnh hưởng KPI. Nó chỉ trả lời đúng một câu: "tháng này
-- của công ty này đã có người soát chưa, ai soát, lúc nào".
--
-- VÌ SAO LƯU `done_count`: ghi lại SỐ VIỆC ĐÃ XONG tại đúng lúc trưởng phòng bấm. Sau đó nhân
-- viên tick thêm (hoặc bỏ tick) thì số hiện tại lệch khỏi số đã lưu, giao diện hiện "đã đổi sau
-- khi kiểm" thay vì dấu xanh trơn. Không có cột này thì TP kiểm sớm lúc 2/14 việc vẫn mang dấu
-- "đã duyệt" y như kiểm lúc 14/14 — dấu mất hết ý nghĩa.
--
-- PHẠM VI: chỉ TRƯỞNG PHÒNG CỦA PHÒNG CHỨA CÔNG TY đó, cộng quản trị. Anh chốt 01/10/2026 "tp nào
-- quản lý phòng đó, không đụng lẫn nhau" — ở đây chặt hơn quyền bỏ tick: nhân viên phụ trách công
-- ty KHÔNG tự kiểm được việc của chính mình, vì cả điểm của dấu là có người thứ hai nhìn vào.
-- Xem lib/checklistScope.js.
--
-- Chạy: dán vào SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

create table if not exists checklist_reviews (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  year integer not null,
  month integer not null,
  reviewed_by uuid,
  reviewed_at timestamptz default now(),
  -- Số dòng task_records có is_done = true của đúng (công ty, năm, tháng) này tại lúc bấm.
  done_count integer not null default 0
  , primary key (id)
  , foreign key (client_id) references clients(id)
  , foreign key (reviewed_by) references staff(id)
);

-- Mỗi (công ty, tháng) đúng MỘT dấu. Bấm lại chỉ cập nhật dòng cũ, không đẻ dòng thứ hai.
create unique index if not exists checklist_reviews_ky_idx
  on checklist_reviews (client_id, year, month);

-- Trang phòng đọc cả tháng một lượt cho ~100 công ty -> lọc theo kỳ trước, rồi mới theo công ty.
create index if not exists checklist_reviews_thang_idx
  on checklist_reviews (year, month);

-- BẬT RLS VÀ CỐ Ý KHÔNG TẠO POLICY NÀO.
--
-- Khác với các bảng cũ ở sql/00 (mỗi bảng kèm một policy "allow_authenticated_..." cho mọi người
-- đã đăng nhập). Policy kiểu đó nghĩa là ai đăng nhập cũng ghi thẳng vào bảng bằng khoá `anon`
-- công khai, không qua API — với bảng này thì nhân viên tự chèn một dòng "TP đã kiểm" cho công ty
-- của chính mình là xong, bỏ qua sạch phần kiểm quyền ở lib/checklistScope.js.
--
-- Không có policy = chỉ `service_role` đụng được, mà khoá đó chỉ nằm ở máy chủ. Đường duy nhất
-- vào bảng này là /api/admin/checklist-review. Đừng thêm policy cho `authenticated` ở đây.
alter table checklist_reviews enable row level security;

insert into permissions (key, label, group_name) values
  ('review_checklist', 'Đóng dấu "TP đã kiểm tra" cho Checklist công việc (chỉ phòng mình làm trưởng)', 'Checklist công việc')
on conflict (key) do nothing;

-- CỐ Ý KHÔNG gán cho vai trò nào — quản trị tự bật ở trang Vai trò & phân quyền, y như
-- `uncheck_task` (sql/23). Vai trò admin có is_system = true nên luôn có sẵn.
