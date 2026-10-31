// Kiểm phần đọc file máy chấm công (lib/luong/mayChamCong.js).
//   node scripts/test-luong-may-cham-cong.mjs                 — kiểm quy tắc quy đổi (không cần file)
//   node scripts/test-luong-may-cham-cong.mjs <file.xlsx>     — thêm đọc thử file thật (file để NGOÀI repo)
import { docBangMayChamCong, docFileMayChamCong, quyDoiMay, soThuBayLamViec } from '../lib/luong/mayChamCong.js'

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

console.log('\nMẫu "_XuLy" — HCNS đã xử lý (anh gửi 31/10/2026, từ T10/2026):')
// Tiêu đề 3 dòng như file thật: dòng 1 nhóm cột, dòng 2–3 tên cột con (ô gộp lặp lại chữ).
const XL = [
  ['CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX - Từ 01/10/2026 Đến 31/10/2026'],
  ['STT', 'Mã nhân viên', 'Họ và tên', 'Tổng công hưởng lương', 'Tổng công hưởng lương', 'Tổng công hưởng lương', 'Nghỉ phép', 'Nghỉ lễ', 'Nghỉ không lương', 'Loại nghỉ khác', 'Loại nghỉ khác', 'KPI', 'Tổng vi phạm', 'Tổng số lần đi muộn, về sớm', 'Tổng số lần không chấm công', 'Số tiền gây quỹ'],
  ['STT', '', 'Họ và tên', 'HC', 'Onl', 'Tổng', 'Nghỉ phép', 'Nghỉ lễ', 'Nghỉ không lương', 'Nghỉ thai sản', 'Nghỉ phép đột xuất Ban GĐ duyệt', 'KPI', 'Tổng vi phạm', 'Tổng số lần đi muộn, về sớm', 'Tổng số lần không chấm công', 'Số tiền gây quỹ'],
  ['STT', '', 'Họ và tên', 'HC', 'Onl', 'Tổng', 'Nghỉ phép', 'Nghỉ lễ', 'Nghỉ không lương', 'Nghỉ thai sản', 'Nghỉ phép đột xuất Ban GĐ duyệt', 'KPI', 'Tổng vi phạm', 'Tổng số lần đi muộn, về sớm', 'Tổng số lần không chấm công', 'Số tiền gây quỹ'],
  // Tổng đã gồm thứ Bảy + ngày phép: 25 + 1 = 26, phép 4 trong đó, KL 1 → 26 + 1 = 27 = công chuẩn T10
  ['1', 'NV30', 'Nhân viên A', '25', '1', '26', '4', '', '1', '', '', '1', '', '0', '0', ''],
  // Phép 1,5 đã gồm 1,5 đột xuất — KHÔNG cộng hai lần; vi phạm 3 muộn/sớm + 1 không chấm = 4
  ['2', 'NV17', 'Nhân viên B', '26', '1', '27', '1.5', '', '', '', '1.5', '0.2', '4', '3', '1', '80000'],
  // Ô Tổng là công thức mà file không giữ kết quả → tự cộng HC + Onl; Tổng vi phạm trống → lấy muộn/sớm + không chấm
  ['3', 'NV05', 'Nhân viên C', '', '27', '', '0', '', '0', '', '', '', '', '0', '2', ''],
  ['', 'Ngày ..... tháng ..... năm .....'],
]
const xl = docBangMayChamCong((r, c) => XL[r - 1]?.[c - 1] ?? '', XL.length, 16)
kiem('nhận ra mẫu _XuLy', xl.mau, 'xuly')
kiem('số dòng nhân viên', xl.dong?.length, 3)
const xa = quyDoiMay(xl.dong[0], 0, 'xuly'), xb = quyDoiMay(xl.dong[1], 0, 'xuly'), xc = quyDoiMay(xl.dong[2], 0, 'xuly')
kiem('A: đi làm = Tổng − phép = 22, phép 4, KL 1 (cộng lại đúng 27)', [xa.ngay_di_lam, xa.nghi_phep, xa.nghi_khong_luong], [22, 4, 1])
kiem('B: phép đột xuất đã nằm trong Nghỉ phép → phép 1,5 (không phải 3)', [xb.ngay_di_lam, xb.nghi_phep], [25.5, 1.5])
kiem('B: vi phạm = Tổng vi phạm = 4', xb.so_lan_vi_pham, 4)
kiem('C: Tổng trống → HC + Onl = 27; vi phạm trống → 0 + 2', [xc.ngay_di_lam, xc.so_lan_vi_pham], [27, 2])
kiem('mẫu _XuLy KHÔNG cộng thứ Bảy (máy chủ truyền 0)', quyDoiMay(xl.dong[0], 0, 'xuly').ngay_di_lam + 0, 22)
kiem('mẫu thô vẫn quy đổi như cũ', docBangMayChamCong((r, c) => BANG[r - 1]?.[c - 1] ?? '', BANG.length, 10).mau, 'tho')

console.log('\nChọn sheet trong file nhiều sheet:')
const sheetGia = (name, state, bang) => ({
  name, state, rowCount: bang.length, columnCount: 16,
  getRow: r => ({ getCell: c => ({ value: bang[r - 1]?.[c - 1] ?? null }) }),
})
const chon = docFileMayChamCong({ worksheets: [sheetGia('Bảng chấm công chi tiết_30.10', 'hidden', BANG), sheetGia('Bảng chấm công chi tiết_31.10', 'visible', BANG), sheetGia('Bảng chấm công chi tiết_XuLy', 'visible', XL), sheetGia('Phép', 'visible', [['x']])] })
kiem('lấy sheet _XuLy, bỏ sheet ẩn đứng đầu', [chon.sheet, chon.mau], ['Bảng chấm công chi tiết_XuLy', 'xuly'])
const chon2 = docFileMayChamCong({ worksheets: [sheetGia('Sheet1', 'hidden', XL), sheetGia('Bảng chấm công', 'visible', BANG)] })
kiem('không có sheet _XuLy → sheet đang hiện đọc được (bỏ sheet ẩn)', [chon2.sheet, chon2.mau], ['Bảng chấm công', 'tho'])
kiem('chỉ có sheet ẩn → báo lỗi', !!docFileMayChamCong({ worksheets: [sheetGia('A', 'hidden', XL)] }).loi, true)

const file = process.argv[2]
if (file) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file)
  const d = docFileMayChamCong(wb)
  if (d.loi) { hong++; console.log('\nĐỌC FILE LỖI: ' + d.loi) }
  else {
    const nam = Number(d.tuNgay.slice(0, 4)), thang = Number(d.tuNgay.slice(5, 7))
    const t7 = d.mau === 'xuly' ? 0 : soThuBayLamViec(nam, thang)
    // Công chuẩn không tính lễ (bộ kiểm không đọc DB) — tháng có lễ thì số "lệch" dưới đây là bình thường.
    let chuan = 0; for (let n = 1; n <= new Date(Date.UTC(nam, thang, 0)).getUTCDate(); n++) if (new Date(Date.UTC(nam, thang - 1, n)).getUTCDay() !== 0) chuan++
    console.log('\nFile thật: sheet "' + d.sheet + '" (mẫu ' + d.mau + ') · kỳ ' + d.tuNgay + ' → ' + d.denNgay + ' · ' + d.dong.length + ' dòng · thứ Bảy cộng thêm ' + t7 + ' · công chuẩn (chưa trừ lễ) ' + chuan)
    console.log('  cột nhận được: ' + Object.entries(d.cot).map(([k, c]) => k + '@' + c).join(' '))
    const loiSo = d.dong.filter(x => x.soLoi.length)
    kiem('không ô số nào đọc lỗi', loiSo.map(x => x.ma), [])
    for (const x of d.dong) {
      const v = quyDoiMay(x, t7, d.mau)
      const tong = Math.round((v.ngay_di_lam + v.nghi_phep + v.nghi_khong_luong) * 100) / 100
      console.log('  ' + x.ma.padEnd(6) + ' đi làm ' + String(v.ngay_di_lam).padStart(5) + ' · phép ' + String(v.nghi_phep).padStart(4) + ' · KL ' + String(v.nghi_khong_luong).padStart(4) + ' · vi phạm ' + v.so_lan_vi_pham + (tong !== chuan ? '   ← cộng ' + tong + ' ≠ ' + chuan : ''))
    }
  }
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
