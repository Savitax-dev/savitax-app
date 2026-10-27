import { phongCuaMotCongTy } from './clientRoom.js'
import { rolesFor } from './roleUnion.js'
import { vaiTroCoQuyen } from './quyenCache.js'
// Ai được ghi công nợ DỊCH VỤ KẾ TOÁN của 1 công ty (áp cho cả save-debt lẫn save-old-debt).
//
//   - quản trị viên
//   - nhân viên chính đang phụ trách công ty đó
//   - nhân viên phụ (client_secondary_staff) — vẫn theo dõi công ty đó hàng ngày
//   - người cùng phòng với công ty (trưởng phòng / đồng nghiệp làm thay khi nghỉ)
//   - ai có quyền quản lý khách hàng hoặc xem tất cả phòng nghiệp vụ
//
// Nhân viên phòng HCNS KHÔNG rơi vào nhóm nào ở trên nên bị chặn — đúng ý đồ: họ chỉ được thao
// tác ở mục "Dịch vụ HCNS" (route riêng app/api/admin/hcns/save-debt). Trước đây 2 route này chỉ
// yêu cầu đăng nhập nên bất kỳ nhân viên nào cũng ghi được công nợ của mọi công ty.
export async function canWriteAccountingDebt(supabase, caller, clientId) {
  if (!caller?.staffId) return false
  // Xét TẤT CẢ vai trò và phòng (chính + kiêm nhiệm): người kiêm nhiệm ở phòng khác vẫn phải ghi
  // được công nợ của phòng đó.
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  if (roles.includes('admin')) return true

  const { data: client } = await supabase.from('clients')
    .select('assigned_to, room_id').eq('id', clientId).maybeSingle()
  if (!client) return false
  if (client.assigned_to === caller.staffId) return true

  const { data: sec } = await supabase.from('client_secondary_staff')
    .select('staff_id').eq('client_id', clientId).eq('staff_id', caller.staffId).maybeSingle()
  if (sec) return true

  if (client.room_id && rooms.includes(client.room_id)) return true

  // Quyền theo vai trò: vai trò CHÍNH như trước giờ + vai trò kiêm nhiệm CHỈ khi công ty thuộc đúng
  // phòng kiêm nhiệm (lib/roleUnion.js). Trước đây gộp phẳng nên kiêm Trưởng phòng ở một phòng là
  // ghi được công nợ của mọi công ty.
  const phong = await phongCuaMotCongTy(supabase, client)
  const rolesHere = rolesFor(caller, phong)
  // Vai trò hệ thống đủ mọi quyền — vaiTroCoQuyen đã xét. Bảng quyền nhớ tạm 5 phút (lib/quyenCache.js).
  return vaiTroCoQuyen(supabase, rolesHere, ['manage_clients', 'view_all_rooms'])
}
