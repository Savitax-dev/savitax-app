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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// QUYỀN THEO PHÒNG (anh chốt 12/10/2026): "nhân viên phòng nào thì quyền nhân viên phòng đó, kiêm
// nhiệm thì quyền của phòng kiêm nhiệm". Vai trò kiêm nhiệm CHỈ có hiệu lực ở đúng phòng kiêm nhiệm.
//
// Trước đó vai trò được gộp phẳng (`roles` + `roomIds`), nên ai kiêm Trưởng phòng ở phòng B thì thành
// trưởng phòng ở MỌI phòng mình thuộc về, kể cả phòng A nơi mình chỉ là nhân viên (ca Lương Tấn Đức:
// nhân viên Grand, kiêm Trưởng phòng Danxia). Hai hàm dưới thay cho kiểu
// `roles.includes('leader') && rooms.includes(phong)`.
//
// `caller` là object của getCallerRole (lib/serverAuth.js): role / roomId = vai trò và phòng CHÍNH,
// extraRoles = [{ room_id, role }] các dòng kiêm nhiệm.

// Các phòng mà người này giữ một trong các vai trò `wanted`.
export function roomsWithRole(caller, wanted = ['leader']) {
  if (!caller) return []
  const out = []
  if (wanted.includes(caller.role) && caller.roomId) out.push(caller.roomId)
  // Dạng cũ chưa có extraRoles (không nên xảy ra) -> giữ hành vi gộp phẳng trước đây, không hạ quyền.
  if (!Array.isArray(caller.extraRoles)) {
    const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
    return roles.some(r => wanted.includes(r)) ? (caller.roomIds?.length ? caller.roomIds : out) : []
  }
  for (const e of caller.extraRoles) if (e?.room_id && wanted.includes(e.role)) out.push(e.room_id)
  return [...new Set(out)]
}

// Vai trò có hiệu lực khi người này thao tác trên một công ty / nhân viên thuộc phòng `roomId`:
// vai trò CHÍNH (giữ nguyên phạm vi như trước giờ) + các vai trò kiêm nhiệm ở ĐÚNG phòng đó.
export function rolesFor(caller, roomId) {
  if (!caller) return []
  const out = [caller.role]
  if (Array.isArray(caller.extraRoles)) {
    for (const e of caller.extraRoles) if (roomId && e?.room_id === roomId) out.push(e.role)
  } else if (caller.roles?.length) out.push(...caller.roles)
  return [...new Set(out.filter(Boolean))]
}
