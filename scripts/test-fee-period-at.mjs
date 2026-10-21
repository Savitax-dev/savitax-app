// Kiểm feePeriodAt (lib/feeDue.js) — kỳ thu phí CÓ HIỆU LỰC ở một tháng đã qua.
//
//   node scripts/test-fee-period-at.mjs
//
// Vì sao: đổi công ty Quý -> Tháng từng làm T7, T8 thành "tháng đến hạn" với phí cả quý -> nợ tồn
// ảo (ĐÔNG HƯNG 19,8tr ngày 09/10/2026; TRUNG TÂM THƯƠNG MẠI HÓA 3,24tr ngày 20/10/2026).
import { feePeriodAt, isPastRolloverDeadline } from '../lib/feeDue.js'

let dat = 0, hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  if (JSON.stringify(thucTe) === JSON.stringify(mongDoi)) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log('  ✗ ' + ten + '\n      ra ' + JSON.stringify(thucTe) + ' — đáng lẽ ' + JSON.stringify(mongDoi)) }
}

// Ca ĐÔNG HƯNG: Quý -> Tháng lúc 13:47 ngày 09/10/2026 giờ VN (06:47 UTC)
const dongHung = [{ old_value: 'Quý', new_value: 'Tháng', changed_at: '2026-10-09T06:47:00Z' }]
console.log('\n[1] Đổi Quý -> Tháng giữa tháng 10:')
kiem('T7 theo kỳ cũ (Quý)', feePeriodAt('monthly', dongHung, 2026, 7), 'quarterly')
kiem('T8 theo kỳ cũ (Quý)', feePeriodAt('monthly', dongHung, 2026, 8), 'quarterly')
kiem('T9 theo kỳ cũ (Quý)', feePeriodAt('monthly', dongHung, 2026, 9), 'quarterly')
kiem('T10 theo kỳ mới (Tháng) — đổi ngay trong tháng 10', feePeriodAt('monthly', dongHung, 2026, 10), 'monthly')
const sau = new Date('2026-10-21T05:00:00Z')
kiem('=> T7, T8 KHÔNG đến hạn (hết nợ ảo); T9 vẫn đến hạn (thu quý)',
  [7, 8, 9].map(m => isPastRolloverDeadline(feePeriodAt('monthly', dongHung, 2026, m), 2026, m, sau)), [false, false, true])

console.log('\n[2] Không có lần đổi nào -> theo hiện tại (hành vi cũ):')
kiem('công ty tháng', feePeriodAt('monthly', [], 2026, 7), 'monthly')
kiem('công ty quý', feePeriodAt('quarterly', undefined, 2026, 7), 'quarterly')
kiem('giá trị lạ -> tháng', feePeriodAt(null, [], 2026, 7), 'monthly')

console.log('\n[3] Đổi Tháng -> Quý, rồi Quý -> Tháng (hai lần):')
const haiLan = [
  { old_value: 'Tháng', changed_at: '2026-04-05T03:00:00Z' },
  { old_value: 'Quý', changed_at: '2026-10-09T03:00:00Z' },
]
kiem('T2 trước lần đổi đầu -> Tháng', feePeriodAt('monthly', haiLan, 2026, 2), 'monthly')
kiem('T3 (đổi 05/04 xảy ra sau khi T3 kết thúc) -> Tháng', feePeriodAt('monthly', haiLan, 2026, 3), 'monthly')
kiem('T4 -> Quý', feePeriodAt('monthly', haiLan, 2026, 4), 'quarterly')
kiem('T9 -> Quý', feePeriodAt('monthly', haiLan, 2026, 9), 'quarterly')
kiem('T10 -> Tháng', feePeriodAt('monthly', haiLan, 2026, 10), 'monthly')

console.log('\n[4] Ranh giới tháng theo GIỜ VN:')
// 00:30 ngày 01/10 giờ VN = 17:30 UTC ngày 30/09 -> đã sang tháng 10 -> T9 theo kỳ cũ
kiem('đổi 00:30 ngày 01/10 giờ VN -> T9 vẫn kỳ cũ', feePeriodAt('monthly', [{ old_value: 'Quý', changed_at: '2026-09-30T17:30:00Z' }], 2026, 9), 'quarterly')
// 23:30 ngày 30/09 giờ VN = 16:30 UTC -> vẫn trong tháng 9 -> T9 theo kỳ mới
kiem('đổi 23:30 ngày 30/09 giờ VN -> T9 đã kỳ mới', feePeriodAt('monthly', [{ old_value: 'Quý', changed_at: '2026-09-30T16:30:00Z' }], 2026, 9), 'monthly')
kiem('nhật ký ghi mã thô (quarterly) cũng nhận', feePeriodAt('monthly', [{ old_value: 'quarterly', changed_at: '2026-10-09T03:00:00Z' }], 2026, 8), 'quarterly')

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
