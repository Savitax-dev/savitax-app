// Soi tình trạng "nợ tồn tự động" (debt_rollovers) của 1 công ty: tháng nào đã bị hệ thống
// tự ghi thành nợ tồn, tháng nào chưa. Dùng để kiểm chứng ảnh hưởng của khoản trả gộp nhiều kỳ.
//
//   node scripts/probe-rollover.mjs LENAU
//
// Chỉ ĐỌC dữ liệu, không ghi gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolveFeeForMonth, isPastRolloverDeadline } from '../lib/feeDue.js'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

const code = process.argv[2]
if (!code) { console.log('VD: node scripts/probe-rollover.mjs LENAU'); process.exit(1) }

const { data: cs } = await s.from('clients').select('*').eq('client_code', code)
if (!cs?.length) { console.log('Không tìm thấy mã: ' + code); process.exit(1) }
const c = cs[0]

const [{ data: plans }, { data: log }, { data: paid }, { data: rolls }] = await Promise.all([
  s.from('service_fees').select('client_id,year,month,amount').eq('client_id', c.id).eq('type', 'fee_plan'),
  s.from('client_change_log').select('client_id,old_value,changed_at').eq('client_id', c.id).eq('entity', 'monthly_fee').eq('action', 'update'),
  s.from('service_fees').select('year,month,amount').eq('client_id', c.id).eq('type', 'ketoan'),
  s.from('debt_rollovers').select('year,month,rolled_amount,remaining_amount').eq('client_id', c.id),
])

const paidMap = new Map(paid.map(p => [p.year * 12 + p.month, Number(p.amount) || 0]))
const rollMap = new Map(rolls.map(r => [r.year * 12 + r.month, r]))

console.log('CÔNG TY: ' + c.name + '  (' + c.client_code + ')')
console.log('  Hợp đồng từ: ' + (c.contract_start || '—') + '   | Tạo trong hệ thống: ' +
  (c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '—'))
console.log('  Nợ tồn hiện tại (clients.other_debt): ' + fmt(c.other_debt) + 'đ')
console.log('  Số dòng nợ tồn tự động đã ghi (debt_rollovers): ' + rolls.length)

const now = new Date()
const cy = now.getFullYear(), cm = now.getMonth() + 1
console.log('\n24 tháng gần nhất — hệ thống đang hiểu thế nào:')
console.log('  Kỳ        Đã ghi thu      Phí kỳ         Trạng thái')
let y = cy, m = cm
const rows = []
for (let i = 0; i < 24; i++) {
  const k = y * 12 + m
  rows.push({ y, m, k })
  m--; if (m === 0) { m = 12; y-- }
}
rows.reverse()
// ensureRollovers BỎ QUA mọi tháng trước khi công ty được thêm vào hệ thống (clients.created_at)
// — để không bịa ra nợ tồn cho quãng thời gian công ty chưa có trên app. Phải áp cùng điều kiện,
// nếu không script sẽ báo động giả hàng loạt cho công ty mới nhập.
const created = c.created_at ? new Date(c.created_at) : null
const createdYM = created ? created.getFullYear() * 12 + created.getMonth() : -Infinity

for (const r of rows) {
  const collected = paidMap.get(r.k) || 0
  const fee = resolveFeeForMonth(plans, c.id, r.y, r.m, c.monthly_fee, log)
  const rolled = rollMap.get(r.k)
  const past = isPastRolloverDeadline(c.fee_period, r.y, r.m, now)
  const beforeCreated = r.y * 12 + (r.m - 1) < createdYM
  let st
  if (beforeCreated) st = 'Ngoài tầm (trước khi công ty được thêm vào hệ thống)'
  else if (rolled) st = 'ĐÃ ghi nợ tồn ' + fmt(rolled.rolled_amount) + 'đ (còn ' + fmt(rolled.remaining_amount) + 'đ)'
  else if (fee <= 0) st = '—'
  else if (collected >= fee) st = 'Đủ'
  else if (!past) st = 'Chưa tới hạn chuyển nợ tồn'
  else st = '>>> THIẾU ' + fmt(fee - collected) + 'đ, ĐÃ QUÁ HẠN mà CHƯA ghi nợ tồn'
  console.log('  T' + String(r.m).padStart(2) + '/' + r.y + '  ' +
    fmt(collected).padStart(13) + 'đ  ' + fmt(fee).padStart(12) + 'đ   ' + st)
}
