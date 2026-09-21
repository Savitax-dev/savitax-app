// Kiểm sql/15_tokhai_module.sql đã chạy đủ chưa.
//   node --env-file=.env.local scripts/verify-tokhai-schema.mjs
import { createClient } from '@supabase/supabase-js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const BANG = [
  'tax_accounts', 'tax_filing_types', 'tax_client_filings', 'tax_obligations',
  'tax_filings', 'tax_notices', 'tax_sync_jobs', 'tax_holidays', 'tax_access_logs',
]
const QUYEN = [
  'view_tax_filings', 'manage_tax_account', 'reveal_tax_password',
  'sync_tax_filings', 'bulk_download_tax', 'manage_tax_catalog',
]

let thieu = 0
console.log('Bảng:')
for (const t of BANG) {
  const { error } = await s.from(t).select('*', { head: true, count: 'exact' }).limit(1)
  const ok = !error
  if (!ok) thieu++
  console.log(`  ${ok ? 'OK   ' : 'THIẾU'} ${t}${ok ? '' : '  → ' + error.message}`)
}

console.log('\nCột password_enc trong client_credentials:')
{
  const { error } = await s.from('client_credentials').select('password_enc', { head: true }).limit(1)
  if (error) { thieu++; console.log('  THIẾU → ' + error.message) }
  else console.log('  OK')
}

console.log('\nQuyền:')
const { data: perms } = await s.from('permissions').select('key').in('key', QUYEN)
const co = new Set((perms || []).map(p => p.key))
for (const k of QUYEN) {
  if (!co.has(k)) thieu++
  console.log(`  ${co.has(k) ? 'OK   ' : 'THIẾU'} ${k}`)
}

const { data: rp } = await s.from('role_permissions').select('role_id, permission_key').in('permission_key', QUYEN)
console.log('\nĐã gán cho vai trò:')
const theoVaiTro = {}
for (const r of rp || []) (theoVaiTro[r.role_id] ||= []).push(r.permission_key)
for (const [vai, ds] of Object.entries(theoVaiTro)) console.log(`  ${vai}: ${ds.join(', ')}`)
if (!(rp || []).some(r => r.permission_key === 'reveal_tax_password')) {
  console.log('  (reveal_tax_password chưa gán cho ai — ĐÚNG như thiết kế, mở bằng trang Vai trò & phân quyền)')
}

console.log('\nMật khẩu còn lưu chữ rõ trong nhật ký:')
{
  const { data } = await s.from('client_change_log').select('id, old_value, new_value')
    .eq('entity', 'credential').in('field', ['Mật khẩu/PIN', 'password'])
  const con = (data || []).filter(r =>
    (r.old_value && r.old_value !== '(đã ẩn)') || (r.new_value && r.new_value !== '(đã ẩn)'))
  if (con.length) { thieu++; console.log(`  CÒN ${con.length} dòng chưa ẩn`) }
  else console.log(`  OK — đã ẩn hết (${(data || []).length} dòng liên quan)`)
}

console.log('\nKhóa mã hóa TAX_ENC_KEY:', process.env.TAX_ENC_KEY ? 'có trong .env.local' : 'CHƯA CÓ trong .env.local')

console.log(thieu === 0
  ? '\nĐẦY ĐỦ — chạy tiếp được bước chuyển mật khẩu sang mã hóa.'
  : `\nCÒN ${thieu} MỤC THIẾU — chạy lại TOÀN BỘ sql/15_tokhai_module.sql (bôi đen cả file).`)
process.exit(thieu === 0 ? 0 : 1)
