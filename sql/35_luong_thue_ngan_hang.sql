-- Phân hệ Tiền lương — thuế TNCN, người phụ thuộc, tài khoản nhận lương (anh chốt 20/10/2026).
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần không sao.
--
-- 1) Số người phụ thuộc đi theo LỊCH SỬ lương (luong_nhan_vien, "áp dụng từ tháng") — thêm / bớt người
--    phụ thuộc thì tháng cũ giữ số cũ. Giảm trừ 6.200.000đ / người / tháng (lib/luong/thueTncn.js).
alter table luong_nhan_vien add column if not exists so_nguoi_phu_thuoc int not null default 0;
do $$ begin
  alter table luong_nhan_vien add constraint luong_nhan_vien_npt_chk check (so_nguoi_phu_thuoc between 0 and 20);
exception when duplicate_object then null; end $$;

-- 2) Tài khoản nhận lương — mỗi người một dòng, KHÔNG theo tháng. Kế toán nội bộ (manage_payroll) nhập
--    ở trang Quản lý nhân viên; nhân viên chỉ thấy trên phiếu lương của mình. Chỉ đọc/ghi qua API
--    (service role) nên bật RLS và cố ý không có policy.
create table if not exists luong_ngan_hang (
  staff_id      uuid primary key references staff(id) on delete cascade,
  ngan_hang     text,
  so_tai_khoan  text,          -- để dạng chữ: giữ số 0 đầu
  chu_tai_khoan text,
  sua_boi       uuid references staff(id) on delete set null,
  sua_luc       timestamptz not null default now()
);
alter table luong_ngan_hang enable row level security;

-- Thuế TNCN không cần cột mới: tính lại mỗi lần từ số liệu tháng, và nằm trong bản chụp jsonb của
-- luong_bang_chot khi chốt.

select
  (select count(*) from information_schema.columns where table_name = 'luong_nhan_vien' and column_name = 'so_nguoi_phu_thuoc') as co_cot_npt,
  (select count(*) from luong_ngan_hang) as so_tai_khoan_da_nhap;
