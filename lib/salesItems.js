// Bảng khoản phí của một báo giá — mỗi khoản thu một dòng, nói rõ CÁCH THU (đề xuất Phòng Kinh
// doanh 04/11/2026). Hàm thuần, không đụng DB/DOM: dùng chung cho trình duyệt, route API (tính lại
// khi lưu, không tin số trình duyệt gửi) và script kiểm thử.
//
// Vì sao cần: trước đây mỗi báo giá chỉ có MỘT ô "Phí/tháng" nên khoản thu một lần cũng bị cộng vào
// mọi tháng — doanh số và thưởng sai (ca RESINVA, Minh Trang, Gau Gau).
import { MISA_PACKAGES, money, vnd } from './salesPricing.js'

export const BILLINGS = [
  { k: 'monthly', label: 'Hằng tháng', short: 'tháng', hint: 'tháng nào cũng thu' },
  { k: 'once', label: 'Một lần', short: 'một lần', hint: 'chỉ thu ở tháng đã ghi' },
  { k: 'yearly', label: 'Mỗi năm', short: 'năm', hint: 'thu lại sau mỗi 12 tháng' },
  { k: 'multi', label: 'Thu dồn nhiều tháng', short: 'thu dồn', hint: 'tiền 1 tháng × số tháng, thu 1 lần' },
]
export const billingOf = k => BILLINGS.find(b => b.k === k) || BILLINGS[0]

const num = v => { const n = Math.round(Number(v) || 0); return n > 0 ? n : 0 }
const isMonthStr = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''))

// 'YYYY-MM' của hôm nay theo giờ Việt Nam (server Vercel chạy UTC).
export function monthVN(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .format(d).slice(0, 7)
}

// Thành tiền THỰC THU của một dòng tại lần thu của nó (thu dồn = tiền tháng × số tháng).
export function lineTotal(it) {
  const amount = num(it.amount)
  return it.billing === 'multi' ? amount * Math.max(1, Math.round(Number(it.months) || 1)) : amount
}

// Chuẩn hoá danh sách dòng phí nhận từ trình duyệt: ép kiểu, bỏ dòng trống, đánh lại thứ tự.
export function normalizeItems(input, fallbackMonth) {
  const month = isMonthStr(fallbackMonth) ? fallbackMonth : monthVN()
  return (Array.isArray(input) ? input : [])
    .map(raw => {
      const service = String(raw?.service || '').trim()
      const billing = BILLINGS.some(b => b.k === raw?.billing) ? raw.billing : 'monthly'
      const months = billing === 'multi' ? Math.max(1, Math.round(Number(raw?.months) || 1)) : null
      return {
        service,
        billing,
        amount: num(raw?.amount),
        months,
        start_month: isMonthStr(raw?.start_month) ? raw.start_month : month,
        to_savitax: raw?.to_savitax !== false,
        standard_amount: raw?.standard_amount == null ? null : num(raw.standard_amount),
        note: String(raw?.note || '').trim() || null,
      }
    })
    // Dòng chưa đặt tên dịch vụ là dòng bỏ dở — không lưu. Tiền 0 thì VẪN giữ: phí hoàn thuế 3%
    // chưa biết số, nhập sau (đề xuất mục "Sửa 1").
    .filter(it => it.service)
    .map((it, i) => ({ ...it, sort_order: i }))
}

// 3 con số của báo giá. CHỈ cộng khoản tiền về Savitax — khoản khách trả thẳng bên thứ ba (MISA)
// vẫn in cho khách nhưng không phải doanh số của Savitax; trả riêng ở `other` để giao diện nói rõ.
// year1 = 12 tháng đầu: phí tháng × 12 + các khoản một lần + khoản mỗi năm (thu 1 lần trong năm đầu).
export function totalsFromItems(items) {
  const t = { monthly: 0, once: 0, yearly: 0, year1: 0, other: { monthly: 0, once: 0, yearly: 0, year1: 0 } }
  for (const it of items || []) {
    const box = it.to_savitax === false ? t.other : t
    const total = lineTotal(it)
    if (it.billing === 'monthly') box.monthly += num(it.amount)
    else if (it.billing === 'yearly') box.yearly += num(it.amount)
    else box.once += total // once + multi
  }
  t.year1 = t.monthly * 12 + t.once + t.yearly
  t.other.year1 = t.other.monthly * 12 + t.other.once + t.other.yearly
  return t
}

// Số tiền khách phải trả trong MỘT tháng cụ thể ('YYYY-MM') theo dòng phí — nền của Theo dõi hợp
// đồng (đợt 3) và báo cáo doanh số (đợt 4).
export function dueInMonth(items, month, { onlySavitax = true } = {}) {
  let sum = 0
  for (const it of items || []) {
    if (onlySavitax && it.to_savitax === false) continue
    const start = isMonthStr(it.start_month) ? it.start_month : null
    if (!start || month < start) continue
    if (it.billing === 'monthly') sum += num(it.amount)
    else if (it.billing === 'yearly') { if (monthsBetween(start, month) % 12 === 0) sum += num(it.amount) }
    else if (month === start) sum += lineTotal(it)
  }
  return sum
}
function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

// Dựng sẵn bảng dòng phí từ kết quả biểu phí (computeFees) để người lập chỉ việc sửa, không gõ lại.
// Dòng phí tháng → Hằng tháng; BCTC/quyết toán năm → Mỗi năm.
//
// KHÔNG lấy mục "Dịch vụ tùy chọn theo nhu cầu" (fees.optional): đó là khoản CHÀO THÊM, khách chưa
// đồng ý — gom vào đây là thổi phồng doanh số (ca 110902 bị cộng oan 3,2tr/tháng tiền rà soát sổ
// sách khi thử nạp 2026-11-07). Khách chốt khoản nào thì người lập tự thêm dòng.
// Truyền includeOptional: true nếu muốn lấy cả (có đánh dấu rõ là khoản tùy chọn).
//
// monthlyFinal: mức phí tháng THẬT đã báo khách. Khác tổng biểu phí (báo giá có đề xuất giá riêng)
// thì phần chênh dồn vào dòng kế toán trọn gói — cùng quy tắc với bảng in trong file Word.
export function itemsFromFees(fees, { month, includeOptional = false, monthlyFinal = null } = {}) {
  const start = isMonthStr(month) ? month : monthVN()
  const out = []
  for (const l of fees?.lines || []) {
    out.push({
      service: l.label,
      billing: l.yearly ? 'yearly' : 'monthly',
      amount: num(l.fee),
      months: null,
      start_month: start,
      to_savitax: true,
      standard_amount: num(l.fee),
      note: null,
    })
  }
  if (includeOptional) {
    for (const o of fees?.optional || []) {
      const misa = MISA_PACKAGES.some(m => o.label.startsWith(m.label))
      out.push({
        service: o.label,
        billing: o.unit === 'tháng' ? 'monthly' : o.unit === 'năm' ? 'yearly' : 'once',
        amount: num(o.fee),
        months: null,
        start_month: start,
        to_savitax: !(misa || o.toMisa),
        standard_amount: o.negotiable ? null : num(o.fee),
        note: o.note || (o.negotiable ? 'Báo phí riêng — nhập số tiền sau khi thống nhất với khách' : null),
      })
    }
  }
  // Tổng phí tháng phải khớp mức ĐÃ BÁO KHÁCH: dồn chênh vào dòng hằng tháng lớn nhất; nếu dồn hết
  // mà vẫn âm (giảm nhiều hơn một dòng chịu nổi — ca Soft Buddy, Blue Sea) thì chia theo tỷ lệ cho
  // mọi dòng hằng tháng. Dòng nào bị đổi đều ghi rõ mức biểu phí gốc để người lập soát lại.
  if (monthlyFinal != null) {
    const thang = out.filter(i => i.billing === 'monthly')
    const tong = thang.reduce((a, i) => a + i.amount, 0)
    const dich = num(monthlyFinal)
    if (thang.length && tong !== dich) {
      const ghi = it => { it.note = 'Mức báo khách khác biểu phí (biểu phí ' + money(it.standard_amount) + ')' }
      const lon = thang.reduce((a, b2) => (b2.amount > a.amount ? b2 : a), thang[0])
      if (lon.amount + (dich - tong) >= 0) {
        lon.amount += dich - tong
        ghi(lon)
      } else if (tong > 0) {
        const con = thang.filter(i => i !== lon)
        con.forEach(it => { it.amount = Math.round(it.amount * dich / tong); ghi(it) })
        lon.amount = Math.max(0, dich - con.reduce((a, i) => a + i.amount, 0))
        ghi(lon)
      }
    }
  }
  return out.map((it, i) => ({ ...it, sort_order: i }))
}

// Dòng nào báo khác biểu phí thì phải có lý do — người lập tự ghi, sếp xem khi duyệt.
export function itemsNeedingReason(items) {
  return (items || []).filter(it => it.standard_amount != null && num(it.amount) !== num(it.standard_amount) && !it.note)
}

// Mô tả ngắn một dòng để in ra giao diện/nhật ký: "Ghi tăng BHXH — Một lần 4.000.000 đ · 11/2026".
export function describeItem(it) {
  const b = billingOf(it.billing)
  const tien = it.billing === 'multi'
    ? money(it.amount) + ' × ' + (it.months || 1) + ' tháng = ' + money(lineTotal(it))
    : money(it.amount)
  const thang = it.start_month ? ' · ' + it.start_month.slice(5) + '/' + it.start_month.slice(0, 4) : ''
  return it.service + ' — ' + b.label + ' ' + tien + thang + (it.to_savitax === false ? ' · không về Savitax' : '')
}

export { vnd }
