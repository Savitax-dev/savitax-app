-- Ngày thu thực tế của khoản thu hồ sơ HCNS (2026-09-22).
--
-- Báo cáo "Tồn đầu kỳ / Đã thu trong kỳ" trước đây tính theo ngày GHI VÀO APP (created_at). Khách
-- trả 25/08 mà nhân viên ghi 09/09 thì báo cáo hiểu nhầm là thu tháng 9 -> tồn đầu kỳ tháng 9 bị
-- phình (ca DT. GROUP). paid_at = ngày khách trả thật, nhân viên chọn khi ghi; để trống thì báo cáo
-- vẫn lấy ngày ghi như cũ.
--
-- Chạy lại nhiều lần an toàn.

alter table hcns_case_payments add column if not exists paid_at date;
