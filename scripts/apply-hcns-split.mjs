// Tách phí HCNS ra khỏi phí kế toán HÀNG LOẠT, từ danh sách đã bóc tách sẵn (JSON).
//
//   node scripts/apply-hcns-split.mjs snapshots/tach-hcns.json --dry     -- xem trước, KHÔNG ghi
//   node scripts/apply-hcns-split.mjs snapshots/tach-hcns.json --apply   -- ghi thật
//   ...thêm --from 2026-09  để đổi tháng áp dụng (mặc định tháng hiện tại)
//
// File JSON: [{ mst, name, fee, note? }] — `fee` là phí HCNS ĐÃ GỒM VAT, và với công ty thu theo
// QUÝ thì phải là tiền CẢ QUÝ (cùng quy ước với clients.monthly_fee).
//
// Làm đúng những gì nút "Tách phí HCNS" trên giao diện làm, chỉ khác là làm một lượt:
//   clients.monthly_fee -= phíHCNS · bật uses_hcns · ghi mốc fee_plan phí kế toán mới
//   · tạo/cập nhật hcns_clients + mốc fee_plan phí HCNS · tính lại nợ tồn từ tháng áp dụng
//
// ⚠ Dữ liệu production thật. LUÔN chạy --dry trước, đọc bảng đối chiếu, rồi mới --apply.
// Chạy lại nhiều lần an toàn: công ty đã tách (uses_hcns=true) bị BỎ QUA, không trừ hai lần.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { syncHcnsForClient } from '../lib/hcnsSync.js'
import { recomputeRolloversFrom } from '../lib/debtRollover.js'

const file = process.argv[2]
const apply = process.argv.includes('--apply')
const fromArg = (process.argv.find(a => a.startsWith('--from=')) || '').split('=')[1]
  || (process.argv[process.argv.indexOf('--from') + 1] || '')
if (!file || (!apply && !process.argv.includes('--dry'))) {
  console.log('Dùng: node scripts/apply-hcns-split.mjs <file.json> --dry | --apply [--from 2026-09]')
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
// So MST sau khi BỎ SỐ 0 ĐẦU — hộ kinh doanh có MST 12 số, file xuất ra hay thừa một số 0 phía
// trước (079202030307 vs 0079202030307). So thẳng thì các hộ kinh doanh bị bỏ qua lặng lẽ.
const mstKey = (v) => digits(v).replace(/^0+/, '')

async function all(build, page = 1000) {
  let out = [], from = 0
  for (;;) {
    const { data, error } = await build().range(from, from + page - 1)
    if (error) throw error
    out = out.concat(data || [])
    if (!data || data.length < page) return out
    from += page
  }
}

const rows = JSON.parse(readFileSync(file, 'utf8'))
console.log((apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi gì)') +
  ' — ' + rows.length + ' dòng, áp dụng từ T' + M + '/' + Y + '\n')

const clients = await all(() => s.from('clients')
  .select('id, name, tax_code, monthly_fee, fee_period, uses_hcns, is_active, status'))
const byKey = new Map()
for (const c of clients) {
  const k = mstKey(c.tax_code)
  if (!byKey.has(k)) byKey.set(k, [])
  byKey.get(k).push(c)
}

const ok = [], skip = []
for (const r of rows) {
  const fee = Number(digits(r.fee)) || 0
  const found = byKey.get(mstKey(r.mst)) || []
  const add = (why, extra) => skip.push({ ...r, fee, why, ...extra })
  if (found.length === 0) { add('không có công ty nào mang MST này'); continue }
  if (found.length > 1)   { add(found.length + ' công ty trùng MST — phải tách tay'); continue }
  const c = found[0]
  if (!c.is_active)       { add('công ty đã ngưng dịch vụ', { c }); continue }
  if (c.uses_hcns)        { add('đã tách rồi', { c }); continue }
  if (fee <= 0)           { add('phí HCNS trống hoặc bằng 0', { c }); continue }
  const cur = Number(c.monthly_fee) || 0
  if (fee >= cur)         { add('phí HCNS (' + fmt(fee) + ') >= phí kế toán (' + fmt(cur) + ')', { c }); continue }
  ok.push({ ...r, fee, c, cur, newFee: cur - fee })
}

// Khoản đã thu của THÁNG ÁP DỤNG. Khách trả gộp cả phí kế toán lẫn HCNS trước khi tách thì con số
// này lớn hơn phí kế toán mới — phần dư chính là tiền HCNS, phải chuyển sang đúng sổ.
const ids = ok.map(r => r.c.id)
const paidRows = ids.length
  ? await all(() => s.from('service_fees').select('client_id, amount')
      .in('client_id', ids).eq('type', 'ketoan').eq('year', Y).eq('month', M))
  : []
const paidBy = new Map()
for (const p of paidRows) paidBy.set(p.client_id, (paidBy.get(p.client_id) || 0) + (Number(p.amount) || 0))
for (const r of ok) {
  const paid = paidBy.get(r.c.id) || 0
  r.paidKetoan = paid
  r.moveToHcns = Math.max(0, Math.min(paid - r.newFee, r.fee))
}

const per = (c) => c.fee_period === 'quarterly' ? '/quý  ' : '/tháng'
console.log('SẼ TÁCH — ' + ok.length + ' công ty')
console.log('  ' + 'MST'.padEnd(15) + 'Công ty'.padEnd(38) + 'Phí KT cũ'.padStart(13) +
  'Phí HCNS'.padStart(13) + 'Phí KT mới'.padStart(13) + 'Tổng'.padStart(15) + '  Kỳ thu')
for (const r of ok) {
  const total = r.newFee + r.fee
  console.log('  ' + r.mst.padEnd(15) + r.c.name.slice(0, 36).padEnd(38) +
    fmt(r.cur).padStart(13) + fmt(r.fee).padStart(13) + fmt(r.newFee).padStart(13) +
    (fmt(total) + (total === r.cur ? ' ✓' : ' ✗')).padStart(15) + '  ' + per(r.c))
  if (r.note) console.log('      ↳ ' + r.note)
}

const lech = ok.filter(r => r.newFee + r.fee !== r.cur)
if (lech.length) { console.log('\n⛔ ' + lech.length + ' dòng tổng KHÔNG khớp phí cũ — dừng, không ghi gì.'); process.exit(1) }

const moves = ok.filter(r => r.moveToHcns > 0)
if (moves.length) {
  console.log('\nĐÃ THU T' + M + '/' + Y + ' TRƯỚC KHI TÁCH — chuyển phần dư sang mục Dịch vụ HCNS:')
  for (const r of moves) {
    console.log('  ' + r.c.name.slice(0, 40).padEnd(42) + 'đã thu ' + fmt(r.paidKetoan) +
      '  ->  kế toán ' + fmt(r.newFee) + ' + HCNS ' + fmt(r.moveToHcns))
  }
  console.log('  (khách trả gộp trước khi tách; tổng tiền không đổi, chỉ chia đúng hai sổ)')
}

const quarter = ok.filter(r => r.c.fee_period === 'quarterly')
if (quarter.length) {
  console.log('\n⚠ ' + quarter.length + ' công ty THU THEO QUÝ — số tiền ở trên là tiền CẢ QUÝ, không phải một tháng:')
  for (const r of quarter) console.log('  ' + r.c.name.slice(0, 44).padEnd(46) + fmt(r.fee) + 'đ/quý')
}

if (skip.length) {
  console.log('\nBỎ QUA — ' + skip.length + ' dòng')
  for (const r of skip) {
    console.log('  ' + r.mst.padEnd(15) + (r.c?.name || r.name || '').slice(0, 40).padEnd(42) + r.why)
  }
}

if (!apply) { console.log('\nXem thấy đúng thì chạy lại với --apply.'); process.exit(0) }

console.log('\nĐang ghi...')
let done = 0, movedTotal = 0
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

  const sync = await syncHcnsForClient(s, {
    clientId: r.c.id, usesHcns: true, hcnsFee: r.fee, createdBy: null, feeAt: { year: Y, month: M },
  })

  // Khách đã trả gộp trước khi tách -> hạ khoản thu kế toán về phí mới, phần dư ghi sang HCNS.
  if (r.moveToHcns > 0 && sync?.hcnsClientId) {
    await s.from('service_fees').upsert({
      client_id: r.c.id, year: Y, month: M, type: 'ketoan',
      amount: r.newFee, note: 'Điều chỉnh khi tách phí HCNS (phần dư chuyển sang DV HCNS)',
    }, { onConflict: 'client_id,year,month,type' })
    await s.from('hcns_service_fees').upsert({
      hcns_client_id: sync.hcnsClientId, year: Y, month: M, type: 'hcns',
      amount: r.moveToHcns, note: 'Tách từ khoản thu gộp T' + M + '/' + Y,
    }, { onConflict: 'hcns_client_id,year,month,type' })
    movedTotal += r.moveToHcns
    console.log('  ↳ ' + r.c.name.slice(0, 40) + ': chuyển ' + fmt(r.moveToHcns) + 'đ sang mục HCNS')
  }

  // Phí kế toán vừa giảm -> nợ tồn đã ghi cho các tháng từ đây trở đi phải tính lại.
  await recomputeRolloversFrom(s, r.c.id, Y, M)

  done++
  console.log('  ✓ ' + r.c.name.slice(0, 44).padEnd(46) + fmt(r.cur) + ' -> KT ' + fmt(r.newFee) + ' + HCNS ' + fmt(r.fee))
}
console.log('\nXong: ' + done + '/' + ok.length + ' công ty đã tách.' +
  (movedTotal ? '  Chuyển ' + fmt(movedTotal) + 'đ tiền đã thu sang mục HCNS.' : ''))
