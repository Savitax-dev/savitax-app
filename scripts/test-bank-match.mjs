// Kiểm chứng bộ nhận diện Đối soát ngân hàng trên DỮ LIỆU THẬT — CHỈ ĐỌC, không ghi gì.
//
//   node --env-file=.env.local scripts/test-bank-match.mjs <mau.json>
//
// mau.json: [{ "time": "2026-09-21T14:18:00+07:00", "amount": 3240000, "memo": "..." }, ...]
// File mẫu chứa nội dung chuyển khoản thật của khách -> để NGOÀI repo, không commit.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { classifyTransactions } from '../lib/bankData.js'
import { planTotals } from '../lib/bankMatch.js'

const file = process.argv[2]
if (!file) { console.error('Thiếu đường dẫn file mẫu'); process.exit(1) }
const samples = JSON.parse(readFileSync(file, 'utf8'))
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = n => Number(n || 0).toLocaleString('vi-VN')

const txs = samples.map(s => ({ memo: s.memo, amount: s.amount, tx_time: s.time }))
const res = await classifyTransactions(supabase, txs, samples[0]?.now ? new Date(samples[0].now) : new Date())
const count = {}
res.forEach((r, i) => {
  count[r.status] = (count[r.status] || 0) + 1
  const t = planTotals(r.plan)
  const hl = r.hl.map(h => samples[i].memo.slice(h.start, h.end) + '(' + h.kind[0] + ')').join(' ')
  console.log(String(i + 1).padStart(2), r.status.padEnd(7), fmt(samples[i].amount).padStart(11), '|',
    (r.client ? r.via + ': ' + r.client.name : '—').slice(0, 48).padEnd(48), '| T' + r.period.month + '/' + r.period.year)
  console.log('   ', r.reason, r.plan ? '| KT ' + fmt(t.ketoan) + ' HCNS ' + fmt(t.hcns) + ' NỢ TỒN ' + fmt(t.no_ton) : '', '| tô:', hl)
})
console.log('\nTổng', res.length, count)
