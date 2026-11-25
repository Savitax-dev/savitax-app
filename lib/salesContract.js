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
//   chiKyKinhDoanh — true = CHỈ phần việc của Phòng Kinh doanh (anh chốt 25/11/2026: "phòng kd
//              đâu có nhiệm vụ thu"). Kỳ phí tháng từ kỳ 2 trở đi do phòng nghiệp vụ thu nên
//              không được cộng vào "cần thu / còn thiếu" của Phòng Kinh doanh. Kỳ đã ghi lần thu
//              thì vẫn hiện, không giấu tiền đã nhập.
// Trả { kys: [{ month, due, paid, left, payments }], canThu, daThu, conLai }.
// Chỉ giữ kỳ có tiền (cần thu > 0 hoặc đã thu > 0) — hợp đồng chỉ thu một lần sẽ không đẻ ra hàng
// chục dòng 0 đồng.
export function trackContract({ items, payments, upto, chiKyKinhDoanh = false } = {}) {
  const ds = (items || []).filter(it => it && it.to_savitax !== false)
  const tra = (payments || []).map(p => ({ ...p, net: num(p.net != null ? p.net : netFromGross(p.gross, p.vat_rate)) }))
  const moc = [...ds.map(it => it.start_month), ...tra.map(p => p.due_month)].filter(isMonth)
  if (!moc.length) return { kys: [], canThu: 0, daThu: 0, conLai: 0 }
  const dau = moc.reduce((a, b) => (b < a ? b : a))
  const het = [isMonth(upto) ? upto : monthVN(), ...moc].reduce((a, b) => (b > a ? b : a))
  const kys = []
  for (const month of monthRange(dau, het)) {
    const canTat = dueInMonth(ds, month)
    // salesDue: phần của kỳ này thuộc Phòng Kinh doanh (phí tháng chỉ kỳ đầu).
    const canKD = salesDueInMonth(ds, month)
    const lan = tra.filter(p => p.due_month === month)
    const da = lan.reduce((a, p) => a + p.net, 0)
    if (!canTat && !da) continue
    if (chiKyKinhDoanh && !canKD && !da) continue
    const can = chiKyKinhDoanh ? canKD : canTat
    kys.push({ month, due: can, paid: da, left: can - da, payments: lan, salesDue: canKD, dueAll: canTat })
  }
  const canThu = kys.reduce((a, k) => a + k.due, 0)
  const daThu = kys.reduce((a, k) => a + k.paid, 0)
  // Số kỳ bị bỏ ra vì thuộc phòng khác — giao diện ghi một dòng cho người dùng khỏi tưởng mất dữ liệu.
  const kyPhongKhac = chiKyKinhDoanh
    ? monthRange(dau, het).filter(m => dueInMonth(ds, m) > 0 && !salesDueInMonth(ds, m) && !tra.some(p => p.due_month === m)).length
    : 0
  return { kys, canThu, daThu, conLai: canThu - daThu, kyPhongKhac }
}

// ── Doanh số của NHÂN VIÊN KINH DOANH ────────────────────────────────────────
// Anh chốt 21/11/2026: NVKD chỉ ăn doanh số THÁNG ĐẦU TIÊN của phí hằng tháng.
//   · Phí HẰNG THÁNG  -> chỉ kỳ đầu tiên (tháng = start_month) mới vào doanh số; từ kỳ 2 trở đi
//     vẫn theo dõi công nợ bình thường nhưng KHÔNG tính cho NVKD nữa.
//   · Một lần / thu dồn / mỗi năm -> tính HẾT, rơi vào kỳ nào cũng tính (BCTC năm, ghi tăng BHXH…).
//   · Khách trả chậm vẫn tính, vào THÁNG TIỀN VỀ (giữ nguyên quy tắc cũ).
// Lý do: hợp đồng chạy nhiều năm, nếu tháng nào cũng cộng thì thưởng phình mãi dù người bán
// không làm gì thêm.

// Phần CẦN THU của một kỳ được tính doanh số cho NVKD.
export function salesDueInMonth(items, month) {
  // Dòng bị tắt "Tính HH kinh doanh" vẫn nằm trong CẦN THU (công nợ) nhưng không vào doanh số.
  const ds = (items || []).filter(it => it.tinh_hoa_hong !== false)
  const dauTien = ds.filter(it => it.billing === 'monthly' && it.start_month === month)
  const motLan = ds.filter(it => it.billing !== 'monthly')
  return dueInMonth(dauTien, month) + dueInMonth(motLan, month)
}

// Tỷ lệ tiền của một kỳ được tính doanh số (kỳ có thể vừa có phí tháng vừa có khoản một lần —
// ca Gau Gau tháng 3: 35tr phí tháng + 254tr BCTC). Khách trả một phần thì chia theo tỷ lệ cơ cấu
// kỳ đó. Kỳ không còn khoản nào (bảng phí sửa sau khi đã thu) -> tính hết, không nuốt tiền thật.
export function salesShare(items, month) {
  const tong = dueInMonth(items || [], month)
  if (tong <= 0) return 1
  return Math.min(1, salesDueInMonth(items, month) / tong)
}

const netOf = p => num(p.net != null ? p.net : netFromGross(p.gross, p.vat_rate))

// Phần của một lần thu được tính vào doanh số NVKD. itemsByQuote: Map(quote_id -> dòng phí).
export function salesNet(p, itemsByQuote) {
  const items = itemsByQuote ? (itemsByQuote.get ? itemsByQuote.get(p.quote_id) : itemsByQuote[p.quote_id]) : null
  return Math.round(netOf(p) * salesShare(items || [], p.due_month))
}

// Doanh số (chưa VAT) theo NGƯỜI, trong THÁNG TIỀN VỀ. Nền của báo cáo thưởng (đợt 4).
export function revenueByStaff(payments, month, itemsByQuote) {
  const out = new Map()
  for (const p of payments || []) {
    if (p.paid_month !== month) continue
    const tien = salesNet(p, itemsByQuote)
    if (!tien) continue
    const id = p.staff_id || null
    out.set(id, (out.get(id) || 0) + tien)
  }
  return out
}

// Tổng doanh số NVKD (chưa VAT) trong một tháng — mọi người gộp lại.
export function revenueInMonth(payments, month, itemsByQuote) {
  let s = 0
  for (const p of payments || []) if (p.paid_month === month) s += salesNet(p, itemsByQuote)
  return s
}

// Tổng tiền THỰC THU trong tháng, không cắt gì — dùng cho công nợ, không phải doanh số NVKD.
export function collectedInMonth(payments, month) {
  let s = 0
  for (const p of payments || []) if (p.paid_month === month) s += netOf(p)
  return s
}

export { isMonth }
