// Kiểm luật sinh lịch hạn nộp theo kỳ khai (lib/tokhaiLich.js) — dữ liệu giả, không đụng Supabase.
//
//   node scripts/test-tokhai-lich.mjs
//
// Vì sao phải có bộ kiểm riêng: lịch hạn nộp là thứ nhân viên dựa vào để khỏi trễ hạn. Sinh thừa
// một kỳ là báo "Quá hạn" oan; sinh thiếu một kỳ là để trễ hạn mà app im lặng — cái sau nguy hiểm
// hơn nhiều vì không ai thấy để mà sửa.
import { kyKhaiTai, nghiaVuDinhKy, ngayDauQuy } from '../lib/tokhaiLich.js'

let dat = 0, hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  if (a === b) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log(`  ✗ ${ten}\n      ra      ${a}\n      đáng lẽ ${b}`) }
}
const ma = (ds) => ds.map(o => o.period_code)

const TNCN = { id: 'tncn', code: '05/KK-TNCN' }
const thang = { id: 'c1', report_type: 'monthly' }
const quy = { id: 'c2', report_type: 'quarterly' }

console.log('\n[1] KHÔNG có ghi đè -> y như trước đây (theo report_type):')
kiem('cty kê tháng -> 12 kỳ tháng', ma(nghiaVuDinhKy({ client: thang, loai: TNCN, nam: 2026 })),
  ['T01.2026','T02.2026','T03.2026','T04.2026','T05.2026','T06.2026','T07.2026','T08.2026','T09.2026','T10.2026','T11.2026','T12.2026'])
kiem('cty kê quý -> 4 kỳ quý', ma(nghiaVuDinhKy({ client: quy, loai: TNCN, nam: 2026 })),
  ['Q1.2026','Q2.2026','Q3.2026','Q4.2026'])

console.log('\n[2] Ca HSIN: kê tháng, nhưng TNCN đổi sang QUÝ từ Q3/2026:')
const hsin = [{ period_kind: 'quarter', effective_from: '2026-07-01' }]
const ds = ma(nghiaVuDinhKy({ client: thang, loai: TNCN, nam: 2026, ghiDe: hsin }))
kiem('6 tháng đầu năm vẫn theo tháng, từ Q3 theo quý', ds,
  ['T01.2026','T02.2026','T03.2026','T04.2026','T05.2026','T06.2026','Q3.2026','Q4.2026'])
kiem('KHÔNG còn T07, T08, T09 (lỗi báo "Chưa nộp" oan)', ['T07.2026','T08.2026','T09.2026'].some(k => ds.includes(k)), false)
kiem('có Q3.2026 để hồ sơ "Q3/2026" đã nộp gắn vào', ds.includes('Q3.2026'), true)
// Phủ kín: không tháng nào trong năm bị bỏ rơi — sinh thiếu là để trễ hạn mà app im lặng.
const phu = new Set()
for (const o of nghiaVuDinhKy({ client: thang, loai: TNCN, nam: 2026, ghiDe: hsin })) {
  const tu = +o.period_start.slice(5, 7), den = +o.period_end.slice(5, 7)
  for (let m = tu; m <= den; m++) phu.add(m)
}
kiem('phủ đủ 12 tháng, không hở tháng nào', phu.size, 12)

console.log('\n[3] Chiều ngược lại: kê quý, đổi sang THÁNG từ Q2/2026:')
kiem('Q1 theo quý, từ tháng 4 theo tháng',
  ma(nghiaVuDinhKy({ client: quy, loai: TNCN, nam: 2026, ghiDe: [{ period_kind: 'month', effective_from: '2026-04-01' }] })),
  ['Q1.2026','T04.2026','T05.2026','T06.2026','T07.2026','T08.2026','T09.2026','T10.2026','T11.2026','T12.2026'])

console.log('\n[4] Nhiều lần đổi — lấy lần MỚI NHẤT đã có hiệu lực:')
const haiLan = [
  { period_kind: 'quarter', effective_from: '2026-04-01' },
  { period_kind: 'month', effective_from: '2026-10-01' },
]
kiem('tháng 3 -> chưa có ghi đè -> monthly', kyKhaiTai(thang, haiLan, '2026-03-01'), 'monthly')
kiem('tháng 7 -> lần 1 -> quarterly', kyKhaiTai(thang, haiLan, '2026-07-01'), 'quarterly')
kiem('tháng 11 -> lần 2 -> monthly', kyKhaiTai(thang, haiLan, '2026-11-01'), 'monthly')
kiem('thứ tự khai báo không ảnh hưởng', kyKhaiTai(thang, [...haiLan].reverse(), '2026-11-01'), 'monthly')

console.log('\n[5] Sinh lại sau khi đổi — chỉ từ kỳ áp dụng trở đi:')
kiem('tuNgay 2026-07-01 -> chỉ Q3, Q4',
  ma(nghiaVuDinhKy({ client: thang, loai: TNCN, nam: 2026, ghiDe: hsin, tuNgay: '2026-07-01' })),
  ['Q3.2026','Q4.2026'])

console.log('\n[6] Hợp đồng ký giữa năm vẫn được tôn trọng:')
kiem('ký 15/08 -> không sinh kỳ kết thúc trước ngày ký',
  ma(nghiaVuDinhKy({ client: { ...thang, contract_start: '2026-08-15' }, loai: TNCN, nam: 2026, ghiDe: hsin })),
  ['Q3.2026','Q4.2026'])

console.log('\n[7] Hạn nộp đúng theo loại kỳ:')
const q3 = nghiaVuDinhKy({ client: thang, loai: TNCN, nam: 2026, ghiDe: hsin }).find(o => o.period_code === 'Q3.2026')
// Hạn gốc của quý là ngày cuối tháng kế tiếp — 31/10/2026. Nhưng ngày đó là THỨ BẢY, nên lùi
// sang ngày làm việc kế tiếp là THỨ HAI 02/11/2026 (hanNop đã lo phần này). Bản đầu của bộ kiểm
// ghi kỳ vọng 31/10 — sai, chính bộ kiểm này bắt được.
kiem('Q3.2026 hạn 02/11/2026 — 31/10 rơi thứ Bảy (và không phải 20/10 như kỳ tháng)', q3.due_date, '2026-11-02')

console.log('\n[8] Dòng ghi đè hỏng thì bỏ qua, không làm sập:')
kiem('period_kind lạ -> theo report_type', kyKhaiTai(thang, [{ period_kind: 'year', effective_from: '2026-01-01' }], '2026-07-01'), 'monthly')
kiem('thiếu effective_from -> theo report_type', kyKhaiTai(thang, [{ period_kind: 'quarter' }], '2026-07-01'), 'monthly')
kiem('ngayDauQuy Q3.2026', ngayDauQuy('Q3.2026'), '2026-07-01')
kiem('ngayDauQuy Q1.2027', ngayDauQuy('Q1.2027'), '2027-01-01')
kiem('ngayDauQuy rác -> null', ngayDauQuy('T09.2026'), null)

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
