import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { resolveFeeForMonthWithSource } from '@/lib/feeDue'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/debt-history?clientId=<id bảng clients>  (hoặc ?hcnsClientId=<id>)
// Trả lịch sử thu phí HCNS kèm mức phí ĐÚNG của từng kỳ, để giao diện đánh dấu kỳ nào thu thiếu.
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const hcnsClientIdParam = searchParams.get('hcnsClientId')
  if (!clientId && !hcnsClientIdParam) {
    return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
  }

  const supabase = getAdmin()

  let hcnsId = hcnsClientIdParam
  if (!hcnsId) {
    const { data } = await supabase.from('hcns_clients').select('id')
      .eq('linked_client_id', clientId).eq('is_active', true).maybeSingle()
    hcnsId = data?.id || null
  }
  // Công ty chưa bật DV HCNS (hoặc bản clone chưa cài module) — trả rỗng, không phải lỗi.
  if (!hcnsId) return Response.json({ data: [], hcnsClient: null })

  const [{ data: hc }, { data: rows }] = await Promise.all([
    supabase.from('hcns_clients').select('*').eq('id', hcnsId).single(),
    supabase.from('hcns_service_fees')
      .select('year, month, amount, note, created_at, created_by, type')
      .eq('hcns_client_id', hcnsId).order('year', { ascending: false }).order('month', { ascending: false }),
  ])

  const all = rows || []
  const planRows = all.filter(r => r.type === 'fee_plan').map(r => ({ ...r, client_id: hcnsId }))
  const paid = all.filter(r => r.type === 'hcns')

  const data = paid.map(r => {
    const { fee, reliable } = resolveFeeForMonthWithSource(planRows, hcnsId, r.year, r.month, hc?.hcns_fee, [])
    return {
      year: r.year, month: r.month,
      amount: Number(r.amount) || 0,
      note: r.note, created_at: r.created_at, created_by: r.created_by,
      type: 'hcns',
      feeAtThatTime: fee,
      feeReliable: reliable,
    }
  })

  return Response.json({ data, hcnsClient: hc || null })
}
