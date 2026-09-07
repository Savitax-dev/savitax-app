// Kiểm luật "phí HCNS bằng 0 ở các tháng trước khi bật dịch vụ" — hàm thuần, không đụng database.
//
//   node scripts/test-hcns-fee-month.mjs
//
// Lỗi thật đã gặp (2026-09-07): 7 công ty phòng Aoraki tách phí HCNS áp dụng từ T9/2026, nhưng mở
// Công nợ phòng xem T8 thì vẫn hiện phí HCNS -> thẻ "Còn phải thu" của T8 cộng thêm 3.780.000đ nợ
// không có thật.
import { resolveHcnsFeeForMonth, hcnsStartMonth } from '../lib/hcnsFee.js'

let pass = 0, fail = 0
const check = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')) } }

const ID = 'h1'
const plan = (y, m, amount) => ({ client_id: ID, year: y, month: m, amount })
const SEP7 = '2026-09-07T10:00:00.000Z'

console.log('\n1. Có mốc phí từ T9 — tháng trước T9 phải là 0')
{
  const p = [plan(2026, 9, 540000)]
  check('T7 = 0', resolveHcnsFeeForMonth(p, ID, 2026, 7, 540000, SEP7) === 0)
  check('T8 = 0', resolveHcnsFeeForMonth(p, ID, 2026, 8, 540000, SEP7) === 0)
  check('T9 = 540.000', resolveHcnsFeeForMonth(p, ID, 2026, 9, 540000, SEP7) === 540000)
  check('T10 vẫn theo mốc T9', resolveHcnsFeeForMonth(p, ID, 2026, 10, 540000, SEP7) === 540000)
}

console.log('\n2. Chưa có mốc phí nào — lấy tháng BẬT DỊCH VỤ làm mốc')
{
  check('T8 = 0 (bật DV tháng 9)', resolveHcnsFeeForMonth([], ID, 2026, 8, 540000, SEP7) === 0)
  check('T9 = phí sống', resolveHcnsFeeForMonth([], ID, 2026, 9, 540000, SEP7) === 540000)
}

console.log('\n3. Đổi phí giữa chừng — mỗi tháng lấy đúng mốc gần nhất trước đó')
{
  const p = [plan(2026, 9, 540000), plan(2026, 11, 700000)]
  check('T9 = 540.000',  resolveHcnsFeeForMonth(p, ID, 2026, 9,  540000, SEP7) === 540000)
  check('T10 = 540.000', resolveHcnsFeeForMonth(p, ID, 2026, 10, 700000, SEP7) === 540000)
  check('T11 = 700.000', resolveHcnsFeeForMonth(p, ID, 2026, 11, 700000, SEP7) === 700000)
  check('T8 = 0',        resolveHcnsFeeForMonth(p, ID, 2026, 8,  700000, SEP7) === 0)
}

console.log('\n4. Ngừng dịch vụ = mốc phí 0 — tháng sau đó là 0, tháng trước giữ nguyên')
{
  const p = [plan(2026, 9, 540000), plan(2026, 12, 0)]
  check('T11 = 540.000', resolveHcnsFeeForMonth(p, ID, 2026, 11, 0, SEP7) === 540000)
  check('T12 = 0',       resolveHcnsFeeForMonth(p, ID, 2026, 12, 0, SEP7) === 0)
  check('T1/2027 = 0',   resolveHcnsFeeForMonth(p, ID, 2027, 1,  0, SEP7) === 0)
}

console.log('\n5. Không biết mốc bắt đầu (thiếu cả mốc phí lẫn ngày bật) — giữ hành vi cũ, không chặn')
{
  check('T8 = phí sống', resolveHcnsFeeForMonth([], ID, 2026, 8, 540000, null) === 540000)
}

console.log('\n6. Mốc phí của công ty KHÁC không được tính nhầm sang')
{
  const p = [{ client_id: 'h2', year: 2026, month: 5, amount: 999000 }, plan(2026, 9, 540000)]
  check('T8 vẫn = 0', resolveHcnsFeeForMonth(p, ID, 2026, 8, 540000, SEP7) === 0)
  check('mốc bắt đầu là T9', hcnsStartMonth(p, ID, SEP7) === 2026 * 12 + 9, String(hcnsStartMonth(p, ID, SEP7)))
}

console.log('\n7. Bắc cầu sang năm: bật DV T12/2026 thì T1/2027 có phí, T11/2026 không')
{
  const dec = '2026-12-03T00:00:00.000Z'
  check('T11/2026 = 0', resolveHcnsFeeForMonth([], ID, 2026, 11, 540000, dec) === 0)
  check('T12/2026 = phí sống', resolveHcnsFeeForMonth([], ID, 2026, 12, 540000, dec) === 540000)
  check('T1/2027 = phí sống', resolveHcnsFeeForMonth([], ID, 2027, 1, 540000, dec) === 540000)
}

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + ' đạt, ' + fail + ' hỏng')
process.exitCode = fail === 0 ? 0 : 1
