-- Phân hệ TIỀN LƯƠNG — bổ sung 19/10/2026: tác phong tự tính, phụ cấp / điều chỉnh trên app,
-- gửi phiếu lương cho nhân viên xác nhận. Chạy MỘT LẦN trong Supabase SQL Editor (sau sql/31–33).
-- Chạy lại không hỏng gì.

-- 1) Số lần vi phạm tác phong — nhân viên tự khai cùng ngày công, khoá khi xác nhận (TP sửa được).
--    % tác phong của người = 100 − 20 × số lần (sàn 0); % tác phong phòng = trung bình cả phòng.
alter table luong_cham_cong add column if not exists so_lan_vi_pham int not null default 0;
do $$ begin
  alter table luong_cham_cong add constraint luong_cham_cong_vi_pham_chk check (so_lan_vi_pham between 0 and 50);
exception when duplicate_object then null; end $$;

-- 2) Phụ cấp + điều chỉnh ngoại lệ (giám đốc duyệt) — kế toán nội bộ nhập trên tab Bảng lương.
create table if not exists luong_dieu_chinh (
  nam         int  not null,
  thang       int  not null check (thang between 1 and 12),
  staff_id    uuid not null references staff(id) on delete cascade,
  phu_cap     numeric not null default 0,
  dieu_chinh  numeric not null default 0,            -- có thể âm
  ly_do       text,
  sua_boi     uuid references staff(id) on delete set null,
  sua_luc     timestamptz not null default now(),
  primary key (nam, thang, staff_id)
);

-- 3) Gửi phiếu lương: tháng đã chốt mới gửi được; nhân viên xác nhận hoặc báo sai từng phiếu.
alter table luong_bang_chot add column if not exists da_gui  boolean not null default false;
alter table luong_bang_chot add column if not exists gui_luc timestamptz;
alter table luong_bang_chot add column if not exists gui_boi uuid references staff(id) on delete set null;

create table if not exists luong_phieu_xac_nhan (
  nam        int  not null,
  thang      int  not null check (thang between 1 and 12),
  staff_id   uuid not null references staff(id) on delete cascade,
  trang_thai text not null default 'cho_xac_nhan',   -- cho_xac_nhan | da_xac_nhan | bao_sai
  ghi_chu    text,                                    -- nhân viên ghi khi báo sai
  thuc_linh  numeric,                                 -- số thực lĩnh lúc gửi — gửi lại mà số đổi thì xác nhận lại
  luc        timestamptz not null default now(),
  primary key (nam, thang, staff_id),
  constraint luong_phieu_tt_chk check (trang_thai in ('cho_xac_nhan', 'da_xac_nhan', 'bao_sai'))
);

alter table luong_dieu_chinh      enable row level security;
alter table luong_phieu_xac_nhan  enable row level security;

select (select count(*) from information_schema.columns where table_name = 'luong_cham_cong' and column_name = 'so_lan_vi_pham') as cot_vi_pham,
       (select count(*) from luong_dieu_chinh) as dieu_chinh,
       (select count(*) from luong_phieu_xac_nhan) as phieu;
