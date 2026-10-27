// Kiểm bộ đọc tờ khai XML + bảng kê Excel — Phân hệ Soát xét báo cáo + Rủi ro thuế (lib/phanTich/doc).
//   node scripts/test-phantich-doc.mjs
//
// Dữ liệu: 39 tờ khai XML mẫu GIẢ LẬP trong scripts/du-lieu-mau-phantich/ruiro-mau (công ty mẫu MST 0109999982),
// và bảng kê dựng trong bộ nhớ theo đúng tiêu đề cột của 3 mẫu thật (kế hoạch mục 9.3). Không dùng dữ liệu khách.
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { docToKhai, banSauCung, kyToKhai } from '../lib/phanTich/doc/toKhai.js'
import { docBangKe, docSheetBangKe, soO, ngayO, khoaHoaDon, kyHieuDayDu } from '../lib/phanTich/doc/bangKe.js'
import { docExcel } from '../lib/phanTich/doc/excel.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}
const THU_MUC_MAU = path.resolve('scripts/du-lieu-mau-phantich/ruiro-mau')
const MOC = JSON.parse(fs.readFileSync(path.resolve('scripts/du-lieu-mau-phantich/moc-ruiro-3.2.0.json'), 'utf8'))

// ── Tờ khai ─────────────────────────────────────────────────────────────────
console.log('Tờ khai XML (39 file mẫu):')
const tatCa = fs.readdirSync(THU_MUC_MAU).filter(f => f.endsWith('.xml')).map(f => ({ f, tk: docToKhai(fs.readFileSync(path.join(THU_MUC_MAU, f), 'utf8')) }))
kiem('đọc được hết 39 file XML', tatCa.length, 39)
const q3 = tatCa.find(x => x.f === '0109999982_01GTGT_Q3-2023_L0.xml').tk
kiem('01/GTGT quý 3/2023 chính thức', [q3.loai, q3.maKy, q3.chinhThuc, q3.lanBoSung], ['01/GTGT', 'Q3.2023', true, 0])
kiem('chỉ tiêu để trống → null, không phải 0', q3.chiTieu['09'], null)
kiem('[34] là số', typeof q3.chiTieu['34'], 'number')
const bs2 = tatCa.find(x => x.f === '0109999982_01GTGT_M06-2025_L2.xml').tk
kiem('T06/2025 bổ sung lần 2', [bs2.maKy, bs2.chinhThuc, bs2.lanBoSung], ['T06.2025', false, 2])
const tenSai = tatCa.find(x => x.f === '0109999982_T9_TK_01_bs_lan_1.xml').tk
kiem('tên file ghi "bs_lan_1" nhưng nội dung là chính thức → tin nội dung', [tenSai.maKy, tenSai.chinhThuc, tenSai.lanBoSung], ['T09.2025', true, 0])
const qt = tatCa.find(x => x.f === '0109999982_03TNDN_2025_L1.xml').tk
kiem('03/TNDN năm 2025 bổ sung lần 1', [qt.loai, qt.maKy, qt.lanBoSung], ['03/TNDN', 'NAM.2025', 1])
kiem('kỳ tháng / quý / năm', [kyToKhai('M', '06/2025'), kyToKhai('Q', '3/2023'), kyToKhai('Y', '2025'), kyToKhai('M', 'rác')],
  [{ loai: 'T', so: 6, nam: 2025 }, { loai: 'Q', so: 3, nam: 2023 }, { loai: 'N', so: 0, nam: 2025 }, null])

console.log('\nBản nộp sau cùng + cộng cả năm, so với số mốc của bản offline:')
const gtgt = banSauCung(tatCa.map(x => x.tk)).filter(t => t.loai === '01/GTGT')
kiem('T06/2025 giữ bổ sung lần 2', gtgt.find(t => t.maKy === 'T06.2025').lanBoSung, 2)
const congCt = (nam, ma) => gtgt.filter(t => t.ky.nam === nam).reduce((s, t) => s + (t.chiTieu[ma] || 0), 0)
const mocTc = (nam, id) => MOC.nam[nam].tieuChi.find(t => t.id === id).sl1
for (const nam of [2023, 2024, 2025]) {
  kiem(`${nam}: Σ[34] = SL1 R01 mốc`, congCt(nam, '34'), mocTc(nam, 'R01'))
  kiem(`${nam}: Σ[35] = SL1 R02 mốc`, congCt(nam, '35'), mocTc(nam, 'R02'))
  kiem(`${nam}: Σ[25] = SL1 R03 mốc`, congCt(nam, '25'), mocTc(nam, 'R03'))
}
kiem('2025 đủ 12 kỳ tháng', gtgt.filter(t => t.ky.nam === 2025).length, 12)
kiem('2023 đủ 4 kỳ quý', gtgt.filter(t => t.ky.nam === 2023 && t.ky.loai === 'Q').length, 4)

// ── Số, ngày ────────────────────────────────────────────────────────────────
console.log('\nĐọc số, ngày trong ô Excel:')
for (const [v, mong] of [[1234567, 1234567], ['1.234.567', 1234567], ['1,234,567', 1234567], ['(1.000)', -1000], ['-12.500', -12500],
  ['1.234.567,5', 1234567.5], ['1,234,567.5', 1234567.5], ['12,5', 12.5], ['', null], ['abc', null], [null, null]]) kiem(`số "${v}"`, soO(v), mong)
for (const [v, mong] of [['12/08/2025', '2025-08-12'], ['3/7/2024', '2024-07-03'], ['2025-08-12', '2025-08-12'], [45881, '2025-08-12'], [new Date(2025, 7, 12), '2025-08-12'], ['', null]])
  kiem(`ngày ${JSON.stringify(v)}`, ngayO(v), mong)

console.log('\nKý hiệu hóa đơn quy về một dạng:')
kiem('"1" + "C25TSS"', kyHieuDayDu('1', 'C25TSS'), '1C25TSS')
kiem('gộp "1C25TSS"', kyHieuDayDu('', '1C25TSS'), '1C25TSS')
kiem('gộp + mẫu số "1"', kyHieuDayDu('1', '1C25TSS'), '1C25TSS')
kiem('khóa giống nhau dù ghi khác', khoaHoaDon({ mst: '0311111111', mauSo: 1, kyHieu: 'C25TAA', so: '431' }) === khoaHoaDon({ mst: '0311111111', kyHieu: '1C25TAA', so: '431' }), true)

// ── Bảng kê: 3 mẫu thật, dựng trong bộ nhớ ─────────────────────────────────────
// Mẫu cổng: đủ 19 cột như file thật tải từ cổng HĐĐT (đối chiếu 127HOME 26/10/2026) — CÓ CẢ hai phía người bán / người mua.
const CONG_TIEU_DE = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng',
  'MST người mua/MST người nhận hàng', 'Tên người mua/Tên người nhận hàng', 'Địa chỉ người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Tổng tiền chiết khấu thương mại',
  'Tổng tiền phí', 'Tổng tiền thanh toán', 'Đơn vị tiền tệ', 'Tỷ giá', 'Trạng thái hóa đơn', 'Kết quả kiểm tra hóa đơn']
const CTY = ['0300000001', 'CÔNG TY TNHH MẪU SOÁT XÉT']
const dongCong = (stt, kh, so, ngay, ban, mua, tien, thue, tt) => [stt, 1, kh, so, ngay, ban[0], ban[1], mua[0], mua[1], 'Địa chỉ', tien, thue, 0, 0, tien + thue, 'VND', 1, tt, 'Đã cấp mã hóa đơn']
const cong = [['DANH SÁCH HÓA ĐƠN'], ['Từ ngày 01/07/2025 đến ngày 31/07/2025'], [], [], [], CONG_TIEU_DE,
  dongCong(1, 'C25TAA', 431, '12/07/2025', ['0311111111', 'CÔNG TY TNHH VẬT TƯ THÀNH ĐẠT'], CTY, 120000000, 12000000, 'Hóa đơn bị thay thế'),
  dongCong(2, 'C25TAA', 452, '14/07/2025', ['0311111111', 'CÔNG TY TNHH VẬT TƯ THÀNH ĐẠT'], CTY, 48000000, 4800000, 'Hóa đơn mới'),
  dongCong(3, 'C25TCC', 97, '09/08/2025', ['0333333333', 'CÔNG TY TNHH VẬN TẢI NAM PHONG'], [300000001, CTY[1]], 12000000, 960000, 'Hóa đơn mới')]
const congBan = [['DANH SÁCH HÓA ĐƠN'], [], [], [], [], CONG_TIEU_DE,
  dongCong(1, 'C25TYY', 1, '02/01/2026', CTY, ['0322222222', 'CÔNG TY KHÁCH A'], 10000000, 1000000, 'Hóa đơn mới'),
  dongCong(2, 'C25TYY', 2, '03/01/2026', CTY, ['', 'Khách lẻ không lấy hóa đơn'], 500000, 50000, 'Hóa đơn mới')]
console.log('\nMẫu cổng HĐĐT ("DANH SÁCH HÓA ĐƠN", có cả MST người bán + người mua):')
const bkCong = docSheetBangKe({ ten: 'sheet 1', hang: cong }, { mstCty: CTY[0] })
kiem('nhận mẫu cổng, tiêu đề dòng 6', [bkCong.mau, bkCong.dongTieuDe], ['cong', 6])
kiem('chiều theo MST công ty (công ty là người mua → mua vào), kể cả ô MST mất số 0 đầu', bkCong.chieu, 'mua_vao')
kiem('3 hóa đơn', bkCong.hoaDon.length, 3)
kiem('hóa đơn 1 đọc đủ, MST/tên = phía người bán (đối tác)', (({ kyHieu, so, ngay, mst, ten, tienChuaThue, thue, tongTt, trangThai }) => [kyHieu, so, ngay, mst, ten, tienChuaThue, thue, tongTt, trangThai])(bkCong.hoaDon[0]),
  ['C25TAA', '431', '2025-07-12', '0311111111', 'CÔNG TY TNHH VẬT TƯ THÀNH ĐẠT', 120000000, 12000000, 132000000, 'Hóa đơn bị thay thế'])
kiem('tháng phủ tính từ ngày lập, không tin dòng "Từ ngày … đến ngày …"', bkCong.thang, ['2025-07', '2025-08'])
const bkBan = docSheetBangKe({ ten: 'sheet 1', hang: congBan }, { chieu: 'mua_vao', mstCty: CTY[0] })
kiem('công ty là người bán → bán ra, dù tên file gợi ý "mua vào"', [bkBan.chieu, bkBan.hoaDon[0].mst, bkBan.hoaDon[1].mst], ['ban_ra', '0322222222', ''])
kiem('MST công ty không có trong file → cảnh báo bảng kê công ty khác', docSheetBangKe({ ten: 's', hang: cong }, { mstCty: '0399999999' }).canhBao.some(c => c.includes('công ty khác')), true)
kiem('không có MST công ty, có gợi ý tên file → theo gợi ý', docSheetBangKe({ ten: 's', hang: cong }, { chieu: 'mua_vao' }).chieu, 'mua_vao')
kiem('không có gì → chiều null + cảnh báo', (b => [b.chieu, b.canhBao.length])(docSheetBangKe({ ten: 'sheet 1', hang: cong })), [null, 1])

console.log('\nMẫu phần mềm kiểu 1 ("To khai thue GTGT khau tru 01GTGT.xlsx", tiêu đề 2 tầng, dòng nhóm thuế suất):')
const pm1Mua = [['CÔNG TY TNHH MẪU'], ['Mã số thuế: 0300000001'], ['BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ CỦA HÀNG HOÁ, DỊCH VỤ MUA VÀO'],
  ['STT', 'Hóa đơn, chứng từ, biên lai nộp thuế', null, null, null, 'Tên người bán', 'Mã số thuế         người bán', 'Giá trị HHDV         mua vào chưa có thuế', 'Thuế GTGT', 'Thuế GTGT         được khấu trừ', 'Ghi chú', 'Diễn giải', 'Hàng hóa, dịch vụ nhập khẩu'],
  [null, 'Mẫu số', 'Ký hiệu', 'Số         hóa đơn', 'Ngày, tháng,         năm lập hóa đơn'],
  ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)'],
  ['1. Hàng hóa, dịch vụ dùng riêng cho SXKD chịu thuế GTGT và sử dụng cho các hoạt động cung cấp hàng hóa, dịch vụ không kê khai, nộp thuế GTGT đủ điều kiện khấu trừ thuế'],
  [1, '1', 'C25TAA', '0000452', '14/07/2025', 'CÔNG TY TNHH VẬT TƯ THÀNH ĐẠT', '0311111111', 48000000, 4800000, 4800000],
  [2, '1', 'C25TCC', '0000097', '09/08/2025', 'CÔNG TY TNHH VẬN TẢI NAM PHONG', '0333333333', 12000000, 1200000, 1200000],
  ['Tổng', null, null, null, null, null, null, 60000000, 6000000, 6000000]]
const pm1Ban = [['BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HHDV BÁN RA'],
  ['STT', 'Hóa đơn, chứng từ bán ra', null, null, null, 'Tên người mua', 'Mã số thuế         người mua', 'Doanh thu         chưa có thuế GTGT', 'Thuế GTGT', 'HĐ giảm thuế GTGT', 'Thuế GTGT được giảm', 'Ghi chú', 'Diễn giải'],
  [null, 'Mẫu số', 'Ký hiệu', 'Số         hóa đơn', 'Ngày, tháng, năm         lập hóa đơn'],
  ['1. Hàng hóa, dịch vụ không chịu thuế giá trị gia tăng (GTGT):'],
  [1, '1', 'C25TBR', '15', '02/07/2025', 'CÔNG TY A', '0100000001', 5000000, 0],
  ['3. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 5%:'],
  [2, '1', 'C25TBR', '16', '03/07/2025', 'CÔNG TY B', '0100000002', 10000000, 500000],
  ['4. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 10%:'],
  [3, '1', 'C25TBR', '17', '04/07/2025', 'CÔNG TY C', '0100000003', 20000000, 2000000]]
const pm1 = docBangKe([{ ten: 'TỜ KHAI THUẾ GTGT', hang: [['TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG'], ['STT', 'Chỉ tiêu', 'Giá trị HHDV', 'Thuế GTGT']] },
  { ten: 'BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HHDV BÁN RA', hang: pm1Ban }, { ten: 'BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ CỦA HHDV MUA VÀO', hang: pm1Mua }])
kiem('2 sheet bảng kê (bỏ sheet tờ khai)', pm1.map(b => [b.mau, b.chieu, b.hoaDon.length]), [['pm_tokhai', 'ban_ra', 3], ['pm_tokhai', 'mua_vao', 2]])
kiem('mua vào: bỏ dòng "(1)…(9)", dòng nhóm, dòng Tổng; số HĐ bỏ số 0 đầu', pm1[1].hoaDon.map(h => [h.so, h.thue, h.thueKhauTru]), [['452', 4800000, 4800000], ['97', 1200000, 1200000]])
kiem('bán ra: thuế suất theo dòng nhóm', pm1[0].hoaDon.map(h => [h.so, h.khongChiuThue, h.thueSuat]), [['15', true, null], ['16', false, 0.05], ['17', false, 0.1]])
kiem('khóa ghép trùng với mẫu cổng', khoaHoaDon(pm1[1].hoaDon[0]) === khoaHoaDon(bkCong.hoaDon[1]), true)

console.log('\nMẫu phần mềm kiểu 2 ("BANG KE HOA DON CHU" / "mau_quan_tri", không có cột ký hiệu):')
const pm2 = [['CÔNG TY TNHH MẪU'], [], ['BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG HÓA, DỊCH VỤ MUA VÀO'], [], [],
  ['Số hóa đơn', 'Ngày hóa đơn', 'Tên người bán', 'Mã số thuế người bán', 'Mặt hàng', 'Giá trị HHDV mua vào chưa có thuế', 'Thuế suất', 'Thuế GTGT', 'Tài khoản thuế', 'Tờ khai', 'Kỳ kê khai'],
  ['Nhóm HHDV mua vào: 1. Hàng hoá, dịch vụ dùng riêng cho SXKD chịu thuế GTGT'],
  [452, new Date(2025, 6, 14), 'CÔNG TY TNHH VẬT TƯ THÀNH ĐẠT', '0311111111', 'Thép tấm', 48000000, '10%', 4800000, '1331', '01/GTGT', 'Q3/2025'],
  [35, '03/07/2024', 'CÔNG TY TNHH NÔNG SẢN AN MIÊN', '0399999999', 'Chè', 31000000, '8 %', 2480000, '1331', '01/GTGT', 'Q3/2025']]
const bk2 = docBangKe([{ ten: 'BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG', hang: pm2 }])[0]
kiem('nhận mẫu quản trị, chiều mua vào theo tên cột', [bk2.mau, bk2.chieu, bk2.hoaDon.length], ['pm_quantri', 'mua_vao', 2])
kiem('thuế suất "10%" / "8 %" → 0.1 / 0.08', bk2.hoaDon.map(h => h.thueSuat), [0.1, 0.08])
kiem('có cảnh báo thiếu ký hiệu', bk2.canhBao.some(c => c.includes('ký hiệu')), true)
kiem('khóa dự phòng MST + số + ngày', khoaHoaDon(bk2.hoaDon[0]), '0311111111|#|452|2025-07-14')
const pm2Ban = [[], [], [], [], [], ['Số hóa đơn', 'Ngày hóa đơn', 'Tên người mua', 'Mã số thuế người mua', 'Mặt hàng', 'Doanh số bán chưa có thuế GTGT', 'Thuế GTGT', 'Tài khoản thuế', 'Tờ khai', 'Kỳ kê khai'],
  [731, '29/09/2026', 'CÔNG TY TNHH NỘI THẤT HẢI MINH', '0377712345', 'Bàn', 50000000, 5000000, '33311', '01/GTGT', 'Q3/2026']]
kiem('mẫu quản trị bán ra', (b => [b.mau, b.chieu, b.hoaDon[0].tienChuaThue])(docBangKe([{ ten: 'Sheet1', hang: pm2Ban }])[0]), ['pm_quantri', 'ban_ra', 50000000])

console.log('\nĐi trọn đường: ghi .xlsx bằng SheetJS rồi đọc lại qua docExcel:')
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cong), 'sheet 1')
const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
const sheets = docExcel(buf)
const vong = docBangKe(sheets, { chieu: 'ban_ra' })[0]
kiem('đọc lại từ file .xlsx ra đúng 3 hóa đơn, cùng tổng thuế', [vong.mau, vong.hoaDon.length, vong.hoaDon.reduce((s, h) => s + h.thue, 0)], ['cong', 3, 17760000])

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
