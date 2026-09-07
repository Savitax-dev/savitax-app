// Kiểm quyền GHI CÔNG NỢ có xét vai trò kiêm nhiệm hay không — database giả, không đụng dữ liệu thật.
//
//   node scripts/test-debt-scope-roles.mjs
//
// Ca thật (2026-09-07): chị Diệu là nhân viên kế toán phòng Himalaya (vai trò CHÍNH) kiêm trưởng
// phòng HCNS (vai trò KIÊM NHIỆM). Code cũ chỉ xét staff.role nên quyền của vai trò kiêm nhiệm
// không được tính — Báo cáo phòng HCNS thu hẹp về "chỉ mình tôi", chị không thấy Minh và Tài
// khoản test dù là trưởng phòng.
import { canWriteAccountingDebt } from '../lib/debtScope.js'

let pass = 0, fail = 0
const check = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')) } }

// db giả: chỉ trả về đúng những gì canWriteAccountingDebt hỏi.
function makeDb({ client, secondary = [], systemRoles = [], perms = [] }) {
  const q = (rows) => {
    const o = {
      _r: rows,
      select() { return o },
      eq(c, v) { o._r = o._r.filter(r => r[c] === v); return o },
      in(c, vals) { o._r = o._r.filter(r => vals.includes(r[c])); return o },
      maybeSingle() { return Promise.resolve({ data: o._r[0] || null, error: null }) },
      then(res) { return Promise.resolve({ data: o._r, error: null }).then(res) },
    }
    return o
  }
  return {
    from(t) {
      if (t === 'clients') return q(client ? [{ id: 'c1', ...client }] : [])
      if (t === 'client_secondary_staff') return q(secondary)
      if (t === 'roles') return q(systemRoles.map(id => ({ id, is_system: true })))
      if (t === 'role_permissions') return q(perms)
      throw new Error('bảng lạ: ' + t)
    },
  }
}

const CLIENT = { assigned_to: 'nv-khac', room_id: 'phong-himalaya' }

console.log('\n1. Chị Diệu: vai trò chính "staff", kiêm nhiệm "hcns_leader" có manage_clients')
{
  const db = makeDb({
    client: CLIENT,
    perms: [{ role_id: 'hcns_leader', permission_key: 'manage_clients' }],
  })
  const caller = { staffId: 'dieu', role: 'staff', roomId: 'phong-khac', roles: ['staff', 'hcns_leader'], roomIds: ['phong-khac'] }
  check('ĐƯỢC ghi (quyền đến từ vai trò kiêm nhiệm)', await canWriteAccountingDebt(db, caller, 'c1') === true)
}

console.log('\n2. Cùng người nhưng BỎ vai trò kiêm nhiệm → bị chặn')
{
  const db = makeDb({
    client: CLIENT,
    perms: [{ role_id: 'hcns_leader', permission_key: 'manage_clients' }],
  })
  const caller = { staffId: 'dieu', role: 'staff', roomId: 'phong-khac', roles: ['staff'], roomIds: ['phong-khac'] }
  check('bị chặn', await canWriteAccountingDebt(db, caller, 'c1') === false)
}

console.log('\n3. Phòng KIÊM NHIỆM trùng phòng của công ty → được ghi')
{
  const db = makeDb({ client: CLIENT })
  const caller = { staffId: 'x', role: 'staff', roomId: 'phong-khac', roles: ['staff'], roomIds: ['phong-khac', 'phong-himalaya'] }
  check('được ghi', await canWriteAccountingDebt(db, caller, 'c1') === true)
}

console.log('\n4. Người phụ trách CHÍNH công ty → luôn được ghi')
{
  const db = makeDb({ client: { assigned_to: 'toi', room_id: 'phong-himalaya' } })
  const caller = { staffId: 'toi', role: 'staff', roomId: 'phong-khac', roles: ['staff'], roomIds: ['phong-khac'] }
  check('được ghi', await canWriteAccountingDebt(db, caller, 'c1') === true)
}

console.log('\n5. Nhân viên PHỤ của công ty → được ghi')
{
  const db = makeDb({ client: CLIENT, secondary: [{ client_id: 'c1', staff_id: 'phu' }] })
  const caller = { staffId: 'phu', role: 'staff', roomId: 'phong-khac', roles: ['staff'], roomIds: ['phong-khac'] }
  check('được ghi', await canWriteAccountingDebt(db, caller, 'c1') === true)
}

console.log('\n6. Nhân viên HCNS thuần, không liên quan công ty → bị chặn')
{
  const db = makeDb({ client: CLIENT, perms: [{ role_id: 'hcns', permission_key: 'manage_hcns' }] })
  const caller = { staffId: 'minh', role: 'hcns', roomId: 'phong-hcns', roles: ['hcns'], roomIds: ['phong-hcns'] }
  check('bị chặn (chỉ được thao tác ở mục Dịch vụ HCNS)', await canWriteAccountingDebt(db, caller, 'c1') === false)
}

console.log('\n7. Vai trò hệ thống (is_system) ở vai trò kiêm nhiệm → được ghi')
{
  const db = makeDb({ client: CLIENT, systemRoles: ['sieu_quan_tri'] })
  const caller = { staffId: 'y', role: 'staff', roomId: 'p1', roles: ['staff', 'sieu_quan_tri'], roomIds: ['p1'] }
  check('được ghi', await canWriteAccountingDebt(db, caller, 'c1') === true)
}

console.log('\n8. Code cũ chỉ có caller.role (không có roles[]) vẫn chạy như trước')
{
  const db = makeDb({ client: CLIENT, perms: [{ role_id: 'admin_kh', permission_key: 'manage_clients' }] })
  const caller = { staffId: 'z', role: 'admin_kh', roomId: 'p1' }
  check('được ghi', await canWriteAccountingDebt(db, caller, 'c1') === true)
}

console.log('\n9. Chưa đăng nhập → chặn')
check('chặn', await canWriteAccountingDebt(makeDb({ client: CLIENT }), {}, 'c1') === false)

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + ' đạt, ' + fail + ' hỏng')
process.exitCode = fail === 0 ? 0 : 1
