// Kiểm nối Pháp lý ↔ Đối soát ngân hàng (hàm thuần lib/phaply/nganHang.js) — offline:
//   node scripts/test-phaply-ngan-hang.mjs
import { docMaHoSo, phanBoVaoDot } from '../lib/phaply/nganHang.js'
import { tongHopHoSo } from '../lib/phaply/tien.js'

let dat = 0, hong = 0
const ok = (dk, ten, ct = '') => { if (dk) dat++; else { hong++; console.log('✗', ten, ct) } }
const ma = s => docMaHoSo(s).join(',')

// ─── đọc mã hồ sơ trong nội dung chuyển khoản ───
ok(ma('PL261192_ThanhToan_Phidichvu_11_2026') === 'PL-2611-92', 'đúng nội dung phiếu ĐNTT')
ok(ma('PL261192 ThanhToan Phidichvu 11 2026') === 'PL-2611-92', 'ngân hàng đổi _ thành khoảng trắng')
ok(ma('PL261192THANHTOANPHIDICHVU112026') === 'PL-2611-92', 'ngân hàng bỏ hết dấu')
ok(ma('MBVCB.123. CT TNHH ABC chuyen tien PL-2611-92 thanh toan') === 'PL-2611-92', 'khách gõ tay có gạch')
ok(ma('pl 2611 92 phi dich vu') === 'PL-2611-92', 'chữ thường, cách nhau')
ok(ma('PL2611105 TT') === 'PL-2611-105', 'số thứ tự 3 chữ số')
ok(ma('APPLE261192 THANH TOAN') === '', 'không bắt "PL" nằm giữa chữ khác')
ok(ma('TT PHI DICH VU T10 2026 MST 0312345678') === '', 'nội dung kế toán thường: không có mã pháp lý')
ok(ma('PL261392') === '', 'tháng 13 không phải mã')
ok(ma('PL261192 va PL261193') === 'PL-2611-92,PL-2611-93', 'hai mã')

// ─── chia tiền vào các đợt ───
const fees = [{ kind: 'dich_vu', name: 'Phí', amount: 3000000 }, { kind: 'thu_ho', name: 'Lệ phí', amount: 500000 }]
const dots = [{ id: 'd1', seq: 1, amount_dich_vu: 1500000, amount_thu_ho: 500000, due_date: '2026-11-01' },
  { id: 'd2', seq: 2, amount_dich_vu: 1500000, amount_thu_ho: 0, due_date: '2026-11-30' }]
const t = tongHopHoSo({ hoSo: {}, fees, dots, payments: [], homNayISO: '2026-11-18' })
let k = phanBoVaoDot(t, 3500000)
ok(k.du === 0 && k.phan.length === 2, 'trả đủ → chia 2 đợt', JSON.stringify(k))
ok(k.phan[0].installment_id === 'd1' && k.phan[0].amount_thu_ho === 500000 && k.phan[0].amount_dich_vu === 1500000, 'đợt 1: trừ thu hộ trước', JSON.stringify(k.phan[0]))
ok(k.phan[1].installment_id === 'd2' && k.phan[1].amount_dich_vu === 1500000, 'đợt 2: phần còn lại', JSON.stringify(k.phan[1]))
k = phanBoVaoDot(t, 800000)
ok(k.phan.length === 1 && k.phan[0].installment_id === 'd1' && k.phan[0].amount_thu_ho === 500000 && k.phan[0].amount_dich_vu === 300000, 'trả một phần: vào đợt cũ nhất, thu hộ trước', JSON.stringify(k))
k = phanBoVaoDot(t, 4000000)
ok(k.du === 500000, 'trả dư → báo phần vượt', k.du)
// đợt 1 đã thu đủ → tiền vào đợt 2
const t2 = tongHopHoSo({ hoSo: {}, fees, dots, payments: [{ installment_id: 'd1', amount_dich_vu: 1500000, amount_thu_ho: 500000, paid_at: '2026-11-02' }], homNayISO: '2026-11-18' })
k = phanBoVaoDot(t2, 1500000)
ok(k.phan.length === 1 && k.phan[0].installment_id === 'd2' && k.du === 0, 'đợt đã thu đủ bị bỏ qua', JSON.stringify(k))
// chưa lập đợt
const t3 = tongHopHoSo({ hoSo: {}, fees, dots: [], payments: [] })
k = phanBoVaoDot(t3, 2000000)
ok(k.phan.length === 1 && k.phan[0].installment_id === null && k.phan[0].amount_thu_ho === 500000 && k.phan[0].amount_dich_vu === 1500000, 'chưa lập đợt: một khoản, thu hộ trước', JSON.stringify(k))
// lịch thu thiếu so với tổng phí → phần thiếu ghi không gắn đợt
const t4 = tongHopHoSo({ hoSo: {}, fees, dots: [dots[0]], payments: [], homNayISO: '2026-11-18' })
k = phanBoVaoDot(t4, 3500000)
ok(k.du === 0 && k.phan.length === 2 && k.phan[1].installment_id === null && k.phan[1].amount_dich_vu === 1500000, 'lịch thu chưa phủ hết phí: phần dư vào khoản không gắn đợt', JSON.stringify(k))

console.log(`${dat} đạt, ${hong} hỏng`)
process.exit(hong ? 1 : 0)
