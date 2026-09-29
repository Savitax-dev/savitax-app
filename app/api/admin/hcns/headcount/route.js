import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/headcount?year=2026&months=7,8,9
// Số nhân sự từng tháng của các công ty Thời kỳ — cho file Excel "Biến động nhân sự" (quý/năm).
// Kèm `baseline` = số gần nhất TRƯỚC kỳ để tính biến động của tháng đầu kỳ.
// Phạm vi: có view_hcns_all_staff (hoặc admin) thấy mọi công ty, còn lại chỉ công ty mình phụ trách.
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const months = String(searchParams.get('months') || '').split(',').map(Number).filter(m => m >= 1 && m <= 12)
  if (!year || !months.length) return Response.json({ error: 'Thiếu year/months' }, { status: 400 })
  const first = Math.min(...months), last = Math.max(...months)

  const supabase = getAdmin()
  const all = await callerHasPermission('view_hcns_all_staff')
  let q = supabase.from('hcns_clients').select('id, name, client_code, assigned_to, hcns_fee, fee_period, linked_client_id')
    .eq('category', 'thoi_ky').eq('is_active', true).order('name')
  if (!all.ok) q = q.eq('assigned_to', auth.caller.staffId)
  const { data: companies, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 400 })
  const ids = (companies || []).map(c => c.id)
  if (!ids.length) return Response.json({ data: [] })

  const [{ data: rows, error: e2 }, { data: staff }, { data: linked }] = await Promise.all([
    supabase.from('hcns_headcount').select('hcns_client_id, year, month, headcount, unchanged')
      .in('hcns_client_id', ids).lte('year', year),
    supabase.from('staff').select('id, full_name'),
    supabase.from('clients').select('id, tax_code').in('id', companies.map(c => c.linked_client_id).filter(Boolean)),
  ])
  // Chưa chạy sql/19 -> trả rỗng kèm cờ để trang báo rõ.
  if (e2) return Response.json({ data: [], notInstalled: true })

  const staffName = new Map((staff || []).map(s => [s.id, s.full_name]))
  const taxOf = new Map((linked || []).map(c => [c.id, c.tax_code]))
  const key = (y, m) => y * 12 + m
  const data = companies.map(c => {
    const mine = (rows || []).filter(r => r.hcns_client_id === c.id)
    const values = {}
    for (const m of months) {
      const r = mine.find(x => x.year === year && x.month === m)
      values[m] = r ? r.headcount : null
    }
    const before = mine.filter(r => key(r.year, r.month) < key(year, first))
      .sort((a, b) => key(b.year, b.month) - key(a.year, a.month))[0]
    return {
      id: c.id, name: c.name, clientCode: c.client_code, taxCode: taxOf.get(c.linked_client_id) || '',
      staffName: c.assigned_to ? (staffName.get(c.assigned_to) || '') : 'Chưa phân công',
      hcnsFee: Number(c.hcns_fee) || 0, feePeriod: c.fee_period,
      baseline: before ? before.headcount : null,
      values,
    }
  })
  return Response.json({ data, year, months: months.filter(m => m >= first && m <= last) })
}
