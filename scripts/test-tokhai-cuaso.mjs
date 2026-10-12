// Kiểm cách chia khoảng ngày thành cửa sổ tra cứu, và chọn tab theo mốc 01/07/2025.
//   node scripts/test-tokhai-cuaso.mjs
//
// Vì sao phải có bộ kiểm riêng: đây là chỗ sai thì MẤT DỮ LIỆU LẶNG LẼ nhất của cả phân hệ.
// Cổng có hai tab tra cứu chia nhau ở mốc 01/07/2025. Hỏi nhầm tab thì cổng KHÔNG báo lỗi — nó
// trả bảng rỗng, nhìn y hệt "công ty không nộp gì tháng đó". Ca thật ngày 11/10/2026: tra cả năm
// 2025 chỉ về được từ quý 2, quý 1 mất tăm, mà không có dấu hiệu gì.
import { chiaCuaSo, MOC_DVC, ddmmyyyy } from '../lib/tokhaiCuaSo.js'

let dat = 0, hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  if (a === b) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log(`  ✗ ${ten}\n      ra      ${a}\n      đáng lẽ ${b}`) }
}
const nguonCua = cs => [...new Set(cs.map(c => c.nguon))].sort()

console.log('\nKhoảng nằm HẲN một bên mốc:')
let cs = chiaCuaSo({ tuNgay: '2026-09-01', denNgay: '2026-09-30' })
kiem('tháng 9/2026 → chỉ hỏi tab DVC', nguonCua(cs), ['dvc'])
kiem('gọn trong một cửa sổ', cs.length, 1)

cs = chiaCuaSo({ tuNgay: '2025-04-01', denNgay: '2025-04-30' })
kiem('tháng 4/2025 → chỉ hỏi tab thuế điện tử', nguonCua(cs), ['etax'])
kiem('gọn trong một cửa sổ', cs.length, 1)

console.log('')
console.log('Khoảng VẮT NGANG mốc — ca làm mất dữ liệu:')
cs = chiaCuaSo({ tuNgay: '2025-06-15', denNgay: '2025-07-15' })
kiem('hỏi CẢ HAI tab', nguonCua(cs), ['dvc', 'etax'])
// Không cửa sổ nào được phép chứa cả ngày trước lẫn ngày từ mốc.
const vatNgang = cs.filter(c => {
  const [dt, mt, yt] = c.tuNgay.split('/').map(Number)
  const [dd, md, yd] = c.denNgay.split('/').map(Number)
  const tu = new Date(Date.UTC(yt, mt - 1, dt)), den = new Date(Date.UTC(yd, md - 1, dd))
  return tu < MOC_DVC && den >= MOC_DVC
})
kiem('KHÔNG cửa sổ nào vắt ngang mốc', vatNgang.length, 0)
const dvc = cs.filter(c => c.nguon === 'dvc')
const etax = cs.filter(c => c.nguon === 'etax')
kiem('phần DVC bắt đầu đúng ngày mốc', dvc[dvc.length - 1].tuNgay, ddmmyyyy(MOC_DVC))
kiem('phần cũ kết thúc đúng hôm trước mốc', etax[0].denNgay, '30/06/2025')

console.log('')
console.log('Cả năm 2025 — ca anh gặp thật:')
cs = chiaCuaSo({ tuNgay: '2025-01-01', denNgay: '2025-12-31' })
kiem('hỏi cả hai tab', nguonCua(cs), ['dvc', 'etax'])
kiem('có cửa sổ phủ tháng 4/2025 (kỳ Q1 nộp tháng 4)',
  cs.some(c => c.nguon === 'etax' && c.tuNgay.endsWith('/04/2025') || c.denNgay.endsWith('/04/2025')), true)
kiem('mọi cửa sổ phần cũ đều là etax',
  cs.filter(c => Number(c.denNgay.split('/')[2]) === 2025 && Number(c.denNgay.split('/')[1]) <= 6)
    .every(c => c.nguon === 'etax'), true)

console.log('')
console.log('Không cửa sổ nào dài quá mức cổng cho (31 ngày kể cả hai đầu):')
const soNgay = c => {
  const [dt, mt, yt] = c.tuNgay.split('/').map(Number)
  const [dd, md, yd] = c.denNgay.split('/').map(Number)
  return (Date.UTC(yd, md - 1, dd) - Date.UTC(yt, mt - 1, dt)) / 864e5 + 1
}
kiem('tất cả đều ≤ 31 ngày', cs.filter(c => soNgay(c) > 31).length, 0)

console.log('')
console.log('Tháng dương lịch phải gọn trong MỘT cửa sổ — mỗi cửa sổ tab cũ tốn một mã captcha:')
// Để 30 ngày thì tháng 31 ngày bị cắt làm hai, cửa sổ thứ hai chỉ có 1 ngày và thường rỗng
// nhưng vẫn tốn một mã. Anh gặp thật 11/10/2026: tra tháng 3 mà phải gõ 3 mã.
for (const [t, d, ten] of [['2025-01-01', '2025-01-31', 'tháng 1 (31 ngày)'],
                           ['2025-03-01', '2025-03-31', 'tháng 3 (31 ngày)'],
                           ['2025-04-01', '2025-04-30', 'tháng 4 (30 ngày)'],
                           ['2025-02-01', '2025-02-28', 'tháng 2 (28 ngày)']]) {
  kiem(ten + ' → 1 cửa sổ', chiaCuaSo({ tuNgay: t, denNgay: d }).length, 1)
}

console.log('')
console.log('Đầu vào thiếu:')
kiem('không truyền ngày → vẫn ra cửa sổ, không nổ', chiaCuaSo({}).length > 0, true)
kiem('và mặc định là tab DVC (30 ngày gần nhất)', nguonCua(chiaCuaSo({})), ['dvc'])

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
