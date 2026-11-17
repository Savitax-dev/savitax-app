// Bản rời — bọc components/ThanhTab của app, bỏ những màn bản rời KHÔNG có:
//   Tăng trưởng & phí (anh bỏ 15/11/2026 — phí dịch vụ là chuyện nội bộ Savitax, đơn vị khác dùng app không cần).
import ThanhTabGoc from '../../components/ThanhTab.js'

const BO = ['/soatbaocao/tang-truong']

export default function ThanhTab({ muc = [], ...khac }) {
  return <ThanhTabGoc muc={muc.filter(m => !BO.some(b => String(m.href || '').startsWith(b)))} {...khac} />
}
