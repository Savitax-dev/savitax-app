import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { kiemNhanVienTrongPhamVi } from '@/lib/staffScope'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST /api/admin/reset-password — đặt lại mật khẩu cho nhân viên (không cần mật khẩu cũ).
//   Quản trị: mọi tài khoản.
//   Trưởng phòng (anh cho phép 27/10/2026): CHỈ nhân viên phòng mình quản lý — kể cả phòng KIÊM NHIỆM,
//   không phải phòng cũ nơi mình chỉ là nhân viên (lib/staffScope.js); không đụng tài khoản quản trị.
//   Trước đó ai có manage_staff đổi được mật khẩu MỌI phòng ở phía máy chủ, chỉ có giao diện giấu nút.
export async function POST(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { staffId, newPassword } = body
  if (!staffId || !newPassword) return Response.json({ error: 'Thiếu staffId hoặc mật khẩu mới' }, { status: 400 })
  if (newPassword.length < 6) return Response.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 })

  const supabase = getAdmin()
  const pv = await kiemNhanVienTrongPhamVi(supabase, auth.caller, staffId)
  if (!pv.ok) return Response.json({ error: pv.error }, { status: pv.status })
  const { error } = await supabase.auth.admin.updateUserById(staffId, { password: newPassword })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
