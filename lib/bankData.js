// Nạp dữ liệu công nợ cho trang Đối soát ngân hàng — dùng chung cho route
// app/api/admin/bank-transactions và script kiểm chứng scripts/test-bank-match.mjs.
//
// Hai bước: (1) nạp danh sách công ty để đọc nội dung chuyển khoản, (2) chỉ nạp công nợ của ĐÚNG
// các công ty vừa nhận ra — không kéo cả bảng service_fees mỗi lần mở trang.

import { buildIndex, parseMemo, proposePlan, ST_UNKNOWN } from './bankMatch.js'

// PostgREST cắt im lặng ở 1000 dòng — luôn phân trang (xem project_postgrest_1000row_limit).
async function fetchAll(buildQuery, pageSize = 1000) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

const ymKey = (y, m) => Number(y) * 12 + Number(m)

export async function loadClientIndex(supabase) {
  const clients = await fetchAll(() => supabase.from('clients')
    .select('id, name, client_code, tax_code, monthly_fee, fee_period, other_debt, assigned_to, room_id, status')
    .order('id'))
  return { clients, index: buildIndex(clients), byId: new Map(clients.map(c => [c.id, c])) }
}

// Trả Map(clientId -> ctx) cho proposePlan.
export async function loadDebtContexts(supabase, clientIds, byId, now = new Date()) {
  const ids = [...new Set(clientIds.filter(Boolean))]
  const out = new Map()
  if (!ids.length) return out

  const [fees, chg, rolls] = await Promise.all([
    fetchAll(() => supabase.from('service_fees').select('client_id, year, month, amount, type')
      .in('client_id', ids).in('type', ['ketoan', 'fee_plan']).order('id')),
    fetchAll(() => supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', ids).eq('entity', 'monthly_fee').eq('action', 'update').order('id')),
    fetchAll(() => supabase.from('debt_rollovers').select('client_id, year, month, source')
      .in('client_id', ids).order('id')),
  ])

  // HCNS — bản clone không có bảng, bỏ qua im lặng.
  let hcs = [], hfees = []
  try {
    const { data, error } = await supabase.from('hcns_clients')
      .select('id, linked_client_id, hcns_fee, fee_period, created_at')
      .in('linked_client_id', ids).eq('category', 'thoi_ky').eq('is_active', true)
    if (!error) hcs = data || []
    if (hcs.length) {
      hfees = await fetchAll(() => supabase.from('hcns_service_fees')
        .select('hcns_client_id, year, month, amount, type')
        .in('hcns_client_id', hcs.map(h => h.id)).in('type', ['hcns', 'fee_plan']).order('id'))
    }
  } catch (_) { hcs = []; hfees = [] }

  for (const id of ids) {
    const client = byId.get(id)
    if (!client) continue
    const ktPlans = fees.filter(f => f.client_id === id && f.type === 'fee_plan')
    const ktPaid = new Map()
    for (const f of fees) {
      if (f.client_id !== id || f.type !== 'ketoan') continue
      const k = ymKey(f.year, f.month)
      ktPaid.set(k, (ktPaid.get(k) || 0) + (Number(f.amount) || 0))
    }
    const rolled = new Set(rolls.filter(r => r.client_id === id)
      .map(r => (r.source || 'ketoan') + ':' + ymKey(r.year, r.month)))

    let hc = null
    const h = hcs.find(x => x.linked_client_id === id)
    if (h) {
      const paid = new Map()
      const plans = []
      for (const f of hfees) {
        if (f.hcns_client_id !== h.id) continue
        if (f.type === 'hcns') {
          const k = ymKey(f.year, f.month)
          paid.set(k, (paid.get(k) || 0) + (Number(f.amount) || 0))
        } else plans.push({ ...f, client_id: f.hcns_client_id })
      }
      hc = { ...h, plans, paid }
    }
    out.set(id, {
      client, ktPlans, ktChg: chg.filter(c => c.client_id === id), ktPaid, rolled, hc, now,
    })
  }
  return out
}

// Phân loại danh sách giao dịch (dòng bảng bank_transactions). Công ty/kỳ chọn tay (client_id,
// period_*) được ưu tiên hơn kết quả đọc nội dung.
export async function classifyTransactions(supabase, txs, now = new Date()) {
  const { index, byId } = await loadClientIndex(supabase)
  const parsed = txs.map(tx => {
    const p = parseMemo(tx.memo || '', index, tx.tx_time)
    if (tx.client_id && byId.get(tx.client_id)) {
      p.client = byId.get(tx.client_id); p.via = 'manual'; p.ambiguous = []
    }
    if (tx.period_year && tx.period_month) {
      p.period = { year: tx.period_year, month: tx.period_month }; p.periodFromMemo = true
    }
    return p
  })
  const ctxs = await loadDebtContexts(supabase, parsed.map(p => p.client?.id), byId, now)
  return txs.map((tx, i) => {
    const p = parsed[i]
    const base = {
      client: p.client ? { id: p.client.id, name: p.client.name, client_code: p.client.client_code, tax_code: p.client.tax_code } : null,
      via: p.via, hl: p.hl, period: p.period, periodFromMemo: p.periodFromMemo,
      ambiguous: p.ambiguous.map(c => ({ id: c.id, name: c.name })),
    }
    if (!p.client) {
      return { ...base, status: ST_UNKNOWN, plan: null, info: null,
        reason: p.ambiguous.length ? 'Mã trùng nhiều công ty — chọn đúng công ty' : 'Không nhận ra công ty — chọn tay' }
    }
    const ctx = ctxs.get(p.client.id)
    const r = proposePlan(tx.amount, p, ctx)
    return { ...base, ...r, otherDebt: Number(p.client.other_debt) || 0 }
  })
}
