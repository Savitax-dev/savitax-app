import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// CRUD phòng ban ("Quản lý phòng ban") — trước đây app/admin/rooms/page.js ghi TRỰC TIẾP vào
// bảng `rooms` bằng anon key phía trình duyệt, dính lỗi "new row violates row-level security
// policy" vì RLS của bảng `rooms` không cho anon-key insert. Chuyển qua route dùng service role
// key + kiểm tra quyền `manage_rooms` (đúng permission key trang đã dùng để gate hiển thị).
export async function GET() {
  const auth = await callerHasPermission('manage_rooms')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('rooms').select('*').order('type').order('name')
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

export async function POST(request) {
  const auth = await callerHasPermission('manage_rooms')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { name, type } = await request.json()
  if (!name || !name.trim()) return Response.json({ error: 'Vui lòng nhập tên phòng' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('rooms').insert({ name: name.trim(), type: type || 'main' })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}

export async function PATCH(request) {
  const auth = await callerHasPermission('manage_rooms')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id, name } = await request.json()
  if (!id || !name || !name.trim()) return Response.json({ error: 'Thiếu id hoặc tên phòng' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('rooms').update({ name: name.trim() }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}

export async function DELETE(request) {
  const auth = await callerHasPermission('manage_rooms')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  // Chặn xóa nếu còn nhân viên trong phòng — kiểm tra lại ở server (phòng UI bị bỏ qua/gọi thẳng
  // API), không chỉ dựa vào check phía client.
  const { count } = await supabase.from('staff').select('id', { count: 'exact', head: true }).eq('room_id', id)
  if (count > 0) return Response.json({ error: 'Không thể xóa phòng vì đang có nhân viên' }, { status: 409 })

  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}
