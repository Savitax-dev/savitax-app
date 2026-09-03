// CHỈ ĐỌC — xem trước những dòng "nợ tồn phí HCNS" mà ensureHcnsRollovers sẽ ghi khi deploy.
// Không ghi gì vào database.
//
//   node scripts/check-hcns-rollover-dryrun.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { isPastRolloverDeadline, resolveFeeForMonth } from '../lib/feeDue.js'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const now = new Date()
const Y = now.getFullYear(), M = now.getMonth() + 1

const months = []
{ let y = Y, m = M - 1
  for (let i = 0; i < 24; i++) { if (m === 0) { m = 12; y-- } months.push({ year: y, month: m }); m-- } }

const { data: links } = await s.from('hcns_clients')
  .select('id, linked_client_id, name, hcns_fee, fee_period, created_at')
  .eq('category', 'thoi_ky').eq('is_active', true).not('linked_client_id', 'is', null)

console.log('Công ty Thời kỳ đang bật DV HCNS: ' + (links || []).length + '\n')
if (!links?.length) process.exit(0)

const { data: fees } = await s.from('hcns_service_fees')
  .select('hcns_client_id, year, month, amount, type').in('hcns_client_id', links.map(l => l.id))
const paid = new Map(), plans = []
for (const f of fees || []) {
  if (f.type === 'hcns') paid.set(f.hcns_client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)
  else if (f.type === 'fee_plan') plans.push({ ...f, client_id: f.hcns_client_id })
}

const { data: clients } = await s.from('clients').select('id, name, other_debt')
  .in('id', links.map(l => l.linked_client_id))
const cById = new Map((clients || []).map(c => [c.id, c]))

let total = 0, rows = 0
for (const l of links) {
  const live = Number(l.hcns_fee) || 0
  const created = l.created_at ? new Date(l.created_at) : null
  const createdYM = created ? created.getFullYear() * 12 + created.getMonth() : -Infinity
  const hits = []
  for (const { year, month } of months) {
    if (year * 12 + (month - 1) < createdYM) continue
    if (live <= 0) continue
    if (!isPastRolloverDeadline(l.fee_period, year, month, now)) continue
    const fee = resolveFeeForMonth(plans, l.id, year, month, live, [])
    const short = fee - (paid.get(l.id + '_' + year + '_' + month) || 0)
    if (short > 0) hits.push({ year, month, fee, short })
  }
  const c = cById.get(l.linked_client_id)
  const sum = hits.reduce((a, h) => a + h.short, 0)
  total += sum; rows += hits.length
  console.log((c?.name || l.name) + '  [phí HCNS ' + fmt(live) + 'đ/' + (l.fee_period === 'quarterly' ? 'quý' : 'tháng')
    + ', bật DV từ ' + (created ? created.toISOString().slice(0, 10) : '?') + ']')
  console.log('   nợ tồn hiện tại: ' + fmt(c?.other_debt) + 'đ  →  sẽ cộng thêm ' + fmt(sum) + 'đ')
  if (hits.length === 0) console.log('   (không sinh dòng nào)')
  for (const h of hits) console.log('   + T' + h.month + '/' + h.year + ': phí ' + fmt(h.fee) + 'đ, thiếu ' + fmt(h.short) + 'đ')
  console.log()
}
console.log('TỔNG: ' + rows + ' dòng nợ tồn mới, ' + fmt(total) + 'đ cộng vào clients.other_debt')
