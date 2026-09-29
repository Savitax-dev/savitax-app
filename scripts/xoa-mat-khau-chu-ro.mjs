// Xoá mật khẩu CHỮ RÕ còn sót ở cột client_credentials.password.
//
// VÌ SAO: bản chuyển sang mã hóa (scripts/migrate-credentials-encrypt.mjs) cố tình giữ lại cột
// `password` chữ rõ "để còn đường lùi", và ghi chú là xoá ở một lần chạy sau — chưa ai xoá. Soát
// ngày 29/09/2026: 62/62 dòng vẫn còn mật khẩu chữ rõ NẰM NGAY CẠNH bản mã trong cùng một bảng.
// Nghĩa là mã hóa hiện chỉ để trang trí: ai đọc được DB thì chẳng cần khóa nào. Đây là lỗ lớn hơn
// cả việc khóa yếu (xem scripts/xoay-tax-enc-key.mjs).
//
//   node --env-file=.env.local scripts/xoa-mat-khau-chu-ro.mjs           (chỉ soát)
//   node --env-file=.env.local scripts/xoa-mat-khau-chu-ro.mjs --apply   (xoá thật)
//
// BẤT BIẾN KHÔNG ĐƯỢC PHÉP SAI: chỉ xoá chữ rõ của dòng mà bản mã GIẢI RA ĐÚNG CHÍNH CHUỖI CHỮ RÕ
// ĐÓ. Dòng nào lệch, dòng nào chưa có bản mã, dòng nào giải mã hỏng → BỎ LẠI, báo ra. Nhờ vậy
// không có đường nào mất mật khẩu: thứ bị xoá luôn còn một bản đọc được bằng TAX_ENC_KEY.
//
// Nên chạy SAU khi xoay khóa xong, để bản mã còn lại được khóa bằng khóa thật.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const THU_MUC_SAO_LUU = 'C:/Users/win/.savitax-keys'
const APPLY = process.argv.includes('--apply')
const { decrypt } = await import('../lib/taxCrypto.js')

if (!process.env.TAX_ENC_KEY) {
  console.error('Thiếu TAX_ENC_KEY. Chạy với --env-file=.env.local.')
  process.exit(1)
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// PostgREST cắt im lặng ở 1000 dòng — phải lật trang.
const rows = []
for (let tu = 0; ; tu += 1000) {
  const { data, error } = await s.from('client_credentials')
    .select('id, client_id, category, label, password, password_enc').range(tu, tu + 999)
  if (error) { console.error('Đọc dữ liệu thất bại:', error.message); process.exit(1) }
  rows.push(...data)
  if (data.length < 1000) break
}

const xoaDuoc = [], boLai = []
for (const r of rows) {
  if (!r.password) continue                       // không có chữ rõ, không phải việc của script này
  if (!r.password_enc) { boLai.push([r, 'chưa có bản mã — mã hóa trước đã']); continue }
  let giaiRa = null
  try { giaiRa = decrypt(r.password_enc) } catch { boLai.push([r, 'bản mã giải KHÔNG ĐƯỢC']); continue }
  if (giaiRa !== r.password) { boLai.push([r, 'bản mã giải ra KHÁC chữ rõ']); continue }
  xoaDuoc.push(r)
}

console.log(`Tổng dòng thông tin đăng nhập : ${rows.length}`)
console.log(`Còn mật khẩu chữ rõ           : ${rows.filter(r => r.password).length}`)
console.log(`  · xoá được (bản mã khớp)    : ${xoaDuoc.length}`)
console.log(`  · BỎ LẠI                    : ${boLai.length}`)
for (const [r, ly] of boLai) console.log(`      dòng ${r.id} (${r.category}/${r.label || 'không nhãn'}): ${ly}`)
console.log('')

// Thoát bằng process.exit(0) ở đây làm libuv ném "Assertion failed ... async.c" vì máy khách
// Supabase còn việc đang đóng — nhìn như script hỏng dù đã xong. Nên dùng nhánh if, để Node tự kết.
if (!APPLY || !xoaDuoc.length) {
  console.log(APPLY ? 'Không có gì để xoá.' : '(chỉ soát, không ghi gì — thêm --apply để xoá thật)')
} else {

  // Sao lưu ĐẦY ĐỦ (cả chữ rõ) trước khi xoá, ra thư mục ngoài git. File này chứa mật khẩu thật —
  // cất như cất khóa, xoá đi khi đã chắc chắn.
  fs.mkdirSync(THU_MUC_SAO_LUU, { recursive: true })
  const tenSaoLuu = path.join(THU_MUC_SAO_LUU,
    `sao-luu-mat-khau-chu-ro-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(tenSaoLuu, JSON.stringify({
    luc: new Date().toISOString(),
    canhBao: 'FILE NÀY CHỨA MẬT KHẨU THẬT CỦA KHÁCH — cất an toàn, xoá khi đã chắc chắn.',
    dong: xoaDuoc.map(r => ({ id: r.id, client_id: r.client_id, category: r.category, label: r.label, password: r.password })),
  }, null, 2), { mode: 0o600 })
  const lai = JSON.parse(fs.readFileSync(tenSaoLuu, 'utf8'))
  if (lai.dong.length !== xoaDuoc.length) {
    console.error(`SAO LƯU THIẾU (${lai.dong.length} / ${xoaDuoc.length}) — DỪNG, không xoá gì.`)
    process.exit(1)
  }
  console.log(`Đã sao lưu ${lai.dong.length} mật khẩu chữ rõ: ${tenSaoLuu}`)

  let xong = 0
  for (const r of xoaDuoc) {
    // Kiểm lại lần cuối ngay trước khi xoá: đọc lại bản mã từ DB, giải ra phải đúng chữ rõ. Giữa lúc
    // soát và lúc xoá có thể có người vừa sửa mật khẩu dòng đó qua giao diện.
    const { data: moiNhat, error: loiDoc } = await s.from('client_credentials')
      .select('password, password_enc').eq('id', r.id).single()
    if (loiDoc) { console.error(`  DÒNG ${r.id}: đọc lại thất bại — ${loiDoc.message}. DỪNG.`); process.exit(1) }
    if (!moiNhat.password) { console.log(`  dòng ${r.id}: đã hết chữ rõ, bỏ qua`); continue }
    let giaiRa = null
    try { giaiRa = decrypt(moiNhat.password_enc) } catch { /* rơi xuống nhánh dưới */ }
    if (giaiRa !== moiNhat.password) {
      console.error(`  DÒNG ${r.id}: vừa bị sửa giữa lúc chạy, bản mã không khớp chữ rõ nữa — BỎ LẠI.`)
      continue
    }
    const { error } = await s.from('client_credentials').update({ password: null }).eq('id', r.id)
    if (error) { console.error(`  DÒNG ${r.id}: xoá thất bại — ${error.message}. DỪNG.`); process.exit(1) }
    xong++
  }

  console.log('')
  console.log(`ĐÃ XOÁ CHỮ RÕ : ${xong} dòng`)
  console.log('Còn lại một việc tay: xoá hẳn cột bằng SQL sau khi dùng thật vài ngày —')
  console.log('  alter table client_credentials drop column password;')
  console.log('Giữ cột rỗng thì mật khẩu mới lỡ ghi vào đó sẽ lại thành chữ rõ mà không ai biết.')
}
