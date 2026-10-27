// Kiểm bộ đọc tờ khai PDF có chữ (lib/phanTich/doc/toKhaiPdf.js, pdfChu.js) + chọn file PDF trong docHoSo.js.
//   node scripts/test-phantich-pdf.mjs
//
// Dòng chữ dưới đây dựng lại ĐÚNG BỐ CỤC bản in tờ khai thật (đã đối chiếu 7 tờ khai PDF ↔ XML của một công ty,
// 26/10/2026: khớp 100% chỉ tiêu), nhưng tên, MST và số liệu là GIẢ. Cuối file có một lượt đi trọn đường: dựng PDF
// bằng pdf-lib (font Arial của Windows) rồi đọc lại qua pdfjs — máy không có font thì bỏ qua lượt đó.
import fs from 'node:fs'
import { docToKhaiPdfChu, chiTieuTrenDong, kyTuChu } from '../lib/phanTich/doc/toKhaiPdf.js'
import { gomDong, layDongPdf } from '../lib/phanTich/doc/pdfChu.js'
import { tepPdfCuaNam, docToKhaiCuaNam } from '../lib/phanTich/docHoSo.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

const GTGT = (ky, lan = 0) => [[
  'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Mẫu số: 01/GTGT', '(Ban hành kèm theo Thông tư', 'số 80/2021/TT-BTC ngày 29',
  'TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (MẪU SỐ 01/GTGT) trưởng Bộ Tài chính)',
  '[01a] Tên hoạt động sản xuất kinh doanh: Hoạt động sản xuất kinh doanh thông thường',
  `[01b] Kỳ tính thuế: ${ky}`,
  lan ? `[02] Lần đầu: [ ] [03] Bổ sung lần thứ: [${lan}]` : '[02] Lần đầu: [X] [03] Bổ sung lần thứ: [ ]',
  '[04] Tên người nộp thuế: CÔNG TY TNHH MẪU SOÁT XÉT', '[05] Mã số thuế: 0300000001',
  '[09] Điện thoại: 0281234567 [10] Fax:',
  'A Không phát sinh hoạt động mua, bán trong kỳ (đánh dấu "X") [21] []',
  'B Thuế giá trị gia tăng còn được khấu trừ kỳ trước chuyển sang [22] 12.345.678',
  '1 Giá trị và thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào [23] 500.000.000 [24] 50.000.000',
  'Trong đó: hàng hóa, dịch vụ nhập khẩu [23a] 0 [24a] 0',
  '2 Thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào được khấu trừ kỳ này [25] 50.000.000',
  '2 [27] 400.000.000 [28] 40.000.000', '([27]=[29]+[30]+[32]+[32a]; [28]=[31]+[33])',
  'c Hàng hoá, dịch vụ bán ra chịu thuế suất 10% [32] 400.000.000 [33] 40.000.000',
  '3 [34] 400.000.000 [35] 40.000.000', '([34]=[26]+[27]; [35]=[28])',
  'III Thuế giá trị gia tăng phát sinh trong kỳ ([36]=[35]-[25]) [36] (10.000.000)',
  '1/2',
], [
  '4 [41] 22.345.678', '{[41]=([36]-[22]+[37]-[38]-[39a]) ≤ 0}',
  '4.2 Thuế giá trị gia tăng còn được khấu trừ chuyển kỳ sau ([43]=[41]-[42]) [43] 22.345.678',
  'Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu đã khai./...',
  'NHÂN VIÊN ĐẠI LÝ THUẾ Ngày 01 tháng 10 năm 2026',
], ['BẢNG KÊ … (phụ lục — không được đọc)', '[34] 999', 'Tổng cộng [98] 5']]

console.log('Tờ khai 01/GTGT (bản in cổng thuế):')
const g = docToKhaiPdfChu(GTGT('Quý 3 năm 2026'))
kiem('nhận đúng loại, kỳ, chính thức, MST, ngày', [g.ok, g.tk.loai, g.tk.maKy, g.tk.chinhThuc, g.tk.mst, g.tk.ngayLap], [true, '01/GTGT', 'Q3.2026', true, '0300000001', '2026-10-01'])
kiem('chỉ tiêu số VN, số âm trong ngoặc, ô đánh dấu trống = 0', [g.tk.chiTieu['22'], g.tk.chiTieu['36'], g.tk.chiTieu['21'], g.tk.chiTieu['23a']], [12345678, -10000000, 0, 0])
kiem('hai chỉ tiêu trên một dòng', [g.tk.chiTieu['23'], g.tk.chiTieu['24']], [500000000, 50000000])
kiem('dòng công thức "[27]=[29]+…" không thành giá trị', g.tk.chiTieu['29'], undefined)
kiem('dừng ở "Tôi cam đoan" — số trong phụ lục không lẫn vào', [g.tk.chiTieu['34'], g.tk.chiTieu['98']], [400000000, undefined])
kiem('[05] MST, [09] điện thoại không thành chỉ tiêu', [g.tk.chiTieu['05'], g.tk.chiTieu['09']], [undefined, undefined])
const bs = docToKhaiPdfChu(GTGT('Tháng 09 năm 2026', 2))
kiem('bổ sung lần 2, kỳ tháng', [bs.tk.maKy, bs.tk.chinhThuc, bs.tk.lanBoSung], ['T09.2026', false, 2])

console.log('\nTờ khai 05/KK-TNCN (mẫu số tách 2 dòng, có đơn vị trước số):')
const tncn = docToKhaiPdfChu([[
  'Mẫu số: 05/KK-', 'TNCN', 'TK KHẤU TRỪ THUẾ THU NHẬP CÁ NHÂN MẪU 05/KK-TNCN (TT80/2021)', '[01] Kỳ tính thuế: Quý 2 năm 2026',
  '[02] Lần đầu: [X] [03] Bổ sung lần thứ: [ ]', '[05] Mã số thuế: 0300000001',
  '[15] Phân bổ thuế do có đơn vị hạch toán phụ thuộc tại địa bàn cấp tỉnh khác nơi có trụ sở chính: [ ]',
  'Tổng số người lao động: [16] Người 4', '2 Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20] [18] Người 0',
  '3 Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân [21]=[22]+[23] [21] VNĐ 90.000.000',
  '4.1 Thu nhập miễn thuế, thu nhập cá nhân theo nghị quyết [25.1] VNĐ 0',
  'Tôi cam đoan số liệu khai trên là đúng',
]])
kiem('loại + kỳ', [tncn.tk.loai, tncn.tk.maKy], ['05/KK-TNCN', 'Q2.2026'])
kiem('đơn vị Người / VNĐ trước số', [tncn.tk.chiTieu['16'], tncn.tk.chiTieu['18'], tncn.tk.chiTieu['21']], [4, 0, 90000000])
kiem('mã [25.1] → 25_1 như XML', tncn.tk.chiTieu['25_1'], 0)
kiem('ô đánh dấu [15] ở phần đầu tờ khai = 0', tncn.tk.chiTieu['15'], 0)

console.log('\nKhông phải tờ khai / không đọc được:')
kiem('thông báo chấp nhận 01-2/TB-TĐT', docToKhaiPdfChu([['Mẫu số: 01-2/TB-TĐT', 'THÔNG BÁO', 'V/v: Chấp nhận việc nộp hồ sơ khai thuế điện tử', '- Tên tờ khai/Phụ lục: TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG Mẫu số 01/GTGT (TT80/2021)', '- Kỳ tính thuế: Q3/2026']]).khongPhai, true)
kiem('PDF ảnh scan (không có chữ)', docToKhaiPdfChu([[], []]).scan, true)
kiem('PDF có chữ nhưng không phải tờ khai', docToKhaiPdfChu([['Hợp đồng dịch vụ kế toán', 'Điều 1']]).ok, false)
kiem('kỳ "Năm 2025"', kyTuChu('Năm 2025'), { loai: 'N', so: 0, nam: 2025 })
kiem('ô đánh dấu có X = 1', chiTieuTrenDong('A Không phát sinh hoạt động mua, bán trong kỳ [21] [X]'), { 21: 1 })

console.log('\nGom mẩu chữ thành dòng:')
const it = (s, x, y) => ({ str: s, transform: [1, 0, 0, 1, x, y] })
kiem('cùng dòng (lệch ≤ 2 điểm), sắp trái → phải, trên → dưới', gomDong([it('[24] 5', 300, 700.5), it('[23] 1', 100, 701), it('Dòng sau', 50, 680), it(' ', 10, 690)]), ['[23] 1 [24] 5', 'Dòng sau'])

console.log('\nChọn PDF nào cần đọc (docHoSo):')
const tep = (ten, duongDan, noiDung = '') => ({ ten, duongDan, duoi: ten.split('.').pop().toLowerCase(), co: 10, sua: 1,
  tay: { getFile: async () => ({ text: async () => noiDung, arrayBuffer: async () => new TextEncoder().encode(noiDung).buffer }) } })
const dd = ['CTY', '2026', '7. BỘ BÁO CÁO', 'BCT', 'Q2']
const quet = { boBaoCao: { ky: [{ ky: { ma: 'Q2' }, vung: {
  to_khai: [tep('01GTGT.xml', [...dd, 'TỜ KHAI'], '<x/>'), tep('01GTGT.pdf', [...dd, 'TỜ KHAI'], 'pdf-co-xml'), tep('05KK.pdf', [...dd, 'TỜ KHAI'], 'pdf-tncn')],
  thong_bao: [tep('TBCN.pdf', [...dd, 'TB'], 'tb')], bang_ke: [tep('BK.pdf', [...dd, 'BK'], 'bk')],
} }], khongRo: [] } }
kiem('bỏ PDF có XML cùng tên, bỏ thư mục thông báo / bảng kê', tepPdfCuaNam(quet).map(t => t.ten), ['05KK.pdf'])
const docPdfGia = async buf => (new TextDecoder().decode(buf) === 'pdf-tncn'
  ? { ok: true, tk: { loai: '05/KK-TNCN', ky: { loai: 'Q', so: 2, nam: 2026 }, maKy: 'Q2.2026', lanBoSung: 0, chiTieu: {} } } : { ok: false, scan: true })
const kq = await docToKhaiCuaNam(quet, { docPdf: docPdfGia })
kiem('tờ khai từ PDF có nguồn "pdf"', kq.toKhai.map(t => [t.loai, t.nguon]), [['05/KK-TNCN', 'pdf']])
const quet2 = { boBaoCao: { ky: [{ ky: { ma: 'Q2' }, vung: { to_khai: [tep('A.pdf', dd, 'pdf-tncn')], goc: [tep('B.pdf', dd, 'scan')] } }], khongRo: [] } }
const kq2 = await docToKhaiCuaNam(quet2, { docPdf: docPdfGia })
kiem('PDF ảnh scan xếp riêng, không tính là lỗi', [kq2.toKhai.length, kq2.scan.map(t => t.ten), kq2.loi.length], [1, ['B.pdf'], 0])

console.log('\nĐi trọn đường: dựng PDF có chữ tiếng Việt bằng pdf-lib rồi đọc lại qua pdfjs:')
const FONT = 'C:/Windows/Fonts/arial.ttf'
if (!fs.existsSync(FONT)) console.log('  (bỏ qua — máy không có font Arial)')
else {
  const { PDFDocument } = await import('pdf-lib')
  const fontkit = (await import('@pdf-lib/fontkit')).default
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fs.readFileSync(FONT), { subset: true })
  for (const dongTrang of GTGT('Quý 1 năm 2026').slice(0, 2)) {
    const pg = pdf.addPage([595, 842])
    dongTrang.forEach((d, i) => pg.drawText(d, { x: 30, y: 800 - i * 16, size: 8, font }))
  }
  const trang = await layDongPdf(await pdf.save(), { pdfjs })
  const kqPdf = docToKhaiPdfChu(trang)
  kiem('đọc lại đúng loại, kỳ, [22], [36], [43]', [kqPdf.tk?.loai, kqPdf.tk?.maKy, kqPdf.tk?.chiTieu['22'], kqPdf.tk?.chiTieu['36'], kqPdf.tk?.chiTieu['43']],
    ['01/GTGT', 'Q1.2026', 12345678, -10000000, 22345678])
}

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
