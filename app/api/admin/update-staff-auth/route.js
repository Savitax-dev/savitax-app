import { createClient } from '@supabase/supabase-js'
import { toE164VN } from '@/lib/phone'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST /api/admin/update-staff-auth — đổi email/tên/SĐT, đồng bộ cả tài khoản Auth lẫn bảng staff.
// Đổi email trực tiếp ở bảng staff KHÔNG làm thay đổi tài khoản đăng nhập thật,
// nên phải gọi Admin API để cập nhật user trong Supabase Auth.
export async function POST(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { staffId, email, full_name, phone } = body
  if (!staffId) return Response.json({ error: 'Thiếu staffId' }, { status: 400 })

  const supabase = getAdmin()
  if (auth.caller.role !== 'admin') {
    const { data: target } = await supabase.from('staff').select('role').eq('id', staffId).single()
    if (target?.role === 'admin') return Response.json({ error: 'Không đủ quyền sửa tài khoản quản trị' }, { status: 403 })
  }

  const authUpdate = {}
  if (email !== undefined) { authUpdate.email = email; authUpdate.email_confirm = true }
  if (full_name !== undefined || phone !== undefined) {
    authUpdate.user_metadata = { full_name, phone: phone || null }
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await supabase.auth.admin.updateUserById(staffId, authUpdate)
    if (authError) return Response.json({ error: authError.message }, { status: 400 })
  }

  // Set field "phone" thật của Supabase Auth (cột "Phone" trong Users) — tách riêng,
  // best-effort: nếu số trùng tài khoản khác thì báo cảnh báo nhưng không chặn các thay đổi khác.
  let phoneWarning = null
  if (phone !== undefined) {
    const e164 = toE164VN(phone)
    const { error: phoneError } = await supabase.auth.admin.updateUserById(staffId, {
      phone: e164 || '', phone_confirm: !!e164,
    })
    if (phoneError) phoneWarning = 'Không lưu được SĐT vào Auth: ' + phoneError.message
  }

  const staffUpdate = {}
  if (email !== undefined) staffUpdate.email = email
  if (full_name !== undefined) staffUpdate.full_name = full_name
  if (phone !== undefined) staffUpdate.phone = phone

  if (Object.keys(staffUpdate).length > 0) {
    const { error: staffError } = await supabase.from('staff').update(staffUpdate).eq('id', staffId)
    if (staffError) return Response.json({ error: staffError.message }, { status: 400 })
  }

  return Response.json({ ok: true, warning: phoneWarning })
}
