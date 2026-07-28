'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { hasPermission } from '@/lib/permissions'

function RoomItem({ room, count, isEditing, editName, onEditStart, onSave, onCancel, onNameChange, onDelete }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {isEditing ? (
        <>
          <input
            autoFocus value={editName}
            onChange={e => onNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
            className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={onSave} className="text-sm text-blue-600 font-medium hover:underline">Lưu</button>
          <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">Hủy</button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">Phòng {room.name}</p>
              {room.type === 'remote' && (
                <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">Remote</span>
              )}
            </div>
            <p className="text-xs text-gray-400">{count} nhân viên</p>
          </div>
          <button onClick={onEditStart} className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
            Sửa
          </button>
          <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors">
            Xóa
          </button>
        </>
      )}
    </div>
  )
}

export default function AdminRoomsPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState([])
  const [staffCounts, setStaffCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'main' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const load = async () => {
    const [roomsRes, staffRes] = await Promise.all([
      fetch('/api/admin/rooms', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/staff', { cache: 'no-store' }).then(r => r.json()),
    ])
    setRooms(roomsRes.data ?? [])
    const counts = {}
    for (const s of (staffRes.data ?? [])) counts[s.room_id] = (counts[s.room_id] ?? 0) + 1
    setStaffCounts(counts)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) { router.push('/login'); return }
      const { data: me } = await supabase.from('staff').select('role').eq('id', session.user.id).single()
      const allowed = await hasPermission(me?.role, 'manage_rooms')
      if (!allowed) { router.push('/dashboard'); return }
      await load()
      setLoading(false)
    }
    init()
  }, [router])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), type: form.type }),
    })
    const json = await res.json()
    if (json.error) setError(json.error)
    else { setForm({ name: '', type: 'main' }); setShowForm(false); await load() }
    setSaving(false)
  }

  const saveEdit = async (id) => {
    if (!editName.trim()) return
    const res = await fetch('/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName.trim() }),
    })
    const json = await res.json()
    if (json.error) setError(json.error)
    setEditingId(null)
    await load()
  }

  const handleDelete = async (room) => {
    if ((staffCounts[room.id] ?? 0) > 0) {
      setError(`Không thể xóa phòng ${room.name} vì đang có nhân viên`)
      return
    }
    if (!confirm(`Xóa phòng "${room.name}"?`)) return
    const res = await fetch('/api/admin/rooms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: room.id }),
    })
    const json = await res.json()
    if (json.error) setError(json.error)
    await load()
  }

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )

  const mainRooms = rooms.filter(r => r.type !== 'remote')
  const remoteRooms = rooms.filter(r => r.type === 'remote')

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý phòng ban</h1>
            <p className="text-sm text-gray-500 mt-0.5">{rooms.length} phòng</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError('') }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            + Thêm phòng
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
        )}

        {showForm && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Thêm phòng mới</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tên phòng</label>
                <input
                  type="text" required autoFocus value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Himalaya, Everest..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Loại</label>
                <div className="flex gap-2">
                  {[{ v: 'main', l: 'Văn phòng' }, { v: 'remote', l: 'Remote' }].map(o => (
                    <button
                      key={o.v} type="button"
                      onClick={() => setForm(f => ({ ...f, type: o.v }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        form.type === o.v
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Đang lưu...' : 'Tạo phòng'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {mainRooms.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Văn phòng</p>
            <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
              {mainRooms.map(r => (
                <RoomItem
                  key={r.id} room={r}
                  count={staffCounts[r.id] ?? 0}
                  isEditing={editingId === r.id}
                  editName={editName}
                  onEditStart={() => { setEditingId(r.id); setEditName(r.name) }}
                  onSave={() => saveEdit(r.id)}
                  onCancel={() => setEditingId(null)}
                  onNameChange={setEditName}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </div>
          </div>
        )}

        {remoteRooms.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Remote</p>
            <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
              {remoteRooms.map(r => (
                <RoomItem
                  key={r.id} room={r}
                  count={staffCounts[r.id] ?? 0}
                  isEditing={editingId === r.id}
                  editName={editName}
                  onEditStart={() => { setEditingId(r.id); setEditName(r.name) }}
                  onSave={() => saveEdit(r.id)}
                  onCancel={() => setEditingId(null)}
                  onNameChange={setEditName}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
