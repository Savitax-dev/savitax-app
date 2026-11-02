-- Phụ cấp / điều chỉnh NHIỀU DÒNG cho mỗi nhân viên mỗi tháng (anh yêu cầu 02/11/2026).
-- Mỗi dòng: { id, loai: 'phu_cap' | 'dieu_chinh', so_tien, noi_dung, nguoi (staff id), luc }.
-- Cột phu_cap / dieu_chinh / ly_do GIỮ NGUYÊN làm số TỔNG (máy chủ tự cộng từ chi_tiet khi lưu) — bảng lương,
-- thuế TNCN, Excel, chốt lương vẫn đọc hai cột tổng như cũ.
alter table luong_dieu_chinh add column if not exists chi_tiet jsonb not null default '[]'::jsonb;

select count(*) as so_dong_dieu_chinh,
       (select count(*) from information_schema.columns where table_name = 'luong_dieu_chinh' and column_name = 'chi_tiet') as co_cot_chi_tiet
from luong_dieu_chinh;
