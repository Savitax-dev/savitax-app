import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/fee-history?clientId=...
//
// LỊCH SỬ ĐỔI MỨC PHÍ của một công ty — KHÁC hoàn toàn với lịch sử THU TIỀN.
// Chỉ lấy service_fees type='fee_plan' (mỗi dòng = "từ tháng này trở đi phí = X"), tuyệt đối
// không trộn 'ketoan'/'khach'/'no_ton' vào (đó là tiền đã thu, không phải mức phí).
//
// Trả kèm lịch sử phí HCNS (hcns_service_fees type='fee_plan') để một chỗ xem được cả hai.
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })

  const supabase = getAdmin()

  const [{ data: plans }, { data: log }, { data: hcnsRow }] = await Promise.all([
    supabase.from('service_fees')
      .select('id, year, month, amount, note, created_at')
      .eq('client_id', clientId).eq('type', 'fee_plan')
      .order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('client_change_log')
      .select('id, old_value, new_value, changed_at, changed_by')
      .eq('client_id', clientId).eq('entity', 'monthly_fee').eq('action', 'update')
      .order('changed_at', { ascending: false }),
    supabase.from('hcns_clients').select('id').eq('linked_client_id', clientId).maybeSingle(),
  ])

  let hcnsPlans = []
  if (hcnsRow?.id) {
    const { data } = await supabase.from('hcns_service_fees')
      .select('id, year, month, amount, note, created_at')
      .eq('hcns_client_id', hcnsRow.id).eq('type', 'fee_plan')
      .order('year', { ascending: false }).order('month', { ascending: false })
    hcnsPlans = data || []
  }

  // Ai đổi phí — client_change_log ghi người thực hiện, service_fees thì không.
  const staffIds = [...new Set((log || []).map(l => l.changed_by).filter(Boolean))]
  const { data: staff } = staffIds.length
    ? await supabase.from('staff').select('id, full_name').in('id', staffIds)
    : { data: [] }
  const staffById = new Map((staff || []).map(s => [s.id, s]))

  return Response.json({
    ketoan: (plans || []).map(p => ({ ...p, amount: Number(p.amount) || 0 })),
    hcns: hcnsPlans.map(p => ({ ...p, amount: Number(p.amount) || 0 })),
    changeLog: (log || []).map(l => ({
      ...l,
      oldValue: Number(l.old_value) || 0,
      newValue: Number(l.new_value) || 0,
      changedByName: staffById.get(l.changed_by)?.full_name || null,
    })),
  })
}
