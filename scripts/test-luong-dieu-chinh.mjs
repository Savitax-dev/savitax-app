// Kiểm phụ cấp / điều chỉnh NHIỀU DÒNG (lib/luong/dieuChinh.js, sql/47 — anh yêu cầu 02/11/2026).
//   node scripts/test-luong-dieu-chinh.mjs                                  — chỉ quy tắc, không đụng database
//   node --env-file=.env.local scripts/test-luong-dieu-chinh.mjs --that     — thêm: bảng lương thật T10 đọc được khoản cũ (chỉ đọc)
import { chuanHoaDong, dongCuaBanGhi, vanBanLyDo } from '../lib/luong/dieuChinh.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

console.log('Cộng nhiều khoản:')
const kq = chuanHoaDong([
  { loai: 'phu_cap', so_tien: 500000, noi_dung: 'Phụ cấp xăng xe' },
  { loai: 'phu_cap', so_tien: 300000, noi_dung: 'Phụ cấp điện thoại' },
  { loai: 'dieu_chinh', so_tien: -200000, noi_dung: 'Truy thu BHXH T9' },
  { loai: 'dieu_chinh', so_tien: 1000000, noi_dung: 'Bù lương T9 thiếu công' },
  { loai: 'phu_cap', so_tien: 0, noi_dung: '' },   // dòng trống bị bỏ
], [], 'nv-a', '2026-11-02T10:00:00Z')
kiem('không lỗi', kq.loi, undefined)
kiem('4 khoản (bỏ dòng trống)', kq.dong.length, 4)
kiem('tổng phụ cấp 800.000', kq.phuCap, 800000)
kiem('tổng điều chỉnh +800.000', kq.dieuChinh, 800000)
kiem('lý do gộp', kq.lyDo, '+500.000 Phụ cấp xăng xe; +300.000 Phụ cấp điện thoại; −200.000 Truy thu BHXH T9; +1.000.000 Bù lương T9 thiếu công')
kiem('ghi người nhập', kq.dong.every(d => d.nguoi === 'nv-a'), true)

console.log('\nChặn nhập sai:')
kiem('thiếu nội dung', !!chuanHoaDong([{ loai: 'phu_cap', so_tien: 500000, noi_dung: ' ' }], [], 'a', 't').loi, true)
kiem('thiếu số tiền', !!chuanHoaDong([{ loai: 'phu_cap', so_tien: 0, noi_dung: 'Xăng xe' }], [], 'a', 't').loi, true)
kiem('phụ cấp âm', !!chuanHoaDong([{ loai: 'phu_cap', so_tien: -5, noi_dung: 'Xăng xe' }], [], 'a', 't').loi, true)
kiem('loại lạ', !!chuanHoaDong([{ loai: 'thuong', so_tien: 5, noi_dung: 'Xăng xe' }], [], 'a', 't').loi, true)
kiem('quá 1 tỉ', !!chuanHoaDong([{ loai: 'dieu_chinh', so_tien: 2e9, noi_dung: 'Xăng xe' }], [], 'a', 't').loi, true)
const rong = chuanHoaDong([], [], 'a', 't')
kiem('xoá hết → tổng 0, lý do rỗng', [rong.phuCap, rong.dieuChinh, rong.lyDo, rong.dong.length], [0, 0, null, 0])

console.log('\nGiữ người nhập của khoản không sửa:')
const lan2 = chuanHoaDong([
  { id: kq.dong[0].id, loai: 'phu_cap', so_tien: 500000, noi_dung: 'Phụ cấp xăng xe' },     // giữ nguyên
  { id: kq.dong[1].id, loai: 'phu_cap', so_tien: 350000, noi_dung: 'Phụ cấp điện thoại' },  // sửa số
  { loai: 'phu_cap', so_tien: 100000, noi_dung: 'Ăn trưa' },                                 // mới
], kq.dong, 'nv-b', '2026-11-03T10:00:00Z')
kiem('khoản giữ nguyên vẫn của nv-a', [lan2.dong[0].nguoi, lan2.dong[0].luc], ['nv-a', '2026-11-02T10:00:00Z'])
kiem('khoản sửa → nv-b', lan2.dong[1].nguoi, 'nv-b')
kiem('khoản mới → nv-b, có id', [lan2.dong[2].nguoi, !!lan2.dong[2].id], ['nv-b', true])
kiem('id gửi lên mà không có trong bản lưu → id mới', chuanHoaDong([{ id: 'gia-mao', loai: 'phu_cap', so_tien: 1, noi_dung: 'Xăng xe' }], kq.dong, 'x', 't').dong[0].id !== 'gia-mao', true)

console.log('\nBản ghi cũ (trước sql/47) dựng lại thành khoản:')
kiem('phụ cấp + điều chỉnh cũ → 2 khoản', dongCuaBanGhi({ phu_cap: 500000, dieu_chinh: -100000, ly_do: 'Xăng xe', sua_boi: 'u' }).map(d => [d.loai, d.so_tien, d.noi_dung]),
  [['phu_cap', 500000, 'Xăng xe'], ['dieu_chinh', -100000, 'Xăng xe']])
kiem('có chi_tiet → dùng chi_tiet', dongCuaBanGhi({ phu_cap: 1, chi_tiet: kq.dong }).length, 4)
kiem('không có gì → rỗng', dongCuaBanGhi(null), [])
kiem('văn bản lý do rỗng', vanBanLyDo([]), null)

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const { tinhBangLuong } = await import('../lib/luong/bangLuong.js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const bl = await tinhBangLuong(sb, 2026, 10)
  console.log('\nBảng lương thật T10/2026 — khoản phụ cấp / điều chỉnh đang có:')
  for (const x of bl.dong.filter(x => x.phuCap || x.dieuChinh)) {
    const tong = x.dongDieuChinh.reduce((a, d) => a + d.so_tien, 0)
    kiem(x.ten + ': ' + x.dongDieuChinh.length + ' khoản, tổng khớp ' + (x.phuCap + x.dieuChinh).toLocaleString('vi-VN'), tong, x.phuCap + x.dieuChinh)
  }
  kiem('người không có khoản → danh sách rỗng', bl.dong.filter(x => !x.phuCap && !x.dieuChinh).every(x => x.dongDieuChinh.length === 0), true)
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
