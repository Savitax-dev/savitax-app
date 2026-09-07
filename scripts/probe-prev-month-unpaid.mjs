// CHỈ ĐỌC — hai chế độ:
//   node scripts/probe-prev-month-unpaid.mjs             -> công ty đang rơi vào tình huống
//        "tháng trước chưa thu mà vẫn còn hạn ghi nhận" (nhóm mà cảnh báo sẽ bảo vệ)
//   node scripts/probe-prev-month-unpaid.mjs --history   -> các ca CŨ nghi ghi nhầm tháng:
//        tháng trước ghi 0đ, tháng sau ghi ĐÚNG BẰNG phí tháng trước
//
// ⚠ Danh sách --history là để ĐỐI CHIẾU TAY, không phải bằng chứng. Dữ liệu không nói được khách
// trả cho tháng nào — có khách thật sự bỏ một tháng rồi trả tháng sau. Tuyệt đối không tự dời
// tiền sang tháng khác dựa trên danh sách này.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { feeCountsForMonth, resolveFeeForMonth, isPastEditDeadline } from '../lib/feeDue.js'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const now = new Date()
const Y = now.getFullYear(), M = now.getMonth() + 1
let pY = Y, pM = M - 1; if (pM === 0) { pM = 12; pY-- }

console.log('Hôm nay ' + now.toLocaleDateString('vi-VN') + ' — tháng hiện tại T' + M + '/' + Y
  + ', tháng trước T' + pM + '/' + pY)
console.log('T' + pM + '/' + pY + ' còn hạn ghi nhận? ' + (isPastEditDeadline(pY, pM, now) ? 'KHÔNG (đã quá hạn)' : 'CÒN') + '\n')

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

const clients = await all(() => s.from('clients')
  .select('id, name, tax_code, monthly_fee, fee_period, assigned_to, is_active, status, created_at')
  .eq('is_active', true))
const staff = await all(() => s.from('staff').select('id, full_name'))
const nameOf = (id) => (staff.find(x => x.id === id) || {}).full_name || '(chưa gán)'
const fees = await all(() => s.from('service_fees').select('client_id, year, month, amount, type')
  .in('type', ['ketoan', 'fee_plan']))

const plans = fees.filter(f => f.type === 'fee_plan')
const paid = new Map()
for (const f of fees) if (f.type === 'ketoan') paid.set(f.client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)

// ── Chế độ --history: rà lại các ca cũ ────────────────────────────────────────────────────
if (process.argv.includes('--history')) {
  console.log('CÁC CA CŨ NGHI GHI NHẦM THÁNG (tháng trước 0đ, tháng sau ghi đúng bằng phí tháng trước)')
  console.log('')
  let tot = 0
  for (let m = 1; m < M; m++) {
    const nm = m + 1
    for (const c of clients) {
      if (!feeCountsForMonth(c.fee_period, Y, m, now)) continue
      const cr = c.created_at ? new Date(c.created_at) : null
      // Công ty vào hệ thống sau tháng đang xét thì tháng đó vốn không có gì để thu.
      if (cr && (cr.getFullYear() * 12 + cr.getMonth()) > (Y * 12 + (m - 1))) continue
      const fee = resolveFeeForMonth(plans, c.id, Y, m, c.monthly_fee, [])
      if (fee <= 0) continue
      const a = paid.get(c.id + '_' + Y + '_' + m) || 0
      const b = paid.get(c.id + '_' + Y + '_' + nm) || 0
      if (a !== 0 || b <= 0) continue
      tot++
      console.log('T' + m + ' -> T' + nm + '   ' + nameOf(c.assigned_to).slice(0, 20).padEnd(22)
        + c.name.slice(0, 42).padEnd(44)
        + 'phí T' + m + ' ' + fmt(fee) + 'đ, T' + nm + ' ghi ' + fmt(b) + 'đ'
        + (b === fee ? '   ← khớp chằn chặn' : ''))
    }
  }
  console.log('')
  console.log('TỔNG: ' + tot + ' lượt. Đưa cho nhân viên phụ trách tự đối chiếu, KHÔNG tự sửa.')
  process.exit(0)
}

const hits = []
for (const c of clients) {
  if (!feeCountsForMonth(c.fee_period, pY, pM, now)) continue
  const fee = resolveFeeForMonth(plans, c.id, pY, pM, c.monthly_fee, [])
  if (fee <= 0) continue
  const got = paid.get(c.id + '_' + pY + '_' + pM) || 0
  if (got >= fee) continue
  hits.push({ c, fee, got, thisMonth: paid.get(c.id + '_' + Y + '_' + M) || 0 })
}

hits.sort((a, b) => nameOf(a.c.assigned_to).localeCompare(nameOf(b.c.assigned_to)))
console.log('CÔNG TY CHƯA THU ĐỦ T' + pM + '/' + pY + ': ' + hits.length + '/' + clients.length + '\n')
let cur = null
for (const h of hits) {
  const nm = nameOf(h.c.assigned_to)
  if (nm !== cur) { cur = nm; console.log('— ' + nm) }
  console.log('   ' + h.c.name.slice(0, 42).padEnd(44)
    + ('T' + pM + ': ' + fmt(h.got) + '/' + fmt(h.fee)).padEnd(28)
    + (h.thisMonth > 0 ? '⚠ T' + M + ' ĐÃ ghi ' + fmt(h.thisMonth) + 'đ' : ''))
}
const already = hits.filter(h => h.thisMonth > 0)
console.log('\nTrong đó ĐÃ ghi tiền vào T' + M + ' dù T' + pM + ' còn thiếu: ' + already.length + ' công ty')
console.log('-> đây chính là các ca mà cảnh báo mới sẽ bắt được.')
