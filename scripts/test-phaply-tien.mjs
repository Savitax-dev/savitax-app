// Bộ kiểm tiền phân hệ Pháp lý (offline, dữ liệu giả): node scripts/test-phaply-tien.mjs
import { tachKhoanThu, ngayDenHan, tongHopHoSo, doanhSoTheoThang, suKienTien, dongTien, cacThangTu, apLichMau, truocVat } from '../lib/phaply/tien.js'
import { hanNoiBo, maKeTiep, treHan } from '../lib/phaply/hoSo.js'

let loi = 0, dem = 0
const kiem = (ten, dk, ct = '') => { dem++; if (!dk) { loi++; console.log('✗', ten, ct) } }
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ─── chia khoản thu: thu hộ trước ───
kiem('thu thiếu: trừ thu hộ trước', bang(tachKhoanThu(3_000_000, 2_000_000), { amount_thu_ho: 2_000_000, amount_dich_vu: 1_000_000 }))
kiem('thu ít hơn thu hộ', bang(tachKhoanThu(500_000, 2_000_000), { amount_thu_ho: 500_000, amount_dich_vu: 0 }))
kiem('không còn thu hộ', bang(tachKhoanThu(800_000, 0), { amount_thu_ho: 0, amount_dich_vu: 800_000 }))

// ─── hạn nội bộ bỏ chủ nhật, ngày nhận là ngày 1 ───
kiem('hạn 3 ngày từ thứ Sáu 13/11/2026 → thứ Hai 16/11 (bỏ CN 15/11)', hanNoiBo('2026-11-13', 3) === '2026-11-16', hanNoiBo('2026-11-13', 3))
kiem('hạn 1 ngày = chính ngày nhận', hanNoiBo('2026-11-17', 1) === '2026-11-17')
kiem('nhận chủ nhật không tính ngày đó', hanNoiBo('2026-11-15', 1) === '2026-11-16', hanNoiBo('2026-11-15', 1))
kiem('trễ hạn: qua hết ngày hạn', treHan({ due_at: '2026-11-16', stage: 4 }, '2026-11-17') && !treHan({ due_at: '2026-11-17', stage: 4 }, '2026-11-17'))
kiem('hồ sơ đã đóng không trễ', !treHan({ due_at: '2026-01-01', stage: 10 }, '2026-11-17'))

// ─── mã hồ sơ ───
kiem('mã đầu tháng', maKeTiep([], '2026-11-17') === 'PL-2611-01')
kiem('mã tiếp theo bỏ qua tháng khác', maKeTiep(['PL-2611-01', 'PL-2611-07', 'PL-2610-30'], '2026-11-17') === 'PL-2611-08')

// ─── hồ sơ mẫu: 2 đợt — 50% khi nhận, 50% (+ toàn bộ thu hộ) khi có kết quả ───
const hoSo = { id: 'h1', stage: 7, received_at: '2026-09-20' }
const nhatKy = [
  { kind: 'stage', to_value: '3', created_at: '2026-09-25T03:00:00Z' },
  { kind: 'stage', to_value: '7', created_at: '2026-10-28T20:00:00Z' },   // 29/10 giờ VN
]
const fees = [{ kind: 'dich_vu', name: 'Phí dịch vụ', amount: 4_000_000 }, { kind: 'thu_ho', name: 'Lệ phí + dấu', amount: 1_000_000 }]
const dots = apLichMau([{ ten: 'Đợt 1', pt_dich_vu: 50, pt_thu_ho: 0 }, { ten: 'Đợt 2', pt_dich_vu: 50, pt_thu_ho: 100, due_stage: 7 }], 4_000_000, 1_000_000)
  .map((d, i) => ({ ...d, id: 'd' + (i + 1) }))
kiem('áp lịch mẫu', dots[0].amount_dich_vu === 2_000_000 && dots[1].amount_dich_vu === 2_000_000 && dots[1].amount_thu_ho === 1_000_000)
kiem('đợt 1 đến hạn ngày nhận', ngayDenHan(dots[0], hoSo, nhatKy) === '2026-09-20')
kiem('đợt "khi nhận" (bước 1) = ngày nhận, không phải ngày chuyển bước đầu', ngayDenHan({ due_stage: 1 }, hoSo, nhatKy) === '2026-09-20', ngayDenHan({ due_stage: 1 }, hoSo, nhatKy))
kiem('đợt 2 đến hạn ngày sang bước Kết quả (giờ VN)', ngayDenHan(dots[1], hoSo, nhatKy) === '2026-10-29', ngayDenHan(dots[1], hoSo, nhatKy))
kiem('chưa tới bước → chưa đến hạn', ngayDenHan(dots[1], { ...hoSo, stage: 5 }, nhatKy.slice(0, 1)) === null)
const lech = apLichMau([{ ten: 'Đợt 1', pt_dich_vu: 33, pt_thu_ho: 33 }, { ten: 'Đợt 2', pt_dich_vu: 33, pt_thu_ho: 33 }, { ten: 'Đợt 3', pt_dich_vu: 34, pt_thu_ho: 34 }], 1_000_001, 333)
kiem('phần lẻ dồn đợt cuối', lech.reduce((a, d) => a + d.amount_dich_vu, 0) === 1_000_001 && lech.reduce((a, d) => a + d.amount_thu_ho, 0) === 333)

const payments = [
  { installment_id: 'd1', amount_dich_vu: 2_000_000, amount_thu_ho: 0, paid_at: '2026-09-22', staff_id: 'A' },
  // khách trả trước một phần đợt 2 (chưa đến hạn) ở tháng 10, phần còn lại tháng 11
  { installment_id: 'd2', amount_dich_vu: 500_000, amount_thu_ho: 1_000_000, paid_at: '2026-10-05', staff_id: 'A' },
  { installment_id: 'd2', amount_dich_vu: 1_000_000, amount_thu_ho: 0, paid_at: '2026-11-03', staff_id: 'B' },
  { installment_id: 'd2', amount_dich_vu: 9_999_999, amount_thu_ho: 0, paid_at: '2026-11-04', staff_id: 'B', deleted_at: '2026-11-05' },
]
const th = tongHopHoSo({ hoSo, fees, dots, payments, nhatKy, homNayISO: '2026-11-17' })
kiem('tổng phí', th.phi === 5_000_000 && th.phi_dich_vu === 4_000_000)
kiem('đã thu bỏ dòng đã xoá', th.da_thu === 4_500_000, th.da_thu)
kiem('còn phải thu', th.con_phai_thu === 500_000)
kiem('nợ đến hạn = còn của đợt đã đến hạn', th.no_den_han === 500_000, th.no_den_han)
kiem('lịch khớp phí → không cảnh báo', th.canh_bao.length === 0, th.canh_bao)

// ─── doanh số theo tháng thu (chỉ phần dịch vụ) ───
const ds = doanhSoTheoThang(payments)
kiem('doanh số T9', ds['2026-09'].gom_vat === 2_000_000 && ds['2026-09'].theo_nv.A === 2_000_000)
kiem('doanh số T10 không tính thu hộ', ds['2026-10'].gom_vat === 500_000)
kiem('doanh số T11 tính người phụ trách lúc thu, bỏ dòng xoá', ds['2026-11'].gom_vat === 1_000_000 && ds['2026-11'].theo_nv.B === 1_000_000)
kiem('trước VAT = ÷1,08', ds['2026-09'].truoc_vat === truocVat(2_000_000) && truocVat(1_080_000) === 1_000_000)

// ─── dòng tiền: hai bất biến anh tự cộng trên thẻ ───
const ev = suKienTien(th.dots, payments)
const thangs = cacThangTu('2026-08', '2026-12')
const dt = dongTien(ev, thangs)
for (const o of dt) for (const k of ['dich_vu', 'thu_ho', 'tong']) {
  const t = o[k]
  kiem(`(1) cộng trừ khớp ${o.thang} ${k}`, t.ton_dau + t.phat_sinh - t.da_thu === t.chuyen)
}
for (let i = 1; i < dt.length; i++) kiem(`(2) chuyển kỳ sau ${dt[i - 1].thang} = tồn đầu ${dt[i].thang}`, dt[i - 1].tong.chuyen === dt[i].tong.ton_dau)
const t9 = dt.find(o => o.thang === '2026-09'), t10 = dt.find(o => o.thang === '2026-10'), t11 = dt.find(o => o.thang === '2026-11')
kiem('T9: phát sinh đợt 1, thu đủ', t9.tong.phat_sinh === 2_000_000 && t9.tong.da_thu === 2_000_000 && t9.tong.chuyen === 0, JSON.stringify(t9.tong))
kiem('T10: trả trước 1,5tr cộng-trừ ngay + đợt 2 đến hạn phần còn 1,5tr', t10.tong.phat_sinh === 3_000_000 && t10.tong.da_thu === 1_500_000 && t10.tong.chuyen === 1_500_000, JSON.stringify(t10.tong))
kiem('T11: thu 1tr còn 500k', t11.tong.da_thu === 1_000_000 && t11.tong.chuyen === 500_000, JSON.stringify(t11.tong))
kiem('đã thu của thẻ = tiền thật về', dt.reduce((a, o) => a + o.tong.da_thu, 0) === th.da_thu)
kiem('số dư cuối = nợ đến hạn', dt[dt.length - 1].tong.chuyen === th.no_den_han)
// Quý: chạy từ tháng giữa kỳ vẫn ra cùng số dư (tồn đầu tính từ mọi sự kiện trước)
const dtQuy = dongTien(ev, cacThangTu('2026-10', '2026-12'))
kiem('quý nối đúng: tồn đầu T10 chạy riêng = chạy từ T8', dtQuy[0].tong.ton_dau === t10.tong.ton_dau)
// Tổng nhân viên = tổng phòng: tách sự kiện theo hồ sơ của 2 người rồi cộng
const evB = suKienTien(th.dots.map(d => ({ ...d, id: 'x' + d.id })), payments.map(p => ({ ...p, installment_id: 'x' + p.installment_id })))
const phong = dongTien([...ev, ...evB], thangs), nv1 = dongTien(ev, thangs), nv2 = dongTien(evB, thangs)
kiem('(3) tổng nhân viên = tổng phòng', phong.every((o, i) => o.tong.chuyen === nv1[i].tong.chuyen + nv2[i].tong.chuyen && o.tong.da_thu === nv1[i].tong.da_thu + nv2[i].tong.da_thu))
// Khoản thu không gắn đợt
const evRoi = suKienTien([], [{ installment_id: null, amount_dich_vu: 300_000, amount_thu_ho: 0, paid_at: '2026-11-02' }])
const dtRoi = dongTien(evRoi, ['2026-11'])
kiem('thu không gắn đợt: phát sinh = thu, dư 0', dtRoi[0].tong.phat_sinh === 300_000 && dtRoi[0].tong.chuyen === 0)

console.log(loi ? `✗ ${loi}/${dem} kiểm sai` : `✓ ${dem} kiểm đúng`)
process.exit(loi ? 1 : 0)
