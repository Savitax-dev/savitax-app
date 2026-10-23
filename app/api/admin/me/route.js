import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { thongTinToi } from '@/lib/thongTinToi'

// GET /api/admin/me — thông tin phân quyền của chính người đang đăng nhập.
//
// Cần vì nhân viên có thể KIÊM NHIỆM nhiều phòng với nhiều vai trò: các trang trước đây tự query
// `staff.role` nên chỉ thấy vai trò CHÍNH, không thấy vai trò kiêm nhiệm. Trang nào cần quyền
// đầy đủ thì dùng lib/khoiDong.js (layMe) — gộp cùng vai trò + bảng quyền trong /api/admin/khoi-dong.
// Route này giữ lại cho nơi gọi cũ; nội dung dựng ở lib/thongTinToi.js để hai nơi luôn giống nhau.
export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  return Response.json(await thongTinToi(admin, auth.caller))
}
