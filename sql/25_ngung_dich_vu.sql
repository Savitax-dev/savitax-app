-- 25. Tháng ngưng dịch vụ của công ty.
--
-- Trước đây "Ngưng dịch vụ" chỉ là một trạng thái: bấm ngưng là công ty biến khỏi mọi màn hình,
-- kể cả khoản phí chưa thu. Nay lưu THÁNG NGƯNG: từ tháng đó trở đi không tính phí, không tính
-- công việc/KPI; các tháng trước đó vẫn tính để khoản chưa thu còn được theo dõi và ghi thu.
--
-- service_end = ngày 01 của tháng ngưng (ngưng từ T10/2026 -> 2026-10-01). NULL = chưa ngưng,
-- hoặc đã ngưng từ trước mà không biết tháng (khi đó chỉ theo dõi phần đã nằm trong sổ nợ tồn).

alter table clients add column if not exists service_end date;

-- Điền sẵn cho các công ty đã có nhật ký đổi trạng thái (nhật ký có từ 23/09/2026): lấy tháng của
-- lần chuyển sang "Ngưng dịch vụ" gần nhất, theo giờ Việt Nam.
update clients c
set service_end = date_trunc('month', l.changed_at at time zone 'Asia/Ho_Chi_Minh')::date
from (
  select distinct on (client_id) client_id, changed_at
  from client_change_log
  where entity = 'client_info' and field = 'status' and new_value::text ilike '%ngưng%'
  order by client_id, changed_at desc
) l
where c.id = l.client_id and c.status = 'inactive' and c.service_end is null;

-- XOÁ NỢ không đòi được của công ty đã ngưng dịch vụ (chỉ Quản trị, bắt buộc ghi lý do).
-- Không xoá thầm số trong clients.other_debt: mỗi lần xoá để lại một dòng ở đây, nên báo cáo dòng
-- tiền vẫn cộng trừ khớp (tồn đầu + phát sinh − đã thu − đã xoá = chuyển kỳ sau) và tra lại được
-- ai xoá, bao nhiêu, vì sao.
create table if not exists debt_writeoffs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id),
  year        int  not null,
  month       int  not null,          -- kỳ thực hiện xoá (giờ Việt Nam)
  amount      numeric not null,
  reason      text not null,
  detail      jsonb,                  -- nợ tồn cũ / phí từng kỳ chưa thu tại lúc xoá
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists debt_writeoffs_client_idx on debt_writeoffs (client_id);
alter table debt_writeoffs enable row level security;
grant all on debt_writeoffs to service_role;

-- Kiểm: danh sách công ty ngưng + tháng ngưng (NULL = cần hỏi kế toán nội bộ).
select name, status, service_end from clients where status = 'inactive' order by service_end nulls first, name;
