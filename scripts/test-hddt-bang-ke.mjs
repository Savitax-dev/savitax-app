// Bộ kiểm lib/hddtBangKe.js — dữ liệu GIẢ dựng theo đúng khuôn file cổng hoadondientu (dò thật 21/11/2026).
// Chạy: node scripts/test-hddt-bang-ke.mjs
import XLSX from 'xlsx'
import { kyCanTai, danhSachLuot, tenFileBangKe, docBangKeCong, kiemBangKe, mstKhop } from '../lib/hddtBangKe.js'
import { goiYTheoTen } from '../lib/phanTich/thuMuc.js'

let sai = 0
const kiem = (ten, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (!ok) sai++
  console.log(ok ? '  ✔' : '  ✘', ten, ok ? '' : `\n      được: ${JSON.stringify(a)}\n      cần:  ${JSON.stringify(b)}`)
}

console.log('Kỳ cần tải:')
const HOM_NAY = new Date(2026, 10, 21)   // 21/11/2026
kiem('khai quý, Q3 → 1 kỳ trọn quý', kyCanTai({ kyKhai: 'quy', ky: { nam: 2026, quy: 3 }, homNay: HOM_NAY }).ky.map(k => [k.tuNgay, k.denNgay, k.thuMucKy]),
  [['01/07/2026', '30/09/2026', 'QUÝ 3']])
kiem('khai quý, Q4 chưa hết → đến hôm nay', kyCanTai({ kyKhai: 'quy', ky: { nam: 2026, quy: 4 }, homNay: HOM_NAY }).ky.map(k => [k.tuNgay, k.denNgay, k.chuaHet]),
  [['01/10/2026', '21/11/2026', true]])
kiem('khai quý mà chọn tháng → báo', !!kyCanTai({ kyKhai: 'quy', ky: { nam: 2026, thang: 10 }, homNay: HOM_NAY }).loi, true)
kiem('khai tháng, Q4 → T10, T11 (T12 chưa tới)', kyCanTai({ kyKhai: 'thang', ky: { nam: 2026, quy: 4 }, homNay: HOM_NAY }).ky.map(k => [k.tuNgay, k.denNgay, k.thuMucKy]),
  [['01/10/2026', '31/10/2026', 'THÁNG 10'], ['01/11/2026', '21/11/2026', 'THÁNG 11']])
kiem('khai tháng, T2/2028 nhuận', kyCanTai({ kyKhai: 'thang', ky: { nam: 2028, thang: 2 }, homNay: new Date(2029, 0, 1) }).ky.map(k => k.denNgay), ['29/02/2028'])

console.log('Tên file + Soát xét nhận đúng chiều:')
const tenMua = tenFileBangKe({ mst: '0300000001', loai: 'mua', tabCon: '', tuNgay: '01/07/2026', denNgay: '30/09/2026' })
const tenBanMtt = tenFileBangKe({ mst: '0300000001', loai: 'ban', tabCon: 'mtt', tuNgay: '01/07/2026', denNgay: '30/09/2026' })
kiem('tên mua vào', tenMua, '0300000001 - Mua vào - Tổng quan - 2026-07-01_2026-09-30.xlsx')
kiem('tên bán ra máy tính tiền', tenBanMtt, '0300000001 - Bán ra - Tổng quan - Máy tính tiền - 2026-07-01_2026-09-30.xlsx')
kiem('Soát xét: mua vào = bảng kê cổng mua vào', goiYTheoTen(tenMua), { loai: 'bang_ke_cong', chieu: 'mua_vao' })
kiem('Soát xét: bán ra MTT = bảng kê cổng bán ra', goiYTheoTen(tenBanMtt), { loai: 'bang_ke_cong', chieu: 'ban_ra' })

console.log('Danh sách lượt:')
const luot = danhSachLuot({ mst: '0300000001', kyList: kyCanTai({ kyKhai: 'quy', ky: { nam: 2026, quy: 3 }, homNay: HOM_NAY }).ky })
kiem('quý × 2 chiều × 2 loại = 4 lượt', luot.length, 4)
kiem('đường dẫn mua vào', luot[0].duongDan, ['2. HÓA ĐƠN MUA VÀO_BÁN RA', 'QUÝ 3', 'HĐ MUA VÀO'])
kiem('lượt cuối là bán ra MTT', [luot[3].loai, luot[3].tabCon, luot[3].duongDan[2]], ['ban', 'mtt', 'HĐ BÁN RA'])

console.log('Đọc + kiểm file cổng:')
const fileCong = ({ tu = '01/07/2026', den = '30/09/2026', dong }) => {
  const tieuDe = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng',
    'MST người mua/MST người nhận hàng', 'Tên người mua/Tên người nhận hàng', 'Địa chỉ người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế',
    'Tổng tiền chiết khấu thương mại', 'Tổng tiền phí', 'Tổng tiền thanh toán', 'Đơn vị tiền tệ', 'Tỷ giá', 'Trạng thái hóa đơn', 'Kết quả kiểm tra hóa đơn']
  const aoa = [[], [], ['DANH SÁCH HÓA ĐƠN'], [`Từ ngày ${tu} đến ngày ${den}`], [], tieuDe,
    ...dong.map((d, i) => [String(i + 1), '1', 'C26TAA', String(100 + i), d.ngay, d.ban, 'CÔNG TY BÁN THỬ', d.mua, 'CÔNG TY MUA THỬ', '', '1000', '80', '0', '', '1080', 'VND', '1.0', 'Hóa đơn mới', 'Đã cấp mã hóa đơn'])]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'sheet 1')
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}
const CTY = '0300000001'
const d1 = docBangKeCong(fileCong({ dong: [{ ngay: '05/07/2026', ban: '0300000009', mua: CTY }, { ngay: '30/09/2026', ban: '0300000008', mua: CTY + '-001' }] }), XLSX)
kiem('đọc: khoảng ngày + số hóa đơn', [d1.tuNgay, d1.denNgay, d1.soHoaDon], ['01/07/2026', '30/09/2026', 2])
const lMua = luot[0]
kiem('mua vào đúng công ty (kể cả chi nhánh -001) → lưu', kiemBangKe({ doc: d1, luot: lMua, mstCty: CTY, soKetQua: 2 }).ok, true)
kiem('số dòng khác "Có N kết quả" → không lưu', kiemBangKe({ doc: d1, luot: lMua, mstCty: CTY, soKetQua: 3 }).ok, false)
const kNham = kiemBangKe({ doc: d1, luot: lMua, mstCty: '0399999999', soKetQua: 2 })
kiem('đăng nhập nhầm công ty → không lưu, nói rõ', [kNham.ok, /nhầm công ty/.test(kNham.loi.join())], [false, true])
const d2 = docBangKeCong(fileCong({ tu: '01/10/2026', den: '31/10/2026', dong: [{ ngay: '05/10/2026', ban: CTY, mua: '' }] }), XLSX)
kiem('file khác kỳ → không lưu', kiemBangKe({ doc: d2, luot: lMua, mstCty: CTY, soKetQua: 1 }).ok, false)
const lBan = { ...luot[2], tuNgay: '01/10/2026', denNgay: '31/10/2026' }
const kBan = kiemBangKe({ doc: d2, luot: lBan, mstCty: CTY, soKetQua: 1 })
kiem('bán ra: MST người bán = công ty, người mua trống (bán lẻ) → lưu', kBan.ok, true)
const d3 = docBangKeCong(fileCong({ tu: '01/10/2026', den: '31/10/2026', dong: [{ ngay: '05/11/2026', ban: CTY, mua: '' }] }), XLSX)
kiem('ngày lập ngoài kỳ → không lưu', kiemBangKe({ doc: d3, luot: lBan, mstCty: CTY, soKetQua: 1 }).ok, false)
const d0 = docBangKeCong(fileCong({ dong: [] }), XLSX)
kiem('file 0 hóa đơn đọc được', [d0.soHoaDon, d0.loi], [0, undefined])
kiem('file lạ → lỗi', !!docBangKeCong(new Uint8Array(XLSX.write((() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([['a', 'b']]), 's'); return w })(), { type: 'array', bookType: 'xlsx' })), XLSX).loi, true)
kiem('mstKhop giữ số 0 đầu', [mstKhop('0300000001', '300000001'), mstKhop('0300000001', '0300000001')], [false, true])

console.log(sai ? `\n✘ ${sai} ca sai` : '\n✔ Tất cả đều đúng')
process.exit(sai ? 1 : 0)
