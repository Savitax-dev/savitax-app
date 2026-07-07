// Xác định công ty có "đến hạn thu phí" trong 1 tháng cụ thể hay không, dựa trên fee_period —
// công ty quý (fee_period='quarterly') chỉ thu 1 lần/quý (monthly_fee = tiền cả quý), không thu
// hàng tháng, nên tháng 1-2 của mỗi quý không được tính là "chưa thu" (chưa tới hạn).
import { startedByMonth } from './contractDates'

export function isFeeDueMonth(feePeriod, month) {
  return feePeriod !== 'quarterly' || month % 3 === 0
}

// Hạn chót ghi nhận thu cho kỳ kết thúc ở (year, dueMonth): cuối tháng đó + số ngày khoan sang
// tháng đầu kỳ sau. Công ty quý được khoan 2 ngày (vd quý 2 kết thúc T6 -> hạn chót 2/7); công
// ty tháng không có khoan (giữ nguyên hành vi cũ — hạn ngay cuối tháng).
export function feeCollectionDeadline(feePeriod, year, dueMonth) {
  const graceDays = feePeriod === 'quarterly' ? 2 : 0
  // dueMonth (1-indexed) truyền thẳng làm tham số month (0-indexed) của Date -> ra đúng ngày
  // graceDays của THÁNG KẾ TIẾP dueMonth.
  return new Date(year, dueMonth, graceDays, 23, 59, 59, 999)
}

// Công ty có tính vào tử/mẫu số công nợ của (year, month) đang xem hay không — so theo THỜI
// ĐIỂM THỰC (now), không phải tháng đang xem, để không phạt oan trong lúc còn hạn khoan.
// Công ty tháng: giữ NGUYÊN hành vi cũ — tính ngay từ đầu tháng, không có hạn khoan (grace chỉ
// áp dụng cho công ty quý, xem feeCollectionDeadline).
export function feeCountsForMonth(feePeriod, year, month, now = new Date()) {
  if (!isFeeDueMonth(feePeriod, month)) return false
  if (feePeriod !== 'quarterly') return true
  return now > feeCollectionDeadline(feePeriod, year, month)
}

// Số "kỳ thu phí" mà công ty tính vào công nợ trong danh sách tháng `months` (1 kỳ = 1 lần
// monthly_fee) — dùng cho các trang xem theo khoảng nhiều tháng (quý/năm). Công ty tháng: mỗi
// tháng đã bắt đầu hợp đồng = 1 kỳ (giữ nguyên hành vi cũ). Công ty quý: chỉ đếm tháng cuối quý
// đã bắt đầu hợp đồng VÀ đã qua hạn khoan — tránh nhân sai (x3 theo quý, x12 theo năm).
export function dueFeeMonthsCount(feePeriod, contractStart, year, months, now = new Date()) {
  return months.filter(m => startedByMonth(contractStart, year, m) && feeCountsForMonth(feePeriod, year, m, now)).length
}

// Hạn chót được phép SỬA TAY công nợ đã ghi nhận cho 1 tháng cụ thể — hoàn toàn KHÁC với
// feeCountsForMonth (dùng để tính %-KPI, không đổi gì ở đây). Áp dụng CHUNG cho mọi loại công ty
// (tháng lẫn quý), không phân biệt fee_period: được sửa tới hết ngày `graceDays` của tháng kế
// tiếp; qua đó phải chuyển sang cập nhật ở "Nợ tồn cũ" (debtRollover.js tự xử lý phần chưa thu).
export function isPastEditDeadline(year, month, now = new Date(), graceDays = 5) {
  return now > new Date(year, month, graceDays, 23, 59, 59, 999)
}
