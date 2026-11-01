// Tờ khai — tab "Hướng dẫn dùng" (anh yêu cầu 01/11/2026). Nội dung = docs/huong-dan-phan-he-to-khai.md (kèm ảnh
// docs/img/0*.png), hiển thị qua khuôn components/TrangTaiLieu.js (bắt đăng nhập ở máy chủ).
import TrangTaiLieu from '@/components/TrangTaiLieu'
import TabToKhai from '@/components/TabToKhai'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hướng dẫn dùng — Tờ khai — App Savitax' }

export default function TrangHuongDanToKhai() {
  return <TrangTaiLieu file="huong-dan-phan-he-to-khai.md" bieuTuong="📖" nhan="Dành cho nhân viên" dau={<TabToKhai />} />
}
