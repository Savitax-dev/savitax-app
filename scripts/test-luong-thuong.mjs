// Kiểm quy tắc thưởng của phân hệ Tiền lương (lib/luong/thuong.js) + đối chiếu doanh thu thật với
// file lương mẫu anh gửi 14/10/2026.
//   node scripts/test-luong-thuong.mjs                       — chỉ kiểm quy tắc, không đụng database
//   node --env-file=.env.local scripts/test-luong-thuong.mjs --that   — thêm đối chiếu dữ liệu thật (chỉ đọc)
import { thuongTheoKpi, thuongDoanhSo, thuongDoanhSoPhong, doanhThuThangCuaCongTy, tienThuongDvk, luongTheoCong, thangLui, tacPhongNhanVien, diemKpiPhong } from '../lib/luong/thuong.js'
import { khauTru } from '../lib/luong/khauTru.js'
import { thueLuyTien, thueTncn } from '../lib/luong/thueTncn.js'

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

console.log('\nTác phong + KPI phòng (anh chốt 19/10/2026):')
kiem('0 lần vi phạm → 100%', tacPhongNhanVien(0), 100)
kiem('Kiều Tiên 2 lần → 60%', tacPhongNhanVien(2), 60)
kiem('6 lần → sàn 0%', tacPhongNhanVien(6), 0)
kiem('điểm phòng = TB 3 tiêu chí (96, 99, 95 → 97)', diemKpiPhong(96, 99, 95), 97)
kiem('thiếu tiêu chí → chưa có điểm', diemKpiPhong(96, null, 95), null)

console.log('\nThuế TNCN (anh chốt 20/10/2026):')
kiem('tính thuế 0 → 0', thueLuyTien(0), 0)
kiem('bậc 1: 10tr × 5%', thueLuyTien(10000000), 500000)
kiem('nối bậc 1–2 tại 10tr (10% − 500k)', thueLuyTien(10000001), 500000)
kiem('bậc 2: 30tr → 2,5tr', thueLuyTien(30000000), 2500000)
kiem('bậc 3: 60tr → 8,5tr', thueLuyTien(60000000), 8500000)
kiem('bậc 4: 100tr → 20,5tr', thueLuyTien(100000000), 20500000)
kiem('bậc 5: 120tr → 35% − 14,5tr', thueLuyTien(120000000), 27500000)
kiem('ví dụ anh: 40tr, 0 NPT, BHXH 613.305 → 1.888.670', thueTncn({ thuNhap: 40000000, thamGiaBhxh: true, soNguoiPhuThuoc: 0, bhxh: 613305 }).thue, 1888670)
kiem('cùng thu nhập, 1 NPT → 1.268.670', thueTncn({ thuNhap: 40000000, thamGiaBhxh: true, soNguoiPhuThuoc: 1, bhxh: 613305 }).thue, 1268670)
kiem('thu nhập dưới giảm trừ → 0', thueTncn({ thuNhap: 18000000, thamGiaBhxh: true, soNguoiPhuThuoc: 1, bhxh: 613305 }).thue, 0)
kiem('thử việc 10% × 7.000.000', thueTncn({ thuNhap: 7000000, thamGiaBhxh: false, soNguoiPhuThuoc: 2 }).thue, 700000)
kiem('thử việc thu nhập âm (điều chỉnh) → 0', thueTncn({ thuNhap: -500000, thamGiaBhxh: false }).thue, 0)

console.log('\nKhác:')
kiem('DVK 10.800.000 (gồm VAT) ÷ 1,08 × 20%', tienThuongDvk(10800000, 20), 2000000)
kiem('DVK 31.752.000 ÷ 1,08 × 10%', tienThuongDvk(31752000, 10), 2940000)
kiem('lương 7.700.000 × 25,5/26', luongTheoCong(7700000, 25.5, 26), 7551923)
kiem('lùi 2 tháng từ T1/2027', thangLui(2027, 1, 2), { nam: 2026, thang: 11 })

console.log('\nThưởng doanh số phòng của trưởng phòng (1%, anh chốt 02/11/2026):')
kiem('phòng 290.000.000 → 2.900.000', thuongDoanhSoPhong(290000000), 2900000)
kiem('phòng 276.018.519 → 2.760.185', thuongDoanhSoPhong(276018519), 2760185)
kiem('phòng chưa có doanh thu → 0', thuongDoanhSoPhong(0), 0)

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

  // Thưởng DS phòng 1% trên bảng lương thật T10/2026: chỉ người làm trưởng phòng (chính hoặc kiêm nhiệm) mới có,
  // đúng 1% doanh thu PHÒNG MÌNH LÀM TRƯỞNG (cộng doanh thu từng nhân viên theo phòng), và đã cộng vào tổng thưởng.
  const { tinhBangLuong } = await import('../lib/luong/bangLuong.js')
  const bl = await tinhBangLuong(sb, 2026, 10)
  const { data: phongNv } = await sb.from('staff').select('id, room_id, role')
  const { data: kn } = await sb.from('staff_extra_roles').select('staff_id, room_id, role')
  const dt10 = await doanhThuTheoNhanVien(sb, 2026, 10)
  const dtP = new Map()
  for (const [id, x] of dt10) { const r = phongNv.find(s => s.id === id)?.room_id; if (r) dtP.set(r, (dtP.get(r) || 0) + x.tong) }
  console.log('\nThưởng DS phòng trên bảng lương thật T10/2026:')
  let soTp = 0
  for (const x of bl.dong) {
    const s = phongNv.find(n => n.id === x.staff_id)
    const phongTp = [...new Set([...(s.role === 'leader' ? [s.room_id] : []), ...kn.filter(e => e.staff_id === s.id && e.role === 'leader').map(e => e.room_id)])]
    const mong = phongTp.length ? Math.round(phongTp.reduce((a, r) => a + (dtP.get(r) || 0), 0) / 100) : 0
    if (phongTp.length) { soTp++; kiem(x.ten + ' · ' + x.phongTp.map(r => r.ten).join('+') + ' · ' + x.thuongDsPhong.toLocaleString('vi-VN'), x.thuongDsPhong, mong) }
    else if (x.thuongDsPhong) kiem(x.ten + ' không làm trưởng phòng → 0', x.thuongDsPhong, 0)
    const tt = x.thuongViec + x.thuongNo + x.thuongDoanhSo + x.thuongDsPhong + x.thuongDvk + x.thuongHoaHong + x.thuongPhong
    if (tt !== x.tongThuong) kiem(x.ten + ' tổng thưởng gồm DS phòng', x.tongThuong, tt)
  }
  kiem('có trưởng phòng được tính', soTp > 0, true)
  const duc = bl.dong.find(x => x.ten === 'Lương Tấn Đức')
  if (duc) kiem('Lương Tấn Đức (NV Grand, kiêm TP Danxia) chỉ tính Danxia', duc.phongTp.map(r => r.ten), ['Danxia'])

  // File Excel: cột mới có công thức trỏ Tham so B18, và Tổng thu nhập cộng cột này
  const { taoWorkbookBangLuong } = await import('../lib/luong/excel.js')
  const wb = await taoWorkbookBangLuong({ ...bl, daChot: null })
  const ws = wb.worksheets[0]
  const hang4 = ws.getRow(4).values
  const cDs = hang4.indexOf('Thưởng DS phòng 1%'), cTn = hang4.indexOf('Tổng thu nhập')
  kiem('Excel có cột Thưởng DS phòng 1%', cDs > 0, true)
  kiem('Tham so B18 = 1%', wb.getWorksheet('Tham so').getCell('B18').value, 0.01)
  const iTp = bl.dong.findIndex(x => x.thuongDsPhong > 0)
  let hangTp = null
  ws.eachRow((row, r) => { if (r >= 5 && row.getCell(2).value === bl.dong[iTp]?.ten) hangTp = row })
  kiem('Excel: công thức DS phòng trỏ B18', /B\$18/.test(hangTp?.getCell(cDs).value?.formula || ''), true)
  kiem('Excel: Tổng thu nhập có cộng DS phòng', (hangTp?.getCell(cTn).value?.formula || '').includes(ws.getColumn(cDs).letter), true)
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
