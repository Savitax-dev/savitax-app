import { createClient } from '@supabase/supabase-js'
import { ensureRollovers } from '@/lib/debtRollover'
import { getPeriodMonths } from '@/lib/period'
import { startedByMonth } from '@/lib/contractDates'
import { dueFeeMonthsCount } from '@/lib/feeDue'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/debt-overview?year=2026&period=month&month=6
// GET /api/admin/debt-overview?year=2026&period=quarter&quarter=2
// GET /api/admin/debt-overview?year=2026&period=year
// Tổng hợp công nợ toàn công ty: theo phòng → theo nhân viên → theo từng khách hàng.
// Công ty có "nhân viên phụ" (client_secondary_staff) vẫn hiện dưới nhân viên phụ để theo dõi,
// nhưng KHÔNG cộng vào tổng phí/đã thu của họ — doanh thu chỉ tính cho nhân viên chính.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const year    = Number(searchParams.get('year') || new Date().getFullYear())
  const period  = searchParams.get('period') || 'month'
  const month   = Number(searchParams.get('month')   || new Date().getMonth() + 1)
  const quarter = Number(searchParams.get('quarter')  || 1)
  const months  = getPeriodMonths(period, { month, quarter })

  const supabase = getAdmin()

  const [{ data: roomList }, { data: staffList }, { data: clientList }, { data: feesKetoan }, { data: feesKhach }, { data: secondaryRows }] = await Promise.all([
    supabase.from('rooms').select('id, name, type').order('name'),
    supabase.from('staff').select('id, full_name, room_id').order('full_name'),
    supabase.from('clients').select('id, name, tax_code, monthly_fee, other_debt, report_type, fee_period, assigned_to, status, contract_start').eq('status', 'active'),
    supabase.from('service_fees').select('client_id, amount').eq('year', year).in('month', months).eq('type', 'ketoan'),
    supabase.from('service_fees').select('client_id, amount').eq('year', year).in('month', months).eq('type', 'khach'),
    supabase.from('client_secondary_staff').select('client_id, staff_id'),
  ])

  // Tự động chuyển nợ thiếu của các tháng trước thành nợ tồn — chỉ khi đang xem đúng tháng hiện tại.
  const now = new Date()
  if (period === 'month' && year === now.getFullYear() && month === now.getMonth() + 1) {
    const clientIds = (clientList || []).map(c => c.id)
    await ensureRollovers(supabase, clientIds, year, month)
    const { data: refreshedDebt } = await supabase.from('clients').select('id, other_debt').in('id', clientIds)
    const refreshedMap = {}
    for (const r of (refreshedDebt || [])) refreshedMap[r.id] = r.other_debt
    for (const c of (clientList || [])) if (refreshedMap[c.id] !== undefined) c.other_debt = refreshedMap[c.id]
  }

  // Gộp (sum) vì kỳ quý/năm có thể có nhiều dòng (nhiều tháng) cho cùng 1 công ty
  const feeMap = {}
  for (const f of (feesKetoan || [])) feeMap[f.client_id] = (feeMap[f.client_id] || 0) + (Number(f.amount) || 0)
  const feeKhachMap = {}
  for (const f of (feesKhach || [])) feeKhachMap[f.client_id] = (feeKhachMap[f.client_id] || 0) + (Number(f.amount) || 0)

  const clientMap = {}
  for (const c of (clientList || [])) clientMap[c.id] = c

  // Số tháng trong kỳ mà công ty đã bắt đầu hợp đồng (gate theo contract_start) — dùng để quyết
  // định công ty có xuất hiện trong danh sách kỳ đang xem hay không.
  const monthsActive = (c) => months.filter(m => startedByMonth(c.contract_start, year, m)).length
  // Số tiền phí trong kỳ — công ty quý: chỉ tính kỳ (tháng cuối quý) đã đến hạn VÀ đã qua hạn
  // khoan, không nhân theo số tháng thô (tránh nhân sai x3/x12 theo quý/năm).
  const feeForPeriod = (c) => (Number(c.monthly_fee) || 0) * dueFeeMonthsCount(c.fee_period, c.contract_start, year, months)

  const built = (roomList || []).map(room => {
    const roomStaff = (staffList || []).filter(s => s.room_id === room.id)
    const staffWithClients = roomStaff.map(s => {
      const clients = (clientList || []).filter(c => c.assigned_to === s.id && monthsActive(c) > 0).map(c => ({
        ...c,
        periodFee:      feeForPeriod(c),
        collected:      feeMap[c.id] || 0,
        collectedKhach: feeKhachMap[c.id] || 0,
      }))
      // Công ty mình là nhân viên phụ — chỉ để theo dõi, không cộng vào totalFee/totalCollected
      const secondaryClients = (secondaryRows || [])
        .filter(r => r.staff_id === s.id)
        .map(r => clientMap[r.client_id])
        .filter(c => c && monthsActive(c) > 0)
        .map(c => ({ ...c, periodFee: feeForPeriod(c), collected: feeMap[c.id] || 0, collectedKhach: feeKhachMap[c.id] || 0 }))

      const fee = clients.reduce((a, c) => a + c.periodFee, 0)
      const col = clients.reduce((a, c) => a + c.collected, 0)
      return { ...s, clients, secondaryClients, totalFee: fee, totalCollected: col, debtPct: fee === 0 ? (clients.length > 0 ? 100 : 0) : Math.round(col / fee * 100) }
    })
    const rFee = staffWithClients.reduce((a, s) => a + s.totalFee, 0)
    const rCol = staffWithClients.reduce((a, s) => a + s.totalCollected, 0)
    const rHasClients = staffWithClients.some(s => s.clients.length > 0)
    return { room, staff: staffWithClients, totalFee: rFee, totalCollected: rCol, debtPct: rFee === 0 ? (rHasClients ? 100 : 0) : Math.round(rCol / rFee * 100) }
  }).filter(r => r.staff.some(s => s.clients.length > 0 || s.secondaryClients.length > 0))

  return Response.json({ data: built })
}
