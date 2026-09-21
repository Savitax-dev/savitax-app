// Kiểm lib/taxCrypto.js trước khi đem mã hóa dữ liệu thật.
// Chạy:  node --env-file=.env.local scripts/test-tax-crypto.mjs
// Chưa có TAX_ENC_KEY thì script tự sinh một khóa tạm để chạy thử.
//
// Mọi chuỗi dưới đây là mật khẩu BỊA để kiểm thuật toán — tuyệt đối không đưa mật khẩu
// thật của khách vào file này vì file được commit lên GitHub.

import crypto from 'node:crypto'

if (!process.env.TAX_ENC_KEY) {
  process.env.TAX_ENC_KEY = crypto.randomBytes(32).toString('base64')
  console.log('(chưa có TAX_ENC_KEY, dùng khóa tạm để chạy thử)\n')
}

const { encrypt, decrypt, isEncrypted, maskPassword } = await import('../lib/taxCrypto.js')

let hong = 0
const kiem = (ten, dieuKien) => {
  console.log((dieuKien ? '  OK   ' : '  HỎNG ') + ten)
  if (!dieuKien) hong++
}

// Mật khẩu thật của khách hay có dấu tiếng Việt, ký tự lạ, khoảng trắng đầu/cuối.
const mau = [
  'MatKhauGia@123',
  'Matkhau#2026',
  'có dấu tiếng Việt àáãạ',
  'ký tự lạ ~!@#$%^&*()_+{}|:"<>?',
  ' khoảng trắng hai đầu ',
  'x',
  'a'.repeat(500),
]

console.log('Mã hóa rồi giải mã ra đúng chuỗi ban đầu:')
for (const goc of mau) {
  const ma = encrypt(goc)
  kiem(`"${goc.slice(0, 28)}${goc.length > 28 ? '…' : ''}"`, decrypt(ma) === goc)
}

console.log('\nCác trường hợp biên:')
kiem('rỗng / null trả null', encrypt('') === null && encrypt(null) === null && decrypt(null) === null)
kiem('nhận diện được chuỗi đã mã hóa', isEncrypted(encrypt('abc')) === true)
kiem('không nhầm chữ rõ là đã mã hóa', isEncrypted('MatKhauGia@123') === false)
kiem('dữ liệu cũ chưa mã hóa vẫn đọc được', decrypt('mat khau cu') === 'mat khau cu')

const a = encrypt('trùng nhau')
const b = encrypt('trùng nhau')
kiem('cùng một mật khẩu mã hóa 2 lần ra 2 chuỗi khác nhau (có iv ngẫu nhiên)', a !== b)
kiem('  …nhưng giải mã vẫn ra cùng kết quả', decrypt(a) === decrypt(b))

// Sửa trộm 1 ký tự trong bản mã — GCM phải phát hiện ra.
const ma = encrypt('mật khẩu quan trọng')
const phan = ma.split('.')
phan[3] = (phan[3][0] === 'A' ? 'B' : 'A') + phan[3].slice(1)
let batDuoc = false
try { decrypt(phan.join('.')) } catch { batDuoc = true }
kiem('sửa trộm dữ liệu trong DB thì giải mã báo lỗi, không trả chuỗi rác', batDuoc)

// Sai khóa
const maCu = encrypt('bí mật')
const khoaCu = process.env.TAX_ENC_KEY
process.env.TAX_ENC_KEY = crypto.randomBytes(32).toString('base64')
let batKhoaSai = false
try { decrypt(maCu) } catch { batKhoaSai = true }
kiem('sai khóa thì báo lỗi rõ ràng', batKhoaSai)
process.env.TAX_ENC_KEY = khoaCu
kiem('đổi khóa rồi trả lại thì vẫn giải mã được như cũ', decrypt(maCu) === 'bí mật')

// Khóa dán vào thực tế đủ kiểu: base64 32 byte, base64 42 byte, hex, chuỗi chữ thường.
console.log('')
console.log('Nhận mọi dạng chuỗi khóa:')
for (const k of [
  crypto.randomBytes(32).toString('base64'),
  crypto.randomBytes(42).toString('base64'),
  crypto.randomBytes(32).toString('hex'),
  'mot-chuoi-ngau-nhien-du-dai-de-lam-khoa-2026',
]) {
  process.env.TAX_ENC_KEY = k
  kiem(`${k.length} ký tự`, decrypt(encrypt('thử')) === 'thử')
}
process.env.TAX_ENC_KEY = 'ngan-qua'
let batNgan = false
try { encrypt('x') } catch { batNgan = true }
kiem('khóa ngắn dưới 32 ký tự thì báo lỗi', batNgan)
process.env.TAX_ENC_KEY = khoaCu

console.log('\nChe mật khẩu cho người không có quyền xem:')
kiem('MatKhauGia@123 → ' + maskPassword('MatKhauGia@123'), maskPassword('MatKhauGia@123').startsWith('Ma'))
kiem('không lộ độ dài thật với mật khẩu dài', maskPassword('a'.repeat(99)).length <= 12)
kiem('rỗng trả rỗng', maskPassword('') === '' && maskPassword(null) === '')

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
