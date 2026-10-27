import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { roomsWithRole } from '@/lib/roleUnion'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Vai trò "trưởng phòng" được đặt lại mật khẩu cho nhân viên phòng mình.
const VAI_TRO_TRUONG_PHONG = ['leader', 'hcns_leader', 'sales_leader']

// POST /api/admin/reset-password — đặt lại mật khẩu cho nhân viên (không cần mật khẩu cũ).
//   Quản trị: mọi tài khoản.
//   Trưởng phòng (anh cho phép 27/10/2026): CHỈ nhân viên thuộc phòng mình làm trưởng (phòng chính của
//   nhân viên đó), không đụng tài khoản quản trị. Trước đó ai có manage_staff đổi được mật khẩu MỌI phòng
//   ở phía máy chủ, chỉ có giao diện giấu nút — nay máy chủ tự chặn.
export async function POST(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { staffId, newPassword } = body
  if (!staffId || !newPassword) return Response.json({ error: 'Thiếu staffId hoặc mật khẩu mới' }, { status: 400 })
  if (newPassword.length < 6) return Response.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 })

  const supabase = getAdmin()
  const caller = auth.caller
  const laAdmin = caller.role === 'admin' || (caller.roles || []).includes('admin')
  if (!laAdmin) {
    const { data: target } = await supabase.from('staff').select('role, room_id').eq('id', staffId).single()
    if (!target) return Response.json({ error: 'Không tìm thấy nhân viên' }, { status: 404 })
    if (target.role === 'admin') return Response.json({ error: 'Không đủ quyền đổi mật khẩu tài khoản quản trị' }, { status: 403 })
    const phongMinh = roomsWithRole(caller, VAI_TRO_TRUONG_PHONG)
    if (!target.room_id || !phongMinh.includes(target.room_id)) {
      return Response.json({ error: 'Chỉ đặt lại được mật khẩu cho nhân viên phòng mình' }, { status: 403 })
    }
  }
  const { error } = await supabase.auth.admin.updateUserById(staffId, { password: newPassword })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
