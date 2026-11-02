// XÁC THỰC 2 LỚP (anh duyệt 02/11/2026): mật khẩu + mã 6 số trên ứng dụng Google Authenticator / Microsoft Authenticator
// (TOTP — Supabase Auth MFA có sẵn, miễn phí). SMS về số điện thoại làm sau, khi công ty có nhà mạng gửi tin + tên
// thương hiệu SAVITAX.
//
// Ba lớp chặn:
//   1. MÁY CHỦ (lib/serverAuth.js) — chốt thật: tài khoản đã bật 2 lớp mà phiên chưa nhập mã (aal1) thì mọi /api/admin
//      đều trả "chưa đăng nhập". Bật BAT_BUOC_HAI_LOP thì người CHƯA bật cũng bị chặn tới khi cài xong.
//   2. Trang đăng nhập (app/login) — sau mật khẩu hỏi mã 6 số / hướng dẫn quét QR.
//   3. AppShell — đang ở trang nào mà phiên chưa đủ 2 lớp thì đưa về /login.
// Quản trị đặt lại 2 lớp cho nhân viên mất / đổi điện thoại: /api/admin/hai-lop (trang Quản lý nhân viên).

// Bước 3 của lộ trình: true = ai chưa bật 2 lớp thì đăng nhập xong PHẢI quét QR mới vào được app. Giai đoạn đầu để
// false (tự nguyện, app nhắc) — đổi thành true khi anh bảo.
export const BAT_BUOC_HAI_LOP = false

// Bản demo (demo.savitax.vn): tài khoản dùng chung cho khách xem → không dùng 2 lớp (một người bật là khoá cả nhóm).
export const TAT_HAI_LOP = process.env.NEXT_PUBLIC_DEMO_MODE === '1'

// Mức xác thực (aal1 = mật khẩu, aal2 = đã nhập mã 2 lớp) ghi trong access token của Supabase
export function aalCuaToken(token) {
  try {
    const phan = String(token || '').split('.')[1]
    if (!phan) return null
    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(phan.replace(/-/g, '+').replace(/_/g, '/'))))
      : Buffer.from(phan, 'base64url').toString('utf8')
    return JSON.parse(json).aal || null
  } catch { return null }
}

// Tài khoản đã có yếu tố 2 lớp ĐÃ XÁC NHẬN chưa (đối tượng user của Supabase Auth)
export const daBatHaiLop = user => (user?.factors || []).some(f => f.status === 'verified')

// Phía trình duyệt: phiên hiện tại cần gì thêm?
//   { canMa: đã bật 2 lớp nhưng phiên chưa nhập mã, canCaiDat: bắt buộc mà chưa bật, daBat }
export async function trangThaiHaiLop(supabase) {
  if (TAT_HAI_LOP) return { canMa: false, canCaiDat: false, daBat: false }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return { canMa: false, canCaiDat: false, daBat: false }
  const daBat = data.nextLevel === 'aal2'
  let canMa = daBat && data.currentLevel !== 'aal2'
  // Máy đã tick "Không hỏi lại trên máy này" (cookie httpOnly — chỉ máy chủ đọc được, lib/haiLopThietBi.js)
  if (canMa) {
    try { canMa = !(await fetch('/api/hai-lop/thiet-bi', { cache: 'no-store' }).then(r => r.json())).tinCay } catch { /* lỗi mạng thì vẫn hỏi mã */ }
  }
  return { daBat, canMa, canCaiDat: BAT_BUOC_HAI_LOP && !daBat }
}
