'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import ClientChecklist from '@/components/ClientChecklist'
import * as XLSX from 'xlsx'
import { feeCountsForMonth } from '@/lib/feeDue'

const fmt    = (n) => Number(n || 0).toLocaleString('vi-VN')
const pctClr = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-500' : 'text-red-500'
const barClr = (v) => v >= 90 ? 'bg-green-500'   : v >= 70 ? 'bg-yellow-400'   : 'bg-red-400'

// Task status colors + labels
const STATUS_STYLE = {
  done_ontime: { bg: 'bg-green-500',  border: 'border-green-500',  text: 'text-green-700',  label: 'Đúng hạn' },
  done_late1:  { bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-700', label: 'Trễ 1-2 ngày' },
  done_late3:  { bg: 'bg-red-400',    border: 'border-red-400',    text: 'text-red-600',    label: 'Trễ ≥3 ngày' },
  overdue:     { bg: 'bg-red-200',    border: 'border-red-300',    text: 'text-red-500',    label: 'Quá hạn' },
  pending:     { bg: 'bg-gray-200',   border: 'border-gray-300',   text: 'text-gray-400',   label: 'Chưa làm' },
}

function Bar({ value }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={'h-full rounded-full transition-all ' + barClr(value || 0)}
        style={{ width: Math.min(100, value || 0) + '%' }} />
    </div>
  )
}


export default function RoomPage({ params }) {
  const { roomId } = use(params)
  const router = useRouter()
  const now = new Date()

  const [selYear,   setSelYear]   = useState(now.getFullYear())
  const [selMonth,  setSelMonth]  = useState(now.getMonth() + 1)
  const [tab,       setTab]       = useState('report')
  const [room,      setRoom]      = useState(null)
  const [staffData, setStaffData] = useState([])
  const [totals,    setTotals]    = useState(null)
  const [ready,     setReady]     = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [openStaff,   setOpenStaff]   = useState({})  // staffId → bool
  const [openClient,  setOpenClient]  = useState({})  // clientId → bool
  const [clientMonth, setClientMonth] = useState({})  // clientId → month number
  const [debtTabLoading, setDebtTabLoading] = useState(false)

  const monthOpts = []
  let y = now.getFullYear(), m = now.getMonth() + 1
  for (let i = 0; i < 12; i++) {
    monthOpts.push({ label: 'T' + m + '/' + y, value: y + '-' + String(m).padStart(2, '0') })
    m--; if (m === 0) { m = 12; y-- }
  }

  // Step 1: Access check
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      let role = 'staff', myRoomId = null
      const { data: me } = await supabase.from('staff').select('role, room_id').eq('id', sd.session.user.id).single()
      if (me && me.role) { role = me.role; myRoomId = me.room_id }
      else {
        const email = sd.session.user.email || ''
        role = (sd.session.user.user_metadata && sd.session.user.user_metadata.role)
          || (email === 'admin@savitax.vn' ? 'admin' : 'staff')
      }
      if (!['admin', 'leader', 'manager'].includes(role) && myRoomId !== roomId) setForbidden(true)
      setIsAdmin(['admin', 'leader', 'manager'].includes(role))
      setReady(true)
    }
    check()
  }, [router, roomId])

  // Step 2: Load data
  useEffect(() => {
    if (!ready || forbidden) return
    load()
  }, [ready, forbidden, selYear, selMonth])


  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/room?roomId=' + roomId + '&year=' + selYear + '&month=' + selMonth + '&_t=' + Date.now(), { cache: 'no-store' })
      const json = await res.json()
      if (!json.error) { setRoom(json.room); setStaffData(json.staff || []); setTotals(json.totals || null) }
    } catch (_) {}
    setLoading(false)
  }

  const toggleStaff   = (id) => setOpenStaff(p  => ({ ...p, [id]: !p[id] }))
  const toggleClient  = (id) => setOpenClient(p => ({ ...p, [id]: !p[id] }))

  // ── Export Excel: Báo cáo phòng ──────────────────────────────────────────
  const exportBaoCao = () => {
    const roomName = room ? room.name : 'Phong'
    const wb = XLSX.utils.book_new()

    // Sheet 1: Tổng hợp nhân viên
    const summaryRows = [
      ['BÁO CÁO PHÒNG ' + roomName.toUpperCase() + ' — T' + selMonth + '/' + selYear],
      [],
      ['Nhân viên', 'Số công ty', 'Hoàn thành việc (%)', 'Việc đúng hạn', 'Tổng việc', 'Thu phí (%)', 'Đã thu (đ)', 'Tổng phí (đ)'],
    ]
    for (const s of staffData) {
      summaryRows.push([
        s.full_name,
        s.clientCount,
        s.taskPct,
        s.clients.reduce((a, c) => a + c.tasks.filter(t => t.status === 'done_ontime').length, 0),
        s.clients.reduce((a, c) => a + c.tasks.length, 0),
        s.debtPct,
        s.collectedFee,
        s.totalFee,
      ])
    }
    summaryRows.push([])
    summaryRows.push(['TỔNG PHÒNG', totals?.clientCount || 0, totals?.taskPct || 0, totals?.doneTasks || 0, totals?.totalTasks || 0, totals?.debtPct || 0, totals?.collected || 0, totals?.totalFee || 0])

    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows)
    ws1['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }]
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp')

    // Sheet 2: Chi tiết công việc từng công ty
    const detailRows = [
      ['CHI TIẾT CÔNG VIỆC — T' + selMonth + '/' + selYear + ' — PHÒNG ' + roomName.toUpperCase()],
      [],
      ['Nhân viên', 'Công ty', 'MST', 'Phí tháng (đ)', 'Công việc', 'Deadline', 'Trạng thái'],
    ]
    const statusLabel = { done_ontime: 'Đúng hạn', done_late1: 'Trễ 1-2 ngày', done_late3: 'Trễ ≥3 ngày', overdue: 'Quá hạn', pending: 'Chưa làm' }
    for (const s of staffData) {
      for (const c of s.clients) {
        for (const t of c.tasks) {
          detailRows.push([
            s.full_name,
            c.name,
            c.tax_code,
            Number(c.monthly_fee) || 0,
            t.name,
            `${t.deadline_day}/${selMonth}/${selYear}`,
            statusLabel[t.status] || t.status,
          ])
        }
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
    ws2['!cols'] = [{ wch: 22 }, { wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 14 }]
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết công việc')

    XLSX.writeFile(wb, `BaoCaoPhong_${roomName}_T${selMonth}_${selYear}.xlsx`)
  }

  // ── Export Excel: Công nợ phòng ──────────────────────────────────────────
  // dueThisMonth: công ty quý chưa tới hạn thu (hoặc còn trong hạn khoan) không tính vào %/tổng
  // — xem lib/feeDue.js. isSecondary: công ty phụ trách phụ chỉ theo dõi, không cộng doanh thu.
  const exportCongNo = () => {
    const roomName = room ? room.name : 'Phong'
    const wb = XLSX.utils.book_new()

    const rows = [
      ['CÔNG NỢ PHÒNG ' + roomName.toUpperCase() + ' — T' + selMonth + '/' + selYear],
      [],
      ['Nhân viên', 'Công ty', 'MST', 'Phí kế toán (đ)', 'Đã thu KT (đ)', 'Còn phải thu (đ)', 'Dịch vụ khác (đ)', 'Trạng thái', 'Ghi chú'],
    ]
    let totFee = 0, totKetoan = 0, totKhach = 0
    for (const s of staffData) {
      let sFee = 0, sKetoan = 0
      const staffRows = []
      for (const c of s.clients) {
        const dueThisMonth = feeCountsForMonth(c.fee_period, selYear, selMonth)
        const fee     = dueThisMonth ? Number(c.monthly_fee) || 0 : 0
        const ketoan  = dueThisMonth ? Number(c.collected) || 0 : 0
        const khach   = Number(c.collectedKhach) || 0
        const remain  = Math.max(0, fee - ketoan)
        const status  = !dueThisMonth ? 'Chưa đến hạn' : fee === 0 ? '—' : ketoan >= fee ? 'Đã thu đủ' : ketoan > 0 ? 'Thu một phần' : 'Chưa thu'
        const note    = c.isSecondary ? 'Phụ trách phụ (không tính vào tổng)' : ''
        if (!c.isSecondary) { sFee += fee; sKetoan += ketoan }
        staffRows.push([s.full_name, c.name, c.tax_code, fee, ketoan, remain, khach, status, note])
      }
      if (staffRows.length === 0) continue
      const sPct = sFee === 0 ? 0 : Math.round(sKetoan / sFee * 100)
      rows.push(...staffRows)
      rows.push(['', 'Tổng ' + s.full_name + ' (' + sPct + '% thu hồi)', '', sFee, sKetoan, Math.max(0, sFee - sKetoan), '', '', ''])
      rows.push([])
      totFee += sFee; totKetoan += sKetoan
      totKhach += s.clients.reduce((a, c) => a + (Number(c.collectedKhach) || 0), 0)
    }
    const totPct = totFee === 0 ? 0 : Math.round(totKetoan / totFee * 100)
    rows.push(['TỔNG PHÒNG (' + totPct + '% thu hồi)', '', '', totFee, totKetoan, Math.max(0, totFee - totKetoan), totKhach, '', ''])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }]
    XLSX.utils.book_append_sheet(wb, ws, 'Công nợ')

    XLSX.writeFile(wb, `CongNoPhong_${roomName}_T${selMonth}_${selYear}.xlsx`)
  }

  // Sau khi lưu công nợ → reload room data (dùng service role key, đảm bảo lấy đúng data)
  const refreshDebtFees = async () => {
    console.log('[refreshDebtFees] called, reloading room data...')
    setDebtTabLoading(true)
    await load()
    console.log('[refreshDebtFees] done, staffData updated')
    setDebtTabLoading(false)
  }

  if (!ready) return <AppShell><div className="flex justify-center items-center min-h-64"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div></AppShell>
  if (forbidden) return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-64 text-center px-4">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-700 font-medium">Không có quyền truy cập</p>
        <button onClick={() => router.push('/rooms')} className="mt-4 text-sm text-blue-600 hover:underline">← Phòng nghiệp vụ</button>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <button onClick={() => router.push('/rooms')} className="text-sm text-gray-400 hover:text-blue-600 transition-colors">
              ← Phòng nghiệp vụ
            </button>
            <h1 className="text-xl font-bold text-gray-900 mt-1">
              {room ? 'Phòng ' + room.name : '...'}
              {room && room.type === 'remote' && <span className="ml-2 text-xs font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Remote</span>}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{totals ? totals.clientCount + ' công ty · ' + staffData.length + ' nhân viên' : ''}</p>
          </div>
          <select
            value={selYear + '-' + String(selMonth).padStart(2, '0')}
            onChange={e => { const p = e.target.value.split('-'); setSelYear(Number(p[0])); setSelMonth(Number(p[1])) }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-shrink-0"
          >
            {monthOpts.map(mo => <option key={mo.value} value={mo.value}>{mo.label}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
          {[
            { key: 'report', label: 'Báo cáo phòng' },
            { key: 'debt',   label: 'Công nợ phòng' },
            { key: 'staff',  label: 'Nhân viên (' + staffData.length + ')' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={'px-4 py-1.5 rounded-lg text-sm font-medium transition-all ' +
                (tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── TAB: BÁO CÁO PHÒNG ── */}
            {tab === 'report' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={exportBaoCao}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Xuất Excel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Hoàn thành công việc', pct: totals ? totals.taskPct : 0, sub: totals ? totals.doneTasks + '/' + totals.totalTasks + ' việc' : '—' },
                    { label: 'Thu hồi công nợ', pct: totals ? totals.debtPct : 0, sub: totals ? fmt(totals.collected) + '/' + fmt(totals.totalFee) + 'đ' : '—' },
                  ].map(c => (
                    <div key={c.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                      <p className={'text-2xl font-bold ' + pctClr(c.pct)}>{c.pct}%</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                      <Bar value={c.pct} />
                    </div>
                  ))}
                </div>

                {/* Staff ranking */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50 grid grid-cols-[1fr_72px_72px] gap-2">
                    <p className="text-xs font-semibold text-gray-400">Nhân viên</p>
                    <p className="text-xs font-semibold text-gray-400 text-center">Công việc</p>
                    <p className="text-xs font-semibold text-gray-400 text-center">Thu phí</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[...staffData].sort((a, b) => b.taskPct - a.taskPct).map((s, i) => (
                      <div key={s.id} className="px-4 py-3">
                        <div className="grid grid-cols-[1fr_72px_72px] gap-2 items-center mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{s.full_name}</p>
                              <p className="text-xs text-gray-400">{s.clientCount} cty</p>
                            </div>
                          </div>
                          <p className={'text-sm font-bold text-center ' + pctClr(s.taskPct)}>{s.taskPct}%</p>
                          <p className={'text-sm font-bold text-center ' + pctClr(s.debtPct)}>{s.debtPct}%</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          <Bar value={s.taskPct} />
                          <Bar value={s.debtPct} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: NHÂN VIÊN ── */}
            {tab === 'staff' && (
              <div className="space-y-3">
                {staffData.map(s => (
                  <div key={s.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    {/* Staff header */}
                    <button onClick={() => toggleStaff(s.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-600">
                          {s.full_name ? s.full_name.trim().split(' ').pop().charAt(0).toUpperCase() : '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">{s.clientCount} cty</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                              <span>Công việc</span><span className={pctClr(s.taskPct)}>{s.taskPct}%</span>
                            </div>
                            <Bar value={s.taskPct} />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                              <span>Thu phí</span><span className={pctClr(s.debtPct)}>{s.debtPct}%</span>
                            </div>
                            <Bar value={s.debtPct} />
                          </div>
                        </div>
                      </div>
                      <span className={'text-gray-300 flex-shrink-0 transition-transform text-sm ' + (openStaff[s.id] ? 'rotate-180' : '')}>▾</span>
                    </button>

                    {/* Companies under this staff */}
                    {openStaff[s.id] && (
                      <div className="border-t border-gray-100 divide-y divide-gray-200">
                        {s.clients.length === 0 ? (
                          <p className="text-xs text-gray-400 px-4 py-3 text-center">Chưa có công ty nào</p>
                        ) : s.clients.map((c, ci) => (
                          <div key={c.id} className={ci % 2 ? 'bg-gray-50/70' : 'bg-white'}>
                            {/* Company row */}
                            <button onClick={() => toggleClient(c.id)}
                              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50/60 transition-colors text-left">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium text-gray-800 break-words">{c.name}</p>
                                  <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border ' +
                                    (c.report_type === 'quarterly'
                                      ? 'bg-purple-100 text-purple-700 border-purple-300'
                                      : 'bg-blue-100 text-blue-700 border-blue-300')}>
                                    {c.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-gray-400">{c.tax_code}</span>
                                  <span className="text-xs text-blue-600 font-medium">{fmt(c.monthly_fee)}đ</span>
                                  <span className={'text-xs font-semibold ' + pctClr(c.taskTotal > 0 ? Math.round(c.taskDone/c.taskTotal*100) : 100)}>
                                    {c.taskDone}/{c.taskTotal} việc T{selMonth}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {/* Mini task dots */}
                                <div className="flex gap-0.5">
                                  {c.tasks.slice(0, 8).map(t => (
                                    <span key={t.id} className={'w-2 h-2 rounded-full ' + STATUS_STYLE[t.status].bg} title={t.name + ': ' + STATUS_STYLE[t.status].label} />
                                  ))}
                                  {c.tasks.length > 8 && <span className="text-xs text-gray-300 ml-0.5">+{c.tasks.length - 8}</span>}
                                </div>
                                <span className={'text-gray-300 text-sm transition-transform ' + (openClient[c.id] ? 'rotate-180' : '')}>▾</span>
                              </div>
                            </button>

                            {/* Checklist for this company */}
                            {openClient[c.id] && (
                              <ClientChecklist
                                client={c}
                                defaultMonth={selMonth}
                                defaultYear={selYear}
                                clientMonth={clientMonth[c.id] || selMonth}
                                onMonthChange={m => setClientMonth(p => ({ ...p, [c.id]: m }))}
                                onDebtSaved={refreshDebtFees}
                                isAdmin={isAdmin}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* ── TAB: CÔNG NỢ PHÒNG ── */}
            {tab === 'debt' && (() => {
              const isMonthPast = now > new Date(selYear, selMonth - 1, new Date(selYear, selMonth, 0).getDate(), 23, 59)
              // c.collected = ketoan, c.collectedKhach = khach (từ room API — service role key)
              // dueThisMonth: công ty quý chưa tới hạn thu (hoặc còn trong hạn khoan) không tính
              // vào tổng công nợ tháng này — xem lib/feeDue.js.
              const allClients = staffData.flatMap(s => s.clients.map(c => ({
                ...c,
                ketoan: Number(c.collected) || 0,
                khach:  Number(c.collectedKhach) || 0,
                dueThisMonth: feeCountsForMonth(c.fee_period, selYear, selMonth),
              })))
              // Công ty "phụ trách phụ" chỉ để theo dõi, KHÔNG cộng vào doanh thu/công nợ của
              // nhân viên phụ — chỉ tính tổng theo công ty mình là nhân viên chính.
              const ownedClients = allClients.filter(c => !c.isSecondary)
              const totalFee    = ownedClients.reduce((a, c) => a + (c.dueThisMonth ? Number(c.monthly_fee) || 0 : 0), 0)
              const totalKetoan = ownedClients.reduce((a, c) => a + (c.dueThisMonth ? c.ketoan : 0), 0)
              const debtPct     = totalFee === 0 ? 0 : Math.round(totalKetoan / totalFee * 100)
              const overdue     = ownedClients.filter(c => c.dueThisMonth && isMonthPast && c.ketoan < Number(c.monthly_fee) && Number(c.monthly_fee) > 0)

              // pill: badge đặc màu (nền đậm + chữ trắng) — thay cho chữ màu nhạt cũ, dễ quan
              // sát "đã thu"/"chưa thu" hơn khi lướt nhanh danh sách.
              const debtStatus = (ketoan, fee, notDueYet) => {
                if (notDueYet) {
                  return ketoan > 0
                    ? { label: 'Đã thu (chưa đến hạn)', color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500', pill: 'bg-green-600' }
                    : { label: 'Chưa đến hạn quý',      color: 'text-gray-500',  bg: 'bg-gray-50',  dot: 'bg-gray-300',  pill: 'bg-gray-400' }
                }
                if (fee === 0) return { label: '—', color: 'text-gray-400', bg: '', dot: 'bg-gray-200', pill: 'bg-gray-300' }
                if (ketoan >= fee) return { label: 'Đã thu đủ',    color: 'text-green-700', bg: 'bg-green-50',  dot: 'bg-green-500', pill: 'bg-green-600' }
                if (ketoan > 0)   return { label: 'Thu một phần', color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-400', pill: 'bg-yellow-500' }
                if (isMonthPast)  return { label: 'Quá hạn',      color: 'text-red-700',   bg: 'bg-red-50',    dot: 'bg-red-500', pill: 'bg-red-500' }
                return               { label: 'Chưa thu',         color: 'text-red-600',  bg: 'bg-red-50',    dot: 'bg-red-400', pill: 'bg-red-500' }
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">T{selMonth}/{selYear}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={exportCongNo}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Xuất Excel
                    </button>
                    <button onClick={refreshDebtFees} disabled={debtTabLoading}
                      className="text-xs px-3 py-1 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                      {debtTabLoading
                        ? <><span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin inline-block" /> Đang tải...</>
                        : '↻ Tải lại'}
                    </button>
                  </div>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-1">📋 Phí kế toán tháng này</p>
                      <p className="text-lg font-bold text-gray-900">{fmt(totalFee)}đ</p>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-600 font-medium">Đã thu: {fmt(totalKetoan)}đ</span>
                        <span className={pctClr(debtPct) + ' font-bold'}>{debtPct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                        <div className={'h-full rounded-full ' + barClr(debtPct)} style={{ width: debtPct + '%' }} />
                      </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-1">💰 Còn phải thu</p>
                      <p className={'text-lg font-bold ' + (totalFee - totalKetoan > 0 ? 'text-red-500' : 'text-green-600')}>
                        {fmt(totalFee - totalKetoan)}đ
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {allClients.filter(c => c.ketoan < Number(c.monthly_fee) && Number(c.monthly_fee) > 0).length} công ty chưa đủ
                      </p>
                    </div>
                  </div>

                  {/* Warning */}
                  {overdue.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <span className="text-red-500">🔴</span>
                      <p className="text-xs font-semibold text-red-700">{overdue.length} công ty quá hạn thu phí dịch vụ kế toán</p>
                    </div>
                  )}

                  {/* Per staff */}
                  {staffData.map(s => {
                    const myClients = s.clients.map(c => ({
                      ...c, ketoan: Number(c.collected) || 0, khach: Number(c.collectedKhach) || 0,
                      dueThisMonth: feeCountsForMonth(c.fee_period, selYear, selMonth),
                    }))
                    if (myClients.length === 0) return null
                    // Công ty phụ trách phụ chỉ theo dõi, không cộng vào doanh thu/công nợ.
                    const sOwnedClients = myClients.filter(c => !c.isSecondary)
                    const sFee    = sOwnedClients.reduce((a, c) => a + (c.dueThisMonth ? Number(c.monthly_fee) || 0 : 0), 0)
                    const sKetoan = sOwnedClients.reduce((a, c) => a + (c.dueThisMonth ? c.ketoan : 0), 0)
                    const sPct    = sFee === 0 ? 0 : Math.round(sKetoan / sFee * 100)
                    const borderClr = sPct >= 90 ? '#22C55E' : sPct >= 70 ? '#EAB308' : '#EF4444'
                    return (
                      <div key={s.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                        {/* Staff header — viền màu theo %, số tiền hiển thị to/rõ hơn */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between"
                          style={{ borderLeft: '5px solid ' + borderClr }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-blue-600">
                                {s.full_name ? s.full_name.trim().split(' ').pop().charAt(0).toUpperCase() : '?'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{s.full_name}</p>
                              <p className="text-xs text-gray-400">{myClients.length} cty</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={'text-2xl font-bold leading-none ' + pctClr(sPct)}>{sPct}%</p>
                            <p className="text-sm font-semibold text-gray-600 mt-1">{fmt(sKetoan)} / {fmt(sFee)}đ</p>
                          </div>
                        </div>
                        {/* Company rows */}
                        <div className="divide-y divide-gray-50">
                          {myClients.map(c => {
                            const fee = Number(c.monthly_fee) || 0
                            const notDueYet = c.fee_period === 'quarterly' && !c.dueThisMonth && fee > 0
                            const st  = debtStatus(c.ketoan, fee, notDueYet)
                            const colPct = fee === 0 ? 0 : Math.min(100, Math.round(c.ketoan / fee * 100))
                            return (
                              <div key={c.id} className={'px-4 py-3 ' + st.bg}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <p className="text-sm font-medium text-gray-800 break-words">{c.name}</p>
                                      <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border ' +
                                        (c.report_type === 'quarterly'
                                          ? 'bg-purple-100 text-purple-700 border-purple-300'
                                          : 'bg-blue-100 text-blue-700 border-blue-300')}>
                                        {c.report_type === 'quarterly' ? 'Quý' : 'Tháng'}
                                      </span>
                                      {c.isSecondary && (
                                        <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Phụ trách phụ</span>
                                      )}
                                    </div>
                                    {/* Progress nếu một phần */}
                                    {c.ketoan > 0 && c.ketoan < fee && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden w-24">
                                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: colPct + '%' }} />
                                        </div>
                                        <span className="text-xs text-orange-500">còn thiếu {fmt(fee - c.ketoan)}đ</span>
                                      </div>
                                    )}
                                    {/* Dịch vụ khách — chỉ hiện nếu có */}
                                    {c.khach > 0 && (
                                      <p className="text-xs text-blue-500 mt-1">🗂 DV khác đã thu: <span className="font-medium">{fmt(c.khach)}đ</span></p>
                                    )}
                                  </div>
                                  {/* Số tiền + trạng thái — làm to, rõ để dễ quan sát nhanh */}
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-base font-bold text-gray-800 whitespace-nowrap">
                                      {c.ketoan > 0 ? fmt(c.ketoan) + ' / ' : ''}{fmt(fee)}đ
                                    </p>
                                    <span className={'inline-block mt-1 text-xs font-medium text-white px-2.5 py-1 rounded-full ' + st.pill}>
                                      {st.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}
      </div>
    </AppShell>
  )
}
