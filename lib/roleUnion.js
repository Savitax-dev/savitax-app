// Gộp vai trò và phòng của một nhân viên KIÊM NHIỆM.
//
// staff.role / staff.room_id là vai trò và phòng CHÍNH; staff_extra_roles ghi các phòng kiêm
// nhiệm kèm vai trò tương ứng. Quyền hiệu lực = HỢP của tất cả — thuần cộng thêm, không bao giờ
// bớt, nên nhân viên chưa kiêm nhiệm giữ nguyên hành vi cũ.
//
// Tách thành hàm thuần để kiểm được mà không phải ghi dữ liệu vào bảng staff trên production
// (staff.id có khoá ngoại tới tài khoản đăng nhập nên không tạo nhân viên tạm được).

export function unionRoles(primaryRole, extraRows = []) {
  return [...new Set([primaryRole, ...extraRows.map(e => e?.role)].filter(Boolean))]
}

export function unionRooms(primaryRoomId, extraRows = []) {
  return [...new Set([primaryRoomId, ...extraRows.map(e => e?.room_id)].filter(Boolean))]
}

// Có ít nhất một vai trò nắm quyền `permKey` không.
// rolePermRows: các dòng role_permissions dạng [{ role_id, permission_key }].
// systemRoleIds: các vai trò is_system (admin...) — luôn đủ mọi quyền.
export function rolesHavePermission(roles, permKey, rolePermRows = [], systemRoleIds = []) {
  if (!roles?.length) return false
  if (roles.includes('admin')) return true
  if (roles.some(r => systemRoleIds.includes(r))) return true
  return rolePermRows.some(rp => roles.includes(rp.role_id) && rp.permission_key === permKey)
}
