// Kiểm quy tắc hoa hồng giới thiệu (lib/luong/hoaHong.js). Không đụng database.
//   node scripts/test-luong-hoa-hong.mjs
import { tyLeTheoBac, tinhHoaHong } from '../lib/luong/hoaHong.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}
const BAC = [{ tu_so_cty: 1, ty_le: 10 }, { tu_so_cty: 5, ty_le: 15 }, { tu_so_cty: 10, ty_le: 20 }]

console.log('Bậc %:')
kiem('3 công ty → 10%', tyLeTheoBac(BAC, 3), 10)
kiem('đúng mốc 5 → 15%', tyLeTheoBac(BAC, 5), 15)
kiem('10 công ty → 20%', tyLeTheoBac(BAC, 10), 20)
kiem('0 công ty đang dùng (đều ngưng, còn thu nợ cũ) → bậc thấp nhất', tyLeTheoBac(BAC, 0), 10)
kiem('chưa có bảng bậc → 0', tyLeTheoBac([], 7), 0)

console.log('\nVí dụ của anh: Nguyễn Đăng Hiếu đưa về 10 công ty, khách trả tổng 54.000.000 (gồm VAT) trong kỳ:')
const congTy = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, ten: 'Cty ' + i, gioiThieuBoi: 'hieu', gioiThieuTu: '2026-10-01', dangDung: true }))
const thu = congTy.map(c => ({ client_id: c.id, nguon: 'ketoan', ky: '2026-10', kyThang: '2026-10', so_tien: 5400000 }))
const kq = tinhHoaHong({ congTy, thu, daTinh: new Map(), bac: BAC, nam: 2026, thang: 10 }).get('hieu')
kiem('bậc 20%', kq.tyLe, 20)
kiem('tiền chưa VAT 50.000.000', kq.chuaVat, 50000000)
kiem('hoa hồng 20% × 50.000.000 = 10.000.000', kq.hoaHong, 10000000)

console.log('\nPhần thu THÊM kể từ lần chốt trước:')
const da = new Map([['c0|ketoan|2026-10', 5400000]])  // T10 công ty c0 đã tính ở kỳ lương trước
const kq2 = tinhHoaHong({ congTy, thu, daTinh: da, bac: BAC, nam: 2026, thang: 11 }).get('hieu')
kiem('c0 đã tính rồi → không tính lại (9 công ty × 1.000.000)', kq2.hoaHong, 9000000)
const thuMuon = [...thu, { client_id: 'c0', nguon: 'no_ton', ky: '2026-11', kyThang: '2026-11', so_tien: 1080000 }]
kiem('thu nợ tồn 1.080.000 → +200.000 (20% × 1.000.000)', tinhHoaHong({ congTy, thu: thuMuon, daTinh: new Map(thu.map(t => [t.client_id + '|ketoan|2026-10', 5400000])), bac: BAC, nam: 2026, thang: 11 }).get('hieu').hoaHong, 200000)
kiem('sửa giảm số đã thu → hoa hồng âm điều chỉnh', tinhHoaHong({ congTy: [congTy[0]], thu: [{ client_id: 'c0', nguon: 'ketoan', ky: '2026-10', kyThang: '2026-10', so_tien: 4320000 }], daTinh: da, bac: BAC, nam: 2026, thang: 11 }).get('hieu').hoaHong, -100000)

console.log('\nMốc hưởng + công ty ngưng:')
const ct2 = [{ id: 'a', ten: 'A', gioiThieuBoi: 'x', gioiThieuTu: '2026-11-01', dangDung: true }]
kiem('kỳ trước tháng bắt đầu hưởng → không tính', tinhHoaHong({ congTy: ct2, thu: [{ client_id: 'a', nguon: 'ketoan', ky: '2026-10', kyThang: '2026-10', so_tien: 1080000 }], daTinh: new Map(), bac: BAC, nam: 2026, thang: 11 }).get('x').hoaHong, 0)
kiem('kỳ lương trước tháng bắt đầu hưởng → chưa có người giới thiệu', tinhHoaHong({ congTy: ct2, thu: [], daTinh: new Map(), bac: BAC, nam: 2026, thang: 10 }).has('x'), false)
const ct3 = [{ id: 'b', ten: 'B', gioiThieuBoi: 'y', gioiThieuTu: '2026-01-01', dangDung: false }]
const kq3 = tinhHoaHong({ congTy: ct3, thu: [{ client_id: 'b', nguon: 'no_ton', ky: '2026-11', kyThang: '2026-11', so_tien: 2160000 }], daTinh: new Map(), bac: BAC, nam: 2026, thang: 11 }).get('y')
kiem('công ty đã ngưng, thu nợ cũ 2.160.000 → bậc thấp nhất 10% = 200.000', [kq3.soCty, kq3.tyLe, kq3.hoaHong], [0, 10, 200000])

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
