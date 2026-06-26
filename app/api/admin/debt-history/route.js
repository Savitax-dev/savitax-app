import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/debt-history?clientId=xxx
// Lịch sử thu công nợ (kế toán/khác/nợ tồn) — đọc qua service role để tránh vướng RLS
// (browser không được đọc nghiệp vụ trực tiếp bằng anon key, xem AGENTS.md).
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('service_fees')
    .select('year, month, amount, note, type, created_at')
    .eq('client_id', clientId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(24)

  if (error) {
    console.error('debt-history error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data: data || [] })
}
