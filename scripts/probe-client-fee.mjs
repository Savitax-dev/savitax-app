// Soi toàn bộ lịch sử phí + các khoản đã thu của MỘT công ty, và mức phí mà resolveFeeForMonth
// tra ra cho từng kỳ. Dùng khi nghi số liệu công nợ/KPI của 1 công ty bị sai.
//
//   node scripts/probe-client-fee.mjs HOANGTIENSG      (theo mã khách hàng)
//   node scripts/probe-client-fee.mjs --name "LE NÂU"  (theo tên, khớp gần đúng)
//
// Chỉ ĐỌC dữ liệu, không ghi gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolveFeeForMonth } from '../lib/feeDue.js'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

const byName = process.argv[2] === '--name'
const term = byName ? process.argv[3] : (process.argv[2] || '')
if (!term) { console.log('Thiếu tham số. VD: node scripts/probe-client-fee.mjs HOANGTIENSG'); process.exit(1) }

const q = s.from('clients').select('*')
const { data: cs, error } = byName ? await q.ilike('name', '%' + term + '%') : await q.eq('client_code', term)
if (error) throw error
if (!cs.length) { console.log('Không tìm thấy công ty nào khớp: ' + term); process.exit(1) }
if (cs.length > 1) console.log('(khớp ' + cs.length + ' công ty, lấy công ty đầu tiên)\n')
const c = cs[0]

console.log('CÔNG TY: ' + c.name)
console.log('  Mã KH: ' + (c.client_code || '—') + '   MST: ' + (c.tax_code || '—'))
console.log('  Ngày bắt đầu hợp đồng: ' + (c.contract_start || '— (chưa nhập)'))
console.log('  Phí SỐNG hiện tại: ' + fmt(c.monthly_fee) + 'đ / ' + (c.fee_period === 'quarterly' ? 'Quý' : 'Tháng'))
console.log('  Nợ tồn: ' + fmt(c.other_debt) + 'đ')

const { data: plans } = await s.from('service_fees').select('year,month,amount,note')
  .eq('client_id', c.id).eq('type', 'fee_plan').order('year').order('month')
console.log('\nLỊCH SỬ ĐỔI PHÍ (service_fees type=fee_plan) — ' + plans.length + ' dòng:')
if (!plans.length) console.log('  (trống — chưa từng đổi phí qua nút "Điều chỉnh")')
for (const p of plans) {
  console.log('  từ T' + p.month + '/' + p.year + ' trở đi -> ' + fmt(p.amount) + 'đ' + (p.note ? '   (' + p.note + ')' : ''))
}

const { data: log } = await s.from('client_change_log').select('*')
  .eq('client_id', c.id).eq('entity', 'monthly_fee').order('changed_at')
console.log('\nNHẬT KÝ ĐỔI PHÍ (client_change_log) — ' + log.length + ' dòng:')
if (!log.length) console.log('  (trống)')
for (const l of log) {
  console.log('  ' + new Date(l.changed_at).toLocaleString('vi-VN') + '  ' + l.action +
    ': ' + fmt(l.old_value) + 'đ -> ' + fmt(l.new_value) + 'đ')
}

const plansWithId = plans.map(x => ({ ...x, client_id: c.id }))
const logWithId = log.map(x => ({ ...x, client_id: c.id }))

const { data: paid } = await s.from('service_fees').select('year,month,amount,type,note,created_at')
  .eq('client_id', c.id).in('type', ['ketoan', 'no_ton', 'khach']).order('year').order('month')
console.log('\nCÁC KHOẢN ĐÃ THU (' + paid.length + ' dòng) — kèm mức phí resolveFeeForMonth tra ra:')
for (const p of paid) {
  const fee = resolveFeeForMonth(plansWithId, c.id, p.year, p.month, c.monthly_fee, logWithId)
  const over = p.type === 'ketoan' && Number(p.amount) > fee
  console.log('  T' + String(p.month).padStart(2) + '/' + p.year + '  ' + p.type.padEnd(7) +
    fmt(p.amount).padStart(13) + 'đ  | phí tra ra ' + fmt(fee).padStart(13) + 'đ' +
    (over ? '   <-- VƯỢT' : '') + (p.note ? '   ' + p.note : ''))
}
