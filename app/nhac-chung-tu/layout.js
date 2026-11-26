import { Be_Vietnam_Pro } from 'next/font/google'

// Phông cho ảnh thông báo (dựng trên trình duyệt rồi chụp bằng html2canvas) — chỉ khai biến, áp vào khung ảnh.
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-thong-bao',
  display: 'swap',
})

export default function NhacChungTuLayout({ children }) {
  return <div className={beVietnam.variable + ' contents'}>{children}</div>
}
