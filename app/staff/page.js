'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { hasPermission } from '@/lib/permissions'

const POSITION_OPTS = [
  { v: 'leader',    l: 'Trưởng Phòng' },
  { v: 'staff',     l: 'Chuyên viên' },
  { v: 'intern',    l: 'Thực tập' },
  { v: 'trainee',   l: 'Học việc' },
  { v: 'probation', l: 'Thử việc' },
]

const POSITION_BADGE = {
  admin:     'bg-purple-100 text-purple-700',
  leader:    'bg-blue-100 text-blue-700',
  staff:     'bg-green-100 text-green-700',
  intern:    'bg-yellow-100 text-yellow-700',
  trainee:   'bg-orange-100 text-orange-700',
  probation: 'bg-red-100 text-red-600',
  collab:    'bg-gray-100 text-gray-600',
}

const POSITION_LABEL = {
  admin:     'Quản trị viên',
  leader:    'Trưởng Phòng',
  staff:     'Chuyên viên',
  intern:    'Thực tập',
  trainee:   'Học việc',
  probation: 'Thử việc',
  collab:    'Cộng tác viên',
}

function StaffCard({ s, rooms, isEditing, editForm, onEditStart, onEditChange, onSave, onCancel, onDelete, isAdmin }) {
  if (isEditing) {
    return (
      <div className="bg-white border border-blue-200 shadow-sm rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-600">
              {(editForm.full_name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <input
            value={editForm.full_name}
            onChange={e => onEditChange({ ...editForm, full_name: e.target.value })}
            placeholder="Họ và tên"
            className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Số điện thoại</label>
          <input
            value={editForm.phone}
            onChange={e => onEditChange({ ...editForm, phone: e.target.value })}
            placeholder="0901234567"
            className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Phòng ban</label>
            <select
              value={editForm.room_id}
              onChange={e => onEditChange({ ...editForm, room_id: e.target.value })}
              className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Chọn phòng</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Chức vụ</label>
            {isAdmin ? (
              <select
                value={editForm.role}
                onChange={e => onEditChange({ ...editForm, role: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {POSITION_OPTS.map(o => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            ) : (
              <p className="px-2 py-1.5 text-sm text-gray-600">{POSITION_LABEL[s.role] || s.role}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onSave}
            className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Lưu
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  const badgeClass = POSITION_BADGE[s.role] || POSITION_BADGE.staff
  const label = POSITION_LABEL[s.role] || s.role

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-blue-600">
            {(s.full_name || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.full_name}</p>
              <span className={'inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ' + badgeClass}>
                {label}
              </span>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={onEditStart}
                className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Sửa
              </button>
              <button
                onClick={onDelete}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-500 truncate">{s.email}</p>
            {s.phone ? <p className="text-xs text-gray-500">{s.phone}</p> : null}
            {s.rooms && s.rooms.name ? (
              <p className="text-xs text-gray-400">Phòng {s.rooms.name}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const router = useRouter()
  const [staffList, setStaffList] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', room_id: '', role: 'staff' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', room_id: '', role: 'staff' })
  const [isAdmin, setIsAdmin] = useState(false)

  const loadStaff = async () => {
    const res = await fetch('/api/admin/staff')
    const json = await res.json()
    if (json.error) {
      setError('Lỗi tải danh sách: ' + json.error)
    } else {
      setStaffList(json.data || [])
    }
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) { router.push('/login'); return }

      const { data: me } = await supabase.from('staff').select('role').eq('id', session.user.id).single()
      const allowed = await hasPermission(me?.role, 'manage_staff')
      if (!allowed) { router.push('/dashboard'); return }
      setIsAdmin(me?.role === 'admin')

      const [, resRooms] = await Promise.all([
        loadStaff(),
        supabase.from('rooms').select('*').order('name'),
      ])
      setRooms(resRooms.data || [])
      setLoading(false)
    }
    init()
  }, [router])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/admin/create-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setSuccess('Đã thêm: ' + form.full_name)
      setForm({ full_name: '', email: '', password: '', phone: '', room_id: '', role: 'staff' })
      setShowForm(false)
      await loadStaff()
    }
    setSaving(false)
  }

  const deleteStaff = async (s) => {
    if (!confirm('Xóa nhân viên "' + s.full_name + '"? Hành động này không thể hoàn tác.')) return
    const res = await fetch('/api/admin/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id }),
    })
    const json = await res.json()
    if (json.error) {
      setError('Lỗi xóa: ' + json.error)
      return
    }
    await loadStaff()
  }

  const startEdit = (s) => {
    setEditId(s.id)
    setEditForm({
      full_name: s.full_name || '',
      phone: s.phone || '',
      room_id: s.room_id || '',
      role: s.role || 'staff',
    })
  }

  const saveEdit = async (id) => {
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        full_name: editForm.full_name,
        room_id: editForm.room_id,
        role: editForm.role,
      }),
    })
    const json = await res.json()
    if (json.error) {
      setError('Lỗi cập nhật: ' + json.error)
      return
    }
    setEditId(null)
    await loadStaff()
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-64">
          <p className="text-gray-400 text-sm">Đang tải...</p>
        </div>
      </AppShell>
    )
  }

  const displayed = staffList.filter(s => {
    const matchRoom = !filterRoom || s.room_id === filterRoom
    const q = search.toLowerCase()
    const matchSearch = !search ||
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(search)
    return matchRoom && matchSearch
  })

  const grouped = rooms.map(r => ({
    room: r,
    staff: displayed.filter(s => s.room_id === r.id),
  })).filter(g => g.staff.length > 0)

  const noRoom = displayed.filter(s => !s.room_id)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nhân viên Savitax</h1>
            <p className="text-sm text-gray-500 mt-0.5">{staffList.length} nhân viên</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium flex-shrink-0"
          >
            + Thêm nhân viên
          </button>
        </div>

        {success && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4">{success}</div>
        )}

        {showForm && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Thêm nhân viên mới</h2>
            <form onSubmit={handleAdd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Họ và tên *</label>
                  <input type="text" required value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Nguyễn Thị A"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email *</label>
                  <input type="email" required value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="nv@savitax.vn"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mật khẩu tạm *</label>
                  <input type="password" required value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Số điện thoại</label>
                  <input type="tel" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="0901234567"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phòng ban *</label>
                  <select required value={form.room_id}
                    onChange={e => setForm({ ...form, room_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Chọn phòng ban</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Chức vụ</label>
                  <select value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {POSITION_OPTS.map(o => (
                      <option key={o.v} value={o.v}>{o.l}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>
              )}
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

        <div className="flex flex-wrap gap-2 mb-5">
          <input type="text"
            placeholder="Tìm tên, email, số điện thoại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterRoom}
            onChange={e => setFilterRoom(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả phòng</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Không tìm thấy nhân viên nào
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(g => (
              <div key={g.room.id}>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                  Phòng {g.room.name} ({g.staff.length} người)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.staff.map(s => (
                    <StaffCard
                      key={s.id}
                      s={s}
                      rooms={rooms}
                      isEditing={editId === s.id}
                      editForm={editForm}
                      onEditStart={() => startEdit(s)}
                      onEditChange={setEditForm}
                      onSave={() => saveEdit(s.id)}
                      onCancel={() => setEditId(null)}
                      onDelete={() => deleteStaff(s)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </div>
            ))}

            {noRoom.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                  Chưa có phòng ban ({noRoom.length} người)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {noRoom.map(s => (
                    <StaffCard
                      key={s.id}
                      s={s}
                      rooms={rooms}
                      isEditing={editId === s.id}
                      editForm={editForm}
                      onEditStart={() => startEdit(s)}
                      onEditChange={setEditForm}
                      onSave={() => saveEdit(s.id)}
                      onCancel={() => setEditId(null)}
                      onDelete={() => deleteStaff(s)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
