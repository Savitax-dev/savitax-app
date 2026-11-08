// Kiểm Theo dõi hợp đồng + Doanh số/thưởng (lib/salesContract.js, lib/salesBonus.js) —
// hàm thuần, KHÔNG đụng database.
//
//   node scripts/test-sales-contract.mjs
//
// Số liệu lấy đúng ví dụ trong đề xuất Phòng Kinh doanh 04/11/2026:
//   RESINVA    5tr một lần — trả 3tr tháng 11, 2tr tháng 12
//   Minh Trang 5,8tr       — trả đủ tháng 11
//   Gau Gau    35tr/tháng  — trả 20tr tháng 11, 15tr tháng 12
//   => Doanh số tháng 11 = 3 + 5,8 + 20 = 28.800.000 đ
import { netFromGross, grossFromNet, addMonths, monthRange, normalizePayment, trackContract, revenueByStaff, revenueInMonth, VAT_DEFAULT } from '../lib/salesContract.js'
import { tinhThuong, nguongCua, buildBonusReport, defaultSettings } from '../lib/salesBonus.js'
import { normalizeItems } from '../lib/salesItems.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + '\n          mong ' + w + '\n          nhận ' + g) }
}
const I = (service, billing, amount, extra = {}) => ({ service, billing, amount, start_month: '2026-11', ...extra })
const P = (due, paid, gross, extra = {}) => normalizePayment({ due_month: due, paid_month: paid, gross, ...extra })

console.log('1. Quy đổi VAT\n')
t('16.200.000 đã gồm VAT 8% -> 15.000.000 chưa VAT', netFromGross(16200000, 8), 15000000)
t('Không VAT thì giữ nguyên', netFromGross(5000000, 0), 5000000)
t('Mặc định là 8%', [VAT_DEFAULT, netFromGross(16200000)], [8, 15000000])
t('VAT 10%: 11tr -> 10tr', netFromGross(11000000, 10), 10000000)
t('Ngược lại: 15tr chưa VAT -> 16,2tr vào tài khoản', grossFromNet(15000000, 8), 16200000)
t('Tiền âm -> 0', netFromGross(-5, 8), 0)

console.log('\n2. Cộng tháng\n')
t('11/2026 + 1 = 12/2026', addMonths('2026-11', 1), '2026-12')
t('12/2026 + 1 = 01/2027 (qua năm)', addMonths('2026-12', 1), '2027-01')
t('01/2027 − 1 = 12/2026', addMonths('2027-01', -1), '2026-12')
t('11/2026 + 14 = 01/2028', addMonths('2026-11', 14), '2028-01')
t('Dải tháng 11/2026 → 02/2027', monthRange('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02'])
t('Dải ngược -> rỗng', monthRange('2027-02', '2026-11'), [])

console.log('\n3. Ba hợp đồng trong ví dụ của anh Lộc\n')
{
  // RESINVA: 5tr thu MỘT LẦN ở tháng 11, khách trả làm 2 đợt (số tiền về đã gồm VAT 8%).
  const items = normalizeItems([I('Dịch vụ kế toán trọn gói (làm gọn hồ sơ)', 'once', 5000000)])
  const tra = [P('2026-11', '2026-11', 3240000), P('2026-11', '2026-12', 2160000)]
  const r = trackContract({ items, payments: tra, upto: '2026-12' })
  t('RESINVA: 1 kỳ, cần thu 5tr, đã thu đủ 5tr, còn 0', [r.kys.length, r.canThu, r.daThu, r.conLai], [1, 5000000, 5000000, 0])
  t('RESINVA: 2 lần thu nằm trong kỳ 11/2026', r.kys[0].payments.map(p => p.paid_month), ['2026-11', '2026-12'])
  t('RESINVA: doanh số tháng 11 chỉ 3tr', revenueInMonth(tra, '2026-11'), 3000000)
  t('RESINVA: 2tr còn lại tính cho tháng 12', revenueInMonth(tra, '2026-12'), 2000000)
  t('RESINVA: KHÔNG đẻ kỳ 12/2026 (chỉ thu một lần)', r.kys.map(k => k.month), ['2026-11'])
}
{
  // Chị Minh Trang: 1,8tr/tháng + 4tr ghi tăng BHXH một lần; tháng 11 khách trả đủ 5,8tr.
  const items = normalizeItems([
    I('Ghi tăng BHXH ban đầu', 'once', 4000000),
    I('Dịch vụ hành chính nhân sự', 'monthly', 1800000),
  ])
  const tra = [P('2026-11', '2026-11', 6264000)]
  const r = trackContract({ items, payments: tra, upto: '2026-12' })
  t('Minh Trang: kỳ 11 cần 5,8tr đã thu đủ', [r.kys[0].month, r.kys[0].due, r.kys[0].paid, r.kys[0].left], ['2026-11', 5800000, 5800000, 0])
  t('Minh Trang: tháng 12 TỰ SINH kỳ phí tháng 1,8tr chưa thu', [r.kys[1].month, r.kys[1].due, r.kys[1].left], ['2026-12', 1800000, 1800000])
  t('Minh Trang: doanh số tháng 11 = 5,8tr', revenueInMonth(tra, '2026-11'), 5800000)
}
{
  // Gau Gau: 35tr/tháng + BCTC 35tr/năm (tháng 3). Tháng 11 trả 20tr, tháng 12 trả nốt 15tr.
  const items = normalizeItems([
    I('Dịch vụ kế toán – thuế trọn gói', 'monthly', 35000000),
    I('Lập BCTC và quyết toán thuế năm', 'yearly', 35000000, { start_month: '2027-03' }),
  ])
  const tra = [P('2026-11', '2026-11', 21600000), P('2026-11', '2026-12', 16200000)]
  const r = trackContract({ items, payments: tra, upto: '2026-12' })
  t('Gau Gau: kỳ 11 thu đủ 35tr', [r.kys[0].due, r.kys[0].paid, r.kys[0].left], [35000000, 35000000, 0])
  t('Gau Gau: doanh số tháng 11 chỉ 20tr', revenueInMonth(tra, '2026-11'), 20000000)
  t('Gau Gau: 15tr còn lại tính cho tháng 12', revenueInMonth(tra, '2026-12'), 15000000)
  const r2 = trackContract({ items, payments: tra, upto: '2027-03' })
  t('Gau Gau: tháng 3/2027 cần thu cả phí tháng lẫn BCTC = 70tr', r2.kys.find(k => k.month === '2027-03').due, 70000000)
}
{
  const tra = [
    P('2026-11', '2026-11', 3240000), P('2026-11', '2026-12', 2160000),
    P('2026-11', '2026-11', 6264000),
    P('2026-11', '2026-11', 21600000), P('2026-11', '2026-12', 16200000),
  ]
  t('TỔNG doanh số tháng 11/2026 = 28.800.000 đ (đúng ví dụ tờ trình)', revenueInMonth(tra, '2026-11'), 28800000)
  t('Phần 17tr trả sau tính vào tháng 12', revenueInMonth(tra, '2026-12'), 17000000)
}

console.log('\n4. Khoản khách trả thẳng bên thứ ba\n')
{
  const items = normalizeItems([
    I('Dịch vụ kế toán – thuế trọn gói', 'monthly', 3000000),
    I('Phần mềm kế toán MISA ASP — 3 năm', 'once', 8100000, { to_savitax: false }),
  ])
  const r = trackContract({ items, payments: [], upto: '2026-11' })
  t('Tiền MISA KHÔNG vào số cần thu của Savitax', r.kys[0].due, 3000000)
}

console.log('\n5. Doanh số theo người\n')
{
  const tra = [
    { paid_month: '2026-11', net: 3000000, staff_id: 'A' },
    { paid_month: '2026-11', net: 5800000, staff_id: 'A' },
    { paid_month: '2026-11', net: 20000000, staff_id: 'B' },
    { paid_month: '2026-12', net: 15000000, staff_id: 'B' },
  ]
  const m = revenueByStaff(tra, '2026-11')
  t('A được 8,8tr · B được 20tr trong tháng 11', [m.get('A'), m.get('B')], [8800000, 20000000])
  t('Tháng 12 chỉ còn B 15tr', [...revenueByStaff(tra, '2026-12').entries()], [['B', 15000000]])
}

console.log('\n6. Thưởng — đúng bảng ví dụ trong tờ trình\n')
t('28,8tr: thử việc (mốc 30tr) KHÔNG thưởng', tinhThuong(28800000, 30000000, 10).thuong, 0)
t('28,8tr: chính thức (mốc 35tr) KHÔNG thưởng', tinhThuong(28800000, 35000000, 10).thuong, 0)
t('40tr: thử việc được 1.000.000 đ', tinhThuong(40000000, 30000000, 10).thuong, 1000000)
t('40tr: chính thức được 500.000 đ', tinhThuong(40000000, 35000000, 10).thuong, 500000)
t('68,6tr: thử việc được 3.860.000 đ', tinhThuong(68600000, 30000000, 10).thuong, 3860000)
t('68,6tr: chính thức được 3.360.000 đ', tinhThuong(68600000, 35000000, 10).thuong, 3360000)
t('Đúng bằng mốc thì không thưởng', tinhThuong(35000000, 35000000, 10), { vuot: 0, thuong: 0, dat: false })
t('Mốc theo cấp: thử việc 30tr', nguongCua({ level: 'thu_viec' }, defaultSettings()), 30000000)
t('Mốc theo cấp: chính thức 35tr', nguongCua({ level: 'chinh_thuc' }, defaultSettings()), 35000000)
t('Sếp đặt mốc riêng thì ưu tiên mốc riêng', nguongCua({ level: 'chinh_thuc', nguong: 20000000 }, defaultSettings()), 20000000)

console.log('\n7. Bảng báo cáo tháng\n')
{
  const rep = buildBonusReport({
    period: '2026-11',
    staff: [{ id: 'A', full_name: 'Nguyễn Bảo Minh Lộc' }, { id: 'B', full_name: 'Trần Thị B' }, { id: 'C', full_name: 'Lê Văn C' }],
    doanhSo: new Map([['A', 68600000], ['B', 40000000]]),
    levels: new Map([['B', { level: 'thu_viec', nguong: null }]]),
    settings: defaultSettings(),
    saved: new Map([['A', { id: 'r1', doanh_so: 68600000, trang_thai: 'da_duyet' }]]),
  })
  t('Xếp theo doanh số giảm dần', rep.rows.map(r => r.staff_name), ['Nguyễn Bảo Minh Lộc', 'Trần Thị B', 'Lê Văn C'])
  t('A chính thức: thưởng 3.360.000', [rep.rows[0].nguong, rep.rows[0].thuong], [35000000, 3360000])
  t('B thử việc: thưởng 1.000.000', [rep.rows[1].nguong, rep.rows[1].thuong], [30000000, 1000000])
  t('C không có doanh số vẫn hiện, thưởng 0', [rep.rows[2].doanh_so, rep.rows[2].thuong, rep.rows[2].dat], [0, 0, false])
  t('Tổng doanh số · tổng thưởng · số người đạt', [rep.tongDoanhSo, rep.tongThuong, rep.soNguoiDat], [108600000, 4360000, 2])
  t('Giữ trạng thái đã duyệt của dòng đã lưu', rep.rows[0].trang_thai, 'da_duyet')
  t('Số khớp bản đã trình thì không báo lệch', rep.rows[0].lech, false)
}
{
  // Ghi thêm một lần thu SAU khi đã trình duyệt -> phải báo lệch để sếp duyệt lại.
  const rep = buildBonusReport({
    period: '2026-11', staff: [{ id: 'A', full_name: 'A' }], doanhSo: new Map([['A', 50000000]]),
    levels: new Map(), settings: defaultSettings(),
    saved: new Map([['A', { id: 'r1', doanh_so: 40000000, trang_thai: 'da_duyet' }]]),
  })
  t('Thu thêm sau khi duyệt -> báo lệch', [rep.rows[0].lech, rep.rows[0].doanh_so_da_trinh], [true, 40000000])
}

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi')
process.exit(fail ? 1 : 0)
