-- Phân hệ TIỀN LƯƠNG — tách quyền "Chấm công toàn công ty" khỏi quyền xem lương (anh yêu cầu 31/10/2026).
-- Chạy MỘT LẦN trong Supabase SQL Editor. Chạy lại không hỏng gì.
--
-- cham_cong_toan_cty — xem bảng chấm công của MỌI nhân viên, nhập file máy chấm công (sheet "_XuLy"),
--                      sửa công (bắt buộc lý do). KHÔNG thấy lương / cấp bậc / bảng lương.
--                      Dành cho nhân viên HCNS phụ trách chấm công.
-- Cố ý KHÔNG gán sẵn cho vai trò nào (Quản trị luôn có) — anh tự tích ở "Vai trò & phân quyền".
-- Quyền cũ view_payroll ("Xem lương, cấp bậc và chấm công toàn công ty") vẫn xem được chấm công cả công ty như trước.
insert into permissions (key, label, group_name) values
  ('cham_cong_toan_cty', 'Chấm công toàn công ty (xem, nhập file máy chấm công, sửa công — không xem lương)', 'Tiền lương')
on conflict (key) do nothing;
