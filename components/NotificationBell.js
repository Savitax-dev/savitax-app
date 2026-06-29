'use client'
import { useEffect, useRef, useState } from 'react'

const IconBell = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
)

export default function NotificationBell({ className = '' }) {
  const [open, setOpen] = useState(false)
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/today-reminders', { cache: 'no-store' })
        const json = await res.json()
        setReminders(json.reminders || [])
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const count = reminders.length
  const todayLabel = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

  return (
    <div ref={ref} className={'relative ' + className}>
      <button onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        aria-label="Thông báo nhắc nhở checklist">
        <IconBell />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
            <p className="text-sm font-semibold text-gray-800">🔔 Nhắc nhở checklist hôm nay</p>
            <p className="text-xs text-gray-400 mt-0.5">Ngày {todayLabel}</p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-6">Đang tải...</p>
            ) : count === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Hôm nay không có công việc đến hạn 🎉</p>
            ) : reminders.map(r => (
              <div key={r.id} className="px-4 py-2.5 flex items-start gap-2">
                <span className="text-base flex-shrink-0">⏰</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 break-words">{r.name}</p>
                  <span className={'inline-block mt-1 text-xs font-medium px-1.5 py-0.5 rounded-full ' +
                    (r.report_type === 'quarterly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                    {r.report_type === 'quarterly' ? 'Báo cáo quý' : 'Báo cáo tháng'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
