-- ⚠ CHỈ CHẠY TRÊN DATABASE BẢN DEMO (demo.savitax.vn) — KHÔNG BAO GIỜ chạy trên production.
-- scripts/demo/dung-csdl.mjs tự chạy file này sau khi kiểm chắc chắn đang trỏ vào project demo.
--
-- demo_la_ban_demo : bảng ĐÁNH DẤU — chỉ DB demo có. Hàm xoá dưới đây tự từ chối nếu không thấy bảng này,
--                    nên kể cả lỡ tay tạo hàm ở nơi khác cũng không xoá được gì.
-- demo_xoa_sach()  : xoá sạch MỌI bảng public (trừ bảng đánh dấu) để nạp lại bộ dữ liệu mẫu mỗi đêm.
--                    Chỉ service_role gọi được (route /api/cron/demo-reset).

create table if not exists demo_la_ban_demo (id int primary key, ghi_chu text);
insert into demo_la_ban_demo values (1, 'Database bản demo — dữ liệu giả, làm mới mỗi đêm') on conflict (id) do nothing;
alter table demo_la_ban_demo enable row level security;

create or replace function demo_xoa_sach() returns void
language plpgsql security definer set search_path = public as $$
declare ds text;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'demo_la_ban_demo') then
    raise exception 'Không phải database bản demo — từ chối xoá';
  end if;
  select string_agg(format('%I', table_name), ', ') into ds
    from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'demo_la_ban_demo';
  if ds is not null then execute 'truncate table ' || ds || ' restart identity cascade'; end if;
end $$;

revoke all on function demo_xoa_sach() from public, anon, authenticated;
grant execute on function demo_xoa_sach() to service_role;
