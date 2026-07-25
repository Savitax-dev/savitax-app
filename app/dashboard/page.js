'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import NotificationBell from '@/components/NotificationBell'

const pctColor = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-600' : 'text-red-500'
const barColor = (v) => v >= 90 ? 'bg-green-500' : v >= 70 ? 'bg-yellow-400' : 'bg-red-400'

function Bar({ value, className = 'h-1.5' }) {
  return (
    <div className={'bg-gray-100 rounded-full overflow-hidden ' + className}>
      <div className={'h-full rounded-full transition-all ' + barColor(value || 0)}
        style={{ width: Math.min(100, value || 0) + '%' }} />
    </div>
  )
}

// Vòng tròn tiến độ lớn cho số tổng công ty
function Ring({ value, color }) {
  const v = Math.min(100, value || 0)
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${v} 100`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{v}%</span>
      </div>
    </div>
  )
}

// Badge số thứ tự phần
function SectionNum({ n, color }) {
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: color }}>{n}</span>
  )
}

const initial = (name) => name ? name.trim().split(' ').pop().charAt(0).toUpperCase() : '?'

export default function DashboardPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState([])
  const [staff, setStaff] = useState([])
  const [company, setCompany] = useState({ avg_task_pct: 0, avg_debt_pct: 0 })
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.push('/login'); return }

      const kpi = await fetch(`/api/admin/kpi-overview?year=${year}&month=${month}&_t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json())
      setRooms(kpi.rooms || [])
      setStaff(kpi.staff || [])
      setCompany(kpi.company || { avg_task_pct: 0, avg_debt_pct: 0 })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )

  const activeRooms = rooms.filter(r => r.staff_count > 0)
  const roomName = (id) => (rooms.find(r => r.room_id === id) || {}).room_name || ''

  // Hạng 1: phòng có điểm tổng hợp cao nhất
  const score = (t, d) => Math.round(((t || 0) + (d || 0)) / 2)
  const bestRoom = activeRooms
    .map(r => ({ ...r, score: score(r.avg_task_pct, r.avg_debt_pct) }))
    .sort((a, b) => b.score - a.score)[0] || null

  // Hạng 1: nhân viên (có phụ trách công ty) điểm tổng hợp cao nhất — chỉ xét vai trò "nhân viên",
  // không tính trưởng phòng/quản trị vào bảng xếp hạng này.
  const rankableStaff = staff.filter(s => s.client_count > 0 && s.role === 'staff')
  const bestStaff = rankableStaff
    .map(s => ({ ...s, score: score(s.task_pct, s.debt_pct) }))
    .sort((a, b) => b.score - a.score)[0] || null

  const RED = '#8B1A1A', GOLD = '#C9A84C'

  // Khối breakdown danh sách phòng theo 1 chỉ số (task | debt)
  const RoomBreakdown = ({ metric }) => (
    <div className="space-y-2.5 mt-4">
      {activeRooms.length === 0 ? (
        <p className="text-xs text-gray-400">Chưa có dữ liệu phòng</p>
      ) : activeRooms.map(r => {
        const v = metric === 'task' ? r.avg_task_pct : r.avg_debt_pct
        return (
          <div key={r.room_id} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-28 flex-shrink-0 truncate">Phòng {r.room_name}</span>
            <Bar value={v} className="h-2 flex-1" />
            <span className={'text-xs font-semibold w-9 text-right flex-shrink-0 ' + pctColor(v)}>{v}%</span>
          </div>
        )
      })}
    </div>
  )

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tháng {month}/{year}</p>
          </div>
          <NotificationBell />
        </div>

        {/* Hàng trên: 1 & 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* 1 — Hoàn thành công việc */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <SectionNum n={1} color={RED} />
              <h2 className="text-sm font-bold text-gray-800">✅ Hoàn thành công việc</h2>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <Ring value={company.avg_task_pct} color="#16a34a" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Toàn công ty</p>
                <p className="text-sm text-gray-600 mt-0.5">Trung bình tiến độ công việc tháng này của tất cả các phòng</p>
              </div>
            </div>
            <RoomBreakdown metric="task" />
          </div>

          {/* 2 — Thu hồi công nợ */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <SectionNum n={2} color={RED} />
              <h2 className="text-sm font-bold text-gray-800">💰 Thu hồi công nợ</h2>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <Ring value={company.avg_debt_pct} color="#d97706" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Toàn công ty</p>
                <p className="text-sm text-gray-600 mt-0.5">Trung bình tỉ lệ thu hồi phí dịch vụ tháng này của tất cả các phòng</p>
              </div>
            </div>
            <RoomBreakdown metric="debt" />
          </div>
        </div>

        {/* Hàng dưới: 3 & 4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 3 — Phòng xuất sắc nhất */}
          <div className="rounded-2xl p-5 border border-amber-200"
            style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)' }}>
            <div className="flex items-center gap-2 mb-3">
              <SectionNum n={3} color={GOLD} />
              <h2 className="text-sm font-bold text-gray-800">🏆 Phòng xuất sắc nhất</h2>
            </div>
            {!bestRoom ? (
              <p className="text-sm text-gray-400 py-4">Chưa có dữ liệu</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🏆</div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900 break-words">Phòng {bestRoom.room_name}</p>
                    <p className="text-xs text-gray-500">{bestRoom.staff_count} nhân viên · Điểm tổng hợp <span className="font-bold" style={{ color: RED }}>{bestRoom.score}%</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/70 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Công việc</p>
                    <p className={'text-xl font-bold ' + pctColor(bestRoom.avg_task_pct)}>{bestRoom.avg_task_pct}%</p>
                  </div>
                  <div className="bg-white/70 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Công nợ</p>
                    <p className={'text-xl font-bold ' + pctColor(bestRoom.avg_debt_pct)}>{bestRoom.avg_debt_pct}%</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 4 — Nhân viên xuất sắc nhất */}
          <div className="rounded-2xl p-5 border border-amber-200"
            style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)' }}>
            <div className="flex items-center gap-2 mb-3">
              <SectionNum n={4} color={GOLD} />
              <h2 className="text-sm font-bold text-gray-800">🌟 Nhân viên xuất sắc nhất</h2>
            </div>
            {!bestStaff ? (
              <p className="text-sm text-gray-400 py-4">Chưa có dữ liệu</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-lg font-bold shadow-sm"
                    style={{ background: 'linear-gradient(135deg,#8B1A1A,#C9A84C)' }}>
                    {initial(bestStaff.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900 break-words">{bestStaff.full_name}</p>
                    <p className="text-xs text-gray-500 break-words">
                      {roomName(bestStaff.room_id) ? 'Phòng ' + roomName(bestStaff.room_id) + ' · ' : ''}
                      Điểm tổng hợp <span className="font-bold" style={{ color: RED }}>{bestStaff.score}%</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/70 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Công việc</p>
                    <p className={'text-xl font-bold ' + pctColor(bestStaff.task_pct)}>{bestStaff.task_pct}%</p>
                  </div>
                  <div className="bg-white/70 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Công nợ</p>
                    <p className={'text-xl font-bold ' + pctColor(bestStaff.debt_pct)}>{bestStaff.debt_pct}%</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {rooms.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">Không có dữ liệu phòng ban</div>
        )}

      </div>
    </AppShell>
  )
}
