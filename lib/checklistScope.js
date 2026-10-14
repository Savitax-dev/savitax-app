// Ai được BỎ TICK một việc đã hoàn thành, và ai được đóng dấu "TP đã kiểm tra", trong Checklist
// công việc.
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
import { roomsWithRole, rolesFor } from './roleUnion.js'

// Trong các vai trò CÓ HIỆU LỰC ở phòng này, có vai trò nào nắm `permKey` không.
// Vai trò is_system (admin, hoặc vai trò quản trị tự tạo thêm) coi như có đủ mọi quyền.
async function coQuyen(supabase, roles, permKey) {
  if (!roles?.length) return false
  const { data: roleRows } = await supabase.from('roles').select('is_system').in('id', roles)
  if ((roleRows || []).some(r => r.is_system)) return true
  const { data: rp } = await supabase.from('role_permissions').select('permission_key')
    .in('role_id', roles).eq('permission_key', permKey).limit(1)
  return !!rp?.length
}

export async function canUncheckTask(supabase, caller, clientId) {
  if (!caller?.staffId || !clientId) return false

  if (caller.role === 'admin') return true

  const { data: client } = await supabase.from('clients')
    .select('assigned_to, room_id').eq('id', clientId).maybeSingle()
  if (!client) return false
  const phong = await phongCuaMotCongTy(supabase, client)
  // Vai trò có hiệu lực Ở PHÒNG CỦA CÔNG TY NÀY (vai trò chính + kiêm nhiệm đúng phòng đó).
  const roles = rolesFor(caller, phong)

  // 1. Có quyền chưa?
  if (!(await coQuyen(supabase, roles, 'uncheck_task'))) return false

  // 2. Công ty có trong phạm vi không?
  if (client.assigned_to === caller.staffId) return true

  const { data: sec } = await supabase.from('client_secondary_staff')
    .select('staff_id').eq('client_id', clientId).eq('staff_id', caller.staffId).maybeSingle()
  if (sec) return true

  // Trưởng phòng: chỉ ở phòng mình LÀM TRƯỞNG, không phải mọi phòng mình có mặt.
  if (phong && roomsWithRole(caller, ['leader']).includes(phong)) return true

  return false
}

// Ai được đóng (và gỡ) dấu "TP đã kiểm tra" — anh chốt 14/10/2026.
//
// CHẶT HƠN canUncheckTask một bậc, và đó là chủ ý: ở đây KHÔNG có nhánh "công ty mình phụ trách".
// Cả điểm của dấu là có NGƯỜI THỨ HAI nhìn vào checklist; cho nhân viên tự đóng dấu lên công ty
// của chính mình thì dấu chẳng nói lên điều gì, chỉ tốn thêm một cú bấm.
//
// Nên điều kiện là: có quyền `review_checklist` (sql/27) VÀ đang làm TRƯỞNG của đúng phòng chứa
// công ty đó. Quản trị luôn được.
export async function canReviewChecklist(supabase, caller, clientId) {
  if (!caller?.staffId || !clientId) return false

  if (caller.role === 'admin') return true

  const { data: client } = await supabase.from('clients')
    .select('assigned_to, room_id').eq('id', clientId).maybeSingle()
  if (!client) return false
  const phong = await phongCuaMotCongTy(supabase, client)
  if (!phong) return false

  // Phải là trưởng CỦA PHÒNG NÀY. Kiêm Trưởng phòng Danxia thì không đóng dấu cho phòng Grand
  // được, dù có mặt ở cả hai phòng (ca Lương Tấn Đức, xem lib/roleUnion.js).
  if (!roomsWithRole(caller, ['leader']).includes(phong)) return false

  return coQuyen(supabase, rolesFor(caller, phong), 'review_checklist')
}
