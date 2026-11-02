// "Không hỏi lại trên máy này" cho xác thực 2 lớp (anh yêu cầu 02/11/2026) — CHỈ chạy ở máy chủ.
//
// Nhập đúng mã + tick ô → máy chủ ghi cookie httpOnly 30 ngày: <userId>.<factorId>.<hết hạn>.<chữ ký HMAC>.
// Lần sau phiên chỉ có mật khẩu (aal1) mà cookie hợp lệ thì coi như đã qua 2 lớp (lib/serverAuth.js).
// Chữ ký gắn với yếu tố 2 lớp đang dùng → quản trị đặt lại / người dùng tắt-bật lại 2 lớp là mọi máy đã tin cậy mất hiệu lực.
// Khoá ký suy từ SUPABASE_SERVICE_ROLE_KEY (chỉ máy chủ có) — không cần thêm biến môi trường.
import crypto from 'node:crypto'

export const COOKIE_TIN_CAY = 'svt_2lop_tin_cay'
export const SO_NGAY_TIN_CAY = 30

const khoa = () => crypto.createHmac('sha256', String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')).update('savitax-2lop-thiet-bi').digest()
const ky = (s) => crypto.createHmac('sha256', khoa()).update(s).digest('base64url')

export function taoGiayTinCay(userId, factorId) {
  const het = Date.now() + SO_NGAY_TIN_CAY * 86400e3
  const than = userId + '.' + factorId + '.' + het
  return than + '.' + ky(than)
}

// factorIds: các yếu tố 2 lớp ĐÃ XÁC NHẬN hiện tại của tài khoản
export function kiemGiayTinCay(giay, userId, factorIds) {
  const p = String(giay || '').split('.')
  if (p.length !== 4) return false
  const [uid, fid, het, chuKy] = p
  if (uid !== userId || !factorIds.includes(fid) || !(Number(het) > Date.now())) return false
  const dung = ky(uid + '.' + fid + '.' + het)
  return dung.length === chuKy.length && crypto.timingSafeEqual(Buffer.from(dung), Buffer.from(chuKy))
}

export const yeuToDaXacNhan = user => (user?.factors || []).filter(f => f.status === 'verified').map(f => f.id)
