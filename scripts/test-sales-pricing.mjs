// Kiểm engine tính phí báo giá (lib/salesPricing.js) — hai lớp:
//   1. Chạy lại 5 báo giá THẬT của bản chạy thử (state.json) → phải ra y hệt từng dòng phí, căn cứ,
//      cảnh báo và tổng tháng mà bản chạy thử đã lưu.
//   2. Các ca biên theo tài liệu bàn giao mục 4 (bậc, vượt bậc, >30 tỷ, ×1,2, phụ thu, HCNS...).
//
//   node scripts/test-sales-pricing.mjs [đường-dẫn-state.json]
//
// Chỉ đọc file, KHÔNG đụng database. state.json nằm trong app.baogia/ (đã gitignore vì chứa dữ liệu
// khách thật) — máy không có file đó thì lớp 1 tự bỏ qua.
import { readFileSync, existsSync } from 'node:fs'
import { computeFees, normalizeSurvey, priceQuote } from '../lib/salesPricing.js'
import { printedMonthlyLines } from '../lib/salesDocx.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + '\n          mong ' + w + '\n          nhận ' + g) }
}

const statePath = process.argv[2] || 'app.baogia/02. APP DANG CHAY/state.json'
if (existsSync(statePath)) {
  console.log('1. Chạy lại báo giá thật của bản chạy thử\n')
  const { quotes } = JSON.parse(readFileSync(statePath, 'utf8'))
  for (const q of quotes) {
    const s = normalizeSurvey(q.survey)
    const f = computeFees(s)
    const tag = q.no + ' ' + (q.survey.company || '').slice(0, 28)
    t(tag + ' — dòng phí', f.lines, q.fees.lines)
    t(tag + ' — dịch vụ tùy chọn', f.optional, q.fees.optional)
    t(tag + ' — căn cứ', f.basis, q.fees.basis)
    t(tag + ' — cảnh báo', f.warnings, q.fees.warnings)
    t(tag + ' — phí/tháng theo biểu', f.monthly, q.standardMonthly)
    const p = priceQuote(q.survey, q.override)
    t(tag + ' — phí thực áp dụng', p.monthlyFinal, q.monthlyFinal)
  }
} else {
  console.log('(Bỏ qua lớp 1 — không thấy ' + statePath + ')')
}

console.log('\n2. Ca biên theo biểu phí\n')
const fee = (patch) => computeFees(normalizeSurvey(patch)).monthly
const base = (patch) => computeFees(normalizeSurvey(patch)).lines[0].fee

t('TM không phát sinh -> 1.000.000', base({ sector: 'tm' }), 1000000)
t('TM 10 chứng từ (dưới 10) -> 2.000.000', base({ sector: 'tm', invIn: 10 }), 2000000)
t('TM 11 chứng từ -> 2.500.000', base({ sector: 'tm', invIn: 11 }), 2500000)
t('TM 70 chứng từ, có HQ -> 5.500.000', base({ sector: 'tm', invIn: 70, customs: true }), 5500000)
t('SX 60 chứng từ -> 5.000.000 (bậc cuối nhóm SX)', base({ sector: 'sx', invIn: 60 }), 5000000)
t('SX 61 chứng từ, chưa doanh thu -> theo doanh thu 4.000.000', base({ sector: 'sx', invIn: 61 }), 4000000)
t('DV 65 chứng từ -> 5.500.000 (DV có bậc 61–70)', base({ sector: 'dv', invIn: 65 }), 5500000)
t('Vượt bậc, doanh thu đúng 5 tỷ -> 7.000.000', base({ invIn: 100, revenueYear: 5e9 }), 7000000)
t('Vượt bậc, doanh thu 5 tỷ + 1đ -> 10.000.000', base({ invIn: 100, revenueYear: 5e9 + 1 }), 10000000)
t('Vượt bậc, doanh thu 30 tỷ -> 20.000.000', base({ invIn: 100, revenueYear: 30e9 }), 20000000)
{
  const f = computeFees(normalizeSurvey({ sector: 'tm', invIn: 80, revenueYear: 31e9 }))
  t('>30 tỷ: bậc cuối + 50.000 × số vượt (5.500.000? không HQ: 5.000.000 + 10×50.000)', f.lines[0].fee, 5500000)
  t('>30 tỷ: có cảnh báo cần Giám đốc duyệt', f.warnings.some(w => w.includes('Giám đốc duyệt')), true)
}
{
  const f = computeFees(normalizeSurvey({ invIn: 100, revenueYear: 1e9 }))
  t('perInv (5.000.000+30×50.000=6.500.000) THẤP hơn 7.000.000 -> KHÔNG in câu so sánh', f.basis.length, 1)
}
t('Kê khai tháng ×1,2: 2.500.000 -> 3.000.000', base({ invIn: 15, monthlyFiling: true }), 3000000)
t('Phụ thu vùng b cộng vào tổng tháng', fee({ invIn: 15, area: 'b' }), 3000000)
t('HCNS có chọn: 5 người cộng 1.000.000 vào tổng', fee({ invIn: 15, wantHcns: true, hcnsHeads: 5 }), 3500000)
{
  const f = computeFees(normalizeSurvey({ invIn: 15, wantHcns: false, hcnsHeads: 5 }))
  t('HCNS không chọn: không vào tổng, xuống mục tùy chọn', [f.monthly, f.optional.length], [2500000, 1])
}
{
  const f = computeFees(normalizeSurvey({ invIn: 15, monthlyFiling: true }))
  const bctc = f.lines.find(l => l.key === 'bctc')
  t('BCTC năm = 1 tháng phí gốc (đã ×1,2) và KHÔNG vào tổng tháng', [bctc.fee, bctc.yearly, f.monthly], [3000000, true, 3000000])
}
{
  const f = computeFees(normalizeSurvey({ invIn: 15, wantReview: true }))
  t('Hoàn thiện sổ sách = 80% phí gốc, ở mục tùy chọn', f.optional[0].fee, 2000000)
}
t('docs tự cộng, không nhận số nhập tay', normalizeSurvey({ invIn: 5, invOut: 7, bankStmt: 3, docs: 999 }).docs, 15)
t('Báo giá cũ chỉ có docs -> dồn vào HĐ mua vào', normalizeSurvey({ docs: 40 }).invIn, 40)
t('Mã dịch vụ lẻ lạ bị loại', normalizeSurvey({ extras: ['qt_tncn', 'hack'] }).extras, ['qt_tncn'])
{
  const w = computeFees(normalizeSurvey({ revenueYear: 3e9 })).warnings
  t('Có doanh thu nhưng thiếu chứng từ -> cảnh báo thiếu căn cứ chính', w[0].startsWith('Chưa có số chứng từ/tháng'), true)
}
{
  const w = computeFees(normalizeSurvey({ sector: 'dv', invIn: 3300 })).warnings
  t('Vượt bậc chứng từ mà doanh thu 0 -> cảnh báo kiểm tra doanh thu', w.some(x => x.includes('chưa nhập doanh thu')), true)
  const w2 = computeFees(normalizeSurvey({ sector: 'dv', invIn: 3300, revenueYear: 8e9 })).warnings
  t('Vượt bậc có doanh thu -> không cảnh báo doanh thu', w2.some(x => x.includes('chưa nhập doanh thu')), false)
}
{
  const p = priceQuote({ invIn: 15 }, { on: true, amount: '1800000.7' })
  t('Đề xuất giá: làm tròn, phí thực = mức đề xuất, phí biểu giữ nguyên', [p.monthlyFinal, p.standardMonthly], [1800001, 2500000])
}

console.log('\n3. Dòng phí in trong file Word khi đề xuất mức khác\n')
{
  // biểu phí: kế toán 2.500.000 + HCNS 1.000.000 = 3.500.000; đề xuất 3.000.000
  const p = priceQuote({ invIn: 15, wantHcns: true, hcnsHeads: 5 }, { on: true, amount: 3000000 })
  const L = printedMonthlyLines(p.fees, p.monthlyFinal)
  t('Đề xuất thấp hơn: dòng kế toán 2.500.000 → 2.000.000, HCNS giữ nguyên', L.map(l => l.fee), [2000000, 1000000])
  t('Cộng các dòng in ra = đúng dòng TỔNG', L.reduce((a, l) => a + l.fee, 0), 3000000)
  t('Không đụng dữ liệu gốc (fees vẫn theo biểu phí)', p.fees.lines[0].fee, 2500000)
}
{
  const p = priceQuote({ invIn: 15 }, { on: true, amount: 4000000 })
  t('Đề xuất cao hơn: dòng kế toán = mức đề xuất', printedMonthlyLines(p.fees, p.monthlyFinal).map(l => l.fee), [4000000])
}
{
  const p = priceQuote({ invIn: 15, wantHcns: true, hcnsHeads: 5 }, { on: true, amount: 500000 })
  t('Chênh làm dòng kế toán âm → giữ nguyên theo biểu phí, không in số âm', printedMonthlyLines(p.fees, p.monthlyFinal).map(l => l.fee), [2500000, 1000000])
}
{
  const p = priceQuote({ invIn: 15, area: 'a' }, null)
  t('Không đề xuất: in y như biểu phí', printedMonthlyLines(p.fees, p.monthlyFinal).map(l => l.fee), [2500000, 200000])
}

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi')
process.exit(fail ? 1 : 0)
