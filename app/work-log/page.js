'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const TYPE_META = {
  task_done:   { icon: '✅', label: 'Hoàn thành việc', dot: 'bg-green-500',  chip: 'bg-green-50 text-green-700 border-green-200' },
  debt_update: { icon: '💰', label: 'Công nợ',         dot: 'bg-amber-500',  chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  info_change: { icon: '✏️', label: 'Sửa thông tin',   dot: 'bg-blue-500',   chip: 'bg-blue-50 text-blue-700 border-blue-200' },
}

const TYPE_CHIPS = [
  { v: '',            l: 'Tất cả' },
  { v: 'task_done',   l: '✅ Hoàn thành việc' },
  { v: 'debt_update', l: '💰 Công nợ' },
  { v: 'info_change', l: '✏️ Sửa thông tin' },
]

export default function WorkLogPage() {
  const router = useRouter()
  const now = new Date()

  const [userId,  setUserId]  = useState(null)
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [role,    setRole]    = useState('staff')
  const [entries, setEntries] = useState([])
  const [staffOptions,  setStaffOptions]  = useState([])
  const [clientOptions, setClientOptions] = useState([])
  const [roomOptions,   setRoomOptions]   = useState([])
  const [loading, setLoading] = useState(true)
  const [fStaff,  setFStaff]  = useState('')
  const [fClient, setFClient] = useState('')
  const [fRoom,   setFRoom]   = useState('')
  const [fType,   setFType]   = useState('')

  const monthOpts = []
  let y = now.getFullYear(), m = now.getMonth() + 1
  for (let i = 0; i < 12; i++) {
    monthOpts.push({ label: 'T' + m + '/' + y, value: y + '-' + String(m).padStart(2,'0'), y, m })
    m--; if (m === 0) { m = 12; y-- }
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      setUserId(sd.session.user.id)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!userId) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selYear, selMonth, fStaff, fClient, fRoom, fType])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId, year: String(selYear), month: String(selMonth),
        staffId: fStaff, clientId: fClient, roomId: fRoom, type: fType,
        _t: String(Date.now()),
      })
      const res = await fetch('/api/admin/work-log?' + params.toString(), { cache: 'no-store' })
      const json = await res.json()
      if (!json.error) {
        setEntries(json.entries || [])
        setStaffOptions(json.staffOptions || [])
        setClientOptions(json.clientOptions || [])
        setRoomOptions(json.roomOptions || [])
        setRole(json.role || 'staff')
      }
    } catch (_) {}
    setLoading(false)
  }

  // Đếm tóm tắt theo loại
  const counts = entries.reduce((a, e) => { a[e.type] = (a[e.type] || 0) + 1; return a }, {})

  // Nhóm theo ngày (yyyy-mm-dd)
  const groups = {}
  for (const e of entries) {
    const d = new Date(e.happenedAt)
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  const dayLabel = (key) => {
    const [yy, mm, dd] = key.split('-')
    const date = new Date(Number(yy), Number(mm)-1, Number(dd))
    const wd = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'][date.getDay()]
    return wd + ', ngày ' + dd + '/' + mm + '/' + yy
  }
  const timeLabel = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const showStaffFilter = role === 'admin' || role === 'leader' || role === 'manager'
  const showRoomFilter  = role === 'admin'

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nhật ký làm việc</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {role === 'admin' ? 'Toàn bộ hoạt động của công ty'
                : (role === 'leader' || role === 'manager') ? 'Hoạt động của phòng bạn phụ trách'
                : 'Hoạt động bạn đã thực hiện'} — dùng làm bằng chứng đối chiếu
            </p>
          </div>
          <select value={selYear + '-' + String(selMonth).padStart(2,'0')}
            onChange={e => { const p = e.target.value.split('-'); setSelYear(Number(p[0])); setSelMonth(Number(p[1])) }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-shrink-0">
            {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Tóm tắt */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { type: 'task_done',   label: 'Hoàn thành việc' },
            { type: 'debt_update', label: 'Cập nhật công nợ' },
            { type: 'info_change', label: 'Sửa thông tin' },
          ].map(c => (
            <div key={c.type} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{TYPE_META[c.type].icon} {c.label}</p>
              <p className="text-xl font-bold text-gray-800">{counts[c.type] || 0}</p>
            </div>
          ))}
        </div>

        {/* Thanh lọc */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {showRoomFilter && (
            <select value={fRoom} onChange={e => setFRoom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Tất cả phòng</option>
              {roomOptions.map(r => <option key={r.id} value={r.id}>Phòng {r.name}</option>)}
            </select>
          )}
          {showStaffFilter && (
            <select value={fStaff} onChange={e => setFStaff(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Tất cả nhân viên</option>
              {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select value={fClient} onChange={e => setFClient(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-full">
            <option value="">Tất cả công ty</option>
            {clientOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
            {TYPE_CHIPS.map(c => (
              <button key={c.v} onClick={() => setFType(c.v)}
                className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                  (fType === c.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {c.l}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groupKeys.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl px-5 py-12 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-700 font-medium">Chưa có hoạt động nào trong tháng này</p>
            <p className="text-sm text-gray-400 mt-1">Thử chọn tháng khác hoặc bỏ bớt bộ lọc</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupKeys.map(key => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-700">{dayLabel(key)}</p>
                  <span className="text-xs text-gray-400">({groups[key].length})</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
                  {groups[key].map(e => {
                    const meta = TYPE_META[e.type] || TYPE_META.task_done
                    return (
                      <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                        <span className="text-base flex-shrink-0 mt-0.5">{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 flex-shrink-0">{timeLabel(e.happenedAt)}</span>
                            <span className="text-sm font-medium text-gray-800 break-words">{e.actorName}</span>
                          </div>
                          <p className="text-sm text-gray-700 break-words mt-0.5">{e.title}</p>
                          {e.detail && <p className="text-xs text-gray-400 break-words mt-0.5 italic">{e.detail}</p>}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span className="text-xs bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-full border border-gray-200 break-words">
                              🏢 {e.clientName}
                            </span>
                            {role === 'admin' && e.roomName && (
                              <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">
                                Phòng {e.roomName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
