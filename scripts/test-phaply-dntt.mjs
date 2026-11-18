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
console.log(ok + ' đạt, ' + hong + ' hỏng')
process.exit(hong ? 1 : 0)
