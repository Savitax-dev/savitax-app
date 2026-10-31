// Thông tin phân quyền của chính người đang đăng nhập — dùng chung cho /api/admin/me và
// /api/admin/khoi-dong (gộp me + vai trò + bảng quyền + quyền lương vào MỘT yêu cầu, 23/10/2026).
import { roomsWithRole, rolesFor } from '@/lib/roleUnion'
import { laPhongNgoaiNghiepVu } from './loaiPhong.js'

// caller: kết quả requireLogin(). admin: Supabase service client.
export async function thongTinToi(admin, c) {
  // hcnsOnly = MỌI phòng của người này đều là phòng HCNS.
  // noAccounting = MỌI phòng đều là phòng KHÔNG làm kế toán (HCNS, Kinh doanh) -> ẩn phân khu Kế toán
  // trên menu cho đỡ rối. Người kiêm nhiệm (vừa kế toán vừa HCNS/KD) KHÔNG rơi vào đây.
  let hcnsOnly = false, noAccounting = false
  const roomIds = c.roomIds || [c.roomId].filter(Boolean)
  if (roomIds.length) {
    const { data: rooms } = await admin.from('rooms').select('id, type').in('id', roomIds)
    const list = rooms || []
    hcnsOnly = list.length > 0 && list.every(r => r.type === 'hcns')
    noAccounting = list.length > 0 && list.every(r => laPhongNgoaiNghiepVu(r.type))
  }
  return {
    hcnsOnly,
    noAccounting,
    staffId: c.staffId,
    role: c.role,          // vai trò chính
    roomId: c.roomId,      // phòng chính
    roles: c.roles || [c.role].filter(Boolean),
    roomIds,
    // Quyền THEO PHÒNG: vai trò kiêm nhiệm chỉ có hiệu lực ở đúng phòng kiêm nhiệm.
    leaderRoomIds: roomsWithRole(c, ['leader', 'manager']),
    roomRoles: Object.fromEntries(roomIds.map(id => [id, rolesFor(c, id)])),
  }
}
