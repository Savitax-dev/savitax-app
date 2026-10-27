// Kiểm lib/quyenCache.js (27/10/2026): kết quả phải GIỐNG HỆT cách cũ (hỏi Supabase từng lượt) cho mọi
// vai trò × mọi quyền, và bảng quyền chỉ được nạp MỘT lần cho nhiều lượt hỏi. Chỉ đọc.
//   node --env-file=.env.local scripts/test-quyen-cache.mjs
import { createClient } from '@supabase/supabase-js'
import { vaiTroCoQuyen, quyenTrongDanhSach, coVaiTroHeThong, vaiTroNamQuyen, xoaBoNhoQuyen } from '../lib/quyenCache.js'

const goc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let soLuot = 0
const dem = { from: (...a) => { soLuot++; return goc.from(...a) } }

async function cachCu(roles, permKey) {
  if (roles.includes('admin')) return true
  const { data: roleRows } = await goc.from('roles').select('id, is_system').in('id', roles)
  if ((roleRows || []).some(r => r.is_system)) return true
  const { data: rp } = await goc.from('role_permissions').select('permission_key').in('role_id', roles).eq('permission_key', permKey).limit(1)
  return !!rp?.length
}

let hong = 0
const kiem = (ten, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { hong++; console.log('  HỎNG', ten, a, '≠', b) } }

const { data: roles } = await goc.from('roles').select('id')
const { data: perms } = await goc.from('permissions').select('key')
const dsRole = roles.map(r => r.id), dsPerm = perms.map(p => p.key)
const toHop = [...dsRole.map(r => [r]), ['staff', 'leader'], ['staff', 'hcns_leader'], ['nhan_vien_nb', 'leader'], ['khong_ton_tai'], []]

xoaBoNhoQuyen(); soLuot = 0
let lan = 0
for (const rs of toHop) for (const k of dsPerm) {
  lan++
  kiem(rs.join('+') + ' / ' + k, await vaiTroCoQuyen(dem, rs, k), rs.length ? await cachCu(rs, k) : false)
}
console.log(`${lan} lượt hỏi quyền (${toHop.length} tổ hợp vai trò × ${dsPerm.length} quyền) → bộ nhớ gọi Supabase ${soLuot} lần (cách cũ: ~${lan * 2} lần)`)
kiem('chỉ nạp bảng một lần', soLuot, 2)

kiem('admin là hệ thống', await coVaiTroHeThong(dem, ['admin']), true)
kiem('staff không là hệ thống', await coVaiTroHeThong(dem, ['staff']), false)
const nhieu = await quyenTrongDanhSach(dem, ['nhan_vien_nb'], ['cham_cong', 'view_payroll', 'manage_payroll'])
kiem('quyền lương của Nhân viên NB', [...nhieu].sort(), ['cham_cong', 'manage_payroll', 'view_payroll'].filter(k => nhieu.has(k)).sort())
const ms = await vaiTroNamQuyen(dem, 'manage_staff')
kiem('vai trò nắm manage_staff gồm admin + leader', ['admin', 'leader'].every(r => ms.includes(r)), true)

// Xoá bộ nhớ thì lượt sau phải nạp lại.
xoaBoNhoQuyen(); soLuot = 0
await vaiTroCoQuyen(dem, ['staff'], 'cham_cong'); await vaiTroCoQuyen(dem, ['leader'], 'manage_staff')
kiem('xoá bộ nhớ → nạp lại đúng một lần', soLuot, 2)

// Nhiều lượt hỏi CÙNG LÚC khi bộ nhớ trống chỉ nạp một lần.
xoaBoNhoQuyen(); soLuot = 0
await Promise.all(Array.from({ length: 20 }, () => vaiTroCoQuyen(dem, ['leader'], 'manage_staff')))
kiem('20 lượt cùng lúc → nạp một lần', soLuot, 2)

// Đọc lỗi thì không nhớ, trả "không quyền".
xoaBoNhoQuyen()
const hongDb = { from: () => ({ select: () => { const q = { order: () => q, range: async () => ({ data: null, error: { message: 'x' } }), then: (f) => f({ data: null, error: { message: 'x' } }) }; return q } }) }
kiem('đọc lỗi → không quyền', await vaiTroCoQuyen(hongDb, ['leader'], 'manage_staff'), false)
soLuot = 0
kiem('đọc lỗi không bị nhớ lại', await vaiTroCoQuyen(dem, ['leader'], 'manage_staff'), true)

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong ? 1 : 0)
