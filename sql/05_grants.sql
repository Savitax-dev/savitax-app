-- Cấp quyền cho các role chuẩn của Supabase/PostgREST trên các bảng vừa tạo bằng SQL thô.
-- Khi tạo bảng qua Table Editor (giao diện Dashboard), Supabase tự động GRANT cho anon/
-- authenticated/service_role — nhưng tạo bằng SQL Editor (như 00_bootstrap_core_tables.sql)
-- thì KHÔNG tự động, dẫn tới lỗi "permission denied for table..." kể cả với service_role key
-- (dù service_role bỏ qua RLS, vẫn cần GRANT ở tầng Postgres bên dưới để bắt đầu truy vấn được).
--
-- service_role: toàn quyền (route API dùng key này cho mọi đọc/ghi nghiệp vụ, bỏ qua RLS).
-- authenticated: toàn quyền trên bảng (RLS "allow_authenticated" đã giới hạn thêm ở tầng row).
-- anon: chỉ SELECT tối thiểu (app chỉ dùng anon key để check session đăng nhập, không đọc/ghi
-- nghiệp vụ trực tiếp — nhưng vẫn cấp SELECT phòng trường hợp cần, khớp mặc định của Supabase).

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role, authenticated;
grant select on all tables in schema public to anon;

grant all privileges on all sequences in schema public to service_role, authenticated;
grant usage on all sequences in schema public to anon;

-- Áp dụng luôn cho bảng/sequence tạo SAU này (không phải chạy lại tay mỗi lần thêm bảng mới).
alter default privileges in schema public grant all privileges on tables to service_role, authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant all privileges on sequences to service_role, authenticated;
