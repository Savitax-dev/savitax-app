// Kiểm phần đọc file máy chấm công (lib/luong/mayChamCong.js).
//   node scripts/test-luong-may-cham-cong.mjs                 — kiểm quy tắc quy đổi (không cần file)
//   node scripts/test-luong-may-cham-cong.mjs <file.xlsx>     — thêm đọc thử file thật (file để NGOÀI repo)
import { docBangMayChamCong, quyDoiMay, soThuBayLamViec } from '../lib/luong/mayChamCong.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

console.log('Thứ Bảy làm việc:')
kiem('T10/2026 có 5 thứ Bảy', soThuBayLamViec(2026, 10), 5)
kiem('thứ Bảy trùng lễ không tính (02/05/2026 không phải T7 → vẫn 5)', soThuBayLamViec(2026, 5, ['2026-05-01']), 5)
kiem('T7 25/04/2026 là lễ giả định → còn 3', soThuBayLamViec(2026, 4, ['2026-04-25']), 3)

console.log('\nQuy đổi một dòng (anh chốt 23/10/2026):')
const q = quyDoiMay({ hc: 15.38, congTac: 1, phep: 0, dotXuat: 1, le: 0, khongLuong: 1.62, thaiSan: 0, muonLan: 2, somLan: 1, muonPhut: 13, somPhut: 5 }, 5)
kiem('ngày đi làm = HC + công tác + thứ Bảy', q.ngay_di_lam, 21.38)
kiem('nghỉ phép = phép + đột xuất BGĐ duyệt', q.nghi_phep, 1)
kiem('nghỉ không lương = KL + thai sản', quyDoiMay({ hc: 0, congTac: 0, phep: 0, dotXuat: 0, le: 0, khongLuong: 3, thaiSan: 13, muonLan: 0, somLan: 0, muonPhut: 0, somPhut: 0 }, 5).nghi_khong_luong, 16)
kiem('vi phạm = lần đi muộn + lần về sớm', q.so_lan_vi_pham, 3)

console.log('\nĐọc bảng giả lập (tiêu đề 3 dòng gộp, cột xáo thứ tự):')
const BANG = [
  ['CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX - Từ 01/10/2026 Đến 31/10/2026'],
  ['STT', 'Mã nhân viên', 'Họ và tên', 'Tổng công hưởng lương', 'Nghỉ phép', 'Công tác', 'Nghỉ không lương', 'Loại nghỉ khác', 'Loại nghỉ khác', 'Tổng số lần đi muộn'],
  ['STT', 'Mã nhân viên', 'Họ và tên', 'HC', 'Nghỉ phép', 'Công tác', 'Nghỉ không lương', 'Nghỉ thai sản', 'Nghỉ phép đột xuất Ban GĐ duyệt', 'Tổng số lần đi muộn'],
  ['1', 'NV04', 'Nguyễn  Văn A', '16', '', '', '1', '', '1', '2'],
  ['2', '', '', '', '', '', '', '', '', ''],
  ['', 'Người lập biểu', '', '', '', '', '', '', '', ''],
]
const kq = docBangMayChamCong((r, c) => BANG[r - 1]?.[c - 1] ?? '', BANG.length, 10)
kiem('đọc kỳ', [kq.tuNgay, kq.denNgay], ['2026-10-01', '2026-10-31'])
kiem('số dòng nhân viên (bỏ dòng trống + dòng chữ ký)', kq.dong?.length, 1)
kiem('dòng 1', kq.dong?.[0] && [kq.dong[0].ma, kq.dong[0].ten, kq.dong[0].hc, kq.dong[0].dotXuat, kq.dong[0].phep, kq.dong[0].muonLan], ['NV04', 'Nguyễn Văn A', 16, 1, 0, 2])
kiem('thiếu cột → báo lỗi', !!docBangMayChamCong((r, c) => [['Mã nhân viên', 'Họ và tên']][r - 1]?.[c - 1] ?? '', 1, 2).loi, true)

const file = process.argv[2]
if (file) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file)
  const ws = wb.worksheets[0]
  const txt = v => v == null ? '' : typeof v === 'object' ? (v.richText ? v.richText.map(t => t.text).join('') : String(v.result ?? v.text ?? '')) : String(v)
  const d = docBangMayChamCong((r, c) => txt(ws.getRow(r).getCell(c).value), ws.rowCount, ws.columnCount)
  if (d.loi) { hong++; console.log('\nĐỌC FILE LỖI: ' + d.loi) }
  else {
    const t7 = soThuBayLamViec(Number(d.tuNgay.slice(0, 4)), Number(d.tuNgay.slice(5, 7)))
    console.log('\nFile thật: kỳ ' + d.tuNgay + ' → ' + d.denNgay + ' · ' + d.dong.length + ' dòng · thứ Bảy cộng thêm ' + t7)
    console.log('  cột nhận được: ' + Object.entries(d.cot).map(([k, c]) => k + '@' + c).join(' '))
    const loiSo = d.dong.filter(x => x.soLoi.length)
    kiem('không ô số nào đọc lỗi', loiSo.map(x => x.ma), [])
    for (const x of d.dong.slice(0, 5)) {
      const v = quyDoiMay(x, t7)
      console.log('  ' + x.ma.padEnd(6) + ' đi làm ' + v.ngay_di_lam + ' · phép ' + v.nghi_phep + ' · KL ' + v.nghi_khong_luong + ' · vi phạm ' + v.so_lan_vi_pham)
    }
  }
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
