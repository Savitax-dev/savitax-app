// Hạn hoàn thành dịch vụ hồ sơ HCNS — dùng chung cho server, trình duyệt và script.
//
// Quy tắc (Giám đốc chốt 2026-09-22): đếm NGÀY LỊCH, BỎ chủ nhật. Ngày nhận hồ sơ là ngày thứ 1.
//   Nhận thứ 3 01/09/2026, 7 ngày → 01,02,03,04,05, (CN 06 bỏ), 07, 08 → hạn thứ 3 08/09.
//   Nhận đúng chủ nhật → bắt đầu đếm từ thứ 2.
// Ngày dạng chuỗi 'YYYY-MM-DD', tính theo lịch thuần (UTC) để không lệch múi giờ.

export function hcnsDueDate(receivedAt, slaDays) {
  const n = Number(slaDays)
  if (!receivedAt || !n || n < 1) return null
  const d = new Date(String(receivedAt).slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d)) return null
  let counted = 0
  for (;;) {
    if (d.getUTCDay() !== 0) counted += 1
    if (counted >= n) break
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

// Số ngày xử lý đọc từ ghi chú mẫu: lấy SỐ LỚN NHẤT ("7-10 ngày" → 10, "14 -30" → 30,
// "1 tháng" → 30). Chỉ dùng để điền sẵn — người quản lý sửa lại ở trang Checklist HCNS.
export function slaDaysFromNote(note) {
  // Ghi chú chia đoạn bằng "·". Chỉ đọc đoạn nói về thời gian XỬ LÝ ("Khoảng…", "Thời gian…",
  // "Từ 10-14 ngày", "Tổng thời gian dự kiến…") — các đoạn còn lại là hạn nộp của người lao động
  // /doanh nghiệp ("Trong 45 ngày từ khi đi làm lại", "từ ngày 28 tháng trước"), không phải hạn mình.
  const parts = String(note || '').toLowerCase().split('·').map(x => x.trim())
  const pick = parts.filter(p => /^(khoảng|từ \d|thời gian|tổng thời gian)/.test(p))
  let best = null
  for (const p of pick) {
    for (const m of p.matchAll(/(\d+)\s*(?:[-–]\s*(\d+))?\s*(ngày|tháng)/g)) {
      const v = Number(m[2] || m[1]) * (m[3] === 'tháng' ? 30 : 1)
      if (best === null || v > best) best = v
    }
  }
  return best
}

// Trạng thái hạn của 1 dịch vụ tại thời điểm `now`.
//   { kind: 'none' }                         chưa có hạn
//   { kind: 'open', daysLeft }               đang làm, còn N ngày (0 = hôm nay là hạn)
//   { kind: 'late', daysLate }               đang làm, đã quá hạn
//   { kind: 'done_ok' | 'done_late', days }  đã xong (đúng hạn / trễ N ngày)
export function hcnsDueState(svc, now = new Date()) {
  if (!svc?.due_at) return { kind: 'none' }
  const due = new Date(svc.due_at + 'T00:00:00Z')
  const dayOf = (t) => {
    // Quy về ngày theo giờ VN (UTC+7) rồi so như lịch thuần.
    const v = new Date(new Date(t).getTime() + 7 * 3600 * 1000)
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()))
  }
  const diff = (a, b) => Math.round((a - b) / 86400000)
  if (svc.status === 'hoan_thanh') {
    const at = svc.completed_at ? dayOf(svc.completed_at) : null
    if (!at) return { kind: 'done_ok', days: 0 }
    const late = diff(at, due)
    return late > 0 ? { kind: 'done_late', days: late } : { kind: 'done_ok', days: 0 }
  }
  const left = diff(due, dayOf(now))
  return left >= 0 ? { kind: 'open', daysLeft: left } : { kind: 'late', daysLate: -left }
}
