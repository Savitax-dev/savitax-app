-- Phân hệ Tờ khai — tờ khai 01/CNKD của HỘ KINH DOANH (anh chốt 28/10/2026).
--
-- Hộ kinh doanh / cá nhân kinh doanh nộp 01/CNKD (TT40/2021): một tờ gộp thuế GTGT + TNCN của chủ
-- hộ, kỳ khai và hạn nộp như 01/GTGT (theo tháng/quý của hộ). Có khấu trừ TNCN cho người lao động
-- thì nộp thêm 05/KK-TNCN như doanh nghiệp. Luật "loại nào áp cho ai" nằm ở lib/tokhaiLich.js
-- (loaiApDung) — doanh nghiệp không bao giờ có 01/CNKD.
--
-- Chỉ thêm DỮ LIỆU danh mục, không đổi cấu trúc bảng. Production đã thêm qua scripts/hkd-01cnkd.mjs;
-- file này để bản clone (ABS, NYD, Linh Phong) chạy lại. Chạy nhiều lần vẫn an toàn.
--
-- ma_tkhai_portal để trống: hồ sơ cổng trả về không kèm mã tờ khai đọc được → app nhận 01/CNKD theo
-- MÃ THỦ TỤC 1.011022 (lib/tokhaiGhi.js).

insert into tax_filing_types (code, name, tax_kind, period_kind, ma_tkhai_portal, sort_order) values
  ('01/CNKD', 'Tờ khai thuế đối với hộ kinh doanh, cá nhân kinh doanh', 'CNKD', 'quarter', null, 15)
on conflict (code) do nothing;

comment on column clients.is_hkd is
  'Hộ kinh doanh / cá nhân kinh doanh. Nộp 01/CNKD (TT40/2021); 05/KK-TNCN, 01/GTGT chỉ khi đã từng nộp; không quyết toán năm. Xem lib/tokhaiLich.js loaiApDung.';
