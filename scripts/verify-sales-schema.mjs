// Kiểm module Phòng Kinh doanh đã cài đủ trên database chưa (sql/13 + sql/14) và Drive đã cấu hình.
//
//   node scripts/verify-sales-schema.mjs
//
// Chỉ ĐỌC, không ghi gì.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

let bad = 0
const line = (ok, text) => { if (!ok) bad++; console.log((ok ? '  [OK]   ' : '  [THIẾU] ') + text) }

console.log('sql/13_sales_module.sql\n')
for (const t of ['sales_channels', 'sales_leads', 'sales_lead_activities', 'sales_quotes']) {
  // KHÔNG dùng head:true — bảng chưa có thì HEAD không trả thân lỗi, supabase-js báo "không lỗi,
  // count null" → tưởng bảng đã có.
  const { error, count } = await s.from(t).select('id', { count: 'exact' }).limit(1)
  line(!error && count !== null, 'bảng ' + t + (error ? '' : ' (' + count + ' dòng)'))
}
{
  const { error } = await s.from('sales_leads').select('phone_norm, tax_norm').limit(1)
  line(!error, 'cột sales_leads.phone_norm / tax_norm')
}
{
  const { data } = await s.from('permissions').select('key').eq('group_name', 'Phòng Kinh doanh')
  line((data || []).length === 3, 'quyền nhóm "Phòng Kinh doanh": ' + (data || []).map(p => p.key).join(', '))
}
{
  const { data } = await s.from('roles').select('id').in('id', ['sales', 'sales_leader'])
  line((data || []).length === 2, 'vai trò sales + sales_leader')
}

console.log('\nsql/14_sales_room.sql (chạy SAU khi deploy)\n')
{
  const { data } = await s.from('rooms').select('name').eq('type', 'kinhdoanh')
  line((data || []).length === 1, 'phòng type=kinhdoanh' + ((data || []).length ? ': ' + data[0].name : ''))
}

console.log('\nGoogle Drive (.env.local — trên Vercel phải khai báo riêng)\n')
for (const k of ['GOOGLE_SA_EMAIL', 'GOOGLE_SA_PRIVATE_KEY', 'SALES_DRIVE_FOLDER_ID']) line(new RegExp('^' + k + '\\s*=', 'm').test(env), k)

console.log('\n' + (bad ? bad + ' mục còn thiếu' : 'Đủ cả'))
