// Kiểm phần ngày công của phân hệ Tiền lương (lib/luong/ngayCong.js). Không đụng database.
//   node scripts/test-luong-ngay-cong.mjs
import { ngayCongChuan, kiemChamCong, luongCuaThang, thangDuocKhai, soNgayHopLe } from '../lib/luong/ngayCong.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

console.log('Ngày công chuẩn (trừ chủ nhật + lễ, thứ Bảy đủ công):')
kiem('T10/2026: 31 ngày, 4 CN', ngayCongChuan(2026, 10).chuan, 27)
kiem('T2/2026: 28 ngày, 4 CN', ngayCongChuan(2026, 2).chuan, 24)
kiem('T2/2028 năm nhuận: 29 ngày, 4 CN', ngayCongChuan(2028, 2).chuan, 25)
kiem('T9/2026 có Quốc khánh 02/09 (thứ Tư)', ngayCongChuan(2026, 9, ['2026-09-02']).chuan, 25)
kiem('T5/2026: 31 ngày − 5 CN − lễ 01/05 (30/04 thuộc tháng trước)', ngayCongChuan(2026, 5, ['2026-04-30', '2026-05-01']).chuan, 25)
kiem('Lễ rơi vào chủ nhật không trừ hai lần (26/04/2026 là CN)', ngayCongChuan(2026, 4, ['2026-04-26']).chuan, ngayCongChuan(2026, 4).chuan)

console.log('\nKiểm bảng công:')
kiem('đủ công', kiemChamCong({ ngay_di_lam: 25, nghi_phep: 1, nghi_khong_luong: 1 }, 27, { xacNhan: true }).tinhLuong, 26)
kiem('vượt chuẩn bị chặn', !!kiemChamCong({ ngay_di_lam: 27, nghi_phep: 1, nghi_khong_luong: 0 }, 27).loi, true)
kiem('thiếu công: lưu nháp được, có cảnh báo', !!kiemChamCong({ ngay_di_lam: 10, nghi_phep: 0, nghi_khong_luong: 0 }, 27).canhBao, true)
kiem('thiếu công: xác nhận phải có ghi chú', !!kiemChamCong({ ngay_di_lam: 10, nghi_phep: 0, nghi_khong_luong: 0 }, 27, { xacNhan: true }).loi, true)
kiem('thiếu công có ghi chú thì xác nhận được', !kiemChamCong({ ngay_di_lam: 10, nghi_phep: 0, nghi_khong_luong: 0, ghi_chu: 'vào làm từ 15/10' }, 27, { xacNhan: true }).loi, true)
kiem('nửa ngày hợp lệ', soNgayHopLe(25.5), true)
kiem('0,3 ngày không hợp lệ', soNgayHopLe(0.3), false)
kiem('số âm không hợp lệ', !!kiemChamCong({ ngay_di_lam: -1, nghi_phep: 0, nghi_khong_luong: 0 }, 27).loi, true)

console.log('\nLương theo tháng (lịch sử):')
const ls = [
  { ap_dung_tu: '2026-01-01', luong_co_ban: 7000000 },
  { ap_dung_tu: '2026-07-01', luong_co_ban: 7700000 },
  { ap_dung_tu: '2026-11-01', luong_co_ban: 8470000 },
]
kiem('T6 dùng mức từ 01/2026', luongCuaThang(ls, 2026, 6).luong_co_ban, 7000000)
kiem('T7 dùng mức mới đúng tháng áp dụng', luongCuaThang(ls, 2026, 7).luong_co_ban, 7700000)
kiem('T10 chưa tới mức 11/2026', luongCuaThang(ls, 2026, 10).luong_co_ban, 7700000)
kiem('trước mọi mức → chưa có lương', luongCuaThang(ls, 2025, 12), null)

console.log('\nTháng được tự khai:')
kiem('ngày 05/01/2027 → T1/2027 và T12/2026', thangDuocKhai(new Date('2027-01-05T03:00:00Z')), [{ nam: 2027, thang: 1 }, { nam: 2026, thang: 12 }])
kiem('23h ngày 31/10 giờ VN vẫn là T10', thangDuocKhai(new Date('2026-10-31T16:30:00Z'))[0], { nam: 2026, thang: 10 })

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
