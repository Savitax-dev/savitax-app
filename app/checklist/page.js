'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import ClientChecklist from '@/components/ClientChecklist'

const fmt    = (n) => Number(n || 0).toLocaleString('vi-VN')
const pctClr = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-500' : 'text-red-500'
const barClr = (v) => v >= 90 ? 'bg-green-500'   : v >= 70 ? 'bg-yellow-400'   : 'bg-red-400'

const STATUS_STYLE = {
  done_ontime: { bg: 'bg-green-500',  text: 'text-green-700',  label: 'Đúng hạn' },
  done_late1:  { bg: 'bg-yellow-400', text: 'text-yellow-700', label: 'Trễ 1-2 ngày' },
  done_late3:  { bg: 'bg-red-400',    text: 'text-red-600',    label: 'Trễ ≥3 ngày' },
  overdue:     { bg: 'bg-red-200',    text: 'text-red-500',    label: 'Quá hạn' },
  pending:     { bg: 'bg-gray-200',   text: 'text-gray-400',   label: 'Chưa làm' },
}

function Bar({ value }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={'h-full rounded-full transition-all ' + barClr(value || 0)}
        style={{ width: Math.min(100, value || 0) + '%' }} />
    </div>
  )
}

export default function ChecklistPage() {
  const router = useRouter()
  const now    = new Date()

  const [selYear,    setSelYear]    = useState(now.getFullYear())
  const [selMonth,   setSelMonth]   = useState(now.getMonth() + 1)
  const [me,         setMe]         = useState(null)
  const [myClients,  setMyClients]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [openClient, setOpenClient] = useState({})      // clientId → bool
  const [clientMonth, setClientMonth] = useState({})   // clientId → month number

  const monthOpts = []
  let y = now.getFullYear(), m = now.getMonth() + 1
  for (let i = 0; i < 12; i++) {
    monthOpts.push({ label: 'T' + m + '/' + y, value: y + '-' + String(m).padStart(2,'0'), y, m })
    m--; if (m === 0) { m = 12; y-- }
  }

  const [userId, setUserId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      setUserId(sd.session.user.id)
      const { data: me } = await supabase.from('staff').select('role').eq('id', sd.session.user.id).single()
      setIsAdmin(['admin', 'leader', 'manager'].includes(me?.role))
    }
    init()
  }, [router])

  useEffect(() => {
    if (!userId) return
    loadMyData()
  }, [userId, selYear, selMonth])

  const loadMyData = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/my-room?userId=${userId}&year=${selYear}&month=${selMonth}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const json = await res.json()
      if (!json.error) {
        setMe(json.staff)
        const clients = (json.clients || []).map(c => ({
          ...c,
          collected:      Number(c.collected) || 0,
          collectedKhach: Number(c.collectedKhach) || 0,
        }))
        setMyClients(clients)
      } else {
        setMe(null)
        setMyClients([])
      }
    } catch (_) {}
    setLoading(false)
  }

  // KPI tổng của tôi
  const totalTasks = myClients.reduce((a, c) => a + c.tasks.length, 0)
  const doneTasks  = myClients.reduce((a, c) => a + c.tasks.filter(t => t.status === 'done_ontime').length, 0)
  const taskPct    = totalTasks === 0 ? 100 : Math.round(doneTasks / totalTasks * 100)
  // Doanh thu/công nợ chỉ tính các công ty mình là nhân viên chính — công ty phụ trách phụ không cộng vào đây
  const ownedClients = myClients.filter(c => !c.isSecondary)
  const totalFee   = ownedClients.reduce((a, c) => a + (Number(c.monthly_fee) || 0), 0)
  const collected  = ownedClients.reduce((a, c) => a + c.collected, 0)
  const debtPct    = totalFee === 0 ? 0 : Math.round(collected / totalFee * 100)

  const filtered = myClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.tax_code || '').includes(search)
  )

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Công việc của tôi</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {me?.rooms?.name ? 'Phòng ' + me.rooms.name : '—'}
              {' · '}{myClients.length} công ty
            </p>
          </div>
          <select
            value={selYear + '-' + String(selMonth).padStart(2,'0')}
            onChange={e => { const p = e.target.value.split('-'); setSelYear(Number(p[0])); setSelMonth(Number(p[1])) }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white flex-shrink-0"
            style={{ '--tw-ring-color': '#8B1A1A' }}>
            {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#8B1A1A', borderTopColor: 'transparent' }} />
          </div>
        ) : !me?.room_id ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-8 text-center">
            <p className="text-4xl mb-3">🏢</p>
            <p className="text-gray-700 font-medium">Bạn chưa được gán vào phòng nghiệp vụ nào</p>
            <p className="text-sm text-gray-400 mt-1">Liên hệ quản trị viên để được phân công phòng</p>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">✅ Hoàn thành công việc</p>
                <p className={'text-2xl font-bold ' + pctClr(taskPct)}>{taskPct}%</p>
                <p className="text-xs text-gray-400 mt-0.5">{doneTasks}/{totalTasks} việc đúng hạn</p>
                <Bar value={taskPct} />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">💰 Thu hồi công nợ</p>
                <p className={'text-2xl font-bold ' + pctClr(debtPct)}>{debtPct}%</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmt(collected)}/{fmt(totalFee)}đ</p>
                <Bar value={debtPct} />
              </div>
            </div>

            {/* Search */}
            <input type="text" placeholder="🔍  Tìm công ty hoặc MST..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-4" />

            {/* Company list */}
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">Không tìm thấy công ty nào</p>
            ) : (
              <div className="space-y-3">
                {filtered.map(client => {
                  const clientDone  = client.tasks.filter(t => t.status === 'done_ontime').length
                  const clientTotal = client.tasks.length
                  const clientPct   = clientTotal === 0 ? 100 : Math.round(clientDone / clientTotal * 100)
                  const isOpen      = openClient[client.id]
                  const cMonth      = clientMonth[client.id] || selMonth

                  return (
                    <div key={client.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Company header — click to expand */}
                      <button
                        onClick={() => setOpenClient(p => ({ ...p, [client.id]: !p[client.id] }))}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900 break-words">{client.name}</p>
                            <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border ' +
                              (client.report_type === 'quarterly'
                                ? 'bg-purple-100 text-purple-700 border-purple-300'
                                : 'bg-blue-100 text-blue-700 border-blue-300')}>
                              {client.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                            </span>
                            {client.isSecondary && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Phụ trách phụ</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400">{client.tax_code}</span>
                            <span className="text-xs font-medium" style={{ color: '#8B1A1A' }}>{fmt(client.monthly_fee)}đ/{client.fee_period === 'quarterly' ? 'quý' : 'tháng'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          {/* Task dots */}
                          <div className="flex gap-0.5">
                            {client.tasks.slice(0, 10).map(t => (
                              <span key={t.id} className={'w-2 h-2 rounded-full ' + (STATUS_STYLE[t.status]?.bg || 'bg-gray-200')} title={t.name} />
                            ))}
                            {client.tasks.length > 10 && <span className="text-xs text-gray-300">+{client.tasks.length - 10}</span>}
                          </div>
                          <div className="text-right">
                            <p className={'text-sm font-bold ' + pctClr(clientPct)}>{clientPct}%</p>
                            <p className="text-xs text-gray-400">{clientDone}/{clientTotal}</p>
                          </div>
                          <span className={'text-gray-300 text-sm transition-transform ' + (isOpen ? 'rotate-180' : '')}>▾</span>
                        </div>
                      </button>

                      {/* ClientChecklist — all 4 panels */}
                      {isOpen && (
                        <ClientChecklist
                          client={client}
                          clientMonth={cMonth}
                          onMonthChange={(newMonth) =>
                            setClientMonth(p => ({ ...p, [client.id]: newMonth }))
                          }
                          onDebtSaved={loadMyData}
                          isAdmin={isAdmin}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
