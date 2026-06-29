'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

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
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
          <NotificationBell />
        </div>

        {/* Desktop: chuông thông báo góc phải, nổi trên mọi trang */}
        <div className="hidden md:block fixed top-3 right-4 z-40">
          <NotificationBell />
        </div>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
