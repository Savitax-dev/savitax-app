-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG PHÁP LÝ — tạo phòng để tạm gán nhân viên pháp lý (chấm công, lương), anh yêu cầu 31/10/2026.
-- Giống phòng HCNS / Kinh doanh: type='phaply' nằm trong lib/loaiPhong.js (PHONG_NGOAI_NGHIEP_VU) nên KHÔNG hiện ở
-- menu "Phòng nghiệp vụ", trang Phòng ban, KPI và công nợ phòng; người chỉ thuộc phòng này ẩn phân khu Kế toán.
--
-- ⚠ CHẠY SAU KHI CODE CÓ lib/loaiPhong.js ĐÃ LÊN PRODUCTION — code cũ chỉ loại hcns, kinhdoanh nên phòng
--   "Pháp lý" (không có công ty nào) sẽ hiện lẫn vào các bảng KPI / công nợ phòng.
-- Chạy lại nhiều lần vẫn an toàn. Bản clone không chạy file này.
-- ═══════════════════════════════════════════════════════════════════════════════════════

insert into rooms (name, type)
select 'Pháp lý', 'phaply'
where not exists (select 1 from rooms where type = 'phaply');

-- Kiểm tra: phải ra đúng 1 dòng "Pháp lý | phaply"
-- select name, type from rooms where type = 'phaply';
