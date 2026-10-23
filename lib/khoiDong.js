// Trình duyệt: "tôi là ai, được làm gì" — MỘT yêu cầu /api/admin/khoi-dong, nhớ 5 phút trong phiên
// (sessionStorage) để chuyển trang / tải lại không hỏi lại (23/10/2026, anh báo localhost chậm).
// Chỉ để ẩn / hiện giao diện; mọi API vẫn tự kiểm quyền ở máy chủ. Đăng xuất, đăng nhập, sửa phân quyền
// → xoaKhoiDong() (gọi kèm trong clearPermissionCache của lib/permissions.js).

const KHOA = 'svt_khoi_dong_v1'
const HAN = 5 * 60 * 1000
let _nho = null      // { luc, data }
let _dang = null

function docPhien() {
  try {
    const j = JSON.parse(sessionStorage.getItem(KHOA) || 'null')
    if (j && Date.now() - j.luc < HAN) return j
  } catch (_) { /* phiên riêng tư / bị chặn: bỏ qua, hỏi máy chủ */ }
  return null
}

export async function layKhoiDong(lamMoi = false) {
  if (!lamMoi) {
    if (_nho && Date.now() - _nho.luc < HAN) return _nho.data
    if (typeof window !== 'undefined') { const p = docPhien(); if (p) { _nho = p; return p.data } }
  }
  if (!_dang) {
    _dang = fetch('/api/admin/khoi-dong', { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ error: 'Không kết nối được máy chủ' }))
      .then(d => {
        _dang = null
        if (!d?.error) {
          _nho = { luc: Date.now(), data: d }
          try { sessionStorage.setItem(KHOA, JSON.stringify(_nho)) } catch (_) { /* bỏ qua */ }
        }
        return d
      })
  }
  return _dang
}

// Cùng dạng dữ liệu với GET /api/admin/me (lỗi → { error }).
export async function layMe() { const d = await layKhoiDong(); return d?.error ? d : d.me }
// Cùng dạng dữ liệu với GET /api/admin/luong?viec=quyen.
export async function layQuyenLuong() { const d = await layKhoiDong(); return d?.error ? d : d.quyenLuong }

export function xoaKhoiDong() {
  _nho = null
  try { sessionStorage.removeItem(KHOA) } catch (_) { /* bỏ qua */ }
}
