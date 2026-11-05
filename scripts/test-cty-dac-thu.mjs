// Kiểm luật "công ty đặc thù về công nợ" (lib/ctyDacThu.js, anh chốt 01/11/2026) — chạy offline:
//   node scripts/test-cty-dac-thu.mjs
import { truocThue, hanCuoiKy, trongGiaHan, tamBoQuaCongNo, nhanGiaHan, ganDacThu } from '../lib/ctyDacThu.js'
import { isPastEditDeadline, isPastRolloverDeadline } from '../lib/feeDue.js'
import { doanhThuThangCuaCongTy, tienThuongDvk, chuaVatDvk } from '../lib/luong/thuong.js'
import { tinhHoaHong } from '../lib/luong/hoaHong.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}
const ngay = s => new Date(s + 'T12:00:00')

console.log('1) Thu phí không VAT:')
kiem('TRUCMAI 6.500.000 không VAT → doanh thu 6.500.000 (trước đây 6.018.519)', doanhThuThangCuaCongTy(6500000, 'monthly', true), 6500000)
kiem('công ty thường vẫn chia 1,08', doanhThuThangCuaCongTy(6500000, 'monthly'), 6018519)
kiem('công ty quý không VAT: chia 3, không chia 1,08', doanhThuThangCuaCongTy(9000000, 'quarterly', true), 3000000)
kiem('thưởng DVK 10% trên 1.080.000: thường 100.000, không VAT 108.000', [tienThuongDvk(1080000, 10), tienThuongDvk(1080000, 10, true)], [100000, 108000])
kiem('trước thuế DVK', [chuaVatDvk(1080000), chuaVatDvk(1080000, true)], [1000000, 1080000])
kiem('truocThue()', [truocThue(1080000, false), truocThue(1080000, true)], [1000000, 1080000])
const hh = tinhHoaHong({
  congTy: [{ id: 'a', ten: 'A', gioiThieuBoi: 'nv', gioiThieuTu: '2026-01-01', dangDung: true }, { id: 'b', ten: 'B', gioiThieuBoi: 'nv', gioiThieuTu: '2026-01-01', dangDung: true, khongVat: true }],
  thu: [{ client_id: 'a', nguon: 'ketoan', ky: '2026-10', kyThang: '2026-10', so_tien: 1080000 }, { client_id: 'b', nguon: 'ketoan', ky: '2026-10', kyThang: '2026-10', so_tien: 1080000 }],
  daTinh: new Map(), bac: [{ tu_so_cty: 1, ty_le: 10 }], nam: 2026, thang: 10,
}).get('nv')
kiem('hoa hồng 10%: công ty thường 100.000 + công ty không VAT 108.000', [hh.hoaHong, hh.chuaVat, hh.chiTiet.map(c => c.khong_vat)], [208000, 2080000, [false, true]])

console.log('\n2) Gia hạn thu:')
kiem('hạn cuối kỳ T9/2026 không gia hạn = 10/10/2026', hanCuoiKy(2026, 9).toDateString(), new Date(2026, 9, 10).toDateString())
kiem('gia hạn 2 tháng → 10/12/2026', hanCuoiKy(2026, 9, 2).toDateString(), new Date(2026, 11, 10).toDateString())
kiem('kỳ T11 gia hạn 3 tháng qua năm → 10/03/2027', hanCuoiKy(2026, 11, 3).toDateString(), new Date(2027, 2, 10).toDateString())
kiem('hạn sửa công nợ T9: thường đã quá ngày 01/11, gia hạn 1 tháng vẫn sửa được', [isPastEditDeadline(2026, 9, ngay('2026-11-01')), isPastEditDeadline(2026, 9, ngay('2026-11-01'), 10, 1)], [true, false])
// Từ 05/11/2026 chuyển nợ tồn khi HẾT THÁNG (gia hạn N: hết tháng M+N), không chờ ngày 10 nữa.
kiem('hạn chuyển nợ tồn T9: 15/10 thường đã tới, gia hạn 1 tháng chưa tới; 01/11 thì tới', [isPastRolloverDeadline('monthly', 2026, 9, ngay('2026-10-15')), isPastRolloverDeadline('monthly', 2026, 9, ngay('2026-10-15'), 1), isPastRolloverDeadline('monthly', 2026, 9, ngay('2026-11-01'), 1)], [true, false, true])
kiem('công ty quý: tháng giữa quý vẫn không phải kỳ chuyển nợ tồn dù gia hạn', isPastRolloverDeadline('quarterly', 2026, 8, ngay('2027-01-01'), 1), false)
kiem('không gia hạn → không bao giờ "trong gia hạn"', trongGiaHan(0, 2026, 9, ngay('2026-10-01')), false)
const n = ngay('2026-11-01')
kiem('%-nợ T9 gia hạn 1 tháng, chưa thu → TẠM KHÔNG TÍNH', tamBoQuaCongNo(1, 2026, 9, 5000000, 0, n), true)
kiem('thu một phần → vẫn tạm không tính', tamBoQuaCongNo(1, 2026, 9, 5000000, 2000000, n), true)
kiem('thu đủ → TÍNH bình thường', tamBoQuaCongNo(1, 2026, 9, 5000000, 5000000, n), false)
kiem('hết gia hạn (11/11) chưa thu → tính (chưa thu như cũ)', tamBoQuaCongNo(1, 2026, 9, 5000000, 0, ngay('2026-11-11')), false)
kiem('công ty không gia hạn → luôn tính', tamBoQuaCongNo(0, 2026, 9, 5000000, 0, n), false)
kiem('nhãn', nhanGiaHan(2, 2026, 9), 'Gia hạn thu 2 tháng — kỳ T9/2026 hạn 10/12/2026')
const ds = ganDacThu([{ id: 'a' }, { id: 'b' }], { khongVat: new Set(['a']), giaHan: new Map([['b', 2]]) })
kiem('ganDacThu gắn cờ vào từng công ty', ds, [{ id: 'a', khong_vat: true, gia_han_thu_thang: 0 }, { id: 'b', khong_vat: false, gia_han_thu_thang: 2 }])

console.log(hong ? `\n${hong} mục HỎNG` : '\nTẤT CẢ ĐỀU ĐẠT.')
process.exit(hong ? 1 : 0)
