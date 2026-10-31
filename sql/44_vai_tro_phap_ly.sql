-- ═══════════════════════════════════════════════════════════════════════════════════════
-- VAI TRÒ PHÒNG PHÁP LÝ (31/10/2026) — đi cùng phòng 'Pháp lý' (sql/43). Như HCNS / Kinh doanh (sql/06, sql/13):
-- hai vai trò, gán sẵn quyền chấm công (tự khai / xác nhận công của mình). Quyền nghiệp vụ pháp lý thêm khi có
-- phân hệ riêng (giai đoạn 2). Trưởng phòng muốn xem công cả phòng: tích thêm 'cham_cong_toan_cty' ở "Vai trò &
-- phân quyền" (quyền đó xem toàn công ty, không thấy lương).
-- Chạy lại nhiều lần vẫn an toàn. Bản clone không chạy file này.
-- ═══════════════════════════════════════════════════════════════════════════════════════

insert into roles (id, label, is_system) values
  ('phaply',        'Pháp lý',              false),
  ('phaply_leader', 'Trưởng phòng Pháp lý', false)
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_key)
select r, 'cham_cong' from unnest(array['phaply', 'phaply_leader']) as r
where not exists (select 1 from role_permissions x where x.role_id = r and x.permission_key = 'cham_cong');

-- Kiểm tra: select * from roles where id like 'phaply%';
