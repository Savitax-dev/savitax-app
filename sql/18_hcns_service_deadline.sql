-- Hạn hoàn thành CỐ ĐỊNH cho dịch vụ hồ sơ HCNS (2026-09-22).
--
-- hcns_service_templates.sla_days  : số ngày xử lý của mẫu dịch vụ (khai ở trang Checklist HCNS).
-- hcns_case_services.due_at        : hạn hoàn thành, chốt lúc thêm dịch vụ vào hồ sơ
--                                    = ngày nhận + sla_days, BỎ chủ nhật (lib/hcnsDue.js).
--                                    Đổi sla_days của mẫu KHÔNG làm đổi hạn hồ sơ đã mở.
-- hcns_case_services.completed_at  : lúc chuyển sang "Hoàn thành" — để biết xong đúng hạn hay trễ.
--
-- Chạy lại nhiều lần an toàn. Số ngày ban đầu + hạn của dịch vụ đang có do
-- scripts/seed-hcns-sla-days.mjs điền (đọc từ ghi chú mẫu), không làm ở đây.

alter table hcns_service_templates add column if not exists sla_days int;
alter table hcns_case_services    add column if not exists due_at date;
alter table hcns_case_services    add column if not exists completed_at timestamptz;
