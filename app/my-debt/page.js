'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import ClientChecklist from '@/components/ClientChecklist'

const fmt    = (n) => Number(n || 0).toLocaleString('vi-VN')
const pctClr = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-500' : 'text-red-500'
const barClr = (v) => v >= 90 ? 'bg-green-500'   : v >= 70 ? 'bg-yellow-400'   : 'bg-red-400'

function Bar({ value }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={'h-full rounded-full transition-all ' + barClr(value || 0)}
        style={{ width: Math.min(100, value || 0) + '%' }} />
    </div>
  )
}

const FILTERS = [
  { v: 'all',    l: 'Tất cả' },
  { v: 'unpaid', l: 'Chưa thu đủ' },
  { v: 'paid',   l: 'Đã thu đủ' },
]

export default function MyDebtPage() {
  const router = useRouter()
  const now    = new Date()

  const [selYear,   setSelYear]   = useState(now.getFullYear())
  const [selMonth,  setSelMonth]  = useState(now.getMonth() + 1)
  const [me,        setMe]        = useState(null)
  const [myClients, setMyClients] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('unpaid')
  const [openClient, setOpenClient] = useState({})
  const [clientMonth, setClientMonth] = useState({})
  const [userId, setUserId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

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
        const clients = (json.clients || []).map(c => {
          const fee     = Number(c.monthly_fee) || 0
          const ketoan  = Number(c.collected) || 0
          const khach   = Number(c.collectedKhach) || 0
          const remain  = Math.max(0, fee - ketoan)
          return { ...c, collected: ketoan, collectedKhach: khach, remain, isPaid: fee === 0 || remain === 0 }
        })
        setMyClients(clients)
      } else {
        setMe(null); setMyClients([])
      }
    } catch (_) {}
    setLoading(false)
  }

  // Tổng quan công nợ tháng đang chọn — chỉ tính các công ty mình là nhân viên chính
  // (công ty phụ trách phụ vẫn hiện trong danh sách để theo dõi, nhưng không cộng vào KPI doanh thu)
  const ownedClients = myClients.filter(c => !c.isSecondary)
  const totalFee    = ownedClients.reduce((a, c) => a + (Number(c.monthly_fee) || 0), 0)
  const totalKetoan = ownedClients.reduce((a, c) => a + c.collected, 0)
  const totalKhach  = ownedClients.reduce((a, c) => a + c.collectedKhach, 0)
  const totalRemain = ownedClients.reduce((a, c) => a + c.remain, 0)
  const debtPct     = totalFee === 0 ? 100 : Math.round(totalKetoan / totalFee * 100)
  const unpaidCount = ownedClients.filter(c => !c.isPaid).length
  const totalOtherDebt = myClients.reduce((a, c) => a + (Number(c.other_debt) || 0), 0)

  const filtered = myClients
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.tax_code || '').includes(search)
    )
    .filter(c => filter === 'all' ? true : filter === 'unpaid' ? !c.isPaid : c.isPaid)
    .sort((a, b) => {
      // Chưa thu đủ lên trước, trong mỗi nhóm sắp xếp theo số tiền còn thiếu giảm dần
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1
      return b.remain - a.remain
    })

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý công nợ</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {me?.rooms?.name ? 'Phòng ' + me.rooms.name : '—'}
              {' · '}{myClients.length} công ty
              {unpaidCount > 0 && <span className="text-orange-500 font-medium"> · {unpaidCount} chưa thu đủ</span>}
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
            {/* KPI tổng quan công nợ */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">💰 Tổng phí kế toán</p>
                <p className="text-xl font-bold text-gray-800">{fmt(totalFee)}đ</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">✅ Đã thu</p>
                <p className="text-xl font-bold text-green-600">{fmt(totalKetoan)}đ</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">⚠ Còn phải thu (tháng này)</p>
                <p className={'text-xl font-bold ' + (totalRemain > 0 ? 'text-orange-500' : 'text-green-600')}>{fmt(totalRemain)}đ</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">🗂 Dịch vụ khác đã thu</p>
                <p className="text-xl font-bold text-blue-600">{fmt(totalKhach)}đ</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">📦 Nợ tồn cũ (tách biệt)</p>
                <p className={'text-xl font-bold ' + (totalOtherDebt > 0 ? 'text-orange-500' : 'text-green-600')}>{fmt(totalOtherDebt)}đ</p>
              </div>
            </div>

            {/* Progress bar tổng */}
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-500">Tỷ lệ thu hồi công nợ tháng {selMonth}/{selYear}</span>
                <span className={'font-bold ' + pctClr(debtPct)}>{debtPct}%</span>
              </div>
              <Bar value={debtPct} />
            </div>

            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input type="text" placeholder="🔍  Tìm công ty hoặc MST..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-shrink-0">
                {FILTERS.map(f => (
                  <button key={f.v} onClick={() => setFilter(f.v)}
                    className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                      (filter === f.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách công nợ theo công ty */}
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">Không có công ty phù hợp</p>
            ) : (
              <div className="space-y-3">
                {filtered.map(client => {
                  const isOpen = openClient[client.id]
                  const cMonth = clientMonth[client.id] || selMonth
                  const pct = client.monthly_fee > 0 ? Math.min(100, Math.round(client.collected / client.monthly_fee * 100)) : 100

                  return (
                    <div key={client.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <button onClick={() => setOpenClient(p => ({ ...p, [client.id]: !p[client.id] }))}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                            <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border ' +
                              (client.report_type === 'quarterly'
                                ? 'bg-purple-100 text-purple-700 border-purple-300'
                                : 'bg-blue-100 text-blue-700 border-blue-300')}>
                              {client.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                            </span>
                            <span className={'text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ' +
                              (client.isPaid ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600')}>
                              {client.isPaid ? '✓ Đã thu đủ' : '⚠ Còn ' + fmt(client.remain) + 'đ'}
                            </span>
                            {client.isSecondary && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Phụ trách phụ</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400">{client.tax_code}</span>
                            <span className="text-xs font-medium" style={{ color: '#8B1A1A' }}>
                              Phí: {fmt(client.monthly_fee)}đ
                            </span>
                            <span className="text-xs text-green-600">Đã thu: {fmt(client.collected)}đ</span>
                            {client.collectedKhach > 0 && (
                              <span className="text-xs text-blue-500">Dịch vụ khác: {fmt(client.collectedKhach)}đ</span>
                            )}
                            {Number(client.other_debt) > 0 && (
                              <span className="text-xs text-orange-500">📦 Nợ tồn cũ: {fmt(client.other_debt)}đ</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <div className="w-20">
                            <Bar value={pct} />
                          </div>
                          <span className={'text-sm font-bold w-12 text-right ' + pctClr(pct)}>{pct}%</span>
                          <span className={'text-gray-300 text-sm transition-transform ' + (isOpen ? 'rotate-180' : '')}>▾</span>
                        </div>
                      </button>

                      {isOpen && (
                        <ClientChecklist
                          client={client}
                          clientMonth={cMonth}
                          defaultPanel="debt"
                          onMonthChange={(newMonth) => setClientMonth(p => ({ ...p, [client.id]: newMonth }))}
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
