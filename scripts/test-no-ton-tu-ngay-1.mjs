// Bộ kiểm luật chuyển nợ tồn (anh chốt 05/11/2026) — hàm thuần, không đụng dữ liệu:
//   · hết tháng (qua ngày 01 tháng sau) là chuyển nợ tồn — isPastRolloverDeadline
//   · vẫn ghi thu VÀO KỲ tới hết ngày 10 tháng sau — isPastEditDeadline / kyTrongHan
//   · gia hạn N tháng: cả hai mốc lùi N tháng; công ty quý: chỉ tháng cuối quý mới chuyển
// Chạy: node scripts/test-no-ton-tu-ngay-1.mjs
import { isPastRolloverDeadline, isPastEditDeadline } from '../lib/feeDue.js'
import { kyTrongHan } from '../lib/debtRollover.js'

let loi = 0
const kiem = (ten, thuc, mong) => {
  const ok = thuc === mong
  if (!ok) loi++
  console.log((ok ? '  OK   ' : '  SAI  ') + ten + (ok ? '' : ' → ' + thuc + ' ≠ ' + mong))
}
const ngay = (s) => new Date(s)   // giờ máy chạy — cùng cách app tính

console.log('Kỳ T10/2026, công ty tháng, không gia hạn:')
kiem('31/10 23:00 chưa chuyển', isPastRolloverDeadline('monthly', 2026, 10, ngay('2026-10-31T23:00:00')), false)
kiem('01/11 00:01 đã chuyển', isPastRolloverDeadline('monthly', 2026, 10, ngay('2026-11-01T00:01:00')), true)
kiem('05/11 còn ghi vào kỳ', kyTrongHan(2026, 10, ngay('2026-11-05T09:00:00')), true)
kiem('10/11 23:00 còn ghi vào kỳ', kyTrongHan(2026, 10, ngay('2026-11-10T23:00:00')), true)
kiem('11/11 00:01 hết hạn ghi vào kỳ', kyTrongHan(2026, 10, ngay('2026-11-11T00:01:00')), false)
kiem('isPastEditDeadline 11/11', isPastEditDeadline(2026, 10, ngay('2026-11-11T00:01:00')), true)

console.log('Gia hạn 1 tháng:')
kiem('30/11 23:00 chưa chuyển', isPastRolloverDeadline('monthly', 2026, 10, ngay('2026-11-30T23:00:00'), 1), false)
kiem('01/12 00:01 đã chuyển', isPastRolloverDeadline('monthly', 2026, 10, ngay('2026-12-01T00:01:00'), 1), true)
kiem('10/12 còn ghi vào kỳ', kyTrongHan(2026, 10, ngay('2026-12-10T22:00:00'), 1), true)
kiem('11/12 hết hạn ghi vào kỳ', kyTrongHan(2026, 10, ngay('2026-12-11T00:01:00'), 1), false)

console.log('Qua năm (kỳ T12):')
kiem('01/01 đã chuyển', isPastRolloverDeadline('monthly', 2026, 12, ngay('2027-01-01T00:01:00')), true)
kiem('10/01 còn ghi vào kỳ T12', kyTrongHan(2026, 12, ngay('2027-01-10T20:00:00')), true)

console.log('Công ty quý:')
kiem('tháng giữa quý (T11) không bao giờ chuyển', isPastRolloverDeadline('quarterly', 2026, 11, ngay('2027-03-01T00:00:00')), false)
kiem('quý 4 (T12) chuyển từ 01/01', isPastRolloverDeadline('quarterly', 2026, 12, ngay('2027-01-01T00:01:00')), true)
kiem('quý 4 chưa chuyển 31/12', isPastRolloverDeadline('quarterly', 2026, 12, ngay('2026-12-31T22:00:00')), false)

console.log(loi ? '\n' + loi + ' CHỖ SAI' : '\nTẤT CẢ ĐẠT')
process.exitCode = loi ? 1 : 0
