// Kiểm bộ đọc bảng lương + C12 (lib/phanTich/doc/bangLuong.js) và phép kiểm TNCN / bảo hiểm của Soát kỳ (lát 2).
//   node scripts/test-phantich-luong.mjs
//
// Bảng lương dựng lại ĐÚNG BỐ CỤC file thật (sheet "BẢNG THANH TOÁN TIỀN LƯƠNG" mỗi tháng, tiêu đề 2 tầng có 2 cột BHXH:
// doanh nghiệp chịu / khấu trừ vào lương, "Tổng cộng" nằm ở cột STT, khối chữ ký "Người lập" có số) — tên, số là GIẢ.
// C12 dựng theo dòng chữ thật của mẫu C12-TS. Đã đối chiếu trên dữ liệu thật 26/10/2026: [21] [29] [16], C12 khớp 3 quý.
import { docSheetLuong, docBangLuong, docC12PdfChu, thangCuaSheetLuong } from '../lib/phanTich/doc/bangLuong.js'
import { soatKy } from '../lib/phanTich/soatKy.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

// Một sheet bảng lương tháng `t`: người = [tên, mst, tổng TN, lương BH, BHXH DN, BHXH NLĐ, thuế, TNCT]
function sheetLuong(t, nguoi, ten = 'LT' + t) {
  const hang = [[null, 'CÔNG TY TNHH MẪU'], [null, 'MST: 0300000001'], [], [], [], [null, 'BẢNG THANH TOÁN TIỀN LƯƠNG'],
    [null, null, null, null, null, null, null, null, null, null, 'Tháng', t, 'Năm', 2026], [],
    ['Mã NV', 'STT', 'Họ và Tên', 'MST', 'Chức vụ', 'Lương căn bản', 'Tổng thu nhập', 'Lương đóng BH', 'Doanh nghiệp chịu', null, 'Khấu trừ vào lương', null, 'Thu nhập chịu thuế TNCN', 'Số tiền thực lãnh'],
    [null, null, null, null, null, null, null, null, 'BHXH', 'BHYT', 'BHXH', 'Thuế TNCN phải nộp'],
    [null, null, null, null, null, null, null, null, 0.175, 0.03, 0.08, null],
    ...nguoi.map(([ten2, mst, tn, bh, dn, nld, thue, tnct], i) => ['A0' + i, i + 1, ten2, mst, 'NV', tn, tn, bh, dn, bh * 0.03, nld, thue, tnct, tn - nld - thue]),
    [null, 1, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0],                       // dòng mẫu trống
    [null, 'Tổng cộng', null, null, null, null, nguoi.reduce((s, p) => s + p[2], 0)],     // "Tổng cộng" ở cột STT
    [], [null, null, 'Người lập', null, null, null, 999999999]]                             // khối chữ ký có số
  return { ten, hang }
}
const NV = [['Nguyễn Văn A', '0101', 20e6, 8e6, 1.4e6, 640000, 500000, 18e6], ['Trần Thị B', '0102', 10e6, 5e6, 875000, 400000, 0, 9e6],
  ['Lê C (không đóng BH)', '0103', 6e6, 0, 0, 0, 0, 6e6]]

console.log('Đọc bảng lương:')
const b7 = docSheetLuong(sheetLuong(7, NV))
kiem('nhận tháng / năm từ ô "Tháng | 7 | Năm | 2026"', [b7.thang, b7.nam], [7, 2026])
kiem('3 người — dừng ở "Tổng cộng" (cột STT), không lấy dòng "Người lập"', b7.nguoi.map(p => p.ten), ['Nguyễn Văn A', 'Trần Thị B', 'Lê C (không đóng BH)'])
kiem('BHXH lấy cột KHẤU TRỪ VÀO LƯƠNG, không lấy cột doanh nghiệp chịu', b7.nguoi.map(p => p.bhxhNld), [640000, 400000, 0])
kiem('tổng: TNCT, thuế, lương đóng BH, số người đóng BH', [b7.tong.tnct, b7.tong.thue, b7.tong.luongDongBh, b7.tong.soNguoiDongBh], [33e6, 500000, 13e6, 2])
kiem('sheet không phải bảng lương → null', docSheetLuong({ ten: 'TTNV', hang: [['Mã NV', 'Họ và tên', 'Tổng thu nhập']] }), null)
kiem('tháng theo tên sheet khi không có ô Tháng', thangCuaSheetLuong({ ten: 'LT11', hang: [] }).thang, 11)
kiem('tháng theo chữ "THÁNG 03/2026"', thangCuaSheetLuong({ ten: 'x', hang: [['BẢNG LƯƠNG THÁNG 03/2026']] }), { thang: 3, nam: 2026 })
const nam = docBangLuong([{ ten: 'TTCTY', hang: [['THÔNG TIN CÔNG TY']] }, sheetLuong(7, NV), sheetLuong(8, NV), sheetLuong(9, NV.slice(0, 2))])
kiem('cả file: chỉ lấy sheet bảng lương các tháng', nam.map(b => b.thang), [7, 8, 9])

console.log('\nĐọc C12 (PDF có chữ):')
const C12 = (thang, n, ql) => [[
  'Mẫu C12-TS', 'CHI TIẾT KẾT QUẢ ĐÓNG BHXH, BHYT, BHTN, BHTNLĐ, BNN', `Tháng ${String(thang).padStart(2, '0')} năm 2026`,
  'A Kỳ trước mang sang', `1 Số lao động ${n} ${n} ${n} ${n} ${n}`, 'B Phát sinh trong kỳ 1 2 3 4 5 6',
  `2 Quỹ lương ${ql.toLocaleString('vi-VN')} ${ql.toLocaleString('vi-VN')} ${ql.toLocaleString('vi-VN')} 0 0`, '3 Phải đóng 1 2 3 4 5 6',
], ['Đ Chuyển kỳ sau', `1 Số lao động ${n} ${n} ${n} ${n} ${n}`, `a) Kết quả đơn vị đã đóng BHXH bắt buộc cho ${n} lao động đến hết tháng ${thang}/2026`]]
kiem('tháng, số lao động, quỹ lương BHXH', docC12PdfChu(C12(9, 2, 13e6)), { ok: true, thang: 9, nam: 2026, soLaoDong: 2, quyLuong: 13e6 })
kiem('PDF không phải C12', docC12PdfChu([['Hợp đồng lao động']]).khongPhai, true)
kiem('PDF ảnh scan', docC12PdfChu([[]]).scan, true)

console.log('\nSoát kỳ Q3 — TNCN + bảo hiểm:')
const tncn = (c21, c29, c16, chuaNop = false) => ({ loai: '05/KK-TNCN', ky: { loai: 'Q', so: 3, nam: 2026 }, maKy: 'Q3.2026', lanBoSung: 0, ngayLap: '2026-10-10',
  chiTieu: { 16: c16, 21: c21, 29: c29 }, tep: { ten: 'TK_TNCN_Q3.xml', duongDan: ['CTY', 'BAOCAOTHUE_Q3_2026', chuaNop ? 'BẢNG KÊ' : 'TỜ KHAI THUẾ'] } })
const luong = nam.map(b => ({ ...b, tep: {} }))
const c12 = [{ thang: 9, nam: 2026, soLaoDong: 2, quyLuong: 13e6 }]
const tk3 = { loai: '01/GTGT', ky: { loai: 'Q', so: 3, nam: 2026 }, maKy: 'Q3.2026', lanBoSung: 0, chiTieu: {}, tep: { ten: 'x.xml', duongDan: ['TỜ KHAI THUẾ'] } }
const tong21 = 33e6 * 2 + 27e6, tong29 = 500000 * 3
const r = soatKy({ nam: 2026, ma: 'Q3', toKhai: [tk3, tncn(tong21, tong29, 3)], bangLuong: luong, c12, cty: { kyKhai: 'quy' } })
const d = ten => r.dong.find(x => x.ten.includes(ten))
kiem('[21] = Σ TNCT T7–T9', [d('[21]').so2, d('[21]').kq], [tong21, 'khop'])
kiem('[29] = Σ thuế T7–T9', d('[29]').kq, 'khop')
kiem('[16] = số người khác nhau trong quý (3)', [d('[16]').so2, d('[16]').kq], [3, 'khop'])
kiem('C12 T9 ↔ bảng lương T9: 2 người đóng BH, quỹ lương 13 triệu', [d('người tham gia').kq, d('quỹ lương').kq], ['khop', 'khop'])
const r2 = soatKy({ nam: 2026, ma: 'Q3', toKhai: [tk3, tncn(tong21 - 5e6, tong29, 4)], bangLuong: luong, c12: [{ ...c12[0], soLaoDong: 3 }], cty: { kyKhai: 'quy' } })
const d2 = ten => r2.dong.find(x => x.ten.includes(ten))
kiem('lệch [21] 5 triệu, [16] khai 4 người, C12 3 người → Có chênh lệch', [d2('[21]').chenh, d2('[16]').kq, d2('người tham gia').chenh], [-5e6, 'chenh', 1])
const r3 = soatKy({ nam: 2026, ma: 'Q3', toKhai: [tk3, tncn(tong21, tong29, 3)], bangLuong: luong.filter(b => b.thang !== 8), c12: [], cty: { kyKhai: 'quy' } })
const d3 = ten => r3.dong.find(x => x.ten.includes(ten))
kiem('thiếu bảng lương T8 → Thiếu hồ sơ ghi tháng thiếu', [d3('05/KK-TNCN').kq, d3('05/KK-TNCN').thieuFile.includes('T8')], ['thieu', true])
kiem('thiếu C12 tháng 9 → Thiếu hồ sơ', [d3('người tham gia').kq, d3('người tham gia').thieuFile.includes('C12 tháng 09/2026')], ['thieu', true])
const r4 = soatKy({ nam: 2026, ma: 'Q3', toKhai: [tk3], bangLuong: luong, cty: { kyKhai: 'quy' } })
kiem('có khấu trừ thuế mà chưa có 05/KK-TNCN → Có chênh lệch', r4.dong.find(x => x.nhom === 'tncn').kq, 'chenh')
const khongThue = nam.map(b => ({ ...b, tong: { ...b.tong, thue: 0 } }))
kiem('không khấu trừ, không tờ khai → Khớp (không phải khai)', soatKy({ nam: 2026, ma: 'Q3', toKhai: [tk3], bangLuong: khongThue, cty: { kyKhai: 'quy' } }).dong.find(x => x.nhom === 'tncn').kq, 'khop')
const tkT8 = { ...tk3, ky: { loai: 'T', so: 8, nam: 2026 }, maKy: 'T08.2026' }
kiem('GTGT khai tháng, TNCN khai quý: tháng 8 → hẹn soát ở T9', soatKy({ nam: 2026, ma: 'T08', toKhai: [tkT8, tncn(tong21, tong29, 3)], bangLuong: luong, cty: { kyKhai: 'thang' } }).dong.find(x => x.nhom === 'tncn').kq, 'thong_tin')

console.log('\nNgân hàng / tiền mặt:')
const r5 = soatKy({ nam: 2026, ma: 'Q3', toKhai: [tk3], bangKe: [{ mau: 'cong', chieu: 'mua_vao', hoaDon: [] }], soSach: { coSoPhu: true, coSo112: false, coSoQuy: false }, cty: { kyKhai: 'quy' } })
kiem('có sổ phụ, chưa có sổ 112 → Thiếu hồ sơ sổ chi tiết TK 112', r5.dong.find(x => x.nhom === 'ngan_hang').thieuFile.includes('TK 112'), true)
kiem('chưa có sổ quỹ → tiền mặt từ 5 triệu "Thiếu hồ sơ"', r5.dong.find(x => x.ten.includes('5 triệu')).kq, 'thieu')

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
