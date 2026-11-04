// Kiểm lương PHÒNG HCNS (lib/luong/doanhThuHcns.js — anh chốt 03/11/2026, từ kỳ lương T10/2026).
//   node scripts/test-luong-hcns.mjs                                — chỉ quy tắc
//   node --env-file=.env.local scripts/test-luong-hcns.mjs --that   — thêm: bảng lương thật T10 (chỉ đọc)
import { thuongVuotHcns } from '../lib/luong/doanhThuHcns.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

console.log('(Thời kỳ + thời điểm − tối thiểu) × 20%:')
kiem('thời kỳ 60tr + thời điểm 10tr / 51tr → vượt 19tr × 20%', thuongVuotHcns({ thoiKy: 60e6, thoiDiem: 10e6, toiThieu: 51e6 }), { thieu: 0, vuot: 19e6, thuong: 3.8e6 })
kiem('thời kỳ vượt, không có thời điểm → vẫn thưởng (Duy Minh T10: 56,7 / 51 → 1.140.000)', thuongVuotHcns({ thoiKy: 56.7e6, thoiDiem: 0, toiThieu: 51e6 }), { thieu: 0, vuot: 5.7e6, thuong: 1140000 })
kiem('thiếu 3,1tr (24,9 / 28), thời điểm 5tr → vượt 1,9tr × 20%', thuongVuotHcns({ thoiKy: 24.9e6, thoiDiem: 5e6, toiThieu: 28e6 }), { thieu: 0, vuot: 1.9e6, thuong: 380000 })
kiem('vừa đúng mức tối thiểu → 0', thuongVuotHcns({ thoiKy: 28e6, thoiDiem: 0, toiThieu: 28e6 }), { thieu: 0, vuot: 0, thuong: 0 })
kiem('chưa đủ → 0', thuongVuotHcns({ thoiKy: 20e6, thoiDiem: 5e6, toiThieu: 28e6 }), { thieu: 3e6, vuot: 0, thuong: 0 })
kiem('chưa đặt mức tối thiểu → không thưởng', thuongVuotHcns({ thoiKy: 10e6, thoiDiem: 10e6, toiThieu: null }).thuong, 0)

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const { tinhBangLuong } = await import('../lib/luong/bangLuong.js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const bl = await tinhBangLuong(sb, 2026, 10)
  console.log('\nBảng lương thật T10/2026:')
  const hcns = bl.dong.filter(x => x.hcns)
  for (const x of hcns) {
    console.log('  · ' + x.ten + ': TK ' + x.hcns.thoiKy.toLocaleString('vi-VN') + ' + TĐ ' + x.hcns.thoiDiem.toLocaleString('vi-VN') + ' / tối thiểu ' + Number(x.toiThieu).toLocaleString('vi-VN') + ' → ' + x.thuongDoanhSo.toLocaleString('vi-VN'))
    kiem(x.ten + ': thưởng = phần vượt × 20%', x.thuongDoanhSo, thuongVuotHcns({ thoiKy: x.hcns.thoiKy, thoiDiem: x.hcns.thoiDiem, toiThieu: x.toiThieu }).thuong)
    kiem(x.ten + ': doanh thu = thời kỳ + thời điểm', x.doanhThu, x.hcns.thoiKy + x.hcns.thoiDiem)
  }
  const nvHcns = hcns.filter(x => !['hcns_leader'].includes(x.role))
  const tongMin = Math.min(nvHcns.reduce((a, x) => a + (Number(x.toiThieu) || 0), 0), nvHcns.reduce((a, x) => a + x.hcns.thoiKy, 0))
  const tp = bl.dong.filter(x => x.phongTp?.some(r => r.theoToiThieu))
  kiem('có trưởng phòng HCNS nhận 1% tổng tối thiểu', tp.length > 0, true)
  for (const x of tp) {
    const r = x.phongTp.find(r => r.theoToiThieu)
    console.log('  · TP HCNS ' + x.ten + ': 1% × ' + r.doanhThu.toLocaleString('vi-VN') + ' = ' + x.thuongDsPhong.toLocaleString('vi-VN'))
    kiem(x.ten + ': 1% × min(thời kỳ phòng, tổng tối thiểu)', [r.doanhThu, x.thuongDsPhong], [tongMin, Math.round(tongMin * 0.01)])
  }
  kiem('tổng thưởng mỗi người cộng đúng', bl.dong.every(x => x.tongThuong === x.thuongViec + x.thuongNo + x.thuongDoanhSo + x.thuongDsPhong + x.thuongDvk + x.thuongHoaHong + x.thuongPhong), true)
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
