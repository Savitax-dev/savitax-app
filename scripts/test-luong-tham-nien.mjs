// Kiểm thâm niên + cấp theo thâm niên (lib/luong/thamNien.js). Không đụng database.
//   node scripts/test-luong-tham-nien.mjs
import { soThangThamNien, chuThamNien, tranCuaCap, capTheoThamNien, soSanhCap } from '../lib/luong/thamNien.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}
// Bảng cấp đúng như trên app (mô tả anh nhập 14/10/2026).
const CAP = [
  ['CAP_1', 'Cấp 1', 'Dưới 2 tháng'], ['CAP_2', 'Cấp 2', 'Dưới 6 tháng'], ['CAP_3', 'Cấp 3', 'Trên 6 tháng – dưới 1 năm'],
  ['CAP_4', 'Cấp 4', 'Trên 1 năm – dưới 2 năm'], ['CAP_5', 'Cấp 5', 'Trên 2 năm – dưới 3 năm'], ['CAP_6', 'Cấp 6', 'Trên 3 năm – dưới 4 năm'],
  ['CAP_7', 'Cấp 7', 'Trên 4 năm – dưới 5 năm'], ['CAP_8', 'Cấp 8', 'Trên 5 năm – dưới 6 năm'],
].map(([ma, ten, mo_ta], i) => ({ ma, ten, mo_ta, nhom: 'nhan_vien', thu_tu: i + 1 }))
  .concat([{ ma: 'CAP_A', ten: 'Cấp A', mo_ta: 'Trưởng phòng', nhom: 'truong_phong', thu_tu: 9 }])

console.log('Số tháng thâm niên:')
kiem('15/03/2024 → 23/10/2026 = 31 tháng', soThangThamNien('2024-03-15', '2026-10-23'), 31)
kiem('chưa đủ ngày trong tháng: 25/03 → 23/10 = 6', soThangThamNien('2026-03-25', '2026-10-23'), 6)
kiem('vào làm sau ngày xét → 0', soThangThamNien('2026-11-01', '2026-10-23'), 0)
kiem('chữ: 31 tháng = 2 năm 7 tháng', chuThamNien(31), '2 năm 7 tháng')
kiem('chữ: 24 tháng = 2 năm', chuThamNien(24), '2 năm')
kiem('chữ: 5 tháng', chuThamNien(5), '5 tháng')

console.log('\nĐọc mốc từ mô tả cấp:')
kiem('"Dưới 2 tháng" → 2', tranCuaCap('Dưới 2 tháng'), 2)
kiem('"Trên 1 năm – dưới 2 năm" → 24', tranCuaCap('Trên 1 năm – dưới 2 năm'), 24)
kiem('"Trưởng phòng" → không trần', tranCuaCap('Trưởng phòng'), null)

console.log('\nCấp đúng theo thâm niên:')
kiem('vào 15/01, xét 10/02 → Cấp 1, đủ 2 tháng (15/03) lên Cấp 2', [capTheoThamNien(CAP, '2026-01-15', '2026-02-10').dung.ten, capTheoThamNien(CAP, '2026-01-15', '2026-02-10').ngayLenCap], ['Cấp 1', '2026-03-15'])
kiem('31 tháng → Cấp 5, lên Cấp 6 ngày 15/03/2027', [capTheoThamNien(CAP, '2024-03-15', '2026-10-23').dung.ten, capTheoThamNien(CAP, '2024-03-15', '2026-10-23').ke.ten, capTheoThamNien(CAP, '2024-03-15', '2026-10-23').ngayLenCap], ['Cấp 5', 'Cấp 6', '2027-03-15'])
kiem('8 năm → vẫn Cấp 8 (cao nhất), không mốc kế', [capTheoThamNien(CAP, '2018-01-01', '2026-10-23').dung.ten, capTheoThamNien(CAP, '2018-01-01', '2026-10-23').ke], ['Cấp 8', null])
kiem('vào 31/01 → mốc lên Cấp 2 là 31/03', capTheoThamNien(CAP, '2026-01-31', '2026-02-01').ngayLenCap, '2026-03-31')

console.log('\nSo với cấp hiện tại:')
kiem('31 tháng đang Cấp 3 → đến hạn lên cấp', soSanhCap(CAP, 'CAP_3', '2024-03-15', '2026-10-23').tt, 'den_han')
kiem('31 tháng đang Cấp 5 → đúng', soSanhCap(CAP, 'CAP_5', '2024-03-15', '2026-10-23').tt, 'dung')
kiem('31 tháng đang Cấp 7 → cao hơn thâm niên', soSanhCap(CAP, 'CAP_7', '2024-03-15', '2026-10-23').tt, 'cao_hon')
kiem('trưởng phòng → không xét', soSanhCap(CAP, 'CAP_A', '2024-03-15', '2026-10-23').tt, 'truong_phong')
kiem('chưa có ngày vào làm', soSanhCap(CAP, 'CAP_3', null, '2026-10-23').tt, 'chua_ngay')

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
