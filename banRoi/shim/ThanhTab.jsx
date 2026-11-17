// Bản rời — bọc components/ThanhTab của app:
//   - BỎ màn bản rời không có: Tăng trưởng & phí (anh bỏ 15/11/2026 — phí dịch vụ là chuyện nội bộ Savitax).
//   - THÊM tab "🧭 Hướng dẫn" cuối thanh của Soát xét / Rủi ro thuế (anh duyệt 17/11/2026) → banRoi/khung/HuongDan*.jsx.
import ThanhTabGoc from '../../components/ThanhTab.js'
import { usePathname } from './dieuHuong'

const BO = ['/soatbaocao/tang-truong']
const HUONG_DAN = [
  { goc: '/soatbaocao', href: '/soatbaocao/huong-dan', mo: 'Cách dùng · tải cây thư mục mẫu SVT.MB09' },
  { goc: '/ruirothue', href: '/ruirothue/huong-dan', mo: 'Hồ sơ cần có · cách đọc kết quả' },
]

export default function ThanhTab({ muc = [], ...khac }) {
  const p = usePathname()
  const ds = muc.filter(m => !BO.some(b => String(m.href || '').startsWith(b)))
  const hd = HUONG_DAN.find(h => ds.some(m => String(m.href || '').startsWith(h.goc)))
  if (hd) ds.push({ key: 'huong-dan', href: hd.href, icon: '🧭', nhan: 'Hướng dẫn', mo: hd.mo, dangMo: p === hd.href })
  return <ThanhTabGoc muc={ds} {...khac} />
}
