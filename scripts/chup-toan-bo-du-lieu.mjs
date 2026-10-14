// CHỤP TOÀN BỘ DỮ LIỆU ra một file JSON trên máy — làm trước mỗi đợt xây phân hệ mới / sửa lớn
// (anh yêu cầu 13/10/2026 trước khi làm phân hệ Hóa đơn điện tử). Chỉ đọc, không ghi gì vào database.
//
//   node --env-file=.env.local scripts/chup-toan-bo-du-lieu.mjs <thư-mục-lưu>
//
// Khác bản backup hằng tuần (app/api/cron/backup): chụp MỌI bảng có trong sql/*.sql kể cả các bảng mới
// và các bảng của phân hệ Tờ khai, lưu ra đĩa cục bộ. File chứa mật khẩu khách ĐÃ MÃ HOÁ và dữ liệu
// khách thật — để NGOÀI repo, không commit, không gửi đi đâu.
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const TABLES = [
  'clients', 'staff', 'rooms', 'roles', 'permissions', 'role_permissions', 'staff_extra_roles',
  'service_fees', 'task_definitions', 'task_records', 'client_secondary_staff', 'client_change_log',
  'client_credentials', 'debt_rollovers', 'debt_records', 'debt_writeoffs', 'kpi_violations',
  'other_services', 'other_service_payments', 'room_kpi', 'staff_kpi',
  'hcns_clients', 'hcns_service_fees', 'hcns_service_templates', 'hcns_service_template_tasks',
  'hcns_case_services', 'hcns_case_service_tasks', 'hcns_case_service_status_log', 'hcns_case_payments',
  'hcns_case_notes', 'hcns_case_note_reads', 'hcns_recurring_tasks', 'hcns_headcount',
  'sales_leads', 'sales_quotes', 'sales_lead_activities', 'sales_channels',
  'bank_transactions', 'bank_action_logs',
  'tax_accounts', 'tax_client_filings', 'tax_filing_types', 'tax_filings', 'tax_holidays', 'tax_notices',
  'tax_obligations', 'tax_sync_jobs', 'tax_access_logs',
]
const dir = process.argv[2]
if (!dir) { console.log('Thiếu thư mục lưu'); process.exit(1) }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function docHet(table) {
  // Sắp theo id để lật trang không trùng / sót dòng; bảng không có cột id thì đọc không sắp.
  for (const coSap of [true, false]) {
    const rows = []
    let loi = null
    for (let from = 0; ; from += 1000) {
      let q = sb.from(table).select('*').range(from, from + 999)
      if (coSap) q = q.order('id')
      const { data, error } = await q
      if (error) { loi = error; break }
      rows.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    if (!loi) return { rows }
    if (!coSap || !/column .*id.* does not exist|id/i.test(loi.message || '')) return { error: loi }
  }
}

const luc = new Date()
const ten = 'savitax-toan-bo-' + new Date(luc.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json'
const out = { luc: luc.toISOString(), tables: {} }
const dem = []
for (const t of TABLES) {
  const r = await docHet(t)
  if (r.error) { dem.push([t, 'LỖI: ' + r.error.message.slice(0, 60)]); continue }
  out.tables[t] = r.rows
  dem.push([t, r.rows.length])
}
mkdirSync(dir, { recursive: true })
const noiDung = JSON.stringify(out)
const duong = join(dir, ten)
writeFileSync(duong, noiDung)
const sha = createHash('sha256').update(noiDung).digest('hex')
writeFileSync(duong + '.sha256.txt', sha + '  ' + ten + '\n' + dem.map(([t, n]) => t.padEnd(34) + n).join('\n') + '\n')
for (const [t, n] of dem) console.log(t.padEnd(34) + n)
console.log('\nTỔNG: ' + dem.filter(d => typeof d[1] === 'number').reduce((a, d) => a + d[1], 0) + ' dòng / ' + dem.filter(d => typeof d[1] === 'number').length + ' bảng'
  + ' | lỗi: ' + dem.filter(d => typeof d[1] !== 'number').length)
console.log('File: ' + duong + ' (' + (noiDung.length / 1048576).toFixed(1) + ' MB) · sha256 ' + sha.slice(0, 16) + '…')
