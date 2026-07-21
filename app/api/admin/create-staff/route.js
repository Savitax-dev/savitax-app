import { createClient } from '@supabase/supabase-js'
import { toE164VN } from '@/lib/phone'
import { callerHasPermission } from '@/lib/serverAuth'

export async function POST(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { email, password, full_name, room_id, role, phone } = await request.json()

  if (!email || !password || !full_name) {
    return Response.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
  }
  // Chỉ admin mới được tạo tài khoản admin khác — tránh leo thang đặc quyền.
  if (role === 'admin' && auth.caller.role !== 'admin') {
    return Response.json({ error: 'Không đủ quyền tạo tài khoản quản trị' }, { status: 403 })
  }
  // Vai trò Quản trị không thuộc 1 phòng cụ thể nên không bắt buộc chọn phòng
  if (role !== 'admin' && !room_id) {
    return Response.json({ error: 'Vui lòng chọn phòng ban' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone: phone || null },
  })

  if (authError) {
    return Response.json({ error: authError.message }, { status: 400 })
  }

  const { error: staffError } = await supabase
    .from('staff')
    .insert({
      id: authData.user.id,
      email,
      full_name,
      phone: phone || null,
      room_id: room_id || null,
      role: role || 'staff',
    })

  if (staffError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return Response.json({ error: staffError.message }, { status: 400 })
  }

  // Set field "phone" thật của Supabase Auth (riêng, không phải user_metadata) —
  // best-effort: nếu số trùng với tài khoản khác thì bỏ qua, không chặn việc tạo nhân viên.
  let phoneWarning = null
  const e164 = toE164VN(phone)
  if (e164) {
    const { error: phoneError } = await supabase.auth.admin.updateUserById(authData.user.id, {
      phone: e164, phone_confirm: true,
    })
    if (phoneError) phoneWarning = 'Đã tạo nhân viên, nhưng không lưu được SĐT vào Auth: ' + phoneError.message
  }

  return Response.json({ success: true, warning: phoneWarning })
}
