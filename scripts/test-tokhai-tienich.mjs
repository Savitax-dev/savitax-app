// Kiểm MÃ TIỆN ÍCH Chrome của phân hệ Tờ khai.
//   node scripts/test-tokhai-tienich.mjs
//
// Vì sao phải có bộ kiểm riêng: hỏng ở đây làm MỌI máy mất kết nối cùng một lúc, mà không báo lỗi
// gì rõ ràng — nhân viên chỉ thấy "Tiện ích không phản hồi". Web app nướng mã tiện ích vào lúc
// build (biến NEXT_PUBLIC_TOKHAI_EXT_ID), nên chỉ giữ được MỘT mã cho cả 294 người.
//
// Bình thường Chrome sinh mã cho tiện ích "tải đã giải nén" bằng cách băm ĐƯỜNG DẪN thư mục → mỗi
// máy một mã, kiểu đó chết ngay. Nên manifest.json phải có trường `key` (khóa công khai tự sinh):
// có nó thì Chrome lấy mã từ khóa, cố định trên mọi máy. Bộ kiểm này giữ ba điều:
//   [1] manifest còn trường `key` — ai xoá đi là mã quay về phụ thuộc đường dẫn
//   [2] mã suy từ `key` vẫn đúng chuỗi đã ghi trong tài liệu và đã đặt trên Vercel
//   [3] .env.local trên máy này (nếu có) trỏ đúng mã đó

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Mã đã chốt 29/09/2026 — cũng là mã ghi ở chrome-extension/CAI-DAT.md và đặt trên Vercel.
// Đổi số này là phải build lại web app VÀ chép lại tiện ích lên từng máy. Đừng đổi cho vui.
const MA_DA_CHOT = 'affcgkipcpdjoiednghajbahjanhlnnn'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const dat = thucTe === mongDoi
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${thucTe}\n         đáng lẽ ${mongDoi}`}`)
  if (!dat) hong++
}

// Cách Chrome suy mã: SHA-256 của khóa công khai dạng DER, lấy 16 byte đầu, mỗi nửa byte 0-9a-f
// đổi sang a-p (mã tiện ích chỉ dùng được chữ).
const maTuKhoa = keyB64 => {
  const bam = crypto.createHash('sha256').update(Buffer.from(keyB64, 'base64')).digest()
  return [...bam.subarray(0, 16)]
    .map(b => b.toString(16).padStart(2, '0')).join('')
    .replace(/[0-9a-f]/g, k => String.fromCharCode(97 + parseInt(k, 16)))
}

const manifest = JSON.parse(fs.readFileSync(path.join(GOC, 'chrome-extension/manifest.json'), 'utf8'))

console.log('Manifest tiện ích:')
kiem('có trường key (mã KHÔNG phụ thuộc đường dẫn thư mục)', typeof manifest.key, 'string')
kiem('key là base64 khóa RSA 2048 dạng SPKI (294 byte)',
  manifest.key ? Buffer.from(manifest.key, 'base64').length : 0, 294)
kiem('mã suy từ key đúng chuỗi đã chốt', manifest.key ? maTuKhoa(manifest.key) : '(thiếu key)', MA_DA_CHOT)

// Trang web gọi tiện ích qua externally_connectable; thiếu miền nào là miền đó gọi không tới.
console.log('')
console.log('Miền được phép gọi tiện ích:')
const mien = manifest.externally_connectable?.matches || []
kiem('có app.savitax.vn', mien.includes('https://app.savitax.vn/*'), true)
kiem('có localhost (chạy thử)', mien.includes('http://localhost/*'), true)

console.log('')
console.log('Biến môi trường máy này:')
const duongDanEnv = path.join(GOC, '.env.local')
if (!fs.existsSync(duongDanEnv)) {
  console.log('  BỎ QUA  không có .env.local (máy dựng bản, không phải máy chạy thử)')
} else {
  const dong = fs.readFileSync(duongDanEnv, 'utf8').split(/\r?\n/)
    .find(d => d.startsWith('NEXT_PUBLIC_TOKHAI_EXT_ID='))
  kiem('.env.local trỏ đúng mã đã chốt',
    dong ? dong.slice('NEXT_PUBLIC_TOKHAI_EXT_ID='.length).trim() : '(chưa đặt biến)', MA_DA_CHOT)
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
