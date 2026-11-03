// Chia tiền thu của MỘT hồ sơ HCNS Thời điểm / Vãng lai vào từng dịch vụ (dùng chung: trang công nợ hồ sơ
// app/api/admin/hcns/case-payments, thưởng Dịch vụ khác của nhân viên HCNS lib/luong/dvkHcns.js).
// Khoản thu ghi riêng cho dịch vụ → tính thẳng vào dịch vụ đó. Khoản "thu chung cho cả hồ sơ" → trừ lần lượt
// vào các dịch vụ còn thiếu, dịch vụ NHẬN TRƯỚC trừ trước.
// services: [{ id, cost, received_at, created_at }] — mọi dịch vụ của hồ sơ; payments: [{ case_service_id, amount }].
// Trả Map(id dịch vụ → { cost, direct, shared, remain }).
export function allocatePayments(services, payments) {
  const out = new Map()
  const list = [...(services || [])].sort((a, b) =>
    String(a.received_at || a.created_at || '').localeCompare(String(b.received_at || b.created_at || '')))
  for (const s of list) {
    const direct = (payments || []).filter(p => p.case_service_id === s.id)
      .reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const cost = Number(s.cost) || 0
    out.set(s.id, { cost, direct, shared: 0, remain: Math.max(0, cost - direct) })
  }
  let pool = (payments || []).filter(p => !p.case_service_id).reduce((a, p) => a + (Number(p.amount) || 0), 0)
  for (const s of list) {
    if (pool <= 0) break
    const a = out.get(s.id)
    const take = Math.min(pool, a.remain)
    a.shared += take; a.remain -= take; pool -= take
  }
  return out
}
