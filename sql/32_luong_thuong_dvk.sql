-- Phân hệ TIỀN LƯƠNG — bước 2: nhân viên tự khai thưởng Dịch vụ khác, trưởng phòng duyệt.
-- Dựng 2026-10-17. Chạy MỘT LẦN trong Supabase SQL Editor (sau sql/31). Chạy lại không hỏng gì.
--
-- Anh chốt 17/10/2026: một hồ sơ dịch vụ khác có thể nhiều người cùng làm, mỗi người một tỉ lệ khác
-- nhau, nên KHÔNG tự chia được. Nhân viên chọn hồ sơ trong danh sách Dịch vụ khác của app, tự nhập
-- số tiền thực nhận + tỉ lệ % được hưởng → app tính tiền thưởng → trưởng phòng duyệt → mới vào bảng
-- lương. App đối chiếu với số đã thu thật trên app và CẢNH BÁO (không chặn) khi khai vượt.
-- Thưởng DVK độc lập với thưởng vượt doanh số: chưa đạt doanh thu tối thiểu vẫn được.

create table if not exists luong_dvk_khai (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references staff(id) on delete cascade,
  nam          int  not null,                       -- KỲ LƯƠNG khoản thưởng này được tính vào
  thang        int  not null check (thang between 1 and 12),
  service_id   uuid references other_services(id) on delete set null,
  client_id    uuid references clients(id) on delete set null,
  ten_dv       text not null,                       -- chụp tên hồ sơ lúc khai (hồ sơ có bị xoá vẫn đọc được)
  so_tien      numeric not null check (so_tien > 0),          -- số tiền thực nhận nhân viên khai
  ty_le        numeric not null check (ty_le > 0 and ty_le <= 100),
  tien_thuong  numeric not null,                    -- = so_tien × ty_le / 100, tính ở máy chủ
  ghi_chu      text,
  trang_thai   text not null default 'cho_duyet',   -- cho_duyet | da_duyet | tra_lai
  ly_do_tra    text,
  duyet_boi    uuid references staff(id) on delete set null,
  duyet_luc    timestamptz,
  tao_luc      timestamptz not null default now(),
  constraint luong_dvk_khai_tt_chk check (trang_thai in ('cho_duyet', 'da_duyet', 'tra_lai'))
);
create index if not exists luong_dvk_khai_ky_idx on luong_dvk_khai (nam, thang);
create index if not exists luong_dvk_khai_dv_idx on luong_dvk_khai (service_id);

alter table luong_dvk_khai enable row level security;

select count(*) as so_dong_khai from luong_dvk_khai;
