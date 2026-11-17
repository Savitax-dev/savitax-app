// Phân hệ Pháp lý — dựng BỘ DUYỆT mẫu Word cho chuyên viên pháp lý: mỗi loại hình một PDF gồm
//   tờ Hướng dẫn in + ký đợt 1 → các giấy đợt 1 → tờ Hướng dẫn đợt 2 → các giấy đợt 2 (điền DỮ LIỆU GIẢ),
// đúng thứ tự in. Cần Microsoft Word trên máy (đổi PDF).
//   node scripts/phaply-mau-word-cho-duyet.mjs   → data/phaply/mau-word-cho-duyet/Bo-mau-<1TV|2TV|CP>.pdf
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { dongGoi } from '../lib/phaply/word/khung.js'
import { mauCuaBo } from '../lib/phaply/word/danhMuc.js'
import { chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { dienMau } from '../lib/phaply/word/xuat.js'
import { nguonHuongDanInKy } from '../lib/phaply/word/huongDanInKy.js'
import { DU_LIEU_GIA } from './phaply-du-lieu-gia.mjs'

const RA = 'data/phaply/mau-word-cho-duyet'
const TAM = join(tmpdir(), 'phaply-bo-duyet')
rmSync(TAM, { recursive: true, force: true }); mkdirSync(TAM, { recursive: true }); mkdirSync(RA, { recursive: true })

const thuTu = {}
for (const lh of ['1tv', '2tv', 'cp']) {
  const duLieu = chuanBiDuLieu(DU_LIEU_GIA[lh])
  const ds = []
  for (const dot of ['so', 'thue']) {
    ds.push({ ten: `HD_${dot}`, buf: dongGoi(nguonHuongDanInKy(dot, lh, { tenCty: duLieu.ten_cty })) })
    for (const m of mauCuaBo(dot, lh)) ds.push({ ten: m.ma, buf: dienMau(dongGoi(readFileSync(`lib/phaply/word/nguon/${m.ma}.txt`, 'utf8')), duLieu) })
  }
  thuTu[lh] = ds.map((d, i) => { const f = `${lh}_${String(i + 1).padStart(2, '0')}_${d.ten}`; writeFileSync(join(TAM, f + '.docx'), d.buf); return f })
}
const kq = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/phaply-word-sang-pdf.ps1', TAM], { encoding: 'utf8' })
const loi = kq.split(/\r?\n/).filter(d => d.startsWith('LOI'))
if (loi.length) { console.log(loi.join('\n')); process.exit(1) }

for (const [lh, ds] of Object.entries(thuTu)) {
  const bo = await PDFDocument.create()
  for (const f of ds) {
    const pdf = await PDFDocument.load(readFileSync(join(TAM, f + '.pdf')))
    for (const tr of await bo.copyPages(pdf, pdf.getPageIndices())) bo.addPage(tr)
  }
  bo.setTitle(`Bộ mẫu Word thành lập mới ${lh.toUpperCase()} (dữ liệu giả)`); bo.setAuthor('Savitax')
  const duong = `${RA}/Bo-mau-${lh.toUpperCase()}.pdf`
  writeFileSync(duong, await bo.save())
  console.log('→', duong, bo.getPageCount(), 'trang')
}
console.log(readdirSync(TAM).filter(f => f.endsWith('.pdf')).length, 'file PDF thành phần ở', TAM)

// ─── Quyết định của pháp lý (file Can-chot-mau-Word_NGOCNHN_TRAMBTTT.xlsx, 17/11/2026) + việc đã làm trong mẫu ───
const DA_CHOT = [
  ['Mẫu 6, Mẫu 7', 'Thông tư ghi trên mẫu', 'Vẫn áp dụng TT 68/2025, không bị TT 121/2026 điều chỉnh', 'Giữ TT 68/2025'],
  ['Mẫu 08-MST', 'Bản 2TV và CP khác chữ', 'Theo bản CP', 'Đã theo bản CP'],
  ['Mẫu 08-MST', '1TV có cần 08-MST', 'Cả 3 loại hình đều cần', 'Đã đưa 08-MST vào bộ 1TV'],
  ['Đăng ký sổ sách kế toán', 'TT 200/2014 hay 99/2025', 'TT 99/2025 cho cả 3 loại hình', 'Đã dùng TT 99/2025'],
  ['QĐ bổ nhiệm GĐ (HĐTV)', 'Tên dưới chữ ký Chủ tịch HĐTV', 'In tên Chủ tịch HĐTV', 'Đã in tên Chủ tịch'],
  ['QĐ bổ nhiệm GĐ (1TV)', 'Ai ký', 'Chủ sở hữu ký', 'Đã để Chủ sở hữu ký'],
  ['Biên bản họp HĐTV / HĐQT', 'Giám đốc thuê ngoài', 'Sửa: "… lấy ý kiến của các thành viên dự họp về việc bổ nhiệm […] giữ chức vụ Giám đốc Công ty"', 'Đã sửa cả 2 biên bản (bỏ "là thành viên góp vốn / cổ đông sáng lập")'],
  ['Giấy ủy quyền nộp Sở', 'Gộp mẫu, địa chỉ', 'Gộp 1 mẫu, KHÔNG có địa chỉ; câu nộp hồ sơ đổi theo TNHH / CP', 'Đã bỏ địa chỉ người ủy quyền; "thành lập mới công ty TNHH / cổ phần"'],
  ['Giấy ủy quyền thuế', 'Theo bản nào', 'Theo bản 1TV cho cả 3, thêm "- Nộp hồ sơ pháp lý ban đầu"', 'Đã soạn lại theo bản 1TV + thêm nội dung'],
  ['Giấy giới thiệu, Khấu hao, Sổ sách, Ủy quyền thuế', '"Kính gửi", MST', 'Để trống; khách khó tính đòi điền đủ sau khi có GPKD thì điền', 'Mặc định để chấm viết tay; hồ sơ bật "Điền sẵn MST + cơ quan thuế" thì in sẵn'],
  ['Mẫu 6, 7, 10', 'Cột Quốc tịch, Dân tộc', 'Căn cước → để trống; hộ chiếu / giấy tờ khác → điền', 'Đã làm theo loại giấy tờ của từng người'],
  ['Mẫu 2', 'Ô "Mô hình tổ chức công ty"', 'Chỉ đánh dấu khi chủ sở hữu là tổ chức', 'Chủ sở hữu cá nhân: không đánh dấu'],
  ['Mẫu 2/3/4', 'Đất biên giới, hiển thị ngoại tệ', 'Cố định "Không"', 'Giữ "Không"'],
  ['Mẫu 4', 'Câu cam kết nhà đầu tư nước ngoài', 'Bỏ khi không có NĐT nước ngoài', 'Chỉ in khi hồ sơ có NĐT nước ngoài'],
  ['Điều lệ 2TV', 'Thứ tự ký', 'Theo thứ tự bảng thành viên', 'Giữ'],
  ['Điều lệ, Mẫu 2/3', 'Lỗi chính tả', '(anh duyệt 06/11)', 'Đã sửa'],
  ['Mẫu 2/3/4', '"đăng công bố"', 'Giữ nguyên', 'Giữ'],
  ['Điều lệ CP', 'Điều 25 điểm đ, Điều 1 khoản 3', 'Dẫn chiếu "khoản 1, 2 Điều 19"; "Giấy chứng nhận đăng ký doanh nghiệp"', 'Đã sửa'],
  ['Điều lệ 2TV', 'Điều 5', 'Đổi thuật ngữ (pháp lý ghi "đăng ký kinh doanh nghiệp" — em hiểu là "đăng ký doanh nghiệp")', 'Đã sửa thành "Giấy chứng nhận đăng ký doanh nghiệp"'],
  ['Giấy ủy quyền nộp Sở, Mẫu 2', 'Tên Phòng ĐKKD không cố định theo tỉnh', 'Ghi đúng tên phòng của từng tỉnh (kiểm trên dangkykinhdoanh.gov.vn)', 'Danh mục có cột tên ghi hồ sơ "<tên phòng> <tỉnh>", VD "Phòng Đăng ký kinh doanh Thành phố Hồ Chí Minh"; app tự lấy theo tỉnh trụ sở'],
]
const CON_CHO = [
  ['Điều lệ 1TV', 'Cần bản cho mô hình Hội đồng thành viên (chủ sở hữu là tổ chức)', 'Chưa có bản đã nộp để chép — nhờ pháp lý gửi 1 điều lệ mẫu (hoặc hồ sơ đã nộp) theo mô hình này'],
  ['Điều lệ (cả 3)', 'Bản công ty có NHIỀU người đại diện theo pháp luật', 'Nhờ pháp lý gửi 1 điều lệ đã nộp có nhiều người đại diện (phân chia quyền giữa các người đại diện)'],
]
const { soExcelMoi, themSheetMang } = await import('../lib/excelDep.js')
const wb = await soExcelMoi()
themSheetMang(wb, 'Đã chốt', [
  ['MẪU WORD THÀNH LẬP MỚI — QUYẾT ĐỊNH CỦA PHÁP LÝ (17/11/2026) VÀ VIỆC ĐÃ LÀM'],
  ['Mẫu đã sửa theo từng quyết định; bộ PDF Bo-mau-*.pdf cùng thư mục là bản sau khi sửa (dữ liệu giả).'],
  ['STT', 'Mẫu', 'Nội dung', 'Pháp lý chốt', 'Đã làm trong mẫu'],
  ...DA_CHOT.map((d, i) => [i + 1, ...d]),
], { doRong: [6, 26, 30, 50, 50] })
themSheetMang(wb, 'Còn chờ', [
  ['CÒN CHỜ PHÁP LÝ'],
  ['STT', 'Mẫu', 'Việc', 'Cần pháp lý gửi'],
  ...CON_CHO.map((d, i) => [i + 1, ...d]),
], { doRong: [6, 22, 50, 60] })
await wb.xlsx.writeFile(`${RA}/Can-chot-mau-Word.xlsx`)
console.log('→', `${RA}/Can-chot-mau-Word.xlsx`, DA_CHOT.length, 'đã chốt,', CON_CHO.length, 'còn chờ')
