// Kiểm luật sinh lịch hạn nộp theo kỳ khai (lib/tokhaiLich.js) — dữ liệu giả, không đụng Supabase.
//
//   node scripts/test-tokhai-lich.mjs
//
// Vì sao phải có bộ kiểm riêng: lịch hạn nộp là thứ nhân viên dựa vào để khỏi trễ hạn. Sinh thừa
// một kỳ là báo "Quá hạn" oan; sinh thiếu một kỳ là để trễ hạn mà app im lặng — cái sau nguy hiểm
// hơn nhiều vì không ai thấy để mà sửa.
import { kyKhaiTai, nghiaVuDinhKy, ngayDauQuy, timKyKhaiTheoCong, kieuCuaKy, quyCuaKy, ngaySauKy } from '../lib/tokhaiLich.js'

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

console.log('\n[9] Tự nhận kỳ khai theo cổng (timKyKhaiTheoCong):')
kiem('kieuCuaKy T09/Q3/PS', [kieuCuaKy('T09.2026'), kieuCuaKy('Q3.2026'), kieuCuaKy('PS.2026-10-15'), kieuCuaKy('2026')], ['monthly', 'quarterly', null, null])
kiem('quyCuaKy T08 -> Q3, Q3 -> Q3', [quyCuaKy('T08.2026'), quyCuaKy('Q3.2026')], ['Q3.2026', 'Q3.2026'])
const LOAI = new Map([['tncn', TNCN], ['gtgt', { id: 'gtgt', code: '01/GTGT' }]])
// Mặc định: nộp ngay sau kỳ, đồng bộ sau mốc sửa lỗi "quý 9" — tức hồ sơ đáng tin.
const hs = (loai, ky, them = {}) => ({ filing_type_id: loai, period_code: ky, state: 'accepted', form_kind: 'Chính thức', amend_no: 0,
  submitted_at: ngaySauKy(ky) + 'T09:00:00+07:00', synced_at: '2026-10-19T05:00:00Z', ...them })
const tim = (hoSo, ghiDe = [], client = thang) => timKyKhaiTheoCong({ client, loaiTheoId: LOAI, ghiDe, hoSo, tuNgay: '2026-01-01' })
const gon = (r) => ({ doi: r.doi.map(d => d.code + ' ' + d.periodKind + ' ' + d.tuNgay), xemTay: r.xemTay.map(x => x.code + ' ' + x.quy) })

kiem('ca CHARGEPOINT: kê tháng, TNCN Q3 chấp nhận -> đổi TNCN sang quý từ 01/07',
  gon(tim([hs('gtgt', 'T09.2026'), hs('tncn', 'Q3.2026')])), { doi: ['05/KK-TNCN quarter 2026-07-01'], xemTay: [] })
kiem('kỳ khớp sẵn (GTGT tháng, cty tháng) -> không đổi gì',
  gon(tim([hs('gtgt', 'T07.2026'), hs('gtgt', 'T08.2026')])), { doi: [], xemTay: [] })
kiem('đã đổi rồi (HSIN có ghi đè quý) -> không đổi lại',
  gon(tim([hs('tncn', 'Q3.2026')], [{ filing_type_id: 'tncn', period_kind: 'quarter', effective_from: '2026-07-01', approved_by: null }])), { doi: [], xemTay: [] })
kiem('hồ sơ bị cổng TRẢ VỀ -> không tính',
  gon(tim([hs('tncn', 'Q3.2026', { state: 'rejected' })])), { doi: [], xemTay: [] })
kiem('đang chờ cổng (received) -> có tính',
  gon(tim([hs('tncn', 'Q3.2026', { state: 'received' })])).doi.length, 1)
kiem('tờ BỔ SUNG -> không tính',
  gon(tim([hs('tncn', 'Q3.2026', { form_kind: 'Bổ sung', amend_no: 1 })])), { doi: [], xemTay: [] })
kiem('cùng quý có cả T07 lẫn Q3 -> KHÔNG tự đổi, báo xem tay',
  gon(tim([hs('tncn', 'T07.2026'), hs('tncn', 'Q3.2026')])), { doi: [], xemTay: ['05/KK-TNCN Q3.2026'] })
kiem('người đã đặt tay kỳ tháng mà cổng ra quý -> không cãi, báo xem tay',
  gon(tim([hs('tncn', 'Q3.2026')], [{ filing_type_id: 'tncn', period_kind: 'month', effective_from: '2026-04-01', approved_by: 'nv1' }])),
  { doi: [], xemTay: ['05/KK-TNCN Q3.2026'] })
kiem('cty kê quý nộp GTGT tháng 10 -> đổi sang tháng từ 01/10',
  gon(tim([hs('gtgt', 'Q3.2026'), hs('gtgt', 'T10.2026')], [], quy)), { doi: ['01/GTGT month 2026-10-01'], xemTay: [] })
kiem('quý 2 khai quý rồi quý 4 quay lại tháng -> hai lần đổi, đúng thứ tự',
  gon(tim([hs('tncn', 'Q2.2026'), hs('tncn', 'Q3.2026'), hs('tncn', 'T10.2026')])),
  { doi: ['05/KK-TNCN quarter 2026-04-01', '05/KK-TNCN month 2026-10-01'], xemTay: [] })
kiem('hồ sơ năm cũ (trước phạm vi lịch) -> bỏ qua',
  gon(tim([hs('tncn', 'Q3.2025')])), { doi: [], xemTay: [] })
kiem('kỳ phát sinh / năm -> bỏ qua',
  gon(tim([hs('tncn', 'PS.2026-10-15'), hs('tncn', '2026')])), { doi: [], xemTay: [] })
kiem('ngaySauKy T09 / Q3 / Q4 / T12', [ngaySauKy('T09.2026'), ngaySauKy('Q3.2026'), ngaySauKy('Q4.2026'), ngaySauKy('T12.2026')],
  ['2026-10-01', '2026-10-01', '2027-01-01', '2027-01-01'])
// Ca thật VƯU ĐỨC PHÁT: đồng bộ 01/10 (trước bản sửa "quý 9") -> mã kỳ hỏng, KHÔNG được tin.
kiem('hồ sơ đồng bộ TRƯỚC mốc sửa lỗi quý 9 -> bỏ qua (dù trông hợp lệ: T06 đọc thành Q2, nộp 20/07)',
  gon(tim([hs('tncn', 'Q2.2026', { submitted_at: '2026-07-20T09:00:00+07:00', synced_at: '2026-10-01T08:03:00Z' })])), { doi: [], xemTay: [] })
kiem('nộp TRƯỚC khi hết kỳ (Q3.2026 nộp 20/04 = T03 đọc nhầm) -> bỏ qua',
  gon(tim([hs('tncn', 'Q3.2026', { submitted_at: '2026-04-20T09:00:00+07:00' })])), { doi: [], xemTay: [] })
kiem('thiếu ngày nộp -> bỏ qua', gon(tim([hs('tncn', 'Q3.2026', { submitted_at: null })])), { doi: [], xemTay: [] })
kiem('ca CHARGEPOINT thật: nộp 16/10, đồng bộ 19/10 11:38 -> đổi',
  gon(tim([hs('tncn', 'Q3.2026', { submitted_at: '2026-10-16T08:00:00+00:00', synced_at: '2026-10-19T04:38:39Z' })])).doi.length, 1)
// Lịch sinh ra sau khi đổi phải ĐÚNG như mong đợi: ghép kết quả đổi vào luật sinh lịch.
const doiCP = tim([hs('tncn', 'Q3.2026')]).doi.map(d => ({ period_kind: d.periodKind, effective_from: d.tuNgay }))
kiem('lịch TNCN sau khi tự đổi = T01..T06 + Q3 + Q4', ma(nghiaVuDinhKy({ client: thang, loai: TNCN, nam: 2026, ghiDe: doiCP })),
  ['T01.2026','T02.2026','T03.2026','T04.2026','T05.2026','T06.2026','Q3.2026','Q4.2026'])

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
