// Bộ kiểm sổ tiền + sao kê + đối chiếu ngân hàng / tiền mặt của Soát kỳ (lib/phanTich/doc/soTien.js, soatKy.js).
//   node scripts/test-phantich-sotien.mjs
// Sheet GIẢ dựng theo đúng cấu trúc cột của 5 mẫu thật (soát 27/10/2026): sổ tiền gửi MISA, sổ quỹ MISA, sổ chi tiết kiểu
// cũ một sheet mỗi tài khoản, sao kê Vietinbank eFAST, sao kê "Số tiền rút / Số tiền gửi" ghi số dạng chữ.
import { soTienO, ngayO, docSoTien, docSaoKeTien, doiChieuNganHang, chiTienMatTuNguong, nguongTienMat } from '../lib/phanTich/doc/soTien.js'
import { soatKy } from '../lib/phanTich/soatKy.js'

let hong = 0, dat = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  if (a === b) { dat++; return }
  hong++; console.log(`  HỎNG ${ten}\n         ra ${a}\n         đáng lẽ ${b}`)
}

// ── Số tiền, ngày ───────────────────────────────────────────────────────────────
kiem('số tiền dạng chữ', ['29.039.880', '1,090,575,000', '(500.000)', '-500000', '1.234,5', 1500, '', 'abc', '12/03/2026'].map(soTienO), [29039880, 1090575000, -500000, -500000, 1234.5, 1500, null, null, null])
kiem('ngày', ['31-08-2026 10:51:05', '05/12/2023', '2026-08-01', 46000, 'x'].map(ngayO), ['2026-08-31', '2023-12-05', '2026-08-01', '2025-12-09', null])

// ── Sổ tiền gửi MISA ───────────────────────────────────────────────────────────
const misaTg = { ten: 'SỔ TIỀN GỬI NGÂN HÀNG', hang: [
  ['CÔNG TY TNHH MẪU'], [], ['SỔ TIỀN GỬI NGÂN HÀNG'], ['Tài khoản: 1121, Loại tiền: VND'], [],
  ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Diễn giải', 'TK đối ứng', 'Thu', 'Chi', 'Tồn'],
  ['Tài khoản ngân hàng: 0123', null, null, null, null, 9000000, 2000000, null],
  [null, null, null, 'Số dư đầu kỳ', null, null, null, 50000000],
  ['03/07/2026', '03/07/2026', 'NTTK01', 'Khách trả tiền', '131', 8000000, null, 58000000],
  ['10/07/2026', '10/07/2026', 'UNC01', 'Trả tiền hàng', '331', null, 2000000, 56000000],
  ['31/07/2026', '31/07/2026', 'NTTK02', 'Lãi tiền gửi', '515', 1000000, null, 57000000],
  [null, null, null, 'Cộng phát sinh', null, 9000000, 2000000, null],
] }
// ── Sổ quỹ MISA (tiêu đề 2 tầng) ───────────────────────────────────────────────
const misaQuy = { ten: 'SỔ KẾ TOÁN CHI TIẾT QUỸ TIỀN M', hang: [
  ['CÔNG TY TNHH MẪU'], ['SỔ KẾ TOÁN CHI TIẾT QUỸ TIỀN MẶT'], ['Loại tiền: VND, Năm 2026'], [],
  ['Ngày hạch toán', 'Ngày chứng từ', 'Số phiếu thu', 'Số phiếu chi', 'Diễn giải', 'Tài khoản', 'TK đối ứng', 'Số phát sinh', null, 'Số tồn', 'Người nhận/Người nộp'],
  [null, null, null, null, null, null, null, 'Nợ', 'Có', null, null],
  [null, null, null, null, 'Số dư đầu kỳ', '111', null, null, null, 30000000, null],
  ['05/07/2026', '05/07/2026', null, 'PC01', 'Trả tiền mua hàng HĐ 12', '111', '331', null, 6600000, 23400000, 'Cty A'],
  ['06/07/2026', '06/07/2026', null, 'PC02', 'Nộp tiền vào tài khoản', '111', '1121', null, 10000000, 13400000, null],
  ['07/07/2026', '07/07/2026', null, 'PC03', 'Mua văn phòng phẩm', '111', '6422', null, 800000, 12600000, null],
  ['08/07/2026', '08/07/2026', null, 'PC04', 'Tạm ứng công tác', '111', '141', null, 9000000, 3600000, null],
  ['09/07/2026', '09/07/2026', null, 'PC05', 'Trả lại tiền khách', '111', '131', null, 7000000, 0, null],
  ['10/07/2026', '10/07/2026', 'PT01', null, 'Rút tiền về quỹ', '111', '1121', 5000000, null, 5000000, null],
] }
// ── Sổ chi tiết kiểu cũ: sheet tổng "112" + sheet con "1122" (dòng 1122 nằm ở cả hai) ───────────────────────────
const tieuDeCu = ['Ngay_ct', 'Ma_ct', 'So_ct', 'Dien_giai', 'Ps_no', 'Ps_co', 'Tk_du']
const dauCu = [['Cong Ty Mau'], [], ['So chi tiet tai khoan'], ['Tu thang 07/2026 den thang 07/2026'], [], tieuDeCu, [], ['  -   -', null, null, 'Du dau ky', 1000, 0, null]]
const cu112 = { ten: '112', hang: [...dauCu, ['15/07/2026', 'BC', '050', 'KH tra tien', 4000000, 0, '131'], ['16/07/2026', 'BC', '098', 'KH tra USD', 24000000, 0, '131'], ['17/07/2026', 'BN', '010', 'Tra tien hang', 0, 3000000, '331']] }
const cu1122 = { ten: '1122', hang: [...dauCu, ['16/07/2026', 'BC', '098', 'KH tra USD', 24000000, 0, '131']] }
const cu131 = { ten: '131', hang: [...dauCu, ['15/07/2026', 'BC', '050', 'KH tra tien', 0, 4000000, '112']] }

{
  const tg = docSoTien([misaTg])
  kiem('MISA tiền gửi: 3 dòng TK 1121, bỏ dòng tổng / số dư', tg.map(d => [d.tk, d.ngay, d.soCt, d.tkDu, d.no, d.co]),
    [['1121', '2026-07-03', 'NTTK01', '131', 8000000, 0], ['1121', '2026-07-10', 'UNC01', '331', 0, 2000000], ['1121', '2026-07-31', 'NTTK02', '515', 1000000, 0]])
  const q = docSoTien([misaQuy])
  kiem('MISA sổ quỹ tiêu đề 2 tầng: 6 dòng, số phiếu từ cột thu hoặc chi', q.map(d => [d.tk, d.soCt, d.no, d.co]),
    [['111', 'PC01', 0, 6600000], ['111', 'PC02', 0, 10000000], ['111', 'PC03', 0, 800000], ['111', 'PC04', 0, 9000000], ['111', 'PC05', 0, 7000000], ['111', 'PT01', 5000000, 0]])
  const cu = docSoTien([cu112, cu1122, cu131])
  kiem('sổ kiểu cũ: bỏ sheet 131, dòng 1122 không đếm 2 lần ở sheet tổng', cu.map(d => [d.tk, d.soCt]).sort(), [['112', '010'], ['112', '050'], ['1122', '098']])
  kiem('ngưỡng tiền mặt', [nguongTienMat('2025-06-30'), nguongTienMat('2025-07-01')], [20000000, 5000000])
  kiem('chi tiền mặt ≥ 5tr cho mua hàng: chỉ PC01 (bỏ nộp NH, tạm ứng, trả lại khách, dưới ngưỡng)', chiTienMatTuNguong(q, '2026-07-01', '2026-07-31').map(d => d.soCt), ['PC01'])
}

// ── Sao kê ─────────────────────────────────────────────────────────────────────
const vtb = { ten: 'LICH SU GIAO DICH', hang: [
  ['NGÂN HÀNG TMCP MẪU'], [], [null, 'Loại tiền tệ/Currency:', 'VND'],
  [null, 'Tổng giá trị ghi có/ Total credits:', 999, 'Tổng giá trị ghi nợ/ Total debits:', 999],
  ['STT/No.', 'Ngày hạch toán/Accounting date', 'Mô tả giao dịch/ Transaction description', 'Nợ/ Debit', 'Có / Credit', 'Số dư TK/ Account Balance'],
  [1, '01-08-2026 10:00:00', 'Lai tien gui thang 7', 0, 1000000, 51000000],
  [2, '03-07-2026 09:00:00', 'CT DEN KH tra tien', 0, 8000000, 58000000],
  [3, '10-07-2026 14:00:00', 'TT tien hang', 2000000, 0, 56000000],
  [4, '20-07-2026 14:00:00', 'Phi SMS', 11000, 0, 55989000],
] }
const dangChu = { ten: 'ViewStatement', hang: [
  [null, null, 'SỔ PHỤ TÀI KHOẢN'], [null, null, 'Loại tiền:', null, 'VND'],
  ['STT', 'Số giao dịch', null, 'Ngày giao dịch', null, 'Ngày hiệu lực', null, 'Nội dung', null, 'Số tiền rút', null, 'Số tiền gửi', 'Số dư hiện tại'],
  [1, 'FT1', null, '01-12-2023 13:26:48', null, '01-12-2023', null, 'TT tien gia cong', null, '29.039.880', null, null, '88.599.101'],
  [2, 'FT2', null, '05-12-2023 10:15:53', null, '05-12-2023', null, 'Mua USD', null, null, null, '1.090.575.000', '1.179.174.101'],
] }
kiem('sao kê Vietinbank: Nợ = ra, Có = vào', docSaoKeTien([vtb]).map(g => [g.ngay, g.vao, g.ra, g.tienTe]),
  [['2026-08-01', 1000000, 0, 'VND'], ['2026-07-03', 8000000, 0, 'VND'], ['2026-07-10', 0, 2000000, 'VND'], ['2026-07-20', 0, 11000, 'VND']])
kiem('sao kê số dạng chữ: không đọc nhầm cột số dư làm tiền gửi', docSaoKeTien([dangChu]).map(g => [g.ngay, g.vao, g.ra]),
  [['2023-12-01', 0, 29039880], ['2023-12-05', 1090575000, 0]])

// ── Đối chiếu ngân hàng ─────────────────────────────────────────────────────────
{
  const r = doiChieuNganHang(docSaoKeTien([vtb]), docSoTien([misaTg]), '2026-07-01', '2026-07-31')
  kiem('đối chiếu T7: lãi ghi sổ 31/07, sao kê 01/08 vẫn ghép; phí SMS chỉ có trên sao kê', [r.tongSaoKe, r.tongSo, r.chiSaoKe.map(g => g.moTa), r.chiSo.length],
    [{ vao: 8000000, ra: 2011000 }, { no: 9000000, co: 2000000 }, ['Phi SMS'], 0])
}

// ── Soát kỳ: dòng kết quả + chi tiết ────────────────────────────────────────────
{
  const hd = { ngay: '2026-07-04', so: '12', kyHieu: '1C26TAA', mst: '0300000001', ten: 'Cty A', tienChuaThue: 6000000, thue: 600000 }
  const bangKe = [{ mau: 'cong', chieu: 'mua_vao', hoaDon: [hd] }]
  const kq = soatKy({ nam: 2026, ma: 'Q3', cty: { kyKhai: 'quy' }, bangKe, soSach: { coSoPhu: true },
    saoKeTien: docSaoKeTien([vtb]), soTien: [...docSoTien([misaTg]), ...docSoTien([misaQuy])] })
  const dong = n => kq.dong.find(d => d.nhom === n && d.ten.includes('tiền vào')) || kq.dong.find(d => d.ten.startsWith('Chi tiền mặt'))
  const vao = kq.dong.find(d => d.ten.endsWith('tiền vào')), ra = kq.dong.find(d => d.ten.endsWith('tiền ra'))
  kiem('Q3: tiền vào khớp (lãi 01/08 trong quý), tiền ra lệch đúng phí SMS', [vao.kq, ra.kq, ra.chenh], ['khop', 'chenh', 11000])
  const tm = dong('hoa_don')
  kiem('Q3: 1 phiếu chi tiền mặt ≥ 5tr', [tm.kq, tm.so1, tm.nhan1], ['chenh', 6600000, '1 phiếu chi trên sổ quỹ'])
  const ct = kq.chiTiet.filter(c => c.chieu === 'tien_mat' || c.chieu === 'ngan_hang').map(c => [c.loai, c.hd.so, /khớp số tiền hóa đơn/.test(c.lyDo)])
  kiem('chi tiết: phiếu chi ghép đúng hóa đơn 6,6 triệu; phí SMS là giao dịch chỉ có trên sổ phụ', ct, [['nh_chi_sao_ke', '', false], ['tien_mat_nguong', '12', true]])

  // Lãi ghi sổ 30/09 nhưng sổ phụ ghi 01/10: tiền vào Q3 lệch, ghi chú phải nói rõ là lệch kỳ (không phải thiếu)
  const sk2 = docSaoKeTien([{ ...vtb, hang: vtb.hang.map(h => (h[2] === 'Lai tien gui thang 7' ? [1, '01-10-2026 10:00:00', 'Lai tien gui thang 9', 0, 1000000, 0] : h)) }])
  const so2 = docSoTien([{ ...misaTg, hang: misaTg.hang.map(h => (h[2] === 'NTTK02' ? ['30/09/2026', '30/09/2026', 'NTTK02', 'Lãi tiền gửi', '515', 1000000, null, 0] : h)) }])
  const q3 = soatKy({ nam: 2026, ma: 'Q3', cty: { kyKhai: 'quy' }, soSach: { coSoPhu: true }, saoKeTien: sk2, soTien: so2 })
  const v3 = q3.dong.find(d => d.ten.endsWith('tiền vào')), r3 = q3.dong.find(d => d.ten.endsWith('tiền ra'))
  kiem('lệch kỳ: tiền vào chênh 1tr, ghi chú "lệch kỳ 30/09 ↔ 01/10", không báo sổ phụ thiếu ngày', [v3.chenh, /lệch kỳ: sổ ghi 30\/09, sổ phụ ghi 01\/10/.test(v3.ghiChu), /chỉ có đến/.test(v3.ghiChu)], [-1000000, true, false])
  kiem('ghi chú tách theo chiều: tiền ra chỉ nói phí SMS, không nhắc khoản lãi', [/1 giao dịch trên sổ phụ/.test(r3.ghiChu), /lệch kỳ/.test(r3.ghiChu)], [true, false])

  const thieu = soatKy({ nam: 2026, ma: 'Q3', cty: { kyKhai: 'quy' }, bangKe, soSach: { coSoPhu: true, coSo112: false, coSoQuy: false }, saoKeTien: docSaoKeTien([vtb]), soTien: [] })
  kiem('không có sổ: 2 dòng Thiếu hồ sơ đúng tên file', thieu.dong.filter(d => d.nhom === 'ngan_hang' || d.ten.includes('tiền mặt')).map(d => [d.kq, /SỔ SÁCH KẾ TOÁN\\/.test(d.thieuFile)]), [['thieu', true], ['thieu', true]])
}

console.log(hong ? `\n✗ ${hong} lỗi / ${dat + hong} phép kiểm` : `\n✓ Đạt ${dat}/${dat} phép kiểm`)
process.exit(hong ? 1 : 0)
