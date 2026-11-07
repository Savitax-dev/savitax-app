// Kiểm bảng khoản phí của báo giá (lib/salesItems.js) — hàm thuần, KHÔNG đụng database.
//
//   node scripts/test-sales-items.mjs
//
// Ba ca thật đã làm sai doanh số tháng 11/2026 (đề xuất Phòng Kinh doanh 04/11):
//   RESINVA      — một lần 5.000.000 đ, app cũ cộng 5tr cho MỌI tháng
//   chị Minh Trang — một lần 4.000.000 đ + hằng tháng 1.800.000 đ
//   Gau Gau      — hằng tháng 35.000.000 đ + mỗi năm 35.000.000 đ (BCTC), app cũ bỏ sót khoản năm
import { normalizeItems, totalsFromItems, dueInMonth, itemsFromFees, itemsNeedingReason, lineTotal, describeItem } from '../lib/salesItems.js'
import { computeFees, normalizeSurvey } from '../lib/salesPricing.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + '\n          mong ' + w + '\n          nhận ' + g) }
}
const I = (service, billing, amount, extra = {}) => ({ service, billing, amount, start_month: '2026-11', ...extra })

console.log('1. Ba ca thật\n')
{
  const resinva = normalizeItems([I('Dịch vụ kế toán trọn gói (làm gọn hồ sơ)', 'once', 5000000)])
  const tt = totalsFromItems(resinva)
  t('RESINVA: phí tháng 0, thu một lần 5tr', [tt.monthly, tt.once], [0, 5000000])
  t('RESINVA: tháng 11 thu 5tr', dueInMonth(resinva, '2026-11'), 5000000)
  t('RESINVA: tháng 12 KHÔNG thu nữa (lỗi cũ cộng 5tr mỗi tháng)', dueInMonth(resinva, '2026-12'), 0)
}
{
  const trang = normalizeItems([
    I('Ghi tăng BHXH ban đầu', 'once', 4000000, { standard_amount: 5000000, note: 'Sếp duyệt giảm còn 4tr' }),
    I('Dịch vụ hành chính nhân sự', 'monthly', 1800000),
  ])
  const tt = totalsFromItems(trang)
  t('Minh Trang: tháng 1,8tr · một lần 4tr · 12 tháng đầu 25,6tr', [tt.monthly, tt.once, tt.year1], [1800000, 4000000, 25600000])
  t('Minh Trang: T11 thu 5,8tr', dueInMonth(trang, '2026-11'), 5800000)
  t('Minh Trang: T12 chỉ còn 1,8tr', dueInMonth(trang, '2026-12'), 1800000)
}
{
  const gau = normalizeItems([
    I('Dịch vụ kế toán – thuế trọn gói', 'monthly', 35000000),
    I('Lập BCTC và quyết toán thuế năm', 'yearly', 35000000, { start_month: '2027-03' }),
  ])
  const tt = totalsFromItems(gau)
  t('Gau Gau: tháng 35tr · mỗi năm 35tr · 12 tháng đầu 455tr', [tt.monthly, tt.yearly, tt.year1], [35000000, 35000000, 455000000])
  t('Gau Gau: T3/2027 thu cả phí tháng lẫn BCTC = 70tr', dueInMonth(gau, '2027-03'), 70000000)
  t('Gau Gau: T3/2028 lại tới kỳ BCTC', dueInMonth(gau, '2028-03'), 70000000)
  t('Gau Gau: T4/2027 chỉ phí tháng', dueInMonth(gau, '2027-04'), 35000000)
}

console.log('\n2. Thu dồn nhiều tháng\n')
{
  // Ký tháng 10 nhưng làm từ tháng 7, phí 3tr/tháng → tháng 10 thu 12tr (4 tháng), từ T11 thu 3tr.
  const items = normalizeItems([
    I('Kế toán tháng 7–10 (thu dồn)', 'multi', 3000000, { months: 4, start_month: '2026-10' }),
    I('Dịch vụ kế toán – thuế trọn gói', 'monthly', 3000000, { start_month: '2026-11' }),
  ])
  t('Thành tiền dòng thu dồn = 3tr × 4', lineTotal(items[0]), 12000000)
  t('Tháng 10 thu 12tr', dueInMonth(items, '2026-10'), 12000000)
  t('Tháng 11 thu 3tr', dueInMonth(items, '2026-11'), 3000000)
  const tt = totalsFromItems(items)
  t('Tổng: tháng 3tr · một lần 12tr', [tt.monthly, tt.once], [3000000, 12000000])
}

console.log('\n3. Khoản khách trả thẳng bên thứ ba\n')
{
  const items = normalizeItems([
    I('Dịch vụ kế toán – thuế trọn gói', 'monthly', 3000000),
    I('Phần mềm kế toán MISA ASP — 3 năm', 'once', 8100000, { to_savitax: false }),
  ])
  const tt = totalsFromItems(items)
  t('Tiền MISA KHÔNG vào doanh số Savitax', [tt.once, tt.other.once], [0, 8100000])
  t('12 tháng đầu chỉ tính phần của Savitax', tt.year1, 36000000)
  t('dueInMonth bỏ qua khoản ngoài Savitax', dueInMonth(items, '2026-11'), 3000000)
  t('Muốn xem cả tiền khách bỏ ra thì tắt lọc', dueInMonth(items, '2026-11', { onlySavitax: false }), 11100000)
}

console.log('\n4. Chuẩn hoá dữ liệu nhập\n')
t('Bỏ dòng chưa đặt tên dịch vụ', normalizeItems([I('', 'monthly', 100), I('Kế toán', 'monthly', 100)]).length, 1)
t('Giữ dòng tiền 0 (phí hoàn thuế 3% nhập sau)', normalizeItems([I('Phí hoàn thuế 3%', 'once', 0)]).length, 1)
t('Cách thu lạ -> hằng tháng', normalizeItems([I('X', 'bay-bay', 100)])[0].billing, 'monthly')
t('Tháng sai định dạng -> lấy tháng mặc định', normalizeItems([I('X', 'once', 100, { start_month: '11/2026' })], '2026-11')[0].start_month, '2026-11')
t('Thu dồn thiếu số tháng -> 1', normalizeItems([I('X', 'multi', 100, { months: 0 })])[0].months, 1)
t('Số tiền âm -> 0', normalizeItems([I('X', 'once', -5)])[0].amount, 0)
t('Đánh lại thứ tự dòng', normalizeItems([I('A', 'once', 1), I('B', 'once', 2)]).map(x => x.sort_order), [0, 1])

console.log('\n5. Dựng sẵn bảng từ biểu phí\n')
{
  const fees = computeFees(normalizeSurvey({ invIn: 15, wantHcns: true, hcnsHeads: 5, wantBctc: true, extras: ['misa_3y', 'qt_tncn'] }))
  const items = itemsFromFees(fees, { month: '2026-11' })
  const by = n => items.find(i => i.service.includes(n))
  t('Phí kế toán -> hằng tháng', [by('kế toán – thuế trọn gói').billing, by('kế toán – thuế trọn gói').amount], ['monthly', 2500000])
  t('Phí HCNS -> hằng tháng 1,5tr', [by('hành chính nhân sự').billing, by('hành chính nhân sự').amount], ['monthly', 1500000])
  t('BCTC -> mỗi năm', by('Báo cáo tài chính').billing, 'yearly')
  // Dịch vụ tùy chọn là khoản CHÀO THÊM, khách chưa đồng ý -> không tự vào bảng (thử nạp 07/11 phát hiện).
  t('Dịch vụ tùy chọn KHÔNG tự vào bảng', [by('quyết toán thuế thu nhập cá nhân'), by('MISA')], [undefined, undefined])
  const tt = totalsFromItems(items)
  t('Tổng dựng sẵn khớp biểu phí (4tr/tháng)', tt.monthly, 4000000)
  const full = itemsFromFees(fees, { month: '2026-11', includeOptional: true })
  const byF = n => full.find(i => i.service.includes(n))
  t('Bật includeOptional: TNCN -> một lần', byF('quyết toán thuế thu nhập cá nhân').billing, 'once')
  t('Bật includeOptional: MISA -> một lần, không về Savitax', [byF('MISA').billing, byF('MISA').to_savitax], ['once', false])
}
{
  // Báo giá có đề xuất giá riêng: tổng phí tháng phải khớp mức đã báo khách, chênh dồn vào dòng kế toán.
  const fees = computeFees(normalizeSurvey({ invIn: 15, wantHcns: true, hcnsHeads: 5 }))
  const items = itemsFromFees(fees, { month: '2026-11', monthlyFinal: 3000000 })
  const tt = totalsFromItems(items)
  t('Dồn chênh vào dòng kế toán, tổng = mức báo khách', [items[0].amount, items[1].amount, tt.monthly], [1500000, 1500000, 3000000])
  t('Dòng bị dồn có ghi chú khác biểu phí', items[0].note.includes('khác biểu phí'), true)
  // Ca Soft Buddy / Blue Sea: giảm nhiều hơn một dòng chịu nổi -> chia tỷ lệ, tổng vẫn khớp.
  const nho = itemsFromFees(computeFees(normalizeSurvey({ invIn: 15, wantHcns: true, hcnsHeads: 30 })), { month: '2026-11', monthlyFinal: 4333000 })
  t('Giảm sâu -> chia tỷ lệ, tổng khớp mức báo khách', totalsFromItems(nho).monthly, 4333000)
  t('Chia tỷ lệ không ra số âm', nho.filter(i => i.billing === 'monthly').every(i => i.amount >= 0), true)
}

console.log('\n6. Nhắc ghi lý do khi báo khác biểu phí\n')
{
  const items = normalizeItems([
    I('Kế toán', 'monthly', 2000000, { standard_amount: 2500000 }),
    I('HCNS', 'monthly', 1500000, { standard_amount: 1500000 }),
  ])
  t('Dòng lệch biểu phí mà chưa ghi lý do -> bị nhắc', itemsNeedingReason(items).map(i => i.service), ['Kế toán'])
  const ok = normalizeItems([I('Kế toán', 'monthly', 2000000, { standard_amount: 2500000, note: 'Khách cũ giới thiệu' })])
  t('Có lý do rồi thì thôi', itemsNeedingReason(ok).length, 0)
}
t('Mô tả dòng thu dồn', describeItem(normalizeItems([I('Kế toán T7–T10', 'multi', 3000000, { months: 4, start_month: '2026-10' })])[0]),
  'Kế toán T7–T10 — Thu dồn nhiều tháng 3.000.000 đ × 4 tháng = 12.000.000 đ · 10/2026')

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi')
process.exit(fail ? 1 : 0)
