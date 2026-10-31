// Loại phòng (rooms.type) KHÔNG phải phòng nghiệp vụ kế toán: không ôm công ty, không KPI / công nợ phòng,
// không hiện ở menu "Phòng nghiệp vụ", trang Phòng ban, xếp hạng; người CHỈ thuộc các phòng này ẩn phân khu Kế toán.
//   hcns      — Phòng HCNS (sql/06)
//   kinhdoanh — Phòng Kinh doanh (sql/14)
//   phaply    — Phòng Pháp lý (sql/43, 31/10/2026): tạm để thêm nhân viên (chấm công, lương); phân hệ riêng làm sau
// Thêm loại mới: chỉ sửa danh sách này. (type='remote' là phòng nghiệp vụ làm từ xa — KHÔNG thuộc danh sách.)
export const PHONG_NGOAI_NGHIEP_VU = ['hcns', 'kinhdoanh', 'phaply']
export const laPhongNgoaiNghiepVu = type => PHONG_NGOAI_NGHIEP_VU.includes(type)
// Dùng cho PostgREST: .not('type', 'in', LOC_PHONG_NGOAI)
export const LOC_PHONG_NGOAI = '(' + PHONG_NGOAI_NGHIEP_VU.join(',') + ')'
