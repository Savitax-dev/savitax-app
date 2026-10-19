// Phân hệ Tiền lương — quy tắc THƯỞNG. Hàm THUẦN, dùng chung cho máy chủ, trang và bộ kiểm
// scripts/test-luong-thuong.mjs. Anh chốt 14–17/10/2026. BƯỚC 2 của phân hệ (xem lib/luong/README.md).
//
// Kỳ số liệu của bảng lương tháng N:
//   %-công việc tháng N−1 · %-công nợ tháng N−2 · doanh thu thực tế tháng N−1.

export const THUONG_KPI = { duoi: 80, tren: 90, mucGiua: 300000, mucCao: 500000 }

// Thưởng một chỉ số KPI (công việc, công nợ, hay điểm KPI phòng):
//   dưới 80% → 0 · từ 80% đến 90% → 300.000 · TRÊN 90% → 500.000 (đúng 90% vẫn là 300.000).
export function thuongTheoKpi(pct) {
  if (pct === null || pct === undefined || !isFinite(pct)) return 0
  if (pct < THUONG_KPI.duoi) return 0
  if (pct <= THUONG_KPI.tren) return THUONG_KPI.mucGiua
  return THUONG_KPI.mucCao
}

export const TY_LE_VUOT_DOANH_SO = 0.2

// Thưởng doanh số.
//   Nhân viên:    (doanh thu thực tế − doanh thu tối thiểu theo cấp) × 20%; chưa đạt tối thiểu thì 0.
//   Trưởng phòng: 20% × phí các công ty tự mình phụ trách ("làm thêm"), không xét mức tối thiểu.
// Làm tròn tới đồng.
export function thuongDoanhSo({ doanhThu, toiThieu, laTruongPhong }) {
  const dt = Number(doanhThu) || 0
  if (laTruongPhong) return Math.round(dt * TY_LE_VUOT_DOANH_SO)
  if (toiThieu === null || toiThieu === undefined) return 0
  const vuot = dt - Number(toiThieu)
  return vuot > 0 ? Math.round(vuot * TY_LE_VUOT_DOANH_SO) : 0
}

// Doanh thu tính lương của MỘT công ty trong một tháng: phí kế toán phải thu (không cần đã thu),
//   - TÁCH VAT 8%: monthly_fee lưu số ĐÃ GỒM VAT (nhập ở "Thêm công ty"), doanh số trong bảng lương
//     của anh là số chưa VAT. Đối chiếu file lương mẫu 17/10/2026: 4/4 nhân viên khớp từng đồng
//     sau khi chia 1,08 (vd Kim Ngân 56.160.000 → 52.000.000). Cùng hệ số với app/api/admin/dntt.
//   - quy về THÁNG: công ty đóng theo quý thì monthly_fee là tiền cả quý, chia 3 cho mỗi tháng.
export const HE_SO_VAT = 1.08
export function doanhThuThangCuaCongTy(phiKy, feePeriod) {
  const p = (Number(phiKy) || 0) / HE_SO_VAT
  return Math.round(feePeriod === 'quarterly' ? p / 3 : p)
}

// Thưởng một dòng khai Dịch vụ khác.
export const tienThuongDvk = (soTien, tyLe) => Math.round((Number(soTien) || 0) * (Number(tyLe) || 0) / 100)

// Lương theo ngày công.
export function luongTheoCong(luongCoBan, ngayTinhLuong, ngayCongChuan) {
  if (!ngayCongChuan) return 0
  return Math.round((Number(luongCoBan) || 0) * (Number(ngayTinhLuong) || 0) / Number(ngayCongChuan))
}

// Tháng lùi k tháng: thangLui(2026, 1, 2) → { nam: 2025, thang: 11 }
export function thangLui(nam, thang, k) {
  let y = nam, m = thang - k
  while (m < 1) { m += 12; y-- }
  return { nam: y, thang: m }
}
