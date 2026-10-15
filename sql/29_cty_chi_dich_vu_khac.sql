-- Công ty CHỈ dùng Dịch vụ khác, không làm dịch vụ kế toán.
--
-- Anh chốt 14/10/2026: "các cty chỉ sử dụng dịch vụ khác, không làm dịch vụ kế toán nên các
-- checklist không áp dụng. Thêm phần tick Dịch vụ khác để thêm cty chỉ sử dụng DVK để theo dõi
-- công nợ."
--
-- Công ty dạng này không có phí định kỳ, không có checklist tháng, không nộp tờ khai. Việc duy
-- nhất cần theo dõi là công nợ của từng hồ sơ Dịch vụ khác (other_services, sql/24) — phần chưa
-- thu tự chuyển kỳ sau y như nợ tồn, cơ chế đó đã chạy sẵn, không phải làm gì thêm.
--
-- ⚠ BẪY PHẢI NHỚ: công ty 0 việc đang được chấm 100% công việc
--   (app/api/admin/room/route.js + kpi-overview/route.js: `tasks.length === 0 ? 100`).
-- Nếu chỉ thêm cột này rồi để công ty DVK ra 0 việc là nhân viên được 100% MIỄN PHÍ cho mỗi công
-- ty DVK — càng nhiều công ty DVK thì %-công việc càng đẹp. Nên mã nguồn LOẠI HẲN công ty DVK
-- khỏi mẫu số, không phải cho 0 việc rồi thôi. Xem scripts/test-dvk-only.mjs.
--
-- Công nợ: nợ DVK nằm NGOÀI %-thu hồi công nợ, đúng như mọi công ty hiện nay (chỉ số đó chỉ tính
-- phí kế toán). Anh chốt giữ nguyên, chỉ theo dõi qua các kỳ.
--
-- THỨ TỰ: chạy lúc nào cũng được, trước hay sau khi đẩy mã đều không sao.
--
-- Bản đầu em nhét `dvk_only` thẳng vào danh sách cột của trang Phòng, và thiếu cột thì PostgREST
-- hỏng NGUYÊN cả truy vấn — máy anh hiện "0 công ty · 9 nhân viên" ở TOÀN BỘ các phòng ngày
-- 14/10/2026. Nay cột này được đọc bằng một truy vấn riêng có nuốt lỗi (lib/dvkOnly.js): chưa có
-- cột thì chỉ có nghĩa là "chưa công ty nào thuộc nhóm này", app chạy y như trước. Bản clone chưa
-- chạy file này cũng không hỏng.
--
-- Chạy lại nhiều lần vẫn an toàn.

alter table clients add column if not exists dvk_only boolean not null default false;

-- Lọc nhanh khi trang phòng / KPI loại nhóm này ra khỏi phép tính.
create index if not exists clients_dvk_only_idx on clients (dvk_only) where dvk_only;

-- Kiểm tra sau khi chạy:
-- select count(*) from clients where dvk_only;
