// Xác định "ai là người của phòng HCNS".
//
// VẤN ĐỀ: `staff.role` là MỘT cột text và `staff.room_id` là MỘT khoá ngoại — một nhân viên chỉ
// giữ được một vai trò và thuộc một phòng. Thực tế có người vừa là nhân viên kế toán của phòng
// nghiệp vụ, vừa là trưởng phòng HCNS. Nếu lấy thành viên HCNS theo `room_id` thì người đó buộc
// phải rời phòng kế toán mới vào được HCNS — mất phạm vi bên kế toán.
//
// CÁCH GIẢI: thành viên phòng HCNS = ai có QUYỀN HCNS, không phải ai ngồi ở phòng HCNS.
//   - vai trò được gán rõ quyền `view_hcns` trong role_permissions  (hcns, hcns_leader, hoặc
//     vai trò ghép do quản trị tự tạo và tích thêm quyền HCNS), HOẶC
//   - nhân viên đang có `room_id` = phòng HCNS (cách cũ, vẫn giữ để không phải gán lại từ đầu)
//
// Nhờ vậy quản trị chỉ cần vào /admin/roles tạo một vai trò ghép (VD "Kế toán + TP HCNS") tích
// đủ quyền hai bên, gán cho người đó — không cần đổi `room_id`, không cần sửa code.
//
// Vai trò is_system (admin) KHÔNG tự động thành thành viên HCNS: họ có toàn quyền xem/sửa nhưng
// không nên xuất hiện trong bảng KPI phòng như một nhân viên phụ trách.
export async function getHcnsTeam(supabase) {
  const { data: room } = await supabase.from('rooms').select('id, name').eq('type', 'hcns').maybeSingle()

  const { data: rolesWithPerm } = await supabase.from('role_permissions')
    .select('role_id').eq('permission_key', 'view_hcns')
  const roleIds = [...new Set((rolesWithPerm || []).map(r => r.role_id))]

  const byRole = roleIds.length
    ? (await supabase.from('staff').select('id, full_name, role, room_id')
        .in('role', roleIds).eq('is_active', true)).data || []
    : []

  const byRoom = room
    ? (await supabase.from('staff').select('id, full_name, role, room_id')
        .eq('room_id', room.id).eq('is_active', true)).data || []
    : []

  const map = new Map()
  for (const s of [...byRole, ...byRoom]) map.set(s.id, s)
  const staff = [...map.values()].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'))

  return { room: room || null, staff }
}
