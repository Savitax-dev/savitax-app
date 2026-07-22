// Tự động chuyển phần phí kế toán thu thiếu của các tháng đã qua thành "nợ tồn"
// (clients.other_debt), ghi lại trong debt_rollovers để tránh tính trùng khi
// khách thanh toán lùi cho đúng tháng đó (xem app/api/admin/save-debt/route.js).
//
// Chạy lazy (idempotent) mỗi khi các trang công nợ tải dữ liệu của THÁNG HIỆN TẠI —
// không cần cron. Nếu app không được mở trong một tháng, phần rollover của tháng đó
// sẽ được bù khi mở lại vì hàm quét tối đa 24 tháng gần nhất.

import { feeCountsForMonth, resolveFeeForMonth } from './feeDue'

const MONTHS_BACK = 24

function pastMonths(currentYear, currentMonth, count) {
  const months = []
  let y = currentYear, m = currentMonth
  for (let i = 0; i < count; i++) {
    m--
    if (m === 0) { m = 12; y-- }
    months.push({ year: y, month: m })
  }
  return months
}

// Chỉ gọi khi đang xem đúng tháng hiện tại thực tế (gọi từ route, không gọi khi xem lại tháng cũ).
export async function ensureRollovers(supabase, clientIds, currentYear, currentMonth) {
  if (!clientIds || clientIds.length === 0) return

  const months = pastMonths(currentYear, currentMonth, MONTHS_BACK)
  if (months.length === 0) return
  const minYear = months[months.length - 1].year

  const [{ data: clients }, { data: existingRollovers }, { data: feesKetoan }, { data: feePlanRows }, { data: changeLogRows }] = await Promise.all([
    supabase.from('clients').select('id, monthly_fee, other_debt, created_at, fee_period').in('id', clientIds),
    supabase.from('debt_rollovers').select('client_id, year, month').in('client_id', clientIds).gte('year', minYear),
    supabase.from('service_fees').select('client_id, year, month, amount')
      .in('client_id', clientIds).eq('type', 'ketoan').gte('year', minYear),
    // Không giới hạn năm — cần cả dòng cũ hơn minYear để biết đúng phí của tháng đầu trong
    // khoảng quét (dòng fee_plan gần nhất <= tháng đang xét có thể nằm trước minYear).
    supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', clientIds).eq('type', 'fee_plan'),
    // Phí gốc trước lần đổi đầu tiên (cho tháng còn sớm hơn mọi dòng fee_plan) — xem resolveFeeForMonth.
    supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', clientIds).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])

  const rolledSet = new Set((existingRollovers || []).map(r => r.client_id + '_' + r.year + '_' + r.month))
  const feeCollected = {}
  for (const f of (feesKetoan || [])) feeCollected[f.client_id + '_' + f.year + '_' + f.month] = Number(f.amount) || 0

  const newRollovers = []
  const debtDeltaByClient = {}
  const now = new Date()

  for (const c of (clients || [])) {
    const fee = Number(c.monthly_fee) || 0
    if (fee <= 0) continue
    // Không rollover các tháng TRƯỚC khi công ty được thêm vào hệ thống — tránh tự bịa
    // ra "nợ tồn" cho thời gian công ty chưa tồn tại (vd công ty mới tạo tháng này).
    const created = c.created_at ? new Date(c.created_at) : null
    const createdYM = created ? created.getFullYear() * 12 + created.getMonth() : -Infinity
    for (const { year, month } of months) {
      if (year * 12 + (month - 1) < createdYM) continue
      // Công ty thu phí theo quý (fee_period='quarterly', monthly_fee = tiền cả quý): tháng
      // không phải cuối quý không tính là "đến hạn", và tháng cuối quý còn 2 ngày khoan sang
      // đầu quý sau — bỏ qua, không tự ghi "nợ tồn" khi chưa thật sự quá hạn.
      if (!feeCountsForMonth(c.fee_period, year, month, now)) continue
      const key = c.id + '_' + year + '_' + month
      if (rolledSet.has(key)) continue
      const collected = feeCollected[key] || 0
      // Phí ĐÚNG của tháng này (không phải monthly_fee sống nếu công ty đã đổi phí sau đó).
      const feeForThisMonth = resolveFeeForMonth(feePlanRows || [], c.id, year, month, fee, changeLogRows || [])
      const shortfall = feeForThisMonth - collected
      if (shortfall <= 0) continue
      newRollovers.push({ client_id: c.id, year, month, rolled_amount: shortfall, remaining_amount: shortfall })
      debtDeltaByClient[c.id] = (debtDeltaByClient[c.id] || 0) + shortfall
    }
  }

  if (newRollovers.length === 0) return

  const { error: insertError } = await supabase.from('debt_rollovers').insert(newRollovers)
  if (insertError) {
    console.error('ensureRollovers insert error:', insertError)
    return
  }

  const clientById = {}
  for (const c of (clients || [])) clientById[c.id] = c

  await Promise.all(Object.entries(debtDeltaByClient).map(([clientId, delta]) => {
    const current = Number(clientById[clientId]?.other_debt) || 0
    return supabase.from('clients').update({ other_debt: current + delta }).eq('id', clientId)
  }))
}
