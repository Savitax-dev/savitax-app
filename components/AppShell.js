'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import NhacHanNop from './NhacHanNop'
import { createClient } from '@/lib/supabase'
import { trangThaiHaiLop } from '@/lib/haiLop'

// Phiên chưa đủ xác thực 2 lớp (đã bật mà chưa nhập mã / bắt buộc mà chưa cài) → về /login làm nốt bước đó.
// Máy chủ cũng chặn (lib/serverAuth.js) — đây chỉ để người dùng không thấy trang trống báo lỗi quyền.
function useChanHaiLop() {
  const router = useRouter()
  useEffect(() => {
    let huy = false
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!data?.session || huy) return
      const tt = await trangThaiHaiLop(supabase)
      if (!huy && (tt.canMa || tt.canCaiDat)) router.replace('/login')
    })()
    return () => { huy = true }
  }, [router])
}

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  useChanHaiLop()

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Desktop sidebar — sticky, full height */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0">
        <Sidebar />
      </aside>

      {/* Mobile: overlay drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 max-w-[80vw] shadow-xl">
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Right: mobile top bar + page content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1 -ml-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Mở menu"
          >
            <IconMenu />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Savitax</span>
          </div>
        </div>

        {/* Dải nhắc hạn nộp tờ khai — đầu MỌI trang như bảng tin MISA (anh chốt 15/10/2026).
            Tự ẩn khi không có gì để nhắc, và với người không có quyền xem Tờ khai (phòng HCNS,
            kinh doanh) — máy chủ trả rỗng, xem app/api/admin/tokhai/nhac-han. */}
        <NhacHanNop />

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
