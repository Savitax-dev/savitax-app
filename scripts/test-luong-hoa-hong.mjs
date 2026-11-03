// Kiểm quy tắc hoa hồng giới thiệu (lib/luong/hoaHong.js). Không đụng database.
//   node scripts/test-luong-hoa-hong.mjs
import { tyLeTheoBac, tinhHoaHong, thangTrongGhiChu } from '../lib/luong/hoaHong.js'

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

console.log('\nChính sách Lợi ích hợp tác (sql/46) — số khách HOẶC doanh số, lấy % cao hơn:')
const CS = [{ tu_so_cty: 1, ty_le: 10, tu_doanh_so: 1000000 }, { tu_so_cty: 21, ty_le: 15, tu_doanh_so: 31000000 }, { tu_so_cty: 31, ty_le: 20, tu_doanh_so: 51000000 }]
kiem('5 khách, doanh số 10tr → 10%', tyLeTheoBac(CS, 5, 10000000), 10)
kiem('5 khách, doanh số 31tr → 15% (doanh số đến trước)', tyLeTheoBac(CS, 5, 31000000), 15)
kiem('25 khách, doanh số 20tr → 15% (số khách đến trước)', tyLeTheoBac(CS, 25, 20000000), 15)
kiem('25 khách, doanh số 60tr → 20%', tyLeTheoBac(CS, 25, 60000000), 20)
kiem('trên 50 khách / 80tr → giữ 20%', tyLeTheoBac(CS, 70, 120000000), 20)
kiem('bậc không có mốc doanh số → chỉ xét số khách', tyLeTheoBac(BAC, 3, 999000000), 10)
const ct4 = [{ id: 'd1', ten: 'D1', gioiThieuBoi: 'z', gioiThieuTu: '2026-01-01', dangDung: true, phiThang: 20000000 },
  { id: 'd2', ten: 'D2', gioiThieuBoi: 'z', gioiThieuTu: '2026-01-01', dangDung: true, phiThang: 12000000 },
  { id: 'd3', ten: 'D3', gioiThieuBoi: 'z', gioiThieuTu: '2026-01-01', dangDung: false, phiThang: 50000000 }]
const kq4 = tinhHoaHong({ congTy: ct4, thu: [{ client_id: 'd1', nguon: 'ketoan', ky: '2026-11', kyThang: '2026-11', so_tien: 10800000 }], daTinh: new Map(), bac: CS, nam: 2026, thang: 11 }).get('z')
kiem('2 công ty đang dùng, DS 32tr (bỏ công ty ngưng) → 15% × 10tr = 1,5tr', [kq4.soCty, kq4.doanhSo, kq4.tyLe, kq4.hoaHong], [2, 32000000, 15, 1500000])

console.log('\nTheo THỜI ĐIỂM KHÁCH TRẢ, không theo kỳ phí (anh chốt 03/11/2026 — ca KIMLE: tiền vào 02/10 trả phí T9):')
const ct5 = [{ id: 'k', ten: 'KIMLE', gioiThieuBoi: 'h', gioiThieuTu: '2026-10-01', dangDung: true }]
const t5 = (thangThu, thang) => tinhHoaHong({ congTy: ct5, thu: [{ client_id: 'k', nguon: 'ketoan', ky: '2026-09', kyThang: '2026-09', thangThu, so_tien: 1620000 }], daTinh: new Map(), bac: BAC, nam: 2026, thang }).get('h')?.hoaHong || 0
kiem('phí T9 ghi thu tháng 10 → hoa hồng kỳ lương T10 (10% × 1.500.000)', t5('2026-10', 10), 150000)
kiem('phí T9 ghi thu tháng 9 (trước tháng bắt đầu hưởng) → không tính', t5('2026-09', 10), 0)
kiem('ghi thu tháng 11 → KHÔNG vào kỳ lương T10…', t5('2026-11', 10), 0)
kiem('…mà vào kỳ lương T11', t5('2026-11', 11), 150000)
kiem('dòng không có ngày ghi → lùi về kỳ phí như cũ (T9 < tháng bắt đầu → không tính)', t5(null, 10), 0)

console.log('\nNgày khách trả ghi trong ghi chú (ca TENNOODLES — trả 16/09, nhập app 01/10):')
kiem('"50% phí làm lại sổ 2025, ngày 16/09/2026" → 2026-09', thangTrongGhiChu('50% phí làm lại sổ 2025, ngày 16/09/2026'), '2026-09')
kiem('"PKT T09.2026 NGÀY 05.10.2026" → 2026-10 (sau chữ ngày, không lấy T09.2026)', thangTrongGhiChu('PKT T09.2026 NGÀY 05.10.2026'), '2026-10')
kiem('"29-10-2026" (một ngày duy nhất) → 2026-10', thangTrongGhiChu('29-10-2026'), '2026-10')
kiem('"Đối soát NH ACB 02/10" (không có năm) → không đoán', thangTrongGhiChu('Đối soát NH ACB 02/10'), null)
kiem('hai ngày mà không có chữ "ngày" → không đoán', thangTrongGhiChu('01/09/2026 - 30/09/2026'), null)
kiem('ghi chú trống → không đoán', thangTrongGhiChu(null), null)
kiem('"Khách trả tháng 9/2026 (anh xác nhận 03/11/2026)" → 2026-09 (chỉ biết tháng)', thangTrongGhiChu('Khách trả tháng 9/2026 (anh xác nhận 03/11/2026)'), '2026-09')
kiem('"tháng 09/2026" mà không có chữ "trả" → không coi là tháng khách trả', thangTrongGhiChu('Phí tháng 09/2026'), null)
const ct6 = [{ id: 'g', ten: 'GOLDTEA', gioiThieuBoi: 'n', gioiThieuTu: '2026-10-01', dangDung: true }]
const kq6 = tinhHoaHong({ congTy: ct6, thu: [
  { client_id: 'g', nguon: 'ketoan', ky: '2026-09', kyThang: '2026-09', thangThu: '2026-10', so_tien: 2160000 },
  { client_id: 'g', nguon: 'no_ton', ky: '2026-10', kyThang: '2026-10', thangThu: '2026-10', khongTinh: true, so_tien: 2160000 },
], daTinh: new Map(), bac: BAC, nam: 2026, thang: 10 }).get('n')
kiem('ghi chú "không tính hoa hồng" → bỏ khoản đó (ca Gold Tea), chỉ còn phí T9 thu tháng 10', [kq6.tienThem, kq6.hoaHong], [2160000, 200000])

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
