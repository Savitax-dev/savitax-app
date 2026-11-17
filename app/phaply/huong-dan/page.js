// Phân hệ Pháp lý — trang "Hướng dẫn" (GĐ 6). Nội dung = docs/huong-dan-phan-he-phap-ly.md qua khuôn components/TrangTaiLieu.js
// (cần đăng nhập). Bản .docx in / gửi: scripts/phaply-huong-dan-docx.mjs. Sửa tài liệu là trang đổi theo ở lần đẩy sau.
import TrangTaiLieu from '@/components/TrangTaiLieu'
import { ThanhPhapLy } from '../_ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hướng dẫn — Phân hệ Pháp lý — App Savitax' }

export default function TrangHuongDanPhapLy() {
  return <TrangTaiLieu file="huong-dan-phan-he-phap-ly.md" bieuTuong="⚖️" nhan="Dành cho phòng Pháp lý"
    dau={<div className="pl-ui px-4 md:px-8 pt-5"><ThanhPhapLy dang="/phaply/huong-dan" /></div>} />
}
