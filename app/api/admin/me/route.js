import { requireLogin } from '@/lib/serverAuth'

// GET /api/admin/me — thông tin phân quyền của chính người đang đăng nhập.
//
// Cần vì nhân viên có thể KIÊM NHIỆM nhiều phòng với nhiều vai trò: các trang trước đây tự query
// `staff.role` nên chỉ thấy vai trò CHÍNH, không thấy vai trò kiêm nhiệm. Trang nào cần quyền
// đầy đủ thì gọi route này thay vì query thẳng bảng staff.
export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const c = auth.caller
  return Response.json({
    staffId: c.staffId,
    role: c.role,          // vai trò chính
    roomId: c.roomId,      // phòng chính
    roles: c.roles || [c.role].filter(Boolean),
    roomIds: c.roomIds || [c.roomId].filter(Boolean),
  })
}
