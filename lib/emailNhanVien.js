// Hộp thư PHỤ của nhân viên — địa chỉ gửi mail khác với email đăng nhập app (29/10/2026).
//
// Mail báo cáo được nhận người gửi theo email: Nhật ký mail báo cáo hiện TÊN nhân viên, Nhật ký làm
// việc ghi mail vào đúng người, nhân viên tự xem chỉ thấy mail của mình. Một số nhân viên có hai hộp
// thư trên máy chủ mail công ty (vd Bùi Thị Minh Thanh đăng nhập app bằng btmthanh@, gửi khách bằng
// bmthanh@ — anh xác nhận 29/10), nên mail từ hộp phụ bị coi là "người ngoài".
//
// Thêm hộp phụ: ghi một dòng 'hộp phụ': 'email đăng nhập app' (chữ thường). KHÔNG đổi email đăng nhập
// của nhân viên để khớp mail — đổi là đổi luôn tài khoản đăng nhập.
const EMAIL_PHU = {
  'bmthanh@savitax.vn': 'btmthanh@savitax.vn',
}

// Email người gửi → email đăng nhập app tương ứng (chữ thường, bỏ khoảng trắng).
export function emailChinh(email) {
  const e = String(email || '').trim().toLowerCase()
  return EMAIL_PHU[e] || e
}
