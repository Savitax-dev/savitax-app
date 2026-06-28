-- Ngày bắt đầu hợp đồng / sử dụng dịch vụ của công ty.
-- Dùng cho: (1) xuất hợp đồng (thời hạn, số HĐ), (2) mốc bắt đầu tính tỉ lệ
-- công việc/công nợ/KPI khi công ty chuyển từ "Trình ký" sang "Đang sử dụng".
-- Công ty cũ không có giá trị này (NULL) → tính mọi tháng như trước, không ảnh hưởng.
-- Trạng thái "Trình ký" dùng giá trị status = 'pending' (cột status là text, không cần đổi schema).

alter table clients add column if not exists contract_start date;
