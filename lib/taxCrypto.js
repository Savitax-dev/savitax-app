// Mã hóa mật khẩu tài khoản cổng thuế (và các mật khẩu khách khác trong client_credentials).
//
// Vì sao cần: hiện 62 mật khẩu của khách đang nằm trong DB dưới dạng CHỮ RÕ, ai đăng nhập app
// cũng đọc được qua API, và client_change_log còn lưu cả mật khẩu cũ lẫn mới. Lộ một bản sao DB
// hoặc một tài khoản nhân viên là lộ hết tài khoản thuế, ngân hàng, BHXH của khách.
//
// Cách làm: AES-256-GCM. GCM tự kèm mã kiểm tra toàn vẹn (tag), nên sửa trộm một byte trong DB là
// giải mã hỏng ngay chứ không ra chuỗi rác âm thầm.
//
// Khóa: biến môi trường TAX_ENC_KEY — một chuỗi ngẫu nhiên đủ dài.
// Đặt vào Vercel (Settings → Environment Variables) và .env.local. MẤT KHÓA LÀ MẤT HẾT MẬT KHẨU,
// không có đường khôi phục — phải cất một bản ở nơi an toàn ngoài Vercel.
//
// ⚠ ĐỪNG VIẾT LỆNH SINH KHÓA VÀO ĐÂY. Chỗ này từng ghi sẵn câu `node -e "...randomBytes(32)..."`
// làm mẫu, và ngày 29/09/2026 soát ra TAX_ENC_KEY thật đang chính là NGUYÊN CÂU LỆNH ĐÓ — ai đó dán
// dòng hướng dẫn thay vì chạy nó. Nghĩa là 66 mật khẩu khách được khóa bằng một chuỗi in sẵn trong
// mã nguồn trên GitHub. Guard "dài trên 32 ký tự" không bắt được vì câu lệnh dài tận 70 ký tự.
// Sinh khóa mới thì dùng `node scripts/xoay-tax-enc-key.mjs --sinh-khoa`, nó ghi ra file ngoài git.
//
// XOAY KHÓA: `TAX_ENC_KEY_OLD` là khóa cũ, chỉ dùng để GIẢI MÃ dự phòng. Mọi lần mã hóa mới đều
// dùng TAX_ENC_KEY. Nhờ vậy xoay khóa không có phút nào production đọc hỏng: đặt khóa mới + khóa cũ
// lên Vercel, chạy script xoay để mã hóa lại toàn bộ, rồi mới bỏ TAX_ENC_KEY_OLD đi.
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

// Chuỗi khóa mà chính mã nguồn này từng in ra làm mẫu. Ai dán nguyên dòng đó vào biến môi trường
// thì coi như không có khóa — chặn thẳng thay vì im lặng cho chạy.
const KHOA_MAU_CU = 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'

let cache = null
let cacheCu = null
let daCanhBao = false

function duoiKhoa(raw, tenBien) {
  if (raw.trim().length < 32) {
    throw new Error(`${tenBien} quá ngắn — cần chuỗi ngẫu nhiên ít nhất 32 ký tự`)
  }
  // Rút ra 32 byte từ chuỗi khóa. Nhớ lại theo đúng chuỗi để khỏi băm lại mỗi lần mã hóa.
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

// `deGhi` = sắp mã hóa dữ liệu mới. Khóa mẫu thì CHẶN HẲN lúc ghi, nhưng vẫn cho ĐỌC: nếu bản này
// lên production trước khi xoay khóa xong, chặn cả đọc là màn hình Thông tin đăng nhập chết cho cả
// phòng. Không ghi thêm dữ liệu bằng khóa công khai mới là điều bắt buộc; đọc dữ liệu cũ thì không
// tệ hơn hôm qua.
function getKey(deGhi = false) {
  const raw = process.env.TAX_ENC_KEY
  if (!raw) throw new Error('Thiếu biến môi trường TAX_ENC_KEY — chưa cấu hình khóa mã hóa mật khẩu')
  if (raw.trim() === KHOA_MAU_CU) {
    if (deGhi) {
      throw new Error('TAX_ENC_KEY đang là câu lệnh sinh khóa in trong mã nguồn, không phải khóa thật — xem scripts/xoay-tax-enc-key.mjs')
    }
    if (!daCanhBao) {
      daCanhBao = true
      console.error('CẢNH BÁO: TAX_ENC_KEY đang là chuỗi mẫu in trong mã nguồn — phải xoay khóa ngay (scripts/xoay-tax-enc-key.mjs)')
    }
  }
  if (!cache || cache.raw !== raw) cache = { raw, key: duoiKhoa(raw, 'TAX_ENC_KEY') }
  return cache.key
}

// Khóa cũ — chỉ có trong lúc đang xoay khóa. Không có thì trả null, KHÔNG báo lỗi.
function getKeyCu() {
  const raw = process.env.TAX_ENC_KEY_OLD
  if (!raw) return null
  if (!cacheCu || cacheCu.raw !== raw) cacheCu = { raw, key: duoiKhoa(raw, 'TAX_ENC_KEY_OLD') }
  return cacheCu.key
}

// Đã mã hóa rồi thì thôi — dùng khi chuyển dữ liệu cũ sang, chạy lại nhiều lần vẫn an toàn.
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX + '.') && value.split('.').length === 4
}

export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, getKey(true), iv)
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
  const ct = Buffer.from(ctB64, 'base64')
  // Thử khóa hiện tại trước, rồi tới khóa cũ (nếu đang xoay khóa). Không sợ nhận nhầm: tag của GCM
  // chỉ khớp với đúng khóa đã mã hóa, sai khóa là final() ném lỗi chứ không ra chuỗi rác.
  for (const key of [getKey(), getKeyCu()]) {
    if (!key) continue
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    } catch { /* thử khóa kế tiếp */ }
  }
  // Sai khóa hoặc dữ liệu bị sửa — nói rõ ra thay vì trả chuỗi rác.
  throw new Error('Giải mã thất bại — sai TAX_ENC_KEY hoặc dữ liệu đã bị thay đổi')
}

// Chuỗi này mã hóa bằng khóa nào — dùng cho script xoay khóa và để soát xem đã xoay hết chưa.
// Trả 'moi' | 'cu' | 'khong-doc-duoc'. Không trả nội dung giải mã ra ngoài.
export function khoaNaoMoDuoc(stored) {
  if (!isEncrypted(stored)) return 'khong-doc-duoc'
  const [, ivB64, tagB64, ctB64] = stored.split('.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return 'khong-doc-duoc'
  const ct = Buffer.from(ctB64, 'base64')
  for (const [ten, key] of [['moi', getKey()], ['cu', getKeyCu()]]) {
    if (!key) continue
    try {
      const d = crypto.createDecipheriv(ALGO, key, iv)
      d.setAuthTag(tag)
      Buffer.concat([d.update(ct), d.final()])
      return ten
    } catch { /* thử khóa kế tiếp */ }
  }
  return 'khong-doc-duoc'
}

// Che mật khẩu để hiện cho người KHÔNG có quyền xem: giữ 2 ký tự đầu cho dễ đối chiếu miệng
// với khách ("mật khẩu bắt đầu bằng pa…"), phần còn lại che hết.
export function maskPassword(plain) {
  if (!plain) return ''
  const s = String(plain)
  if (s.length <= 2) return '•'.repeat(s.length)
  return s.slice(0, 2) + '•'.repeat(Math.min(s.length - 2, 10))
}
