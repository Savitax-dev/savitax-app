// Tách phí HCNS ra khỏi phí kế toán HÀNG LOẠT, từ một file Excel gồm MST + mức phí HCNS.
//
//   node scripts/split-hcns-fee.mjs "<file.xlsx>" --dry          -- CHỈ XEM TRƯỚC, không ghi gì
//   node scripts/split-hcns-fee.mjs "<file.xlsx>" --apply        -- ghi thật
//   ...thêm --from 2026-09  để đổi tháng áp dụng (mặc định tháng hiện tại)
//
// Làm đúng những gì nút "Tách phí HCNS" trên giao diện làm, chỉ khác là làm một lượt:
//   clients.monthly_fee -= phíHCNS · bật uses_hcns · ghi mốc fee_plan phí kế toán mới
//   · tạo/cập nhật hcns_clients + mốc fee_plan phí HCNS · tính lại nợ tồn từ tháng áp dụng
//
// ⚠ Dữ liệu production thật. LUÔN chạy --dry trước, đọc bảng đối chiếu, rồi mới --apply.
// Chạy lại nhiều lần an toàn: công ty đã tách rồi (uses_hcns=true) sẽ bị BỎ QUA, không trừ hai lần.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import XLSX from 'xlsx'
import { syncHcnsForClient } from '../lib/hcnsSync.js'
import { recomputeRolloversFrom } from '../lib/debtRollover.js'

const file = process.argv[2]
const apply = process.argv.includes('--apply')
const fromArg = (process.argv.find(a => a.startsWith('--from=')) || '').split('=')[1]
  || (process.argv[process.argv.indexOf('--from') + 1] || '')

if (!file || (!apply && !process.argv.includes('--dry'))) {
  console.log('Dùng: node scripts/split-hcns-fee.mjs "<file.xlsx>" --dry | --apply [--from 2026-09]')
  process.exit(1)
}

const now = new Date()
let Y = now.getFullYear(), M = now.getMonth() + 1
if (/^\d{4}-\d{1,2}$/.test(fromArg)) { const [a, b] = fromArg.split('-'); Y = Number(a); M = Number(b) }

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const digits = (v) => String(v ?? '').replace(/\D/g, '')
const norm = (v) => String(v ?? '').trim().toLowerCase()

// ── Đọc Excel: dò cột theo DÒNG TIÊU ĐỀ, không đánh số cứng ────────────────────────────────
// File thật hay có cột trống ở đầu hoặc vài dòng tiêu đề phía trên — đánh số cứng là lệch hết.
const wb = XLSX.readFile(file)
const sheet = wb.Sheets[wb.SheetNames[0]]
const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

let head = -1, cMst = -1, cFee = -1, cName = -1
for (let i = 0; i < Math.min(15, grid.length); i++) {
  const row = grid[i].map(norm)
  const mst = row.findIndex(v => v.includes('mst') || v.includes('mã số thuế') || v.includes('ma so thue'))
  const fee = row.findIndex(v => v.includes('hcns') || v.includes('phí tách') || v.includes('phi tach'))
  if (mst >= 0 && fee >= 0) {
    head = i; cMst = mst; cFee = fee
    cName = row.findIndex(v => v.includes('tên') || v.includes('ten') || v.includes('công ty') || v.includes('cong ty'))
    break
  }
}
if (head < 0) {
  console.log('Không tìm được dòng tiêu đề. File cần có một cột chứa chữ "MST" (hoặc "Mã số thuế")')
  console.log('và một cột chứa chữ "HCNS". Các cột hiện có ở 5 dòng đầu:')
  grid.slice(0, 5).forEach((r, i) => console.log('  dòng ' + i + ': ' + JSON.stringify(r)))
  process.exit(1)
}
console.log('Cột đọc được: MST=' + cMst + ', phí HCNS=' + cFee + (cName >= 0 ? ', tên=' + cName : '') + '\n')

const items = []
for (let i = head + 1; i < grid.length; i++) {
  const mst = digits(grid[i][cMst])
  const fee = Number(digits(grid[i][cFee])) || 0
  if (!mst) continue
  items.push({ mst, fee, label: cName >= 0 ? String(grid[i][cName] || '').trim() : '' })
}
console.log((apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi gì)') + ' — ' + items.length + ' dòng, áp dụng từ T' + M + '/' + Y + '\n')

// ── Đối chiếu với database ─────────────────────────────────────────────────────────────────
const { data: clients } = await s.from('clients')
  .select('id, name, tax_code, monthly_fee, uses_hcns, is_active').in('tax_code', items.map(i => i.mst))
const byMst = new Map()
for (const c of clients || []) {
  if (!byMst.has(c.tax_code)) byMst.set(c.tax_code, [])
  byMst.get(c.tax_code).push(c)
}

const ok = [], skip = []
for (const it of items) {
  const found = byMst.get(it.mst) || []
  if (found.length === 0) { skip.push({ ...it, why: 'không có công ty nào MST này' }); continue }
  if (found.length > 1)  { skip.push({ ...it, why: found.length + ' công ty trùng MST — phải tách tay' }); continue }
  const c = found[0]
  if (c.uses_hcns)       { skip.push({ ...it, why: 'đã tách rồi (uses_hcns=true)', c }); continue }
  if (it.fee <= 0)       { skip.push({ ...it, why: 'phí HCNS trống hoặc bằng 0', c }); continue }
  const cur = Number(c.monthly_fee) || 0
  if (it.fee >= cur)     { skip.push({ ...it, why: 'phí HCNS (' + fmt(it.fee) + ') >= phí kế toán (' + fmt(cur) + ')', c }); continue }
  ok.push({ ...it, c, cur, newFee: cur - it.fee })
}

console.log('SẼ TÁCH — ' + ok.length + ' công ty')
console.log('  ' + 'MST'.padEnd(14) + 'Công ty'.padEnd(38) + 'Phí KT cũ'.padStart(13) + 'Phí HCNS'.padStart(13) + 'Phí KT mới'.padStart(13) + 'Tổng'.padStart(13))
for (const r of ok) {
  const total = r.newFee + r.fee
  console.log('  ' + r.mst.padEnd(14) + r.c.name.slice(0, 36).padEnd(38)
    + fmt(r.cur).padStart(13) + fmt(r.fee).padStart(13) + fmt(r.newFee).padStart(13)
    + (fmt(total) + (total === r.cur ? ' ✓' : ' ✗')).padStart(15))
}
const lech = ok.filter(r => r.newFee + r.fee !== r.cur)
if (lech.length) { console.log('\n⛔ ' + lech.length + ' dòng tổng KHÔNG khớp phí cũ — dừng lại, không ghi gì.'); process.exit(1) }

if (skip.length) {
  console.log('\nBỎ QUA — ' + skip.length + ' dòng')
  for (const r of skip) console.log('  ' + r.mst.padEnd(14) + (r.c?.name || r.label || '').slice(0, 36).padEnd(38) + r.why)
}

if (!apply) {
  console.log('\nXem xong thấy đúng thì chạy lại với --apply.')
  process.exit(0)
}

// ── Ghi thật ───────────────────────────────────────────────────────────────────────────────
console.log('\nĐang ghi...')
let done = 0
for (const r of ok) {
  const { error: upErr } = await s.from('clients')
    .update({ monthly_fee: r.newFee, uses_hcns: true }).eq('id', r.c.id)
  if (upErr) { console.log('  LỖI ' + r.c.name + ': ' + upErr.message); continue }

  await s.from('service_fees').upsert({
    client_id: r.c.id, year: Y, month: M, type: 'fee_plan',
    amount: r.newFee, note: 'Tách phí HCNS khỏi phí kế toán',
  }, { onConflict: 'client_id,year,month,type' })

  await s.from('client_change_log').insert({
    client_id: r.c.id, entity: 'monthly_fee', entity_label: 'Phí dịch vụ kế toán hàng tháng',
    field: 'monthly_fee', old_value: String(r.cur), new_value: String(r.newFee),
    action: 'update', changed_by: null,
  })

  await syncHcnsForClient(s, {
    clientId: r.c.id, usesHcns: true, hcnsFee: r.fee, createdBy: null, feeAt: { year: Y, month: M },
  })

  // Phí kế toán vừa giảm -> nợ tồn đã ghi cho các tháng từ đây trở đi phải tính lại.
  await recomputeRolloversFrom(s, r.c.id, Y, M)

  done++
  console.log('  ✓ ' + r.c.name + ': ' + fmt(r.cur) + ' -> KT ' + fmt(r.newFee) + ' + HCNS ' + fmt(r.fee))
}
console.log('\nXong: ' + done + '/' + ok.length + ' công ty đã tách.')
