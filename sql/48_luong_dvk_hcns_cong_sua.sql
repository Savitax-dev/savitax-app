-- Tiền lương — hai việc anh yêu cầu 03/11/2026. Chạy lại nhiều lần vẫn an toàn.
--
-- 1) Thưởng Dịch vụ khác: nhân viên HCNS khai thưởng theo DỊCH VỤ trong hồ sơ Thời điểm (hcns_case_services) —
--    chỉ dịch vụ đã Hoàn thành VÀ đã thu (đủ hoặc một phần). Dòng khai trỏ về dịch vụ HCNS bằng cột mới;
--    service_id (other_services) để trống. Bản clone không có HCNS thì KHÔNG chạy phần này.
alter table luong_dvk_khai add column if not exists hcns_case_service_id uuid references hcns_case_services(id) on delete set null;
create index if not exists luong_dvk_khai_hcns_idx on luong_dvk_khai (hcns_case_service_id);

-- 2) Chấm công: người KHÁC sửa bảng công (trưởng phòng, HCNS chấm công toàn công ty, quản trị) thì bảng công quay
--    về "Chờ bạn xác nhận" — nhân viên chỉ Xác nhận đúng / Báo sai, không tự sửa đè số. Cột ghi lần sửa đang chờ:
--    { boi, ten, ly_do, luc, truoc: {...} }. Nhân viên xác nhận xong thì về null.
alter table luong_cham_cong add column if not exists sua_cho_xac_nhan jsonb;

select
  (select count(*) from information_schema.columns where table_name = 'luong_dvk_khai' and column_name = 'hcns_case_service_id') as co_cot_dvk_hcns,
  (select count(*) from information_schema.columns where table_name = 'luong_cham_cong' and column_name = 'sua_cho_xac_nhan') as co_cot_cong_sua;
