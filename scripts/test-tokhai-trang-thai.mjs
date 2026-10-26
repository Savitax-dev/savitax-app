// Bộ kiểm: trạng thái nghĩa vụ = hồ sơ TỐT NHẤT, không phụ thuộc thứ tự (lib/tokhaiTrangThai.js).
//   node scripts/test-tokhai-trang-thai.mjs
import { trangThaiTotNhat, hoSoTotHon } from '../lib/tokhaiTrangThai.js'
import { dungCacO } from '../lib/tokhaiThongKe.js'
let sai = 0
const kiem = (ten, thuc, mong) => { const ok = thuc === mong; if (!ok) sai++; console.log((ok ? '  OK   ' : '  SAI  ') + ten + (ok ? '' : ' → ' + thuc + ' (mong ' + mong + ')')) }
kiem('127HOME: mới nhất trước [chấp nhận, từ chối]', trangThaiTotNhat(['accepted', 'rejected']), 'accepted')
kiem('127HOME: cũ trước [từ chối, chấp nhận]', trangThaiTotNhat(['rejected', 'accepted']), 'accepted')
kiem('nộp lại đang chờ sau lần bị từ chối', trangThaiTotNhat(['rejected', 'received']), 'received')
kiem('chỉ bị từ chối', trangThaiTotNhat(['rejected', 'rejected']), 'rejected')
kiem('chấp nhận + đang chờ bổ sung', trangThaiTotNhat(['received', 'accepted']), 'accepted')
kiem('không có hồ sơ', trangThaiTotNhat([]), null)
kiem('nhãn lạ bị bỏ qua', trangThaiTotNhat(['xyz', 'rejected']), 'rejected')
// Ô Lịch hạn nộp / thống kê: chọn hồ sơ đại diện, thứ tự nào cũng ra cùng kết quả
const tuChoi = { obligation_id: 'nv1', state: 'rejected', submitted_at: '2026-10-19T14:28', on_time: true }
const chapNhan = { obligation_id: 'nv1', state: 'accepted', submitted_at: '2026-10-20T15:57', on_time: true }
kiem('hồ sơ chấp nhận tốt hơn hồ sơ từ chối', hoSoTotHon(chapNhan, tuChoi), true)
kiem('hoà trạng thái → lần nộp mới hơn', hoSoTotHon({ state: 'received', submitted_at: '2026-10-20' }, { state: 'received', submitted_at: '2026-10-19' }), true)
const nv = [{ id: 'nv1', client_id: 'c', filing_type_id: 'gtgt', state: 'rejected', due_date: '2026-11-02' }]
kiem('thống kê: [chấp nhận, từ chối] → ô chấp nhận', dungCacO({ nghiaVu: nv, hoSo: [chapNhan, tuChoi], homNayISO: '2026-10-26' })[0].trangThai, 'accepted')
kiem('thống kê: [từ chối, chấp nhận] → ô chấp nhận', dungCacO({ nghiaVu: nv, hoSo: [tuChoi, chapNhan], homNayISO: '2026-10-26' })[0].trangThai, 'accepted')
console.log(sai ? '\n' + sai + ' ca SAI' : '\nTất cả đúng')
process.exit(sai ? 1 : 0)
