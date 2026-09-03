// Kiểm luật "nợ tồn phí HCNS" bằng database GIẢ — không đụng vào Supabase thật.
//
//   node scripts/test-hcns-rollover.mjs
//
// Không dùng công ty thật để thử vì hàm này GHI TIỀN (clients.other_debt): sai một chốt chặn là
// sinh nợ ảo hàng loạt, đúng lớp lỗi đã xảy ra thật với phí kế toán.
import { ensureHcnsRollovers } from '../lib/hcnsRollover.js'

const now = new Date()
const Y = now.getFullYear(), M = now.getMonth() + 1
const prev = (n) => { let y = Y, m = M - n; while (m <= 0) { m += 12; y-- } return { year: y, month: m } }

function makeDb({ hcnsClients, fees = [], rollovers = [], clients = [] }) {
  const writes = { inserted: [], updated: [] }
  const q = (rows) => {
    const o = {
      _rows: rows,
      select() { return o }, in() { return o }, gte() { return o },
      eq(col, val) { o._rows = o._rows.filter(r => r[col] === val); return o },
      not() { return o },
      then(res) { return Promise.resolve({ data: o._rows, error: null }).then(res) },
    }
    return o
  }
  return {
    writes,
    from(table) {
      if (table === 'hcns_clients') return q([...hcnsClients])
      if (table === 'hcns_service_fees') return q([...fees])
      if (table === 'clients') return {
        ...q([...clients]),
        update(patch) { return { eq: (c, id) => { writes.updated.push({ id, ...patch }); return Promise.resolve({ error: null }) } } },
      }
      if (table === 'debt_rollovers') return {
        ...q([...rollovers]),
        insert(rows) { writes.inserted.push(...rows); return Promise.resolve({ error: null }) },
      }
      throw new Error('bảng lạ: ' + table)
    },
  }
}

let pass = 0, fail = 0
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}

const base = (over = {}) => ({
  id: 'h1', linked_client_id: 'c1', hcns_fee: 1000000, fee_period: 'monthly',
  category: 'thoi_ky', is_active: true,
  created_at: new Date(Y - 2, 0, 1).toISOString(), ...over,
})

console.log('\n1. Tháng đã qua chưa thu → sinh nợ tồn')
{
  const db = makeDb({ hcnsClients: [base()], clients: [{ id: 'c1', other_debt: 0 }] })
  const r = await ensureHcnsRollovers(db, ['c1'], Y, M)
  check('có ghi dòng', r.inserted > 0, 'inserted=' + r?.inserted)
  check('mọi dòng đều source=hcns', db.writes.inserted.every(x => x.source === 'hcns'))
  check('mọi dòng đều client_id kế toán', db.writes.inserted.every(x => x.client_id === 'c1'))
  check('other_debt được cộng', db.writes.updated[0]?.other_debt > 0, JSON.stringify(db.writes.updated[0]))
}

console.log('\n2. Đã thu đủ → KHÔNG sinh dòng nào')
{
  const fees = []
  for (let i = 1; i <= 24; i++) { const p = prev(i); fees.push({ hcns_client_id: 'h1', year: p.year, month: p.month, amount: 1000000, type: 'hcns' }) }
  const db = makeDb({ hcnsClients: [base()], fees, clients: [{ id: 'c1', other_debt: 0 }] })
  const r = await ensureHcnsRollovers(db, ['c1'], Y, M)
  check('không dòng nào', r.inserted === 0, 'inserted=' + r.inserted)
  check('không đụng other_debt', db.writes.updated.length === 0)
}

console.log('\n3. Chốt chặn ngày bật DV HCNS — không bịa nợ cho tháng trước đó')
{
  const p2 = prev(2)
  const db = makeDb({
    hcnsClients: [base({ created_at: new Date(p2.year, p2.month - 1, 1).toISOString() })],
    clients: [{ id: 'c1', other_debt: 0 }],
  })
  const r = await ensureHcnsRollovers(db, ['c1'], Y, M)
  const oldest = db.writes.inserted.map(x => x.year * 12 + x.month).sort((a, b) => a - b)[0]
  check('không dòng nào trước tháng bật DV', oldest >= p2.year * 12 + p2.month,
    'dòng cũ nhất=' + oldest + ', mốc=' + (p2.year * 12 + p2.month))
  check('số dòng nhỏ hơn hẳn 24', r.inserted < 24, 'inserted=' + r.inserted)
}

console.log('\n4. Đã ghi rồi thì không ghi lại (chạy lại nhiều lần an toàn)')
{
  const p1 = prev(1), p2 = prev(2)
  const db = makeDb({
    hcnsClients: [base()],
    rollovers: [{ client_id: 'c1', year: p1.year, month: p1.month, source: 'hcns' },
                { client_id: 'c1', year: p2.year, month: p2.month, source: 'hcns' }],
    clients: [{ id: 'c1', other_debt: 0 }],
  })
  await ensureHcnsRollovers(db, ['c1'], Y, M)
  const dup = db.writes.inserted.filter(x =>
    (x.year === p1.year && x.month === p1.month) || (x.year === p2.year && x.month === p2.month))
  check('không ghi trùng 2 tháng đã có', dup.length === 0, 'trùng=' + dup.length)
}

console.log('\n5. Phí HCNS = 0 → bỏ qua hoàn toàn')
{
  const db = makeDb({ hcnsClients: [base({ hcns_fee: 0 })], clients: [{ id: 'c1', other_debt: 0 }] })
  const r = await ensureHcnsRollovers(db, ['c1'], Y, M)
  check('không dòng nào', r.inserted === 0)
}

console.log('\n6. Công ty thu theo QUÝ — chỉ tháng cuối quý mới sinh nợ')
{
  const db = makeDb({ hcnsClients: [base({ fee_period: 'quarterly' })], clients: [{ id: 'c1', other_debt: 0 }] })
  const r = await ensureHcnsRollovers(db, ['c1'], Y, M)
  const badMonth = db.writes.inserted.find(x => x.month % 3 !== 0)
  check('không dòng nào ở tháng giữa quý', !badMonth, badMonth && 'T' + badMonth.month)
  check('ít dòng hơn hẳn công ty tháng', r.inserted <= 8, 'inserted=' + r.inserted)
}

console.log('\n7. Bản clone (không có bảng hcns_clients) → trả null, không ném lỗi')
{
  const db = { from() { return { select: () => ({ in: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }) }) }) }) } } }
  const r = await ensureHcnsRollovers(db, ['c1'], Y, M)
  check('trả null', r === null)
}

console.log('\n8. Không có công ty nào → thoát ngay')
{
  const r = await ensureHcnsRollovers(makeDb({ hcnsClients: [] }), [], Y, M)
  check('trả null', r === null)
}

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + ' đạt, ' + fail + ' hỏng')
process.exitCode = fail === 0 ? 0 : 1
