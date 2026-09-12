// Kiểm bộ đọc phiếu khảo sát SVT.MB01 (lib/salesSurvey.js) — hàm thuần, KHÔNG đụng database.
//
//   node scripts/test-sales-survey.mjs
//
// Ca thật 11/09/2026: mẫu 2026 có dòng TIÊU ĐỀ "Doanh thu | Số tiền (đồng)" nên bộ đọc cũ vớ trúng
// dòng đó rồi dừng -> doanh thu luôn ra 0, nhân viên phải nhập tay. Số kiểu "400,000,000" bị đọc
// thành 400, "3 TỶ" thành 3.
import { moneyVN, applySurveyRows } from '../lib/salesSurvey.js'
import { emptySurvey } from '../lib/salesPricing.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + ' — mong ' + w + ', nhận ' + g) }
}
const rev = rows => { const s = emptySurvey(); applySurveyRows(rows, s); return s.revenueYear }

console.log('1. Đọc số tiền viết tay\n')
t('"3 TỶ"', moneyVN('3 TỶ'), 3e9)
t('"3,5 tỷ"', moneyVN('3,5 tỷ'), 3.5e9)
t('"1.2 tỉ"', moneyVN('1.2 tỉ'), 1.2e9)
t('"400,000,000" (dấu phẩy ngăn nghìn)', moneyVN('400,000,000'), 4e8)
t('"4.000.000.000" (dấu chấm ngăn nghìn)', moneyVN('4.000.000.000'), 4e9)
t('"500 triệu"', moneyVN('500 triệu'), 5e8)
t('"50 tr"', moneyVN('50 tr'), 5e7)
t('"2 tỷ/năm"', moneyVN('2 tỷ/năm'), 2e9)
t('"NA" -> 0', moneyVN('NA'), 0)
t('trống -> 0', moneyVN(''), 0)

console.log('\n2. Lấy doanh thu từ các kiểu bố cục phiếu\n')
const header = ['Doanh thu', 'Số tiền (đồng)']
const nganh = ['Ngành nghề KD chính (tạo ra doanh thu chủ yếu)', '']
t('Mẫu 2026: bỏ qua dòng tiêu đề, lấy "Doanh thu cả năm"',
  rev([nganh, header, ['Doanh thu bình quân / tháng (*)', '400,000,000'], ['Doanh thu cả năm (nếu ước lượng được)', '4,000,000,000']]), 4e9)
t('Mẫu 2026: cả năm bỏ trống -> bình quân tháng × 12',
  rev([nganh, header, ['Doanh thu bình quân / tháng (*)', '3 TỶ'], ['Doanh thu cả năm (nếu ước lượng được)', '']]), 36e9)
t('Chỉ có dòng tiêu đề -> 0, không nhận "Số tiền (đồng)" là số', rev([header]), 0)
t('Mẫu cũ 3 cột Tháng | Quý | Năm -> lấy cột Năm', rev([['Doanh thu', '200000000', '', '5000000000']]), 5e9)
t('Mẫu cũ chỉ có cột Tháng -> × 12', rev([['Doanh thu', '200000000', '', '']]), 24e8)
t('Mẫu cũ chỉ có cột Quý -> × 4', rev([['Doanh thu', '', '1000000000', '']]), 4e9)
t('Không có dòng doanh thu nào -> 0', rev([nganh, ['Mã số thuế', '0312345678']]), 0)
t('Nhãn ngành nghề có chữ "doanh thu" không bị vớ nhầm', rev([nganh]), 0)

console.log('\n3. Các trường khác vẫn đọc đúng\n')
{
  const s = emptySurvey()
  const got = applySurveyRows([
    ['Tên doanh nghiệp', 'CÔNG TY TNHH ABC'], ['Mã số thuế', '0312345678'],
    ['Số lượng hóa đơn mua vào (*)', '300'], ['Số lượng hóa đơn bán ra (*)', '3,000'],
    ['Số tờ sao kê ngân hàng (*)', 'NA'], ['Số lượng nhân sự tham gia BHXH', '5'],
  ], s)
  t('tên + MST + chứng từ (3,000 = 3000, "NA" = 0)', [s.company, s.mst, s.invIn, s.invOut, s.bankStmt, s.docs], ['CÔNG TY TNHH ABC', '0312345678', 300, 3000, 0, 3300])
  t('lao động BHXH điền sang số người tính phí HCNS', [s.laborBh, s.hcnsHeads], [5, 5])
  t('có báo đã điền được trường nào', got.includes('tên công ty') && got.includes('HĐ bán ra'), true)
}

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi')
process.exit(fail ? 1 : 0)
