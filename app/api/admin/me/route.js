import { createClient } from '@supabase/supabase-js'
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

  // hcnsOnly = MỌI phòng của người này đều là phòng HCNS.
  // noAccounting = MỌI phòng đều là phòng KHÔNG làm kế toán (HCNS, Kinh doanh) -> ẩn phân khu Kế toán
  // trên menu cho đỡ rối. Người kiêm nhiệm (vừa kế toán vừa HCNS/KD) KHÔNG rơi vào đây.
  let hcnsOnly = false, noAccounting = false
  const roomIds = c.roomIds || [c.roomId].filter(Boolean)
  if (roomIds.length) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: rooms } = await admin.from('rooms').select('id, type').in('id', roomIds)
    const list = rooms || []
    hcnsOnly = list.length > 0 && list.every(r => r.type === 'hcns')
    noAccounting = list.length > 0 && list.every(r => r.type === 'hcns' || r.type === 'kinhdoanh')
  }

  return Response.json({
    hcnsOnly,
    noAccounting,
    staffId: c.staffId,
    role: c.role,          // vai trò chính
    roomId: c.roomId,      // phòng chính
    roles: c.roles || [c.role].filter(Boolean),
    roomIds: c.roomIds || [c.roomId].filter(Boolean),
  })
}
