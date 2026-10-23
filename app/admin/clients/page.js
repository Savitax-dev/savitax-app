'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { hasPermission } from '@/lib/permissions'
import { layQuyenLuong } from '@/lib/khoiDong'

const STATUS_OPTS = [
  { v: 'pending',     l: 'Trình ký' },
  { v: 'active',      l: 'Đang sử dụng' },
  { v: 'inactive',    l: 'Ngưng dịch vụ' },
  { v: 'transferred', l: 'Chuyển NV' },
]
const STATUS_COLOR = {
  pending:     'bg-amber-100 text-amber-700',
  active:      'bg-green-100 text-green-700',
  inactive:    'bg-gray-100 text-gray-500',
  transferred: 'bg-orange-100 text-orange-600',
}
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

export default function AdminClientsPage() {
  const router = useRouter()
  const [myRole, setMyRole]       = useState(null)
  const [myRoomId, setMyRoomId]   = useState(null)
  const [clients, setClients]     = useState([])
  const [staffList, setStaffList] = useState([])
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterRoom, setFilterRoom]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStaff, setFilterStaff]   = useState('')   // id nhân viên phụ trách CHÍNH
  const [filterReport, setFilterReport] = useState('')   // 'monthly' | 'quarterly'
  const [filterGt, setFilterGt]         = useState('')   // người giới thiệu: '' | 'co' | 'khong' | staff id
  // Hoa hồng giới thiệu (sql/39): chỉ quản trị / kế toán nội bộ (manage_payroll) được ghi người giới thiệu.
  const [suaGt, setSuaGt]   = useState(false)
  const [gtDang, setGtDang] = useState(null)           // { id, staffId, tuThang } đang sửa
  const [gtLoi, setGtLoi]   = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ name:'', tax_code:'', assigned_to:'', report_type:'monthly', monthly_fee:'', status:'active' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  // Inline edit
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState({})
  const [secondaryMap, setSecondaryMap] = useState({}) // clientId -> [{id, staff_id, staff:{full_name,...}}]
  const [addSecondaryFor, setAddSecondaryFor] = useState(null) // clientId đang mở dropdown thêm NV phụ
  const [secondaryPick, setSecondaryPick] = useState('')

  const isAdmin = myRole === 'admin'

  const loadClients = async (supabase, roomId, role) => {
    // Đọc qua API máy chủ (AGENTS.md: không đọc nghiệp vụ bằng anon key). 23/10/2026: câu embed
    // clients→staff qua anon key từng ra 0 công ty khi bảng clients có thêm khoá ngoại sang staff.
    const res = await fetch('/api/admin/clients', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    let data = json.data ?? []
    if (role !== 'admin' && roomId) {
      // Leader: chỉ thấy công ty do nhân viên phòng mình phụ trách chính (như trước).
      const { data: staffInRoom } = await supabase.from('staff').select('id').eq('room_id', roomId)
      const ids = new Set((staffInRoom ?? []).map(s => s.id))
      if (ids.size > 0) data = data.filter(c => ids.has(c.assigned_to))
    }
    data.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'))
    setClients(data)

    // Load nhân viên phụ cho toàn bộ công ty đang hiện
    const { data: secRows } = await supabase
      .from('client_secondary_staff')
      .select('id, client_id, staff_id, staff:staff_id(id, full_name, room_id, rooms(name))')
    const map = {}
    for (const r of (secRows || [])) {
      if (!map[r.client_id]) map[r.client_id] = []
      map[r.client_id].push(r)
    }
    setSecondaryMap(map)
  }

  const addSecondary = async (clientId) => {
    if (!secondaryPick) return
    const supabase = createClient()
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/client-secondary-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, staffId: secondaryPick, addedBy: sd.session?.user?.id || null }),
    })
    const json = await res.json()
    if (json.error) { setError(json.error); return }
    setAddSecondaryFor(null); setSecondaryPick(''); setError('')
    await loadClients(supabase, myRoomId, myRole)
  }

  const removeSecondary = async (id) => {
    await fetch('/api/admin/client-secondary-staff?id=' + id, { method: 'DELETE' })
    await loadClients(createClient(), myRoomId, myRole)
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

      const allowed = await hasPermission(role, 'manage_clients')
      if (!allowed) { router.push('/dashboard'); return }

      const [, resStaff, resRooms] = await Promise.all([
        loadClients(supabase, roomId, role),
        supabase.from('staff').select('id, full_name, room_id, rooms(name)').order('full_name'),
        supabase.from('rooms').select('*').order('name'),
      ])
      setStaffList(resStaff.data ?? [])
      setRooms(resRooms.data ?? [])
      layQuyenLuong().then(j => setSuaGt(!!j.manage)).catch(() => {})
      setLoading(false)
    }
    init()
  }, [router])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { error: err } = await supabase.from('clients').insert({
      name: form.name,
      tax_code: form.tax_code,
      assigned_to: form.assigned_to,
      report_type: form.report_type,
      monthly_fee: Number(form.monthly_fee) || 0,
      status: form.status,
      is_active: form.status === 'active',
    })
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Đã thêm công ty ' + form.name)
      setForm({ name:'', tax_code:'', assigned_to:'', report_type:'monthly', monthly_fee:'', status:'active' })
      setShowForm(false)
      await loadClients(createClient(), myRoomId, myRole)
    }
    setSaving(false)
  }

  const saveEdit = async (id) => {
    const supabase = createClient()
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name:        editForm.name,
        tax_code:    editForm.tax_code,
        client_code: editForm.client_code,
        assigned_to: editForm.assigned_to,
        report_type: editForm.report_type,
        monthly_fee: Number(editForm.monthly_fee) || 0,
        status:      editForm.status,
        address:     editForm.address,
        updatedBy:   sd.session?.user?.id || null,
      }),
    })
    setEditId(null)
    await loadClients(createClient(), myRoomId, myRole)
  }

  const deleteClient = async (client) => {
    if (!confirm('Xóa "' + client.name + '"?\nToàn bộ dữ liệu checklist, phí, công nợ của công ty này sẽ bị xóa vĩnh viễn.')) return
    await fetch('/api/admin/clients?id=' + client.id, { method: 'DELETE' })
    await loadClients(createClient(), myRoomId, myRole)
  }

  const quickChangeStaff = async (clientId, newStaffId) => {
    const supabase = createClient()
    await supabase.from('clients').update({ assigned_to: newStaffId }).eq('id', clientId)
    setClients(cl => cl.map(c => {
      if (c.id !== clientId) return c
      const newStaff = staffList.find(s => s.id === newStaffId)
      return { ...c, assigned_to: newStaffId, staff: newStaff }
    }))
  }

  const luuGioiThieu = async () => {
    setGtLoi('')
    const res = await fetch('/api/admin/luong', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viec: 'luu_gioi_thieu', clientId: gtDang.id, staffId: gtDang.staffId || null, tuThang: gtDang.tuThang }) })
    const j = await res.json().catch(() => ({ error: 'Lỗi máy chủ' }))
    if (j.error) { setGtLoi(j.error); return }
    setClients(cl => cl.map(c => c.id === gtDang.id ? { ...c, gioi_thieu_boi: gtDang.staffId || null, gioi_thieu_tu: gtDang.staffId ? gtDang.tuThang + '-01' : null } : c))
    setGtDang(null)
  }

  const quickChangeStatus = async (clientId, newStatus) => {
    const supabase = createClient()
    await supabase.from('clients').update({ status: newStatus, is_active: newStatus === 'active' }).eq('id', clientId)
    setClients(cl => cl.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
  }

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )

  const displayed = clients.filter(c => {
    const kw = search.trim().toLowerCase()
    // Tìm cả MÃ KH (vd ARCHCAFE, SPONGEROOM) — trước đây chỉ tìm được tên công ty và MST nên gõ
    // mã ra rỗng, trong khi cột Mã KH hiện ngay đầu bảng.
    const matchSearch = !kw ||
      c.name.toLowerCase().includes(kw) ||
      (c.tax_code ?? '').includes(kw) ||
      (c.client_code ?? '').toLowerCase().includes(kw)
    const matchRoom   = !filterRoom   || c.staff?.room_id === filterRoom
    const matchStatus = !filterStatus || c.status === filterStatus
    const matchStaff  = !filterStaff  || c.assigned_to === filterStaff
    const matchReport = !filterReport || (c.report_type || 'monthly') === filterReport
    const matchGt = !filterGt || (filterGt === 'co' ? !!c.gioi_thieu_boi : filterGt === 'khong' ? !c.gioi_thieu_boi : c.gioi_thieu_boi === filterGt)
    return matchSearch && matchRoom && matchStatus && matchStaff && matchReport && matchGt
  })
  const dangLoc = !!(search.trim() || filterRoom || filterStatus || filterStaff || filterReport || filterGt)
  const clearFilters = () => {
    setSearch(''); setFilterRoom(''); setFilterStatus(''); setFilterStaff(''); setFilterReport(''); setFilterGt('')
  }
  // Người giới thiệu đang có (để lọc) + đếm số công ty mỗi người.
  const tenNv = id => staffList.find(x => x.id === id)?.full_name || '—'
  const demGt = {}
  for (const c of clients) if (c.gioi_thieu_boi) demGt[c.gioi_thieu_boi] = (demGt[c.gioi_thieu_boi] || 0) + 1

  // Staff grouped by room for optgroup
  const staffByRoom = rooms.map(r => ({
    room: r,
    staff: staffList.filter(s => s.room_id === r.id),
  })).filter(g => g.staff.length > 0)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý khách hàng</h1>
            <p className="text-sm text-gray-500 mt-0.5">{clients.length} công ty</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError(''); setSuccess('') }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            + Thêm công ty
          </button>
        </div>

        {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4">{success}</div>}

        {/* Add form */}
        {showForm && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Thêm công ty mới</h2>
            <form onSubmit={handleAdd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tên công ty</label>
                  <input type="text" required value={form.name}
                    onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                    placeholder="Công ty TNHH ABC"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mã số thuế</label>
                  <input type="text" required value={form.tax_code}
                    onChange={e => setForm(v => ({ ...v, tax_code: e.target.value }))}
                    placeholder="0123456789"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nhân viên phụ trách</label>
                  <select required value={form.assigned_to}
                    onChange={e => setForm(v => ({ ...v, assigned_to: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Chọn nhân viên</option>
                    {staffByRoom.map(g => (
                      <optgroup key={g.room.id} label={'Phòng ' + g.room.name}>
                        {g.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Loại báo cáo</label>
                  <select value={form.report_type}
                    onChange={e => setForm(v => ({ ...v, report_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="monthly">Hàng tháng</option>
                    <option value="quarterly">Hàng quý</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phí dịch vụ (đ/tháng)</label>
                  <input type="number" min={0} value={form.monthly_fee}
                    onChange={e => setForm(v => ({ ...v, monthly_fee: e.target.value }))}
                    placeholder="5000000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Trạng thái</label>
                  <select value={form.status}
                    onChange={e => setForm(v => ({ ...v, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Đang lưu...' : 'Thêm công ty'}
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
          <input type="text" placeholder="🔍 Tìm tên công ty, MST hoặc mã KH..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {isAdmin && (
            <select value={filterRoom}
              onChange={e => {
                const v = e.target.value
                setFilterRoom(v)
                // Đổi phòng mà nhân viên đang lọc không thuộc phòng mới -> bỏ chọn, tránh ra
                // danh sách rỗng khó hiểu (ô nhân viên bên dưới cũng chỉ liệt kê người phòng đó).
                if (v && filterStaff && !staffList.some(s => s.id === filterStaff && s.room_id === v)) setFilterStaff('')
              }}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả phòng</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Phòng {r.name}</option>)}
            </select>
          )}
          {/* Chọn phòng rồi thì chỉ liệt kê nhân viên phòng đó; chưa chọn thì nhóm theo phòng. */}
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả nhân viên</option>
            {filterRoom
              ? staffList.filter(s => s.room_id === filterRoom).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)
              : staffByRoom.map(g => (
                  <optgroup key={g.room.id} label={'Phòng ' + g.room.name}>
                    {g.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </optgroup>
                ))}
          </select>
          <select value={filterReport} onChange={e => setFilterReport(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả loại BC</option>
            <option value="monthly">BC Tháng</option>
            <option value="quarterly">BC Quý</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả trạng thái</option>
            {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <select value={filterGt} onChange={e => setFilterGt(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Người giới thiệu: tất cả</option>
            <option value="co">Có người giới thiệu</option>
            <option value="khong">Chưa có người giới thiệu</option>
            {Object.keys(demGt).sort((a, b) => tenNv(a).localeCompare(tenNv(b), 'vi')).map(id => <option key={id} value={id}>{tenNv(id)} ({demGt[id]} cty)</option>)}
          </select>
        </div>

        {/* Số kết quả + xóa lọc — để không ai tưởng "mất công ty" khi quên là đang lọc */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-gray-500">
            Đang xem <span className="font-semibold text-gray-800">{displayed.length}</span>
            {displayed.length !== clients.length && <> / {clients.length}</>} công ty
          </span>
          {dangLoc && (
            <button onClick={clearFilters}
              className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              ✕ Xóa lọc
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {/* 10 cột cũ tràn ngang → gộp còn 6 (anh yêu cầu cân đối trang 23/10/2026) */}
                  {['Công ty', 'NV phụ trách', 'NV phụ', 'Giới thiệu', 'Báo cáo · Phí', 'Trạng thái', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Không có công ty nào</td>
                  </tr>
                )}
                {displayed.map(c => {
                  const isEditing = editId === c.id
                  return (
                    <tr key={c.id} className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>

                      {/* Công ty: tên + mã KH · MST */}
                      <td className="px-4 py-3 min-w-[260px]">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="Tên công ty" className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none" />
                            <div className="flex gap-1">
                              <input value={editForm.client_code || ''} onChange={e => setEditForm(f => ({ ...f, client_code: e.target.value }))}
                                placeholder="Mã KH" className="w-24 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none font-mono" />
                              <input value={editForm.tax_code} onChange={e => setEditForm(f => ({ ...f, tax_code: e.target.value }))}
                                placeholder="MST" className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none" />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900 leading-snug">{c.name}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                              {c.client_code
                                ? <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 rounded font-mono font-semibold">{c.client_code}</span>
                                : <span className="text-gray-300">chưa có mã</span>}
                              {c.tax_code && <span>MST {c.tax_code}</span>}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* NV phụ trách — dropdown thay đổi ngay */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
                            className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none max-w-36">
                            {staffByRoom.map(g => (
                              <optgroup key={g.room.id} label={g.room.name}>
                                {g.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        ) : (
                          <select value={c.assigned_to || ''} onChange={e => quickChangeStaff(c.id, e.target.value)}
                            className="text-sm text-gray-700 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded max-w-44 truncate -ml-1">
                            {staffByRoom.map(g => (
                              <optgroup key={g.room.id} label={g.room.name}>
                                {g.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        )}
                        <div className="text-xs text-gray-400">{c.staff?.rooms?.name ? 'Phòng ' + c.staff.rooms.name : '—'}</div>
                      </td>

                      {/* NV phụ — có thể nhiều, khác phòng, chỉ theo dõi không tính doanh thu */}
                      <td className="px-4 py-3 min-w-44">
                        <div className="flex flex-wrap gap-1 items-center">
                          {(secondaryMap[c.id] || []).map(row => (
                            <span key={row.id} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                              {row.staff?.full_name || '—'}
                              <button onClick={() => removeSecondary(row.id)} className="text-amber-400 hover:text-red-500 leading-none">×</button>
                            </span>
                          ))}
                          {addSecondaryFor === c.id ? (
                            <div className="flex items-center gap-1">
                              <select value={secondaryPick} onChange={e => setSecondaryPick(e.target.value)} autoFocus
                                className="text-xs px-1.5 py-1 border border-amber-300 rounded focus:outline-none max-w-28">
                                <option value="">-- Chọn --</option>
                                {staffByRoom.map(g => (
                                  <optgroup key={g.room.id} label={g.room.name}>
                                    {g.staff.filter(s => s.id !== c.assigned_to && !(secondaryMap[c.id] || []).some(r => r.staff_id === s.id))
                                      .map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                              <button onClick={() => addSecondary(c.id)} className="text-xs text-green-600 font-medium hover:underline">✓</button>
                              <button onClick={() => { setAddSecondaryFor(null); setSecondaryPick('') }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setAddSecondaryFor(c.id); setSecondaryPick('') }}
                              className="text-xs text-amber-600 hover:underline flex-shrink-0">+ Thêm</button>
                          )}
                        </div>
                      </td>

                      {/* Người giới thiệu — hoa hồng giới thiệu (sql/39). Chỉ manage_payroll sửa. */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {gtDang?.id === c.id ? (
                          <div className="space-y-1">
                            <select value={gtDang.staffId} onChange={e => setGtDang(v => ({ ...v, staffId: e.target.value }))}
                              className="block px-2 py-1 border border-emerald-300 rounded text-xs focus:outline-none max-w-44">
                              <option value="">— Không có —</option>
                              {staffByRoom.map(g => (
                                <optgroup key={g.room.id} label={g.room.name}>
                                  {g.staff.map(st => <option key={st.id} value={st.id}>{st.full_name}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            {gtDang.staffId && <input type="month" value={gtDang.tuThang} onChange={e => setGtDang(v => ({ ...v, tuThang: e.target.value }))}
                              title="Hưởng hoa hồng từ tháng" className="block px-2 py-0.5 border border-emerald-300 rounded text-xs" />}
                            <div className="flex gap-2">
                              <button onClick={luuGioiThieu} className="text-xs text-emerald-700 font-semibold hover:underline">Lưu</button>
                              <button onClick={() => { setGtDang(null); setGtLoi('') }} className="text-xs text-gray-400">Hủy</button>
                            </div>
                            {gtLoi && <div className="text-xs text-red-600 whitespace-normal max-w-44">{gtLoi}</div>}
                          </div>
                        ) : c.gioi_thieu_boi ? (
                          <div>
                            <div className="text-sm text-emerald-800">🤝 {tenNv(c.gioi_thieu_boi)}</div>
                            <div className="text-xs text-gray-400">từ {String(c.gioi_thieu_tu || '').slice(5, 7)}/{String(c.gioi_thieu_tu || '').slice(0, 4)}
                              {suaGt && <button onClick={() => setGtDang({ id: c.id, staffId: c.gioi_thieu_boi, tuThang: String(c.gioi_thieu_tu || '').slice(0, 7) })} className="ml-1.5 text-emerald-700 hover:underline">Đổi</button>}</div>
                          </div>
                        ) : suaGt ? (
                          <button onClick={() => { const n = new Date(Date.now() + 7 * 3600e3); setGtDang({ id: c.id, staffId: '', tuThang: n.toISOString().slice(0, 7) }) }}
                            className="text-xs text-emerald-700 hover:underline">+ Ghi người giới thiệu</button>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Báo cáo · Phí */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <div className="space-y-1">
                            <select value={editForm.report_type} onChange={e => setEditForm(f => ({ ...f, report_type: e.target.value }))}
                              className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none">
                              <option value="monthly">BC Tháng</option>
                              <option value="quarterly">BC Quý</option>
                            </select>
                            <input type="number" min={0} value={editForm.monthly_fee}
                              onChange={e => setEditForm(f => ({ ...f, monthly_fee: e.target.value }))}
                              placeholder="Phí" className="block w-32 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none" />
                          </div>
                        ) : (
                          <div>
                            <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (c.report_type === 'quarterly' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-600')}>
                              BC {c.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                            </span>
                            <div className="text-gray-800 mt-1">{fmt(c.monthly_fee)}đ<span className="text-xs text-gray-400">/{c.fee_period === 'quarterly' ? 'Quý' : 'Tháng'}</span></div>
                          </div>
                        )}
                      </td>

                      {/* Trạng thái — dropdown thay đổi ngay */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                            className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none">
                            {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        ) : (
                          <select value={c.status || 'active'} onChange={e => quickChangeStatus(c.id, e.target.value)}
                            className={'text-xs font-medium border-0 cursor-pointer focus:outline-none rounded-full px-2 py-0.5 ' + (STATUS_COLOR[c.status] ?? STATUS_COLOR.active)}>
                            {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(c.id)}
                              className="text-xs text-blue-600 font-medium hover:underline">Lưu</button>
                            <button onClick={() => setEditId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button title="Sửa thông tin công ty"
                              onClick={() => { setEditId(c.id); setEditForm({ name: c.name, tax_code: c.tax_code, client_code: c.client_code || '', assigned_to: c.assigned_to, report_type: c.report_type || 'monthly', monthly_fee: c.monthly_fee || '', status: c.status || 'active', address: c.address || '' }) }}
                              className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors">✎</button>
                            {myRole === 'admin' && (
                              <button title="Xóa công ty" onClick={() => deleteClient(c)}
                                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors">🗑</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
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
