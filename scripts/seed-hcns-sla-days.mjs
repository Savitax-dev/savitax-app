// Nạp "Hạn xử lý (ngày)" cho mẫu dịch vụ HCNS + hạn hoàn thành cho dịch vụ hồ sơ đang có.
// Cần chạy sql/18_hcns_service_deadline.sql trước.
//
//   node scripts/seed-hcns-sla-days.mjs --dry     -- xem trước, KHÔNG ghi
//   node scripts/seed-hcns-sla-days.mjs --apply   -- ghi thật
//
// Chỉ điền ô đang TRỐNG — số ngày người quản lý đã sửa tay, hạn đã chốt thì giữ nguyên.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { hcnsDueDate, slaDaysFromNote } from '../lib/hcnsDue.js'

const apply = process.argv.includes('--apply')
if (!apply && !process.argv.includes('--dry')) {
  console.log('Dùng: node scripts/seed-hcns-sla-days.mjs --dry | --apply'); process.exit(1)
}
const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

console.log((apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi gì)') + '\n')

const { data: tpls, error } = await s.from('hcns_service_templates')
  .select('id, name, note, sla_days, is_recurring').eq('is_recurring', false)
if (error) { console.log('LỖI (đã chạy sql/18 chưa?): ' + error.message); process.exit(1) }

const slaOf = new Map()
console.log('MẪU DỊCH VỤ:')
for (const t of tpls) {
  const guess = slaDaysFromNote(t.note)
  const final = t.sla_days ?? guess
  slaOf.set(t.id, final)
  if (t.sla_days == null && guess != null) {
    console.log('  + ' + String(guess).padStart(3) + ' ngày  ' + t.name)
    if (apply) {
      const { error: e } = await s.from('hcns_service_templates').update({ sla_days: guess }).eq('id', t.id)
      if (e) console.log('    LỖI: ' + e.message)
    }
  } else {
    console.log('    ' + String(final ?? '—').padStart(3) + '       ' + t.name + (t.sla_days == null ? '  (không đọc được, để trống)' : '  (đã có)'))
  }
}

console.log('\nDỊCH VỤ TRONG HỒ SƠ:')
const { data: svcs } = await s.from('hcns_case_services')
  .select('id, template_id, received_at, due_at, status, completed_at')
const { data: logs } = await s.from('hcns_case_service_status_log')
  .select('case_service_id, status, changed_at').eq('status', 'hoan_thanh')
const doneAt = new Map()
for (const l of logs || []) {
  const cur = doneAt.get(l.case_service_id)
  if (!cur || l.changed_at > cur) doneAt.set(l.case_service_id, l.changed_at)
}
for (const sv of svcs || []) {
  const tpl = tpls.find(t => t.id === sv.template_id)
  const patch = {}
  if (!sv.due_at) {
    const due = hcnsDueDate(sv.received_at, slaOf.get(sv.template_id))
    if (due) patch.due_at = due
  }
  if (sv.status === 'hoan_thanh' && !sv.completed_at && doneAt.get(sv.id)) patch.completed_at = doneAt.get(sv.id)
  console.log('  ' + (tpl?.name || '?').padEnd(38) + ' nhận ' + (sv.received_at || '—') +
    '  hạn ' + (patch.due_at || sv.due_at || '—') + (patch.due_at ? ' (mới)' : '') +
    (patch.completed_at ? '  xong ' + patch.completed_at.slice(0, 10) : ''))
  if (apply && Object.keys(patch).length) {
    const { error: e } = await s.from('hcns_case_services').update(patch).eq('id', sv.id)
    if (e) console.log('    LỖI: ' + e.message)
  }
}
if (!apply) console.log('\nXem thấy đúng thì chạy lại với --apply.')
