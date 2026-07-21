import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET() {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  let query = supabase
    .from('staff')
    .select('id, full_name, email, role, room_id, rooms(name)')
    .order('full_name')
  // Không phải admin (vd trưởng phòng) chỉ xem nhân viên phòng mình, không thấy phòng khác.
  if (auth.caller.role !== 'admin') query = query.eq('room_id', auth.caller.roomId)
  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

export async function DELETE(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  // Chỉ admin mới được xóa tài khoản admin khác — tránh leader xóa tài khoản quản trị.
  const { data: target } = await supabase.from('staff').select('role').eq('id', id).single()
  if (target?.role === 'admin' && auth.caller.role !== 'admin') {
    return Response.json({ error: 'Không đủ quyền xóa tài khoản quản trị' }, { status: 403 })
  }

  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}

export async function PATCH(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id, full_name, room_id, role, is_active } = await request.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  // Chỉ admin mới được gán role 'admin' hoặc sửa tài khoản admin khác — tránh leo thang đặc quyền.
  if (auth.caller.role !== 'admin') {
    if (role === 'admin') return Response.json({ error: 'Không đủ quyền gán quyền quản trị' }, { status: 403 })
    const { data: target } = await supabase.from('staff').select('role').eq('id', id).single()
    if (target?.role === 'admin') return Response.json({ error: 'Không đủ quyền sửa tài khoản quản trị' }, { status: 403 })
  }

  const updateData = {}
  if (full_name  !== undefined) updateData.full_name  = full_name
  if (room_id    !== undefined) updateData.room_id    = room_id
  if (role       !== undefined) updateData.role       = role
  if (is_active  !== undefined) updateData.is_active  = is_active

  const { error } = await supabase
    .from('staff')
    .update(updateData)
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}
