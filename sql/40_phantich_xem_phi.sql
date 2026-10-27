-- Quyền xem khối "Căn cứ điều chỉnh phí" ở màn Tăng trưởng & phí (Phân hệ Soát xét báo cáo).
--
-- Anh chốt 25/10/2026: phần phí (phí đang thu, phí theo biểu phí, phí đề xuất) chỉ TRƯỞNG PHÒNG và QUẢN TRỊ thấy;
-- nhân viên phụ trách vẫn xem 6 chỉ tiêu tăng trưởng nhưng không thấy phí. Máy chủ chỉ trả số phí cho người có
-- quyền này (app/api/admin/phantich/phi), xét theo vai trò có hiệu lực ở phòng của công ty.
--
-- Không có bảng mới. Vai trò admin có is_system = true nên luôn có quyền mà không cần dòng gán.
-- Module rời — KHÔNG đưa vào bản clone (bỏ file này cùng app/soatbaocao, lib/phanTich).
--
-- Chạy: dán vào SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

insert into permissions (key, label, group_name) values
  ('xem_phi_de_xuat', 'Xem phí đang thu và phí đề xuất theo biểu phí ở màn Tăng trưởng & phí (Soát xét báo cáo)', 'Soát xét báo cáo')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key) values
  ('leader', 'xem_phi_de_xuat')
on conflict do nothing;
