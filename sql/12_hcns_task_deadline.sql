-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Hạn hoàn thành cho công việc trong mẫu checklist HCNS
--
-- ⚠ CHẠY FILE NÀY TRƯỚC KHI DEPLOY code mới.
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần vẫn an toàn, không xoá gì.
-- ⚠ Bản clone KHÔNG chạy file này (thuộc module HCNS).
--
-- Vì sao cần: checklist "DV HCNS Thời Kỳ" là việc làm ĐỀU hàng tháng, mỗi việc có hạn theo NGÀY
-- TRONG THÁNG (vd "File theo dõi BHXH — ngày 20"). Không có cột này thì chỉ đếm được tỉ lệ đã
-- tích, không phân biệt được làm đúng hạn hay làm muộn — trong khi %-KPI của phòng kế toán chỉ
-- tính việc làm ĐÚNG HẠN. Thêm cột để hai phòng dùng chung một nguyên tắc.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Ngày hạn trong tháng (1-31). NULL = việc không có hạn theo ngày.
--
-- 24 dịch vụ theo hồ sơ (nhóm BHXH / HCNS) để NULL và không bị ảnh hưởng: thời hạn của chúng tính
-- từ ngày nhận hồ sơ, đã lưu nguyên văn ở cột `note`, khác hẳn hạn theo ngày trong tháng.
alter table hcns_service_template_tasks
  add column if not exists deadline_day integer;

-- Chặn số ngày vô lý ngay từ database, không phụ thuộc giao diện nhớ kiểm.
-- Ngày 29-31 vẫn nhận: lib/deadline.js tự lùi về ngày cuối tháng khi tháng đó ngắn hơn.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hcns_tpl_tasks_deadline_day_range'
  ) then
    alter table hcns_service_template_tasks
      add constraint hcns_tpl_tasks_deadline_day_range
      check (deadline_day is null or (deadline_day between 1 and 31));
  end if;
end $$;

-- Kiểm tra sau khi chạy — phải trả về 1
-- select count(*) from information_schema.columns
--   where table_name = 'hcns_service_template_tasks' and column_name = 'deadline_day';
