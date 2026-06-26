'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { hasPermission } from '@/lib/permissions'

const fmt   = (n) => Number(n || 0).toLocaleString('vi-VN')
const pctClr = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-500' : 'text-red-500'
const barClr = (v) => v >= 90 ? 'bg-green-500'   : v >= 70 ? 'bg-yellow-400'   : 'bg-red-400'

function Bar({ value, className = 'h-1.5' }) {
  return (
    <div className={'bg-gray-100 rounded-full overflow-hidden ' + className}>
      <div className={'h-full rounded-full transition-all ' + barClr(value || 0)} style={{ width: Math.min(100, value || 0) + '%' }} />
    </div>
  )
}

const PERIODS = [
  { v: 'month',   l: 'Tháng' },
  { v: 'quarter', l: 'Quý' },
  { v: 'year',    l: 'Năm' },
]

export default function DebtPage() {
  const router = useRouter()
  const now = new Date()

  const [period,   setPeriod]   = useState('month') // 'month' | 'quarter' | 'year'
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selQuarter, setSelQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [rooms,    setRooms]    = useState([])
  const [data,     setData]     = useState([]) // [{room, staff:[{...clients}]}]
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all') // 'all' | 'unpaid' | 'overdue'
  const [search,   setSearch]   = useState('')
  const [openRoom, setOpenRoom] = useState({})
  const [allowed,  setAllowed]  = useState(false)
  const [checking, setChecking] = useState(true)

  // Month options (12 months back)
  const monthOpts = []
  let my = now.getFullYear(), mm = now.getMonth() + 1
  for (let i = 0; i < 12; i++) {
    monthOpts.push({ y: my, m: mm, label: 'T' + mm + '/' + my, val: my + '-' + String(mm).padStart(2,'0') })
    mm--; if (mm === 0) { mm = 12; my-- }
  }
  const quarterOpts = [1,2,3,4].map(q => ({ q, label: 'Quý ' + q }))
  const yearOpts = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: sd } = await supabase.auth.getSession()
        if (!sd.session) { router.push('/login'); return }

        const { data: me } = await supabase.from('staff').select('role').eq('id', sd.session.user.id).single()
        const ok = await hasPermission(me?.role, 'view_all_debt')
        if (!ok) { router.push('/dashboard'); return }
        setAllowed(true)
        setChecking(false)

        // Dùng API server-side (service role) để tránh lỗi RLS recursion trên bảng staff/clients
        const periodParams = period === 'month' ? `&month=${selMonth}`
          : period === 'quarter' ? `&period=quarter&quarter=${selQuarter}`
          : `&period=year`
        const res = await fetch(
          `/api/admin/debt-overview?year=${selYear}${periodParams}&_t=${Date.now()}`,
          { cache: 'no-store' }
        )
        const json = await res.json()
        const built = json.data || []

        setData(built)
        setRooms(built.map(r => r.room))
        // Auto-expand first room
        if (built.length > 0) setOpenRoom({ [built[0].room.id]: true })
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [selYear, selMonth, selQuarter, period, router])

  // Tháng cuối cùng của kỳ đang xem — dùng để biết kỳ đã qua hay chưa
  const lastMonthOfPeriod = period === 'month' ? selMonth : period === 'quarter' ? selQuarter * 3 : 12
  const isPeriodPast = now > new Date(selYear, lastMonthOfPeriod, 0, 23, 59)
  const periodLabel = period === 'month' ? 'T' + selMonth + '/' + selYear
    : period === 'quarter' ? 'Quý ' + selQuarter + '/' + selYear
    : 'Năm ' + selYear

  const debtStatus = (c) => {
    const fee = Number(c.periodFee) || 0
    const col = c.collected || 0
    if (fee === 0) return null
    if (col >= fee) return { label: '✅ Đã thu đủ',    cls: 'text-green-600 bg-green-50' }
    if (col > 0)    return { label: '⚠️ Thu một phần', cls: 'text-yellow-700 bg-yellow-50' }
    if (isPeriodPast) return { label: '🔴 Quá hạn',    cls: 'text-red-700 bg-red-50' }
    return              { label: '○ Chưa thu',          cls: 'text-gray-500 bg-gray-50' }
  }

  // Grand totals
  const grandFee = data.reduce((a, r) => a + r.totalFee, 0)
  const grandCol = data.reduce((a, r) => a + r.totalCollected, 0)
  const grandPct = grandFee === 0 ? 0 : Math.round(grandCol / grandFee * 100)
  const grandUnpaid = data.flatMap(r => r.staff.flatMap(s => s.clients)).filter(c => c.collected < c.periodFee && c.periodFee > 0)
  const grandOverdue = grandUnpaid.filter(() => isPeriodPast)
  const grandOtherDebt = data.flatMap(r => r.staff.flatMap(s => [...s.clients, ...(s.secondaryClients || [])]))
    .reduce((a, c) => a + (Number(c.other_debt) || 0), 0)

  if (checking) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )
  if (!allowed) return null

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Công nợ toàn công ty</h1>
            <p className="text-sm text-gray-400 mt-0.5">Theo dõi thu hồi phí dịch vụ kế toán</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {PERIODS.map(p => (
                <button key={p.v} onClick={() => setPeriod(p.v)}
                  className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                    (period === p.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {p.l}
                </button>
              ))}
            </div>
            {period === 'month' && (
              <select value={selYear + '-' + String(selMonth).padStart(2,'0')}
                onChange={e => { const p = e.target.value.split('-'); setSelYear(Number(p[0])); setSelMonth(Number(p[1])) }}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {monthOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            )}
            {period === 'quarter' && (
              <>
                <select value={selQuarter} onChange={e => setSelQuarter(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {quarterOpts.map(o => <option key={o.q} value={o.q}>{o.label}</option>)}
                </select>
                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {period === 'year' && (
              <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Grand summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Tổng phí phát sinh',   val: fmt(grandFee) + 'đ',                      cls: 'text-gray-900' },
                { label: 'Đã thu',                val: fmt(grandCol) + 'đ',                      cls: 'text-green-600' },
                { label: 'Còn phải thu',          val: fmt(grandFee - grandCol) + 'đ',           cls: grandFee - grandCol > 0 ? 'text-red-500' : 'text-green-600' },
                { label: 'Tỉ lệ thu hồi',         val: grandPct + '%',                           cls: pctClr(grandPct) },
                { label: 'Nợ tồn cũ (tách biệt)', val: fmt(grandOtherDebt) + 'đ',                cls: grandOtherDebt > 0 ? 'text-orange-500' : 'text-green-600' },
              ].map(c => (
                <div key={c.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                  <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                  <p className={'text-lg font-bold ' + c.cls}>{c.val}</p>
                </div>
              ))}
            </div>

            {/* Warning banner */}
            {grandOverdue.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
                <span className="text-red-500 text-xl">🔴</span>
                <div>
                  <p className="text-sm font-semibold text-red-700">Cảnh báo: {grandOverdue.length} công ty quá hạn thu phí</p>
                  <p className="text-xs text-red-500 mt-0.5">{periodLabel} đã qua — chưa thu đủ phí dịch vụ</p>
                </div>
              </div>
            )}

            {/* Progress bar tổng */}
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Tiến độ thu hồi {periodLabel}</span>
                <span className={pctClr(grandPct) + ' font-bold'}>{grandPct}%</span>
              </div>
              <Bar value={grandPct} className="h-2.5" />
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span>✅ {data.flatMap(r=>r.staff.flatMap(s=>s.clients)).filter(c=>c.collected>=c.periodFee && c.periodFee>0).length} cty đủ phí</span>
                <span>⚠️ {data.flatMap(r=>r.staff.flatMap(s=>s.clients)).filter(c=>c.collected>0&&c.collected<c.periodFee).length} cty một phần</span>
                <span>○ {data.flatMap(r=>r.staff.flatMap(s=>s.clients)).filter(c=>c.collected===0&&c.periodFee>0).length} cty chưa thu</span>
              </div>
            </div>

            {/* Per room */}
            <div className="space-y-3">
              {data.map(({ room, staff, totalFee, totalCollected, debtPct }) => (
                <div key={room.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  {/* Room header */}
                  <button onClick={() => setOpenRoom(p => ({ ...p, [room.id]: !p[room.id] }))}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-gray-900">Phòng {room.name}</p>
                        {room.type === 'remote' && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Remote</span>}
                        <span className="text-xs text-gray-400">{staff.reduce((a,s)=>a+s.clients.length,0)} cty</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Bar value={debtPct} className="h-1.5 flex-1" />
                        <span className={'text-xs font-bold flex-shrink-0 ' + pctClr(debtPct)}>{debtPct}%</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{fmt(totalCollected)}/{fmt(totalFee)}đ</span>
                      </div>
                    </div>
                    <span className={'text-gray-300 ml-3 flex-shrink-0 transition-transform ' + (openRoom[room.id] ? 'rotate-180' : '')}>▾</span>
                  </button>

                  {/* Staff + clients */}
                  {openRoom[room.id] && (
                    <div className="border-t border-gray-50">
                      {staff.filter(s => s.clients.length > 0 || (s.secondaryClients && s.secondaryClients.length > 0)).map(s => (
                        <div key={s.id} className="border-b border-gray-50 last:border-0">
                          {/* Staff row */}
                          <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-blue-600">
                                  {s.full_name ? s.full_name.trim().split(' ').pop().charAt(0).toUpperCase() : '?'}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{s.full_name}</span>
                              <span className="text-xs text-gray-400">{s.clients.length} cty</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={'text-xs font-bold ' + pctClr(s.debtPct)}>{s.debtPct}%</span>
                              <span className="text-xs text-gray-400">{fmt(s.totalCollected)}/{fmt(s.totalFee)}đ</span>
                            </div>
                          </div>
                          {/* Client rows */}
                          <div className="divide-y divide-gray-50">
                            {s.clients.map(c => {
                              const st = debtStatus(c)
                              const fee = Number(c.periodFee) || 0
                              const col = c.collected
                              const colPct = fee === 0 ? 100 : Math.min(100, Math.round(col / fee * 100))
                              return (
                                <div key={c.id} className="px-4 py-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm text-gray-800 font-medium truncate">{c.name}</p>
                                        <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border ' +
                                          (c.report_type === 'quarterly'
                                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                                            : 'bg-blue-100 text-blue-700 border-blue-300')}>
                                          {c.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-400">{c.tax_code}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      {st && <span className={'text-xs font-medium px-1.5 py-0.5 rounded-full ' + st.cls}>{st.label}</span>}
                                      <p className="text-xs text-gray-500 mt-0.5">{col > 0 ? fmt(col) + '/' : ''}{fmt(fee)}đ</p>
                                      {Number(c.other_debt) > 0 && (
                                        <p className="text-xs text-orange-500 mt-0.5">📦 Nợ tồn cũ: {fmt(c.other_debt)}đ</p>
                                      )}
                                    </div>
                                  </div>
                                  {col > 0 && col < fee && (
                                    <div className="mt-1.5">
                                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: colPct + '%' }} />
                                      </div>
                                      <p className="text-xs text-orange-500 mt-0.5">Còn thiếu {fmt(fee - col)}đ</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {/* Công ty mình là nhân viên phụ — chỉ theo dõi, không cộng vào KPI doanh thu của họ */}
                          {s.secondaryClients && s.secondaryClients.length > 0 && (
                            <div className="divide-y divide-gray-50 bg-amber-50/30">
                              {s.secondaryClients.map(c => {
                                const fee = Number(c.periodFee) || 0
                                const col = c.collected
                                return (
                                  <div key={'sec-' + c.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm text-gray-700 font-medium truncate">{c.name}</p>
                                        <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border ' +
                                          (c.report_type === 'quarterly'
                                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                                            : 'bg-blue-100 text-blue-700 border-blue-300')}>
                                          {c.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                                        </span>
                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Phụ trách phụ</span>
                                      </div>
                                      <p className="text-xs text-gray-400">{c.tax_code}</p>
                                    </div>
                                    <p className="text-xs text-gray-400 flex-shrink-0">{col > 0 ? fmt(col) + '/' : ''}{fmt(fee)}đ</p>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
