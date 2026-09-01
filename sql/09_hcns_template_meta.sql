-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Thêm 2 cột mô tả cho mẫu dịch vụ HCNS
--
-- Chạy trong Supabase SQL Editor SAU sql/06_hcns_module.sql. Chạy lại nhiều lần vẫn an toàn.
-- ⚠ Bản clone KHÔNG chạy file này (thuộc module HCNS).
--
-- Vì sao cần: file "QUY TRÌNH XỬ LÍ HỒ SƠ HCNS.xlsx" có 24 dịch vụ chia 2 nhóm (BHXH và HCNS
-- trọn bộ), mỗi dịch vụ kèm thời hạn nộp và cơ quan xử lý. Không có 2 cột này thì 24 dịch vụ nằm
-- chung một danh sách phẳng, và mất luôn phần thời hạn — vốn là thứ nhân viên cần biết nhất khi
-- nhận hồ sơ.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Nhóm nghiệp vụ: 'BHXH' | 'HCNS' — trang Checklist HCNS tách thành 2 khối cho dễ tìm.
alter table hcns_service_templates add column if not exists group_name text;

-- Thời hạn nộp / thời gian cơ quan giải quyết, ghi nguyên văn theo file quy trình.
alter table hcns_service_templates add column if not exists note text;

-- Kiểm tra sau khi chạy — phải trả về 2
-- select count(*) from information_schema.columns
--   where table_name='hcns_service_templates' and column_name in ('group_name','note');
