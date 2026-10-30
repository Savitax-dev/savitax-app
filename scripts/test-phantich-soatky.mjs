// Kiểm bộ máy Soát kỳ (lib/phanTich/soatKy.js) — GĐ 3a lát 1, phần thuế GTGT.
//   node scripts/test-phantich-soatky.mjs
//
// Dữ liệu GIẢ dựng trong bộ nhớ. Cài sẵn đúng các ca của kế hoạch (mục 3c) + các ca gặp trên dữ liệu thật 26/10/2026:
// hồ sơ tick nhầm kỳ, năm lẫn tháng/quý, doanh thu năm trước > 50 tỷ, bản chưa nộp, chuỗi [22]/[43] đứt (cả chỗ nối năm),
// tờ khai cộng sai, bảng kê phần mềm ghi từng dòng hàng, cùng hóa đơn ở 2 file cổng, hóa đơn bị thay thế kê số 0.
import { soatKy, daiKy, kyKhaiNam, doanhThuNam, gopHoaDon, laBanChuaNop, bangKeKy, gopBangKeKy } from '../lib/phanTich/soatKy.js'
import { ngayO } from '../lib/phanTich/doc/bangKe.js'
import { vaiTroBangKe } from '../lib/phanTich/docHoSo.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

const DD = (ma, chuaNop = false) => ['CTY', '2. HỒ SƠ KẾ TOÁN', '2026', '7. BỘ BÁO CÁO', 'BỘ BÁO CÁO THUẾ QUÝ_THÁNG', `BAOCAOTHUE_${ma}_2026`, chuaNop ? 'BẢNG KÊ' : 'TỜ KHAI THUẾ']
// Tờ khai tự khớp đúng công thức từ vài số gốc
function tk(nam, loai, so, { c22 = 0, c23 = 0, c24 = 0, c25, c32 = 0, c33 = 0, lan = 0, chuaNop = false, sua = {} } = {}) {
  const c = { 21: 0, 22: c22, 23: c23, 24: c24, 25: c25 ?? c24, 26: 0, 29: 0, 30: 0, 31: 0, 32: c32, '32a': 0, 33: c33, 37: 0, 38: 0, '39a': 0, '40b': 0, 42: 0 }
  c[27] = c[29] + c[30] + c[32] + c['32a']; c[28] = c[31] + c[33]; c[34] = c[26] + c[27]; c[35] = c[28]; c[36] = c[35] - c[25]
  const X = c[36] - c[22] + c[37] - c[38] - c['39a']
  c['40a'] = X > 0 ? X : 0; c[41] = X < 0 ? -X : 0; c[40] = c['40a'] - c['40b']; c[43] = c[41] - c[42]
  Object.assign(c, sua)
  const ma = loai === 'Q' ? 'Q' + so : 'T' + String(so).padStart(2, '0')
  return { loai: '01/GTGT', ky: { loai, so, nam }, maKy: `${ma}.${nam}`, lanBoSung: lan, chinhThuc: !lan, ngayLap: `${nam}-12-01`, chiTieu: c, nguon: 'xml', tep: { ten: `TK_${ma}.xml`, duongDan: DD(ma, chuaNop) } }
}

console.log('Kỳ khai:')
const nam25 = [1, 2, 3, 4].map(q => tk(2025, 'Q', q, { c32: 15e9, c33: 1.5e9 }))   // Σ[34] 2025 = 60 tỷ
kiem('doanh thu năm trước = Σ[34] các kỳ', doanhThuNam(nam25, 2025).tong, 60e9)
const q1 = tk(2026, 'Q', 1, { c22: nam25[3].chiTieu[43], c23: 100e6, c24: 10e6, c32: 200e6, c33: 20e6 })
const q2 = tk(2026, 'Q', 2, { c22: q1.chiTieu[43] + 5e6, c23: 50e6, c24: 5e6, c32: 100e6, c33: 10e6, sua: { 36: 999 } })   // [22] đứt + [36] sai
const nam26 = [q1, q2]
kiem('năm 2026 khai quý', kyKhaiNam(nam26, 2026), { loai: 'Q', lan: false })
kiem('năm lẫn tháng và quý → lan', kyKhaiNam([...nam26, tk(2026, 'T', 5)], 2026), { loai: 'Q', lan: true })
const dong = (r, chua) => r.dong.find(d => d.ten.includes(chua))
const r1 = soatKy({ nam: 2026, ma: 'Q1', toKhai: nam26, toKhaiTruoc: nam25, cty: { kyKhai: 'thang' }, homNay: '2026-10-26' })
kiem('hồ sơ ghi THÁNG, tờ khai QUÝ → Có chênh lệch (tick nhầm), vẫn soát theo quý', [dong(r1, 'Loại báo cáo').kq, r1.loaiKy], ['chenh', 'Q'])
kiem('doanh thu 2025 = 60 tỷ mà 2026 vẫn khai quý → Có chênh lệch', dong(r1, 'Ngưỡng 50 tỷ').kq, 'chenh')
const r1b = soatKy({ nam: 2026, ma: 'Q1', toKhai: nam26, toKhaiTruoc: [], cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
kiem('thiếu tờ khai năm trước → Thiếu hồ sơ kèm tên file', [dong(r1b, 'Ngưỡng 50 tỷ').kq, dong(r1b, 'Ngưỡng 50 tỷ').thieuFile.includes('năm 2025')], ['thieu', true])
kiem('chuỗi Q1/2026 nối Q4/2025 → khớp', dong(r1, 'Chuỗi khấu trừ').kq, 'khop')
kiem('kỳ đầu năm thiếu năm trước → Thiếu hồ sơ (Q4/2025)', [dong(r1b, 'Chuỗi khấu trừ').kq, dong(r1b, 'Chuỗi khấu trừ').thieuFile], ['thieu', 'Tờ khai 01/GTGT Q4/2025 (đã nộp)'])

console.log('\nChuỗi khấu trừ + tờ khai tự khớp:')
const r2 = soatKy({ nam: 2026, ma: 'Q2', toKhai: nam26, toKhaiTruoc: nam25, cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
kiem('[22] Q2 ≠ [43] Q1 → lệch 5 triệu', [dong(r2, 'Chuỗi khấu trừ').kq, dong(r2, 'Chuỗi khấu trừ').chenh], ['chenh', 5000000])
kiem('[36] ghi sai → Có chênh lệch', dong(r2, '[36] = [35] − [25]').kq, 'chenh')
kiem('các công thức khác vẫn khớp', dong(r2, '[34] = [26] + [27]').kq, 'khop')
kiem('dòng có chênh lệch xếp lên trước', r2.dong.findIndex(d => d.kq !== 'chenh') >= r2.oTong.chenh, true)

console.log('\nBản chưa nộp (tờ khai trong thư mục BẢNG KÊ):')
const q3Nop = tk(2026, 'Q', 3, { c22: 0, c32: 300e6, c33: 30e6 })
const q3Chua = tk(2026, 'Q', 3, { c22: 0, c32: 310e6, c33: 31e6, chuaNop: true })
kiem('nhận bản chưa nộp theo thư mục', [laBanChuaNop(q3Chua), laBanChuaNop(q3Nop)], [true, false])
const r3 = soatKy({ nam: 2026, ma: 'Q3', toKhai: [...nam26, q3Nop, q3Chua], cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
kiem('soát bản chưa nộp (mới hơn)', [r3.banSoat, r3.toKhai.chiTieu[34]], ['chua_nop', 310e6])
kiem('so bản chưa nộp ↔ bản đã nộp', dong(r3, 'Bản chưa nộp').chenhChu.includes('[34]'), true)

console.log('\nDải kỳ:')
kiem('Q1–Q2 đã nộp, Q3 chỉ có bản chưa nộp, Q4 chưa đến', daiKy(2026, 'Q', [...nam26, q3Chua], '2026-10-26').map(k => k.tt), ['da_nop', 'da_nop', 'chua_nop', 'chua_den'])
kiem('Q3 không có tờ khai, chưa tới hạn 31/10 → chờ hạn', daiKy(2026, 'Q', nam26, '2026-10-26')[2].tt, 'cho_han')
kiem('… sau hạn → thiếu', daiKy(2026, 'Q', nam26, '2026-11-05')[2].tt, 'thieu')

console.log('\nGộp theo hóa đơn:')
const hd = (so, ngay, tien, thue, them = {}) => ({ mst: '0311111111', so: String(so), ngay, tienChuaThue: tien, thue, mauSo: '', kyHieu: '', ...them })
const g = gopHoaDon([[hd(1, '2026-04-02', 100, 10), hd(1, '2026-04-02', 50, 5), hd(2, '2026-04-03', 70, 7)]])
kiem('cùng sheet: cộng các dòng hàng của một hóa đơn', g.map(h => [h.so, h.tienChuaThue, h.thue, h.soDong]), [['1', 150, 15, 2], ['2', 70, 7, 1]])
const g2 = gopHoaDon([[hd(1, '2026-04-02', 100, 10, { mauSo: '1', kyHieu: 'C26TAA' })], [hd(1, '2026-04-02', 100, 10, { mauSo: '1', kyHieu: 'C26TAA' }), hd(3, '2026-04-05', 9, 1)]])
kiem('khác file: bỏ trùng, không cộng đôi', g2.map(h => [h.so, h.tienChuaThue]), [['1', 100], ['3', 9]])

console.log('\nĐầu ra / đầu vào: tờ khai ↔ bảng kê cổng ↔ bảng kê phần mềm, từng hóa đơn (Q2):')
const C = (so, ngay, tien, thue, tt = 'Hóa đơn mới', mst = '0322222222') => ({ mauSo: '1', kyHieu: 'C26TAA', so: String(so), ngay, mst, tienChuaThue: tien, thue, trangThai: tt })
const P = (so, ngay, tien, thue, mst = '0322222222') => ({ mauSo: '', kyHieu: '', so: String(so), ngay, mst, tienChuaThue: tien, thue })
const congBan1 = [C(10, '2026-04-02', 60e6, 6e6), C(11, '2026-05-02', 30e6, 3e6), C(12, '2026-05-10', 10e6, 1e6), C(13, '2026-06-01', 5e6, 5e5, 'Hóa đơn đã bị thay thế'),
  C(14, '2026-06-01', 7e6, 7e5, 'Hóa đơn đã bị thay thế'), C(99, '2026-07-01', 1e9, 1e8)]
const congBan2 = [C(11, '2026-05-02', 30e6, 3e6)]   // file "Tổng quan" tháng 5 trùng hóa đơn 11
const pmBan = [P(10, '2026-04-02', 40e6, 4e6), P(10, '2026-04-02', 20e6, 2e6),   // 2 dòng hàng
  P(11, '2026-05-02', 30e6, 3e6), P(13, '2026-06-01', 0, 0),                     // hóa đơn bị thay thế kê số 0: đúng
  P(14, '2026-06-01', 7e6, 7e5),                                                 // bị thay thế mà còn tiền: sai
  P(8, '2026-03-30', 2e6, 2e5)]                                                  // hóa đơn tháng 3 kê khai quý 2
const qBan = tk(2026, 'Q', 2, { c22: q1.chiTieu[43], c23: 50e6, c24: 5e6, c32: 100e6, c33: 10e6 })
const congMua = [C(500, '2026-04-10', 50e6, 5e6, 'Hóa đơn mới', '0333333333')]
const pmMua = [P(500, '2026-04-10', 50e6, 5e6, '0333333333')]
const BK = [
  { mau: 'cong', chieu: 'ban_ra', hoaDon: congBan1 }, { mau: 'cong', chieu: 'ban_ra', hoaDon: congBan2 },
  { mau: 'pm_quantri', chieu: 'ban_ra', kyThuMuc: { loai: 'Q', so: 2, nam: 2026 }, hoaDon: pmBan },
  { mau: 'cong', chieu: 'mua_vao', hoaDon: congMua }, { mau: 'pm_quantri', chieu: 'mua_vao', kyThuMuc: { loai: 'Q', so: 2, nam: 2026 }, hoaDon: pmMua },
]
const rb = soatKy({ nam: 2026, ma: 'Q2', toKhai: [q1, qBan], toKhaiTruoc: nam25, bangKe: BK, cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
const d34 = dong(rb, '[34] tờ khai ↔ giá trị chưa thuế trên bảng kê cổng bán ra')
kiem('[34] ↔ cổng: chỉ hóa đơn trong kỳ còn hiệu lực, bỏ trùng 2 file (60+30+10 = 100tr)', [d34.so2, d34.kq], [100e6, 'khop'])
kiem('[35] ↔ cổng bán ra khớp', dong(rb, '[35] tờ khai ↔ thuế GTGT trên bảng kê cổng bán ra').kq, 'khop')
const dPm = dong(rb, '[34] tờ khai ↔ giá trị chưa thuế trên bảng kê kèm tờ khai bán ra')
kiem('[34] ↔ phần mềm: cộng cả dòng hàng + hóa đơn tháng 3 + hóa đơn thay thế còn tiền → lệch', [dPm.so2, dPm.chenh], [60e6 + 30e6 + 7e6 + 2e6, 100e6 - 99e6])
const ct = loai => rb.chiTiet.filter(c => c.chieu === 'ban_ra' && c.loai === loai).map(c => c.hd.so)
kiem('có trên cổng chưa vào phần mềm: HĐ 12', ct('chi_cong'), ['12'])
kiem('hóa đơn bị thay thế: chỉ HĐ 14 (còn tiền), HĐ 13 kê số 0 là đúng', ct('het_hieu_luc'), ['14'])
kiem('hóa đơn ngày ngoài kỳ: HĐ 8 (tháng 3)', [ct('ngoai_ky'), dong(rb, 'bán ra ngày ngoài kỳ').kq], [['8'], 'thong_tin'])
kiem('HĐ 8 không có trên cổng nhưng ngày ngoài kỳ → không tính "không có trên cổng"', [ct('chi_pm'), dong(rb, 'Hóa đơn bán ra: bảng kê cổng').chenhChu.includes('không có trên cổng')], [[], false])
kiem('2 dòng hàng của HĐ 10 ghép đúng 1 hóa đơn trên cổng, không lệch', ct('lech'), [])
kiem('đầu vào khớp hết', ['[23] tờ khai ↔ giá trị chưa thuế trên bảng kê cổng mua vào', '[24] tờ khai ↔ thuế GTGT trên bảng kê cổng mua vào', 'Hóa đơn mua vào: bảng kê cổng'].map(t => dong(rb, t).kq), ['khop', 'khop', 'khop'])

console.log('\nBảng kê hóa đơn theo kỳ (màn Soát xét năm):')
{
  const bk = (chieu, so) => bangKeKy({ nam: 2026, k: { loai: 'Q', so }, loaiKy: 'Q', chieu, toKhai: [q1, qBan], bangKe: BK })
  const b2 = bk('ban_ra', 2)
  kiem('bán ra Q2: 3 nguồn trùng số Soát kỳ báo (cổng 100tr, phần mềm 99tr, tờ khai [34])', [b2.cong.tien, b2.pm.tien, b2.tk.tien], [d34.so2, dPm.so2, qBan.chiTieu['34']])
  kiem('bán ra Q2: chênh lệch trùng Soát kỳ (chưa vào PM: 12 · thay thế: 14 · ngoài kỳ: 8)', [b2.chiCong.map(h => h.so), b2.hetHieuLuc.map(x => x.hd.so), b2.ngoaiKy.map(h => h.so), b2.chiPm.length, b2.lech.length], [['12'], ['14'], ['8'], 0, 0])
  kiem('bán ra Q2: đủ 3 nguồn', [b2.coCong, b2.coPm, b2.coTk], [true, true, true])
  const m2 = bk('mua_vao', 2), m1 = bk('mua_vao', 1)
  kiem('mua vào Q2 khớp hết; Q1 không có bảng kê → không đối chiếu từng hóa đơn', [m2.khop, m2.chiCong.length, m1.coCong, m1.coPm, m1.khop], [1, 0, false, false, null])
  const nam = gopBangKeKy([m1, m2])
  // Q1 chỉ có tờ khai, không bảng kê → không cộng vào tổng cả năm (cộng thì tờ khai 2 quý so với bảng kê 1 quý, lệch giả)
  kiem('cả năm: chỉ cộng kỳ đủ bảng kê cổng + phần mềm (Q2), Q1 để riêng', [nam.tk.tien, nam.cong.tien, nam.khop, nam.coCong, nam.kyDu, nam.kyBo], [qBan.chiTieu['23'], 50e6, 1, true, ['Q2'], [{ ma: 'Q1', thieu: 'bảng kê cổng' }]])
  // Ca DOEL 2026: cổng Q1–Q2, phần mềm Q1–Q4 → tổng phần mềm chỉ Q1–Q2
  const gia = (ma, coCong, coPm, so) => ({ ky: { ma }, coCong, coPm, coTk: coCong, cong: { so: coCong ? so : 0, tien: coCong ? so * 1e6 : null, thue: coCong ? so * 1e5 : null }, pm: { so: coPm ? so : 0, tien: coPm ? so * 1e6 : null, thue: coPm ? so * 1e5 : null },
    tk: { tien: coCong ? so * 1e6 : null, thue: coCong ? so * 1e5 : null }, khop: coCong && coPm ? so : null, chiCong: [], chiPm: [], lech: [], hetHieuLuc: [], ngoaiKy: [], nguon: { cong: [], pm: [], tk: [] } })
  const doel = gopBangKeKy([gia('Q1', true, true, 10), gia('Q2', true, true, 5), gia('Q3', false, true, 12), gia('Q4', false, true, 7)])
  kiem('cổng Q1–Q2, phần mềm Q1–Q4 → hai bên cùng 15 hóa đơn, thuế không lệch giả', [doel.cong.so, doel.pm.so, doel.pm.thue - doel.cong.thue, doel.kyBo.map(b => b.ma)], [15, 15, 0, ['Q3', 'Q4']])
  const khongDu = gopBangKeKy([gia('Q3', false, true, 12), gia('Q4', false, true, 7)])
  kiem('không kỳ nào đủ hai bên → cộng hết như cũ', [khongDu.pm.so, khongDu.kyDu, khongDu.kyBo], [19, [], []])
}

console.log('\nThiếu hồ sơ / không phát sinh:')
const rt = soatKy({ nam: 2026, ma: 'Q2', toKhai: [q1, qBan], toKhaiTruoc: nam25, bangKe: [], cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
kiem('tên file cần có ghi đúng đường dẫn (không mất dấu \\)', dong(rt, 'giá trị chưa thuế trên bảng kê kèm tờ khai bán ra').thieuFile.includes('BAOCAOTHUE_Q2\\BẢNG KÊ'), true)
kiem('không có bảng kê → các dòng bảng kê "Thiếu hồ sơ", dòng tờ khai vẫn chạy', [dong(rt, 'bảng kê cổng bán ra').kq, dong(rt, '[36] = [35] − [25]').kq], ['thieu', 'khop'])
const q0 = tk(2026, 'Q', 2, { c22: q1.chiTieu[43], c23: 50e6, c24: 5e6 })   // doanh thu 0
const r0 = soatKy({ nam: 2026, ma: 'Q2', toKhai: [q1, q0], bangKe: [], cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
kiem('tờ khai [34] = [35] = 0 → không đòi bảng kê bán ra', r0.dong.filter(d => d.ten.includes('bán ra') && d.kq === 'thieu').length, 0)
const rk = soatKy({ nam: 2026, ma: 'Q3', toKhai: nam26, bangKe: [], cty: { kyKhai: 'quy' }, homNay: '2026-10-26' })
kiem('kỳ chưa có tờ khai → MỘT dòng Thiếu hồ sơ gom các phép kiểm cần tờ khai', [rk.dong.filter(d => d.kq === 'thieu' && d.ten.startsWith('Tờ khai 01/GTGT Q3')).length, dong(rk, 'Tờ khai 01/GTGT Q3').ten.includes('phép kiểm'), rk.dong.some(d => d.ten.includes('[36] = [35]'))], [1, true, false])

console.log('\nNgày trong Excel:')
kiem('số ngày Excel có phần giờ 23:59 → vẫn đúng ngày, không làm tròn sang hôm sau', [ngayO(46112), ngayO(46112.99995), ngayO(46113)], ['2026-03-31', '2026-03-31', '2026-04-01'])
kiem('Date hụt vài giây do múi giờ → ngày sau', ngayO(new Date(2026, 2, 31, 23, 59, 56)), '2026-04-01')

console.log('\nGhép hóa đơn khi thiếu MST + phụ lục giảm thuế (file thật DOEL Q2, 27/10/2026 — dựng lại bằng dữ liệu giả):')
{
  const { docBangKe } = await import('../lib/phanTich/doc/bangKe.js')
  const { doiChieuHoaDon } = await import('../lib/phanTich/soatKy.js')
  // File xuất HTKK: sheet bán ra (có cột "HĐ giảm thuế GTGT") + phụ lục giảm thuế liệt kê LẠI các hóa đơn đó, không MST
  const banRa = { ten: 'BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HHDV BÁN RA', hang: [['CÔNG TY A'], ['BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HÀNG HOÁ, DỊCH VỤ BÁN RA'],
    ['STT', 'Hóa đơn, chứng từ bán ra', '', '', '', 'Tên người mua', 'Mã số thuế người mua', 'Doanh thu chưa có thuế GTGT', 'Thuế GTGT', 'HĐ giảm thuế GTGT'],
    ['', 'Mẫu số', 'Ký hiệu', 'Số hóa đơn', 'Ngày, tháng, năm lập hóa đơn'],
    [1, '1', 'C26TDE', 36, '28/04/2026', 'KH 1', '0300000001', 1000000, 80000, 'x'], [2, '1', 'C26TDE', 37, '28/04/2026', 'KH 2', '0300000002', 2000000, 160000, 'x']] }
  const plGiam = { ten: 'BẢNG KÊ HÓA ĐƠN GIẢM THUẾ GTGT', hang: [['CÔNG TY A'], ['BẢNG KÊ HÓA ĐƠN GIẢM THUẾ GTGT THEO NGHỊ QUYẾT 204/2025/QH15'],
    ['STT', 'Ký hiệu', 'Số hóa đơn', 'Ngày hóa đơn', 'Tên hàng', 'Doanh thu chưa thuế GTGT', 'Thuế suất', 'Thuế GTGT', 'Thuế GTGT được giảm'],
    [1, '1C26TDE', 36, '28/04/2026', 'Thang máy', 1000000, '8%', 80000, 20000], [2, '1C26TDE', 37, '28/04/2026', 'Thang máy', 2000000, '8%', 160000, 40000]] }
  const doc = docBangKe([banRa, plGiam])
  kiem('phụ lục giảm thuế bị bỏ, sheet bán ra (có cột "HĐ giảm thuế") giữ', doc.map(b => [b.chieu, b.hoaDon.length]), [['ban_ra', 2]])
  // Bảng kê cổng chỉ có MỘT cột MST (phía đối tác) → không cảnh báo "bảng kê của công ty khác"
  const cong1Cot = { ten: 'sheet 1', hang: [['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người mua/MST người nhận hàng', 'Tên người mua/Tên người nhận hàng', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Tổng tiền thanh toán', 'Trạng thái hóa đơn'],
    [1, 1, 'C26TDE', 36, '28/04/2026', '0300000001', 'KH 1', 1000000, 80000, 1080000, 'Hóa đơn mới']] }
  kiem('cổng một cột MST → không cảnh báo nhầm', docBangKe([cong1Cot], { chieu: 'ban_ra', mstCty: '0399999999' })[0].canhBao, [])
  // HONGDUC 29/10: một file cổng 2 sheet "MV" / "BR", cả hai đều ghi cột "MST người mua", tên file "BẢNG KÊ MV-BR" chứa cả hai chiều
  const sheetCong = ten => ({ ...cong1Cot, ten })
  kiem('file cổng 2 sheet MV / BR → nhận chiều theo tên sheet, không cảnh báo "chưa xác định"',
    docBangKe([sheetCong('MV'), sheetCong('BR'), sheetCong('Mua vào'), sheetCong('HĐ bán ra')], { mstCty: '0399999999' }).map(b => [b.chieu, b.canhBao.length]),
    [['mua_vao', 0], ['ban_ra', 0], ['mua_vao', 0], ['ban_ra', 0]])
  // Anh chốt 30/10: vai trò bảng kê theo NGUỒN. Mục 2 (thư mục hóa đơn) = bảng kê cổng; mục 7 (bộ báo cáo) = bảng kê kèm tờ khai,
  // kể cả file "BẢNG KÊ MV-BR" cùng bố cục cổng → đổi thành 'pm_kem_tk', bỏ hóa đơn hủy / thay thế.
  const hdC = (so, ngay, trangThai = 'Hóa đơn mới') => ({ mauSo: '1', kyHieu: 'C26TAA', so: String(so), ngay, mst: '0311111111', tienChuaThue: 1000, thue: 100, trangThai })
  const mvbr = { mau: 'cong', chieu: 'mua_vao', sheet: 'MV', hoaDon: [hdC(1, '2026-05-10'), hdC(9, '2026-05-11', 'Hóa đơn đã bị hủy')] }
  kiem('vai trò: bố cục cổng ở mục 7 → pm_kem_tk (tóm tắt giữ nguyên hóa đơn, bản đầy đủ bỏ HĐ hủy); ở mục 2 giữ cong; mẫu phần mềm không đổi',
    [vaiTroBangKe(mvbr, true).mau, vaiTroBangKe(mvbr, true).hoaDon.length, vaiTroBangKe(mvbr, true, { dayDu: true }).hoaDon.map(h => h.so), vaiTroBangKe(mvbr, false).mau, vaiTroBangKe({ mau: 'pm_quantri' }, true).mau],
    ['pm_kem_tk', 2, ['1'], 'cong', 'pm_quantri'])
  const tkQ2 = tk(2026, 'Q', 2, { c23: 2000, c24: 200, c32: 2000, c33: 200 })
  const muc2 = { mau: 'cong', chieu: 'mua_vao', kyThuMuc: null, hoaDon: [hdC(1, '2026-05-10'), hdC(2, '2026-06-02')] }
  const muc2Ban = { mau: 'cong', chieu: 'ban_ra', kyThuMuc: null, hoaDon: [hdC(5, '2026-05-10'), hdC(6, '2026-06-02')] }
  const muc7 = chieu => vaiTroBangKe({ mau: 'cong', chieu, hoaDon: [hdC(chieu === 'mua_vao' ? 1 : 5, '2026-05-10')] }, true, { dayDu: true })
  const rC = soatKy({ nam: 2026, ma: 'Q2', toKhai: [tkQ2], bangKe: [muc2, muc2Ban, { ...muc7('mua_vao'), kyThuMuc: { loai: 'Q', so: 2, nam: 2026 } }, { ...muc7('ban_ra'), kyThuMuc: { loai: 'Q', so: 2, nam: 2026 } }], cty: { kyKhai: 'quy' } })
  const dHd = rC.dong.find(d => d.ten.startsWith('Hóa đơn mua vào: bảng kê cổng (2. HÓA ĐƠN) ↔ bảng kê kèm tờ khai'))
  kiem('mục 2 có 2 HĐ, MV-BR mục 7 có 1 → đối chiếu từng hóa đơn, báo 1 HĐ chưa có trong bảng kê kèm tờ khai', [dHd.kq, dHd.so1, dHd.so2, rC.chiTiet.filter(x => x.loai === 'chi_cong' && x.chieu === 'mua_vao').map(x => x.hd.so)], ['chenh', 2, 1, ['2']])
  kiem('[23] tờ khai ↔ bảng kê kèm tờ khai: so được (không còn "Để biết" / "Thiếu")', rC.dong.find(d => d.ten === '[23] tờ khai ↔ giá trị chưa thuế trên bảng kê kèm tờ khai mua vào').kq, 'chenh')
  const rC2 = soatKy({ nam: 2026, ma: 'Q2', toKhai: [tkQ2], bangKe: [{ ...muc7('mua_vao'), kyThuMuc: { loai: 'Q', so: 2, nam: 2026 } }], cty: { kyKhai: 'quy' } })
  kiem('chỉ có MV-BR ở mục 7, mục 2 trống → dòng bảng kê cổng "Thiếu hồ sơ" chỉ đúng chỗ 2. HÓA ĐƠN',
    rC2.dong.filter(d => d.ten.startsWith('[23] tờ khai ↔') && d.ten.includes('bảng kê cổng')).map(d => [d.kq, d.thieuFile.includes('2. HÓA ĐƠN MUA VÀO_BÁN RA')]), [['thieu', true]])

  const hd = (kh, so, ngay, mst, tien = 100) => ({ mauSo: '1', kyHieu: kh, so: String(so), ngay, mst, tienChuaThue: tien, thue: tien / 10, trangThai: 'Hóa đơn mới' })
  const Q2 = { loai: 'Q', so: 2 }
  // Mua vào: cổng KHÔNG có MST người bán, phần mềm có → ghép theo ký hiệu + số + ngày
  const congMua = [hd('C26TAA', 167, '2026-04-20', ''), hd('C26TSS', 1237, '2026-04-17', ''), hd('C26TPM', 47, '2026-05-22', '')]
  const pmMua = [hd('C26TAA', 167, '2026-04-20', '0300000005'), hd('C26TSS', 1237, '2026-04-17', '0300000006')]
  const rMua = doiChieuHoaDon(congMua, pmMua, 2026, Q2, 'mua_vao')
  kiem('mua vào: cổng thiếu MST vẫn ghép 2/2, còn đúng 1 HĐ chưa vào phần mềm', [rMua.chiPm.length, rMua.chiCong.map(h => h.so)], [0, ['47']])
  kiem('mua vào: cùng ký hiệu + số nhưng KHÁC ngày → không ghép', doiChieuHoaDon([hd('C26TAA', 167, '2026-04-21', '')], [hd('C26TAA', 167, '2026-04-20', '0300000005')], 2026, Q2, 'mua_vao').chiPm.length, 1)
  // Bán ra: phần mềm không ghi MST người mua → ký hiệu + số là đủ
  const rBan = doiChieuHoaDon([hd('C26TDE', 53, '2026-05-30', '0300000009')], [hd('C26TDE', 53, '2026-05-30', '')], 2026, Q2, 'ban_ra')
  kiem('bán ra: phần mềm thiếu MST người mua vẫn ghép', [rBan.chiPm.length, rBan.chiCong.length], [0, 0])
  // Hai bên đều có MST mà KHÁC nhau → hóa đơn khác, không ghép bừa
  const rKhac = doiChieuHoaDon([hd('C26TAA', 5, '2026-04-02', '0311111111')], [hd('C26TAA', 5, '2026-04-02', '0322222222')], 2026, Q2, 'mua_vao')
  kiem('hai bên đều có MST khác nhau → không ghép', [rKhac.chiPm.length, rKhac.chiCong.length], [1, 1])
  // Cổng có 2 hóa đơn cùng ký hiệu + số + ngày (2 người bán, file không MST) → không đoán
  const rTrung = doiChieuHoaDon([hd('C26TAA', 9, '2026-04-02', ''), hd('C26TAA', 9, '2026-04-02', '', 200)], [hd('C26TAA', 9, '2026-04-02', '0311111111')], 2026, Q2, 'mua_vao')
  kiem('khoá không-MST trùng trên cổng → không đoán', rTrung.chiPm.length, 1)
  kiem('gộp trong sheet: thiếu MST, cùng ký hiệu + số nhưng khác ngày → 2 hóa đơn', gopHoaDon([[hd('C26TAA', 9, '2026-04-02', ''), hd('C26TAA', 9, '2026-05-02', '')]]).length, 2)
  // Rà soát 27/10: khoá phụ MST + số + ngày từng nuốt hóa đơn khác ký hiệu
  kiem('thiếu MST: 2 người bán khác ký hiệu, trùng số + ngày → vẫn 2 hóa đơn', gopHoaDon([[hd('C26TAA', 5, '2026-04-02', ''), hd('C26TBB', 5, '2026-04-02', '', 300)]]).length, 2)
  kiem('cùng người bán, 2 ký hiệu, trùng số + ngày → 2 hóa đơn', gopHoaDon([[hd('C26TAA', 5, '2026-04-02', '0311111111'), hd('C26TBB', 5, '2026-04-02', '0311111111')]]).length, 2)
  const khongKh = { ...hd('', 5, '2026-04-02', '0311111111'), kyHieu: '', mauSo: '' }
  kiem('sheet sau không có ký hiệu, cùng MST + số + ngày → vẫn bỏ trùng như cũ', gopHoaDon([[hd('C26TAA', 5, '2026-04-02', '0311111111')], [khongKh]]).length, 1)
}

console.log('\nTờ khai trong file phần mềm ↔ tờ khai XML (sheet "TỜ KHAI THUẾ GTGT" của file xuất HTKK, dựng theo bố cục DOEL Q2):')
{
  const { docBangKe, docSheetToKhaiPm } = await import('../lib/phanTich/doc/bangKe.js')
  // Mã ở cột D/G, số ở cột F/H — đúng bố cục file thật
  const dong = (ma1, so1, ma2, so2) => ['', '', '', ma1 ? `[${ma1}]` : '', '', so1 ?? '', ma2 ? `[${ma2}]` : '', so2 ?? '']
  const sheetTk = (sua = {}) => {
    const g = { 22: 5000, 23: 90000000, 24: 7200000, 25: 7200000, 26: 0, 27: 120000000, 28: 9600000, 29: 0, 30: 0, 31: 0, 32: 120000000, 33: 9600000, 34: 120000000, 35: 9600000, 36: 2400000, 40: 2395000, 41: 0, 43: 0, ...sua }
    return { ten: 'TỜ KHAI THUẾ GTGT', hang: [['CÔNG TY A'], ['Mã số thuế: 0300000001'], ['TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG'], [], ['STT', 'Chỉ tiêu'],
      dong('21'), dong(null, null, '22', g[22]), dong('23', g[23], '24', g[24]), dong(null, null, '25', g[25]), dong('26', g[26]), dong('27', g[27], '28', g[28]),
      dong('29', g[29]), dong('30', g[30], '31', g[31]), dong('32', g[32], '33', g[33]), dong('34', g[34], '35', g[35]), dong(null, null, '36', g[36]),
      dong(null, null, '40', g[40]), dong(null, null, '41', g[41]), dong(null, null, '43', g[43])] }
  }
  const pm = docSheetToKhaiPm(sheetTk())
  kiem('đọc sheet tờ khai: mã → số ở ô kế bên phải, [21] trống bỏ qua', [pm?.mau, pm?.chiTieu['24'], pm?.chiTieu['40'], '21' in (pm?.chiTieu || {})], ['tk_pm', 7200000, 2395000, false])
  // Bảng kê "Kèm theo tờ khai 01/GTGT" có cột Số hóa đơn → KHÔNG phải tờ khai
  const bkKem = { ten: 'PL 01-1', hang: [['BẢNG KÊ HÓA ĐƠN BÁN RA'], ['(Kèm theo tờ khai thuế GTGT mẫu số 01/GTGT)'], ['STT', 'Ký hiệu', 'Số hóa đơn', 'Ngày', 'Tên người mua', 'MST', 'Doanh thu chưa có thuế GTGT', 'Thuế GTGT'], [1, '1C26TAA', 1, '01/04/2026', 'A', '0300000009', 100, 10]] }
  kiem('bảng kê "kèm theo tờ khai 01/GTGT" không bị nhận là tờ khai', docSheetToKhaiPm(bkKem), null)
  // Rà soát 27/10: dòng "ban hành kèm theo Thông tư 80/2021 ngày 29 tháng 9 năm 2021" đứng trước "Kỳ tính thuế"
  const coTT = sheetTk(); coTT.hang.splice(3, 0, ['(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021)'], ['[01] Kỳ tính thuế: Tháng 05 năm 2026'])
  kiem('kỳ trong sheet đọc sau chữ "Kỳ tính thuế", không lấy ngày ban hành thông tư', docSheetToKhaiPm(coTT).ky, { loai: 'T', so: 5, nam: 2026 })
  const khongKy = sheetTk(); khongKy.hang.splice(3, 0, ['(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021)'])
  kiem('không có "Kỳ tính thuế" → kỳ để theo thư mục (null)', docSheetToKhaiPm(khongKy).ky, null)
  kiem('docBangKe trả sheet tờ khai thành mục tk_pm (không lẫn vào bảng kê pm_)', docBangKe([sheetTk(), bkKem]).map(b => b.mau), ['tk_pm', 'pm_tokhai'])

  const xml = (sua = {}) => tk(2026, 'Q', 2, { c22: 5000, c23: 90000000, c24: 7200000, c32: 120000000, c33: 9600000, sua })
  const ct = xml().chiTieu
  const pmKhop = { ...docSheetToKhaiPm(sheetTk(Object.fromEntries(Object.entries(ct).filter(([c]) => /^\d+$/.test(c))))), kyThuMuc: { loai: 'Q', so: 2, nam: 2026 } }
  const r1 = soatKy({ nam: 2026, ma: 'Q2', toKhai: [xml()], bangKe: [pmKhop], cty: { kyKhai: 'quy' } })
  kiem('file phần mềm giống XML đã nộp → một dòng Khớp', r1.dong.filter(d => /file phần mềm/.test(d.ten)).map(d => d.kq), ['khop'])
  const pmLech = { ...pmKhop, chiTieu: { ...pmKhop.chiTieu, 24: pmKhop.chiTieu[24] + 500000, 25: pmKhop.chiTieu[25] + 500000 } }
  const r2 = soatKy({ nam: 2026, ma: 'Q2', toKhai: [xml()], bangKe: [pmLech], cty: { kyKhai: 'quy' } })
  kiem('file phần mềm khác XML ở [24] [25] → mỗi chỉ tiêu một dòng Có chênh lệch, đúng số lệch', r2.dong.filter(d => /file phần mềm/.test(d.ten)).map(d => [d.ten.slice(0, 4), d.kq, d.chenh]), [['[24]', 'chenh', 500000], ['[25]', 'chenh', 500000]])
  const r3 = soatKy({ nam: 2026, ma: 'Q1', toKhai: [xml()], bangKe: [pmLech], cty: { kyKhai: 'quy' } })
  kiem('file phần mềm của Q2 không đem so ở Q1', r3.dong.filter(d => /file phần mềm/.test(d.ten)).length, 0)
}

console.log('\nHạn nộp + trạng thái nộp từ phân hệ Tờ khai (dữ liệu DOEL 27/10/2026: lịch chỉ từ Q3, hồ sơ Q1–Q2 chưa gắn lịch):')
{
  const { maKyPhu, hanTheoLich, trangThaiNop } = await import('../lib/phanTich/hanNop.js')
  kiem('kỳ quý phủ chính quý + 3 tháng', maKyPhu({ loai: 'Q', so: 2 }, 2026), ['Q2.2026', 'T04.2026', 'T05.2026', 'T06.2026'])
  kiem('kỳ tháng phủ chính tháng + quý chứa nó (TNCN khai quý)', maKyPhu({ loai: 'T', so: 9 }, 2026), ['T09.2026', 'Q3.2026'])
  const nv = [{ ma: '01/GTGT', ky: 'Q3.2026', han: '2026-11-02', trangThai: 'accepted', hoSo: [{ lanBoSung: 0, nop: '2026-10-22T03:00:00Z', tiepNhan: '2026-10-22T03:05:00Z', trangThai: 'accepted', dungHan: true }] },
    { ma: '01/GTGT', ky: 'Q2.2026', han: null, trangThai: null, hoSo: [{ lanBoSung: 0, nop: '2026-07-28T02:00:00Z', tiepNhan: null, trangThai: 'received', dungHan: null }] },
    { ma: '01/GTGT', ky: 'Q4.2026', han: '2027-02-01', trangThai: 'not_filed', hoSo: [] }]
  kiem('hạn theo lịch Tờ khai (đã đẩy qua ngày nghỉ) — kỳ ngoài lịch → null, dùng hạn app tính', [hanTheoLich(nv, { loai: 'Q', so: 3 }, 2026), hanTheoLich(nv, { loai: 'Q', so: 2 }, 2026)], ['2026-11-02', null])
  kiem('đã nộp đúng hạn → xanh', [trangThaiNop(nv[0]).nhan, trangThaiNop(nv[0]).mau], ['Đã nộp 22/10/2026 · đúng hạn', 'xanhLa'])
  kiem('hồ sơ chưa gắn lịch (Q2) vẫn ra "Đã nộp", không báo chưa nộp oan', trangThaiNop(nv[1]).nhan, 'Đã nộp 28/07/2026')
  kiem('chưa tới hạn, chưa nộp → Chưa nộp; qua hạn → Quá hạn', [trangThaiNop(nv[2], '2026-10-27').nhan, trangThaiNop(nv[2], '2027-02-02').nhan], ['Chưa nộp', 'Quá hạn — chưa thấy hồ sơ nộp'])
  kiem('nộp trễ → đỏ', trangThaiNop({ hoSo: [{ lanBoSung: 1, nop: '2026-08-05T02:00:00Z', dungHan: false, trangThai: 'accepted' }] }).mau, 'do')
}

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
