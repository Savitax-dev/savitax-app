import { createClient } from '@supabase/supabase-js'
import { callerHasPermission, requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Chỉ cần đăng nhập (không cần manage_staff) — trang "Thêm công ty" ở Danh sách công ty dùng
// route này cho MỌI nhân viên để chọn "Nhân viên phụ trách", không chỉ admin/leader. Phạm vi trả
// về theo role: admin thấy tất cả, trưởng phòng thấy cả phòng mình, nhân viên thường chỉ thấy
// CHÍNH MÌNH (chỉ tự gán công ty cho bản thân khi thêm mới).
export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  let query = supabase
    .from('staff')
    .select('id, full_name, email, role, room_id, rooms(name)')
    .order('full_name')
  if (auth.caller.role === 'admin') {
    // full list
  } else if (auth.caller.role === 'leader') {
    query = query.eq('room_id', auth.caller.roomId)
  } else {
    query = query.eq('id', auth.caller.staffId)
  }
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
  if (error) {
    // Nhân viên đã có task_records/service_fees/client_change_log... tham chiếu tới —
    // DB chặn xóa cứng để không mất dữ liệu lịch sử (đúng nguyên tắc soft-delete của dự án).
    if (error.code === '23503' || (error.message && error.message.includes('foreign key'))) {
      return Response.json({ error: 'Nhân viên này đã có dữ liệu (công việc/công nợ đã ghi nhận), không thể xóa cứng — dùng "Vô hiệu hóa" thay thế để giữ lại lịch sử.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ success: true })
}

export async function PATCH(request) {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id, full_name, room_id, role, is_active } = await request.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  // Chỉ admin thật mới được đổi vai trò của bất kỳ ai — trưởng phòng chỉ được xem, không được
  // đổi vai trò dù của chính công ty mình (tránh leo thang đặc quyền / đổi nhầm vai trò người khác).
  if (role !== undefined && auth.caller.role !== 'admin') {
    return Response.json({ error: 'Chỉ quản trị viên được đổi vai trò' }, { status: 403 })
  }
  if (auth.caller.role !== 'admin') {
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
