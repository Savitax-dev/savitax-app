'use client'
// Thanh chuyển giữa các màn hình của Phân hệ Tờ khai.
//
// Chỉ có MỘT mục trong menu trái ("Tờ khai & Hạn nộp") để menu khỏi dài; các màn hình còn lại
// nằm ở thanh này, giống cách phân hệ HCNS và Kinh doanh gom màn hình con. Kiểu thanh: components/ThanhTab.js.
import { usePathname } from 'next/navigation'
import ThanhTab from './ThanhTab'

const MUC = [
  { href: '/tokhai',            icon: '📅', nhan: 'Lịch hạn nộp',    mo: 'App nghĩ công ty phải nộp gì' },
  { href: '/tokhai/bao-cao',    icon: '📊', nhan: 'Báo cáo',         mo: 'Theo phòng và theo nhân viên' },
  { href: '/tokhai/ho-so',      icon: '🗂️', nhan: 'Hồ sơ đã nộp',    mo: 'Hồ sơ thật lấy từ cổng thuế' },
  { href: '/tokhai/dong-bo-lo', icon: '🔄', nhan: 'Đồng bộ theo lô', mo: 'Gõ captcha liên tục cho nhiều công ty' },
  { href: '/tokhai/tai-file',   icon: '⬇️', nhan: 'Tải file',        mo: 'Tải tờ khai + thông báo về thư mục trên máy' },
  { href: '/tokhai/ket-noi',    icon: '🔌', nhan: 'Kết nối cổng',    mo: 'Tài khoản cổng thuế của từng công ty' },
]

export default function TabToKhai() {
  const pathname = usePathname()
  return <ThanhTab muc={MUC.map(m => ({ ...m, dangMo: pathname === m.href }))} />
}
