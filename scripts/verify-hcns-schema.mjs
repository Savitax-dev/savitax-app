// Kiểm tra sql/06_hcns_module.sql đã chạy đủ chưa: 8 bảng HCNS, cột clients.uses_hcns,
// phòng HCNS, 4 quyền, 2 vai trò, mẫu checklist định kỳ.
//
//   node scripts/verify-hcns-schema.mjs
//
// Chỉ ĐỌC dữ liệu, không ghi gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)

const OK = '  [OK]   ', NG = '  [THIẾU]'
let fail = 0

const TABLES = ['hcns_clients', 'hcns_service_fees', 'hcns_service_templates',
  'hcns_service_template_tasks', 'hcns_recurring_tasks', 'hcns_case_services',
  'hcns_case_service_status_log', 'hcns_case_service_tasks']

console.log('BẢNG HCNS:')
for (const t of TABLES) {
  const { error } = await s.from(t).select('id').limit(1)
  if (error) { console.log(NG + ' ' + t + '  -> ' + error.message); fail++ }
  else console.log(OK + t)
}

console.log('\nCỘT MỚI TRÊN BẢNG clients:')
{
  const { error } = await s.from('clients').select('id,uses_hcns').limit(1)
  if (error) { console.log(NG + ' clients.uses_hcns -> ' + error.message); fail++ }
  else {
    const { count } = await s.from('clients').select('id', { count: 'exact', head: true }).eq('uses_hcns', true)
    console.log(OK + 'clients.uses_hcns   (đang bật cho ' + (count || 0) + ' công ty)')
  }
}

console.log('\nPHÒNG HCNS:')
{
  const { data, error } = await s.from('rooms').select('id,name,type').eq('type', 'hcns')
  if (error || !data?.length) { console.log(NG + ' chưa có dòng rooms type=hcns'); fail++ }
  else console.log(OK + 'rooms: "' + data[0].name + '" (type=hcns)')
}

console.log('\nQUYỀN MỚI (group_name = "Phòng HCNS"):')
{
  const want = ['view_hcns', 'manage_hcns', 'manage_hcns_template', 'view_hcns_all_staff']
  const { data } = await s.from('permissions').select('key,label').eq('group_name', 'Phòng HCNS')
  const have = new Set((data || []).map(p => p.key))
  for (const k of want) {
    if (have.has(k)) console.log(OK + k)
    else { console.log(NG + ' ' + k); fail++ }
  }
}

console.log('\nVAI TRÒ:')
{
  const { data } = await s.from('roles').select('id,label').in('id', ['hcns', 'hcns_leader'])
  const have = new Map((data || []).map(r => [r.id, r.label]))
  for (const id of ['hcns', 'hcns_leader']) {
    if (have.has(id)) console.log(OK + id + '  ("' + have.get(id) + '")')
    else { console.log(NG + ' ' + id); fail++ }
  }
  const { data: rp } = await s.from('role_permissions').select('role_id,permission_key')
    .in('role_id', ['hcns', 'hcns_leader'])
  const byRole = {}
  for (const r of (rp || [])) (byRole[r.role_id] ||= []).push(r.permission_key)
  console.log('    quyền đã gán cho hcns:        ' + (byRole['hcns'] || []).join(', '))
  console.log('    quyền đã gán cho hcns_leader: ' + (byRole['hcns_leader'] || []).join(', '))
}

console.log('\nMẪU CHECKLIST ĐỊNH KỲ:')
{
  const { data, error } = await s.from('hcns_service_templates').select('id,name,is_recurring').eq('is_recurring', true)
  if (error || !data?.length) { console.log(NG + ' chưa có mẫu is_recurring=true'); fail++ }
  else {
    const { count } = await s.from('hcns_service_template_tasks')
      .select('id', { count: 'exact', head: true }).eq('template_id', data[0].id).eq('is_active', true)
    console.log(OK + '"' + data[0].name + '"  (' + (count || 0) + ' công việc — nhập ở trang Checklist HCNS)')
  }
}

console.log('\n' + (fail === 0
  ? '==> ĐẦY ĐỦ. Schema HCNS đã sẵn sàng để code.'
  : '==> CÒN THIẾU ' + fail + ' mục ở trên — chạy lại sql/06_hcns_module.sql.'))
process.exit(fail === 0 ? 0 : 1)
