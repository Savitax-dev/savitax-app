// Chụp toàn bộ dữ liệu công nợ hiện tại ra 1 file JSON ở máy, làm bản đối chiếu TRƯỚC khi sửa
// các route công nợ đang chạy thật (xem sql/06_hcns_module.sql + plan module HCNS).
//
//   node scripts/snapshot-debt.mjs            -> ghi ra snapshots/debt-<timestamp>.json
//   node scripts/snapshot-debt.mjs --compare snapshots/debt-xxx.json
//
// Chỉ ĐỌC dữ liệu, không ghi gì lên Supabase.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)

// PostgREST trả tối đa 1000 dòng/lần và KHÔNG báo lỗi khi bị cắt — phải phân trang thủ công,
// nếu không bản chụp sẽ thiếu dữ liệu một cách âm thầm (đã từng làm hỏng số liệu %-KPI).
async function fetchAll(table, columns, orderBy) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s.from(table).select(columns)
      .order(orderBy, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(table + ': ' + error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function snapshot() {
  const [serviceFees, rollovers, clients] = await Promise.all([
    fetchAll('service_fees', 'id,client_id,year,month,type,amount,note,created_at', 'id'),
    fetchAll('debt_rollovers', 'id,client_id,year,month,rolled_amount,remaining_amount', 'id'),
    fetchAll('clients', 'id,name,client_code,monthly_fee,fee_period,other_debt', 'id'),
  ])
  return {
    takenAt: new Date().toISOString(),
    counts: { service_fees: serviceFees.length, debt_rollovers: rollovers.length, clients: clients.length },
    service_fees: serviceFees,
    debt_rollovers: rollovers,
    clients,
  }
}

// So 2 bản chụp: báo đúng những dòng đã thêm / mất / đổi số tiền.
function compare(before, after) {
  const out = []
  const keyOf = {
    service_fees: r => r.client_id + '|' + r.year + '|' + r.month + '|' + r.type,
    debt_rollovers: r => r.client_id + '|' + r.year + '|' + r.month,
    clients: r => r.id,
  }
  const moneyOf = {
    service_fees: r => Number(r.amount) || 0,
    debt_rollovers: r => (Number(r.rolled_amount) || 0) + '/' + (Number(r.remaining_amount) || 0),
    clients: r => (Number(r.monthly_fee) || 0) + '/' + (Number(r.other_debt) || 0),
  }
  for (const table of ['service_fees', 'debt_rollovers', 'clients']) {
    const b = new Map(before[table].map(r => [keyOf[table](r), r]))
    const a = new Map(after[table].map(r => [keyOf[table](r), r]))
    for (const [k, row] of a) {
      if (!b.has(k)) out.push({ table, change: 'THÊM MỚI', key: k, now: moneyOf[table](row) })
      else if (moneyOf[table](b.get(k)) !== moneyOf[table](row))
        out.push({ table, change: 'ĐỔI SỐ TIỀN', key: k, before: moneyOf[table](b.get(k)), now: moneyOf[table](row) })
    }
    for (const [k, row] of b) if (!a.has(k)) out.push({ table, change: 'BỊ MẤT', key: k, before: moneyOf[table](row) })
  }
  return out
}

const compareTo = process.argv.includes('--compare')
  ? process.argv[process.argv.indexOf('--compare') + 1]
  : null

const now = await snapshot()
console.log('Đã đọc:', now.counts)

if (compareTo) {
  const before = JSON.parse(readFileSync(compareTo, 'utf8'))
  const diffs = compare(before, now)
  console.log('\nSo với ' + compareTo + ' (chụp lúc ' + before.takenAt + '):')
  if (!diffs.length) console.log('  Không có thay đổi nào. Dữ liệu công nợ nguyên vẹn.')
  else {
    console.log('  ' + diffs.length + ' thay đổi:')
    for (const d of diffs.slice(0, 100)) {
      console.log('  [' + d.change + '] ' + d.table + ' ' + d.key +
        (d.before !== undefined ? '  ' + d.before + ' -> ' + d.now : '  ' + d.now))
    }
    if (diffs.length > 100) console.log('  ... còn ' + (diffs.length - 100) + ' dòng nữa')
  }
} else {
  if (!existsSync('snapshots')) mkdirSync('snapshots')
  const file = 'snapshots/debt-' + now.takenAt.replace(/[:.]/g, '-') + '.json'
  writeFileSync(file, JSON.stringify(now, null, 1))
  console.log('Đã lưu bản chụp:', file)
  console.log('Sau khi sửa code, chạy lại:  node scripts/snapshot-debt.mjs --compare ' + file)
}
