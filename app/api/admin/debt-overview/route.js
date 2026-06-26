import { createClient } from '@supabase/supabase-js'
import { ensureRollovers } from '@/lib/debtRollover'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/debt-overview?year=2026&month=6
// Tổng hợp công nợ toàn công ty: theo phòng → theo nhân viên → theo từng khách hàng.
// Công ty có "nhân viên phụ" (client_secondary_staff) vẫn hiện dưới nhân viên phụ để theo dõi,
// nhưng KHÔNG cộng vào tổng phí/đã thu của họ — doanh thu chỉ tính cho nhân viên chính.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const year  = Number(searchParams.get('year')  || new Date().getFullYear())
  const month = Number(searchParams.get('month') || new Date().getMonth() + 1)

  const supabase = getAdmin()

  const [{ data: roomList }, { data: staffList }, { data: clientList }, { data: feesKetoan }, { data: feesKhach }, { data: secondaryRows }] = await Promise.all([
    supabase.from('rooms').select('id, name, type').order('name'),
    supabase.from('staff').select('id, full_name, room_id').order('full_name'),
    supabase.from('clients').select('id, name, tax_code, monthly_fee, other_debt, report_type, assigned_to, status').eq('status', 'active'),
    supabase.from('service_fees').select('client_id, amount').eq('year', year).eq('month', month).eq('type', 'ketoan'),
    supabase.from('service_fees').select('client_id, amount').eq('year', year).eq('month', month).eq('type', 'khach'),
    supabase.from('client_secondary_staff').select('client_id, staff_id'),
  ])

  // Tự động chuyển nợ thiếu của các tháng trước thành nợ tồn — chỉ khi đang xem đúng tháng hiện tại.
  const now = new Date()
  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    const clientIds = (clientList || []).map(c => c.id)
    await ensureRollovers(supabase, clientIds, year, month)
    const { data: refreshedDebt } = await supabase.from('clients').select('id, other_debt').in('id', clientIds)
    const refreshedMap = {}
    for (const r of (refreshedDebt || [])) refreshedMap[r.id] = r.other_debt
    for (const c of (clientList || [])) if (refreshedMap[c.id] !== undefined) c.other_debt = refreshedMap[c.id]
  }

  const feeMap = {}
  for (const f of (feesKetoan || [])) feeMap[f.client_id] = Number(f.amount) || 0
  const feeKhachMap = {}
  for (const f of (feesKhach || [])) feeKhachMap[f.client_id] = Number(f.amount) || 0

  const clientMap = {}
  for (const c of (clientList || [])) clientMap[c.id] = c

  const built = (roomList || []).map(room => {
    const roomStaff = (staffList || []).filter(s => s.room_id === room.id)
    const staffWithClients = roomStaff.map(s => {
      const clients = (clientList || []).filter(c => c.assigned_to === s.id).map(c => ({
        ...c,
        collected:      feeMap[c.id] || 0,
        collectedKhach: feeKhachMap[c.id] || 0,
      }))
      // Công ty mình là nhân viên phụ — chỉ để theo dõi, không cộng vào totalFee/totalCollected
      const secondaryClients = (secondaryRows || [])
        .filter(r => r.staff_id === s.id)
        .map(r => clientMap[r.client_id])
        .filter(Boolean)
        .map(c => ({ ...c, collected: feeMap[c.id] || 0, collectedKhach: feeKhachMap[c.id] || 0 }))

      const fee = clients.reduce((a, c) => a + (Number(c.monthly_fee) || 0), 0)
      const col = clients.reduce((a, c) => a + c.collected, 0)
      return { ...s, clients, secondaryClients, totalFee: fee, totalCollected: col, debtPct: fee === 0 ? 0 : Math.round(col / fee * 100) }
    })
    const rFee = staffWithClients.reduce((a, s) => a + s.totalFee, 0)
    const rCol = staffWithClients.reduce((a, s) => a + s.totalCollected, 0)
    return { room, staff: staffWithClients, totalFee: rFee, totalCollected: rCol, debtPct: rFee === 0 ? 0 : Math.round(rCol / rFee * 100) }
  }).filter(r => r.staff.some(s => s.clients.length > 0 || s.secondaryClients.length > 0))

  return Response.json({ data: built })
}
