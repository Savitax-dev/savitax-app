// Dựng CẤU TRÚC database demo từ các file sql/ của repo (chỉ cấu trúc + danh mục cấu hình, KHÔNG dữ liệu thật).
//   node --env-file=.env.local scripts/demo/dung-csdl.mjs            → chạy lần lượt các file, báo file lỗi
//   node --env-file=.env.local scripts/demo/dung-csdl.mjs --so <defs.json>  → so cột với cấu trúc production
// Chạy lại nhiều lần được (các file sql đều "if not exists").
import fs from 'fs'
import path from 'path'
import postgres from 'postgres'
import { chacChanLaDbDemo } from '../../lib/demo/canh.js'
import cauHinh from '../../lib/demo/cauHinh.js'

process.env.DEMO_SCRIPT = '1'
chacChanLaDbDemo({ canDbUrl: true })

const DAU = ['00_bootstrap_core_tables.sql', 'client_credentials_view.sql', 'client_change_log_view.sql', 'fix_security_definer_views.sql', '05_grants.sql']
const SAU = fs.readdirSync('sql').filter(f => /^\d\d_/.test(f) && !DAU.includes(f)).sort()
const sql = postgres(process.env.DEMO_DB_URL, { ssl: 'require', max: 1, onnotice: () => {} })

const soIdx = process.argv.indexOf('--so')
if (soIdx < 0) {
  let loi = 0
  const vaiTro = cauHinh.roles
  for (const f of [...DAU, 'VAI_TRO', ...SAU, 'BO_SUNG', 'demo/90_ham_lam_moi.sql', '05_grants.sql']) {
    // Ràng buộc production có nhưng không nằm trong file sql nào (tạo tay qua Dashboard) — code upsert theo chúng
    if (f === 'BO_SUNG') {
      await sql.unsafe('create unique index if not exists service_fees_client_year_month_type_key on service_fees (client_id, year, month, type); create unique index if not exists task_records_client_def_year_month_key on task_records (client_id, task_def_id, year, month);')
      console.log('  OK   (bổ sung ràng buộc không trùng)'); continue
    }
    // Các file sql gán quyền cho vai trò có sẵn (staff, leader…) — DB trắng phải có vai trò trước
    if (f === 'VAI_TRO') { await sql`insert into roles ${sql(vaiTro, 'id', 'label', 'is_system')} on conflict (id) do nothing`; console.log('  OK   (nạp', vaiTro.length, 'vai trò)'); continue }
    try { await sql.unsafe(fs.readFileSync(path.join('sql', f), 'utf8')); console.log('  OK  ', f) }
    catch (e) { loi++; console.log('  LỖI ', f, '→', e.message) }
  }
  console.log(loi ? '\n' + loi + ' file lỗi' : '\nXong, không file nào lỗi')
} else {
  const prod = JSON.parse(fs.readFileSync(process.argv[soIdx + 1], 'utf8'))
  const rows = await sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`
  const demo = new Map()
  for (const r of rows) { if (!demo.has(r.table_name)) demo.set(r.table_name, new Set()); demo.get(r.table_name).add(r.column_name) }
  for (const [t, def] of Object.entries(prod)) {
    if (!demo.has(t)) { console.log('THIẾU BẢNG', t); continue }
    const thieu = Object.keys(def.properties).filter(c => !demo.get(t).has(c))
    if (thieu.length) console.log('THIẾU CỘT', t, ':', thieu.join(', '))
  }
  for (const t of demo.keys()) if (!prod[t]) console.log('THỪA (demo có, prod không)', t)
}
await sql.end()
