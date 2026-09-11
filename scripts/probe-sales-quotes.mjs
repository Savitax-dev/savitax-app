// Xem nhanh danh sách báo giá + khách tiềm năng của module Phòng Kinh doanh (chỉ ĐỌC).
//
//   node scripts/probe-sales-quotes.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const { data: qs, error } = await s.from('sales_quotes')
  .select('quote_no, quote_date, company_name, tax_code, monthly_final, price_status, contract_status, is_deleted, lead_id, contact:survey->>contact, phone:survey->>phone')
  .order('quote_date').order('seq')
if (error) { console.log('LỖI truy vấn:', error.message); process.exit(1) }
const { data: leads } = await s.from('sales_leads').select('id, company_name, stage, channel_id, is_deleted')
const { data: ch } = await s.from('sales_channels').select('id, name')
const chName = new Map((ch || []).map(c => [c.id, c.name]))
const leadMap = new Map((leads || []).map(l => [l.id, l]))

console.log('Báo giá: ' + (qs || []).length)
for (const q of qs || []) {
  const l = leadMap.get(q.lead_id)
  console.log('  ' + q.quote_no + ' ' + q.quote_date + ' | ' + q.company_name + ' | MST ' + (q.tax_code || '—') +
    ' | LH: ' + (q.contact || '—') + ' / ' + (q.phone || '—') + ' | ' + Number(q.monthly_final).toLocaleString('vi-VN') +
    'đ | ' + q.price_status + ' | ' + q.contract_status + (q.is_deleted ? ' | ĐÃ XOÁ' : '') +
    ' | khách: ' + (l ? l.stage + ' · ' + (chName.get(l.channel_id) || 'chưa rõ kênh') : '—'))
}
console.log('Khách tiềm năng: ' + (leads || []).length)
for (const l of leads || []) console.log('  ' + l.company_name + ' | ' + l.stage + ' | ' + (chName.get(l.channel_id) || '—') + (l.is_deleted ? ' | ĐÃ XOÁ' : ''))
