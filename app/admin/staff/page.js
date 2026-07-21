'use client'
import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { hasPermission } from '@/lib/permissions'

const ROLE_BADGE_FALLBACK = [
  'bg-purple-100 text-purple-700', 'bg-blue-100 text-blue-700',
  'bg-gray-100 text-gray-600', 'bg-orange-100 text-orange-600',
  'bg-teal-100 text-teal-700', 'bg-pink-100 text-pink-700',
]
const roleBadgeColor = (roleId, roleOpts) => {
  const idx = roleOpts.findIndex(r => r.v === roleId)
  return ROLE_BADGE_FALLBACK[idx % ROLE_BADGE_FALLBACK.length] || ROLE_BADGE_FALLBACK[0]
}

export default function AdminStaffPage() {
  const router = useRouter()
  const [myRole, setMyRole]       = useState(null)
  const [myRoomId, setMyRoomId]   = useState(null)
  const [staffList, setStaffList] = useState([])
  const [rooms, setRooms]         = useState([])
  const [clientCounts, setClientCounts] = useState({})
  const [loading, setLoading]     = useState(true)
  const [filterRoom, setFilterRoom] = useState('')
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ full_name:'', email:'', password:'', phone:'', room_id:'', role:'staff' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  // Inline edit state
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState({})
  // Reset password
  const [resetId, setResetId]     = useState(null)
  const [resetPass, setResetPass] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetMsg, setResetMsg]   = useState({}) // staffId -> message
  const [roleOpts, setRoleOpts]   = useState([]) // [{v, l}] tải động từ bảng roles

  const isAdmin = myRole === 'admin'

  const loadData = async (supabase, roomId, role) => {
    let query = supabase
      .from('staff')
      .select('*, rooms(name)')
      .order('full_name')
    // Leader chỉ thấy nhân viên phòng mình
    if (role !== 'admin' && roomId) {
      query = query.eq('room_id', roomId)
    }
    const { data: sl } = await query
    setStaffList(sl ?? [])

    const { data: clientData } = await supabase
      .from('clients').select('assigned_to').eq('is_active', true)
    const counts = {}
    for (const c of (clientData ?? [])) {
      counts[c.assigned_to] = (counts[c.assigned_to] ?? 0) + 1
    }
    setClientCounts(counts)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) { router.push('/login'); return }

      const { data: me } = await supabase
        .from('staff').select('role, room_id').eq('id', session.user.id).single()
      const role   = me?.role
      const roomId = me?.room_id
      setMyRole(role)
      setMyRoomId(roomId)

      const allowed = await hasPermission(role, 'manage_staff')
      if (!allowed) { router.push('/dashboard'); return }

      const [, resRooms, resRoles] = await Promise.all([
        loadData(supabase, roomId, role),
        supabase.from('rooms').select('*').order('name'),
        fetch('/api/admin/roles').then(r => r.json()),
      ])
      setRooms(resRooms.data ?? [])
      setRoleOpts((resRoles.data || []).map(r => ({ v: r.id, l: r.label })))
      setLoading(false)
    }
    init()
  }, [router])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/create-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setSuccess('Đã tạo tài khoản cho ' + form.full_name)
      setForm({ full_name:'', email:'', password:'', phone:'', room_id:'', role:'staff' })
      setShowForm(false)
      const supabase = createClient()
      await loadData(supabase, myRoomId, myRole)
    }
    setSaving(false)
  }

  const saveEdit = async (id) => {
    const supabase = createClient()
    // Email/tên/SĐT phải đi qua API admin để đồng bộ với tài khoản Auth thật —
    // sửa trực tiếp bảng staff sẽ không đổi được email đăng nhập.
    const res = await fetch('/api/admin/update-staff-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: id, email: editForm.email, full_name: editForm.full_name, phone: editForm.phone }),
    })
    const json = await res.json()
    if (json.error) { setError(json.error); return }
    // room_id/role đi qua API admin/staff (đã kiểm tra quyền server-side), không ghi thẳng bằng anon key.
    const res2 = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, room_id: editForm.room_id || null, role: editForm.role }),
    })
    const json2 = await res2.json()
    if (json2.error) { setError(json2.error); return }
    setError('')
    setEditId(null)
    await loadData(supabase, myRoomId, myRole)
  }

  const toggleActive = async (s) => {
    const supabase = createClient()
    await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
    })
    await loadData(supabase, myRoomId, myRole)
  }

  const changeRole = async (id, newRole) => {
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole }),
    })
    const json = await res.json()
    if (json.error) { setError(json.error); return }
    setStaffList(sl => sl.map(s => s.id === id ? { ...s, role: newRole } : s))
  }

  const deleteStaff = async (s) => {
    if (!confirm('Xóa nhân viên "' + s.full_name + '"? Hành động này không thể hoàn tác.')) return
    const res = await fetch('/api/admin/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id }),
    })
    const json = await res.json()
    if (json.error) { setError('Lỗi xóa: ' + json.error); return }
    const supabase = createClient()
    await loadData(supabase, myRoomId, myRole)
  }

  const submitReset = async (staffId) => {
    if (resetPass.length < 6) {
      setResetMsg(m => ({ ...m, [staffId]: 'Mật khẩu phải có ít nhất 6 ký tự' }))
      return
    }
    setResetSaving(true)
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, newPassword: resetPass }),
    })
    const json = await res.json()
    setResetMsg(m => ({ ...m, [staffId]: json.error || 'Đã đặt lại mật khẩu thành công!' }))
    if (!json.error) { setResetId(null); setResetPass('') }
    setResetSaving(false)
  }

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )

  const displayed = staffList.filter(s => {
    const matchRoom   = !filterRoom || s.room_id === filterRoom
    const matchSearch = !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.phone ?? '').includes(search)
    return matchRoom && matchSearch
  })

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý nhân viên</h1>
            <p className="text-sm text-gray-500 mt-0.5">{staffList.length} nhân viên</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(v => !v); setError(''); setSuccess('') }}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              + Thêm nhân viên
            </button>
          )}
        </div>

        {/* Feedback */}
        {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4">{success}</div>}

        {/* Add form */}
        {showForm && isAdmin && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Thêm nhân viên mới</h2>
            <form onSubmit={handleAdd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Họ và tên</label>
                  <input type="text" required value={form.full_name}
                    onChange={e => setForm(v => ({ ...v, full_name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input type="email" required value={form.email}
                    onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
                    placeholder="nv@savitax.vn"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mật khẩu tạm</label>
                  <input type="password" required value={form.password}
                    onChange={e => setForm(v => ({ ...v, password: e.target.value }))}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Số điện thoại</label>
                  <input type="tel" value={form.phone}
                    onChange={e => setForm(v => ({ ...v, phone: e.target.value }))}
                    placeholder="0901234567"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Phòng ban{form.role !== 'admin' && ' *'}
                  </label>
                  <select required={form.role !== 'admin'} value={form.room_id} onChange={e => setForm(v => ({ ...v, room_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{form.role === 'admin' ? 'Không cần chọn phòng' : 'Chọn phòng'}</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Vai trò</label>
                  <select value={form.role} onChange={e => setForm(v => ({ ...v, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {roleOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="text" placeholder="🔍 Tìm tên, email, SĐT..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {isAdmin && (
            <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả phòng</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Phòng {r.name}</option>)}
            </select>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Họ tên', 'Email / SĐT', 'Phòng', 'Vai trò', 'Số CT', 'Trạng thái', ''].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                      Không có nhân viên nào
                    </td>
                  </tr>
                )}
                {displayed.map(s => {
                  const isEditing = editId === s.id
                  return (
                    <Fragment key={s.id}>
                    <tr className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>

                      {/* Tên */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                            className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-blue-600">{s.full_name?.charAt(0)}</span>
                            </div>
                            <span className="font-medium text-gray-900 whitespace-nowrap">{s.full_name}</span>
                          </div>
                        )}
                      </td>

                      {/* Email / SĐT */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                              placeholder="Email"
                              className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none" />
                            <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                              placeholder="SĐT"
                              className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none" />
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-700">{s.email}</p>
                            {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                          </div>
                        )}
                      </td>

                      {/* Phòng */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing && isAdmin ? (
                          <select value={editForm.room_id || ''} onChange={e => setEditForm(f => ({ ...f, room_id: e.target.value }))}
                            className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none">
                            <option value="">{editForm.role === 'admin' ? 'Không cần chọn phòng' : 'Chọn phòng'}</option>
                            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-600">{s.rooms?.name ?? '—'}</span>
                        )}
                      </td>

                      {/* Vai trò — dropdown thay đổi ngay */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                            className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none">
                            {roleOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        ) : (
                          <select
                            value={s.role}
                            onChange={e => changeRole(s.id, e.target.value)}
                            className={'text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ' + (roleBadgeColor(s.role, roleOpts))}
                          >
                            {roleOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        )}
                      </td>

                      {/* Số công ty */}
                      <td className="px-4 py-3 text-center text-gray-600">
                        {clientCounts[s.id] ?? 0}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {s.is_active !== false ? 'Hoạt động' : 'Vô hiệu'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(s.id)}
                                className="text-xs text-blue-600 font-medium hover:underline">Lưu</button>
                              <button onClick={() => { setEditId(null); setError('') }}
                                className="text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                            </div>
                            {error && <span className="text-xs text-red-500">{error}</span>}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditId(s.id); setError(''); setEditForm({ email: s.email, full_name: s.full_name, phone: s.phone ?? '', room_id: s.room_id, role: s.role }) }}
                              className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => toggleActive(s)}
                              className={'text-xs px-2 py-1 rounded transition-colors ' + (s.is_active !== false
                                ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50')}
                            >
                              {s.is_active !== false ? 'Vô hiệu hóa' : 'Kích hoạt'}
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => { setResetId(s.id); setResetPass(''); setResetMsg(m => ({ ...m, [s.id]: '' })) }}
                                className="text-xs text-gray-500 hover:text-amber-600 px-2 py-1 rounded hover:bg-amber-50 transition-colors"
                              >
                                Đặt lại MK
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => deleteStaff(s)}
                                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {resetId === s.id && (
                      <tr className="bg-amber-50/40">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-600 font-medium">Đặt lại mật khẩu cho {s.full_name}:</span>
                            <input type="password" value={resetPass} autoFocus
                              onChange={e => setResetPass(e.target.value)}
                              placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                              className="px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none w-56" />
                            <button onClick={() => submitReset(s.id)} disabled={resetSaving}
                              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium">
                              {resetSaving ? 'Đang lưu...' : '✓ Xác nhận'}
                            </button>
                            <button onClick={() => { setResetId(null); setResetPass('') }}
                              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                              Hủy
                            </button>
                            {resetMsg[s.id] && (
                              <span className={'text-xs font-medium ' + (resetMsg[s.id].includes('thành công') ? 'text-green-600' : 'text-red-500')}>
                                {resetMsg[s.id]}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
