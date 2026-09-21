-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG KINH DOANH — tình trạng khách 7 bước (người dùng chốt 2026-09-21)
--   Đang chăm sóc → Gửi khảo sát → Gửi báo giá → Chốt báo giá → Gửi hợp đồng → Chốt hợp đồng | Thất bại
--
-- Mã lưu trong sales_leads.stage:
--   tu_van (Đang chăm sóc) · gui_khao_sat · bao_gia (Gửi báo giá) · chot_bao_gia · gui_hd · chot · that_bai
--   'moi' (Mới) gộp vào "Đang chăm sóc": chuyển hết sang tu_van, vẫn để trong danh sách hợp lệ để code cũ
--   (còn chạy tới lúc deploy) không lỗi khi tạo khách mới.
--
-- CHẠY TRƯỚC KHI DEPLOY code mới. Chỉ thêm giá trị hợp lệ + đổi 'moi' → 'tu_van'; code cũ vẫn chạy bình
-- thường (hiện "Đang tư vấn" thay cho "Mới"). Chạy lại nhiều lần vẫn an toàn.
-- Dòng "drop constraint" chỉ bỏ ràng buộc CŨ để tạo lại bản có thêm 2 mã mới — không xoá dữ liệu nào.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table sales_leads drop constraint if exists sales_leads_stage_check;
alter table sales_leads add constraint sales_leads_stage_check
  check (stage in ('moi','tu_van','gui_khao_sat','bao_gia','chot_bao_gia','gui_hd','chot','that_bai'));

alter table sales_leads alter column stage set default 'tu_van';

update sales_leads set stage = 'tu_van' where stage = 'moi';

-- Kiểm tra: phải ra 0
-- select count(*) from sales_leads where stage = 'moi';
