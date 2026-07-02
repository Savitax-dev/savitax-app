'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const STATUS_LABEL = { pending: 'Trình ký', active: 'Đang sử dụng', inactive: 'Ngưng dịch vụ', transferred: 'Đã chuyển đi' }
const STATUS_COLOR = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  transferred: 'bg-orange-100 text-orange-600',
}
const STATUS_OPTS = [
  { v: 'pending', l: 'Trình ký (đang lên hợp đồng)' },
  { v: 'active', l: 'Đang sử dụng' },
  { v: 'inactive', l: 'Ngưng dịch vụ' },
  { v: 'transferred', l: 'Chuyển đi (sang đơn vị khác)' },
]

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

function FeeAdjust({ client, isEditing, feeAmount, feeFromMonth, feeNote, saving, futureMonths, onOpen, onSave, onCancel, onAmountChange, onMonthChange, onNoteChange }) {
  const selectedVal = feeFromMonth || (futureMonths[0] ? futureMonths[0].value : '')
  const selectedLabel = futureMonths.find(x => x.value === selectedVal)
  const feePeriodLabel = (client.fee_period || client.report_type) === 'quarterly' ? 'quý' : 'tháng'

  if (!isEditing) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cập nhật phí dịch vụ</p>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Phí hiện tại</p>
            <p className="text-base font-bold text-gray-900">
              {fmt(client.monthly_fee)}đ
              <span className="text-xs font-normal text-gray-400 ml-1">{'/' + feePeriodLabel}</span>
            </p>
          </div>
          <button onClick={onOpen} className="text-xs text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-1.5 rounded-lg">
            Điều chỉnh
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cập nhật phí dịch vụ</p>
      <div className="space-y-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Phí hiện tại</span>
          <span className="text-sm font-bold text-gray-800">{fmt(client.monthly_fee)}đ</span>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Phí mới (đ)</label>
          <input type="text" inputMode="numeric"
            value={feeAmount ? fmt(Number(feeAmount)) : ''}
            onChange={e => onAmountChange(e.target.value.replace(/\D/g, ''))}
            placeholder={'VD: ' + fmt(client.monthly_fee || 2000000)}
            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Áp dụng từ tháng</label>
          <select value={selectedVal} onChange={e => onMonthChange(e.target.value)}
            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {futureMonths.map(mo => (
              <option key={mo.value} value={mo.value}>{mo.label}</option>
            ))}
          </select>
        </div>
        <input type="text" value={feeNote}
          onChange={e => onNoteChange(e.target.value)}
          placeholder="Ghi chú lý do thay đổi (không bắt buộc)"
          className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        {feeAmount && (
          <div className="bg-white rounded-lg px-3 py-2 border border-blue-200">
            <p className="text-xs text-gray-500">Xác nhận:</p>
            <p className="text-sm font-semibold text-blue-700 mt-0.5">
              {fmt(Number(feeAmount))}đ · áp dụng từ {selectedLabel ? selectedLabel.label : selectedVal}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onSave} disabled={!feeAmount || saving}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Đang lưu...' : '✓ Cập nhật phí'}
          </button>
          <button onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            Hủy
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const [myStaff, setMyStaff] = useState(null)
  const [clients, setClients] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [feeHistory, setFeeHistory] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', tax_code: '', report_type: 'monthly', fee_period: 'monthly', monthly_fee: '', fee_start: '', other_debt: '', assigned_to: '', address: '', tax_status: '', client_code: '', representative: '', status: 'pending', contract_start: '' })
  const [editClientId, setEditClientId] = useState(null)
  const [editClientForm, setEditClientForm] = useState({})
  const [formRoom, setFormRoom] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [feeEdit, setFeeEdit] = useState(null)
  const [feeAmount, setFeeAmount] = useState('')
  const [feeNote, setFeeNote] = useState('')
  const [feeFromMonth, setFeeFromMonth] = useState('')  // "YYYY-MM"
  const [transferEdit, setTransferEdit] = useState(null)
  const [transferTo, setTransferTo] = useState('')
  const [statusEdit, setStatusEdit] = useState(null)
  const [activateMonth, setActivateMonth] = useState('')
  const [assignEdit, setAssignEdit] = useState(null)
  const [assignRoom, setAssignRoom] = useState('')
  const [assignStaff, setAssignStaff] = useState('')
  const [feeCollections, setFeeCollections] = useState({}) // key: clientId_year_month
  const [collectEdit, setCollectEdit] = useState(null) // { clientId, year, month }
  const [collectAmount, setCollectAmount] = useState('')
  const [collectNote, setCollectNote] = useState('')
  const [otherDebtEdit, setOtherDebtEdit] = useState(null) // clientId
  const [otherDebtVal, setOtherDebtVal] = useState('')
  const [secondaryMap, setSecondaryMap] = useState({}) // clientId -> [{id, staff_id, staff:{full_name, rooms}}]
  const [addSecondaryFor, setAddSecondaryFor] = useState(null)
  const [secondaryPick, setSecondaryPick] = useState('')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  // Generate next N months for fee-from picker (current month + future)
  const getFutureMonths = (count) => {
    const result = []
    let y = year, m = month
    for (let i = 0; i < count; i++) {
      result.push({ y, m, label: 'T' + m + '/' + y, value: y + '-' + String(m).padStart(2, '0') })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return result
  }

  // Danh sách tháng cho "Áp dụng từ tháng" khi thêm công ty mới — kết thúc ở hiện tại + 3 tháng,
  // bắt đầu từ 1/2026 (app bắt đầu theo dõi dữ liệu). Tối đa 12 tháng: nếu khoảng 1/2026 → hiện
  // tại+3 vượt quá 12 tháng thì bỏ bớt các tháng cũ nhất (năm/tháng nhỏ nhất) để giữ đúng 12 tháng.
  const getApplyFromMonths = () => {
    const maxCount = 12
    const endIdx = year * 12 + (month - 1) + 3
    const floorIdx = 2026 * 12
    const startIdx = Math.max(floorIdx, endIdx - (maxCount - 1))
    const result = []
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const y = Math.floor(idx / 12)
      const m = (idx % 12) + 1
      result.push({ y, m, label: 'T' + m + '/' + y, value: y + '-' + String(m).padStart(2, '0') })
    }
    return result
  }

  // Generate last N billing months for a company (quarterly = only quarter-end months)
  const getBillingMonths = (reportType, count) => {
    const result = []
    let y = year, m = month
    let iterations = 0
    while (result.length < count && iterations < 36) {
      iterations++
      if (reportType !== 'quarterly' || m % 3 === 0) result.push({ y, m })
      m--
      if (m === 0) { m = 12; y-- }
    }
    return result
  }

  const loadClients = async () => {
    const res = await fetch('/api/admin/clients')
    const json = await res.json()
    if (!json.error) setClients(json.data || [])
  }

  const loadSecondary = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('client_secondary_staff')
      .select('id, client_id, staff_id, staff:staff_id(id, full_name, room_id, rooms(name))')
    const map = {}
    for (const r of (data || [])) {
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
    await loadSecondary()
  }

  const removeSecondary = async (id) => {
    await fetch('/api/admin/client-secondary-staff?id=' + id, { method: 'DELETE' })
    await loadSecondary()
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) { router.push('/login'); return }

      let { data: me } = await supabase
        .from('staff').select('*, rooms(name)').eq('id', session.user.id).single()
      // Fallback: if no staff record or role missing, derive from email/metadata
      if (!me || !me.role) {
        const email = session.user.email || ''
        const metaRole = session.user.user_metadata && session.user.user_metadata.role
        const fallbackRole = metaRole || (email === 'admin@savitax.vn' ? 'admin' : 'staff')
        me = me ? { ...me, role: fallbackRole } : { id: session.user.id, full_name: email.split('@')[0], role: fallbackRole, rooms: null }
      }
      setMyStaff(me)

      const staffRes = await fetch('/api/admin/staff')
      const staffJson = await staffRes.json()
      setAllStaff(staffJson.data || [])

      const [, roomsRes] = await Promise.all([
        loadClients(),
        supabase.from('rooms').select('*').order('name'),
        loadSecondary(),
      ])
      setRooms(roomsRes.data || [])
      setLoading(false)
    }
    init()
  }, [router])

  const loadFeeCollections = async (clientId) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('fee_collections')
      .select('*')
      .eq('client_id', clientId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(24)
    if (data) {
      const entries = {}
      for (const r of data) entries[clientId + '_' + r.year + '_' + r.month] = r
      setFeeCollections(fc => ({ ...fc, ...entries }))
    }
  }

  const loadFeeHistory = async (clientId) => {
    if (feeHistory[clientId]) return
    const supabase = createClient()
    const { data } = await supabase
      .from('service_fees')
      .select('*')
      .eq('client_id', clientId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12)
    setFeeHistory(h => ({ ...h, [clientId]: data || [] }))
  }

  const handleExpand = (id) => {
    const next = expanded === id ? null : id
    setExpanded(next)
    if (next) { loadFeeHistory(next); loadFeeCollections(next) }
    setFeeEdit(null); setTransferEdit(null); setStatusEdit(null); setAssignEdit(null); setCollectEdit(null)
  }

  const handleLookup = async () => {
    if (!form.tax_code) return
    setLookupLoading(true)
    setLookupError('')
    const res = await fetch('/api/lookup-tax?mst=' + form.tax_code.trim())
    const json = await res.json()
    if (json.error) {
      setLookupError(json.error)
    } else {
      setForm(f => ({
        ...f,
        name:           json.name           || f.name,
        address:        json.address        || f.address,
        tax_status:     json.status         || f.tax_status,
        representative: json.representative || f.representative,
      }))
    }
    setLookupLoading(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.assigned_to) { setError('Vui lòng chọn nhân viên phụ trách'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) {
      const msg = data.error.includes('unique') || data.error.includes('23505')
        ? 'MST này đã tồn tại trong hệ thống — thông tin đã được cập nhật.'
        : data.error
      setError(msg)
      setSaving(false)
      return
    }
    setForm({ name: '', tax_code: '', report_type: 'monthly', fee_period: 'monthly', monthly_fee: '', fee_start: '', other_debt: '', assigned_to: '', address: '', tax_status: '', client_code: '', representative: '', status: 'pending', contract_start: '' })
    setLookupError('')
    setFormRoom('')
    setShowForm(false)
    await loadClients()
    setSaving(false)
  }

  const saveFee = async (clientId) => {
    if (!feeAmount) return
    setSaving(true)
    // Parse selected month or fallback to current month
    let effectY = year, effectM = month
    if (feeFromMonth) {
      const parts = feeFromMonth.split('-')
      effectY = Number(parts[0])
      effectM = Number(parts[1])
    }
    await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: clientId,
        monthly_fee: Number(feeAmount),
        fee_history: {
          year: effectY,
          month: effectM,
          amount: Number(feeAmount),
          note: feeNote || ('Cập nhật T' + effectM + '/' + effectY),
        },
      }),
    })
    setFeeEdit(null); setFeeAmount(''); setFeeNote(''); setFeeFromMonth('')
    await loadClients()
    setFeeHistory(h => ({ ...h, [clientId]: null }))
    await loadFeeHistory(clientId)
    setSaving(false)
  }

  const saveTransfer = async (clientId) => {
    if (!transferTo) return
    setSaving(true)
    await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clientId, assigned_to: transferTo }),
    })
    setTransferEdit(null); setTransferTo('')
    await loadClients()
    setSaving(false)
  }

  const saveStatus = async (clientId, newStatus, contractStart) => {
    setSaving(true)
    const payload = { id: clientId, status: newStatus }
    if (contractStart) payload.contract_start = contractStart
    await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setStatusEdit(null); setActivateMonth('')
    await loadClients()
    setSaving(false)
  }

  const saveCollection = async () => {
    if (!collectEdit || !collectAmount || !myStaff) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('fee_collections').upsert({
      client_id: collectEdit.clientId,
      year: collectEdit.year,
      month: collectEdit.month,
      amount: Number(collectAmount),
      note: collectNote || null,
      collected_by: myStaff.id,
      collected_at: new Date().toISOString(),
    }, { onConflict: 'client_id,year,month' }).select().single()
    if (data) {
      const key = collectEdit.clientId + '_' + collectEdit.year + '_' + collectEdit.month
      setFeeCollections(fc => ({ ...fc, [key]: data }))
    }
    setCollectEdit(null); setCollectAmount(''); setCollectNote('')
    setSaving(false)
  }

  const deleteCollection = async (clientId, yr, mn) => {
    const key = clientId + '_' + yr + '_' + mn
    const rec = feeCollections[key]
    if (!rec) return
    const supabase = createClient()
    await supabase.from('fee_collections').delete().eq('id', rec.id)
    setFeeCollections(fc => {
      const next = { ...fc }
      delete next[key]
      return next
    })
  }

  const saveEditClient = async () => {
    if (!editClientId) return
    setSaving(true)
    await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:             editClientId,
        name:           editClientForm.name,
        tax_code:       editClientForm.tax_code,
        address:        editClientForm.address,
        tax_status:     editClientForm.tax_status,
        client_code:    editClientForm.client_code,
        representative: editClientForm.representative,
        contract_start: editClientForm.contract_start || null,
      }),
    })
    setEditClientId(null)
    await loadClients()
    setSaving(false)
  }

  const saveOtherDebt = async (clientId) => {
    setSaving(true)
    await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clientId, other_debt: Number(otherDebtVal) }),
    })
    setOtherDebtEdit(null); setOtherDebtVal('')
    await loadClients()
    setSaving(false)
  }

  const saveAssign = async (clientId) => {
    if (!assignStaff) return
    setSaving(true)
    const res = await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clientId, assigned_to: assignStaff }),
    })
    const json = await res.json()
    if (!json.error) {
      setAssignEdit(null); setAssignRoom(''); setAssignStaff('')
      await loadClients()
    }
    setSaving(false)
  }

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )

  const isAdmin = myStaff && myStaff.role === 'admin'
  const isLeader = myStaff && myStaff.role === 'leader'
  const isManager = myStaff && (myStaff.role === 'admin' || myStaff.role === 'manager' || myStaff.role === 'leader')
  const visibleClients = isAdmin
    ? clients
    : isLeader
      ? clients.filter(c => c.staff && c.staff.room_id === myStaff.room_id)
      : clients.filter(c => c.assigned_to === myStaff?.id)

  const filtered = visibleClients.filter(c => {
    const matchFilter = filter === 'all' || (c.status || 'active') === filter
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.tax_code || '').includes(search)
    return matchFilter && matchSearch
  })

  const counts = {
    all: visibleClients.length,
    pending: visibleClients.filter(c => (c.status || 'active') === 'pending').length,
    active: visibleClients.filter(c => (c.status || 'active') === 'active').length,
    inactive: visibleClients.filter(c => (c.status || 'active') === 'inactive').length,
    transferred: visibleClients.filter(c => (c.status || 'active') === 'transferred').length,
  }

  const formStaff = allStaff.filter(s => !formRoom || s.room_id === formRoom)
  const assignStaffList = allStaff.filter(s => !assignRoom || s.room_id === assignRoom)
  const transferStaff = allStaff.filter(s => s.id !== myStaff?.id)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Danh sách công ty</h1>
            <p className="text-sm text-gray-500 mt-0.5">{visibleClients.length} công ty · {myStaff && myStaff.rooms ? myStaff.rooms.name : ''}</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError('') }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            + Thêm công ty
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Thêm công ty mới</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              {/* 1. Tên công ty */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tên công ty</label>
                <input type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Công ty TNHH ABC"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* 2. MST + Tra cứu */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mã số thuế</label>
                <div className="flex gap-2">
                  <input type="text" required value={form.tax_code}
                    onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))}
                    placeholder="0123456789"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={handleLookup} disabled={!form.tax_code || lookupLoading}
                    className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors flex-shrink-0">
                    {lookupLoading ? '⏳ Đang tra...' : '🔍 Tra cứu'}
                  </button>
                </div>
                {lookupError && <p className="text-xs text-orange-500 mt-1">{lookupError}</p>}
              </div>
              {/* 3. Địa chỉ Thuế */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Địa chỉ Thuế</label>
                <input type="text" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Tự động điền khi tra cứu MST"
                  className={'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ' + (form.address ? 'border-green-300 bg-green-50' : 'border-gray-200')} />
              </div>
              {/* 4. Tình trạng thuế */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tình trạng thuế</label>
                <input type="text" value={form.tax_status}
                  onChange={e => setForm(f => ({ ...f, tax_status: e.target.value }))}
                  placeholder="Tự động điền khi tra cứu MST"
                  className={'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ' + (form.tax_status ? 'border-green-300 bg-green-50' : 'border-gray-200')} />
              </div>
              {/* Người đại diện */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Người đại diện / Giám đốc
                  <span className="ml-1.5 text-orange-400 font-normal">— nhập tay từ masothue.com</span>
                </label>
                <input type="text" value={form.representative}
                  onChange={e => setForm(f => ({ ...f, representative: e.target.value }))}
                  placeholder="VD: NGUYỄN VĂN A (xem tại masothue.com)"
                  className={'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ' + (form.representative ? 'border-green-300 bg-green-50' : 'border-orange-100 bg-orange-50')} />
                {!form.representative && form.tax_code && (
                  <p className="text-xs text-orange-500 mt-1">
                    👉 Xem tại: <a href={'https://masothue.com/' + form.tax_code} target="_blank" rel="noopener noreferrer" className="underline font-medium">masothue.com/{form.tax_code}</a>
                  </p>
                )}
              </div>
              {/* Hàng 1: Loại báo cáo + Thời hạn thu phí */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Loại báo cáo</label>
                  <select value={form.report_type}
                    onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="monthly">Hàng tháng</option>
                    <option value="quarterly">Hàng quý</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Thời hạn thu phí</label>
                  <select value={form.fee_period}
                    onChange={e => setForm(f => ({ ...f, fee_period: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="monthly">Theo tháng</option>
                    <option value="quarterly">Theo quý</option>
                  </select>
                </div>
              </div>
              {/* Hàng 2: Phí dịch vụ + Áp dụng từ tháng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phí dịch vụ (đ)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.monthly_fee !== '' ? fmt(Number(form.monthly_fee)) : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setForm(f => ({ ...f, monthly_fee: raw }))
                    }}
                    placeholder="VD: 2.000.000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.monthly_fee !== '' && Number(form.monthly_fee) > 0 && (
                    <p className="text-xs text-blue-600 mt-1 font-semibold">{fmt(Number(form.monthly_fee))}đ</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Áp dụng từ tháng</label>
                  <select value={form.fee_start}
                    onChange={e => setForm(f => ({ ...f, fee_start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Tháng hiện tại</option>
                    {getApplyFromMonths().map(mo => (
                      <option key={mo.value} value={mo.value}>{mo.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Thu khác (tồn đọng cũ) */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Thu khác (đ)
                  <span className="ml-1.5 text-gray-400 font-normal">— Tồn đọng từ phần mềm/Excel cũ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.other_debt !== '' ? fmt(Number(form.other_debt)) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setForm(f => ({ ...f, other_debt: raw }))
                  }}
                  placeholder="VD: 5.000.000 (để trống nếu không có)"
                  className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50"
                />
                {form.other_debt !== '' && Number(form.other_debt) > 0 && (
                  <p className="text-xs text-orange-600 mt-1 font-semibold">Tồn đọng: {fmt(Number(form.other_debt))}đ</p>
                )}
              </div>
              {/* Mã khách hàng */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Mã khách hàng
                  <span className="ml-1.5 text-gray-400 font-normal">— Mã nội bộ để theo dõi</span>
                </label>
                <input type="text" value={form.client_code}
                  onChange={e => setForm(f => ({ ...f, client_code: e.target.value }))}
                  placeholder="VD: KH001, AORAKI-01..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* Trạng thái + Ngày bắt đầu hợp đồng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Trạng thái</label>
                  <select value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className={'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ' + (form.status === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-gray-200')}>
                    <option value="pending">Trình ký (đang lên hợp đồng)</option>
                    <option value="active">Đang sử dụng</option>
                  </select>
                  {form.status === 'pending' && (
                    <p className="text-xs text-amber-600 mt-1">Chưa tính tỉ lệ công việc/công nợ cho đến khi chuyển "Đang sử dụng".</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ngày bắt đầu hợp đồng</label>
                  <input type="date" value={form.contract_start}
                    onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">Dùng cho hợp đồng + mốc bắt đầu tính tỉ lệ.</p>
                </div>
              </div>
              {/* 6. Phòng ban phụ trách */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phòng ban phụ trách</label>
                <select value={formRoom}
                  onChange={e => { setFormRoom(e.target.value); setForm(f => ({ ...f, assigned_to: '' })) }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Lọc theo phòng —</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              {/* 7. Nhân viên phụ trách */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nhân viên phụ trách *</label>
                <select required value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Chọn nhân viên...</option>
                  {formStaff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{s.rooms ? ' — ' + s.rooms.name : ''}
                    </option>
                  ))}
                </select>
              </div>
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-2 pt-1">
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

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {[
            ['pending',     'Trình ký (' + counts.pending + ')'],
            ['active',      'Đang dùng (' + counts.active + ')'],
            ['inactive',    'Ngưng (' + counts.inactive + ')'],
            ['transferred', 'Chuyển đi (' + counts.transferred + ')'],
            ['all',         'Tất cả (' + counts.all + ')'],
          ].map(function(item) {
            const k = item[0]
            const l = item[1]
            return (
              <button key={k} onClick={() => setFilter(k)}
                className={'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                  (filter === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')
                }>{l}</button>
            )
          })}
        </div>

        {/* Search */}
        <input type="text" placeholder="🔍  Tìm tên công ty hoặc MST..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">Không có công ty nào</p>
        )}

        <div className="space-y-3">
          {filtered.map(client => {
            const isOpen = expanded === client.id
            const history = feeHistory[client.id] || []
            const assignedStaff = client.staff

            return (
              <div key={client.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

                {/* Card header */}
                <button onClick={() => handleExpand(client.id)} className="w-full px-4 py-3 flex items-start justify-between text-left hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {client.client_code && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0">{client.client_code}</span>
                      )}
                      <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ' + (STATUS_COLOR[client.status || 'active'] || STATUS_COLOR.active)}>
                        {STATUS_LABEL[client.status || 'active'] || client.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {client.client_code && (
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono mr-1.5">{client.client_code}</span>
                      )}
                      {client.tax_code}
                      <span className="mx-1.5">·</span>
                      {client.report_type === 'quarterly' ? 'Báo cáo quý' : 'Báo cáo tháng'}
                    </p>
                    <p className="text-xs mt-0.5">
                      <span className="font-semibold text-blue-700">{fmt(client.monthly_fee)}đ</span>
                      <span className="text-gray-400">
                        {' / ' + ((client.fee_period || client.report_type) === 'quarterly' ? 'quý' : 'tháng')}
                      </span>
                    </p>
                    {assignedStaff && (
                      <p className="text-xs text-blue-500 mt-0.5">
                        {'👤 ' + assignedStaff.full_name + (assignedStaff.rooms ? ' · ' + assignedStaff.rooms.name : '')}
                      </p>
                    )}
                    {client.other_debt > 0 && (
                      <p className="text-xs text-orange-500 mt-0.5 font-medium">
                        {'⚠ Tồn đọng: ' + fmt(client.other_debt) + 'đ'}
                      </p>
                    )}
                    {client.address && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{'📍 ' + client.address}</p>
                    )}
                  </div>
                  <span className={'text-gray-400 ml-2 flex-shrink-0 text-sm transition-transform ' + (isOpen ? 'rotate-180' : '')}>▾</span>
                </button>

                {/* Expanded section */}
                {isOpen && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-4">

                    {/* ── Edit client info modal ── */}
                    {editClientId === client.id ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2.5">
                        <p className="text-xs font-semibold text-blue-800">✏️ Chỉnh sửa thông tin công ty</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-0.5 block">Mã khách hàng</label>
                            <input type="text" value={editClientForm.client_code || ''}
                              onChange={e => setEditClientForm(f => ({ ...f, client_code: e.target.value }))}
                              placeholder="VD: KH001"
                              className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-0.5 block">Mã số thuế</label>
                            <input type="text" value={editClientForm.tax_code || ''}
                              onChange={e => setEditClientForm(f => ({ ...f, tax_code: e.target.value }))}
                              className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Tên công ty</label>
                          <input type="text" value={editClientForm.name || ''}
                            onChange={e => setEditClientForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Địa chỉ Thuế</label>
                          <input type="text" value={editClientForm.address || ''}
                            onChange={e => setEditClientForm(f => ({ ...f, address: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Tình trạng thuế</label>
                          <input type="text" value={editClientForm.tax_status || ''}
                            onChange={e => setEditClientForm(f => ({ ...f, tax_status: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Người đại diện / Giám đốc</label>
                          <input type="text" value={editClientForm.representative || ''}
                            onChange={e => setEditClientForm(f => ({ ...f, representative: e.target.value }))}
                            placeholder="Xem tại masothue.com"
                            className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          {!editClientForm.representative && (
                            <a href={'https://masothue.com/' + (editClientForm.tax_code || '')} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline">
                              👉 masothue.com/{editClientForm.tax_code}
                            </a>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Ngày bắt đầu hợp đồng</label>
                          <input type="date" value={editClientForm.contract_start || ''}
                            onChange={e => setEditClientForm(f => ({ ...f, contract_start: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          <p className="text-xs text-gray-400 mt-0.5">Dùng cho hợp đồng + mốc bắt đầu tính tỉ lệ.</p>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={saveEditClient} disabled={saving}
                            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving ? 'Đang lưu...' : '✓ Lưu thay đổi'}
                          </button>
                          <button onClick={() => setEditClientId(null)}
                            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {client.client_code && (
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg font-mono font-semibold">
                              {client.client_code}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{client.name}</span>
                        </div>
                        <button
                          onClick={() => { setEditClientId(client.id); setEditClientForm({ name: client.name, tax_code: client.tax_code, address: client.address || '', tax_status: client.tax_status || '', client_code: client.client_code || '', representative: client.representative || '', contract_start: client.contract_start ? String(client.contract_start).slice(0,10) : '' }) }}
                          className="text-xs text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-1.5 rounded-lg flex-shrink-0">
                          ✏️ Sửa thông tin
                        </button>
                      </div>
                    )}

                    {/* Tax info */}
                    {(client.address || client.tax_status) && (
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1">
                        {client.tax_status && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-20 flex-shrink-0">Tình trạng</span>
                            <span className={'text-xs font-medium ' + (client.tax_status.toLowerCase().includes('hoạt động') ? 'text-green-600' : 'text-red-500')}>
                              {client.tax_status}
                            </span>
                          </div>
                        )}
                        {client.address && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-400 w-20 flex-shrink-0">Địa chỉ Thuế</span>
                            <span className="text-xs text-gray-600">{client.address}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Thu khác / Tồn đọng cũ */}
                    <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-orange-700">Thu khác (tồn đọng cũ)</p>
                          <p className="text-xs text-orange-500 mt-0.5">Từ phần mềm / Excel trước khi chuyển hệ thống</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          {otherDebtEdit === client.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text" inputMode="numeric" autoFocus
                                value={otherDebtVal ? fmt(Number(otherDebtVal)) : ''}
                                onChange={e => setOtherDebtVal(e.target.value.replace(/\D/g, ''))}
                                placeholder="0"
                                className="w-28 px-2 py-1 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-right"
                              />
                              <button onClick={() => saveOtherDebt(client.id)} disabled={saving}
                                className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                                Lưu
                              </button>
                              <button onClick={() => { setOtherDebtEdit(null); setOtherDebtVal('') }}
                                className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200">
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={'text-base font-bold ' + (client.other_debt > 0 ? 'text-orange-600' : 'text-gray-400')}>
                                {fmt(client.other_debt)}đ
                              </span>
                              <button
                                onClick={() => { setOtherDebtEdit(client.id); setOtherDebtVal(String(client.other_debt || '')) }}
                                className="text-xs text-orange-500 hover:underline font-medium">
                                Sửa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Thu phí */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Thu phí dịch vụ</p>
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-700">{fmt(client.monthly_fee)}đ</span>
                          <span className="text-xs text-gray-400">
                            {'/' + ((client.fee_period || client.report_type) === 'quarterly' ? 'quý' : 'tháng')}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {getBillingMonths(client.fee_period || client.report_type, 6).map(function(bm) {
                          const key = client.id + '_' + bm.y + '_' + bm.m
                          const rec = feeCollections[key]
                          const isEditing = collectEdit && collectEdit.clientId === client.id && collectEdit.year === bm.y && collectEdit.month === bm.m
                          const label = 'T' + bm.m + '/' + bm.y + (client.report_type === 'quarterly' ? ' (Q' + Math.ceil(bm.m / 3) + ')' : '')

                          if (isEditing) {
                            return (
                              <div key={key} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                                <p className="text-xs font-semibold text-blue-700">Ghi nhận thu phí {label}</p>
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1">
                                    <input type="text" inputMode="numeric"
                                      value={collectAmount ? fmt(Number(collectAmount)) : ''}
                                      onChange={e => setCollectAmount(e.target.value.replace(/\D/g, ''))}
                                      placeholder={'VD: ' + fmt(client.monthly_fee) + 'đ'}
                                      className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                  </div>
                                </div>
                                <input type="text" value={collectNote}
                                  onChange={e => setCollectNote(e.target.value)}
                                  placeholder="Ghi chú: VD: Chuyển khoản ngày 15, có hóa đơn..."
                                  className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                <div className="flex gap-2">
                                  <button onClick={saveCollection} disabled={!collectAmount || saving}
                                    className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                    ✓ Lưu đã thu
                                  </button>
                                  <button onClick={() => { setCollectEdit(null); setCollectAmount(''); setCollectNote('') }}
                                    className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs hover:bg-gray-200 transition-colors">
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            )
                          }

                          if (rec) {
                            return (
                              <div key={key} className="flex items-start justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-600 text-sm">✓</span>
                                    <span className="text-xs font-medium text-gray-700">{label}</span>
                                    <span className="text-xs font-semibold text-green-700">{fmt(rec.amount)}đ</span>
                                  </div>
                                  {rec.note && <p className="text-xs text-gray-400 ml-5 mt-0.5 italic">{rec.note}</p>}
                                </div>
                                <button onClick={() => deleteCollection(client.id, bm.y, bm.m)}
                                  className="text-xs text-gray-300 hover:text-red-400 flex-shrink-0 ml-2 transition-colors">
                                  ✕
                                </button>
                              </div>
                            )
                          }

                          return (
                            <div key={key} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                              <div>
                                <span className="text-xs text-gray-600 font-medium">{label}</span>
                                {client.monthly_fee > 0 && (
                                  <span className="text-xs text-gray-400 ml-2">{fmt(client.monthly_fee)}đ</span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setCollectEdit({ clientId: client.id, year: bm.y, month: bm.m })
                                  setCollectAmount(String(client.monthly_fee || ''))
                                  setCollectNote('')
                                }}
                                className="text-xs text-blue-600 font-medium hover:underline flex-shrink-0 bg-blue-50 px-2.5 py-1 rounded-lg">
                                + Ghi nhận thu
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Assignment edit */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nhân viên phụ trách</p>
                      {assignEdit === client.id ? (
                        <div className="space-y-2">
                          <select value={assignRoom}
                            onChange={e => { setAssignRoom(e.target.value); setAssignStaff('') }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Lọc theo phòng —</option>
                            {rooms.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <select value={assignStaff} onChange={e => setAssignStaff(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Chọn nhân viên...</option>
                            {assignStaffList.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.full_name}{s.rooms ? ' — ' + s.rooms.name : ''}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => saveAssign(client.id)} disabled={!assignStaff || saving}
                              className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              Lưu
                            </button>
                            <button onClick={() => { setAssignEdit(null); setAssignRoom(''); setAssignStaff('') }}
                              className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-800">{assignedStaff ? assignedStaff.full_name : 'Chưa phân công'}</p>
                            {assignedStaff && assignedStaff.rooms && (
                              <p className="text-xs text-gray-400">{assignedStaff.rooms.name}</p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setAssignEdit(client.id)
                              setAssignRoom(assignedStaff ? (assignedStaff.room_id || '') : '')
                              setAssignStaff(client.assigned_to || '')
                            }}
                            className="text-xs text-blue-600 hover:underline font-medium">
                            Thay đổi
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Hợp đồng dịch vụ */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Hợp đồng dịch vụ</p>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => window.open('/api/admin/contract?clientId=' + client.id + '&format=pdf', '_blank')}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium transition-colors">
                          📄 Xuất PDF
                        </button>
                        <button onClick={() => window.open('/api/admin/contract?clientId=' + client.id + '&format=word', '_blank')}
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors">
                          📝 Tải Word
                        </button>
                      </div>
                      {!client.contract_start && (
                        <p className="text-xs text-amber-500 mt-1">Chưa có "Ngày bắt đầu hợp đồng" — hãy sửa thông tin để hợp đồng hiển thị đúng thời hạn.</p>
                      )}
                    </div>

                    {/* Status change */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Trạng thái</p>
                      {statusEdit === client.id ? (
                        <div className="space-y-2">
                          {(client.status === 'pending') && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                              <label className="text-xs text-amber-700 font-medium block">Chuyển sang "Đang sử dụng" — áp dụng từ tháng:</label>
                              <input type="month" value={activateMonth}
                                min="2026-01"
                                max={year + '-' + String(month).padStart(2, '0')}
                                onChange={e => setActivateMonth(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                              <p className="text-xs text-amber-500">Chỉ chọn từ 1/2026 đến tháng hiện tại — công nợ tồn từ trước ghi vào "Nợ tồn".</p>
                              <button onClick={() => saveStatus(client.id, 'active', activateMonth ? activateMonth + '-01' : (client.contract_start || null))}
                                disabled={saving}
                                className="w-full bg-green-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                                ✓ Chốt hợp đồng — Đang sử dụng{activateMonth ? ' từ ' + activateMonth.split('-').reverse().join('/') : ''}
                              </button>
                              <p className="text-xs text-amber-500">Từ tháng này mới bắt đầu tính tỉ lệ công việc/công nợ.</p>
                            </div>
                          )}
                          {STATUS_OPTS.filter(o => !(client.status === 'pending' && o.v === 'active')).map(o => (
                            <button key={o.v} onClick={() => saveStatus(client.id, o.v)}
                              className={'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ' +
                                (client.status === o.v ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700')
                              }>{o.l}</button>
                          ))}
                          <button onClick={() => { setStatusEdit(null); setActivateMonth('') }} className="text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                        </div>
                      ) : (
                        <button onClick={() => setStatusEdit(client.id)}
                          className="text-xs text-blue-600 hover:underline font-medium">
                          {STATUS_LABEL[client.status] || client.status} — Thay đổi
                        </button>
                      )}
                    </div>

                    {/* Transfer */}
                    {transferStaff.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chuyển nhân viên phụ trách</p>
                        {transferEdit === client.id ? (
                          <div className="space-y-2">
                            <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">Chọn nhân viên...</option>
                              {transferStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => saveTransfer(client.id)} disabled={!transferTo || saving}
                                className="flex-1 bg-orange-500 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
                                Xác nhận chuyển
                              </button>
                              <button onClick={() => { setTransferEdit(null); setTransferTo('') }}
                                className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setTransferEdit(client.id)}
                            className="text-xs text-orange-600 hover:underline font-medium">
                            Chuyển sang NV khác →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Nhân viên phụ — theo dõi thêm, không tính doanh thu cho họ */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nhân viên phụ trách thêm</p>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(secondaryMap[client.id] || []).map(row => (
                          <span key={row.id} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
                            {row.staff?.full_name || '—'}
                            {row.staff?.rooms?.name && <span className="text-amber-400">· {row.staff.rooms.name}</span>}
                            <button onClick={() => removeSecondary(row.id)} className="text-amber-400 hover:text-red-500 leading-none ml-0.5">×</button>
                          </span>
                        ))}
                        {addSecondaryFor === client.id ? (
                          <div className="flex items-center gap-1.5 w-full mt-1">
                            <select value={secondaryPick} onChange={e => setSecondaryPick(e.target.value)} autoFocus
                              className="flex-1 px-2 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none">
                              <option value="">-- Chọn nhân viên --</option>
                              {rooms.map(r => (
                                <optgroup key={r.id} label={'Phòng ' + r.name}>
                                  {allStaff.filter(s => s.room_id === r.id && s.id !== client.assigned_to && !(secondaryMap[client.id] || []).some(row => row.staff_id === s.id))
                                    .map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            <button onClick={() => addSecondary(client.id)} disabled={!secondaryPick}
                              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium">
                              Lưu
                            </button>
                            <button onClick={() => { setAddSecondaryFor(null); setSecondaryPick('') }}
                              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setAddSecondaryFor(client.id); setSecondaryPick('') }}
                            className="text-xs text-amber-600 hover:underline font-medium">
                            + Thêm nhân viên phụ
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">Nhân viên phụ thấy & theo dõi công ty này, nhưng doanh thu/công nợ vẫn chỉ tính cho nhân viên chính.</p>
                    </div>

                    {/* Fee adjustment */}
                    <FeeAdjust
                      client={client}
                      isEditing={feeEdit === client.id}
                      feeAmount={feeAmount}
                      feeFromMonth={feeFromMonth}
                      feeNote={feeNote}
                      saving={saving}
                      futureMonths={getFutureMonths(12)}
                      onOpen={() => { setFeeEdit(client.id); setFeeAmount(String(client.monthly_fee || '')); setFeeFromMonth('') }}
                      onSave={() => saveFee(client.id)}
                      onCancel={() => { setFeeEdit(null); setFeeAmount(''); setFeeNote(''); setFeeFromMonth('') }}
                      onAmountChange={v => setFeeAmount(v)}
                      onMonthChange={v => setFeeFromMonth(v)}
                      onNoteChange={v => setFeeNote(v)}
                    />
                    {history.length > 0 && (
                      <div className="mt-3 border-t border-gray-50 pt-3">
                        <p className="text-xs text-gray-400 mb-1.5">Lịch sử thay đổi phí:</p>
                        <div className="space-y-1">
                          {history.map(h => (
                            <div key={h.id} className="flex items-center justify-between text-xs text-gray-500">
                              <span>{'T' + h.month + '/' + h.year}</span>
                              <span className="font-medium text-gray-700">{fmt(h.amount)}đ</span>
                              {h.note && <span className="text-gray-400 truncate max-w-24">{h.note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
