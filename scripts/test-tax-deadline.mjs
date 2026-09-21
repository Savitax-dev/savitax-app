// Kiểm lib/taxDeadline.js — quy tắc hạn nộp và kỳ khai.
//   node scripts/test-tax-deadline.mjs
import {
  hanNop, hanNopGoc, toISO, cacKyTrongNam, kyQuyetToanNam, chuanHoaKy, nhanKy, dayQuaNgayLamViec, fromISO,
} from '../lib/taxDeadline.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const dat = thucTe === mongDoi
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `  → ra "${thucTe}", đáng lẽ "${mongDoi}"`}`)
  if (!dat) hong++
}

console.log('Hạn nộp GỐC (chưa đẩy ngày nghỉ):')
kiem('tháng 9/2026 → 20/10',        toISO(hanNopGoc('month', '2026-09-30')), '2026-10-20')
kiem('tháng 12/2026 → 20/01 năm sau', toISO(hanNopGoc('month', '2026-12-31')), '2027-01-20')
kiem('quý 1/2026 → 30/04',          toISO(hanNopGoc('quarter', '2026-03-31')), '2026-04-30')
kiem('quý 2/2026 → 31/07',          toISO(hanNopGoc('quarter', '2026-06-30')), '2026-07-31')
kiem('quý 3/2026 → 31/10',          toISO(hanNopGoc('quarter', '2026-09-30')), '2026-10-31')
kiem('quý 4/2026 → 31/01 năm sau',  toISO(hanNopGoc('quarter', '2026-12-31')), '2027-01-31')
kiem('năm 2026 → 31/01/2027',       toISO(hanNopGoc('year', '2026-12-31')), '2027-01-31')
kiem('quyết toán 2026 → 31/03/2027', toISO(hanNopGoc('settlement', '2026-12-31')), '2027-03-31')
kiem('theo lần phát sinh 05/09 → 15/09', toISO(hanNopGoc('per_event', '2026-09-05')), '2026-09-15')
// Năm tài chính lệch: kết thúc 30/06 → hạn quyết toán 30/09 cùng năm.
kiem('quyết toán năm tài chính kết thúc 30/06', toISO(hanNopGoc('settlement', '2026-06-30')), '2026-09-30')

console.log('')
console.log('Đẩy qua thứ Bảy / Chủ nhật / ngày lễ:')
const le2027 = new Set(['2027-01-01'])
kiem('31/01/2027 là Chủ nhật → 01/02',   hanNop('quarter', '2026-12-31'), '2027-02-01')
kiem('20/09/2026 là Chủ nhật → 21/09',   hanNop('month', '2026-08-31'), '2026-09-21')
kiem('31/10/2026 là thứ Bảy → 02/11',    hanNop('quarter', '2026-09-30'), '2026-11-02')
kiem('rơi đúng ngày lễ thì đẩy tiếp',
  toISO(dayQuaNgayLamViec(fromISO('2027-01-01'), le2027)), '2027-01-04')   // 01/01 lễ, 02-03 cuối tuần
// Tết nghỉ dài: 15-21/02/2027 nghỉ, hạn 20/02 phải nhảy tới 22/02 (thứ Hai).
const tet = new Set(['2027-02-15', '2027-02-16', '2027-02-17', '2027-02-18', '2027-02-19'])
kiem('Tết nghỉ liền 5 ngày vẫn đẩy tới nơi',
  toISO(dayQuaNgayLamViec(fromISO('2027-02-19'), tet)), '2027-02-22')

console.log('')
console.log('Sinh kỳ trong năm:')
const quy = cacKyTrongNam('quarterly', 2026)
const thang = cacKyTrongNam('monthly', 2026)
kiem('khai quý ra 4 kỳ', quy.length, 4)
kiem('khai tháng ra 12 kỳ', thang.length, 12)
kiem('mã kỳ quý 3', quy[2].period_code, 'Q3.2026')
kiem('quý 3 bắt đầu 01/07', quy[2].period_start, '2026-07-01')
kiem('quý 3 kết thúc 30/09', quy[2].period_end, '2026-09-30')
kiem('mã kỳ tháng 2 (năm nhuận 2028 tính riêng)', thang[1].period_code, 'T02.2026')
kiem('tháng 2/2026 kết thúc 28', thang[1].period_end, '2026-02-28')
kiem('tháng 2/2028 kết thúc 29', cacKyTrongNam('monthly', 2028)[1].period_end, '2028-02-29')
kiem('kỳ quyết toán năm', kyQuyetToanNam(2026).period_code, 'NAM.2026')

console.log('')
console.log('Đọc kỳ từ XML của cổng:')
kiem('"2/2026" với tờ khai quý → Q2.2026',  chuanHoaKy('2/2026', 'quarter'), 'Q2.2026')
kiem('"2/2026" với tờ khai tháng → T02.2026', chuanHoaKy('2/2026', 'month'), 'T02.2026')
kiem('"09/2026" tháng → T09.2026',          chuanHoaKy('09/2026', 'month'), 'T09.2026')
kiem('"2026" → NAM.2026',                   chuanHoaKy('2026', 'settlement'), 'NAM.2026')
kiem('quý 5 là sai → null',                 chuanHoaKy('5/2026', 'quarter'), null)
kiem('chuỗi lạ → null',                     chuanHoaKy('linh tinh', 'month'), null)
kiem('rỗng → null',                         chuanHoaKy('', 'month'), null)

console.log('')
console.log('Nhãn hiện lên màn hình:')
kiem('Q2.2026', nhanKy('Q2.2026'), 'Quý 2/2026')
kiem('T09.2026', nhanKy('T09.2026'), 'Tháng 09/2026')
kiem('NAM.2026', nhanKy('NAM.2026'), 'Năm 2026')

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
