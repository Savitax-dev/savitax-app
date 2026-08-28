// Helper kiểm tra quyền theo vai trò — nạp 1 lần, dùng lại cho cả session.
// Vai trò có is_system = true (admin) luôn có toàn bộ quyền, không cần khai báo.

let _cache = null // { rolesMap: {id: {is_system}}, permMap: {roleId: Set<permKey>} }
let _loading = null

async function fetchPermissionData() {
  const [rolesRes, rpRes] = await Promise.all([
    fetch('/api/admin/roles').then(r => r.json()).catch(() => ({ data: [] })),
    fetch('/api/admin/role-permissions').then(r => r.json()).catch(() => ({ data: [] })),
  ])
  const rolesMap = {}
  for (const r of (rolesRes.data || [])) rolesMap[r.id] = r
  const permMap = {}
  for (const row of (rpRes.data || [])) {
    if (!permMap[row.role_id]) permMap[row.role_id] = new Set()
    permMap[row.role_id].add(row.permission_key)
  }
  return { rolesMap, permMap }
}

export async function loadPermissionData(force = false) {
  if (_cache && !force) return _cache
  if (!_loading) _loading = fetchPermissionData().then(data => { _cache = data; _loading = null; return data })
  return _loading
}

export function clearPermissionCache() { _cache = null }

// Kiểm tra đồng bộ (cần data đã load trước qua loadPermissionData).
//
// `role` nhận MỘT vai trò (chuỗi) hoặc NHIỀU vai trò (mảng) — nhân viên kiêm nhiệm có vai trò
// chính cộng các vai trò ở phòng kiêm nhiệm, chỉ cần một vai trò có quyền là đủ. Truyền chuỗi
// vẫn chạy y như cũ nên 16 chỗ đang gọi không phải sửa.
export function can(role, permKey, data) {
  if (!role || !data) return false
  const roles = Array.isArray(role) ? role.filter(Boolean) : [role]
  if (!roles.length) return false
  // Fallback an toàn: 'admin' luôn full quyền dù bảng roles chưa kịp tải/migrate
  if (roles.includes('admin')) return true
  return roles.some(r => {
    const roleInfo = data.rolesMap[r]
    if (roleInfo && roleInfo.is_system) return true
    return !!(data.permMap[r] && data.permMap[r].has(permKey))
  })
}

// Kiểm tra bất đồng bộ tiện dùng trực tiếp trong useEffect
export async function hasPermission(role, permKey) {
  const data = await loadPermissionData()
  return can(role, permKey, data)
}
