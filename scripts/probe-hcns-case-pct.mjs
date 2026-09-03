// Đọc-chỉ: đối chiếu %-công việc hồ sơ Thời điểm/Vãng lai mà báo cáo phòng sẽ hiện.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const { data: clients } = await s.from('hcns_clients').select('id,name,category,assigned_to').eq('is_active', true)
const cases = (clients || []).filter(c => c.category !== 'thoi_ky')
const { data: svcs } = await s.from('hcns_case_services').select('id,hcns_client_id,received_at')
  .in('hcns_client_id', cases.map(c => c.id))
const { data: tasks } = await s.from('hcns_case_service_tasks').select('case_service_id,done')
  .in('case_service_id', (svcs || []).map(x => x.id))

for (const c of cases) {
  const mine = (svcs || []).filter(x => x.hcns_client_id === c.id)
  const t = (tasks || []).filter(x => mine.some(m => m.id === x.case_service_id))
  const done = t.filter(x => x.done).length
  console.log(`${c.category} · ${c.name}: ${done}/${t.length} việc = ${t.length ? Math.round(done/t.length*100) : '—'}%`
    + `  (nhận ${mine.map(m => m.received_at).join(', ')})`)
}
