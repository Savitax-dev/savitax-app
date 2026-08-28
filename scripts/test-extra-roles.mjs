// Kiểm luật KIÊM NHIỆM: gộp vai trò/phòng và xét quyền theo HỢP các vai trò.
//
//   node scripts/test-extra-roles.mjs
//
// Kiểm hàm thuần, KHÔNG ghi gì vào database — staff.id có khoá ngoại tới tài khoản đăng nhập nên
// không tạo được nhân viên tạm, và tuyệt đối không gán quyền thử lên nhân viên thật đang làm việc.
import { unionRoles, unionRooms, rolesHavePermission } from '../lib/roleUnion.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + ' — mong ' + w + ', nhận ' + g) }
}

const HIMALAYA = 'room-himalaya', HCNS = 'room-hcns'
// Ca thật: Diệu — nhân viên kế toán phòng Himalaya, kiêm trưởng phòng HCNS.
const dieuExtra = [{ room_id: HCNS, role: 'hcns_leader' }]

console.log('Gộp vai trò và phòng\n')
t('chưa kiêm nhiệm -> chỉ vai trò chính', unionRoles('staff', []), ['staff'])
t('chưa kiêm nhiệm -> chỉ phòng chính', unionRooms(HIMALAYA, []), [HIMALAYA])
t('Diệu -> 2 vai trò', unionRoles('staff', dieuExtra), ['staff', 'hcns_leader'])
t('Diệu -> 2 phòng', unionRooms(HIMALAYA, dieuExtra), [HIMALAYA, HCNS])
t('kiêm nhiệm trùng vai trò chính -> không nhân đôi',
  unionRoles('leader', [{ room_id: HCNS, role: 'leader' }]), ['leader'])
t('chưa có phòng chính -> chỉ phòng kiêm nhiệm', unionRooms(null, dieuExtra), [HCNS])
t('kiêm nhiệm 2 phòng -> 3 vai trò',
  unionRoles('staff', [{ room_id: HCNS, role: 'hcns_leader' }, { room_id: 'r3', role: 'leader' }]),
  ['staff', 'hcns_leader', 'leader'])

console.log('\nXét quyền theo hợp các vai trò')
const RP = [
  { role_id: 'staff', permission_key: 'view_kpi_report' },
  { role_id: 'hcns_leader', permission_key: 'view_hcns' },
  { role_id: 'hcns_leader', permission_key: 'manage_hcns_template' },
  { role_id: 'leader', permission_key: 'manage_staff' },
]
const dieuRoles = unionRoles('staff', dieuExtra)

t('Diệu CÓ quyền HCNS (từ vai trò kiêm nhiệm)', rolesHavePermission(dieuRoles, 'view_hcns', RP), true)
t('Diệu CÓ quyền sửa Checklist HCNS', rolesHavePermission(dieuRoles, 'manage_hcns_template', RP), true)
t('Diệu VẪN giữ quyền của vai trò chính', rolesHavePermission(dieuRoles, 'view_kpi_report', RP), true)
t('Diệu KHÔNG có quyền không ai cấp', rolesHavePermission(dieuRoles, 'manage_database', RP), false)
t('kế toán thường KHÔNG có quyền HCNS', rolesHavePermission(['staff'], 'view_hcns', RP), false)
t('admin luôn đủ quyền', rolesHavePermission(['admin'], 'manage_database', RP), true)
t('vai trò is_system luôn đủ quyền', rolesHavePermission(['sep'], 'manage_database', RP, ['sep']), true)
t('không có vai trò nào -> từ chối', rolesHavePermission([], 'view_hcns', RP), false)

console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi.')
process.exit(fail === 0 ? 0 : 1)
