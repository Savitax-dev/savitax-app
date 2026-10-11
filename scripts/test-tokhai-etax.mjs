// Kiểm bộ đọc bảng "Tra cứu hồ sơ đã nộp trên thuế điện tử" (hồ sơ trước 01/07/2025).
//   node scripts/test-tokhai-etax.mjs
//
// Vì sao phải có bộ kiểm riêng: bảng này ĐẢO THỨ TỰ hai cột so với bảng đang dùng — 'Lần nộp'
// đứng TRƯỚC 'Lần bổ sung'. Đọc nhầm chỉ số thì số lần bổ sung sai, kéo theo đặt sai tên thư mục
// _BSLn và tên file — sai lặng lẽ, chỉ lộ khi kế toán mở thư mục khách đi tìm.
//
// HTML dưới đây dựng lại theo đúng bảng anh chụp ngày 11/10/2026 (3 bản ghi của PAPER ART VIỆT).
import { docBangKetQuaEtax, doanLoaiToKhaiTuTen } from '../lib/dvcPortal.js'
import { chuanHoaKy } from '../lib/taxDeadline.js'

let dat = 0, hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  if (a === b) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log(`  ✗ ${ten}\n      ra      ${a}\n      đáng lẽ ${b}`) }
}

const dong = (ma, ten, ky, loai, lanNop, lanBS, ngay, noi, trangThai) =>
  `<tr><td>1</td><td>${ma}</td><td>${ten}</td><td>${ky}</td><td>${loai}</td>`
  + `<td>${lanNop}</td><td>${lanBS}</td><td>${ngay}</td><td>${noi}</td><td>${trangThai}</td>`
  + '<td><a href="#">Xem chi tiết</a></td></tr>'

const HTML = '<table><thead><tr><th>STT</th><th>Mã giao dịch</th></tr></thead><tbody>'
  + dong('11320250319013481', 'Tờ khai khấu trừ thuế thu nhập cá nhân (TT80)', 'Q1/2025',
         'Chính thức', '1', '0', '28/04/2025 10:42:35', 'Thuế cơ sở 13 Thành phố Hồ Chí Minh',
         'Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử của NNT')
  + dong('11320250319012612', 'TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (TT80/2021)', 'Q1/2025',
         'Chính thức', '1', '0', '28/04/2025 10:42:17', 'Thuế cơ sở 13 Thành phố Hồ Chí Minh',
         'Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử của NNT')
  + dong('11220250313774713', 'Giấy đề nghị hoàn trả khoản thu ngân sách nhà nước', 'Q1/2025',
         'Chính thức', '2', '0', '08/04/2025 14:36:43', 'Thuế cơ sở 13 Thành phố Hồ Chí Minh',
         'Đã gửi tờ khai thành công đến CQT')
  + '</tbody></table><div>Trang 1/ 1 — Tổng số bản ghi: <span>3</span></div>'

console.log('\nĐọc bảng đúng như ảnh chụp:')
const { ds, tongCongBao } = docBangKetQuaEtax(HTML, { tuNgay: '01/04/2025', denNgay: '01/05/2025' })
kiem('đọc đủ 3 dòng', ds.length, 3)
kiem('cổng báo tổng 3 bản ghi', tongCongBao, 3)
kiem('mã giao dịch dòng 1', ds[0].maHoSo, '11320250319013481')
kiem('kỳ tính thuế', ds[0].kyTinhThue, 'Q1/2025')
// Giữ múi giờ Việt Nam +07:00 y như bảng tab DVC — hai nguồn phải ra cùng một dạng,
// lệch dạng là so sánh ngày nộp với hạn nộp sẽ lệch đúng 7 tiếng.
kiem('ngày nộp đổi sang ISO kèm múi giờ VN', ds[0].ngayNop, '2025-04-28T10:42:00+07:00')
kiem('đánh dấu nguồn là etax', ds[0].nguon, 'etax')

console.log('')
console.log('Hai cột ĐẢO THỨ TỰ so với bảng tab DVC:')
kiem('lần nộp đọc đúng (dòng 3 nộp lần 2)', ds[2].lanNop, 2)
kiem('lần bổ sung đọc đúng (0, không nhầm sang lần nộp)', ds[2].lanBoSung, 0)

console.log('')
console.log('Mã tờ khai để trống — phải lấy ở trang chi tiết:')
kiem('maToKhaiCong để null chứ không đoán', ds[0].maToKhaiCong, null)
kiem('giữ nguyên tên tờ khai để còn đối chiếu',
  ds[1].tenToKhai, 'TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (TT80/2021)')

console.log('')
console.log('Neo theo ô mã giao dịch, không đếm cột cứng:')
// Cổng thêm một cột vào đầu bảng → cách đếm cứng sẽ lệch hết, cách neo thì không.
const themCot = HTML.replace(/<tr><td>1<\/td>/g, '<tr><td>x</td><td>1</td>')
const r2 = docBangKetQuaEtax(themCot)
kiem('thêm một cột đầu vẫn đọc đúng 3 dòng', r2.ds.length, 3)
kiem('và vẫn đúng mã giao dịch', r2.ds[0].maHoSo, '11320250319013481')
kiem('và vẫn đúng lần nộp', r2.ds[2].lanNop, 2)

console.log('')
console.log('Không có gì thì đừng nổ:')
kiem('bảng rỗng → 0 dòng', docBangKetQuaEtax('<table></table>').ds.length, 0)
kiem('HTML rác → 0 dòng', docBangKetQuaEtax('xin lỗi, có lỗi xảy ra').ds.length, 0)

console.log('')
console.log('Đoán loại tờ khai từ TÊN (bảng tab cũ không có mã):')
// Tên lấy nguyên văn từ bảng thật của PAPER ART VIỆT, tháng 3/2025.
const doan = (ten, mong) => kiem(ten.slice(0, 44) + (ten.length > 44 ? '…' : ''), doanLoaiToKhaiTuTen(ten), mong)
doan('TỜ KHAI QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN (TT80/2021)', '05/QTT-TNCN')
doan('Tờ khai khấu trừ thuế thu nhập cá nhân (TT80)', '05/KK-TNCN')
doan('Tờ khai quyết toán thuế TNDN (TT80/2021)', '03/TNDN')
doan('Bộ báo cáo tài chính', 'BCTC')
doan('TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (TT80/2021)(00-Hoạt động sản xuất kinh doanh thông thường-)', '01/GTGT')

console.log('')
console.log('Thứ tự xét: quyết toán phải TRƯỚC khấu trừ (cả hai đều có "thu nhập cá nhân"):')
kiem('quyết toán TNCN không bị gán nhầm thành tờ khấu trừ',
  doanLoaiToKhaiTuTen('TỜ KHAI QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN (TT80/2021)') !== '05/KK-TNCN', true)

console.log('')
console.log('Giấy tờ KHÔNG có trong danh mục thì trả null, đừng gán bừa:')
doan('Giấy đề nghị hoàn trả khoản thu ngân sách nhà nước', null)
doan('Bảng tổng hợp đăng ký người phụ thuộc giảm trừ gia cảnh', null)
doan('Văn bản đề nghị hủy hồ sơ đề nghị hoàn thuế(11220250300583305-)', null)
kiem('tên rỗng → null, không nổ', doanLoaiToKhaiTuTen(''), null)
kiem('null → null, không nổ', doanLoaiToKhaiTuTen(null), null)

console.log('')
console.log('Kỳ tính thuế: cổng ghi quý có tiền tố, THÁNG để trần:')
// Ca thật 11/10/2026 (PAPER ART VIỆT): 'Văn bản đề nghị hủy hồ sơ hoàn thuế' kỳ 03/2025 bị đọc
// thành Q3.2025 vì chưa khớp loại tờ khai nên mặc định coi là quý.
kiem("'Q4/2024' → quý 4", chuanHoaKy('Q4/2024', 'month'), 'Q4.2024')
kiem("'2024' → năm", chuanHoaKy('2024', 'month'), 'NAM.2024')
kiem("'03/2025' chưa biết loại → THÁNG 3, không phải quý 3", chuanHoaKy('03/2025', 'month'), 'T03.2025')
kiem('loại tờ khai theo quý thì vẫn ra quý', chuanHoaKy('3/2025', 'quarter'), 'Q3.2025')

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
