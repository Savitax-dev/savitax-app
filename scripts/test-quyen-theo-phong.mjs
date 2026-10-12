// QUYỀN THEO PHÒNG (anh chốt 12/10/2026): nhân viên phòng nào thì quyền nhân viên phòng đó; kiêm nhiệm
// thì quyền của phòng kiêm nhiệm — vai trò kiêm nhiệm KHÔNG lan sang phòng khác. Chỉ đọc, dữ liệu thật.
//   node --env-file=.env.local scripts/test-quyen-theo-phong.mjs
import { createClient } from '@supabase/supabase-js'
import { unionRoles, unionRooms, roomsWithRole, rolesFor } from '../lib/roleUnion.js'
import { canUncheckTask } from '../lib/checklistScope.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let loi = 0
const so = (ten, thuc, mong) => { if (thuc === mong) console.log('   OK  ' + ten + ' -> ' + thuc); else { loi++; console.log('   SAI ' + ten + ' -> ' + thuc + ' (mong ' + mong + ')') } }

const { data: rooms } = await sb.from('rooms').select('id, name')
const idPhong = (ten) => rooms.find(r => r.name === ten)?.id
const tenPhong = (id) => rooms.find(r => r.id === id)?.name

// Dựng `caller` đúng như getCallerRole (lib/serverAuth.js) dựng.
async function caller(hoTen) {
  const { data: s } = await sb.from('staff').select('id, full_name, role, room_id').eq('full_name', hoTen).single()
  const { data: extra } = await sb.from('staff_extra_roles').select('room_id, role').eq('staff_id', s.id)
  return { staffId: s.id, role: s.role, roomId: s.room_id, roles: unionRoles(s.role, extra || []), roomIds: unionRooms(s.room_id, extra || []), extraRoles: extra || [], ten: s.full_name }
}
// Một công ty của phòng `tenP` mà người `tru` KHÔNG phụ trách chính lẫn phụ.
async function ctyCuaPhong(tenP, tru) {
  const { data: st } = await sb.from('staff').select('id').eq('room_id', idPhong(tenP))
  const { data: cl } = await sb.from('clients').select('id, name, assigned_to').in('assigned_to', st.map(x => x.id).filter(x => x !== tru)).eq('status', 'active').limit(20)
  const { data: sec } = await sb.from('client_secondary_staff').select('client_id').eq('staff_id', tru)
  const phu = new Set((sec || []).map(x => x.client_id))
  return cl.find(c => !phu.has(c.id))
}

console.log('1) Người KIÊM NHIỆM — Lương Tấn Đức (nhân viên Grand, kiêm Trưởng phòng Danxia)')
const duc = await caller('Lương Tấn Đức')
so('phòng làm trưởng', roomsWithRole(duc, ['leader']).map(tenPhong).join(','), 'Danxia')
so('vai trò tại Grand', rolesFor(duc, idPhong('Grand')).join(','), 'staff')
so('vai trò tại Danxia', rolesFor(duc, idPhong('Danxia')).sort().join(','), 'leader,staff')
so('vai trò tại Aoraki (không thuộc)', rolesFor(duc, idPhong('Aoraki')).join(','), 'staff')
const cGrand = await ctyCuaPhong('Grand', duc.staffId), cDanxia = await ctyCuaPhong('Danxia', duc.staffId), cAoraki = await ctyCuaPhong('Aoraki', duc.staffId)
so('bỏ tick công ty Danxia của người khác (là trưởng phòng)', await canUncheckTask(sb, duc, cDanxia.id), true)
so('bỏ tick công ty Grand của người khác (chỉ là nhân viên)', await canUncheckTask(sb, duc, cGrand.id), false)
so('bỏ tick công ty Aoraki (không thuộc phòng)', await canUncheckTask(sb, duc, cAoraki.id), false)
const { data: cuaDuc } = await sb.from('clients').select('id').eq('assigned_to', duc.staffId).eq('status', 'active').limit(1)
if (cuaDuc?.[0]) so('bỏ tick công ty CHÍNH MÌNH phụ trách', await canUncheckTask(sb, duc, cuaDuc[0].id), true)

console.log('2) Trưởng phòng THƯỜNG không kiêm nhiệm — hành vi phải y như trước')
const { data: ex } = await sb.from('staff_extra_roles').select('staff_id')
const coKiem = new Set((ex || []).map(e => e.staff_id))
const { data: ld } = await sb.from('staff').select('full_name, room_id').eq('role', 'leader').not('room_id', 'is', null)
const tp = ld.find(l => !coKiem.has(l.id) && tenPhong(l.room_id) && !['HCNS'].includes(tenPhong(l.room_id)))
if (tp) {
  const c = await caller(tp.full_name)
  const pMinh = tenPhong(c.roomId), pKhac = pMinh === 'Grand' ? 'Aoraki' : 'Grand'
  console.log('   (' + c.ten + ' — Trưởng phòng ' + pMinh + ')')
  so('phòng làm trưởng', roomsWithRole(c, ['leader']).map(tenPhong).join(','), pMinh)
  so('bỏ tick công ty phòng mình', await canUncheckTask(sb, c, (await ctyCuaPhong(pMinh, c.staffId)).id), true)
  so('bỏ tick công ty phòng ' + pKhac, await canUncheckTask(sb, c, (await ctyCuaPhong(pKhac, c.staffId)).id), false)
}

console.log('3) Nhân viên THƯỜNG — không có quyền trưởng phòng ở đâu cả')
const { data: nvs } = await sb.from('staff').select('id, full_name, room_id').eq('role', 'staff').eq('room_id', idPhong('Aoraki')).limit(5)
const nv = nvs.find(n => !coKiem.has(n.id))
if (nv) {
  const c = await caller(nv.full_name)
  so(c.ten + ': phòng làm trưởng', roomsWithRole(c, ['leader', 'manager']).length, 0)
  so('bỏ tick công ty của đồng nghiệp cùng phòng', await canUncheckTask(sb, c, (await ctyCuaPhong('Aoraki', c.staffId)).id), false)
}
console.log(loi === 0 ? '\nTẤT CẢ ĐẠT' : '\n' + loi + ' lỗi')
process.exit(loi === 0 ? 0 : 1)
