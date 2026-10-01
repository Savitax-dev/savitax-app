-- Quyền BỎ TICK việc đã hoàn thành trong Checklist công việc.
--
-- VẤN ĐỀ: trước đây chỉ vai trò 'admin' THẬT mới bỏ tick được, chặn cứng trong mã (requireAdmin).
-- Trưởng phòng thấy nhân viên tick nhầm cũng phải nhờ quản trị, trong khi đó là việc hằng ngày
-- của phòng. Anh chốt 01/10/2026: cho tick/bỏ tick được quyền này ở trang Vai trò & phân quyền.
--
-- VÌ SAO KHÔNG MỞ THẲNG CHO LEADER: bỏ tick làm MẤT DẤU "hoàn thành đúng hạn" gốc, mà KPI chấm
-- theo đúng dấu đó. Phải là thứ bật/tắt được cho từng vai trò, không phải mặc định.
--
-- PHẠM VI: quyền này KHÔNG cho đụng công ty của người khác. Mã còn xét thêm phạm vi công ty
-- (lib/checklistScope.js): nhân viên chỉ bỏ tick công ty mình phụ trách, trưởng phòng chỉ trong
-- phòng mình — anh chốt "cty của nhân viên nào là nv đó, tp nào quản lý phòng đó, không đụng
-- lẫn nhau".
--
-- Chạy: dán vào SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

insert into permissions (key, label, group_name) values
  ('uncheck_task', 'Bỏ tick việc đã hoàn thành trong Checklist công việc (chỉ công ty trong phạm vi của mình)', 'Checklist công việc')
on conflict (key) do nothing;

-- CỐ Ý KHÔNG gán cho vai trò nào: quản trị tự tick cho trưởng phòng ở trang Vai trò & phân quyền.
-- Vai trò admin có is_system = true nên luôn có quyền này mà không cần dòng gán nào.
