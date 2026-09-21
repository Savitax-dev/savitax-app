// Mã hóa mật khẩu tài khoản cổng thuế (và các mật khẩu khách khác trong client_credentials).
//
// Vì sao cần: hiện 62 mật khẩu của khách đang nằm trong DB dưới dạng CHỮ RÕ, ai đăng nhập app
// cũng đọc được qua API, và client_change_log còn lưu cả mật khẩu cũ lẫn mới. Lộ một bản sao DB
// hoặc một tài khoản nhân viên là lộ hết tài khoản thuế, ngân hàng, BHXH của khách.
//
// Cách làm: AES-256-GCM. GCM tự kèm mã kiểm tra toàn vẹn (tag), nên sửa trộm một byte trong DB là
// giải mã hỏng ngay chứ không ra chuỗi rác âm thầm.
//
// Khóa: biến môi trường TAX_ENC_KEY — một chuỗi ngẫu nhiên đủ dài. Sinh khóa mới:
//     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Đặt vào Vercel (Settings → Environment Variables) và .env.local. MẤT KHÓA LÀ MẤT HẾT MẬT KHẨU,
// không có đường khôi phục — phải cất một bản ở nơi an toàn ngoài Vercel.
//
// Không bắt chuỗi phải đúng 32 byte: khóa AES được rút ra bằng SHA-256 của chính chuỗi đó, nên
// dán kiểu gì (base64, hex, dài ngắn khác nhau) cũng chạy. Đổi lại, chuỗi phải GIỮ NGUYÊN TỪNG
// KÝ TỰ — thêm một dấu cách hay xuống dòng là ra khóa khác và không giải mã được dữ liệu cũ.
//
// Chuỗi lưu trong DB có dạng:  v1.<iv base64>.<tag base64>.<bản mã base64>
// Có tiền tố phiên bản để sau này đổi thuật toán hoặc xoay khóa mà vẫn đọc được dữ liệu cũ.
import crypto from 'node:crypto'

const PREFIX = 'v1'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12    // GCM chuẩn dùng 12 byte
const TAG_BYTES = 16

let cache = null
function getKey() {
  const raw = process.env.TAX_ENC_KEY
  if (!raw) throw new Error('Thiếu biến môi trường TAX_ENC_KEY — chưa cấu hình khóa mã hóa mật khẩu')
  if (raw.trim().length < 32) {
    throw new Error('TAX_ENC_KEY quá ngắn — cần chuỗi ngẫu nhiên ít nhất 32 ký tự')
  }
  // Rút ra 32 byte từ chuỗi khóa. Nhớ lại theo đúng chuỗi để khỏi băm lại mỗi lần mã hóa.
  if (!cache || cache.raw !== raw) {
    cache = { raw, key: crypto.createHash('sha256').update(raw, 'utf8').digest() }
  }
  return cache.key
}

// Đã mã hóa rồi thì thôi — dùng khi chuyển dữ liệu cũ sang, chạy lại nhiều lần vẫn an toàn.
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX + '.') && value.split('.').length === 4
}

export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}

export function decrypt(stored) {
  if (stored === null || stored === undefined || stored === '') return null
  // Dữ liệu cũ chưa mã hóa: trả nguyên văn để màn hình không vỡ trong lúc đang chuyển đổi.
  // Bỏ nhánh này sau khi đã chuyển xong toàn bộ và kiểm lại DB không còn chữ rõ.
  if (!isEncrypted(stored)) return String(stored)

  const [, ivB64, tagB64, ctB64] = stored.split('.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Chuỗi mã hóa sai định dạng')
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    // Sai khóa hoặc dữ liệu bị sửa — nói rõ ra thay vì trả chuỗi rác.
    throw new Error('Giải mã thất bại — sai TAX_ENC_KEY hoặc dữ liệu đã bị thay đổi')
  }
}

// Che mật khẩu để hiện cho người KHÔNG có quyền xem: giữ 2 ký tự đầu cho dễ đối chiếu miệng
// với khách ("mật khẩu bắt đầu bằng pa…"), phần còn lại che hết.
export function maskPassword(plain) {
  if (!plain) return ''
  const s = String(plain)
  if (s.length <= 2) return '•'.repeat(s.length)
  return s.slice(0, 2) + '•'.repeat(Math.min(s.length - 2, 10))
}
