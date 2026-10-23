-- Phân hệ Tiền lương — mã nhân viên, ngày vào làm, nhập file máy chấm công (anh chốt 23/10/2026).
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần không sao.

-- 1) Nhân viên: mã theo phần mềm chấm công (không trùng, không phân biệt hoa thường), ngày vào làm (báo
--    cáo thâm niên), và cờ "chấm công bằng máy" — bỏ tick cho nhân viên online + ban giám đốc: họ tự khai
--    công như cũ, nhập file máy chấm công bỏ qua họ.
alter table staff add column if not exists ma_nhan_vien  text;
alter table staff add column if not exists ngay_vao_lam  date;
alter table staff add column if not exists cham_cong_may boolean not null default true;
create unique index if not exists staff_ma_nhan_vien_uniq on staff (upper(ma_nhan_vien)) where ma_nhan_vien is not null;

-- 2) Bảng công: nguồn số liệu + số gốc của máy + ghi chú báo sai.
--    nguon = tu_khai | may_cham_cong. Từ máy thì nhân viên KHÔNG sửa số, chỉ Xác nhận hoặc Báo sai
--    (trang_thai = bao_sai, ghi chú ở cột bao_sai) → trưởng phòng / kế toán sửa có lý do.
alter table luong_cham_cong add column if not exists nguon   text not null default 'tu_khai';
alter table luong_cham_cong add column if not exists may     jsonb;   -- HC, công tác, thứ Bảy cộng thêm, phép, đột xuất, KL, thai sản, đi muộn/về sớm, tên file
alter table luong_cham_cong add column if not exists bao_sai text;

select
  (select count(*) from information_schema.columns where table_name = 'staff' and column_name in ('ma_nhan_vien', 'ngay_vao_lam', 'cham_cong_may')) as cot_staff_3,
  (select count(*) from information_schema.columns where table_name = 'luong_cham_cong' and column_name in ('nguon', 'may', 'bao_sai')) as cot_cham_cong_3;
