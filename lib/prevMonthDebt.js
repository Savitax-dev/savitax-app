// Cảnh báo "tháng trước chưa thu mà vẫn còn hạn ghi nhận".
//
// Vì sao cần: khách thường trả tiền của tháng trước vào đầu tháng sau. Nhân viên mở hồ sơ ra thấy
// đang ở tháng hiện tại rồi ghi luôn vào đó — tiền của T8 nằm ở ô T8 thì không sao, nhưng nằm ở ô
// T9 thì T8 vĩnh viễn là "chưa thu": %-KPI tháng 8 tụt oan, và qua ngày 10/9 hệ thống tự ghi T8
// thành "nợ tồn" -> sinh nợ ảo cho khoản tiền khách đã trả rồi.
//
// Bằng chứng trên dữ liệu thật (2026-09-07): 18 lượt trong năm 2026 có dạng tháng trước ghi 0đ,
// tháng sau ghi ĐÚNG BẰNG phí tháng trước — trong đó có CÔNG TY TNHH TUYỂN DỤNG NHÂN SỰ VIỆT
// (T6 ghi 0đ, T7 ghi đúng 6.480.000đ).
//
// Hàm THUẦN: không đụng database, để test được mà không phải ghi vào dữ liệu thật.

import { feeCountsForMonth, isPastEditDeadline } from './feeDue.js'

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

// Tháng liền trước của (year, month).
export function prevMonthOf(year, month) {
  let y = Number(year), m = Number(month) - 1
  if (m === 0) { m = 12; y -= 1 }
  return { year: y, month: m }
}

// Trả null nếu KHÔNG cần cảnh báo, hoặc { year, month, fee, paid, remain, message } nếu cần.
//
// Chỉ cảnh báo khi đủ CẢ 5 điều kiện — thiếu một cái là hỏi oan, mà hỏi oan nhiều lần thì nhân
// viên bấm cho qua theo phản xạ và cảnh báo mất tác dụng:
//   1. đang ghi cho ĐÚNG THÁNG HIỆN TẠI (ghi cho tháng cũ thì họ đã chủ đích chọn tháng rồi)
//   2. tháng trước CÓ phí phải thu (công ty thu theo quý không bị hỏi vào tháng giữa quý)
//   3. tháng trước chưa thu đủ
//   4. tháng trước CÒN hạn ghi nhận (quá hạn rồi thì phải đi đường "Nợ tồn cũ", không ghi ngược)
//   5. số tiền đang ghi > 0
export function checkPrevMonthUnpaid({
  year, month, amount, feePeriod, prevFee, prevPaid, clientName, label = 'phí dịch vụ kế toán',
  now = new Date(),
}) {
  const y = Number(year), m = Number(month)
  const amt = Number(amount) || 0
  if (amt <= 0) return null

  const curY = now.getFullYear(), curM = now.getMonth() + 1
  if (y !== curY || m !== curM) return null

  const prev = prevMonthOf(y, m)
  if (!feeCountsForMonth(feePeriod, prev.year, prev.month, now)) return null
  if (isPastEditDeadline(prev.year, prev.month, now)) return null

  const fee = Number(prevFee) || 0
  const paid = Number(prevPaid) || 0
  if (fee <= 0 || paid >= fee) return null

  const remain = fee - paid
  const label1 = 'T' + prev.month + '/' + prev.year
  const label2 = 'T' + m + '/' + y
  const who = clientName ? clientName + ' ' : ''
  const message =
    who + 'chưa thu đủ ' + label + ' ' + label1 + ' — còn thiếu ' + fmt(remain) + 'đ'
    + (paid > 0 ? ' (đã thu ' + fmt(paid) + '/' + fmt(fee) + 'đ)' : '') + '.\n'
    + 'Kỳ ' + label1 + ' vẫn còn hạn ghi nhận đến hết ngày 10/' + m + '.\n\n'
    + 'Khoản ' + fmt(amt) + 'đ này là tiền của tháng nào?'

  return { year: prev.year, month: prev.month, fee, paid, remain, targetLabel: label1, currentLabel: label2, message }
}
