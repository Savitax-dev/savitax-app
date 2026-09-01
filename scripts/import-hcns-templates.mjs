// Nạp mẫu dịch vụ HCNS từ file "QUY TRÌNH XỬ LÍ HỒ SƠ HCNS.xlsx" vào hệ thống.
//
//   node scripts/import-hcns-templates.mjs <đường-dẫn-file.json>   -- nạp thật
//   node scripts/import-hcns-templates.mjs <file.json> --dry       -- chỉ xem trước, không ghi
//
// File JSON do scripts/parse-hcns-xlsx.py sinh ra (tách phần đọc Excel khỏi phần ghi database
// để xem trước được kết quả bóc tách trước khi đụng vào dữ liệu).
//
// Chạy lại nhiều lần an toàn: khớp theo TÊN dịch vụ — đã có thì cập nhật ghi chú và bổ sung
// công việc còn thiếu, KHÔNG tạo trùng và KHÔNG xoá công việc nhân viên đã tự thêm.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const file = process.argv[2]
const dry = process.argv.includes('--dry')
if (!file) { console.log('Thiếu đường dẫn file JSON.'); process.exit(1) }

const items = JSON.parse(readFileSync(file, 'utf8'))
console.log((dry ? 'XEM TRƯỚC (không ghi gì)' : 'NẠP DỮ LIỆU') + ' — ' + items.length + ' dịch vụ\n')

// Kiểm cột group_name/note đã có chưa (sql/09_hcns_template_meta.sql).
let hasMeta = true
{
  const { error } = await s.from('hcns_service_templates').select('group_name, note').limit(1)
  if (error) {
    hasMeta = false
    console.log('⚠ Chưa có cột group_name/note — chạy sql/09_hcns_template_meta.sql trước.')
    console.log('  Vẫn nạp được tên dịch vụ và công việc, nhưng mất phần nhóm và thời hạn.\n')
  }
}

const { data: existing } = await s.from('hcns_service_templates').select('id, name, is_recurring')
const byName = new Map((existing || []).map(t => [t.name.trim().toLowerCase(), t]))

let created = 0, updated = 0, tasksAdded = 0
for (const it of items) {
  const key = it.name.trim().toLowerCase()
  let tpl = byName.get(key)

  console.log((tpl ? '· đã có  ' : '+ thêm   ') + '[' + it.group + '] ' + it.name + '  (' + it.tasks.length + ' bước)')
  if (dry) {
    it.tasks.forEach((t, i) => console.log('      ' + (i + 1) + '. ' + t))
    if (it.note) console.log('      ghi chú: ' + it.note.replace(/\n/g, ' | '))
    continue
  }

  if (!tpl) {
    const row = { name: it.name, is_recurring: false, is_active: true, sort_order: it.order }
    if (hasMeta) { row.group_name = it.group; row.note = it.note || null }
    const { data, error } = await s.from('hcns_service_templates').insert(row).select().single()
    if (error) { console.log('   LỖI tạo mẫu: ' + error.message); continue }
    tpl = data; created++
  } else if (hasMeta) {
    await s.from('hcns_service_templates')
      .update({ group_name: it.group, note: it.note || null, sort_order: it.order }).eq('id', tpl.id)
    updated++
  }

  // Chỉ THÊM công việc còn thiếu — không xoá, không sửa cái nhân viên đã tự thêm.
  const { data: cur } = await s.from('hcns_service_template_tasks')
    .select('name').eq('template_id', tpl.id)
  const have = new Set((cur || []).map(x => x.name.trim().toLowerCase()))
  const missing = it.tasks.filter(t => !have.has(t.trim().toLowerCase()))
  if (missing.length) {
    const { error } = await s.from('hcns_service_template_tasks').insert(
      missing.map((t, i) => ({ template_id: tpl.id, name: t, sort_order: have.size + i + 1, is_active: true })))
    if (error) console.log('   LỖI thêm công việc: ' + error.message)
    else tasksAdded += missing.length
  }
}

if (!dry) {
  console.log('\nKết quả: ' + created + ' dịch vụ mới, ' + updated + ' cập nhật, ' + tasksAdded + ' công việc thêm mới.')
  const { count: tc } = await s.from('hcns_service_templates').select('id', { count: 'exact', head: true }).eq('is_active', true)
  const { count: kc } = await s.from('hcns_service_template_tasks').select('id', { count: 'exact', head: true }).eq('is_active', true)
  console.log('Hiện có: ' + tc + ' dịch vụ · ' + kc + ' công việc.')
}
