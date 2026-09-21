// Ai được xem thông tin đăng nhập (mật khẩu thuế, hóa đơn, CKS, ngân hàng, BHXH…) của 1 công ty.
//
// Chặt hơn quy tắc công nợ ở lib/debtScope.js: công nợ cho phép cả đồng nghiệp CÙNG PHÒNG ghi
// thay khi người phụ trách nghỉ, còn mật khẩu thì KHÔNG — anh đã chốt "chỉ nhân viên phụ trách
// công ty đó", cốt để chặn xem chéo giữa các nhân viên trong cùng phòng.
//
//   - Quản trị viên            → mọi công ty
//   - Trưởng phòng             → công ty trong phòng mình (gồm cả phòng kiêm nhiệm)
//   - Nhân viên chính / phụ    → đúng công ty mình phụ trách
//   - Còn lại                  → không thấy gì
//
// Trước đây route /api/admin/credentials chỉ yêu cầu đăng nhập: bất kỳ nhân viên nào cũng đọc
// được mật khẩu của MỌI công ty, kể cả công ty phòng khác.
export async function canAccessCredentials(supabase, caller, clientId) {
  if (!caller?.staffId || !clientId) return false

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

  // Trưởng phòng: cả phòng mình, để còn xử lý khi nhân viên nghỉ hoặc nghỉ việc.
  if (roles.includes('leader') && client.room_id && rooms.includes(client.room_id)) return true

  return false
}
