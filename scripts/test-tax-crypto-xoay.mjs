// Kiểm đường XOAY KHÓA của lib/taxCrypto.js — chạy trên mật khẩu BỊA, không đụng DB.
//   node scripts/test-tax-crypto-xoay.mjs
//
// Vì sao phải có bộ kiểm riêng: xoay khóa là việc làm MỘT LẦN trên dữ liệu thật, sai là mất sạch
// mật khẩu khách và không có đường khôi phục. Ba điều phải đúng tuyệt đối:
//   [1] có TAX_ENC_KEY_OLD thì dữ liệu mã hóa bằng khóa cũ vẫn đọc được
//   [2] dữ liệu mới LUÔN mã hóa bằng khóa mới, không bao giờ bằng khóa cũ
//   [3] bỏ TAX_ENC_KEY_OLD đi thì dữ liệu chưa xoay phải BÁO LỖI, tuyệt đối không trả chuỗi rác
//
// Mọi chuỗi dưới đây là mật khẩu BỊA. File này được commit lên GitHub.

import crypto from 'node:crypto'

const KHOA_CU = 'khoa-cu-bia-dai-hon-ba-muoi-hai-ky-tu-11'
const KHOA_MOI = 'khoa-moi-bia-dai-hon-ba-muoi-hai-ky-tu-22'
const MAU = ['MatKhauGia@123', 'có dấu tiếng Việt àáãạ', ' khoảng trắng hai đầu ', 'x'.repeat(200)]

let hong = 0
const kiem = (ten, dieuKien) => {
  console.log((dieuKien ? '  OK   ' : '  HỎNG ') + ten)
  if (!dieuKien) hong++
}

// Mỗi lần nạp lại module là một "tiến trình" riêng — đúng như production đọc biến môi trường lúc
// khởi động. Thêm tham số vào URL để Node không dùng lại bản đã nạp trong bộ nhớ.
let lan = 0
const napLai = async () => import(`../lib/taxCrypto.js?lan=${++lan}`)

// ── Trước khi xoay: chỉ có khóa cũ ──────────────────────────────────────────
process.env.TAX_ENC_KEY = KHOA_CU
delete process.env.TAX_ENC_KEY_OLD
const cu = await napLai()
const banMaCu = MAU.map(m => cu.encrypt(m))

console.log('Trước khi xoay (chỉ có khóa cũ):')
kiem('mã hóa rồi giải lại đúng nguyên văn', banMaCu.every((c, i) => cu.decrypt(c) === MAU[i]))

// ── Đang xoay: khóa mới + khóa cũ dự phòng ──────────────────────────────────
process.env.TAX_ENC_KEY = KHOA_MOI
process.env.TAX_ENC_KEY_OLD = KHOA_CU
const giua = await napLai()

console.log('')
console.log('Đang xoay (TAX_ENC_KEY mới + TAX_ENC_KEY_OLD cũ):')
kiem('[1] dữ liệu cũ vẫn đọc được bằng khóa dự phòng',
  banMaCu.every((c, i) => giua.decrypt(c) === MAU[i]))
kiem('[1] khoaNaoMoDuoc nhận ra là khóa cũ', banMaCu.every(c => giua.khoaNaoMoDuoc(c) === 'cu'))

const banMaMoi = MAU.map(m => giua.encrypt(m))
kiem('[2] dữ liệu ghi mới dùng khóa MỚI, không phải khóa cũ',
  banMaMoi.every(c => giua.khoaNaoMoDuoc(c) === 'moi'))
kiem('[2] dữ liệu ghi mới giải lại đúng', banMaMoi.every((c, i) => giua.decrypt(c) === MAU[i]))

// Đây là việc script xoay làm: mở bằng khóa cũ, mã hóa lại bằng khóa mới.
const daXoay = banMaCu.map(c => giua.encrypt(giua.decrypt(c)))
kiem('mã hóa lại xong thì thuộc khóa MỚI', daXoay.every(c => giua.khoaNaoMoDuoc(c) === 'moi'))
kiem('mã hóa lại xong nội dung không đổi', daXoay.every((c, i) => giua.decrypt(c) === MAU[i]))

// ── Sau khi xoay: bỏ khóa cũ đi ─────────────────────────────────────────────
process.env.TAX_ENC_KEY = KHOA_MOI
delete process.env.TAX_ENC_KEY_OLD
const sau = await napLai()

console.log('')
console.log('Sau khi xoay (đã bỏ TAX_ENC_KEY_OLD):')
kiem('dữ liệu đã xoay vẫn đọc được', daXoay.every((c, i) => sau.decrypt(c) === MAU[i]))
let neml = 0
for (const c of banMaCu) { try { sau.decrypt(c) } catch { neml++ } }
kiem('[3] dữ liệu CHƯA xoay thì BÁO LỖI, không trả chuỗi rác', neml === banMaCu.length)
kiem('[3] khoaNaoMoDuoc nói thẳng là không đọc được',
  banMaCu.every(c => sau.khoaNaoMoDuoc(c) === 'khong-doc-duoc'))

// ── Chặn cái bẫy đã xảy ra thật ─────────────────────────────────────────────
console.log('')
console.log('Chặn khóa hỏng:')
const LENH_SINH_KHOA = 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
process.env.TAX_ENC_KEY = LENH_SINH_KHOA
const xau = await napLai()
let chan = false
try { xau.encrypt('abc') } catch (e) { chan = /câu lệnh sinh khóa/.test(e.message) }
kiem('dán nguyên câu lệnh sinh khóa → CHẶN GHI (bẫy 29/09/2026)', chan)

// Cố ý CHO ĐỌC: nếu bản này lên production trước khi xoay khóa xong thì màn hình Thông tin đăng
// nhập vẫn chạy, chỉ không lưu được mật khẩu mới. Chặn cả đọc là chết cả phòng.
process.env.TAX_ENC_KEY = KHOA_CU
const ghiBangKhoaThat = await napLai()
const banMaCanDoc = ghiBangKhoaThat.encrypt('MatKhauGia@123')
process.env.TAX_ENC_KEY = LENH_SINH_KHOA
process.env.TAX_ENC_KEY_OLD = KHOA_CU
const xauDoc = await napLai()
let docDuoc = false
try { docDuoc = xauDoc.decrypt(banMaCanDoc) === 'MatKhauGia@123' } catch { docDuoc = false }
kiem('khóa mẫu vẫn CHO ĐỌC dữ liệu cũ (không làm chết màn hình đang chạy)', docDuoc)
delete process.env.TAX_ENC_KEY_OLD

process.env.TAX_ENC_KEY = 'ngan-qua'
const ngan = await napLai()
let chanNgan = false
try { ngan.encrypt('abc') } catch (e) { chanNgan = /quá ngắn/.test(e.message) }
kiem('khóa ngắn hơn 32 ký tự → chặn', chanNgan)

// Đổi một byte trong bản mã: GCM phải phát hiện, không được trả chuỗi rác.
process.env.TAX_ENC_KEY = KHOA_MOI
const gcm = await napLai()
const goc = gcm.encrypt('MatKhauGia@123')
const phan = goc.split('.')
const bytes = Buffer.from(phan[3], 'base64')
bytes[0] = bytes[0] ^ 0xff
const suaTrom = [phan[0], phan[1], phan[2], bytes.toString('base64')].join('.')
let batDuoc = false
try { gcm.decrypt(suaTrom) } catch { batDuoc = true }
kiem('sửa trộm một byte trong DB → giải mã hỏng ngay', batDuoc)

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
