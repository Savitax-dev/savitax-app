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

// ── Phần CÔNG TY đóng (anh yêu cầu 23/10/2026: xuất tổng số tiền đóng BHXH) — không trừ vào lương ──
//   BHXH 17,5% (hưu trí 14% + ốm đau thai sản 3% + tai nạn LĐ-BNN 0,5%) · BHYT 3% · BHTN 1%
//   → cùng 10,5% người lao động = 32% nộp cơ quan BHXH. Kinh phí công đoàn công ty 2% (nộp công đoàn).
// Chỉ người tham gia BHXH, tính trên lương đóng BHXH. Excel có sheet Tham số để sửa tỉ lệ.
export const CONG_TY_DONG = { bhxh: 0.175, bhyt: 0.03, bhtn: 0.01, kpcd: 0.02 }
export function congTyDong(luongBhxh, thamGiaBhxh) {
  if (!thamGiaBhxh) return { bhxh: 0, bhyt: 0, bhtn: 0, kpcd: 0, nopBhxh: 0, tong: 0 }
  const lbh = Number(luongBhxh) || 0
  const bhxh = Math.round(lbh * CONG_TY_DONG.bhxh), bhyt = Math.round(lbh * CONG_TY_DONG.bhyt), bhtn = Math.round(lbh * CONG_TY_DONG.bhtn)
  const kpcd = Math.round(lbh * CONG_TY_DONG.kpcd)
  return { bhxh, bhyt, bhtn, kpcd, nopBhxh: bhxh + bhyt + bhtn, tong: bhxh + bhyt + bhtn + kpcd }
}
