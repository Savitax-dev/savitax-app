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
  if (caller.role === 'admin') return true

  const { data: client } = await supabase.from('clients')
    .select('assigned_to, room_id').eq('id', clientId).maybeSingle()
  if (!client) return false
  if (client.assigned_to === caller.staffId) return true

  const { data: sec } = await supabase.from('client_secondary_staff')
    .select('staff_id').eq('client_id', clientId).eq('staff_id', caller.staffId).maybeSingle()
  if (sec) return true

  if (client.room_id && caller.roomId && client.room_id === caller.roomId) return true

  const { data: roleRow } = await supabase.from('roles').select('is_system').eq('id', caller.role).maybeSingle()
  if (roleRow?.is_system) return true

  const { data: rp } = await supabase.from('role_permissions').select('permission_key')
    .eq('role_id', caller.role).in('permission_key', ['manage_clients', 'view_all_rooms'])
  return (rp || []).length > 0
}
