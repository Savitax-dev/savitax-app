import { createClient } from '@supabase/supabase-js'
import { callerHasPermission, requireLogin } from '@/lib/serverAuth'
import { SHARED_ROOM_IDS } from '@/lib/specialRooms'
import { phongQuanLyNhanVien, kiemNhanVienTrongPhamVi } from '@/lib/staffScope'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Chỉ cần đăng nhập (không cần manage_staff) — trang "Thêm công ty" ở Danh sách công ty dùng
// route này cho MỌI nhân viên để chọn "Nhân viên phụ trách", không chỉ admin/leader. Phạm vi trả
// về theo role: admin thấy tất cả, trưởng phòng thấy cả phòng mình + phòng "đặc thù" (mọi trưởng
// phòng đều làm việc chung, xem lib/specialRooms.js), nhân viên thường chỉ thấy CHÍNH MÌNH (chỉ
// tự gán công ty cho bản thân khi thêm mới).
export async function GET(request) {
  // ?quanLy=1 — danh sách cho trang "Quản lý nhân viên": cần manage_staff, phạm vi theo lib/staffScope.js
  // (quản trị: tất cả; trưởng phòng / kiêm nhiệm trưởng phòng: ĐÚNG các phòng mình quản lý).
  if (new URL(request.url).searchParams.get('quanLy')) {
    const a = await callerHasPermission('manage_staff')
    if (!a.ok) return Response.json({ error: a.error }, { status: a.status })
    const sb = getAdmin()
    const phong = await phongQuanLyNhanVien(sb, a.caller)
    if (phong !== null && !phong.length) return Response.json({ data: [], phamVi: { tatCa: false, phong: [] } })
    let q = sb.from('staff').select('*, rooms(name)').order('full_name')
    if (phong !== null) q = q.in('room_id', phong)
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data, phamVi: { tatCa: phong === null, phong: phong || [] } })
  }

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
    query = query.in('room_id', [auth.caller.roomId, ...SHARED_ROOM_IDS].filter(Boolean))
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
  // Không phải quản trị: chỉ nhân viên phòng mình quản lý, không đụng tài khoản quản trị.
  const pv = await kiemNhanVienTrongPhamVi(supabase, auth.caller, id)
  if (!pv.ok) return Response.json({ error: pv.error }, { status: pv.status })

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
  // Không phải quản trị: chỉ sửa / khoá nhân viên phòng mình quản lý, và chỉ chuyển sang phòng cũng
  // trong phạm vi (kiêm nhiệm trưởng phòng Danxia không kéo được người Grand về, cũng không đẩy người đi).
  const pv = await kiemNhanVienTrongPhamVi(supabase, auth.caller, id)
  if (!pv.ok) return Response.json({ error: pv.error }, { status: pv.status })
  if (pv.phong !== null && room_id !== undefined && !pv.phong.includes(room_id)) {
    return Response.json({ error: 'Chỉ chuyển được sang phòng mình quản lý' }, { status: 403 })
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
