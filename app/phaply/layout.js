import { Be_Vietnam_Pro, IBM_Plex_Mono } from 'next/font/google'
import './phaply.css'

// Phân hệ Pháp lý — giao diện riêng như Phòng Kinh doanh (app/sales/layout.js): layout CHỈ khai biến font, font + màu chỉ áp
// vào vùng có class .pl-ui nên menu trái dùng chung không đổi.
const beVietnam = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-pl-sans', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'vietnamese'], weight: ['500', '600'], variable: '--font-pl-mono', display: 'swap' })

export default function PhapLyLayout({ children }) {
  return <div className={beVietnam.variable + ' ' + plexMono.variable + ' contents'}>{children}</div>
}
