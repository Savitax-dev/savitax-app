// GET /api/admin/khoi-dong — mọi thứ một trang cần để biết "tôi là ai, được làm gì", gộp trong MỘT yêu cầu
// (23/10/2026, anh báo localhost chậm): trước đây mỗi trang gọi riêng /me + /roles + /role-permissions +
// /luong?viec=quyen — 4 lần kiểm đăng nhập, 12+ lượt khứ hồi tới cơ sở dữ liệu. Trình duyệt nhớ kết quả
// 5 phút trong phiên (lib/khoiDong.js). CHỈ dùng để ẩn / hiện giao diện — mọi API vẫn tự kiểm quyền.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { roomsWithRole } from '@/lib/roleUnion'
import { thongTinToi } from '@/lib/thongTinToi'
import { thangDuocKhai } from '@/lib/luong/ngayCong'
import { QUYEN_LUONG_DAY_DU, quyenTuKhoa } from '@/lib/luong/api'

export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const c = auth.caller
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const [me, rolesRes, rpRes] = await Promise.all([
    thongTinToi(admin, c),
    admin.from('roles').select('*').order('created_at'),
    admin.from('role_permissions').select('role_id, permission_key'),
  ])
  const roles = rolesRes.error ? [] : rolesRes.data || []
  const rolePermissions = rpRes.error ? [] : rpRes.data || []

  // Quyền phân hệ Tiền lương — ĐÚNG luật quyenCua (lib/luong/api.js) nhưng tính từ dữ liệu vừa đọc.
  const cua = c.roles?.length ? c.roles : [c.role].filter(Boolean)
  let ql
  if (cua.includes('admin')) ql = { ...QUYEN_LUONG_DAY_DU, admin: true }
  else if (roles.some(r => cua.includes(r.id) && r.is_system)) ql = { ...QUYEN_LUONG_DAY_DU }
  else ql = quyenTuKhoa(new Set(rolePermissions.filter(x => cua.includes(x.role_id)).map(x => x.permission_key)))
  const quyenLuong = { ...ql, phongTruong: roomsWithRole(c, ['leader']), thangDuocKhai: thangDuocKhai() }

  return Response.json({ me, roles, rolePermissions, quyenLuong })
}
