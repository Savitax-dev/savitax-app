// Ai được BỎ TICK một việc đã hoàn thành trong Checklist công việc.
//
// Bỏ tick xoá mất dấu "hoàn thành đúng hạn" gốc — mà KPI chấm theo đúng dấu đó. Nên cần HAI điều
// cùng lúc, thiếu một là không được:
//
//   1. Có quyền `uncheck_task` (bật/tắt ở trang Vai trò & phân quyền, xem sql/23).
//   2. Công ty nằm trong PHẠM VI của người đó.
//
// Phạm vi — anh chốt 01/10/2026: "cty của nhân viên nào là nv đó, tp nào quản lý phòng đó, không
// đụng lẫn nhau":
//   - Quản trị viên           → mọi công ty, không cần quyền (vai trò is_system)
//   - Trưởng phòng            → công ty trong phòng mình (gồm phòng kiêm nhiệm)
//   - Nhân viên chính / phụ   → đúng công ty mình phụ trách
//   - Còn lại                 → không
//
// Phòng của công ty suy từ NHÂN VIÊN PHỤ TRÁCH chứ không đọc `clients.room_id` — cột đó gần như
// luôn trống, tin vào nó là trưởng phòng mất quyền trên chính công ty phòng mình (xem
// lib/clientRoom.js).
import { phongCuaMotCongTy } from './clientRoom.js'

export async function canUncheckTask(supabase, caller, clientId) {
  if (!caller?.staffId || !clientId) return false

  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  if (roles.includes('admin')) return true

  // 1. Có quyền chưa? Vai trò is_system (admin tự tạo thêm) coi như có đủ mọi quyền.
  const { data: roleRows } = await supabase.from('roles').select('is_system').in('id', roles)
  const laHeThong = (roleRows || []).some(r => r.is_system)
  if (!laHeThong) {
    const { data: rp } = await supabase.from('role_permissions').select('permission_key')
      .in('role_id', roles).eq('permission_key', 'uncheck_task').limit(1)
    if (!rp?.length) return false
  }

  // 2. Công ty có trong phạm vi không?
  const { data: client } = await supabase.from('clients')
    .select('assigned_to, room_id').eq('id', clientId).maybeSingle()
  if (!client) return false

  if (client.assigned_to === caller.staffId) return true

  const { data: sec } = await supabase.from('client_secondary_staff')
    .select('staff_id').eq('client_id', clientId).eq('staff_id', caller.staffId).maybeSingle()
  if (sec) return true

  if (roles.includes('leader')) {
    const phong = await phongCuaMotCongTy(supabase, client)
    if (phong && rooms.includes(phong)) return true
  }

  return false
}
