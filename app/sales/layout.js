import { Be_Vietnam_Pro, IBM_Plex_Mono } from 'next/font/google'
import './sales.css'

// Phân khu Phòng Kinh doanh dùng giao diện riêng (phương án B "Xanh báo giá", chốt 2026-09-11):
// bảng màu xanh – vàng kim của mẫu báo giá SVT.MB03, font Be Vietnam Pro + IBM Plex Mono cho số liệu
// (theo tài liệu bàn giao module Báo giá). Layout này CHỈ khai báo biến font — font thật chỉ áp vào
// vùng nội dung có class .sales-ui, nên menu trái dùng chung toàn app không đổi.
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-svt-sans',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600'],
  variable: '--font-svt-mono',
  display: 'swap',
})

export default function SalesLayout({ children }) {
  return <div className={beVietnam.variable + ' ' + plexMono.variable + ' contents'}>{children}</div>
}
