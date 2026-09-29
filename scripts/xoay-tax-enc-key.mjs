// Xoay khóa mã hóa mật khẩu khách (TAX_ENC_KEY).
//
// VÌ SAO PHẢI XOAY (soát ngày 29/09/2026): khóa đang dùng chính là NGUYÊN CÂU LỆNH sinh khóa được
// in làm mẫu trong lib/taxCrypto.js — ai đó dán dòng hướng dẫn thay vì chạy nó. Chuỗi đó nằm trong
// mã nguồn trên GitHub, nên 66 mật khẩu tài khoản thuế / ngân hàng / BHXH của khách coi như được
// khóa bằng một chuỗi công khai. Guard "ít nhất 32 ký tự" không bắt được vì câu lệnh dài 70 ký tự.
//
// CÁCH DÙNG — ba bước, mặc định KHÔNG GHI GÌ:
//
//   1) Sinh khóa mới (ghi ra file ngoài git, KHÔNG in ra màn hình):
//        node scripts/xoay-tax-enc-key.mjs --sinh-khoa
//
//   2) Soát trước (chỉ đếm, không sửa DB):
//        node --env-file=.env.local scripts/xoay-tax-enc-key.mjs
//
//   3) Mã hóa lại thật:
//        node --env-file=.env.local scripts/xoay-tax-enc-key.mjs --apply
//
// TRÌNH TỰ ĐÚNG ĐỂ PRODUCTION KHÔNG GÃY MỘT GIÂY NÀO:
//   a. Đặt trên Vercel: TAX_ENC_KEY = khóa MỚI, TAX_ENC_KEY_OLD = khóa CŨ. Deploy lại.
//      Lúc này production ghi bằng khóa mới, còn đọc dữ liệu cũ bằng khóa cũ dự phòng → không lỗi.
//   b. Chạy bước 3 ở trên để mã hóa lại toàn bộ sang khóa mới.
//   c. Bỏ TAX_ENC_KEY_OLD khỏi Vercel và .env.local. Deploy lại. Xong.
// Làm ngược lại (mã hóa lại trước khi Vercel có khóa mới) thì màn hình xem mật khẩu sẽ báo
// "Giải mã thất bại" cho tới khi deploy xong.
//
// Script tự lo phần khó: dòng nào đã mã hóa bằng khóa MỚI thì bỏ qua (chạy lại nhiều lần vẫn an
// toàn), dòng nào không khóa nào mở được thì BỎ LẠI và báo ra chứ không ghi đè.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const THU_MUC_KHOA = 'C:/Users/win/.savitax-keys'
const APPLY = process.argv.includes('--apply')
const SINH_KHOA = process.argv.includes('--sinh-khoa')

// ── Bước 1: sinh khóa mới ───────────────────────────────────────────────────
// Khóa KHÔNG in ra màn hình: màn hình bị chụp, bị cuộn lại, bị lưu vào log phiên làm việc.
if (SINH_KHOA) {
  fs.mkdirSync(THU_MUC_KHOA, { recursive: true })
  const khoa = crypto.randomBytes(32).toString('base64')
  const dau = crypto.createHash('sha256').update(khoa, 'utf8').digest('hex').slice(0, 12)
  const ten = path.join(THU_MUC_KHOA, `tax-enc-key-${new Date().toISOString().slice(0, 10)}.txt`)
  if (fs.existsSync(ten)) {
    console.error(`ĐÃ CÓ file ${ten} — không ghi đè. Xoá hoặc đổi tên file cũ nếu thật sự muốn sinh lại.`)
    process.exit(1)
  }
  fs.writeFileSync(ten, khoa + '\n', { mode: 0o600 })
  console.log('Đã sinh khóa mới và ghi ra file (không in ra đây):')
  console.log(`  ${ten}`)
  console.log(`  dấu nhận dạng khóa: ${dau}`)
  console.log('')
  console.log('Việc cần làm tay:')
  console.log('  1. Mở file trên, chép nguyên chuỗi (KHÔNG thêm dấu cách, KHÔNG thêm dòng trống).')
  console.log('  2. Dán vào .env.local:  TAX_ENC_KEY=<chuỗi mới>')
  console.log('     và chuyển khóa cũ sang:  TAX_ENC_KEY_OLD=<chuỗi cũ>')
  console.log('  3. Đặt cả hai biến lên Vercel rồi deploy lại TRƯỚC KHI chạy --apply.')
  console.log('  4. Cất thêm một bản khóa ở nơi an toàn ngoài Vercel (mất khóa là mất hết mật khẩu).')
  process.exit(0)
}

// ── Bước 2 và 3 ─────────────────────────────────────────────────────────────
const { encrypt, decrypt, isEncrypted, khoaNaoMoDuoc } = await import('../lib/taxCrypto.js')

if (!process.env.TAX_ENC_KEY) {
  console.error('Thiếu TAX_ENC_KEY. Chạy với --env-file=.env.local.')
  process.exit(1)
}
const coKhoaCu = !!process.env.TAX_ENC_KEY_OLD
const dauKhoa = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12)

console.log(`Khóa hiện tại (TAX_ENC_KEY)  : dấu nhận dạng ${dauKhoa(process.env.TAX_ENC_KEY)}`)
console.log(`Khóa cũ (TAX_ENC_KEY_OLD)    : ${coKhoaCu ? 'dấu nhận dạng ' + dauKhoa(process.env.TAX_ENC_KEY_OLD) : 'KHÔNG ĐẶT'}`)
console.log(APPLY ? '\n*** GHI THẬT (--apply) ***\n' : '\n(chỉ soát, không ghi gì — thêm --apply để ghi thật)\n')

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// PostgREST cắt im lặng ở 1000 dòng — phải lật trang, đừng tin một lần select.
async function docHet(bang, cot) {
  const ra = []
  for (let tu = 0; ; tu += 1000) {
    const { data, error } = await s.from(bang).select(cot).range(tu, tu + 999)
    if (error) throw new Error(`${bang}: ${error.message}`)
    ra.push(...data)
    if (data.length < 1000) return ra
  }
}

const BANG = [
  { bang: 'client_credentials', cot: 'password_enc', cotChuRoCu: 'password' },
  { bang: 'tax_accounts', cot: 'password_enc', cotChuRoCu: null },
]

let tongCanXoay = 0, tongDaXoay = 0, tongHong = 0, tongChuRo = 0
const canXoay = []          // [{ bang, cot, rows }] — gom hết rồi mới sao lưu MỘT lần

// ── Vòng 1: đọc và phân loại, chưa ghi gì ───────────────────────────────────
for (const { bang, cot, cotChuRoCu } of BANG) {
  const chon = ['id', cot, cotChuRoCu].filter(Boolean).join(', ')
  const rows = await docHet(bang, chon)
  const coGiaTri = rows.filter(r => r[cot])
  const chuRo = cotChuRoCu ? rows.filter(r => r[cotChuRoCu]) : []

  const nhom = { moi: [], cu: [], hong: [] }
  for (const r of coGiaTri) {
    const ket = khoaNaoMoDuoc(r[cot])
    nhom[ket === 'moi' ? 'moi' : ket === 'cu' ? 'cu' : 'hong'].push(r)
  }

  console.log(`${bang}.${cot}`)
  console.log(`  tổng dòng                      : ${rows.length}`)
  console.log(`  có mật khẩu đã mã hóa          : ${coGiaTri.length}`)
  console.log(`  đã dùng khóa MỚI (bỏ qua)      : ${nhom.moi.length}`)
  console.log(`  còn dùng khóa CŨ (cần xoay)    : ${nhom.cu.length}`)
  console.log(`  KHÔNG khóa nào mở được         : ${nhom.hong.length}${nhom.hong.length ? '  ← BỎ LẠI, không ghi đè' : ''}`)
  if (cotChuRoCu) console.log(`  còn chữ rõ ở cột ${cotChuRoCu} cũ : ${chuRo.length}${chuRo.length ? '  ← nên xoá sau khi chắc chắn' : ''}`)

  tongCanXoay += nhom.cu.length
  tongHong += nhom.hong.length
  tongChuRo += chuRo.length
  if (nhom.cu.length) canXoay.push({ bang, cot, rows: nhom.cu })
  console.log('')
}

// ── Vòng 2: sao lưu MỘT lần rồi mới ghi ─────────────────────────────────────
if (APPLY && canXoay.length) {
  const saoLuu = { luc: new Date().toISOString(), bang: {} }
  for (const { bang, cot, rows } of canXoay) {
    saoLuu.bang[bang] = rows.map(r => ({ id: r.id, [cot]: r[cot] }))
  }
  fs.mkdirSync(THU_MUC_KHOA, { recursive: true })
  const tenSaoLuu = path.join(THU_MUC_KHOA,
    `sao-luu-truoc-xoay-khoa-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(tenSaoLuu, JSON.stringify(saoLuu, null, 2), { mode: 0o600 })
  // Đọc lại và đếm: ghi file có thể thiếu mà không báo lỗi (hết đĩa, phần mềm diệt virus chặn).
  const lai = JSON.parse(fs.readFileSync(tenSaoLuu, 'utf8'))
  const demLai = Object.values(lai.bang).reduce((t, v) => t + v.length, 0)
  if (demLai !== tongCanXoay) {
    console.error(`SAO LƯU THIẾU (${demLai} / ${tongCanXoay} dòng) — DỪNG, không ghi gì vào DB.`)
    process.exit(1)
  }
  console.log(`Đã sao lưu bản mã cũ (${demLai} dòng): ${tenSaoLuu}`)
  console.log('')

  for (const { bang, cot, rows } of canXoay) {
    let xong = 0
    for (const r of rows) {
      const thuong = decrypt(r[cot])                  // mở bằng khóa cũ (dự phòng trong taxCrypto)
      const moi = encrypt(thuong)                     // mã hóa lại bằng khóa mới
      if (decrypt(moi) !== thuong) {                  // tự kiểm trước khi ghi
        console.error(`  DÒNG ${r.id}: mã hóa lại rồi giải ra KHÁC — DỪNG.`)
        process.exit(1)
      }
      const { error } = await s.from(bang).update({ [cot]: moi }).eq('id', r.id)
      if (error) { console.error(`  DÒNG ${r.id}: ghi thất bại — ${error.message}. DỪNG.`); process.exit(1) }
      xong++
    }
    console.log(`${bang}.${cot}: ĐÃ MÃ HÓA LẠI ${xong} dòng`)
    tongDaXoay += xong
  }
  console.log('')
}

// Nhật ký sửa thông tin từng lưu thẳng mật khẩu cũ/mới — đã sửa, nhưng dòng cũ có thể còn.
// Mã hóa lại không cứu được mấy dòng đó vì chúng là CHỮ RÕ, không dính khóa nào.
const { data: log, error: loiLog } = await s.from('client_change_log')
  .select('id, field, old_value, new_value').eq('field', 'Mật khẩu/PIN').limit(1000)
if (loiLog) {
  console.log(`client_change_log: không đọc được — ${loiLog.message}`)
} else {
  const AN = new Set(['(đã ẩn)', '(đã đổi)', '(đã xóa)', '', null])
  const loDien = log.filter(r => !AN.has(r.old_value) || !AN.has(r.new_value))
  console.log('client_change_log (nhật ký sửa thông tin)')
  console.log(`  dòng ghi về mật khẩu           : ${log.length}`)
  console.log(`  dòng CÒN LƯU CHỮ RÕ            : ${loDien.length}${loDien.length ? '  ← khóa không che được, phải xoá giá trị' : ''}`)
  console.log('')
}

console.log('── Tóm lại ──')
if (!APPLY) {
  console.log(`Cần mã hóa lại : ${tongCanXoay} dòng`)
  if (!coKhoaCu && tongCanXoay === 0) {
    console.log('Chưa đặt TAX_ENC_KEY_OLD nên script không phân biệt được khóa cũ/mới.')
    console.log('Đặt TAX_ENC_KEY = khóa mới và TAX_ENC_KEY_OLD = khóa cũ rồi soát lại.')
  }
} else {
  console.log(`Đã mã hóa lại  : ${tongDaXoay} dòng`)
}
if (tongHong) console.log(`CẢNH BÁO: ${tongHong} dòng không khóa nào mở được — kiểm tay, script đã bỏ qua.`)
if (tongChuRo) console.log(`CẢNH BÁO: ${tongChuRo} dòng còn mật khẩu chữ rõ ở cột cũ — xoá bằng SQL sau khi chắc chắn.`)
process.exit(tongHong ? 1 : 0)
