// Chấm công & Lương — tab "Hướng dẫn dùng" (anh yêu cầu 01/11/2026). Nội dung = docs/huong-dan-cham-cong-luong.md
// (kèm ảnh docs/img/luong-*.png — ảnh đã che tên / dùng tài khoản test), qua khuôn components/TrangTaiLieu.js.
import TrangTaiLieu from '@/components/TrangTaiLieu'
import DauLuong from '@/components/luong/DauLuong'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hướng dẫn dùng — Chấm công & Lương — App Savitax' }

export default function TrangHuongDanLuong() {
  return <TrangTaiLieu file="huong-dan-cham-cong-luong.md" bieuTuong="📖" nhan="Dành cho mọi nhân viên" dau={<DauLuong tab="huong_dan" />} />
}
