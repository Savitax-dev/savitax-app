// Kiểm quy tắc thưởng của phân hệ Tiền lương (lib/luong/thuong.js) + đối chiếu doanh thu thật với
// file lương mẫu anh gửi 14/10/2026.
//   node scripts/test-luong-thuong.mjs                       — chỉ kiểm quy tắc, không đụng database
//   node --env-file=.env.local scripts/test-luong-thuong.mjs --that   — thêm đối chiếu dữ liệu thật (chỉ đọc)
import { thuongTheoKpi, thuongDoanhSo, doanhThuThangCuaCongTy, tienThuongDvk, luongTheoCong, thangLui } from '../lib/luong/thuong.js'
import { khauTru } from '../lib/luong/khauTru.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

console.log('Thưởng KPI (dưới 80 → 0 · 80–90 → 300k · trên 90 → 500k):')
kiem('79%', thuongTheoKpi(79), 0)
kiem('đúng 80%', thuongTheoKpi(80), 300000)
kiem('đúng 90% vẫn 300k', thuongTheoKpi(90), 300000)
kiem('91%', thuongTheoKpi(91), 500000)
kiem('chưa có số', thuongTheoKpi(null), 0)

console.log('\nThưởng doanh số (file mẫu):')
kiem('Kim Ngân 52.000.000 − 35.200.000 → 3.360.000', thuongDoanhSo({ doanhThu: 52000000, toiThieu: 35200000 }), 3360000)
kiem('Mỹ Lệ 63.000.000 → 5.560.000', thuongDoanhSo({ doanhThu: 63000000, toiThieu: 35200000 }), 5560000)
kiem('Trung Anh 59.500.000 → 4.860.000', thuongDoanhSo({ doanhThu: 59500000, toiThieu: 35200000 }), 4860000)
kiem('Sơn Ca 33.000.000 chưa đạt → 0', thuongDoanhSo({ doanhThu: 33000000, toiThieu: 35200000 }), 0)
kiem('trưởng phòng 17.780.000 × 20%', thuongDoanhSo({ doanhThu: 17780000, laTruongPhong: true }), 3556000)
kiem('chưa có mức tối thiểu → 0', thuongDoanhSo({ doanhThu: 50000000, toiThieu: null }), 0)

console.log('\nDoanh thu một công ty (tách VAT 8%, quý chia 3):')
kiem('phí tháng 5.400.000 gồm VAT → 5.000.000', doanhThuThangCuaCongTy(5400000, 'monthly'), 5000000)
kiem('phí quý 16.200.000 gồm VAT → 5.000.000/tháng', doanhThuThangCuaCongTy(16200000, 'quarterly'), 5000000)

console.log('\nKhoản trừ (cấp 4: lương BHXH 5.841.000):')
kiem('BHXH 10,5%', khauTru(5841000, true).bhxh, 613305)
kiem('KPCĐ 0,5%', khauTru(5841000, true).kpcd, 29205)
kiem('Đoàn phí', khauTru(5841000, true).doanPhi, 40000)
kiem('tổng trừ', khauTru(5841000, true).tong, 682510)
kiem('không tham gia BHXH → không trừ gì', khauTru(5841000, false).tong, 0)

console.log('\nKhác:')
kiem('DVK 10.000.000 × 20%', tienThuongDvk(10000000, 20), 2000000)
kiem('lương 7.700.000 × 25,5/26', luongTheoCong(7700000, 25.5, 26), 7551923)
kiem('lùi 2 tháng từ T1/2027', thangLui(2027, 1, 2), { nam: 2026, thang: 11 })

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const { doanhThuTheoNhanVien } = await import('../lib/luong/bangLuong.js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: st } = await sb.from('staff').select('id, full_name')
  const dt = await doanhThuTheoNhanVien(sb, 2026, 9)
  console.log('\nDoanh thu thật T9/2026 so với file lương mẫu:')
  for (const [ten, so] of [['NGUYỄN THÁI KIM NGÂN', 52000000], ['TRẦN THỊ SƠN CA', 33000000], ['HUỲNH THỊ MỸ LỆ', 63000000], ['NGUYỄN THỊ TRUNG ANH', 59500000]]) {
    const s = st.find(x => x.full_name.toUpperCase() === ten)
    kiem(ten, dt.get(s?.id)?.tong, so)
  }
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
