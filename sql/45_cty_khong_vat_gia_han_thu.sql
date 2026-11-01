-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CÔNG TY ĐẶC THÙ VỀ CÔNG NỢ (anh chốt 01/11/2026) — xem lib/ctyDacThu.js
--   khong_vat          : thu phí KHÔNG VAT (không xuất hóa đơn) → lương / hoa hồng / thưởng không chia 1,08,
--                        phiếu Đề nghị thanh toán không có dòng VAT
--   gia_han_thu_thang  : admin cho khách trả chậm N tháng (phí kế toán) → lùi hạn sửa công nợ + hạn chuyển nợ tồn
--                        N tháng; kỳ đang gia hạn mà chưa thu đủ thì tạm không tính %-công nợ
--   gia_han_thu_ly_do  : lý do gia hạn (bắt buộc khi bật)
-- Người có quyền cong_no_dac_thu đặt được (route /api/admin/clients/dac-thu) — gán sẵn vai trò Nhân viên NB (anh chốt
-- 01/11/2026: Cao Hồng Vân khai báo phần này), Quản trị luôn có. Chạy lại nhiều lần vẫn an toàn.
-- Code đọc 3 cột bằng truy vấn riêng nên chạy trước hay sau khi đẩy code đều được.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table clients add column if not exists khong_vat boolean not null default false;
alter table clients add column if not exists gia_han_thu_thang integer not null default 0;
alter table clients add column if not exists gia_han_thu_ly_do text;

do $$ begin
  alter table clients add constraint clients_gia_han_thu_thang_chk check (gia_han_thu_thang between 0 and 12);
exception when duplicate_object then null; end $$;

insert into permissions (key, label, group_name) values
  ('cong_no_dac_thu', 'Đặt công nợ đặc thù cho công ty (thu phí không VAT, gia hạn thu)', 'Công nợ')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
select 'nhan_vien_nb', 'cong_no_dac_thu'
where exists (select 1 from roles where id = 'nhan_vien_nb')
  and not exists (select 1 from role_permissions where role_id = 'nhan_vien_nb' and permission_key = 'cong_no_dac_thu');

-- Kiểm tra: select id, name, khong_vat, gia_han_thu_thang, gia_han_thu_ly_do from clients where khong_vat or gia_han_thu_thang > 0;
