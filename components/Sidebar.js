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
const IconHome = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)
const IconBuilding = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
)
const IconCoin = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const IconChart = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)
const IconBriefcase = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
)
const IconClipboard = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
)
const IconStore = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
  </svg>
)
const IconPeople = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
)
const IconJournal = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
)
const IconDB = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
)
const IconLogout = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
)
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
      <span className={active ? 'text-white' : 'text-gray-400 group-hover:text-[#8B1A1A]'}>{icon}</span>
      {label}
    </Link>
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
        supabase.from('rooms').select('*').order('type').order('name'),
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

        <NavItem href="/dashboard"  icon={<IconHome />}      label="Trang chủ"           pathname={pathname} onClose={onClose} />
        <NavItem href="/clients"    icon={<IconStore />}     label="Danh sách công ty"   pathname={pathname} onClose={onClose} />
        <NavItem href="/checklist"  icon={<IconClipboard />} label="Checklist công việc" pathname={pathname} onClose={onClose} />
        <NavItem href="/my-debt"    icon={<IconCoin />}      label="Quản lý công nợ"     pathname={pathname} onClose={onClose} />
        {/* Nhật ký làm việc: để ở menu chính cho người KHÔNG có mục Quản trị (nhân viên/trưởng phòng);
            với tài khoản quản trị thì hiện trong mục Quản trị bên dưới cho đồng bộ */}
        {!showAdminSection && (
          <NavItem href="/work-log" icon={<IconJournal />}  label="Nhật ký làm việc"    pathname={pathname} onClose={onClose} />
        )}

        {canViewKpi && (
          <NavItem href="/report" icon={<IconChart />} label="Báo cáo KPI" pathname={pathname} onClose={onClose} />
        )}
        {isManager && (
          <NavItem href="/staff" icon={<IconPeople />} label="Nhân viên Savitax" pathname={pathname} onClose={onClose} />
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
                <span className={pathname === '/rooms' || onRoomPage ? 'text-white' : 'text-gray-400'}>
                  <IconBuilding />
                </span>
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

        {/* Admin section */}
        {showAdminSection && (
          <div className="pt-3">
            <div className="flex items-center gap-2 px-3 pb-2">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #C9A84C60, transparent)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A84C' }}>Quản trị</p>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, #C9A84C60, transparent)' }} />
            </div>
            {canManageRooms && (
              <NavItem href="/admin/rooms"     icon={<IconBuilding />}   label="Quản lý phòng ban"     pathname={pathname} onClose={onClose} />
            )}
            {canManageStaff && (
              <NavItem href="/admin/staff"     icon={<IconUsers />}      label="Quản lý nhân viên"     pathname={pathname} onClose={onClose} />
            )}
            {canManageClients && (
              <NavItem href="/admin/clients"   icon={<IconBriefcase />}  label="Quản lý khách hàng"   pathname={pathname} onClose={onClose} />
            )}
            {canManageChecklist && (
              <NavItem href="/admin/checklist" icon={<IconClipboard />}  label="Checklist mẫu"         pathname={pathname} onClose={onClose} />
            )}
            {canViewAllDebt && (
              <NavItem href="/debt"            icon={<IconCoin />}       label="Công nợ toàn công ty"  pathname={pathname} onClose={onClose} />
            )}
            <NavItem href="/work-log"          icon={<IconJournal />}    label="Nhật ký làm việc"      pathname={pathname} onClose={onClose} />
            {canManageRoles && (
              <NavItem href="/admin/roles"     icon={<IconUsers />}      label="Vai trò & phân quyền"  pathname={pathname} onClose={onClose} />
            )}
            {canManageDatabase && (
              <NavItem href="/admin/migrate"   icon={<IconDB />}         label="Cài đặt Database"      pathname={pathname} onClose={onClose} />
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
            <IconLogout />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
