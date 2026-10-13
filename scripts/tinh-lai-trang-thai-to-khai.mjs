// Tính lại trạng thái hồ sơ từ CHUỖI GỐC cổng trả về (tax_filings.portal_status).
//
//   node --env-file=.env.local scripts/tinh-lai-trang-thai-to-khai.mjs           (chỉ xem)
//   node --env-file=.env.local scripts/tinh-lai-trang-thai-to-khai.mjs --apply   (ghi thật)
//
// VÌ SAO CÓ SCRIPT NÀY: ngày 12/10/2026 anh phát hiện app hiện "Chấp nhận" cho hồ sơ mà cổng ghi
// "Chờ chấp nhận" — báo xong cho việc chưa xong. Nguyên nhân: chuanHoaTrangThai xét nhánh
// 'chấp nhận' TRƯỚC nhánh 'chờ', mà "Chờ chấp nhận" chứa "chấp nhận".
//
// Sửa được hồi tố vì app LUÔN giữ nguyên chuỗi gốc của cổng bên cạnh trạng thái đã quy đổi. Đây
// đúng là lý do cột portal_status tồn tại — giữ nguyên văn thì sửa cách hiểu lúc nào cũng được,
// không phải đi hỏi lại cổng. Giữ thói quen đó cho mọi thứ quy đổi từ bên ngoài.
//
// Chạy lại nhiều lần vẫn an toàn: dòng nào đã đúng thì bỏ qua.
import { createClient } from '@supabase/supabase-js'
import { chuanHoaTrangThai } from '../lib/dvcPortal.js'

const APPLY = process.argv.includes('--apply')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// PostgREST cắt im lặng ở 1000 dòng — phải lật trang.
const ds = []
for (let tu = 0; ; tu += 1000) {
  const { data, error } = await s.from('tax_filings')
    .select('id, client_id, period_code, state, portal_status').range(tu, tu + 999)
  if (error) { console.error('Đọc dữ liệu thất bại:', error.message); process.exit(1) }
  ds.push(...data)
  if (data.length < 1000) break
}

const canSua = ds.filter(r => r.portal_status && chuanHoaTrangThai(r.portal_status) !== r.state)

const { data: cts } = await s.from('clients').select('id, client_code, name')
const tenCty = new Map((cts || []).map(c => [c.id, c.client_code || c.name]))

console.log(`Tổng hồ sơ        : ${ds.length}`)
console.log(`Trạng thái sai    : ${canSua.length}`)
console.log(`Công ty ảnh hưởng : ${new Set(canSua.map(r => r.client_id)).size}`)

if (!canSua.length) { console.log('\nKhông có gì phải sửa.'); process.exit(0) }

console.log('')
const gom = {}
for (const r of canSua) {
  const k = `"${r.portal_status}"  ${r.state} → ${chuanHoaTrangThai(r.portal_status)}`
  gom[k] = (gom[k] || 0) + 1
}
for (const [k, v] of Object.entries(gom).sort((a, b) => b[1] - a[1])) console.log(`  ${v} hồ sơ · ${k}`)

console.log('')
for (const r of canSua.slice(0, 20)) {
  console.log(`  ${String(tenCty.get(r.client_id) || '?').padEnd(16)} | ${String(r.period_code).padEnd(10)} | ${r.state} → ${chuanHoaTrangThai(r.portal_status)}`)
}
if (canSua.length > 20) console.log(`  … và ${canSua.length - 20} hồ sơ nữa`)

if (!APPLY) {
  console.log('\n(chỉ xem, chưa ghi gì — thêm --apply để sửa thật)')
} else {
  let xong = 0
  for (const r of canSua) {
    const moi = chuanHoaTrangThai(r.portal_status)
    const { error } = await s.from('tax_filings').update({ state: moi }).eq('id', r.id)
    if (error) { console.error(`  DÒNG ${r.id}: ghi thất bại — ${error.message}. DỪNG.`); process.exit(1) }
    xong++
  }
  console.log(`\nĐÃ SỬA : ${xong} hồ sơ`)
  console.log('Không cần sao lưu riêng: chuỗi gốc portal_status giữ nguyên, chạy lại script là ra'
    + ' đúng trạng thái bất cứ lúc nào.')
}
