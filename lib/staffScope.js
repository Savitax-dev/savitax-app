// Phạm vi trang "Quản lý nhân viên" — ai được xem / sửa / khoá / đặt lại mật khẩu nhân viên PHÒNG NÀO.
//
// Anh chốt 27/10/2026: trưởng phòng quản lý nhân viên phòng mình. Người KIÊM NHIỆM (vd Lương Tấn Đức:
// nhân viên Grand, kiêm trưởng phòng Danxia) dùng MỘT tài khoản quản lý phòng kiêm nhiệm, còn ở phòng
// cũ chỉ là nhân viên nên KHÔNG thấy nhân viên phòng cũ.
//
// Luật: phòng trong phạm vi = phòng mà người đó giữ một vai trò có quyền `manage_staff` (vai trò chính
// ở phòng chính, vai trò kiêm nhiệm ở đúng phòng kiêm nhiệm — lib/roleUnion.js). Không hard-code
// 'leader': quyền gán ở trang Vai trò & phân quyền quyết định.
// Nhân viên "thuộc phòng" theo staff.room_id (phòng chính của nhân viên đó).
import { roomsWithRole } from './roleUnion.js'

// Trả null = toàn quyền (quản trị), hoặc mảng room_id được quản lý (có thể rỗng).
export async function phongQuanLyNhanVien(supabase, caller) {
  if (!caller) return []
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  if (roles.includes('admin')) return null
  const [{ data: sys }, { data: rp }] = await Promise.all([
    supabase.from('roles').select('id').eq('is_system', true),
    supabase.from('role_permissions').select('role_id').eq('permission_key', 'manage_staff'),
  ])
  const coQuyen = [...new Set([...(sys || []), ...(rp || [])].map(r => r.id || r.role_id))]
  if (roles.some(r => (sys || []).some(s => s.id === r))) return null
  return roomsWithRole(caller, coQuyen)
}

// Kiểm một nhân viên có trong phạm vi không. Trả { ok } | { ok:false, status, error }.
// Tài khoản quản trị luôn ngoài phạm vi của người không phải quản trị.
export async function kiemNhanVienTrongPhamVi(supabase, caller, staffId) {
  const phong = await phongQuanLyNhanVien(supabase, caller)
  if (phong === null) return { ok: true, phong }
  const { data: t } = await supabase.from('staff').select('role, room_id').eq('id', staffId).single()
  if (!t) return { ok: false, status: 404, error: 'Không tìm thấy nhân viên' }
  if (t.role === 'admin') return { ok: false, status: 403, error: 'Không đủ quyền với tài khoản quản trị' }
  if (!t.room_id || !phong.includes(t.room_id)) {
    return { ok: false, status: 403, error: 'Chỉ thao tác được với nhân viên phòng mình quản lý' }
  }
  return { ok: true, phong }
}
