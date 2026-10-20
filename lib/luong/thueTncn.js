// Phân hệ Tiền lương — THUẾ TNCN. Hàm THUẦN. BƯỚC 3 của phân hệ (xem lib/luong/README.md).
//
// ── Anh chốt 20/10/2026 (thay quy tắc "không TNCN" ngày 14/10) ────────────────
// Người THAM GIA BHXH (chính thức) → biểu lũy tiến 5 bậc:
//   Thu nhập chịu thuế = lương theo công + toàn bộ thưởng + phụ cấp + điều chỉnh
//   Thu nhập tính thuế = thu nhập chịu thuế − 15.500.000 (bản thân) − 6.200.000 × người phụ thuộc
//                        − BHXH người lao động đóng (10,5%)                    (dưới 0 thì = 0)
//   Thuế: ≤10tr 5% · ≤30tr 10% − 500k · ≤60tr 20% − 3,5tr · ≤100tr 30% − 9,5tr · trên 35% − 14,5tr
// Người KHÔNG tham gia BHXH (thử việc, học việc) → khấu trừ 10% trên tổng thu nhập, không giảm trừ.
// CỐ Ý không áp mốc "từ 2 triệu mới khấu trừ" của luật: anh chốt 20/10/2026 công ty khấu trừ trên mọi
// khoản cho chắc, không phân biệt thu nhập bao nhiêu. Đừng thêm mốc 2 triệu khi chưa hỏi lại anh.
export const GIAM_TRU = { banThan: 15500000, nguoiPhuThuoc: 6200000 }
export const TY_LE_KHAU_TRU_KHONG_BHXH = 0.10
// [trần của bậc, thuế suất, số trừ nhanh]
export const BAC_THUE = [
  [10000000, 0.05, 0],
  [30000000, 0.10, 500000],
  [60000000, 0.20, 3500000],
  [100000000, 0.30, 9500000],
  [Infinity, 0.35, 14500000],
]

export function thueLuyTien(thuNhapTinhThue) {
  const t = Number(thuNhapTinhThue) || 0
  if (t <= 0) return 0
  const [, ts, tru] = BAC_THUE.find(([tran]) => t <= tran)
  return Math.round(t * ts - tru)
}

// thuNhap: tổng thu nhập tháng (đã gồm phụ cấp, điều chỉnh); bhxh: tiền BHXH 10,5% người lao động đóng.
export function thueTncn({ thuNhap, thamGiaBhxh, soNguoiPhuThuoc = 0, bhxh = 0 }) {
  const chiuThue = Math.max(0, Math.round(Number(thuNhap) || 0))
  if (!thamGiaBhxh) {
    return { cach: 'khau_tru_10', thuNhapChiuThue: chiuThue, giamTruBanThan: 0, giamTruPhuThuoc: 0, giamTruBhxh: 0,
      thuNhapTinhThue: chiuThue, thue: Math.round(chiuThue * TY_LE_KHAU_TRU_KHONG_BHXH) }
  }
  const npt = Math.max(0, Math.floor(Number(soNguoiPhuThuoc) || 0))
  const giamTruPhuThuoc = npt * GIAM_TRU.nguoiPhuThuoc
  const giamTruBhxh = Math.max(0, Number(bhxh) || 0)
  const tinhThue = Math.max(0, chiuThue - GIAM_TRU.banThan - giamTruPhuThuoc - giamTruBhxh)
  return { cach: 'luy_tien', soNguoiPhuThuoc: npt, thuNhapChiuThue: chiuThue, giamTruBanThan: GIAM_TRU.banThan, giamTruPhuThuoc,
    giamTruBhxh, thuNhapTinhThue: tinhThue, thue: thueLuyTien(tinhThue) }
}
