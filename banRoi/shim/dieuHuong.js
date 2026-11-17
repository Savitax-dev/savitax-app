// Bản rời — thay next/navigation. Mọi trang chạy trong MỘT file HTML nên "đường dẫn" nằm sau dấu # :
//   file:///…/Savitax-HoSo.html#/soatbaocao/ho-so?cty=c123
// Chạy được khi mở thẳng từ ổ đĩa (không cần máy chủ), nút Lùi / Tới của trình duyệt vẫn dùng được.
import { useMemo, useSyncExternalStore } from 'react'

const nghe = cb => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) }
const layHash = () => decodeURI(location.hash.slice(1)) || '/'

export function diToi(url, thay = false) {
  const h = '#' + url
  if (location.hash === h) return
  if (!thay) { location.hash = url; return }
  try { history.replaceState(null, '', h) } catch { location.replace(h) }
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export const useDuongDanDu = () => useSyncExternalStore(nghe, layHash, () => '/')

// Một đối tượng router DUY NHẤT: các trang để router trong danh sách phụ thuộc của useEffect — đổi đối tượng mỗi lần vẽ là
// effect chạy lại mãi (tải danh sách công ty liên tục).
const ROUTER = {
  push: url => diToi(url),
  replace: url => diToi(url, true),
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => {},
  prefetch: () => {},
}
export function useRouter() { return ROUTER }
export function usePathname() { return useDuongDanDu().split('?')[0] || '/' }
export function useSearchParams() {
  const du = useDuongDanDu()
  return useMemo(() => new URLSearchParams(du.split('?')[1] || ''), [du])
}
export function redirect(url) { diToi(url, true) }
export function notFound() {}
