// Bộ nhớ tạm cho phần "ai đang gọi + có quyền gì" ở máy chủ (27/10/2026).
//
// VÌ SAO: Supabase sắp tính Log Ingestion (gói Free 1 GB/tháng, bắt đầu tính từ đầu 2027) mà app đang
// tạo ~2,2 GB/tháng. Mỗi lượt gọi API trước đây hỏi Supabase ~5 lần CHỈ để kiểm đăng nhập + quyền
// (getUser, staff, staff_extra_roles, roles, role_permissions) — mỗi lần là một dòng nhật ký, lại thêm một
// lượt khứ hồi sang Singapore. Biểu đồ: ngày làm việc ~95 MB, chủ nhật ~10 MB → do người dùng mở app.
//
// Hai lớp nhớ, sống trong bộ nhớ của MỘT phiên bản máy chủ (Vercel chạy nhiều bản song song, mỗi bản nhớ
// riêng, khởi động lại là mất — chỉ là nhớ tạm, không bao giờ là nguồn đúng):
//   1. Bảng vai trò + phân quyền: 5 phút. Bảng nhỏ (52 dòng) và hầu như không đổi.
//   2. Người gọi (đã xác thực) theo phiên đăng nhập: 1 phút — xem lib/serverAuth.js.
// Sửa vai trò / phân quyền / kiêm nhiệm / khoá nhân viên thì gọi xoaBoNhoQuyen() — xoá ngay ở bản máy chủ
// xử lý lượt sửa; các bản khác tự hết hạn (tối đa 1 phút với người gọi, 5 phút với bảng quyền).
//
// Cố ý KHÔNG phụ thuộc next/headers để script kiểm chạy được bằng node.

const HAN_BANG_QUYEN = 5 * 60 * 1000
export const HAN_NGUOI_GOI = 60 * 1000

let _bang = null          // { luc, heThong:Set, theoVaiTro:Map<role, Set<perm>> }
let _dangNap = null       // Promise đang nạp — nhiều lượt gọi cùng lúc chỉ nạp một lần

// Người gọi đã xác thực: khoá = băm của access token (không giữ token) → { luc, caller }.
export const boNhoNguoiGoi = new Map()

export function xoaBoNhoQuyen() {
  _bang = null
  _dangNap = null
  boNhoNguoiGoi.clear()
}

async function napBang(supabase) {
  const [{ data: roles, error: e1 }, { data: rp, error: e2 }] = await Promise.all([
    supabase.from('roles').select('id, is_system'),
    // Không lật trang: tối đa (số quyền × số vai trò) vài trăm dòng, xa mốc 1.000 của PostgREST.
    supabase.from('role_permissions').select('role_id, permission_key'),
  ])
  // Đọc lỗi thì KHÔNG nhớ — trả bảng rỗng (= không quyền, y như trước đây khi truy vấn lỗi), lượt sau đọc lại.
  if (e1 || e2) return { luc: 0, heThong: new Set(), theoVaiTro: new Map(), loi: true }
  const theoVaiTro = new Map()
  for (const r of rp || []) {
    if (!theoVaiTro.has(r.role_id)) theoVaiTro.set(r.role_id, new Set())
    theoVaiTro.get(r.role_id).add(r.permission_key)
  }
  return { luc: Date.now(), heThong: new Set((roles || []).filter(r => r.is_system).map(r => r.id)), theoVaiTro }
}

export async function bangQuyen(supabase) {
  if (_bang && Date.now() - _bang.luc < HAN_BANG_QUYEN) return _bang
  if (!_dangNap) {
    _dangNap = napBang(supabase).then(b => {
      if (!b.loi) _bang = b
      _dangNap = null
      return b
    }, e => { _dangNap = null; throw e })
  }
  return _dangNap
}

// Trong `roles` có vai trò hệ thống (admin…) không — vai trò hệ thống đủ mọi quyền.
export async function coVaiTroHeThong(supabase, roles) {
  if (!roles?.length) return false
  if (roles.includes('admin')) return true
  const b = await bangQuyen(supabase)
  return roles.some(r => b.heThong.has(r))
}

// Các quyền trong `keys` mà ít nhất một vai trò trong `roles` nắm (vai trò hệ thống: đủ cả).
export async function quyenTrongDanhSach(supabase, roles, keys) {
  const ds = Array.isArray(keys) ? keys : [keys]
  if (!roles?.length) return new Set()
  if (await coVaiTroHeThong(supabase, roles)) return new Set(ds)
  const b = await bangQuyen(supabase)
  const ra = new Set()
  for (const r of roles) for (const k of ds) if (b.theoVaiTro.get(r)?.has(k)) ra.add(k)
  return ra
}

// Có ít nhất một quyền trong `keys` không.
export async function vaiTroCoQuyen(supabase, roles, keys) {
  return (await quyenTrongDanhSach(supabase, roles, keys)).size > 0
}

// Các vai trò nắm quyền `permKey` (kể cả vai trò hệ thống) — dùng để tính phạm vi theo phòng.
export async function vaiTroNamQuyen(supabase, permKey) {
  const b = await bangQuyen(supabase)
  const ra = new Set(b.heThong)
  ra.add('admin')
  for (const [r, s] of b.theoVaiTro) if (s.has(permKey)) ra.add(r)
  return [...ra]
}
