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
  const [{ data, error }, { data: client }, { data: feePlanRows }, { data: changeLogRows }, { data: rolloverRows }] = await Promise.all([
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
    // Các kỳ ĐÃ chuyển thành "nợ tồn": phần chưa thu của kỳ đó không còn nằm ở kỳ gốc nữa, thu
    // tiếp phải thu ở tab "Nợ tồn cũ". Thiếu dữ liệu này, thẻ công ty lấy "phí trừ đã thu" nên
    // báo nợ oan đúng khoản khách đã trả qua nợ tồn — AGENTS.md ghi rõ đã từng gây ghi thu TRÙNG
    // thật (ca 23/09/2026: ĐẠI QUANG T8/2026 hiện "còn phải thu 2.160.000đ" dù nợ tồn đã về 0).
    supabase.from('debt_rollovers').select('year, month, source, rolled_amount, remaining_amount').eq('client_id', clientId),
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

  // Phí ĐÚNG của từng tháng trong 24 tháng gần nhất, để giao diện hiện đúng "phí tháng X" khi
  // nhân viên đổi tháng trên thẻ công ty — trước đây panel công nợ luôn dùng monthly_fee SỐNG nên
  // xem lại tháng cũ của công ty đã đổi phí sẽ ra số sai.
  const feeByPeriod = {}
  const now = new Date()
  let fy = now.getFullYear(), fm = now.getMonth() + 1
  for (let i = 0; i < 24; i++) {
    feeByPeriod[fy + '-' + fm] = resolveFeeForMonth(feePlanForClient, clientId, fy, fm, fallbackFee, changeLogForClient)
    fm--; if (fm === 0) { fm = 12; fy-- }
  }

  // { 'ketoan:2026-8': { rolled, remaining } } — tra nhanh theo tab + tháng đang xem.
  const rolloverByPeriod = {}
  for (const r of rolloverRows || []) {
    rolloverByPeriod[(r.source || 'ketoan') + ':' + r.year + '-' + r.month] = {
      rolled: Number(r.rolled_amount) || 0,
      remaining: Number(r.remaining_amount) || 0,
    }
  }

  return Response.json({ data: enriched, feeByPeriod, rolloverByPeriod })
}
