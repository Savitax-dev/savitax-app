-- Quyền "Sửa thông tin hồ sơ HCNS" (2026-09-21).
-- Trước đây chỉ Quản trị sửa được thông tin hồ sơ Thời điểm (mã hồ sơ, tên, MST, địa chỉ...).
-- Tách thành quyền riêng để tích cho nhân viên HCNS ở trang Vai trò & phân quyền.
-- Xoá hồ sơ VẪN chỉ Quản trị. Chạy lại nhiều lần an toàn.

insert into permissions (key, label, group_name) values
  ('edit_hcns_case_info', 'Sửa thông tin hồ sơ HCNS (mã hồ sơ, tên, MST, địa chỉ...)', 'Phòng HCNS')
on conflict (key) do nothing;

-- Mặc định cấp cho Nhân viên HCNS + Trưởng phòng HCNS (bỏ tích lại được trên giao diện).
insert into role_permissions (role_id, permission_key)
select r, 'edit_hcns_case_info' from unnest(array['hcns', 'hcns_leader']) as r
where exists (select 1 from roles where id = r)
on conflict do nothing;
