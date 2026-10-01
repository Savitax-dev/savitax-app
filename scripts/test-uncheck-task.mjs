// Kiểm quyền BỎ TICK việc đã hoàn thành — database giả, không đụng dữ liệu thật.
//
//   node scripts/test-uncheck-task.mjs
//
// Vì sao phải có bộ kiểm riêng: bỏ tick xoá mất dấu "hoàn thành đúng hạn" gốc mà KPI chấm theo.
// Hỏng ở đây không ai thấy ngay — chỉ tới kỳ chấm KPI mới lòi ra, và lúc đó không truy lại được
// ai bỏ tick việc nào. Hai điều phải đúng tuyệt đối:
//   [1] KHÔNG có quyền `uncheck_task` → không bao giờ được, kể cả công ty của chính mình
//   [2] CÓ quyền rồi vẫn phải ĐÚNG PHẠM VI — anh chốt 01/10/2026: "cty của nhân viên nào là nv
//       đó, tp nào quản lý phòng đó, không đụng lẫn nhau"
import { canUncheckTask } from '../lib/checklistScope.js'

let dat = 0, hong = 0
const kiem = (ten, dieuKien) => {
  if (dieuKien) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log('  ✗ ' + ten) }
}

// db giả: chỉ trả đúng những bảng canUncheckTask hỏi tới.
function dungDb({ client, secondary = [], systemRoles = [], perms = [], nhanVien = [] }) {
  const q = rows => {
    const o = {
      _r: rows,
      select() { return o },
      eq(c, v) { o._r = o._r.filter(r => r[c] === v); return o },
      in(c, vals) { o._r = o._r.filter(r => vals.includes(r[c])); return o },
      limit() { return o },
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
      if (t === 'staff') return q(nhanVien)
      throw new Error('bảng lạ: ' + t)
    },
  }
}

const QUYEN = [{ role_id: 'leader', permission_key: 'uncheck_task' }]
const QUYEN_NV = [{ role_id: 'staff', permission_key: 'uncheck_task' }]
// clients.room_id để TRỐNG đúng như dữ liệu thật (0/294 công ty có giá trị) — phòng suy từ
// nhân viên phụ trách.
const CTY_PHONG_A = { assigned_to: 'nv-a', room_id: null }
const NV = [{ id: 'nv-a', room_id: 'phong-a' }, { id: 'nv-b', room_id: 'phong-b' }]

console.log('\n[1] Không có quyền thì không ai được bỏ tick:')
kiem('nhân viên, đúng công ty mình phụ trách, nhưng CHƯA được cấp quyền → chặn',
  !(await canUncheckTask(dungDb({ client: { assigned_to: 'nv-a', room_id: null }, nhanVien: NV }),
    { staffId: 'nv-a', role: 'staff' }, 'c1')))
kiem('trưởng phòng, đúng phòng mình, nhưng CHƯA được cấp quyền → chặn',
  !(await canUncheckTask(dungDb({ client: CTY_PHONG_A, nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomIds: ['phong-a'] }, 'c1')))

console.log('\n[2] Có quyền rồi vẫn phải đúng phạm vi:')
kiem('trưởng phòng A bỏ tick công ty PHÒNG MÌNH → được',
  await canUncheckTask(dungDb({ client: CTY_PHONG_A, perms: QUYEN, nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomIds: ['phong-a'] }, 'c1'))
kiem('trưởng phòng B bỏ tick công ty PHÒNG A → CHẶN (không đụng lẫn nhau)',
  !(await canUncheckTask(dungDb({ client: CTY_PHONG_A, perms: QUYEN, nhanVien: NV }),
    { staffId: 'tp-b', role: 'leader', roomIds: ['phong-b'] }, 'c1')))
kiem('nhân viên bỏ tick công ty MÌNH phụ trách → được',
  await canUncheckTask(dungDb({ client: { assigned_to: 'nv-a', room_id: null }, perms: QUYEN_NV, nhanVien: NV }),
    { staffId: 'nv-a', role: 'staff' }, 'c1'))
kiem('nhân viên bỏ tick công ty ĐỒNG NGHIỆP CÙNG PHÒNG → CHẶN',
  !(await canUncheckTask(dungDb({ client: { assigned_to: 'nv-a', room_id: null }, perms: QUYEN_NV, nhanVien: NV }),
    { staffId: 'nv-khac', role: 'staff' }, 'c1')))
kiem('nhân viên PHỤ (client_secondary_staff) cũng được — vẫn theo dõi công ty đó hằng ngày',
  await canUncheckTask(dungDb({
    client: { assigned_to: 'nv-a', room_id: null }, perms: QUYEN_NV,
    secondary: [{ client_id: 'c1', staff_id: 'nv-phu' }], nhanVien: NV,
  }), { staffId: 'nv-phu', role: 'staff' }, 'c1'))

console.log('\n[3] Quản trị và vai trò hệ thống:')
kiem('admin → mọi công ty, không cần cấp quyền',
  await canUncheckTask(dungDb({ client: CTY_PHONG_A, nhanVien: NV }),
    { staffId: 'ad', role: 'admin' }, 'c1'))
kiem('vai trò is_system vẫn PHẢI đúng phạm vi, không phải admin nên không qua mặt được',
  !(await canUncheckTask(dungDb({ client: CTY_PHONG_A, systemRoles: ['sep'], nhanVien: NV }),
    { staffId: 'x', role: 'sep', roomIds: ['phong-b'] }, 'c1')))

console.log('\n[4] Vai trò kiêm nhiệm (ca chị Diệu — xem test-debt-scope-roles):')
kiem('vai trò chính không có quyền, vai trò KIÊM NHIỆM có → tính là có',
  await canUncheckTask(dungDb({
    client: CTY_PHONG_A, perms: [{ role_id: 'tp-hcns', permission_key: 'uncheck_task' }], nhanVien: NV,
  }), { staffId: 'dieu', roles: ['staff', 'tp-hcns', 'leader'], roomIds: ['phong-a', 'phong-hcns'] }, 'c1'))

console.log('\n[5] Đầu vào thiếu:')
kiem('chưa đăng nhập → chặn', !(await canUncheckTask(dungDb({ client: CTY_PHONG_A }), {}, 'c1')))
kiem('thiếu mã công ty → chặn',
  !(await canUncheckTask(dungDb({ client: CTY_PHONG_A }), { staffId: 'ad', role: 'admin' }, null)))
kiem('công ty không tồn tại → chặn',
  !(await canUncheckTask(dungDb({ client: null, perms: QUYEN }),
    { staffId: 'tp-a', role: 'leader', roomIds: ['phong-a'] }, 'c1')))

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
