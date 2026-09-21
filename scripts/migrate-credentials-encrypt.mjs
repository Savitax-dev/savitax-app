// Chuyển mật khẩu trong client_credentials từ CHỮ RÕ sang mã hóa (cột password_enc).
//
// Mặc định CHỈ XEM TRƯỚC, không ghi gì. Ghi thật thì thêm --apply.
//   node --env-file=.env.local scripts/migrate-credentials-encrypt.mjs
//   node --env-file=.env.local scripts/migrate-credentials-encrypt.mjs --apply
//
// Trước khi chạy:
//   1. Đã chạy sql/15_tokhai_module.sql (tạo cột password_enc).
//   2. Đã có TAX_ENC_KEY trong .env.local VÀ trong Vercel — hai nơi phải là CÙNG MỘT khóa,
//      lệch nhau là app không giải mã được thứ script này vừa ghi.
//   3. Đã có bản backup gần nhất (app có backup hằng tuần, xem app/api/cron/backup).
//
// Script KHÔNG xóa cột password chữ rõ — giữ lại để còn đường lùi. Xóa ở một lần chạy SQL sau,
// khi đã dùng thật vài ngày và chắc chắn mọi màn hình đọc đúng.
//
// Chạy lại nhiều lần vẫn an toàn: dòng nào đã mã hóa thì bỏ qua.
import { createClient } from '@supabase/supabase-js'
import { encrypt, isEncrypted, decrypt, maskPassword } from '../lib/taxCrypto.js'

const APPLY = process.argv.includes('--apply')

if (!process.env.TAX_ENC_KEY) {
  console.error('THIẾU TAX_ENC_KEY. Sinh khóa mới:')
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"')
  console.error('rồi thêm vào .env.local và Vercel (Settings → Environment Variables).')
  process.exit(1)
}

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: rows, error } = await s
  .from('client_credentials')
  .select('id, client_id, category, label, username, password, password_enc')
  .order('category')
if (error) { console.error('Đọc dữ liệu thất bại:', error.message); process.exit(1) }

const { data: clients } = await s.from('clients').select('id, name, client_code')
const tenCty = new Map(clients.map(c => [c.id, c.client_code || c.name]))

const canLam = rows.filter(r => r.password && !r.password_enc)
const daXong = rows.filter(r => r.password_enc)
const khongCo = rows.filter(r => !r.password && !r.password_enc)

console.log(`Tổng số dòng thông tin đăng nhập: ${rows.length}`)
console.log(`  · đã mã hóa rồi        : ${daXong.length}`)
console.log(`  · không có mật khẩu    : ${khongCo.length}`)
console.log(`  · CẦN MÃ HÓA           : ${canLam.length}`)

if (!canLam.length) { console.log('\nKhông còn gì để làm.'); process.exit(0) }

const theoLoai = {}
for (const r of canLam) theoLoai[r.category] = (theoLoai[r.category] || 0) + 1
console.log('\nTheo loại thông tin:', Object.entries(theoLoai).map(([k, v]) => `${k}=${v}`).join(', '))

console.log('\nDanh sách sẽ xử lý (mật khẩu hiển thị dạng che):')
for (const r of canLam) {
  console.log(`  ${(tenCty.get(r.client_id) || '?').padEnd(28).slice(0, 28)} | ${r.category.padEnd(13)} | ` +
              `${(r.label || '').padEnd(16).slice(0, 16)} | ${maskPassword(r.password)}`)
}

if (!APPLY) {
  console.log('\n(chỉ xem trước — chưa ghi gì)')
  console.log('Ghi thật:  node --env-file=.env.local scripts/migrate-credentials-encrypt.mjs --apply')
  process.exit(0)
}

console.log('\nĐang ghi…')
let ok = 0, hong = 0
for (const r of canLam) {
  const ma = encrypt(r.password)

  // Kiểm ngay tại chỗ: giải mã lại phải ra đúng mật khẩu gốc mới cho ghi. Thà dừng còn hơn ghi
  // một chuỗi hỏng rồi sau này không ai mở ra được.
  if (!isEncrypted(ma) || decrypt(ma) !== r.password) {
    console.error(`  HỎNG ${tenCty.get(r.client_id)} / ${r.category}: mã hóa rồi giải mã không khớp — DỪNG`)
    process.exit(1)
  }

  const { error: e } = await s.from('client_credentials').update({ password_enc: ma }).eq('id', r.id)
  if (e) { console.error(`  HỎNG ${tenCty.get(r.client_id)} / ${r.category}: ${e.message}`); hong++ }
  else ok++
}

console.log(`\nXong: ${ok} dòng đã mã hóa${hong ? `, ${hong} dòng lỗi` : ''}.`)

// Đọc lại từ DB để chắc chắn, không tin vào biến trong bộ nhớ.
const { data: kiem } = await s.from('client_credentials').select('id, password, password_enc').not('password_enc', 'is', null)
let lech = 0
for (const r of kiem) {
  if (r.password && decrypt(r.password_enc) !== r.password) lech++
}
console.log(lech === 0
  ? 'Kiểm lại từ DB: tất cả bản mã đều giải ra đúng mật khẩu gốc.'
  : `CẢNH BÁO: ${lech} dòng giải mã không khớp — KHÔNG được xóa cột password chữ rõ.`)

console.log('\nBước tiếp theo: dùng app vài ngày, kiểm mọi màn hình đọc đúng, rồi mới chạy SQL xóa')
console.log('cột password chữ rõ. Trước khi xóa, cột đó vẫn là đường lùi duy nhất.')
