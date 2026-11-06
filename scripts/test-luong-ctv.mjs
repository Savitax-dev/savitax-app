// Bộ kiểm LƯƠNG CTV (phòng remote, sql/51, anh chốt 06/11/2026) — lib/luong/luongCtv.js.
//   node scripts/test-luong-ctv.mjs                     → hàm thuần (ví dụ anh gửi)
//   node --env-file=.env.local scripts/test-luong-ctv.mjs --that [nam] [thang] → bảng thật, CHỈ ĐỌC
import { tinhDongCtv, tyLeCuaPhong, tongCua } from '../lib/luong/luongCtv.js'

let loi = 0
const kiem = (ten, thuc, mong) => {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong)
  if (!ok) loi++
  console.log((ok ? '  OK   ' : '  SAI  ') + ten + (ok ? '' : ' → ' + JSON.stringify(thuc) + ' ≠ ' + JSON.stringify(mong)))
}
const gon = x => [x.doanhThu, x.hoaHong, x.giuLai, x.thuNhap, x.thue, x.thucNhan]

console.log('Ví dụ anh gửi (CTV Savitax 20%): doanh thu 10.000.000')
kiem('hoa hồng 2tr · giữ 400k · thu nhập 1,6tr · thuế 160k · nhận 1,44tr',
  gon(tinhDongCtv({ congTy: [{ doanhThu: 10000000 }], tyLe: tyLeCuaPhong('CTV Savitax') })), [10000000, 2000000, 400000, 1600000, 160000, 1440000])

console.log('Tỷ lệ theo phòng:')
kiem('Dakshin 30%', [tyLeCuaPhong('Dakshin').dn, tyLeCuaPhong('Dakshin').hkd], [0.3, 0.3])
kiem('Danxia DN 30% / HKD 20%', [tyLeCuaPhong('Danxia').dn, tyLeCuaPhong('Danxia').hkd], [0.3, 0.2])
kiem('CTV Savitax 20%', tyLeCuaPhong('CTV Savitax').dn, 0.2)
kiem('phòng lạ → chưa có tỷ lệ', tyLeCuaPhong('Phòng mới'), null)

console.log('Danxia: 1 doanh nghiệp 10tr + 1 hộ kinh doanh 5tr')
kiem('hoa hồng 3tr + 1tr = 4tr → giữ 800k → thu nhập 3,2tr → thuế 320k → nhận 2,88tr',
  gon(tinhDongCtv({ congTy: [{ doanhThu: 10000000, hkd: false }, { doanhThu: 5000000, hkd: true }], tyLe: tyLeCuaPhong('Danxia') })),
  [15000000, 4000000, 800000, 3200000, 320000, 2880000])

console.log('Trả tiền giữ lại 1.000.000 cùng tháng (cộng vào thu nhập, chịu thuế 10%)')
kiem('Dakshin 10tr: hoa hồng 3tr − giữ 600k + trả 1tr = 3,4tr → thuế 340k → nhận 3,06tr',
  gon(tinhDongCtv({ congTy: [{ doanhThu: 10000000 }], tyLe: tyLeCuaPhong('Dakshin'), traGiuLai: 1000000 })),
  [10000000, 3000000, 600000, 3400000, 340000, 3060000])
kiem('chỉ trả giữ lại, không có công ty', gon(tinhDongCtv({ congTy: [], tyLe: tyLeCuaPhong('Dakshin'), traGiuLai: 500000 })), [0, 0, 0, 500000, 50000, 450000])
kiem('cộng tổng', tongCua([{ hoaHong: 1, thucNhan: 2 }, { hoaHong: 3, thucNhan: 4 }]).thucNhan, 6)

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const { tinhBangLuongCtv } = await import('../lib/luong/luongCtv.js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const i = process.argv.indexOf('--that'), nam = Number(process.argv[i + 1]) || 2026, thang = Number(process.argv[i + 2]) || 10
  const kq = await tinhBangLuongCtv(sb, nam, thang)
  console.log('\nBảng lương CTV thật T' + thang + '/' + nam + ':')
  for (const x of kq.dong) {
    const lai = tinhDongCtv({ congTy: x.congTy, tyLe: tyLeCuaPhong(x.phong), traGiuLai: x.traGiuLai })
    kiem(x.phong + ' · ' + x.ten + ' → nhận ' + x.thucNhan.toLocaleString('vi-VN'), gon(x), gon(lai))
    kiem(x.ten + ': thu nhập = hoa hồng − giữ + trả, nhận = thu nhập − thuế', [x.thuNhap, x.thucNhan], [x.hoaHong - x.giuLai + x.traGiuLai, x.thuNhap - x.thue])
  }
  kiem('tổng thực nhận = cộng từng người', kq.tong.thucNhan, kq.dong.reduce((a, x) => a + x.thucNhan, 0))
  kiem('tổng phòng = tổng chung', kq.phong.reduce((a, p) => a + p.thucNhan, 0), kq.tong.thucNhan)
  console.log('  Tổng ' + kq.tong.soNguoi + ' người · thực nhận ' + kq.tong.thucNhan.toLocaleString('vi-VN') + 'đ · giữ lại ' + kq.tong.giuLai.toLocaleString('vi-VN') + 'đ')
}

console.log(loi ? '\n' + loi + ' CHỖ SAI' : '\nTẤT CẢ ĐẠT')
process.exitCode = loi ? 1 : 0
