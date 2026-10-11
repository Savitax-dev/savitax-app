// Kiểm bộ đọc bảng "Tra cứu hồ sơ đã nộp trên thuế điện tử" (hồ sơ trước 01/07/2025).
//   node scripts/test-tokhai-etax.mjs
//
// Vì sao phải có bộ kiểm riêng: bảng này ĐẢO THỨ TỰ hai cột so với bảng đang dùng — 'Lần nộp'
// đứng TRƯỚC 'Lần bổ sung'. Đọc nhầm chỉ số thì số lần bổ sung sai, kéo theo đặt sai tên thư mục
// _BSLn và tên file — sai lặng lẽ, chỉ lộ khi kế toán mở thư mục khách đi tìm.
//
// HTML dưới đây dựng lại theo đúng bảng anh chụp ngày 11/10/2026 (3 bản ghi của PAPER ART VIỆT).
import { docBangKetQuaEtax } from '../lib/dvcPortal.js'

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

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
