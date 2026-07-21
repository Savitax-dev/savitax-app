import { createClient } from '@supabase/supabase-js'
import { callerHasPermission, requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/role-permissions — toàn bộ map role_id -> [permission_key]. Chỉ cần đăng nhập
// (không cần manage_roles) vì lib/permissions.js gọi route này cho MỌI user để tự kiểm tra quyền.
export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('role_permissions').select('role_id, permission_key')
  if (error) {
    if (error.message && error.message.includes('role_permissions')) return Response.json({ data: [] })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ data: data || [] })
}

// PUT /api/admin/role-permissions — set toàn bộ quyền cho 1 vai trò (replace)
export async function PUT(request) {
  const auth = await callerHasPermission('manage_roles')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { roleId, permissionKeys } = body
  if (!roleId || !Array.isArray(permissionKeys)) return Response.json({ error: 'Thiếu roleId hoặc permissionKeys' }, { status: 400 })

  const supabase = getAdmin()

  const { data: role } = await supabase.from('roles').select('is_system').eq('id', roleId).single()
  if (role?.is_system) return Response.json({ error: 'Vai trò hệ thống luôn có toàn quyền, không cần gán' }, { status: 400 })

  await supabase.from('role_permissions').delete().eq('role_id', roleId)
  if (permissionKeys.length > 0) {
    const rows = permissionKeys.map(k => ({ role_id: roleId, permission_key: k }))
    const { error } = await supabase.from('role_permissions').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ ok: true })
}
