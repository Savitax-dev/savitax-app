'use client'
// Thanh chuyển giữa các màn hình của Phân hệ Tờ khai.
//
// Chỉ có MỘT mục trong menu trái ("Tờ khai & Hạn nộp") để menu khỏi dài; các màn hình còn lại
// nằm ở thanh này, giống cách phân hệ HCNS và Kinh doanh gom màn hình con.
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MUC = [
  { href: '/tokhai',          nhan: 'Lịch hạn nộp',  mo: 'App nghĩ công ty phải nộp gì' },
  { href: '/tokhai/bao-cao',  nhan: 'Báo cáo',       mo: 'Theo phòng và theo nhân viên' },
  { href: '/tokhai/ho-so',    nhan: 'Hồ sơ đã nộp',  mo: 'Hồ sơ thật lấy từ cổng thuế' },
  { href: '/tokhai/dong-bo-lo', nhan: 'Đồng bộ theo lô', mo: 'Gõ captcha liên tục cho nhiều công ty' },
  { href: '/tokhai/ket-noi',  nhan: 'Kết nối cổng',  mo: 'Tài khoản cổng thuế của từng công ty' },
]

export default function TabToKhai() {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
      {MUC.map(m => {
        const dangMo = pathname === m.href
        return (
          <Link key={m.href} href={m.href} title={m.mo}
            className={'px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition-colors ' + (dangMo
              ? 'border-[#8B1A1A] text-[#8B1A1A] font-semibold bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-[#8B1A1A] hover:bg-red-50/30')}>
            {m.nhan}
          </Link>
        )
      })}
    </div>
  )
}
