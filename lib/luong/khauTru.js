// Phân hệ Tiền lương — KHOẢN TRỪ. Hàm THUẦN. BƯỚC 3 của phân hệ (xem lib/luong/README.md).
//
// ── Khoản trừ (anh chốt 14/10/2026) — thuế TNCN tính riêng ở thueTncn.js (từ 20/10/2026)
//   BHXH (gồm BHYT, BHTN) 10,5% × lương đóng BHXH
//   Kinh phí công đoàn     0,5% × lương đóng BHXH
//   Phí Đoàn Thanh niên    40.000đ/người
// Cả ba chỉ áp cho nhân viên chính thức CÓ tham gia BHXH (ô tick ở trang Quản lý nhân viên).
export const KHAU_TRU = { bhxh: 0.105, kpcd: 0.005, doanPhi: 40000 }
export function khauTru(luongBhxh, thamGiaBhxh) {
  if (!thamGiaBhxh) return { bhxh: 0, kpcd: 0, doanPhi: 0, tong: 0 }
  const lbh = Number(luongBhxh) || 0
  const bhxh = Math.round(lbh * KHAU_TRU.bhxh), kpcd = Math.round(lbh * KHAU_TRU.kpcd), doanPhi = KHAU_TRU.doanPhi
  return { bhxh, kpcd, doanPhi, tong: bhxh + kpcd + doanPhi }
}
