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

console.log('Thời kỳ lấp tối thiểu trước, phần THỜI ĐIỂM còn dư × 20%:')
kiem('thời kỳ đủ (60tr / 51tr), thời điểm 10tr → 20% × 10tr', thuongVuotHcns({ thoiKy: 60e6, thoiDiem: 10e6, toiThieu: 51e6 }), { thieu: 0, thoiDiemDu: 10e6, thuong: 2e6 })
kiem('thời kỳ vượt mà không có thời điểm → 0 (thời kỳ vượt không thưởng)', thuongVuotHcns({ thoiKy: 60e6, thoiDiem: 0, toiThieu: 51e6 }).thuong, 0)
kiem('thiếu 3,1tr (24,9 / 28), thời điểm 5tr → bù 3,1tr, dư 1,9tr × 20%', thuongVuotHcns({ thoiKy: 24.9e6, thoiDiem: 5e6, toiThieu: 28e6 }), { thieu: 3.1e6, thoiDiemDu: 1.9e6, thuong: 380000 })
kiem('thời điểm chưa đủ bù → 0', thuongVuotHcns({ thoiKy: 20e6, thoiDiem: 5e6, toiThieu: 28e6 }), { thieu: 8e6, thoiDiemDu: 0, thuong: 0 })
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
    kiem(x.ten + ': thưởng = luật thời điểm dư', x.thuongDoanhSo, thuongVuotHcns({ thoiKy: x.hcns.thoiKy, thoiDiem: x.hcns.thoiDiem, toiThieu: x.toiThieu }).thuong)
    kiem(x.ten + ': doanh thu = thời kỳ + thời điểm', x.doanhThu, x.hcns.thoiKy + x.hcns.thoiDiem)
  }
  const tongMin = hcns.filter(x => !['hcns_leader'].includes(x.role)).reduce((a, x) => a + (Number(x.toiThieu) || 0), 0)
  const tp = bl.dong.filter(x => x.phongTp?.some(r => r.theoToiThieu))
  kiem('có trưởng phòng HCNS nhận 1% tổng tối thiểu', tp.length > 0, true)
  for (const x of tp) {
    const r = x.phongTp.find(r => r.theoToiThieu)
    console.log('  · TP HCNS ' + x.ten + ': 1% × ' + r.doanhThu.toLocaleString('vi-VN') + ' = ' + x.thuongDsPhong.toLocaleString('vi-VN'))
    kiem(x.ten + ': 1% × tổng tối thiểu nhân viên HCNS', [r.doanhThu, x.thuongDsPhong], [tongMin, Math.round(tongMin * 0.01)])
  }
  kiem('tổng thưởng mỗi người cộng đúng', bl.dong.every(x => x.tongThuong === x.thuongViec + x.thuongNo + x.thuongDoanhSo + x.thuongDsPhong + x.thuongDvk + x.thuongHoaHong + x.thuongPhong), true)
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
