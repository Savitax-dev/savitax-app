import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/client-history?clientId=xxx — lịch sử thay đổi thông tin + phí dịch vụ
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('client_change_log')
    .select('*, staff:changed_by(full_name)')
    .eq('client_id', clientId)
    .order('changed_at', { ascending: false })
    .limit(100)

  // Bảng chưa được tạo (chưa chạy migration) — trả về rỗng thay vì lỗi
  if (error) {
    if (error.message && error.message.includes('client_change_log')) return Response.json({ log: [] })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ log: data || [] })
}
