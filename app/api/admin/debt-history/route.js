import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { resolveFeeForMonth } from '@/lib/feeDue'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/debt-history?clientId=xxx
// Lịch sử thu công nợ (kế toán/khác/nợ tồn) — đọc qua service role để tránh vướng RLS
// (browser không được đọc nghiệp vụ trực tiếp bằng anon key, xem AGENTS.md).
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()
  const [{ data, error }, { data: client }, { data: feePlanRows }, { data: changeLogRows }] = await Promise.all([
    supabase.from('service_fees')
      .select('year, month, amount, note, type, created_at')
      .eq('client_id', clientId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(24),
    supabase.from('clients').select('monthly_fee').eq('id', clientId).single(),
    // Lịch sử đổi phí — tra đúng phí của TỪNG dòng lịch sử theo đúng tháng của nó, không phải
    // monthly_fee sống (tránh đổi phí hôm nay làm sai lại "thiếu/đủ" của các tháng cũ đã thu).
    supabase.from('service_fees').select('year, month, amount').eq('client_id', clientId).eq('type', 'fee_plan'),
    supabase.from('client_change_log').select('old_value, changed_at').eq('client_id', clientId).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])

  if (error) {
    console.error('debt-history error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const fallbackFee = client ? Number(client.monthly_fee) || 0 : 0
  const feePlanForClient = (feePlanRows || []).map(p => ({ ...p, client_id: clientId }))
  const changeLogForClient = (changeLogRows || []).map(p => ({ ...p, client_id: clientId }))
  const enriched = (data || []).map(r => ({
    ...r,
    feeAtThatTime: resolveFeeForMonth(feePlanForClient, clientId, r.year, r.month, fallbackFee, changeLogForClient),
  }))

  return Response.json({ data: enriched })
}
