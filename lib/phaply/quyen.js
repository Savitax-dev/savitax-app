// Phân hệ Pháp lý — xác thực + phạm vi cho mọi route app/api/admin/phaply/** (kế hoạch mục 9).
//   Nhân viên (view_phaply): thấy hồ sơ mình phụ trách + hồ sơ CHƯA AI NHẬN; sửa hồ sơ mình (manage_phaply).
//   Trưởng phòng (view_phaply_all_staff): thấy + sửa cả phòng, giao / chuyển hồ sơ.
//   view_phaply_fee: thấy số tiền; close_phaply_case: đóng còn nợ / mở lại / xoá khoản thu / xoá hồ sơ.
// Xét ĐỦ vai trò kiêm nhiệm (caller.roles) — so riêng caller.role từng làm trưởng phòng kiêm nhiệm mất quyền.
import { createClient } from '@supabase/supabase-js'
import { getCallerRole } from '../serverAuth'
import { quyenTrongDanhSach } from '../quyenCache.js'

export function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const QUYEN = ['view_phaply', 'manage_phaply', 'view_phaply_fee', 'view_phaply_all_staff', 'manage_phaply_template',
  'close_phaply_case', 'view_phaply_cccd_image']

// Trả { ok, status, error, caller, admin, q: { xem, sua, tien, ca_phong, mau, dong, cccd } }
export async function requirePhapLy() {
  const caller = await getCallerRole()
  if (!caller.staffId) return { ok: false, status: 401, error: 'Chưa đăng nhập [' + caller.debug + ']' }
  const roles = caller.roles?.length ? caller.roles : [caller.role]
  const admin = getAdmin()
  const keys = roles.includes('admin') ? new Set(QUYEN) : await quyenTrongDanhSach(admin, roles, QUYEN)
  const q = {
    xem: keys.has('view_phaply'), sua: keys.has('manage_phaply'), tien: keys.has('view_phaply_fee'),
    ca_phong: keys.has('view_phaply_all_staff'), mau: keys.has('manage_phaply_template'),
    dong: keys.has('close_phaply_case'), cccd: keys.has('view_phaply_cccd_image'),
  }
  if (!q.xem && !q.ca_phong) return { ok: false, status: 403, error: 'Không có quyền vào phân hệ Pháp lý' }
  return { ok: true, caller, admin, q, vaiTro: roles }
}

export const loi = (status, error) => Response.json({ error }, { status })

export { xemDuoc, suaDuoc } from './phamVi.js'

// Lọc truy vấn danh sách theo phạm vi (đặt ở MÁY CHỦ — giao diện không tự lọc)
export function locPhamVi(query, auth) {
  if (auth.q.ca_phong) return query
  return query.or(`assigned_to.is.null,assigned_to.eq.${auth.caller.staffId}`)
}

// Đọc HẾT các dòng — PostgREST cắt im lặng ở 1000 dòng; build(from, to) phải có .order() ổn định (+ 'id').
export async function docHet(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

// Bỏ số tiền khỏi dữ liệu trả về khi người gọi không có view_phaply_fee
export function anTien(auth, obj) {
  if (auth.q.tien) return obj
  const { fees, installments, payments, tien, ...con } = obj
  return { ...con, an_tien: true }
}
