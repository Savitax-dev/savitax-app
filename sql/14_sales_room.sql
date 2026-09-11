-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG KINH DOANH — tạo phòng để gán nhân viên kinh doanh
--
-- ⚠ CHẠY SAU KHI CODE MODULE PHÒNG KINH DOANH ĐÃ LÊN PRODUCTION (sau sql/13_sales_module.sql).
--   Code CŨ chỉ loại phòng type='hcns' khỏi menu "Phòng nghiệp vụ", trang Phòng ban, KPI và công nợ
--   phòng — chạy file này trước khi deploy thì phòng "Kinh doanh" (không có công ty nào) sẽ hiện
--   lẫn vào các chỗ đó. Code mới loại cả type='kinhdoanh'.
--
-- Chạy lại nhiều lần vẫn an toàn. Bản clone không chạy file này.
-- ═══════════════════════════════════════════════════════════════════════════════════════

insert into rooms (name, type)
select 'Kinh doanh', 'kinhdoanh'
where not exists (select 1 from rooms where type = 'kinhdoanh');

-- Kiểm tra: phải ra đúng 1 dòng "Kinh doanh | kinhdoanh"
-- select name, type from rooms where type = 'kinhdoanh';
