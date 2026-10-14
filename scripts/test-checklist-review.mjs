// Kiểm quyền đóng dấu "TP đã kiểm tra" — database giả, không đụng dữ liệu thật.
//
//   node scripts/test-checklist-review.mjs
//
// Vì sao phải có bộ kiểm riêng: dấu này là thứ quản trị NHÌN VÀO ĐỂ TIN. Nếu nhân viên tự đóng
// được dấu lên công ty của chính mình thì dấu không còn nói lên điều gì — mà hỏng kiểu đó không
// ai phát hiện ra, vì nhìn bề ngoài dấu vẫn xanh y như dấu thật.
//
// Ba điều phải đúng tuyệt đối:
//   [1] KHÔNG có quyền `review_checklist` → không bao giờ được
//   [2] CÓ quyền rồi vẫn phải ĐANG LÀM TRƯỞNG đúng phòng chứa công ty đó
//   [3] KHÔNG có nhánh "công ty mình phụ trách" — khác hẳn quyền bỏ tick
import { canReviewChecklist, canUncheckTask } from '../lib/checklistScope.js'

let dat = 0, hong = 0
const kiem = (ten, dieuKien) => {
  if (dieuKien) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log('  ✗ ' + ten) }
}

// db giả: chỉ trả đúng những bảng hai hàm này hỏi tới.
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

const QUYEN_TP = [{ role_id: 'leader', permission_key: 'review_checklist' }]
const QUYEN_NV = [{ role_id: 'staff',  permission_key: 'review_checklist' }]
// clients.room_id để TRỐNG đúng như dữ liệu thật — phòng suy từ nhân viên phụ trách.
const CTY_PHONG_A = { assigned_to: 'nv-a', room_id: null }
const NV = [{ id: 'nv-a', room_id: 'phong-a' }, { id: 'nv-b', room_id: 'phong-b' }]

console.log('\n[1] Chưa cấp quyền thì không ai đóng dấu được:')
kiem('trưởng phòng đúng phòng mình, nhưng CHƯA được cấp quyền → chặn',
  !(await canReviewChecklist(dungDb({ client: CTY_PHONG_A, nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomId: 'phong-a', extraRoles: [] }, 'c1')))

console.log('\n[2] Có quyền rồi vẫn phải đúng phòng:')
kiem('trưởng phòng A, công ty phòng A → được',
  await canReviewChecklist(dungDb({ client: CTY_PHONG_A, perms: QUYEN_TP, nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomId: 'phong-a', extraRoles: [] }, 'c1'))
kiem('trưởng phòng B, công ty phòng A → chặn',
  !(await canReviewChecklist(dungDb({ client: CTY_PHONG_A, perms: QUYEN_TP, nhanVien: NV }),
    { staffId: 'tp-b', role: 'leader', roomId: 'phong-b', extraRoles: [] }, 'c1')))

console.log('\n[3] KHÔNG có nhánh "công ty của chính mình" — chỗ khác hẳn quyền bỏ tick:')
// Đây là ca dễ hỏng nhất khi ai đó sửa lại file này: chép nhầm thân hàm canUncheckTask sang là
// nhân viên tự ký duyệt việc của chính mình được ngay, mà bên ngoài không nhìn ra.
const dbNvCoQuyen = () => dungDb({ client: CTY_PHONG_A, perms: QUYEN_NV, nhanVien: NV })
const nvA = { staffId: 'nv-a', role: 'staff', roomId: 'phong-a', extraRoles: [] }
kiem('nhân viên có quyền, đúng công ty MÌNH phụ trách → vẫn chặn',
  !(await canReviewChecklist(dbNvCoQuyen(), nvA, 'c1')))
kiem('… trong khi cùng kịch bản đó thì quyền BỎ TICK lại cho phép (hai quyền khác nhau thật)',
  await canUncheckTask(
    dungDb({ client: CTY_PHONG_A, perms: [{ role_id: 'staff', permission_key: 'uncheck_task' }], nhanVien: NV }),
    nvA, 'c1'))
kiem('nhân viên phụ trách PHỤ có quyền → vẫn chặn',
  !(await canReviewChecklist(
    dungDb({ client: { assigned_to: 'nv-b', room_id: null }, secondary: [{ client_id: 'c1', staff_id: 'nv-a' }], perms: QUYEN_NV, nhanVien: NV }),
    nvA, 'c1')))

console.log('\n[4] Kiêm nhiệm chỉ có hiệu lực ở ĐÚNG phòng kiêm nhiệm:')
// Ca thật Lương Tấn Đức: nhân viên phòng Grand, kiêm Trưởng phòng Danxia. Gộp phẳng vai trò thì
// anh ấy thành trưởng phòng ở cả hai phòng.
const kiemNhiem = {
  staffId: 'nv-a', role: 'staff', roomId: 'phong-a',
  extraRoles: [{ room_id: 'phong-b', role: 'leader' }],
}
kiem('kiêm trưởng phòng B: công ty phòng B → được',
  await canReviewChecklist(
    dungDb({ client: { assigned_to: 'nv-b', room_id: null }, perms: QUYEN_TP, nhanVien: NV }),
    kiemNhiem, 'c1'))
kiem('kiêm trưởng phòng B: công ty phòng A (phòng chính, chỉ là nhân viên) → chặn',
  !(await canReviewChecklist(dungDb({ client: CTY_PHONG_A, perms: QUYEN_TP, nhanVien: NV }),
    kiemNhiem, 'c1')))

console.log('\n[5] Quản trị và vai trò hệ thống:')
// Vai trò is_system bỏ qua BẢNG QUYỀN, nhưng KHÔNG bỏ qua phạm vi — giống hệt canUncheckTask.
// Chỉ 'admin' mới đi đường tắt hoàn toàn. Nếu sau này anh muốn một vai trò tự tạo (vd "Giám đốc")
// đóng dấu được cho mọi phòng thì phải mở có chủ ý ở đây, chứ đừng để nó lọt qua vì is_system.
kiem('quản trị viên → luôn được, không cần cấp quyền',
  await canReviewChecklist(dungDb({ client: CTY_PHONG_A, nhanVien: NV }),
    { staffId: 'ad', role: 'admin' }, 'c1'))
kiem('vai trò is_system nhưng KHÔNG phải trưởng phòng → vẫn chặn (phạm vi luôn được xét)',
  !(await canReviewChecklist(
    dungDb({ client: CTY_PHONG_A, systemRoles: ['giamdoc'], nhanVien: NV }),
    { staffId: 'gd', role: 'giamdoc', roomId: 'phong-a', extraRoles: [] }, 'c1')))
kiem('trưởng phòng A mang thêm vai trò is_system → được, khỏi cần dòng cấp quyền nào',
  await canReviewChecklist(
    dungDb({ client: CTY_PHONG_A, systemRoles: ['leader'], nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomId: 'phong-a', extraRoles: [] }, 'c1'))

console.log('\n[6] Đầu vào thiếu thì chặn, không nổ:')
kiem('chưa đăng nhập → chặn', !(await canReviewChecklist(dungDb({}), null, 'c1')))
kiem('thiếu clientId → chặn',
  !(await canReviewChecklist(dungDb({}), { staffId: 'tp-a', role: 'leader' }, null)))
kiem('công ty không tồn tại → chặn',
  !(await canReviewChecklist(dungDb({ client: null, perms: QUYEN_TP, nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomId: 'phong-a', extraRoles: [] }, 'c1')))
kiem('công ty chưa giao cho ai (không suy ra được phòng) → chặn',
  !(await canReviewChecklist(
    dungDb({ client: { assigned_to: null, room_id: null }, perms: QUYEN_TP, nhanVien: NV }),
    { staffId: 'tp-a', role: 'leader', roomId: 'phong-a', extraRoles: [] }, 'c1')))

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
