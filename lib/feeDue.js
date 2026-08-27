// Xác định công ty có "đến hạn thu phí" trong 1 tháng cụ thể hay không, dựa trên fee_period —
// công ty quý (fee_period='quarterly') chỉ thu 1 lần/quý (monthly_fee = tiền cả quý), không thu
// hàng tháng, nên tháng 1-2 của mỗi quý không được tính là "chưa thu" (chưa tới hạn).
// Ghi rõ đuôi .js để file này import được cả từ script node thuần (scripts/*.mjs), phục vụ
// việc kiểm chứng công thức phí trên dữ liệu thật — webpack/Next vẫn resolve như cũ.
import { startedByMonth } from './contractDates.js'

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

// Tra đúng mức phí ÁP DỤNG cho (clientId, year, month) từ lịch sử đổi phí (service_fees
// type='fee_plan', mỗi dòng đánh dấu "từ tháng X trở đi phí = Y") — dùng khi tính công nợ của
// MỘT THÁNG QUÁ KHỨ cụ thể, tránh lấy nhầm clients.monthly_fee (luôn là giá SỐNG/mới nhất) làm
// phí cho tháng cũ khiến đổi phí hôm nay tính sai lại công nợ các tháng trước đó.
// feePlanRows: mảng đã fetch sẵn [{client_id,year,month,amount}], không cần sort trước.
// changeLogRows: mảng client_change_log [{client_id,old_value,changed_at}] (entity='monthly_fee',
// action='update') — dùng để tra phí GỐC trước lần đổi ĐẦU TIÊN, cho trường hợp tháng đang xét
// còn sớm hơn mọi dòng fee_plan hiện có (nếu chỉ fallback về monthly_fee sống sẽ sai, vì đó là
// giá đã đổi SAU thời điểm đang xét, không phải giá gốc lúc đó).
export function resolveFeeForMonth(feePlanRows, clientId, year, month, fallbackFee, changeLogRows = []) {
  return resolveFeeForMonthWithSource(feePlanRows, clientId, year, month, fallbackFee, changeLogRows).fee
}

// Giống resolveFeeForMonth nhưng trả kèm NGUỒN của con số, vì không phải nguồn nào cũng đáng tin:
//   'fee_plan'  — có dòng fee_plan tại/trước tháng đang xét. ĐÁNG TIN.
//   'live'      — công ty chưa từng đổi phí, dùng thẳng monthly_fee hiện tại. ĐÁNG TIN.
//   'changelog' — tháng đang xét SỚM HƠN mọi dòng fee_plan, phải lấy old_value của lần đổi phí
//                 đầu tiên. KHÔNG đáng tin: đó chỉ là giá trị còn sót trước lần đổi đầu, thường
//                 không phải phí thật của tháng đó (ca thật: HOÀNG TIẾN SÀI GÒN tra ra 6.000.000
//                 trong khi phí thật của T4+T5/2026 là 15.000.000 — lệch 2,5 lần).
//
// Hiển thị %-KPI thì dùng nguồn nào cũng chấp nhận được. Nhưng mọi tính năng CHẶN/TỪ CHỐI dựa
// trên phí thì BẮT BUỘC kiểm `reliable` trước, nếu không sẽ chặn oan các tháng cũ của công ty
// từng đổi phí.
export function resolveFeeForMonthWithSource(feePlanRows, clientId, year, month, fallbackFee, changeLogRows = []) {
  const target = year * 12 + month
  let best = null, bestKey = -Infinity
  for (const r of feePlanRows) {
    if (r.client_id !== clientId) continue
    const key = r.year * 12 + r.month
    if (key <= target && key > bestKey) { bestKey = key; best = r }
  }
  if (best) return { fee: Number(best.amount) || 0, source: 'fee_plan', reliable: true }

  let earliestChange = null
  for (const r of changeLogRows) {
    if (r.client_id !== clientId) continue
    if (!earliestChange || new Date(r.changed_at) < new Date(earliestChange.changed_at)) earliestChange = r
  }
  if (earliestChange) return { fee: Number(earliestChange.old_value) || 0, source: 'changelog', reliable: false }
  return { fee: Number(fallbackFee) || 0, source: 'live', reliable: true }
}

// Hạn chót được phép SỬA TAY công nợ đã ghi nhận cho 1 tháng cụ thể — hoàn toàn KHÁC với
// feeCountsForMonth (dùng để tính %-KPI, không đổi gì ở đây). Áp dụng CHUNG cho mọi loại công ty
// (tháng lẫn quý), không phân biệt fee_period: được sửa tới hết ngày `graceDays` của tháng kế
// tiếp; qua đó phải chuyển sang cập nhật ở "Nợ tồn cũ" (debtRollover.js tự xử lý phần chưa thu).
export function isPastEditDeadline(year, month, now = new Date(), graceDays = 10) {
  return now > new Date(year, month, graceDays, 23, 59, 59, 999)
}

// Hạn chót TRƯỚC KHI 1 kỳ (tháng hoặc quý) chưa thu đủ bị TỰ ĐỘNG chuyển thành "nợ tồn cũ"
// (xem ensureRollovers ở lib/debtRollover.js) — áp dụng CHUNG 10 ngày cho cả công ty tháng lẫn
// quý, cùng mốc với isPastEditDeadline ở trên (đúng lúc không sửa tay được nữa thì cũng là lúc
// chuyển nợ tồn). HOÀN TOÀN KHÁC feeCountsForMonth/feeCollectionDeadline phía trên — 2 hàm đó
// dùng để hiển thị %-KPI/doanh thu REAL-TIME (Trang chủ, Báo cáo KPI, Phòng nghiệp vụ) và KHÔNG
// được đổi, để tháng/quý đang diễn ra vẫn hiện tiến độ ngay lập tức như hiện tại, không phải chờ
// qua ngày 10 mới thấy số.
export function isPastRolloverDeadline(feePeriod, year, month, now = new Date(), graceDays = 10) {
  if (!isFeeDueMonth(feePeriod, month)) return false
  return now > new Date(year, month, graceDays, 23, 59, 59, 999)
}
