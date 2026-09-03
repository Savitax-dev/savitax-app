// Chuyển phí HCNS thu thiếu của các tháng đã qua thành "nợ tồn", giống hệt cách phí kế toán đang
// làm ở lib/debtRollover.js — nhân viên kế toán là người thu cả hai khoản, nên nợ tồn dồn về
// CÙNG một chỗ (clients.other_debt + debt_rollovers) để thu một lần ở tab "Nợ tồn cũ".
//
// Dòng ghi ra mang source='hcns' để phân biệt với dòng phí kế toán của cùng công ty cùng tháng —
// xem sql/11_debt_rollover_source.sql.
//
// ⚠ RÀNG BUỘC CLONE-APP: bản clone không có bảng hcns_*. Mọi lỗi thiếu bảng/cột ở đây phải bị
// NUỐT, tuyệt đối không làm hỏng rollover phí kế toán vốn đang chạy đúng trên production.

import { isPastRolloverDeadline, resolveFeeForMonth } from './feeDue.js'

const MONTHS_BACK = 24

function pastMonths(currentYear, currentMonth, count) {
  const months = []
  let y = currentYear, m = currentMonth - 1
  for (let i = 0; i < count; i++) {
    if (m === 0) { m = 12; y -= 1 }
    months.push({ year: y, month: m })
    m -= 1
  }
  return months
}

// Trả về { inserted, deltaByClient } — hoặc null nếu module HCNS chưa cài (bản clone).
export async function ensureHcnsRollovers(supabase, clientIds, currentYear, currentMonth) {
  if (!clientIds || clientIds.length === 0) return null

  // 1) Công ty kế toán nào đang bật DV HCNS. Thiếu bảng -> bản clone, dừng im lặng.
  const { data: hcnsClients, error: hcnsErr } = await supabase.from('hcns_clients')
    .select('id, linked_client_id, hcns_fee, fee_period, created_at')
    .in('linked_client_id', clientIds).eq('category', 'thoi_ky').eq('is_active', true)
  if (hcnsErr || !hcnsClients || hcnsClients.length === 0) return null

  const hcnsIds = hcnsClients.map(h => h.id)
  const months = pastMonths(currentYear, currentMonth, MONTHS_BACK)
  const minYear = months[months.length - 1].year

  const [{ data: existing }, { data: feeRows }] = await Promise.all([
    supabase.from('debt_rollovers').select('client_id, year, month')
      .in('client_id', clientIds).eq('source', 'hcns').gte('year', minYear),
    supabase.from('hcns_service_fees').select('hcns_client_id, year, month, amount, type')
      .in('hcns_client_id', hcnsIds),
  ])

  const rolled = new Set((existing || []).map(r => r.client_id + '_' + r.year + '_' + r.month))
  const paid = new Map()
  const plans = []
  for (const f of feeRows || []) {
    if (f.type === 'hcns') paid.set(f.hcns_client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)
    // resolveFeeForMonth lọc theo trường client_id — đổi tên khoá cho khớp.
    else if (f.type === 'fee_plan') plans.push({ ...f, client_id: f.hcns_client_id })
  }

  const rows = []
  const deltaByClient = {}
  const now = new Date()

  for (const h of hcnsClients) {
    const liveFee = Number(h.hcns_fee) || 0
    if (liveFee <= 0) continue
    // Không bịa nợ cho những tháng TRƯỚC khi công ty bắt đầu dùng DV HCNS. Đây là cùng lớp bảo vệ
    // đã ngăn ~6 tỷ nợ ảo ở phí kế toán — mốc ở đây là ngày bật DV HCNS, không phải ngày mở công ty.
    const created = h.created_at ? new Date(h.created_at) : null
    const createdYM = created ? created.getFullYear() * 12 + created.getMonth() : -Infinity

    for (const { year, month } of months) {
      if (year * 12 + (month - 1) < createdYM) continue
      // Cùng luật khoan 10 ngày sang kỳ sau như phí kế toán.
      if (!isPastRolloverDeadline(h.fee_period, year, month, now)) continue
      if (rolled.has(h.linked_client_id + '_' + year + '_' + month)) continue

      // Không có changelog cho phí HCNS -> truyền mảng rỗng, rơi về hcns_fee sống là đúng.
      const fee = resolveFeeForMonth(plans, h.id, year, month, liveFee, [])
      const shortfall = fee - (paid.get(h.id + '_' + year + '_' + month) || 0)
      if (shortfall <= 0) continue

      rows.push({
        client_id: h.linked_client_id, year, month, source: 'hcns',
        rolled_amount: shortfall, remaining_amount: shortfall,
      })
      deltaByClient[h.linked_client_id] = (deltaByClient[h.linked_client_id] || 0) + shortfall
    }
  }

  if (rows.length === 0) return { inserted: 0, deltaByClient: {} }

  const { error: insErr } = await supabase.from('debt_rollovers').insert(rows)
  if (insErr) { console.error('ensureHcnsRollovers insert error:', insErr) ; return null }

  // Đọc lại other_debt NGAY TRƯỚC khi cộng — rollover phí kế toán vừa chạy xong cũng ghi vào cột
  // này, dùng lại số đọc từ đầu sẽ nuốt mất phần vừa cộng.
  const ids = Object.keys(deltaByClient)
  const { data: fresh } = await supabase.from('clients').select('id, other_debt').in('id', ids)
  const curById = new Map((fresh || []).map(c => [c.id, Number(c.other_debt) || 0]))
  await Promise.all(ids.map(id =>
    supabase.from('clients').update({ other_debt: (curById.get(id) || 0) + deltaByClient[id] }).eq('id', id)))

  return { inserted: rows.length, deltaByClient }
}
