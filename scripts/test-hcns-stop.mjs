// Kiểm luật "ngừng dùng DV HCNS từ tháng X" bằng database GIẢ — không đụng Supabase thật.
//
//   node scripts/test-hcns-stop.mjs
//
// Không thử trên công ty thật vì hàm này GỠ công ty khỏi Phòng HCNS và ghi mốc phí 0 — sai một
// chốt là mất phí của khách hoặc gỡ nhầm công ty đang dùng dịch vụ.
import { stopHcnsForClient, applyScheduledHcnsStops } from '../lib/hcnsSync.js'

const now = new Date()
const Y = now.getFullYear(), M = now.getMonth() + 1
const shift = (n) => { let y = Y, m = M + n; while (m > 12) { m -= 12; y++ } while (m <= 0) { m += 12; y-- } return { year: y, month: m } }

function makeDb({ hcns = [], plans = [] }) {
  const w = { plans: [], hcnsUpd: [], clientUpd: [] }
  const q = (rows) => {
    const o = {
      _r: rows,
      select() { return o }, in() { return o },
      eq(c, v) { o._r = o._r.filter(r => r[c] === v); return o },
      maybeSingle() { return Promise.resolve({ data: o._r[0] || null, error: null }) },
      then(res) { return Promise.resolve({ data: o._r, error: null }).then(res) },
    }
    return o
  }
  return {
    w,
    from(t) {
      if (t === 'hcns_clients') return {
        ...q([...hcns]),
        update(p) { return { eq: (c, v) => { w.hcnsUpd.push({ id: v, ...p }); return Promise.resolve({ error: null }) } } },
      }
      if (t === 'clients') return {
        ...q([]),
        update(p) { return { eq: (c, v) => { w.clientUpd.push({ id: v, ...p }); return Promise.resolve({ error: null }) } } },
      }
      if (t === 'hcns_service_fees') return {
        ...q([...plans]),
        upsert(row) { w.plans.push(row); return Promise.resolve({ error: null }) },
      }
      throw new Error('bảng lạ: ' + t)
    },
  }
}

let pass = 0, fail = 0
const check = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')) } }

const row = (over = {}) => ({ id: 'h1', linked_client_id: 'c1', category: 'thoi_ky', is_active: true, ...over })

console.log('\n1. Ngừng từ THÁNG NÀY → gỡ ngay + ghi mốc phí 0')
{
  const db = makeDb({ hcns: [row()] })
  const r = await stopHcnsForClient(db, { clientId: 'c1', stopAt: { year: Y, month: M } })
  check('không phải hẹn trước', r.scheduled === false)
  check('ghi mốc phí 0 đúng tháng', db.w.plans[0]?.amount === 0 && db.w.plans[0]?.year === Y && db.w.plans[0]?.month === M,
    JSON.stringify(db.w.plans[0]))
  check('gỡ khỏi tag Thời kỳ', db.w.hcnsUpd[0]?.is_active === false)
  check('bỏ tick uses_hcns bên kế toán', db.w.clientUpd[0]?.uses_hcns === false)
}

console.log('\n2. Ngừng từ THÁNG SAU → hẹn trước, tháng này vẫn dùng bình thường')
{
  const nx = shift(1)
  const db = makeDb({ hcns: [row()] })
  const r = await stopHcnsForClient(db, { clientId: 'c1', stopAt: nx })
  check('là hẹn trước', r.scheduled === true)
  check('vẫn ghi mốc phí 0 ở tháng sau', db.w.plans[0]?.amount === 0 && db.w.plans[0]?.month === nx.month)
  check('CHƯA gỡ khỏi tag Thời kỳ', db.w.hcnsUpd.length === 0, JSON.stringify(db.w.hcnsUpd))
  check('CHƯA bỏ tick uses_hcns', db.w.clientUpd.length === 0)
}

console.log('\n3. Tới tháng hẹn → tự gỡ khi mở danh sách Phòng HCNS')
{
  const db = makeDb({
    hcns: [row()],
    plans: [{ hcns_client_id: 'h1', year: Y, month: M, amount: 0, type: 'fee_plan' }],
  })
  const n = await applyScheduledHcnsStops(db)
  check('gỡ đúng 1 công ty', n === 1, 'n=' + n)
  check('is_active về false', db.w.hcnsUpd[0]?.is_active === false)
  check('uses_hcns về false', db.w.clientUpd[0]?.uses_hcns === false)
}

console.log('\n4. Hẹn ngừng THÁNG SAU thì CHƯA được gỡ')
{
  const nx = shift(1)
  const db = makeDb({
    hcns: [row()],
    plans: [{ hcns_client_id: 'h1', year: Y, month: M, amount: 1000000, type: 'fee_plan' },
            { hcns_client_id: 'h1', year: nx.year, month: nx.month, amount: 0, type: 'fee_plan' }],
  })
  const n = await applyScheduledHcnsStops(db)
  check('không gỡ công ty nào', n === 0, 'n=' + n)
}

console.log('\n5. Đang dùng bình thường (mốc phí mới nhất > 0) → không đụng tới')
{
  const db = makeDb({
    hcns: [row()],
    plans: [{ hcns_client_id: 'h1', year: Y, month: M, amount: 2160000, type: 'fee_plan' }],
  })
  check('không gỡ', (await applyScheduledHcnsStops(db)) === 0)
}

console.log('\n6. Ngừng rồi DÙNG LẠI: mốc phí mới ở tháng sau đè lên mốc 0')
{
  const nx = shift(1)
  const db = makeDb({
    hcns: [row()],
    plans: [{ hcns_client_id: 'h1', year: Y, month: M, amount: 0, type: 'fee_plan' },
            { hcns_client_id: 'h1', year: nx.year, month: nx.month, amount: 3000000, type: 'fee_plan' }],
  })
  // Tháng NÀY vẫn là 0 nên vẫn bị gỡ — đúng: tháng này khách chưa dùng lại.
  check('tháng này vẫn gỡ', (await applyScheduledHcnsStops(db)) === 1)
}

console.log('\n7. Công ty chưa có hồ sơ HCNS → báo rõ, không ghi gì')
{
  const db = makeDb({ hcns: [] })
  const r = await stopHcnsForClient(db, { clientId: 'cX', stopAt: { year: Y, month: M } })
  check('trả skipped', r.skipped === true)
  check('không ghi mốc phí nào', db.w.plans.length === 0)
}

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + ' đạt, ' + fail + ' hỏng')
process.exitCode = fail === 0 ? 0 : 1
