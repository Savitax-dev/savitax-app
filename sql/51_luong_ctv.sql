-- Tiền lương — LƯƠNG CTV (phòng remote: Danxia, Dakshin, CTV Savitax), anh chốt 06/11/2026.
-- Tách riêng hoàn toàn khỏi bảng lương nhân viên Savitax (luong_bang_chot / luong_phieu_xac_nhan không đổi).
-- Không chấm công: hoa hồng = tỷ lệ × doanh thu phí kế toán phải thu theo kỳ (chưa VAT) của công ty phụ trách chính
-- → SVT giữ lại 20% (cộng dồn, quản trị bấm trả tay) → thuế TNCN 10% trên thu nhập → thực nhận.
-- Chạy lại nhiều lần vẫn an toàn.

-- Bản chụp bảng lương CTV từng tháng (giống luong_bang_chot)
create table if not exists luong_ctv_chot (
  nam              int  not null,
  thang            int  not null check (thang between 1 and 12),
  du_lieu          jsonb not null,
  chot_boi         uuid references staff(id) on delete set null,
  chot_luc         timestamptz not null default now(),
  da_mo            boolean not null default false,
  mo_boi           uuid references staff(id) on delete set null,
  mo_luc           timestamptz,
  ly_do_mo         text,
  da_gui           boolean not null default false,
  gui_luc          timestamptz,
  da_chuyen_luong  boolean not null default false,
  chuyen_luong_luc timestamptz,
  chuyen_luong_boi uuid references staff(id) on delete set null,
  primary key (nam, thang)
);

-- Phiếu lương CTV gửi từng người xác nhận (giống luong_phieu_xac_nhan)
create table if not exists luong_ctv_phieu (
  nam        int  not null,
  thang      int  not null check (thang between 1 and 12),
  staff_id   uuid not null references staff(id) on delete cascade,
  trang_thai text not null default 'cho_xac_nhan',   -- cho_xac_nhan | da_xac_nhan | bao_sai
  ghi_chu    text,
  thuc_nhan  numeric,
  luc        timestamptz not null default now(),
  primary key (nam, thang, staff_id),
  constraint luong_ctv_phieu_tt_chk check (trang_thai in ('cho_xac_nhan', 'da_xac_nhan', 'bao_sai'))
);

-- Sổ tiền SVT GIỮ LẠI: 'giu' ghi khi chốt tháng (mở chốt thì xoá), 'tra' = quản trị bấm trả lại ở tháng đó
-- (cộng vào thu nhập tháng trả). Số còn giữ của một người = Σ giu − Σ tra.
create table if not exists luong_ctv_giu_lai (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  nam        int  not null,
  thang      int  not null check (thang between 1 and 12),
  loai       text not null check (loai in ('giu', 'tra')),
  so_tien    numeric not null check (so_tien >= 0),
  ghi_chu    text,
  tao_boi    uuid references staff(id) on delete set null,
  tao_luc    timestamptz not null default now(),
  unique (staff_id, nam, thang, loai)
);
create index if not exists luong_ctv_giu_lai_staff_idx on luong_ctv_giu_lai (staff_id);

alter table luong_ctv_chot     enable row level security;
alter table luong_ctv_phieu    enable row level security;
alter table luong_ctv_giu_lai  enable row level security;
grant all privileges on table luong_ctv_chot, luong_ctv_phieu, luong_ctv_giu_lai to service_role;

select (select count(*) from luong_ctv_chot) as so_thang_chot,
       (select count(*) from luong_ctv_phieu) as so_phieu,
       (select count(*) from luong_ctv_giu_lai) as so_dong_giu_lai;
