// Tìm các dòng "nợ tồn tự động" (debt_rollovers) đã LỖI THỜI so với mức phí hiện hành của tháng đó.
//
//   node scripts/check-stale-rollovers.mjs
//
// Vì sao sinh ra: ensureRollovers ghi 1 dòng nợ tồn cho tháng thu thiếu rồi KHÔNG bao giờ xét lại
// (`if (rolledSet.has(key)) continue`). Nếu sau đó phí của tháng đó bị sửa (VD giảm giá áp lùi),
// dòng nợ tồn vẫn giữ số tính theo phí CŨ -> nợ tồn hiển thị sai.
// Ca thật: KING DƯỢC — nợ tồn T7/2026 ghi 8.640.000đ theo phí cũ, trong khi phí đã giảm còn
// 3.240.000đ và đã thu 3.000.000đ, đúng ra chỉ còn thiếu 240.000đ.
//
// Chỉ ĐỌC dữ liệu, không sửa gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolveFeeForMonth } from '../lib/feeDue.js'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

async function fetchAll(table, columns, filter) {
  const PAGE = 1000, rows = []
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

const [rolls, clients, plans, paid, changeLog] = await Promise.all([
  fetchAll('debt_rollovers', 'id, client_id, year, month, rolled_amount, remaining_amount'),
  fetchAll('clients', 'id, name, client_code, monthly_fee, other_debt'),
  fetchAll('service_fees', 'client_id, year, month, amount, type', q => q.eq('type', 'fee_plan')),
  fetchAll('service_fees', 'client_id, year, month, amount, type', q => q.eq('type', 'ketoan')),
  fetchAll('client_change_log', 'client_id, old_value, changed_at, entity, action',
    q => q.eq('entity', 'monthly_fee').eq('action', 'update')),
])

const clientById = new Map(clients.map(c => [c.id, c]))
const paidMap = new Map(paid.map(p => [p.client_id + '_' + p.year + '_' + p.month, Number(p.amount) || 0]))

const bad = []
for (const r of rolls) {
  const c = clientById.get(r.client_id)
  if (!c) continue
  const feeNow = resolveFeeForMonth(plans, r.client_id, r.year, r.month, c.monthly_fee, changeLog)
  const collected = paidMap.get(r.client_id + '_' + r.year + '_' + r.month) || 0
  const shouldRemain = Math.max(0, feeNow - collected)
  const remain = Number(r.remaining_amount) || 0
  // Chỉ báo động khi đang ghi nợ NHIỀU HƠN thực tế — đó mới là dấu hiệu phí bị sửa sau khi đã
  // ghi nợ tồn. Trường hợp ngược lại (ghi ÍT hơn) là bình thường: thu nợ tồn qua tab "Nợ tồn cũ"
  // tạo dòng type='no_ton' chứ KHÔNG tạo dòng 'ketoan' cho tháng gốc, nên `collected` của tháng
  // đó vẫn là 0 trong khi remaining đã được trừ về 0.
  if (remain - shouldRemain > 1) {
    bad.push({ c, r, feeNow, collected, shouldRemain, remain, diff: remain - shouldRemain })
  }
}

console.log('Đã xét ' + rolls.length + ' dòng nợ tồn tự động trên ' + clients.length + ' công ty.\n')
if (!bad.length) {
  console.log('==> Không có dòng nào lệch. Nợ tồn tự động khớp với mức phí hiện hành.')
} else {
  bad.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  console.log('CÓ ' + bad.length + ' DÒNG LỆCH:\n')
  console.log('  Kỳ        Mã KH          Phí kỳ        Đã thu       Nợ tồn đang ghi   Đúng ra      Lệch')
  for (const b of bad) {
    console.log('  T' + String(b.r.month).padStart(2) + '/' + b.r.year + '  ' +
      (b.c.client_code || '—').padEnd(14) +
      fmt(b.feeNow).padStart(11) + ' ' + fmt(b.collected).padStart(12) + ' ' +
      fmt(b.remain).padStart(15) + ' ' + fmt(b.shouldRemain).padStart(12) + ' ' +
      (b.diff > 0 ? '+' : '') + fmt(b.diff).padStart(11) + '   ' + b.c.name)
  }
  const totalDiff = bad.reduce((a, b) => a + b.diff, 0)
  console.log('\n  Tổng lệch: ' + fmt(totalDiff) + 'đ (số dương = đang ghi nợ NHIỀU HƠN thực tế)')
  console.log('\n  Lưu ý: clients.other_debt còn gồm cả "Thu khác — Tồn đọng" nhập tay lúc tạo công ty,')
  console.log('  nên KHÔNG phải lúc nào cũng bằng tổng remaining_amount. Rà từng ca trước khi sửa.')
}
