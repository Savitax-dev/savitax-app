-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CÔNG TY ĐẶC THÙ VỀ CÔNG NỢ (anh chốt 01/11/2026) — xem lib/ctyDacThu.js
--   khong_vat          : thu phí KHÔNG VAT (không xuất hóa đơn) → lương / hoa hồng / thưởng không chia 1,08,
--                        phiếu Đề nghị thanh toán không có dòng VAT
--   gia_han_thu_thang  : admin cho khách trả chậm N tháng (phí kế toán) → lùi hạn sửa công nợ + hạn chuyển nợ tồn
--                        N tháng; kỳ đang gia hạn mà chưa thu đủ thì tạm không tính %-công nợ
--   gia_han_thu_ly_do  : lý do gia hạn (bắt buộc khi bật)
-- Chỉ admin thật đặt được (route /api/admin/clients/dac-thu). Chạy lại nhiều lần vẫn an toàn.
-- Code đọc 3 cột bằng truy vấn riêng nên chạy trước hay sau khi đẩy code đều được.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table clients add column if not exists khong_vat boolean not null default false;
alter table clients add column if not exists gia_han_thu_thang integer not null default 0;
alter table clients add column if not exists gia_han_thu_ly_do text;

do $$ begin
  alter table clients add constraint clients_gia_han_thu_thang_chk check (gia_han_thu_thang between 0 and 12);
exception when duplicate_object then null; end $$;

-- Kiểm tra: select id, name, khong_vat, gia_han_thu_thang, gia_han_thu_ly_do from clients where khong_vat or gia_han_thu_thang > 0;
