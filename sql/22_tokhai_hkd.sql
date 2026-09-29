-- Hộ kinh doanh — Phân hệ Tờ khai.
--
-- VẤN ĐỀ: lịch hạn nộp sinh cho MỌI công ty bằng danh mục tờ khai của doanh nghiệp (01/GTGT,
-- 05/KK-TNCN, 03/TNDN, 05/QTT-TNCN, BCTC). Hộ kinh doanh KHÔNG nộp mấy tờ đó — họ nộp 01/CNKD
-- theo Thông tư 40/2021. Hậu quả: 48 hộ kinh doanh đang mang 344 nghĩa vụ không có thật, và tới
-- hạn là màn hình báo "Quá hạn" đỏ rực cho việc chưa bao giờ tồn tại.
--
-- Cột này để TÁCH HẲN hộ kinh doanh ra, đúng như anh chốt: "khi thêm cty sẽ tick là HKD".
-- Nhận dạng bằng tên ('HỘ KINH DOANH …') chỉ dùng để GỢI Ý lần đầu, không dùng lâu dài —
-- tên do người gõ, sửa một chữ là hỏng.
--
-- Chạy: dán vào SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

alter table clients add column if not exists is_hkd boolean not null default false;

comment on column clients.is_hkd is
  'Hộ kinh doanh / cá nhân kinh doanh. Nộp 01/CNKD (TT40/2021), KHÔNG nộp 01/GTGT, 05/KK-TNCN, 03/TNDN, BCTC. Lịch hạn nộp bỏ qua nhóm này cho tới khi có danh mục tờ khai riêng.';

-- Lọc theo nhóm này sẽ chạy thường xuyên ở màn hình Lịch hạn nộp và Báo cáo.
create index if not exists clients_is_hkd_idx on clients (is_hkd) where is_hkd;
