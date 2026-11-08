// Theo dõi hợp đồng — khách đã trả bao nhiêu, tháng nào, còn thiếu bao nhiêu (đề xuất Phòng Kinh
// doanh 04/11/2026, mục "Sửa 3"). Hàm thuần, không đụng DB/DOM: dùng chung cho trình duyệt, route
// API (tính lại khi lưu, không tin số trình duyệt gửi) và script kiểm thử.
//
// HAI THÁNG KHÁC NHAU, đừng lẫn:
//   due_month  — KỲ PHÍ: khoản này đáng lẽ thu của tháng nào (lấy từ bảng khoản phí của báo giá).
//   paid_month — THÁNG TIỀN VỀ: tiền thực sự vào tài khoản tháng nào → DOANH SỐ tính cho tháng này.
// Chốt tháng 10 mà khách trả nốt tháng 11 thì phần đó là doanh số tháng 11 (anh Lộc nêu rõ trong
// ví dụ RESINVA / Gau Gau).
//
// Người lập nhập SỐ TIỀN VỀ TÀI KHOẢN (đã gồm VAT); app tự chia cho (1 + thuế suất) ra số chưa VAT
// — đây mới là số tính doanh số và thưởng (sếp Huyền đã chốt).
import { dueInMonth, monthVN } from './salesItems.js'

export const VAT_DEFAULT = 8

const num = v => { const n = Math.round(Number(v) || 0); return n > 0 ? n : 0 }
const isMonth = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''))

// Tiền về đã gồm VAT -> số chưa VAT. VD 16.200.000 / 1,08 = 15.000.000.
export function netFromGross(gross, vat = VAT_DEFAULT) {
  const v = Number(vat)
  const ty = 1 + (Number.isFinite(v) && v > 0 ? v : 0) / 100
  return Math.round(num(gross) / ty)
}
// Ngược lại — dùng khi muốn gợi ý "cần thu bao nhiêu vào tài khoản" cho một khoản chưa VAT.
export function grossFromNet(net, vat = VAT_DEFAULT) {
  const v = Number(vat)
  return Math.round(num(net) * (1 + (Number.isFinite(v) && v > 0 ? v : 0) / 100))
}

export function addMonths(month, n) {
  if (!isMonth(month)) return month
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + Math.round(Number(n) || 0)
  const ny = y + Math.floor(m / 12)
  const nm = ((m % 12) + 12) % 12 + 1
  return ny + '-' + String(nm).padStart(2, '0')
}
// Danh sách tháng liên tiếp từ a tới b (tính cả hai đầu). Chặn 240 tháng cho khỏi lặp vô tận khi
// dữ liệu hỏng.
export function monthRange(a, b) {
  if (!isMonth(a) || !isMonth(b) || b < a) return []
  const out = []
  for (let m = a; m <= b && out.length < 240; m = addMonths(m, 1)) out.push(m)
  return out
}

// Chuẩn hoá một lần thu nhận từ trình duyệt. net LUÔN tính lại từ gross — không tin số gửi lên.
export function normalizePayment(raw, fallbackMonth) {
  const thang = isMonth(fallbackMonth) ? fallbackMonth : monthVN()
  const vatRaw = Number(raw?.vat_rate)
  const vat = Number.isFinite(vatRaw) && vatRaw >= 0 ? vatRaw : VAT_DEFAULT
  const gross = num(raw?.gross)
  return {
    due_month: isMonth(raw?.due_month) ? raw.due_month : thang,
    paid_month: isMonth(raw?.paid_month) ? raw.paid_month : thang,
    gross,
    vat_rate: vat,
    net: netFromGross(gross, vat),
    note: String(raw?.note || '').trim() || null,
  }
}

// Bảng theo dõi của MỘT hợp đồng.
//   items    — bảng khoản phí của báo giá (sales_quote_items)
//   payments — các lần thu đã ghi
//   upto     — tính kỳ tới tháng nào (mặc định tháng này); hợp đồng có phí tháng thì mỗi tháng
//              tự sinh thêm một kỳ, không phải nhập tay.
// Trả { kys: [{ month, due, paid, left, payments }], canThu, daThu, conLai }.
// Chỉ giữ kỳ có tiền (cần thu > 0 hoặc đã thu > 0) — hợp đồng chỉ thu một lần sẽ không đẻ ra hàng
// chục dòng 0 đồng.
export function trackContract({ items, payments, upto } = {}) {
  const ds = (items || []).filter(it => it && it.to_savitax !== false)
  const tra = (payments || []).map(p => ({ ...p, net: num(p.net != null ? p.net : netFromGross(p.gross, p.vat_rate)) }))
  const moc = [...ds.map(it => it.start_month), ...tra.map(p => p.due_month)].filter(isMonth)
  if (!moc.length) return { kys: [], canThu: 0, daThu: 0, conLai: 0 }
  const dau = moc.reduce((a, b) => (b < a ? b : a))
  const het = [isMonth(upto) ? upto : monthVN(), ...moc].reduce((a, b) => (b > a ? b : a))
  const kys = []
  for (const month of monthRange(dau, het)) {
    const can = dueInMonth(ds, month)
    const lan = tra.filter(p => p.due_month === month)
    const da = lan.reduce((a, p) => a + p.net, 0)
    if (!can && !da) continue
    kys.push({ month, due: can, paid: da, left: can - da, payments: lan })
  }
  const canThu = kys.reduce((a, k) => a + k.due, 0)
  const daThu = kys.reduce((a, k) => a + k.paid, 0)
  return { kys, canThu, daThu, conLai: canThu - daThu }
}

// Doanh số (chưa VAT) theo NGƯỜI, trong THÁNG TIỀN VỀ. Nền của báo cáo thưởng (đợt 4).
export function revenueByStaff(payments, month) {
  const out = new Map()
  for (const p of payments || []) {
    if (p.paid_month !== month) continue
    const id = p.staff_id || null
    out.set(id, (out.get(id) || 0) + num(p.net != null ? p.net : netFromGross(p.gross, p.vat_rate)))
  }
  return out
}

// Tổng tiền đã thu (chưa VAT) trong một tháng — mọi người gộp lại.
export function revenueInMonth(payments, month) {
  let s = 0
  for (const p of payments || []) if (p.paid_month === month) s += num(p.net != null ? p.net : netFromGross(p.gross, p.vat_rate))
  return s
}

export { isMonth }
