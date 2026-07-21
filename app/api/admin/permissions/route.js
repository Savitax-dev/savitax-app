import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/permissions — danh mục toàn bộ quyền có trong hệ thống
export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('permissions').select('*').order('group_name').order('key')
  if (error) {
    if (error.message && error.message.includes('permissions')) return Response.json({ data: [] })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ data: data || [] })
}
