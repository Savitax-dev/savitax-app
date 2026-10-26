// Bộ kiểm: trạng thái nghĩa vụ = hồ sơ TỐT NHẤT, không phụ thuộc thứ tự (lib/tokhaiTrangThai.js).
//   node scripts/test-tokhai-trang-thai.mjs
import { trangThaiTotNhat } from '../lib/tokhaiTrangThai.js'
let sai = 0
const kiem = (ten, thuc, mong) => { const ok = thuc === mong; if (!ok) sai++; console.log((ok ? '  OK   ' : '  SAI  ') + ten + (ok ? '' : ' → ' + thuc + ' (mong ' + mong + ')')) }
kiem('127HOME: mới nhất trước [chấp nhận, từ chối]', trangThaiTotNhat(['accepted', 'rejected']), 'accepted')
kiem('127HOME: cũ trước [từ chối, chấp nhận]', trangThaiTotNhat(['rejected', 'accepted']), 'accepted')
kiem('nộp lại đang chờ sau lần bị từ chối', trangThaiTotNhat(['rejected', 'received']), 'received')
kiem('chỉ bị từ chối', trangThaiTotNhat(['rejected', 'rejected']), 'rejected')
kiem('chấp nhận + đang chờ bổ sung', trangThaiTotNhat(['received', 'accepted']), 'accepted')
kiem('không có hồ sơ', trangThaiTotNhat([]), null)
kiem('nhãn lạ bị bỏ qua', trangThaiTotNhat(['xyz', 'rejected']), 'rejected')
console.log(sai ? '\n' + sai + ' ca SAI' : '\nTất cả đúng')
process.exit(sai ? 1 : 0)
