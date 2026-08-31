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
  // Thẻ tổng quan nào đang mở bảng chi tiết ('unpaid' | 'khach' | 'otherDebt' | null) — mỗi lúc
  // chỉ mở 1 bảng, bấm lại chính thẻ đó để đóng (giống tab "Công nợ phòng" ở /room/[roomId]).
  const [openCard, setOpenCard] = useState(null)

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

  // Công ty quý chưa tới hạn thu (hoặc còn trong hạn khoan) có periodFee=0 để loại khỏi %
  // công nợ — nhưng vẫn cần phân biệt với "công ty không có phí gì" khi hiển thị badge.
  const debtStatus = (c) => {
    const fee = Number(c.periodFee) || 0
    const col = c.collected || 0
    if (fee === 0) {
      if (col > 0) return { label: '✅ Đã thu (chưa đến hạn)', cls: 'text-green-600 bg-green-50' }
      if (c.fee_period === 'quarterly' && Number(c.monthly_fee) > 0) {
        return { label: '⏳ Chưa đến hạn quý', cls: 'text-gray-500 bg-gray-100' }
      }
      return null
    }
    if (col >= fee) return { label: '✅ Đã thu đủ',    cls: 'text-green-600 bg-green-50' }
    if (col > 0)    return { label: '⚠️ Thu một phần', cls: 'text-yellow-700 bg-yellow-50' }
    if (isPeriodPast) return { label: '🔴 Quá hạn',    cls: 'text-red-700 bg-red-50' }
    return              { label: '❌ Chưa thu',          cls: 'text-red-600 bg-red-50' }
  }

  // Grand totals
  const grandFee = data.reduce((a, r) => a + r.totalFee, 0)
  const grandCol = data.reduce((a, r) => a + r.totalCollected, 0)
  const grandPct = grandFee === 0 ? 0 : Math.round(grandCol / grandFee * 100)
  const grandUnpaid = data.flatMap(r => r.staff.flatMap(s => s.clients)).filter(c => c.collected < c.periodFee && c.periodFee > 0)
  const grandOverdue = grandUnpaid.filter(() => isPeriodPast)

  // ── Dữ liệu cho 3 thẻ bấm mở được ──────────────────────────────────────────────────────────
  // Chỉ tính công ty phụ trách CHÍNH (bỏ "phụ trách phụ") cho khớp nguyên tắc doanh thu và khớp
  // với grandFee/grandCol ở trên. Mỗi công ty chỉ có 1 assigned_to nên không sợ đếm trùng.
  const ownedByRoomStaff = data.map(r => ({
    roomName: r.room.name,
    staff: r.staff.map(s => ({
      id: s.id,
      name: s.full_name,
      clients: s.clients.map(c => ({ ...c, staffName: s.full_name, roomName: r.room.name })),
    })),
  }))
  const allOwned = ownedByRoomStaff.flatMap(r => r.staff.flatMap(s => s.clients))

  const grandOtherDebt = allOwned.reduce((a, c) => a + (Number(c.other_debt) || 0), 0)
  const grandKhach     = allOwned.reduce((a, c) => a + (Number(c.collectedKhach) || 0), 0)

  // Gom 2 cấp: PHÒNG → NHÂN VIÊN → công ty, để công ty của cùng 1 nhân viên nằm liền nhau
  // (trước đây chỉ gom theo phòng rồi sắp theo số tiền nên nhân viên bị trộn lẫn, khó dò).
  // `amountOf` quyết định số tiền dùng để sắp xếp + cộng tổng của từng bảng.
  const groupByRoomStaff = (filterFn, amountOf) => ownedByRoomStaff
    .map(r => {
      const staffGroups = r.staff
        .map(s => {
          const items = s.clients.filter(filterFn).sort((a, b) => amountOf(b) - amountOf(a))
          return { id: s.id, name: s.name, items, total: items.reduce((a, c) => a + amountOf(c), 0) }
        })
        .filter(g => g.items.length > 0)
        .sort((a, b) => b.total - a.total)
      return {
        roomName: r.roomName,
        staffGroups,
        total: staffGroups.reduce((a, g) => a + g.total, 0),
        count: staffGroups.reduce((a, g) => a + g.items.length, 0),
      }
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.total - a.total)

  const unpaidByRoom = groupByRoomStaff(
    c => c.periodFee > 0 && c.collected < c.periodFee,
    c => c.periodFee - c.collected)
  const unpaidCount = unpaidByRoom.reduce((a, r) => a + r.count, 0)

  const otherDebtByRoom = groupByRoomStaff(
    c => Number(c.other_debt) > 0,
    c => Number(c.other_debt) || 0)
  const otherDebtCount = otherDebtByRoom.reduce((a, r) => a + r.count, 0)

  const khachClients = allOwned
    .filter(c => Number(c.collectedKhach) > 0)
    .sort((a, b) => Number(b.collectedKhach) - Number(a.collectedKhach))

  const toggleCard = (k) => setOpenCard(prev => prev === k ? null : k)
  // Nền xen kẽ đậm/nhạt giữa các công ty cho dễ dò mắt theo hàng (giống tab Công nợ phòng).
  const zebra = (i) => i % 2 === 0 ? 'bg-white' : 'bg-gray-50'

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
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
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
            {/* Grand summary — 6 thẻ, dùng chung khung với tab "Công nợ phòng" (nền trắng, vạch
                màu 4px phía trên, số liệu cùng tông). 3 thẻ bấm mở được bảng chi tiết bên dưới. */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div className="bg-white border border-gray-100 border-t-4 border-t-green-500 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Tổng phí phát sinh</p>
                <p className="text-lg font-bold text-gray-900">{fmt(grandFee)}đ</p>
              </div>

              <button onClick={() => toggleCard('khach')}
                className={'text-left bg-white border border-t-4 border-t-blue-500 rounded-2xl px-4 py-3 transition-colors hover:bg-gray-50 ' +
                  (openCard === 'khach' ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100')}>
                <p className="text-xs text-gray-400 mb-1">Phí thu khác</p>
                <p className={'text-lg font-bold ' + (grandKhach > 0 ? 'text-blue-600' : 'text-gray-300')}>{fmt(grandKhach)}đ</p>
                <p className="text-xs text-gray-400 mt-1">
                  {khachClients.length > 0 ? khachClients.length + ' công ty phát sinh' : 'Không phát sinh'}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {khachClients.length === 0 ? '—' : (openCard === 'khach' ? '▴ Đang mở' : '▾ Xem danh sách')}
                </p>
              </button>

              <div className="bg-white border border-gray-100 border-t-4 border-t-emerald-600 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Đã thu</p>
                <p className="text-lg font-bold text-green-600">{fmt(grandCol)}đ</p>
              </div>

              <button onClick={() => toggleCard('unpaid')}
                className={'text-left bg-white border border-t-4 border-t-red-500 rounded-2xl px-4 py-3 transition-colors hover:bg-gray-50 ' +
                  (openCard === 'unpaid' ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100')}>
                <p className="text-xs text-gray-400 mb-1">Còn phải thu</p>
                <p className={'text-lg font-bold ' + (grandFee - grandCol > 0 ? 'text-red-500' : 'text-green-600')}>
                  {fmt(grandFee - grandCol)}đ
                </p>
                <p className="text-xs text-gray-400 mt-1">{unpaidCount} công ty</p>
                <p className="text-xs text-blue-600 mt-1">
                  {unpaidCount === 0 ? '—' : (openCard === 'unpaid' ? '▴ Đang mở' : '▾ Xem danh sách')}
                </p>
              </button>

              <div className="bg-white border border-gray-100 border-t-4 border-t-gray-400 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Tỉ lệ thu hồi</p>
                <p className={'text-lg font-bold ' + pctClr(grandPct)}>{grandPct}%</p>
                <div className="mt-2"><Bar value={grandPct} /></div>
              </div>

              <button onClick={() => toggleCard('otherDebt')}
                className={'text-left bg-white border border-t-4 border-t-orange-500 rounded-2xl px-4 py-3 transition-colors hover:bg-gray-50 ' +
                  (openCard === 'otherDebt' ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-100')}>
                <p className="text-xs text-gray-400 mb-1">Nợ tồn cũ (tách biệt)</p>
                <p className={'text-lg font-bold ' + (grandOtherDebt > 0 ? 'text-orange-500' : 'text-green-600')}>{fmt(grandOtherDebt)}đ</p>
                <p className="text-xs text-gray-400 mt-1">
                  {otherDebtCount} công ty · <span className="italic">tính đến hiện tại</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {otherDebtCount === 0 ? '—' : (openCard === 'otherDebt' ? '▴ Đang mở' : '▾ Xem danh sách')}
                </p>
              </button>
            </div>

            {/* Bảng chi tiết của thẻ đang mở */}
            {openCard === 'unpaid' && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">📋 Công ty còn phải thu — nhóm theo phòng</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{unpaidCount} cty</span>
                    <button onClick={() => setOpenCard(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                  </div>
                </div>
                {unpaidByRoom.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400">Tất cả công ty đã thu đủ 🎉</p>
                ) : unpaidByRoom.map(r => (
                  <div key={r.roomName}>
                    <div className="px-4 py-2 bg-gray-200/70 flex items-center justify-between border-y border-gray-200">
                      <p className="text-xs font-bold text-gray-800">Phòng {r.roomName}</p>
                      <p className="text-xs font-bold text-red-600">{r.count} cty · {fmt(r.total)}đ</p>
                    </div>
                    {r.staffGroups.map(g => (
                      <div key={g.id}>
                        <div className="px-4 pl-7 py-1.5 bg-gray-50 flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-600">{g.name}</p>
                          <p className="text-xs font-semibold text-red-500">{g.items.length} cty · {fmt(g.total)}đ</p>
                        </div>
                        {g.items.map((c, i) => (
                          <div key={c.id} className={'px-4 py-2 pl-11 flex items-start justify-between gap-3 border-b border-gray-50 ' + zebra(i)}>
                            <p className="text-xs text-gray-700 truncate min-w-0">{c.name}</p>
                            <p className="text-xs whitespace-nowrap flex-shrink-0">
                              <span className="text-gray-400">{fmt(c.collected)} / </span>
                              <span className="font-semibold text-gray-800">{fmt(c.periodFee)}đ</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {openCard === 'khach' && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">🗂 Các khoản phí thu khác — {periodLabel}</p>
                  <button onClick={() => setOpenCard(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                </div>
                {khachClients.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400">Kỳ này không có khoản thu khác nào.</p>
                ) : khachClients.map((c, i) => (
                  <div key={c.id} className={'px-4 py-2.5 flex items-start justify-between gap-3 border-b border-gray-50 ' + zebra(i)}>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 break-words">
                        {c.roomName} · {c.staffName}
                        {(c.khachDetails || []).length === 0
                          ? ''
                          : ' · ' + c.khachDetails
                              .map(d => (period === 'month' ? '' : 'T' + d.month + ': ') + (d.note || '(không có ghi chú)'))
                              .join(' | ')}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-blue-600 whitespace-nowrap flex-shrink-0">{fmt(c.collectedKhach)}đ</p>
                  </div>
                ))}
              </div>
            )}

            {openCard === 'otherDebt' && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">📦 Công ty còn nợ tồn cũ <span className="font-normal text-gray-400 italic">(tính đến hiện tại)</span></p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{otherDebtCount} cty</span>
                    <button onClick={() => setOpenCard(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                  </div>
                </div>
                {otherDebtByRoom.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400">Không có công ty nào còn nợ tồn 🎉</p>
                ) : otherDebtByRoom.map(r => (
                  <div key={r.roomName}>
                    <div className="px-4 py-2 bg-gray-200/70 flex items-center justify-between border-y border-gray-200">
                      <p className="text-xs font-bold text-gray-800">Phòng {r.roomName}</p>
                      <p className="text-xs font-bold text-orange-600">{r.count} cty · {fmt(r.total)}đ</p>
                    </div>
                    {r.staffGroups.map(g => (
                      <div key={g.id}>
                        <div className="px-4 pl-7 py-1.5 bg-gray-50 flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-600">{g.name}</p>
                          <p className="text-xs font-semibold text-orange-500">{g.items.length} cty · {fmt(g.total)}đ</p>
                        </div>
                        {g.items.map((c, i) => (
                          <div key={c.id} className={'px-4 py-2 pl-11 flex items-start justify-between gap-3 border-b border-gray-50 ' + zebra(i)}>
                            <p className="text-xs text-gray-700 truncate min-w-0">{c.name}</p>
                            <p className="text-xs font-semibold text-orange-500 whitespace-nowrap flex-shrink-0">{fmt(c.other_debt)}đ</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

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
                          <div className="divide-y divide-gray-200">
                            {s.clients.map((c, ci) => {
                              const st = debtStatus(c)
                              const fee = Number(c.periodFee) || 0
                              // Chưa đến hạn quý -> vẫn hiện đúng số tiền thật (không phải 0đ)
                              const displayFee = fee === 0 && c.fee_period === 'quarterly' ? (Number(c.monthly_fee) || 0) : fee
                              const col = c.collected
                              const colPct = fee === 0 ? 100 : Math.min(100, Math.round(col / fee * 100))
                              return (
                                <div key={c.id} className={'px-4 py-2.5 ' + (ci % 2 ? 'bg-gray-50/70' : 'bg-white')}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm text-gray-800 font-medium break-words">{c.name}</p>
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
                                      <p className="text-xs text-gray-500 mt-0.5">{col > 0 ? fmt(col) + '/' : ''}{fmt(displayFee)}đ</p>
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
                                const displayFee = fee === 0 && c.fee_period === 'quarterly' ? (Number(c.monthly_fee) || 0) : fee
                                const col = c.collected
                                return (
                                  <div key={'sec-' + c.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm text-gray-700 font-medium break-words">{c.name}</p>
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
                                    <p className="text-xs text-gray-400 flex-shrink-0">{col > 0 ? fmt(col) + '/' : ''}{fmt(displayFee)}đ</p>
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
