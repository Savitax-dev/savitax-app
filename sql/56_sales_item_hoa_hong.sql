-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÒNG KINH DOANH — tách "Savitax thu tiền" và "có tính hoa hồng Phòng Kinh doanh"
-- (anh chốt 25/11/2026)
--
-- Trước đây chỉ có MỘT ô `to_savitax`, vừa mang nghĩa "tiền có về tài khoản Savitax không"
-- vừa bị dùng làm căn cứ tính doanh số. Anh cần thêm: có dịch vụ Savitax VẪN THU TIỀN nhưng
-- KHÔNG tính hoa hồng cho Phòng Kinh doanh. Dùng chung một ô là bỏ tick sẽ mất luôn khoản đó
-- khỏi công nợ cần thu — sai tiền thật.
--
--   to_savitax     = tiền có về tài khoản Savitax không (MISA ASP khách trả thẳng cho nhà
--                    cung cấp -> false). Ảnh hưởng CẦN THU / công nợ và ghi chú trên file Word.
--   tinh_hoa_hong  = khoản này có tính hoa hồng Phòng Kinh doanh không.
--                    Ảnh hưởng DOANH SỐ / THƯỞNG. Vẫn vào cần thu như thường.
-- Không `to_savitax` thì cũng không tính hoa hồng (app tự hiểu, không cần sửa dữ liệu).
--
-- ⚠ BẢN CLONE (ABS, NYD...) KHÔNG CHẠY FILE NÀY. Chạy lại nhiều lần vẫn an toàn.
-- Dòng phí cũ mặc định true = giữ nguyên cách tính hiện nay, không làm đổi số đã chốt.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table sales_quote_items
  add column if not exists tinh_hoa_hong boolean not null default true;

comment on column sales_quote_items.tinh_hoa_hong is
  'Có tính hoa hồng / doanh số Phòng Kinh doanh không. Khác to_savitax: khoản này Savitax vẫn thu tiền và vẫn nằm trong công nợ.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiểm tra sau khi chạy
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) from information_schema.columns
--   where table_name = 'sales_quote_items' and column_name = 'tinh_hoa_hong';          -- 1
-- select tinh_hoa_hong, count(*) from sales_quote_items group by 1;                    -- tất cả true
