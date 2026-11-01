-- ═══════════════════════════════════════════════════════════════════════════════════════
-- HOA HỒNG GIỚI THIỆU — bậc theo SỐ KHÁCH HOẶC DOANH SỐ, điều kiện nào đến trước (anh chốt 01/11/2026)
-- Chính sách "Lợi ích hợp tác" (Kế toán thuế):
--   10% phí dịch vụ hàng tháng: từ 1 đến 20 khách hàng  hoặc doanh số từ 1tr  đến 30tr
--   15%                       : từ 21 đến 30 khách hàng hoặc doanh số từ 31tr đến 50tr
--   20%                       : từ 31 đến 50 khách hàng hoặc doanh số từ 51tr đến 80tr  (trên đó vẫn 20%)
-- Doanh số = tổng phí dịch vụ HẰNG THÁNG (chưa VAT; kế toán + HCNS, công ty quý ÷ 3) của các khách ĐANG dùng dịch vụ do
-- người đó giới thiệu. Tỉ lệ = mức CAO HƠN giữa bậc theo số khách và bậc theo doanh số (lib/luong/hoaHong.js).
-- Hoa hồng vẫn tính trên tiền THỰC THU tại từng lần thu (không đổi). Chạy lại nhiều lần vẫn an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table luong_hoa_hong_bac add column if not exists tu_doanh_so numeric
  check (tu_doanh_so is null or tu_doanh_so >= 0);

insert into luong_hoa_hong_bac (tu_so_cty, ty_le, tu_doanh_so) values
  (1,  10,  1000000),
  (21, 15, 31000000),
  (31, 20, 51000000)
on conflict (tu_so_cty) do update set ty_le = excluded.ty_le, tu_doanh_so = excluded.tu_doanh_so, sua_luc = now();

-- Kiểm tra: select * from luong_hoa_hong_bac order by tu_so_cty;
