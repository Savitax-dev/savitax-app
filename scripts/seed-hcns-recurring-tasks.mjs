// Nạp lại danh sách công việc của mẫu "DV HCNS Thời Kỳ" kèm hạn theo ngày trong tháng.
//
//   node scripts/seed-hcns-recurring-tasks.mjs --dry     -- xem trước, không ghi
//   node scripts/seed-hcns-recurring-tasks.mjs --apply   -- ghi thật
//
// Chạy SAU sql/12_hcns_task_deadline.sql. Chạy lại nhiều lần an toàn: khớp theo tên đã chuẩn hoá,
// việc đã có thì chỉ cập nhật hạn và thứ tự, việc chưa có thì thêm mới.
//
// KHÔNG xoá cứng việc thừa — đổi is_active=false, vì các dòng đã tích (hcns_recurring_tasks) tham
// chiếu tới đây, xoá cứng sẽ vỡ khoá ngoại và mất lịch sử ai làm việc gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const apply = process.argv.includes('--apply')
if (!apply && !process.argv.includes('--dry')) {
  console.log('Dùng: node scripts/seed-hcns-recurring-tasks.mjs --dry | --apply')
  process.exit(1)
}

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

// Danh sách chốt ngày 2026-09-07.
const WANT = [
  { order: 1, name: 'File theo dõi BHXH hàng tháng (Gửi Khách hàng)', day: 20 },
  { order: 2, name: 'Báo số tiền nhắc khách đóng BHXH',               day: 20 },
  { order: 3, name: 'Kiểm tra, tải C12 tháng trước',                  day: 25 },
  { order: 4, name: 'Cập nhật số lượng nhân sự tham gia BHXH hàng tháng', day: 25 },
  { order: 5, name: 'Cập nhật phí HCNS',                              day: 30 },
]

// Việc cũ khớp nghĩa với việc mới nào — sửa tên tại chỗ thay vì ẩn đi rồi thêm mới, để không
// để lại dòng chết và giữ nguyên các dòng đã tích (nếu có).
const RENAME = {
  'kiem tra c12': 'Kiểm tra, tải C12 tháng trước',
  'thong bao so tien dong bhxh hang thang': 'Báo số tiền nhắc khách đóng BHXH',
}

// Bỏ dấu + bỏ tiền tố đánh số ("1. ") để so tên cho chắc. Tên đang lưu có sẵn "1. ", "2. " trong
// khi giao diện lại tự đánh số -> hiện thành "1. 1. Kiểm tra C12". Nạp lại là hết.
const norm = (v) => String(v || '')
  .replace(/^\s*\d+\s*[.)]\s*/, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .trim().toLowerCase()

const { data: tpl, error: tplErr } = await s.from('hcns_service_templates')
  .select('id, name').eq('is_recurring', true).eq('is_active', true).maybeSingle()
if (tplErr || !tpl) { console.log('Không tìm thấy mẫu định kỳ. ' + (tplErr?.message || '')); process.exit(1) }

const { data: cur, error: curErr } = await s.from('hcns_service_template_tasks')
  .select('id, name, sort_order, is_active, deadline_day').eq('template_id', tpl.id)
if (curErr) {
  console.log('LỖI đọc công việc: ' + curErr.message)
  console.log('Nếu báo thiếu cột deadline_day thì chạy sql/12_hcns_task_deadline.sql trước.')
  process.exit(1)
}

const { count: ticked } = await s.from('hcns_recurring_tasks')
  .select('id', { count: 'exact', head: true })
const { count: usingCount } = await s.from('hcns_clients')
  .select('id', { count: 'exact', head: true }).eq('category', 'thoi_ky').eq('is_active', true)

console.log('Mẫu: ' + tpl.name + '  ·  đang áp cho ' + usingCount + ' công ty  ·  ' + ticked + ' dòng đã tích\n')
console.log((apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi gì)') + '\n')

// Ghép việc mới với việc cũ: khớp trực tiếp theo tên, hoặc qua bảng đổi tên.
const byNorm = new Map((cur || []).map(t => [norm(t.name), t]))
const matched = new Set()
const plan = []

for (const w of WANT) {
  let hit = byNorm.get(norm(w.name))
  if (!hit) {
    for (const [oldKey, newName] of Object.entries(RENAME)) {
      if (newName === w.name && byNorm.has(oldKey)) { hit = byNorm.get(oldKey); break }
    }
  }
  if (hit) {
    matched.add(hit.id)
    const changes = []
    if (hit.name !== w.name) changes.push('tên: "' + hit.name + '" -> "' + w.name + '"')
    if (Number(hit.deadline_day) !== w.day) changes.push('hạn: ' + (hit.deadline_day ?? '—') + ' -> ngày ' + w.day)
    if (Number(hit.sort_order) !== w.order) changes.push('thứ tự: ' + hit.sort_order + ' -> ' + w.order)
    if (hit.is_active === false) changes.push('bật lại')
    plan.push({ kind: changes.length ? 'update' : 'giữ nguyên', id: hit.id, w, changes })
  } else {
    plan.push({ kind: 'insert', w, changes: ['thêm mới, hạn ngày ' + w.day] })
  }
}
const extra = (cur || []).filter(t => !matched.has(t.id) && t.is_active !== false)

for (const p of plan) {
  const tag = p.kind === 'insert' ? '+ thêm  ' : p.kind === 'update' ? '~ sửa   ' : '· giữ   '
  console.log(tag + p.w.order + '. ' + p.w.name.padEnd(52) + 'ngày ' + p.w.day)
  for (const c of p.changes) console.log('          ' + c)
}
for (const e of extra) console.log('- ẩn    ' + e.name + '   (không còn trong danh sách mới)')

if (!apply) { console.log('\nXem thấy đúng thì chạy lại với --apply.'); process.exit(0) }

let done = 0
for (const p of plan) {
  if (p.kind === 'giữ nguyên') { done++; continue }
  if (p.kind === 'update') {
    const { error } = await s.from('hcns_service_template_tasks')
      .update({ name: p.w.name, deadline_day: p.w.day, sort_order: p.w.order, is_active: true })
      .eq('id', p.id)
    if (error) { console.log('LỖI sửa "' + p.w.name + '": ' + error.message); continue }
  } else {
    const { error } = await s.from('hcns_service_template_tasks').insert({
      template_id: tpl.id, name: p.w.name, deadline_day: p.w.day, sort_order: p.w.order, is_active: true,
    })
    if (error) { console.log('LỖI thêm "' + p.w.name + '": ' + error.message); continue }
  }
  done++
}
for (const e of extra) {
  await s.from('hcns_service_template_tasks').update({ is_active: false }).eq('id', e.id)
}

const { data: after } = await s.from('hcns_service_template_tasks')
  .select('name, sort_order, deadline_day').eq('template_id', tpl.id).eq('is_active', true)
  .order('sort_order')
console.log('')
console.log('Xong. Mẫu hiện có ' + (after || []).length + ' công việc:')
for (const t of after || []) console.log('  ' + t.sort_order + '. ' + t.name.padEnd(52) + 'ngày ' + t.deadline_day)
