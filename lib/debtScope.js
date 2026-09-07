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

  const { data: roleRows } = await supabase.from('roles').select('is_system').in('id', roles)
  if ((roleRows || []).some(r => r.is_system)) return true

  const { data: rp } = await supabase.from('role_permissions').select('permission_key')
    .in('role_id', roles).in('permission_key', ['manage_clients', 'view_all_rooms'])
  return (rp || []).length > 0
}
