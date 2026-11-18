// Kiểm số liệu phiếu ĐNTT pháp lý (lib/phaply/dntt.js) — offline: node scripts/test-phaply-dntt.mjs
// Số chuẩn lấy từ bản Excel phòng pháp lý đã gửi khách 01/04/2026 (B1 2.200.000 · B2 1.500.000 · VAT 296.000 · C 3.996.000).
import { soLieuDntt } from '../lib/phaply/dntt.js'
import { tongHopHoSo } from '../lib/phaply/tien.js'
let ok = 0, hong = 0
const k = (dk, t, ct = '') => dk ? ok++ : (hong++, console.log('✗', t, ct))
// mẫu phòng: TLM (2,2tr) + HSPLBĐ (1,5tr) gồm VAT? Bản phòng ghi 2,2tr + 1,5tr chưa VAT, VAT 296.000 → gồm VAT 3.996.000
const fees = [{ kind: 'dich_vu', name: 'Phí thủ tục hành chính thành lập Công ty tại Sở Tài chính (GPKD + Dấu)', amount: 2376000 },
  { kind: 'dich_vu', name: 'Phí thực hiện hồ sơ pháp lý ban đầu trên Cơ quan Thuế', amount: 1620000 }]
const t0 = tongHopHoSo({ hoSo: {}, fees, dots: [], payments: [] })
const a = soLieuDntt({ fees, tien: t0 })
k(a.dong.map(x => x.ma + ':' + x.tien).join(' ') === 'B1:2200000 B2:1500000 B3:296000', 'khớp đúng bản phòng 01.04.2026 (B1, B2, VAT 296.000)', JSON.stringify(a.dong))
k(a.C === 3996000 && a.A === 0, 'C = 3.996.000', a.C)
// có thu hộ + đã trả một phần
const f2 = [...fees, { kind: 'thu_ho', name: 'Lệ phí đăng ký doanh nghiệp', amount: 50000 }]
const t2 = tongHopHoSo({ hoSo: {}, fees: f2, dots: [], payments: [{ amount_dich_vu: 1000000, amount_thu_ho: 0, paid_at: '2026-11-01' }] })
const b = soLieuDntt({ fees: f2, tien: t2 })
k(b.dong.at(-1).loai === 'thu_ho' && b.dong.at(-1).tien === 50000, 'thu hộ đứng riêng, không VAT')
k(b.daTra === 1000000 && b.C === 3996000 + 50000 - 1000000, 'trừ phần đã thanh toán', b.C)
// không có phí
k(soLieuDntt({ fees: [], tien: tongHopHoSo({ hoSo: {}, fees: [], dots: [], payments: [] }) }).tongB === 0, 'chưa có phí → tổng 0 (route báo nhập phí)')
// chọn từng khoản (hồ sơ chưa chia đợt)
const f3 = [{ id: 'p1', kind: 'dich_vu', name: 'Phí A', amount: 1080000 }, { id: 'p2', kind: 'dich_vu', name: 'Phí B', amount: 540000 }, { id: 'p3', kind: 'thu_ho', name: 'Lệ phí', amount: 50000 }]
const t3 = tongHopHoSo({ hoSo: {}, fees: f3, dots: [], payments: [{ amount_dich_vu: 100000, amount_thu_ho: 0, paid_at: '2026-11-01' }] })
const c = soLieuDntt({ fees: f3, tien: t3, khoan: ['p2', 'p3'] })
k(c.dong.map(x => x.ten + ':' + x.tien).join('|') === 'Phí B:500000|VAT 8%:40000|Lệ phí:50000' && c.daTra === 0 && c.C === 590000, 'chọn 2/3 khoản: chỉ in khoản được chọn, KHÔNG tự trừ tiền đã trả', JSON.stringify(c))
k(soLieuDntt({ fees: f3, tien: t3, khoan: ['p1', 'p2', 'p3'] }).daTra === 100000, 'chọn đủ khoản: trừ tiền đã trả')
// chọn từng đợt
const dots = [{ id: 'd1', seq: 1, name: 'Đợt 1', amount_dich_vu: 1080000, amount_thu_ho: 50000, due_date: '2026-11-01' },
  { id: 'd2', seq: 2, name: 'Đợt 2', amount_dich_vu: 540000, amount_thu_ho: 0, due_date: '2026-11-02' }]
const t4 = tongHopHoSo({ hoSo: {}, fees: f3, dots, payments: [], homNayISO: '2026-11-18' })
const e = soLieuDntt({ fees: f3, tien: t4, dots: ['d2'] })
k(e.A === 0 && e.C === 540000 && e.dong[0].ten.includes('Đợt 2'), 'chỉ tick đợt 2, không cộng nợ cũ → A = 0', JSON.stringify(e))
k(soLieuDntt({ fees: f3, tien: t4, dots: ['d2'], kemNoTruoc: true }).A === 1130000, 'tick "cộng nợ đợt trước" → A = nợ đợt 1')
const g = soLieuDntt({ fees: f3, tien: t4, dots: ['d1', 'd2'] })
k(g.dong.map(x => x.ten).join('|') === 'Phí A|Phí B|VAT 8%|Lệ phí' && g.C === 1670000, 'tick đủ các đợt → liệt kê từng khoản phí như bản phòng', JSON.stringify(g.dong))
k(soLieuDntt({ fees: f3, tien: t4, dots: ['khong-co'] }) === null, 'đợt không tồn tại → null (route 404)')

console.log(ok + ' đạt, ' + hong + ' hỏng')
process.exit(hong ? 1 : 0)
