import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// KIÊM NHIỆM — nhân viên thuộc thêm phòng khác với vai trò khác.
// staff.role / staff.room_id vẫn là phòng và vai trò CHÍNH; bảng này chỉ CỘNG THÊM quyền.

// GET — toàn bộ danh sách kiêm nhiệm (trang Quản lý nhân viên nạp một lần rồi gom theo nhân viên).
export async function GET() {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('staff_extra_roles')
    .select('id, staff_id, room_id, role')
  // Chưa chạy sql/08_staff_extra_roles.sql — trả rỗng, trang vẫn chạy bình thường.
  if (error) return Response.json({ data: [], notInstalled: true })
  return Response.json({ data: data || [] })
}

export async function POST(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { staffId, roomId, role } = await request.json()
  if (!staffId || !roomId || !role) {
    return Response.json({ error: 'Thiếu nhân viên, phòng hoặc vai trò' }, { status: 400 })
  }

  const supabase = getAdmin()

  // Không cho kiêm nhiệm trùng đúng phòng CHÍNH — sẽ thành hai vai trò trong cùng một phòng,
  // gây khó hiểu khi đọc bảng phân công.
  const { data: staffRow } = await supabase.from('staff').select('room_id').eq('id', staffId).maybeSingle()
  if (staffRow?.room_id && staffRow.room_id === roomId) {
    return Response.json({ error: 'Đây đã là phòng chính của nhân viên — chọn phòng khác' }, { status: 400 })
  }

  const { data, error } = await supabase.from('staff_extra_roles')
    .insert({ staff_id: staffId, room_id: roomId, role }).select().single()
  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'Nhân viên đã kiêm nhiệm phòng này rồi' }, { status: 400 })
    }
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ data })
}

export async function DELETE(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('staff_extra_roles').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
