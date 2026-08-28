// Kiểm việc thu nợ tồn có trừ song song vào dòng debt_rollovers của tháng gốc không
// (lib/debtRollover.js -> applyOldDebtPayment).
//
//   node scripts/test-old-debt-sync.mjs
//
// Dùng công ty TẠM rồi xoá sạch. Không đụng công ty thật nào.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { applyOldDebtPayment } from '../lib/debtRollover.js'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

const MARK = 'ZZ_TEST_NOTON_' + Date.now()
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [OK]    ' + m) }
const ng = (m) => { fail++; console.log('  [LỖI]   ' + m) }

let clientId = null

try {
  const { data: st } = await s.from('staff').select('id').limit(1).single()
  const { data: c } = await s.from('clients').insert({
    name: MARK, tax_code: MARK, client_code: MARK,
    monthly_fee: 1000000, fee_period: 'monthly', report_type: 'monthly',
    assigned_to: st.id, status: 'active', is_active: true, other_debt: 3000000,
  }).select().single()
  clientId = c.id

  // 3 tháng nợ tồn: T1 1.000.000, T2 1.000.000, T3 1.000.000
  await s.from('debt_rollovers').insert([
    { client_id: clientId, year: 2026, month: 1, rolled_amount: 1000000, remaining_amount: 1000000 },
    { client_id: clientId, year: 2026, month: 2, rolled_amount: 1000000, remaining_amount: 1000000 },
    { client_id: clientId, year: 2026, month: 3, rolled_amount: 1000000, remaining_amount: 1000000 },
  ])
  console.log('Công ty tạm: nợ tồn 3.000.000đ, 3 tháng mỗi tháng 1.000.000đ\n')

  console.log('1) Thu 1.500.000đ — phải trừ hết T1 và một nửa T2')
  {
    const r = await applyOldDebtPayment(s, clientId, 1500000)
    const { data: rolls } = await s.from('debt_rollovers').select('month, remaining_amount')
      .eq('client_id', clientId).order('month')
    const map = Object.fromEntries(rolls.map(x => [x.month, Number(x.remaining_amount)]))
    map[1] === 0 ? ok('T1 về 0đ') : ng('T1 phải về 0, đang ' + fmt(map[1]))
    map[2] === 500000 ? ok('T2 còn 500.000đ') : ng('T2 phải còn 500.000, đang ' + fmt(map[2]))
    map[3] === 1000000 ? ok('T3 chưa đụng tới') : ng('T3 không được đụng, đang ' + fmt(map[3]))
    r.leftover === 0 ? ok('không còn dư') : ng('dư ' + fmt(r.leftover))
  }

  console.log('\n2) Thu tiếp 1.500.000đ — vừa đủ hết phần còn lại')
  {
    const r = await applyOldDebtPayment(s, clientId, 1500000)
    const { data: rolls } = await s.from('debt_rollovers').select('remaining_amount').eq('client_id', clientId)
    const total = rolls.reduce((a, x) => a + Number(x.remaining_amount), 0)
    total === 0 ? ok('mọi tháng đều về 0đ') : ng('còn tổng ' + fmt(total))
    r.leftover === 0 ? ok('không còn dư') : ng('dư ' + fmt(r.leftover))
  }

  console.log('\n3) Thu thêm khi không còn dòng nợ tồn nào')
  {
    // Tình huống thật: other_debt còn khoản "Thu khác — Tồn đọng" nhập tay, không có dòng
    // rollover nào đứng sau. Phải trả về dư đúng bằng số thu, KHÔNG được lỗi.
    const r = await applyOldDebtPayment(s, clientId, 700000)
    r.applied.length === 0 ? ok('không đụng dòng nào') : ng('không được đụng dòng nào')
    r.leftover === 700000 ? ok('trả về dư đúng 700.000đ (phần tồn đọng nhập tay)') : ng('dư sai: ' + fmt(r.leftover))
  }

  console.log('\n4) Thu số 0 hoặc âm')
  {
    const a = await applyOldDebtPayment(s, clientId, 0)
    const b = await applyOldDebtPayment(s, clientId, -500)
    a.applied.length === 0 && b.applied.length === 0 ? ok('bỏ qua, không đụng dữ liệu') : ng('phải bỏ qua')
  }

} catch (e) {
  ng('Ngoại lệ: ' + e.message)
} finally {
  if (clientId) {
    await s.from('debt_rollovers').delete().eq('client_id', clientId)
    await s.from('service_fees').delete().eq('client_id', clientId)
    await s.from('clients').delete().eq('id', clientId)
    const { count } = await s.from('clients').select('id', { count: 'exact', head: true }).eq('id', clientId)
    console.log('\nDọn dẹp: ' + (count === 0 ? 'đã xoá sạch công ty tạm.' : 'CHÚ Ý — còn sót!'))
  }
  console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi.')
  process.exit(fail === 0 ? 0 : 1)
}
