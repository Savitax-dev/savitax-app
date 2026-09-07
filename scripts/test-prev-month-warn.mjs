// Kiểm luật cảnh báo "tháng trước chưa thu mà còn hạn ghi nhận" — hàm thuần, không đụng database.
//
//   node scripts/test-prev-month-warn.mjs
//
// Cảnh báo hỏi oan còn nguy hiểm hơn không cảnh báo: nhân viên bấm cho qua theo phản xạ thì lần
// nhầm thật cũng bị bấm qua nốt. Nên phải chắc từng điều kiện.
import { checkPrevMonthUnpaid, prevMonthOf } from '../lib/prevMonthDebt.js'

let pass = 0, fail = 0
const check = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')) } }

// Mốc thời gian cố định để phép thử không đổi kết quả theo ngày chạy thật.
const d7  = new Date(2026, 8, 7)    // 7/9/2026 — T8 CÒN hạn ghi nhận (tới hết 10/9)
const d15 = new Date(2026, 8, 15)   // 15/9/2026 — T8 ĐÃ quá hạn

const base = {
  year: 2026, month: 9, amount: 6480000,
  feePeriod: 'monthly', prevFee: 6480000, prevPaid: 0,
  clientName: 'NHÂN SỰ VIỆT', now: d7,
}

console.log('\n1. Ca chuẩn: T8 chưa thu, còn hạn, ghi tiền vào T9')
{
  const r = checkPrevMonthUnpaid(base)
  check('có cảnh báo', !!r)
  check('trỏ đúng về T8/2026', r?.year === 2026 && r?.month === 8, JSON.stringify({ y: r?.year, m: r?.month }))
  check('còn thiếu đúng số', r?.remain === 6480000, String(r?.remain))
  check('lời nhắn có tên công ty', (r?.message || '').includes('NHÂN SỰ VIỆT'))
}

console.log('\n2. Đã QUÁ HẠN ghi nhận T8 (15/9) → không cảnh báo, phải đi đường Nợ tồn cũ')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, now: d15 }) === null)

console.log('\n3. T8 đã thu đủ → không cảnh báo')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, prevPaid: 6480000 }) === null)

console.log('\n4. T8 thu THIẾU MỘT PHẦN → vẫn cảnh báo, nêu rõ đã thu bao nhiêu')
{
  const r = checkPrevMonthUnpaid({ ...base, prevPaid: 3000000 })
  check('có cảnh báo', !!r)
  check('còn thiếu 3.480.000', r?.remain === 3480000, String(r?.remain))
  check('lời nhắn nêu số đã thu', (r?.message || '').includes('3.000.000'))
}

console.log('\n5. Ghi cho THÁNG CŨ (không phải tháng hiện tại) → không hỏi, họ đã chủ đích chọn tháng')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, month: 7 }) === null)

console.log('\n6. Ghi cho tháng TƯƠNG LAI → không hỏi')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, month: 10 }) === null)

console.log('\n7. Công ty thu theo QUÝ, T8 là tháng giữa quý → không hỏi oan')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, feePeriod: 'quarterly' }) === null)

console.log('\n8. Công ty thu theo QUÝ mà tháng trước là CUỐI QUÝ → có hỏi')
{
  // Ghi cho T10/2026, tháng trước là T9 = cuối quý 3.
  const r = checkPrevMonthUnpaid({
    ...base, month: 10, feePeriod: 'quarterly', now: new Date(2026, 9, 5),
  })
  check('có cảnh báo', !!r, JSON.stringify(r))
  check('trỏ về T9/2026', r?.month === 9)
}

console.log('\n9. Tháng trước không có phí (0đ) → không hỏi')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, prevFee: 0 }) === null)

console.log('\n10. Số tiền đang ghi = 0 → không hỏi')
check('không cảnh báo', checkPrevMonthUnpaid({ ...base, amount: 0 }) === null)

console.log('\n11. Bắc cầu sang năm: ghi T1/2027 thì tháng trước là T12/2026')
{
  const p = prevMonthOf(2027, 1)
  check('tính đúng tháng trước', p.year === 2026 && p.month === 12, JSON.stringify(p))
  const r = checkPrevMonthUnpaid({ ...base, year: 2027, month: 1, now: new Date(2027, 0, 5) })
  check('có cảnh báo, trỏ về T12/2026', r?.year === 2026 && r?.month === 12, JSON.stringify(r && { y: r.year, m: r.month }))
}

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + ' đạt, ' + fail + ' hỏng')
process.exitCode = fail === 0 ? 0 : 1
