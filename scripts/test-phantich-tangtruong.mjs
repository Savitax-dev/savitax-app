// Kiểm bộ máy Tăng trưởng & phí (lib/phanTich/tangTruong.js) — kế hoạch mục 3b.
//   node scripts/test-phantich-tangtruong.mjs
//
// Dữ liệu GIẢ 7 quý (Q1/2025 → Q3/2026). Phí theo biểu phí phải khớp ĐÚNG computeFees gọi tay × 1,08.
// Đã chạy trên dữ liệu thật 127HOME 26/10/2026: số HĐ vào/ra từng quý khớp màn Soát kỳ.
import { tinhQuy, soSanh, chonMoc, doanhThu4Quy, phiTheoBieuPhi, phiDangThuThang, nhanXetKhach, deXuatPhiKhach } from '../lib/phanTich/tangTruong.js'
import { computeFees, normalizeSurvey } from '../lib/salesPricing.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

const tk = (nam, loai, so, c34, { lan = 0, chuaNop = false, c16 } = {}) => ({ loai: '01/GTGT', ky: { loai, so, nam }, maKy: '', lanBoSung: lan, ngayLap: `${nam}-01-0${lan + 1}`,
  chiTieu: { 34: c34 }, tep: { duongDan: ['X', chuaNop ? 'BẢNG KÊ' : 'TỜ KHAI THUẾ'] } })
const tncn = (nam, so, c16) => ({ loai: '05/KK-TNCN', ky: { loai: 'Q', so, nam }, chiTieu: { 16: c16 }, tep: { duongDan: ['TỜ KHAI THUẾ'] } })
// Bảng kê tóm tắt: khoá hóa đơn theo tháng (docHoSo đã bỏ hóa đơn hủy / bị thay thế)
const khoa = (tien, n, nam, thang) => Array.from({ length: n }, (_, i) => `${tien}${nam}${thang}-${i}`)
const bk = (mau, chieu, nam, thang, n, tien = null, tienTien = 'x') => ({ mau, chieu, khoaTheoThang: { [`${nam}-${String(thang).padStart(2, '0')}`]: khoa(tienTien, n, nam, thang) },
  tienTheoThang: tien == null ? {} : { [`${nam}-${String(thang).padStart(2, '0')}`]: tien } })
const luong = (nam, thang, soNguoi, coBh) => ({ nam, thang, tong: { soNguoi, soNguoiDongBh: coBh } })
const gd = (nam, thang, n) => Array.from({ length: n }, (_, i) => ({ ngay: `${nam}-${String(thang).padStart(2, '0')}-0${(i % 9) + 1}`, khoa: `${nam}${thang}-${i}` }))

const D2025 = {
  // 2025 khai QUÝ; Q2 có bổ sung lần 1 (phải lấy bản bổ sung)
  toKhai: [tk(2025, 'Q', 1, 1e9), tk(2025, 'Q', 2, 1.1e9), tk(2025, 'Q', 2, 1.2e9, { lan: 1 }), tk(2025, 'Q', 3, 1.3e9), tk(2025, 'Q', 4, 1.4e9), tncn(2025, 1, 5)],
  bangKe: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].flatMap(t => [bk('cong', 'mua_vao', 2025, t, 10, null, 'v'), bk('cong', 'ban_ra', 2025, t, 20, null, 'r')]),
  bangLuong: [4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => luong(2025, t, 6, 5)),
  saoKe: { soFile: 12, giaoDich: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].flatMap(t => gd(2025, t, 30)) },
  haiQuan: { kps: true, toKhai: [], khongRoNgay: [] }, hoaDonTep: [],
}
const D2026 = {
  // 2026 khai THÁNG (doanh thu năm 2025 > 0 không ảnh hưởng — chỉ để thử Σ các tháng); T5 thiếu tờ khai
  toKhai: [1, 2, 3, 4, 6, 7, 8, 9].map(t => tk(2026, 'T', t, 0.5e9)).concat([tk(2026, 'T', 9, 9e9, { chuaNop: true })]),
  bangKe: [
    ...[1, 2, 3].flatMap(t => [bk('cong', 'mua_vao', 2026, t, 15, null, 'v'), bk('cong', 'ban_ra', 2026, t, 30, null, 'r')]),
    // Q2: chỉ có bảng kê phần mềm (dự phòng) — 2 file chồng nhau T4 (khoá trùng phải đếm 1 lần)
    bk('pm_quantri', 'mua_vao', 2026, 4, 12, null, 'v'), bk('pm_quantri', 'mua_vao', 2026, 4, 12, null, 'v'), bk('pm_quantri', 'mua_vao', 2026, 5, 12, null, 'v'), bk('pm_quantri', 'mua_vao', 2026, 6, 12, null, 'v'),
    // Q3: cổng, file quý + file "Tổng quan" tháng 8 trùng khoá
    ...[7, 8, 9].flatMap(t => [bk('cong', 'mua_vao', 2026, t, 20, null, 'v'), bk('cong', 'ban_ra', 2026, t, 40, null, 'r')]), bk('cong', 'ban_ra', 2026, 8, 40, null, 'r'),
  ],
  bangLuong: [1, 2, 3, 4, 5, 6, 7, 8].map(t => luong(2026, t, 8, 7)),          // thiếu bảng lương T9
  saoKe: { soFile: 9, giaoDich: [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(t => gd(2026, t, 45)) },
  haiQuan: { kps: false, coThuMuc: true, toKhai: [{ so: '1', ngay: '2026-08-12' }, { so: '2', ngay: '2026-09-01' }, { so: '3', ngay: '2024-12-19' }], khongRoNgay: [] },
  hoaDonTep: [],
}
const quy = tinhQuy({ 2025: D2025, 2026: D2026 }, { homNay: '2026-10-26' })
const Q = ma => quy.find(q => q.ma === ma)

console.log('Bảng quý:')
kiem('7 quý đã kết thúc (Q4/2026 chưa hết → không có)', quy.map(q => q.ma), ['Q1/25', 'Q2/25', 'Q3/25', 'Q4/25', 'Q1/26', 'Q2/26', 'Q3/26'])
kiem('doanh thu Q2/2025 lấy bản bổ sung lần 1', Q('Q2/25').chiTieu.doanhThu.v, 1.2e9)
kiem('doanh thu Q1/2026 = Σ[34] 3 tháng', Q('Q1/26').chiTieu.doanhThu.v, 1.5e9)
kiem('Q2/2026 thiếu tờ khai T5 → ghi thiếu', [Q('Q2/26').chiTieu.doanhThu.v, Q('Q2/26').chiTieu.doanhThu.thieu], [1e9, ['T5']])
kiem('Q3/2026: bản chưa nộp T9 không đè bản đã nộp', Q('Q3/26').chiTieu.doanhThu.v, 1.5e9)
const nguoc = tinhQuy({ 2026: { ...D2026, toKhai: [tk(2026, 'Q', 3, 9e9, { chuaNop: true }), tk(2026, 'Q', 3, 2e9)] } }, { homNay: '2026-10-26' })
kiem('… kể cả khi bản chưa nộp đứng trước trong danh sách', nguoc.find(q => q.ma === 'Q3/26').chiTieu.doanhThu.v, 2e9)
kiem('HĐ đầu vào Q1/2026 từ cổng = 45', [Q('Q1/26').chiTieu.hdVao.v, Q('Q1/26').chiTieu.hdVao.nguon], [45, 'Bảng kê mua vào cổng HĐĐT'])
kiem('HĐ đầu vào Q2/2026 dự phòng phần mềm, 2 file trùng T4 đếm 1 lần = 36', [Q('Q2/26').chiTieu.hdVao.v, Q('Q2/26').chiTieu.hdVao.nguon], [36, 'Bảng kê mua vào phần mềm kế toán'])
kiem('HĐ đầu ra Q3/2026: file "Tổng quan" tháng 8 trùng khoá không cộng đôi = 120', Q('Q3/26').chiTieu.hdRa.v, 120)
kiem('HĐ đầu ra Q2/2026 không có nguồn → "—"', Q('Q2/26').chiTieu.hdRa.v, null)
kiem('lao động Q1/2025: không có bảng lương → [16] 05/KK-TNCN', [Q('Q1/25').chiTieu.laoDong.v, Q('Q1/25').chiTieu.laoDong.nguon], [5, '[16] tờ khai 05/KK-TNCN'])
kiem('lao động Q3/2026 bình quân T7–T8, ghi thiếu T9', [Q('Q3/26').chiTieu.laoDong.v, Q('Q3/26').chiTieu.laoDong.thieu, Q('Q3/26').chiTieu.laoDong.coBh], [8, ['T9'], 7])
kiem('hải quan 2025 (kps) = 0; 2026 Q3 = 2 theo ngày đăng ký, bỏ tờ khai năm 2024', [Q('Q2/25').chiTieu.haiQuan.v, Q('Q1/26').chiTieu.haiQuan.v, Q('Q3/26').chiTieu.haiQuan.v], [0, 0, 2])
kiem('sao kê Q1/2026 = 135', Q('Q1/26').chiTieu.saoKe.v, 135)
kiem('chứng từ/tháng Q3/2026 = (60 + 120 + 135) ÷ 3 = 105', Q('Q3/26').chiTieu.chungTu.v, 105)
kiem('chứng từ Q2/2026 thiếu HĐ ra → ghi thiếu', Q('Q2/26').chiTieu.chungTu.thieu, ['thiếu HĐ ra'])

console.log('\nSo sánh:')
const iQ3 = quy.findIndex(q => q.ma === 'Q3/26')
const ss = soSanh(quy, iQ3, 'hdRa', quy.findIndex(q => q.ma === 'Q1/25'))
kiem('HĐ ra Q3/26: quý trước không có số → null; cùng kỳ 60 → +100%; mốc Q1/25 60 → +100%', [ss.qTruoc, ss.cungKy, ss.moc], [null, 1, 1])
kiem('sao kê Q3/26 so Q2/26 = 0%', soSanh(quy, iQ3, 'saoKe').qTruoc, 0)

console.log('\nMốc so sánh phí:')
kiem('mốc = lần đổi phí gần nhất (fee_plan 08/2025 → Q3/25)', (m => [quy[m.i].ma, m.lyDo])(chonMoc(quy, { feePlans: [{ year: 2025, month: 2 }, { year: 2025, month: 8 }] })), ['Q3/25', 'lần đổi phí gần nhất'])
kiem('chưa đổi phí → quý bắt đầu hợp đồng', quy[chonMoc(quy, { contractStart: '2025-05-01' }).i].ma, 'Q2/25')
kiem('mốc ngoài dữ liệu (2023) → quý đầu, báo rõ', (m => [quy[m.i].ma, m.ngoaiDuLieu, m.ten])(chonMoc(quy, { contractStart: '2023-03-01' })), ['Q1/25', true, 'Q1/23'])

console.log('\nPhí:')
kiem('doanh thu 4 quý tới Q3/26 = Q4/25 + Q1–Q3/26', doanhThu4Quy(quy, iQ3), { v: 1.4e9 + 1.5e9 + 1e9 + 1.5e9, du: true })
kiem('chưa đủ 4 quý → quy ra năm', doanhThu4Quy(quy, 1), { v: Math.round((1e9 + 1.2e9) * 2), du: false, soQuy: 2 })
const phi = phiTheoBieuPhi(quy, iQ3)
const tay = computeFees(normalizeSurvey({ sector: 'tm', customs: true, revenueYear: 5.4e9, monthlyFiling: true, invIn: 20, invOut: 40, bankStmt: 45 }))
kiem('phí theo biểu phí = computeFees gọi tay × 1,08 (có hải quan, khai tháng)', [phi.chuaVat, phi.gomVat, phi.coHaiQuan, phi.keKhaiThang, phi.chungTu], [tay.monthly, Math.round(tay.monthly * 1.08), true, true, 105])
kiem('căn cứ lấy nguyên câu engine sinh', phi.canCu[0], tay.basis[0])
kiem('phí đang thu theo tháng: thu quý → chia 3; thu tháng giữ nguyên', [phiDangThuThang(9e6, 'quarterly'), phiDangThuThang(3e6, 'monthly'), phiDangThuThang(null, 'monthly')], [3e6, 3e6, null])

console.log('\nBản gửi khách hàng:')
const nx = nhanXetKhach(quy, iQ3)
kiem('mỗi chỉ tiêu có số một câu; HĐ ra so cùng kỳ năm trước', nx.find(c => c.startsWith('Số hóa đơn đầu ra')), 'Số hóa đơn đầu ra quý 3/2026 là 120 hóa đơn, tăng 100% so với cùng kỳ năm trước.')
kiem('doanh thu ghi tỷ đồng, so cùng kỳ (Q3/25 = 1,3 tỷ)', nx.find(c => c.startsWith('Doanh thu')), 'Doanh thu quý 3/2026 là 1,5 tỷ đồng, tăng 15,4% so với cùng kỳ năm trước.')
kiem('hải quan có số → nêu số', nx.find(c => c.includes('hải quan')), 'Số tờ khai hải quan quý 3/2026 là 2 tờ khai.')
kiem('hải quan 0 → "không phát sinh"', nhanXetKhach(quy, quy.findIndex(q => q.ma === 'Q2/26')).find(c => c.includes('hải quan')), 'Quý 2/2026 không phát sinh tờ khai hải quan.')
kiem('không có câu nào đánh giá tốt / xấu', nx.some(c => /tốt|xấu|tích cực|tiêu cực|đáng lo/i.test(c)), false)
const dx = deXuatPhiKhach(quy, iQ3, quy.findIndex(q => q.ma === 'Q1/25'), phi, 3e6, 12e6)
kiem('đề xuất: câu khối lượng từ mốc → nay + chênh, ghi chú VAT', [dx.doan[0], dx.chenh, dx.ghiChu], ['Khối lượng chứng từ kế toán bình quân tăng từ 60 chứng từ/tháng (quý 1/2025) lên 105 chứng từ/tháng (quý 3/2026).', 9e6, 'Giá đã bao gồm VAT.'])
kiem('đề xuất KHÔNG chứa cảnh báo nội bộ của engine', dx.doan.some(c => phi.canhBao.includes(c)), false)
const dx2 = deXuatPhiKhach(quy, iQ3, quy.findIndex(q => q.ma === 'Q2/26'), phi, 3e6, 12e6)
kiem('mốc thiếu nguồn (Q2/26 thiếu HĐ ra) → không so khối lượng với mốc, chỉ nêu số quý này', dx2.doan[0], 'Khối lượng chứng từ kế toán bình quân quý 3/2026 là 105 chứng từ/tháng.')

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
