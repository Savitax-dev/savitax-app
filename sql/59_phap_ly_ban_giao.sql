-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ PHÁP LÝ — GIAI ĐOẠN 4 (tiếp): bàn giao cho khách (bước 9) (Savitax, 17/11/2026)
-- Đi sau sql/58. Chạy lại an toàn. ⚠ Đang thử trên DATABASE DEMO — CHƯA chạy production. Bản clone không chạy.
-- Danh mục bàn giao lưu thẳng trên hồ sơ (jsonb [{ten, so_luong, ghi_chu}]) — in ra Biên bản bàn giao (mẫu BBBG).
-- Điều kiện đóng hồ sơ tính ở lib/phaply/banGiao.js (dieuKienDong), không lưu.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
alter table legal_cases add column if not exists ban_giao_ngay       date;
alter table legal_cases add column if not exists ban_giao_nguoi_nhan text;
alter table legal_cases add column if not exists ban_giao_ghi_chu    text;
alter table legal_cases add column if not exists ban_giao_muc        jsonb not null default '[]'::jsonb;
