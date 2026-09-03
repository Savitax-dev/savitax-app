// Tự động chuyển phần phí kế toán thu thiếu của các tháng đã qua thành "nợ tồn"
// (clients.other_debt), ghi lại trong debt_rollovers để tránh tính trùng khi
// khách thanh toán lùi cho đúng tháng đó (xem app/api/admin/save-debt/route.js).
//
// Chạy lazy (idempotent) mỗi khi các trang công nợ tải dữ liệu của THÁNG HIỆN TẠI —
// không cần cron. Nếu app không được mở trong một tháng, phần rollover của tháng đó
// sẽ được bù khi mở lại vì hàm quét tối đa 24 tháng gần nhất.

import { isPastRolloverDeadline, resolveFeeForMonth } from './feeDue.js'
import { ensureHcnsRollovers } from './hcnsRollover.js'

const MONTHS_BACK = 24

// Supabase/PostgREST giới hạn TỐI ĐA 1000 dòng/query mặc định (im lặng cắt bớt, KHÔNG báo lỗi)
// — xem project_postgrest_1000row_limit trong memory. Hàm này được gọi với clientIds TOÀN CÔNG
// TY từ debt-overview/route.js, quét 24 tháng — hiện còn dư dả (~93 dòng) nhưng cùng rủi ro như
// kpi-overview/work-log đã dính lỗi thật, phân trang phòng ngừa.
async function fetchAllRows(buildQuery, pageSize = 1000) {
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

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

  const [{ data: clients }, existingRollovers, feesKetoan, feePlanRows, changeLogRows] = await Promise.all([
    supabase.from('clients').select('id, monthly_fee, other_debt, created_at, fee_period').in('id', clientIds),
    fetchAllRows(() => supabase.from('debt_rollovers').select('client_id, year, month')
      .in('client_id', clientIds).eq('source', 'ketoan').gte('year', minYear)),
    fetchAllRows(() => supabase.from('service_fees').select('client_id, year, month, amount')
      .in('client_id', clientIds).eq('type', 'ketoan').gte('year', minYear)),
    // Không giới hạn năm — cần cả dòng cũ hơn minYear để biết đúng phí của tháng đầu trong
    // khoảng quét (dòng fee_plan gần nhất <= tháng đang xét có thể nằm trước minYear).
    fetchAllRows(() => supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', clientIds).eq('type', 'fee_plan')),
    // Phí gốc trước lần đổi đầu tiên (cho tháng còn sớm hơn mọi dòng fee_plan) — xem resolveFeeForMonth.
    fetchAllRows(() => supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', clientIds).eq('entity', 'monthly_fee').eq('action', 'update')),
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
      // không phải cuối quý không tính là "đến hạn". Cả công ty tháng lẫn quý đều được khoan
      // 10 ngày sang kỳ sau trước khi tự ghi "nợ tồn" (isPastRolloverDeadline) — khác hẳn
      // %-KPI/doanh thu real-time ở các trang khác (vẫn dùng feeCountsForMonth, không đổi).
      if (!isPastRolloverDeadline(c.fee_period, year, month, now)) continue
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

  if (newRollovers.length > 0) {
    const { error: insertError } = await supabase.from('debt_rollovers')
      .insert(newRollovers.map(r => ({ ...r, source: 'ketoan' })))
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

  // Phí HCNS thu thiếu cũng chuyển thành nợ tồn, dồn về cùng clients.other_debt vì nhân viên kế
  // toán thu cả hai khoản. Chạy SAU để đọc được other_debt vừa cộng ở trên.
  // Bọc try/catch: bản clone không có bảng hcns_* — hỏng ở đây không được kéo đổ phần kế toán.
  try {
    await ensureHcnsRollovers(supabase, clientIds, currentYear, currentMonth)
  } catch (e) {
    console.error('ensureHcnsRollovers skipped:', e?.message || e)
  }
}

// Tính lại các dòng "nợ tồn tự động" đã ghi cho các tháng TỪ (fromYear, fromMonth) TRỞ ĐI.
//
// Vì sao cần: ensureRollovers ghi 1 dòng nợ tồn rồi KHÔNG bao giờ xét lại tháng đó nữa
// (`if (rolledSet.has(key)) continue`). Nếu sau đó phí của tháng đó bị sửa — điển hình là giảm
// giá áp lùi — dòng nợ tồn vẫn giữ số tính theo phí CŨ, và clients.other_debt treo một khoản nợ
// không có thật. Ca thật: KING DƯỢC ghi nợ tồn T7/2026 là 8.640.000đ theo phí cũ, trong khi phí
// đã giảm còn 3.240.000đ và đã thu 3.000.000đ — đúng ra chỉ còn thiếu 240.000đ.
//
// Gọi ngay sau khi ghi một mốc phí mới (service_fees type='fee_plan') ở app/api/admin/clients.
// Trả về danh sách thay đổi để route ghi log / trả cho giao diện.
export async function recomputeRolloversFrom(supabase, clientId, fromYear, fromMonth) {
  const from = Number(fromYear) * 12 + Number(fromMonth)

  const [{ data: client }, { data: rolls }, { data: plans }, { data: paid }, { data: chg }] = await Promise.all([
    supabase.from('clients').select('id, monthly_fee, other_debt').eq('id', clientId).maybeSingle(),
    supabase.from('debt_rollovers').select('id, year, month, rolled_amount, remaining_amount')
      .eq('client_id', clientId).eq('source', 'ketoan'),
    supabase.from('service_fees').select('client_id, year, month, amount').eq('client_id', clientId).eq('type', 'fee_plan'),
    supabase.from('service_fees').select('year, month, amount').eq('client_id', clientId).eq('type', 'ketoan'),
    supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .eq('client_id', clientId).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])
  if (!client) return []

  const paidMap = new Map((paid || []).map(p => [p.year * 12 + p.month, Number(p.amount) || 0]))
  const changes = []
  let debtDelta = 0

  for (const r of (rolls || [])) {
    if (r.year * 12 + r.month < from) continue
    const feeNow = resolveFeeForMonth(plans || [], clientId, r.year, r.month, client.monthly_fee, chg || [])
    const collected = paidMap.get(r.year * 12 + r.month) || 0
    const shouldRemain = Math.max(0, feeNow - collected)
    const remain = Number(r.remaining_amount) || 0

    // CHỈ hạ xuống khi đang ghi nợ NHIỀU HƠN thực tế. Không tự nâng lên: ghi ít hơn thường là do
    // khoản nợ tồn đó đã được thu qua tab "Nợ tồn cũ" (tạo dòng type='no_ton', không tạo dòng
    // 'ketoan' cho tháng gốc) — nâng lại sẽ dựng dậy khoản nợ khách đã trả.
    if (remain - shouldRemain <= 1) continue

    await supabase.from('debt_rollovers')
      .update({ rolled_amount: shouldRemain, remaining_amount: shouldRemain }).eq('id', r.id)
    debtDelta += (shouldRemain - remain)
    changes.push({ year: r.year, month: r.month, from: remain, to: shouldRemain })
  }

  if (debtDelta !== 0) {
    const current = Number(client.other_debt) || 0
    await supabase.from('clients')
      .update({ other_debt: Math.max(0, current + debtDelta) }).eq('id', clientId)
  }
  return changes
}

// Phân bổ một khoản THU NỢ TỒN vào các dòng debt_rollovers đang còn dư, CŨ NHẤT TRƯỚC.
//
// Vì sao cần: save-old-debt chỉ trừ clients.other_debt mà KHÔNG trừ remaining_amount của tháng
// gốc, nên hai con số lệch dần sau mỗi lần thu. Bình thường không lộ ra, nhưng khi phí của tháng
// đó bị sửa (đổi phí lùi) thì recomputeRolloversFrom đọc phải remaining đã lỗi thời -> tính sai.
// Ca thật KING DƯỢC: other_debt về 0 trong khi dòng nợ tồn T7/2026 vẫn treo 5.640.000đ.
//
// Phần dư sau khi đã trừ hết các dòng rollover là BÌNH THƯỜNG, không phải lỗi: clients.other_debt
// còn gồm khoản "Thu khác — Tồn đọng" nhập tay lúc tạo công ty, vốn không có dòng rollover nào.
export async function applyOldDebtPayment(supabase, clientId, amount) {
  let left = Number(amount) || 0
  if (left <= 0) return { applied: [], leftover: 0 }

  const { data: rolls } = await supabase.from('debt_rollovers')
    .select('id, year, month, remaining_amount')
    .eq('client_id', clientId).gt('remaining_amount', 0)
    .order('year', { ascending: true }).order('month', { ascending: true })

  const applied = []
  for (const r of (rolls || [])) {
    if (left <= 0) break
    const remain = Number(r.remaining_amount) || 0
    const take = Math.min(left, remain)
    if (take <= 0) continue
    const { error } = await supabase.from('debt_rollovers')
      .update({ remaining_amount: remain - take }).eq('id', r.id)
    if (error) continue
    applied.push({ year: r.year, month: r.month, from: remain, to: remain - take })
    left -= take
  }
  return { applied, leftover: left }
}
