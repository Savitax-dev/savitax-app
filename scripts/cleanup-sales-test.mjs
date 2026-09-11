// Dọn sạch dữ liệu THỬ của module Phòng Kinh doanh sau khi kiểm thử trên database thật.
//
//   node --env-file=.env.local scripts/cleanup-sales-test.mjs               -- xem trước (chỉ dữ liệu tên "[TEST]…")
//   node --env-file=.env.local scripts/cleanup-sales-test.mjs --apply       -- xoá dữ liệu "[TEST]…"
//   node --env-file=.env.local scripts/cleanup-sales-test.mjs --all         -- xem trước: TOÀN BỘ báo giá + khách tiềm năng
//   node --env-file=.env.local scripts/cleanup-sales-test.mjs --all --apply -- xoá TOÀN BỘ (chỉ dùng trước khi đưa module vào dùng thật)
//   node --env-file=.env.local scripts/cleanup-sales-test.mjs --quote 110901 [--apply] -- chỉ 1 báo giá (+ khách nếu không còn báo giá khác)
//
// Xoá CỨNG báo giá, khách tiềm năng, nhật ký chăm sóc; thư mục Drive của các báo giá đó được bỏ vào thùng
// rác (Shared drive tự xoá hẳn sau 30 ngày, lỡ tay còn khôi phục được). KHÔNG đụng danh mục kênh mặc định,
// vai trò, quyền. `--all` chỉ dùng khi toàn bộ dữ liệu hiện có đều là dữ liệu thử (người dùng xác nhận).
import { createClient } from '@supabase/supabase-js'
import { driveConfigured, trashFile } from '../lib/googleDrive.js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
const all = process.argv.includes('--all')

// --quote <số>: chỉ xoá ĐÚNG báo giá đó; khách tiềm năng của nó xoá theo nếu không còn báo giá nào khác.
const qi = process.argv.indexOf('--quote')
const oneNo = qi >= 0 ? process.argv[qi + 1] : null

let leads, quotes
if (oneNo) {
  const { data: qs } = await s.from('sales_quotes').select('id, quote_no, quote_date, company_name, lead_id, drive_folder_id, drive_folder_url, is_deleted').eq('quote_no', oneNo)
  if ((qs || []).length !== 1) { console.log('Tìm thấy ' + (qs || []).length + ' báo giá số ' + oneNo + ' — cần đúng 1, không xoá.'); process.exit(1) }
  quotes = qs
  const leadId = qs[0].lead_id
  const { data: others } = leadId ? await s.from('sales_quotes').select('id').eq('lead_id', leadId).neq('id', qs[0].id) : { data: [] }
  const { data: ls } = leadId && !(others || []).length
    ? await s.from('sales_leads').select('id, company_name, contact_name, stage, is_deleted').eq('id', leadId)
    : { data: [] }
  leads = ls || []
} else {
  const TEST = 'company_name.like.[TEST]%,contact_name.like.[TEST]%'
  let lq = s.from('sales_leads').select('id, company_name, contact_name, stage, is_deleted')
  if (!all) lq = lq.or(TEST)
  leads = (await lq).data || []
  const lIds = leads.map(l => l.id)
  let qq = s.from('sales_quotes').select('id, quote_no, quote_date, company_name, lead_id, drive_folder_id, drive_folder_url, is_deleted')
  if (!all) qq = qq.or('company_name.like.[TEST]%' + (lIds.length ? ',lead_id.in.(' + lIds.join(',') + ')' : ''))
  quotes = (await qq).data || []
}
const ids = (leads || []).map(l => l.id)
const qIds = (quotes || []).map(q => q.id)
const folders = [...new Set((quotes || []).map(q => q.drive_folder_id).filter(Boolean))]
const { data: chans } = await s.from('sales_channels').select('id, name').like('name', '[TEST]%')

console.log((apply ? 'XOÁ' : 'XEM TRƯỚC (thêm --apply để xoá)') + (oneNo ? ' — chỉ báo giá ' + oneNo : all ? ' — TOÀN BỘ dữ liệu module' : ' — chỉ dữ liệu [TEST]') + '\n')
console.log('Báo giá: ' + qIds.length)
for (const q of quotes || []) console.log('  ' + q.quote_no + '  ' + q.quote_date + '  ' + q.company_name + (q.is_deleted ? '  (đã xoá mềm)' : '') + (q.drive_folder_url ? '  | Drive: ' + q.drive_folder_url : ''))
console.log('Khách tiềm năng: ' + ids.length)
for (const l of leads || []) console.log('  ' + (l.company_name || l.contact_name) + '  | ' + l.stage + (l.is_deleted ? '  (đã xoá mềm)' : ''))
console.log('Thư mục Drive sẽ bỏ vào thùng rác: ' + folders.length)
if ((chans || []).length) console.log('Kênh [TEST]: ' + chans.map(c => c.name).join(', '))
if (!apply) process.exit(0)

let driveTrashed = 0
if (folders.length) {
  if (!driveConfigured()) console.log('\n⚠ Chưa cấu hình Drive — thư mục trên Drive phải xoá tay.')
  else for (const f of folders) {
    try { await trashFile(f); driveTrashed++ } catch (e) { console.log('  ⚠ Chưa bỏ được thư mục ' + f + ' vào thùng rác: ' + e.message) }
  }
}
if (qIds.length) { const { error } = await s.from('sales_quotes').delete().in('id', qIds); if (error) throw error }
if (ids.length) {
  const { error: e1 } = await s.from('sales_lead_activities').delete().in('lead_id', ids); if (e1) throw e1
  const { error: e2 } = await s.from('sales_leads').delete().in('id', ids); if (e2) throw e2
}
if ((chans || []).length) {
  await s.from('sales_leads').update({ channel_id: null }).in('channel_id', chans.map(c => c.id))
  const { error } = await s.from('sales_channels').delete().in('id', chans.map(c => c.id)); if (error) throw error
}

const [{ count: qLeft }, { count: lLeft }] = await Promise.all([
  s.from('sales_quotes').select('id', { count: 'exact' }).limit(1),
  s.from('sales_leads').select('id', { count: 'exact' }).limit(1),
])
console.log('\nĐã xoá ' + qIds.length + ' báo giá, ' + ids.length + ' khách, bỏ ' + driveTrashed + '/' + folders.length + ' thư mục Drive vào thùng rác.')
console.log('Còn lại trong module: ' + qLeft + ' báo giá, ' + lLeft + ' khách tiềm năng.')
