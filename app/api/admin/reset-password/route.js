import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST /api/admin/reset-password — admin/leader đặt lại mật khẩu cho nhân viên (không cần mật khẩu cũ)
export async function POST(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { staffId, newPassword } = body
  if (!staffId || !newPassword) return Response.json({ error: 'Thiếu staffId hoặc mật khẩu mới' }, { status: 400 })
  if (newPassword.length < 6) return Response.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 })

  const supabase = getAdmin()
  // Chỉ admin mới được đổi mật khẩu tài khoản admin khác.
  if (auth.caller.role !== 'admin') {
    const { data: target } = await supabase.from('staff').select('role').eq('id', staffId).single()
    if (target?.role === 'admin') return Response.json({ error: 'Không đủ quyền đổi mật khẩu tài khoản quản trị' }, { status: 403 })
  }
  const { error } = await supabase.auth.admin.updateUserById(staffId, { password: newPassword })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
