// KIỂM CHỨNG luật chặn thu vượt phí (lib/feeCap.js) trên TOÀN BỘ dữ liệu công nợ đã có,
// TRƯỚC khi bật chặn thật ở app/api/admin/save-debt/route.js.
//
//   node scripts/check-cap-dryrun.mjs
//
// Chạy lại sau mỗi lần sửa luật để chắc chắn không chặn oan khoản thu hợp lệ nào.
// Chỉ ĐỌC dữ liệu, không ghi gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolveFeeForMonthWithSource } from '../lib/feeDue.js'
import { evaluateCap, CAP_OK, CAP_UNVERIFIABLE, CAP_SPLIT, CAP_EXCESS } from '../lib/feeCap.js'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

async function fetchAll(table, columns, filter) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = s.from(table).select(columns).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(table + ': ' + error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const [paid, feePlans, clients, changeLog] = await Promise.all([
  fetchAll('service_fees', 'client_id,year,month,amount,type,note', q => q.eq('type', 'ketoan')),
  fetchAll('service_fees', 'client_id,year,month,amount,type', q => q.eq('type', 'fee_plan')),
  fetchAll('clients', 'id,name,client_code,monthly_fee,fee_period'),
  fetchAll('client_change_log', 'id,client_id,old_value,changed_at,entity,action',
    q => q.eq('entity', 'monthly_fee').eq('action', 'update')),
])

const clientById = new Map(clients.map(c => [c.id, c]))
const paidPeriodsByClient = new Map()
for (const r of paid) {
  if (!paidPeriodsByClient.has(r.client_id)) paidPeriodsByClient.set(r.client_id, new Set())
  paidPeriodsByClient.get(r.client_id).add(r.year * 12 + r.month)
}

const buckets = { [CAP_OK]: [], [CAP_UNVERIFIABLE]: [], [CAP_SPLIT]: [], [CAP_EXCESS]: [] }

for (const row of paid) {
  const c = clientById.get(row.client_id)
  if (!c) continue
  const { fee, reliable } = resolveFeeForMonthWithSource(
    feePlans, row.client_id, row.year, row.month, c.monthly_fee, changeLog)
  const verdict = evaluateCap({
    amount: row.amount, fee, reliable, year: row.year, month: row.month,
    paidPeriods: paidPeriodsByClient.get(row.client_id) || new Set(),
  })
  buckets[verdict.kind].push({ row, c, fee, verdict })
}

console.log('Đã xét ' + paid.length + ' khoản thu phí kế toán đã ghi nhận.\n')
console.log('  Hợp lệ, không đụng tới:            ' + buckets[CAP_OK].length)
console.log('  Cảnh báo nhưng VẪN LƯU (phí        ' + buckets[CAP_UNVERIFIABLE].length)
console.log('    không tra được đáng tin)')
console.log('  Đề nghị RẢI ĐỀU ra nhiều kỳ:       ' + buckets[CAP_SPLIT].length)
console.log('  Đề nghị tách phần dư sang Nợ tồn:  ' + buckets[CAP_EXCESS].length)

for (const [kind, title] of [
  [CAP_SPLIT, 'ĐỀ NGHỊ RẢI ĐỀU (khách trả gộp nhiều kỳ)'],
  [CAP_EXCESS, 'ĐỀ NGHỊ TÁCH PHẦN DƯ SANG NỢ TỒN'],
  [CAP_UNVERIFIABLE, 'CHỈ CẢNH BÁO — không chặn (phí kỳ không xác minh được)'],
]) {
  if (!buckets[kind].length) continue
  console.log('\n── ' + title)
  for (const b of buckets[kind]) {
    console.log('   T' + b.row.month + '/' + b.row.year + '  ' + (b.c.client_code || '—') + '  ' + b.c.name)
    console.log('     thu ' + fmt(b.row.amount) + 'đ / phí kỳ ' + fmt(b.fee) + 'đ')
    if (b.verdict.kind === CAP_SPLIT) {
      console.log('     -> rải ' + b.verdict.periods + ' kỳ × ' + fmt(b.verdict.perPeriod) + 'đ: '
        + b.verdict.suggestedPeriods.map(p => 'T' + p.month + '/' + p.year).join(', '))
    }
    if (b.verdict.kind === CAP_EXCESS) {
      console.log('     -> ghi ' + fmt(b.verdict.feeForPeriod) + 'đ + đẩy ' + fmt(b.verdict.excess) + 'đ sang Nợ tồn cũ')
    }
  }
}

const wronglyBlocked = buckets[CAP_UNVERIFIABLE].length
console.log('\n' + (buckets[CAP_SPLIT].length + buckets[CAP_EXCESS].length === 0
  ? '==> Không còn khoản nào bị luật chặn từ chối.'
  : '==> ' + (buckets[CAP_SPLIT].length + buckets[CAP_EXCESS].length) + ' khoản sẽ được luật hướng dẫn xử lý lại (không phải từ chối cứng).')
  + (wronglyBlocked ? '\n    ' + wronglyBlocked + ' khoản chỉ cảnh báo, KHÔNG bị chặn — đúng ý đồ lớp 1.' : ''))
