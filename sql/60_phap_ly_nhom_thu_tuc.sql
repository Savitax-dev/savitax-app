-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ PHÁP LÝ — mỗi nhóm thủ tục một trang (anh yêu cầu 17/11/2026): Thay đổi · Tạm ngừng · Giải thể · Khác
-- Đi sau sql/59. Chạy lại an toàn. ⚠ Đang thử trên DATABASE DEMO — CHƯA chạy production. Bản clone không chạy.
-- "Lấy thông tin qua lại": hồ sơ mới trên công ty đã có dùng LẠI legal_entities (cùng entity_id) → doanh nghiệp, người, CCCD,
-- ngành nghề dùng chung; case_goc_id nối hồ sơ tiếp theo (VD hoạt động lại / gia hạn sau một lần tạm ngừng).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
alter table legal_cases add column if not exists case_goc_id        uuid references legal_cases(id) on delete set null;
alter table legal_cases add column if not exists noi_dung_thay_doi  text[] not null default '{}';   -- lib/phaply/nhom.js NOI_DUNG_THAY_DOI
-- Tạm ngừng: khoảng tạm ngừng của LẦN này (theo dõi cả sau khi hồ sơ đã đóng) + lần nhắc khách gần nhất
alter table legal_cases add column if not exists tam_ngung_tu       date;
alter table legal_cases add column if not exists tam_ngung_den      date;
alter table legal_cases add column if not exists nhac_khach_luc     timestamptz;
alter table legal_cases add column if not exists nhac_khach_boi     uuid references staff(id) on delete set null;
alter table legal_cases add column if not exists nhac_khach_ghi_chu text;
-- Hoạt động lại: ngày tiếp tục kinh doanh
alter table legal_cases add column if not exists hoat_dong_lai_tu   date;
create index if not exists legal_cases_entity_idx on legal_cases (entity_id);
create index if not exists legal_cases_goc_idx on legal_cases (case_goc_id);
create index if not exists legal_cases_tam_ngung_idx on legal_cases (tam_ngung_den) where tam_ngung_den is not null;
