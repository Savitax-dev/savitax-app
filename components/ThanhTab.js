'use client'
// Thanh tab dùng chung giữa các màn con của một phân hệ (Tờ khai, Soát xét báo cáo, Rủi ro thuế…).
// Các tab CHIA ĐỀU trong một khung, cùng cao / cỡ chữ / đệm, mỗi tab một biểu tượng — anh chỉ 01/11/2026: tab to nhỏ
// không đều nhìn giãn nở (feedback giao diện: "tab chia đều 1 khung"). Trang dùng thanh này nên dàn đầy màn hình
// (khung `p-4 md:p-6 w-full`, KHÔNG max-w … mx-auto) để chuyển tab khung không nhảy.
//   muc: [{ key, href, icon, nhan, mo (chú thích khi rê chuột), dangMo }]
import Link from 'next/link'

const COT = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7' }

export default function ThanhTab({ muc }) {
  return (
    <div className={'grid grid-cols-2 sm:grid-cols-3 gap-1 p-1 mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm ' + (COT[muc.length] || 'lg:grid-cols-6')}>
      {muc.map(m => (
        <Link key={m.key || m.href} href={m.href} title={m.mo}
          className={'flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ' + (m.dangMo
            ? 'bg-[#8B1A1A] text-white shadow-sm'
            : 'text-gray-600 hover:bg-red-50 hover:text-[#8B1A1A]')}>
          <span className="text-base leading-none">{m.icon}</span>
          <span className="truncate">{m.nhan}</span>
        </Link>
      ))}
    </div>
  )
}
