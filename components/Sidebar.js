'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { loadPermissionData, can, clearPermissionCache } from '@/lib/permissions'

/* ─── Brand colors ───────────────────────────────────────────────
   Đỏ chủ đạo : #8B1A1A   Gold chủ đạo : #C9A84C
──────────────────────────────────────────────────────────────── */

/* ─── Icons ─────────────────────────────────────────────────── */
const IconChevron = ({ open }) => (
  <svg className={'w-4 h-4 transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

/* ─── Role helpers ───────────────────────────────────────────── */
const ROLE_LABEL = {
  admin:     'Quản trị viên',
  leader:    'Trưởng phòng',
  manager:   'Trưởng phòng',
  staff:     'Chuyên viên',
  intern:    'Thực tập',
  trainee:   'Học việc',
  probation: 'Thử việc',
  collab:    'Cộng tác viên',
}

/* ─── NavItem ────────────────────────────────────────────────── */
function NavItem({ href, icon, label, pathname, onClose }) {
  const active = pathname === href
  return (
    <Link href={href} onClick={onClose}
      className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ' +
        (active
          ? 'bg-[#8B1A1A] text-white shadow-sm'
          : 'text-gray-600 hover:bg-red-50 hover:text-[#8B1A1A]')}>
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  )
}

/* ─── Tiêu đề phân khu ───────────────────────────────────────
   Tách từ khối "Quản trị" vốn đã có sẵn để dùng lại cho cả 3 khu (Kế toán / HCNS / Quản trị),
   giữ nguyên kiểu gạch gradient vàng — không thêm style mới. */
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-3">
      <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #C9A84C60, transparent)' }} />
      <p className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#C9A84C' }}>{children}</p>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, #C9A84C60, transparent)' }} />
    </div>
  )
}

/* ─── Main Sidebar ───────────────────────────────────────────── */
// Cache cấp module: user + rooms chỉ tải 1 lần cho cả phiên, dùng lại khi chuyển
// trang (AppShell mount lại mỗi trang nên không có cache sẽ fetch lặp mỗi lần điều
// hướng → chậm). Xóa khi đăng xuất.
let _sidebarCache = null // { user, rooms }
export function clearSidebarCache() { _sidebarCache = null }

export default function Sidebar({ onClose }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,       setUser]       = useState(_sidebarCache ? _sidebarCache.user : null)
  const [rooms,      setRooms]      = useState(_sidebarCache ? _sidebarCache.rooms : [])
  const [roomsOpen,  setRoomsOpen]  = useState(false)
  const [logoError,  setLogoError]  = useState(false)
  const [permData,   setPermData]   = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Permission data đã có cache riêng trong lib/permissions
      const pd = await loadPermissionData()
      if (!cancelled) setPermData(pd)

      // Dùng lại user + rooms từ cache nếu đã tải trong phiên
      if (_sidebarCache) {
        if (!cancelled) { setUser(_sidebarCache.user); setRooms(_sidebarCache.rooms) }
        return
      }

      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) return
      const [resMe, resRooms] = await Promise.all([
        supabase.from('staff').select('*, rooms(name)').eq('id', session.user.id).single(),
        // Danh sách con của "Phòng nghiệp vụ" — phòng HCNS KHÔNG nằm ở đây vì nó có phân khu
        // riêng bên dưới và không dùng giao diện /room/[roomId].
        supabase.from('rooms').select('*').neq('type', 'hcns').order('type').order('name'),
      ])
      let staffData = resMe.data

      // Fallback: nếu không tìm thấy hoặc thiếu room_id, thử query theo email
      if ((!staffData || !staffData.room_id) && session.user.email) {
        const { data: byEmail } = await supabase
          .from('staff').select('*, rooms(name)').eq('email', session.user.email).single()
        if (byEmail && byEmail.room_id) staffData = byEmail
      }

      if (!staffData || !staffData.role) {
        const email = session.user.email || ''
        const metaRole = session.user.user_metadata && session.user.user_metadata.role
        const fallbackRole = metaRole || (email === 'admin@savitax.vn' ? 'admin' : 'staff')
        staffData = staffData
          ? { ...staffData, role: fallbackRole }
          : { id: session.user.id, full_name: email.split('@')[0], role: fallbackRole, rooms: null }
      }
      const roomsData = resRooms.data || []
      _sidebarCache = { user: staffData, rooms: roomsData }
      if (!cancelled) { setUser(staffData); setRooms(roomsData) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (pathname && pathname.startsWith('/room/')) setRoomsOpen(true)
  }, [pathname])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearSidebarCache()
    clearPermissionCache()
    router.push('/login')
  }

  const role      = user ? user.role : null
  const isManager = can(role, 'manage_staff', permData) || can(role, 'manage_clients', permData) || can(role, 'view_all_rooms', permData)
  const canViewRooms   = can(role, 'view_all_rooms', permData)
  const canViewKpi      = can(role, 'view_kpi_report', permData)
  const canManageStaff   = can(role, 'manage_staff', permData)
  const canManageClients  = can(role, 'manage_clients', permData)
  const canManageRooms    = can(role, 'manage_rooms', permData)
  const canManageChecklist = can(role, 'manage_checklist_template', permData)
  const canViewAllDebt     = can(role, 'view_all_debt', permData)
  const canManageDatabase  = can(role, 'manage_database', permData)
  const canManageRoles     = can(role, 'manage_roles', permData)
  const showAdminSection = canManageRooms || canManageStaff || canManageClients || canManageChecklist || canViewAllDebt || canManageDatabase || canManageRoles
  // Khu HCNS tự ẩn với người không có quyền — bản clone không cài module thì quyền này không tồn
  // tại nên can() trả false, khu biến mất mà không phải sửa code.
  const canViewHcns = can(role, 'view_hcns', permData)
  const onRoomPage = pathname && pathname.startsWith('/room/')

  // Greeting by time — dùng full_name trực tiếp
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const firstName = user?.full_name ? user.full_name.trim() : ''

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">

      {/* ── Logo header ── */}
      <div className="flex-shrink-0 border-b border-gray-100">
        {/* Top brand band */}
        <div className="bg-gradient-to-r from-[#8B1A1A] to-[#6B1212] px-4 py-3 flex items-center gap-3">
          {!logoError ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center flex-shrink-0 shadow-md p-0.5">
              <Image
                src="/logo-savitax.png"
                alt="Savitax"
                width={40}
                height={40}
                className="object-contain w-full h-full"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            /* Fallback logo mark khi chưa có file */
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-[#8B1A1A] text-base font-black">S</span>
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white tracking-wide">SAVITAX</p>
            <p className="text-xs text-red-200">Hệ thống nội bộ</p>
          </div>
        </div>

        {/* Greeting bar */}
        {user && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
              style={{ background: 'linear-gradient(135deg,#8B1A1A,#C9A84C)' }}>
              {user.full_name ? user.full_name.trim().split(' ').pop().charAt(0).toUpperCase() : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 truncate">
                {greeting}, <span style={{ color: '#8B1A1A' }}>{firstName}</span> 👋
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-400 truncate">{ROLE_LABEL[role] || 'Nhân viên'}{user.rooms ? ' · ' + user.rooms.name : ''}</p>
                <span className="text-gray-300">·</span>
                <Link href="/change-password" onClick={onClose} className="text-xs hover:underline flex-shrink-0" style={{ color: '#8B1A1A' }}>
                  Đổi mật khẩu
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

        <NavItem href="/dashboard"  icon="🏠" label="Trang chủ"           pathname={pathname} onClose={onClose} />
        <NavItem href="/clients"    icon="🏢" label="Danh sách công ty"   pathname={pathname} onClose={onClose} />

        <SectionLabel>Kế toán</SectionLabel>
        <NavItem href="/checklist"  icon="📋" label="Checklist công việc" pathname={pathname} onClose={onClose} />
        <NavItem href="/my-debt"    icon="💰" label="Quản lý công nợ"     pathname={pathname} onClose={onClose} />
        {/* Nhật ký làm việc: để ở menu chính cho người KHÔNG có mục Quản trị (nhân viên/trưởng phòng);
            với tài khoản quản trị thì hiện trong mục Quản trị bên dưới cho đồng bộ */}
        {!showAdminSection && (
          <NavItem href="/work-log" icon="📔" label="Nhật ký làm việc"    pathname={pathname} onClose={onClose} />
        )}

        {canViewKpi && (
          <NavItem href="/report" icon="📊" label="Báo cáo KPI" pathname={pathname} onClose={onClose} />
        )}
        {isManager && (
          <NavItem href="/staff" icon="👥" label="Nhân viên Savitax" pathname={pathname} onClose={onClose} />
        )}

        {/* Phòng nghiệp vụ */}
        {canViewRooms && (
          <div>
            <div className={'flex items-center rounded-xl overflow-hidden ' +
              (onRoomPage || pathname === '/rooms' ? 'bg-[#8B1A1A]' : '')}>
              <Link href="/rooms" onClick={onClose}
                className={'flex-1 flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all ' +
                  (pathname === '/rooms' || onRoomPage
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-red-50 hover:text-[#8B1A1A]')}>
                <span className="text-lg">🏛️</span>
                Phòng nghiệp vụ
              </Link>
              <button onClick={() => setRoomsOpen(v => !v)}
                className={'px-2 py-2.5 transition-colors ' +
                  (onRoomPage || pathname === '/rooms'
                    ? 'text-red-200 hover:text-white'
                    : 'text-gray-400 hover:text-[#8B1A1A]')}>
                <IconChevron open={roomsOpen} />
              </button>
            </div>
            {roomsOpen && (
              <div className="mt-0.5 ml-5 space-y-0.5 border-l-2 pl-3" style={{ borderColor: '#C9A84C40' }}>
                {rooms.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">Đang tải...</p>}
                {rooms.map(room => {
                  const active = pathname === '/room/' + room.id
                  return (
                    <Link key={room.id} href={'/room/' + room.id} onClick={onClose}
                      className={'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all ' +
                        (active ? 'font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50')}
                      style={active ? { color: '#8B1A1A', backgroundColor: '#8B1A1A18' } : {}}>
                      <span className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' +
                        (active ? '' : 'bg-gray-300')}
                        style={active ? { backgroundColor: '#C9A84C' } : {}} />
                      <span className="truncate">Phòng {room.name}</span>
                      {room.type === 'remote' && <span className="text-xs text-gray-400 ml-auto flex-shrink-0">Remote</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Phân khu HCNS — 2 trang riêng, KHÔNG chèn vào danh sách phòng nghiệp vụ ở trên vì
            phòng HCNS không dùng giao diện /room/[roomId] của phòng kế toán. */}
        {canViewHcns && (
          <div>
            <SectionLabel>HCNS - BHXH</SectionLabel>
            <NavItem href="/hcns"           icon="💼" label="Công ty phụ trách" pathname={pathname} onClose={onClose} />
            <NavItem href="/hcns/checklist" icon="📝" label="Checklist HCNS"    pathname={pathname} onClose={onClose} />
          </div>
        )}

        {/* Admin section */}
        {showAdminSection && (
          <div>
            <SectionLabel>Quản trị</SectionLabel>
            {canManageRooms && (
              <NavItem href="/admin/rooms"     icon="🏛️" label="Quản lý phòng ban"     pathname={pathname} onClose={onClose} />
            )}
            {canManageStaff && (
              <NavItem href="/admin/staff"     icon="👤" label="Quản lý nhân viên"     pathname={pathname} onClose={onClose} />
            )}
            {canManageClients && (
              <NavItem href="/admin/clients"   icon="💼" label="Quản lý khách hàng"   pathname={pathname} onClose={onClose} />
            )}
            {canManageChecklist && (
              <NavItem href="/admin/checklist" icon="📋" label="Checklist mẫu"         pathname={pathname} onClose={onClose} />
            )}
            {canViewAllDebt && (
              <NavItem href="/debt"            icon="💵" label="Công nợ toàn công ty"  pathname={pathname} onClose={onClose} />
            )}
            <NavItem href="/work-log"          icon="📔" label="Nhật ký làm việc"      pathname={pathname} onClose={onClose} />
            {canManageRoles && (
              <NavItem href="/admin/roles"     icon="🔑" label="Vai trò & phân quyền"  pathname={pathname} onClose={onClose} />
            )}
            {canManageDatabase && (
              <NavItem href="/admin/backups"   icon="💾" label="Backup dữ liệu"        pathname={pathname} onClose={onClose} />
            )}
            {canManageDatabase && (
              <NavItem href="/admin/migrate"   icon="🗄️" label="Cài đặt Database"      pathname={pathname} onClose={onClose} />
            )}
          </div>
        )}

      </nav>

      {/* ── User footer ── */}
      <div className="flex-shrink-0 border-t border-gray-100">
        {/* Gold accent line */}
        <div className="h-0.5" style={{ background: 'linear-gradient(to right, #8B1A1A, #C9A84C, #8B1A1A)' }} />
        <div className="px-3 py-3">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-red-700 hover:bg-red-50 transition-colors">
            <span className="text-lg">🚪</span>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
