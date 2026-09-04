// Tính các giá trị ngày tháng cho hợp đồng dịch vụ.

const pad2 = (n) => String(n).padStart(2, '0')

// Parse 'YYYY-MM-DD' (hoặc Date) -> Date (giữ ngày, không lệch timezone)
function toDate(d) {
  if (!d) return null
  if (d instanceof Date) return d
  const m = String(d).slice(0, 10).split('-')
  if (m.length !== 3) return null
  return new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]))
}

// Ngày kết thúc HĐ 12 tháng = ngày bắt đầu + 1 năm − 1 ngày.
// 01/01/2026 -> 31/12/2026; 01/05/2026 -> 30/04/2027.
export function contractEndDate(start) {
  const s = toDate(start)
  if (!s) return null
  const e = new Date(s.getFullYear() + 1, s.getMonth(), s.getDate())
  e.setDate(e.getDate() - 1)
  return e
}

// Số HĐ: DDMM/YYYY/HĐTVT-SAVITAX/{client_code}
export function contractNumber(start, clientCode) {
  const s = toDate(start) || new Date()
  return pad2(s.getDate()) + pad2(s.getMonth() + 1) + '/' + s.getFullYear() +
    '/HĐTVT-SAVITAX/' + (clientCode || '')
}

// Định dạng ngày kiểu Việt: "ngày 01 tháng 01 năm 2026"
export function viFullDate(d) {
  const dt = toDate(d)
  if (!dt) return ''
  return 'ngày ' + pad2(dt.getDate()) + ' tháng ' + pad2(dt.getMonth() + 1) + ' năm ' + dt.getFullYear()
}

// "01/01/2026"
export function viShortDate(d) {
  const dt = toDate(d)
  if (!dt) return ''
  return pad2(dt.getDate()) + '/' + pad2(dt.getMonth() + 1) + '/' + dt.getFullYear()
}

// Công ty có được tính cho (year, month) không, dựa trên ngày bắt đầu hợp đồng.
// contract_start null/rỗng -> tính mọi tháng (công ty cũ, tương thích ngược).
// Có contract_start -> chỉ tính từ tháng của contract_start trở đi.
export function startedByMonth(contractStart, year, month) {
  const s = toDate(contractStart)
  if (!s) return true
  const startIdx = s.getFullYear() * 12 + s.getMonth() // month 0-based
  const viewIdx  = year * 12 + (month - 1)
  return viewIdx >= startIdx
}

export { toDate }

// Công ty có được tính cho (year, month) không, dựa trên THÁNG ĐƯỢC NHẬP LÊN APP (clients.created_at).
// Lý do (2026-09-01): rất nhiều công ty được nhập vào app với "Ngày bắt đầu hợp đồng" để lùi nhiều
// năm (145/286 cty, có cty ghi HĐ từ 2019) — app hiểu nhầm là họ nợ phí suốt từ đó, sinh nợ ảo và
// kéo %-công việc tháng cũ xuống sai (T6/2026 chỉ còn 4% vì 230 cty bị tính 0% trong khi tháng đó
// còn chưa có trên app). Đây ĐÚNG BẰNG chốt chặn mà lib/debtRollover.js đã dùng sẵn cho nợ tồn,
// nay áp thống nhất cho cả công nợ lẫn checklist công việc.
// created_at null/không đọc được -> tính mọi tháng (an toàn, không tự loại dữ liệu).
export function enteredAppByMonth(createdAt, year, month) {
  if (!createdAt) return true
  const d = new Date(createdAt)
  if (isNaN(d.getTime())) return true
  return (year * 12 + (month - 1)) >= (d.getFullYear() * 12 + d.getMonth())
}

// Chốt chặn CHUNG: công ty chỉ được tính phí/công nợ/công việc cho tháng đang xem khi vừa đã tới
// mốc hợp đồng, vừa đã có mặt trên app. Truyền nguyên object client (cần contract_start + created_at).
export function countsForMonth(client, year, month) {
  if (!client) return false
  return startedByMonth(client.contract_start, year, month) &&
         enteredAppByMonth(client.created_at, year, month)
}
