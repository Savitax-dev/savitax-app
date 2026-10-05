'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import ClientChecklist from '@/components/ClientChecklist'
import { hasPermission } from '@/lib/permissions'
import * as XLSX from 'xlsx'
import { feeCountsForMonth } from '@/lib/feeDue'
import { isSharedRoom } from '@/lib/specialRooms'

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
  const [hcnsOn,    setHcnsOn]    = useState(false)
  // Khối dòng tiền công nợ phòng — MÁY CHỦ tính sẵn (lib/dongTienPhong.js), trang chỉ hiển thị.
  const [dongTien,  setDongTien]  = useState(null)
  const [xoaNoBusy, setXoaNoBusy] = useState(null)
  // Xoá nợ không đòi được của công ty đã ngưng dịch vụ — chỉ Quản trị, bắt buộc ghi lý do.
  // Hỏi máy chủ số sẽ xoá TRƯỚC (dryRun) để người bấm thấy đúng con số rồi mới xác nhận.
  const xoaNo = async (x) => {
    setXoaNoBusy(x.clientId)
    try {
      const goi = (body) => fetch('/api/admin/debt-writeoff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(r => r.json())
      const xem = await goi({ clientId: x.clientId, dryRun: 1 })
      if (xem.error) { alert(xem.error); return }
      const lyDo = prompt('XOÁ NỢ ' + x.name + '\n\nSố sẽ xoá: ' + fmt(xem.amount) + 'đ (phí kế toán còn phải thu)\n'
        + 'Thao tác này đưa nợ tồn của công ty về 0 và KHÔNG tính là tiền đã thu.\n\nNhập lý do xoá nợ:')
      if (lyDo === null) return
      if (lyDo.trim().length < 5) { alert('Phải ghi lý do (ít nhất 5 ký tự).'); return }
      const kq = await goi({ clientId: x.clientId, reason: lyDo.trim() })
      if (kq.error) { alert(kq.error); return }
      alert('Đã xoá nợ ' + fmt(kq.amount) + 'đ của ' + x.name)
      await load()
    } finally { setXoaNoBusy(null) }
  }
  const [ready,     setReady]     = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [isTrueAdmin, setIsTrueAdmin] = useState(false)
  const [canUncheck, setCanUncheck] = useState(false)
  const [openStaff,   setOpenStaff]   = useState({})  // staffId → bool
  const [openClient,  setOpenClient]  = useState({})  // clientId → bool
  const [clientMonth, setClientMonth] = useState({})  // clientId → month number
  const [debtTabLoading, setDebtTabLoading] = useState(false)
  // Thẻ dòng tiền nào ở tab "Công nợ phòng" đang mở bảng chi tiết ('ton' | 'hcns' | 'khac' |
  // 'chuyen' | null) — mỗi lúc chỉ mở 1 bảng cho gọn, bấm lại thẻ đó để đóng.
  const [openDebtCard, setOpenDebtCard] = useState(null)

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
      // Chỉ admin thật được xem mọi phòng — trưởng phòng/nhân viên chỉ vào đúng phòng mình thuộc về.
      // Ngoại lệ: phòng "đặc thù" (lib/specialRooms.js) — MỌI trưởng phòng đều vào được như phòng
      // mình. Phải khớp đúng điều kiện với requireRoomAccess ở lib/serverAuth.js (server cũng chặn
      // độc lập) — nếu chỉ sửa 1 trong 2 thì hoặc bị chặn oan ở đây, hoặc lọt qua UI rồi API mới báo lỗi.
      const canEnter = role === 'admin' || myRoomId === roomId || (role === 'leader' && isSharedRoom(roomId))
      if (!canEnter) setForbidden(true)
      setIsAdmin(['admin', 'leader', 'manager'].includes(role))
      setIsTrueAdmin(role === 'admin')
      setCanUncheck(await hasPermission(role, 'uncheck_task'))
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
      if (!json.error) { setRoom(json.room); setStaffData(json.staff || []); setTotals(json.totals || null); setHcnsOn(!!json.hcnsInstalled); setDongTien(json.dongTien || null) }
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
      ['Nhân viên', 'Công ty', 'MST', 'Phí kế toán (đ)', 'Đã thu KT (đ)', 'Còn phải thu (đ)',
       'Phí HCNS (đ)', 'Đã thu HCNS (đ)', 'Dịch vụ khác (đ)', 'Trạng thái', 'Ghi chú'],
    ]
    let totFee = 0, totKetoan = 0, totKhach = 0, totHcnsFee = 0, totHcnsPaid = 0
    for (const s of staffData) {
      let sFee = 0, sKetoan = 0, sHcnsFee = 0, sHcnsPaid = 0
      const staffRows = []
      for (const c of s.clients) {
        const dueThisMonth = feeCountsForMonth(c.fee_period, selYear, selMonth)
        const fee     = dueThisMonth ? Number(c.monthly_fee) || 0 : 0
        const ketoan  = dueThisMonth ? Number(c.collected) || 0 : 0
        const khach   = Number(c.collectedKhach) || 0
        const remain  = Math.max(0, fee - ketoan)
        const status  = !dueThisMonth ? 'Chưa đến hạn' : fee === 0 ? '—' : ketoan >= fee ? 'Đã thu đủ' : ketoan > 0 ? 'Thu một phần' : 'Chưa thu'
        // Phí HCNS xuất riêng 2 cột — cột "Còn phải thu" giữ nguyên chỉ phí kế toán để khớp với
        // dòng tổng %-thu hồi ngay bên dưới (vốn không tính HCNS).
        const hcnsFee  = Number(c.hcnsFee) || 0
        const hcnsPaid = Number(c.hcnsCollected) || 0
        const note    = c.isSecondary ? 'Phụ trách phụ (không tính vào tổng)' : ''
        if (!c.isSecondary) { sFee += fee; sKetoan += ketoan; sHcnsFee += hcnsFee; sHcnsPaid += hcnsPaid }
        staffRows.push([s.full_name, c.name, c.tax_code, fee, ketoan, remain, hcnsFee, hcnsPaid, khach, status, note])
      }
      if (staffRows.length === 0) continue
      const sPct = sFee === 0 ? 0 : Math.round(sKetoan / sFee * 100)
      rows.push(...staffRows)
      rows.push(['', 'Tổng ' + s.full_name + ' (' + sPct + '% thu hồi)', '', sFee, sKetoan,
        Math.max(0, sFee - sKetoan), sHcnsFee, sHcnsPaid, '', '', ''])
      rows.push([])
      totFee += sFee; totKetoan += sKetoan; totHcnsFee += sHcnsFee; totHcnsPaid += sHcnsPaid
      totKhach += s.clients.reduce((a, c) => a + (Number(c.collectedKhach) || 0), 0)
    }
    const totPct = totFee === 0 ? 0 : Math.round(totKetoan / totFee * 100)
    rows.push(['TỔNG PHÒNG (' + totPct + '% thu hồi)', '', '', totFee, totKetoan,
      Math.max(0, totFee - totKetoan), totHcnsFee, totHcnsPaid, totKhach, '', ''])
    rows.push([])
    rows.push(['Ghi chú: % thu hồi chỉ tính phí kế toán. Phí HCNS thu riêng, không vào KPI.'])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }]
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
                                  <span className="text-xs text-blue-600 font-medium">{fmt(c.monthly_fee)}đ/{c.fee_period === 'quarterly' ? 'Quý' : 'Tháng'}</span>
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
                                isTrueAdmin={isTrueAdmin}
                                canUncheck={canUncheck}
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
                // Phí HCNS đi kèm nhưng KHÔNG cộng vào ketoan — %-KPI thu hồi công nợ chỉ tính
                // phí kế toán, đây là yêu cầu chốt chứ không phải thiếu sót.
                hcnsFee: Number(c.hcnsFee) || 0,
                hcnsPaid: Number(c.hcnsCollected) || 0,
                hcnsRemain: Math.max(0, (Number(c.hcnsFee) || 0) - (Number(c.hcnsCollected) || 0)),
                dueThisMonth: feeCountsForMonth(c.fee_period, selYear, selMonth),
              })))
              // Công ty "phụ trách phụ" chỉ để theo dõi, KHÔNG cộng vào doanh thu/công nợ của
              // nhân viên phụ — chỉ tính tổng theo công ty mình là nhân viên chính.
              const ownedClients = allClients.filter(c => !c.isSecondary)
              const totalFee    = ownedClients.reduce((a, c) => a + (c.dueThisMonth ? Number(c.monthly_fee) || 0 : 0), 0)
              const totalKetoan = ownedClients.reduce((a, c) => a + (c.dueThisMonth ? c.ketoan : 0), 0)
              const debtPct     = totalFee === 0 ? 0 : Math.round(totalKetoan / totalFee * 100)
              // Cảnh báo "quá hạn" phải bỏ qua công ty đã chuyển nợ tồn và thu xong ở mục đó —
              // xem ketoanRemainOf bên dưới. Trước đây vẫn kêu quá hạn nên nhân viên đi đòi lại
              // khoản khách đã trả.
              const overdue     = ownedClients.filter(c =>
                c.dueThisMonth && isMonthPast && Number(c.monthly_fee) > 0 &&
                ((c.rolloverRemaining !== null && c.rolloverRemaining !== undefined)
                  ? Number(c.rolloverRemaining) > 0
                  : c.ketoan < Number(c.monthly_fee)))

              // ── Dữ liệu cho 3 thẻ bấm mở được ────────────────────────────────────────────
              // Đều CHỈ tính công ty phụ trách CHÍNH (bỏ phụ trách phụ) cho khớp nguyên tắc
              // doanh thu — trước đây dòng "N công ty chưa đủ" đếm cả công ty phụ trách phụ và
              // công ty quý chưa tới hạn nên lệch với số tiền ngay bên trên.
              const staffNameOf = (id) => (staffData.find(s => s.id === id) || {}).full_name || '—'

              // Nợ phí kế toán THẬT của công ty trong tháng đang xem.
              // Tháng đã chốt sổ chuyển nợ tồn (rolloverRemaining khác null) thì khoản chưa thu
              // đã nằm ở "Nợ tồn cũ" và được thu ở đó — tháng gốc KHÔNG bao giờ có thêm dòng
              // 'ketoan' nữa, nên "phí trừ đã thu" sẽ treo mãi dù khách đã trả xong (ca thật:
              // VƯU ĐỨC PHÁT trả đủ 38.880.000đ qua nợ tồn mà T6/T7 vẫn hiện "Quá hạn").
              // Lúc đó số nợ đúng của tháng là phần nợ tồn còn lại.
              const daChuyenNoTon = (c) => c.rolloverRemaining !== null && c.rolloverRemaining !== undefined
              const ketoanRemainOf = (c) => daChuyenNoTon(c)
                ? Math.max(0, Number(c.rolloverRemaining) || 0)
                : (c.dueThisMonth ? Math.max(0, (Number(c.monthly_fee) || 0) - c.ketoan) : 0)
              const hcnsRemainOf = (c) => Math.max(0, (Number(c.hcnsFee) || 0) - (Number(c.hcnsPaid) || 0))
              // ── Phí HCNS ──────────────────────────────────────────────────────────────
              // Nhân viên kế toán là người thu cả phí HCNS, nên khoản này có dòng riêng trong
              // "Tồn đầu kỳ" / "Còn phải thu chuyển kỳ sau". Nhưng nó KHÔNG vào %-KPI thu hồi
              // công nợ — xem chú thích ở ô % của từng nhân viên.
              const hcnsClientsList = ownedClients.filter(c => c.usesHcns && c.hcnsFee > 0)
              const hcnsByStaff = []
              for (const st of staffData) {
                const items = hcnsClientsList.filter(c => c.assigned_to === st.id)
                if (items.length === 0) continue
                hcnsByStaff.push({
                  id: st.id, name: st.full_name, items,
                  fee: items.reduce((a, c) => a + c.hcnsFee, 0),
                  paid: items.reduce((a, c) => a + c.hcnsPaid, 0),
                })
              }
              const toggleCard = (k) => setOpenDebtCard(prev => prev === k ? null : k)
              // Nền xen kẽ đậm/nhạt giữa các công ty cho dễ dò mắt theo hàng.
              const zebra = (i) => i % 2 === 0 ? 'bg-white' : 'bg-gray-50'

              // pill: badge đặc màu (nền đậm + chữ trắng) — thay cho chữ màu nhạt cũ, dễ quan
              // sát "đã thu"/"chưa thu" hơn khi lướt nhanh danh sách.
              // `bg`/`bgAlt` = 2 sắc độ của CÙNG màu trạng thái, dùng xen kẽ theo thứ tự dòng
              // (bgAlt cho dòng lẻ) — giữ nguyên ý nghĩa màu "đã thu / chưa thu" nhưng 2 công ty
              // liền nhau cùng trạng thái vẫn phân biệt được, đỡ mỏi mắt khi dò danh sách dài.
              // rollRemain: nợ tồn còn lại của tháng này (null = tháng chưa chuyển nợ tồn).
              const debtStatus = (ketoan, fee, notDueYet, rollRemain = null) => {
                // Tháng đã chốt sổ chuyển nợ tồn: khoản nợ nằm ở "Nợ tồn cũ", thu ở đó chứ không
                // ghi vào tháng gốc. Hiện đúng trạng thái thay vì "Quá hạn" gây hiểu lầm là khách
                // chưa trả (đã có người đi thu lại lần 2 vì tưởng vậy).
                if (rollRemain !== null && rollRemain !== undefined) {
                  return Number(rollRemain) > 0
                    ? { label: 'Còn nợ tồn',        color: 'text-orange-700', bg: 'bg-orange-50', bgAlt: 'bg-orange-100/70', dot: 'bg-orange-500', pill: 'bg-orange-500' }
                    : { label: 'Đã thu qua nợ tồn', color: 'text-green-700',  bg: 'bg-green-50',  bgAlt: 'bg-green-100/70',  dot: 'bg-green-500',  pill: 'bg-green-600' }
                }
                if (notDueYet) {
                  return ketoan > 0
                    ? { label: 'Đã thu (chưa đến hạn)', color: 'text-green-700', bg: 'bg-green-50', bgAlt: 'bg-green-100/70', dot: 'bg-green-500', pill: 'bg-green-600' }
                    : { label: 'Chưa đến hạn quý',      color: 'text-gray-500',  bg: 'bg-gray-50',  bgAlt: 'bg-gray-100',     dot: 'bg-gray-300',  pill: 'bg-gray-400' }
                }
                if (fee === 0) return { label: '—', color: 'text-gray-400', bg: 'bg-white', bgAlt: 'bg-gray-50', dot: 'bg-gray-200', pill: 'bg-gray-300' }
                if (ketoan >= fee) return { label: 'Đã thu đủ',    color: 'text-green-700', bg: 'bg-green-50',  bgAlt: 'bg-green-100/70',  dot: 'bg-green-500', pill: 'bg-green-600' }
                if (ketoan > 0)   return { label: 'Thu một phần', color: 'text-yellow-700', bg: 'bg-yellow-50', bgAlt: 'bg-yellow-100/70', dot: 'bg-yellow-400', pill: 'bg-yellow-500' }
                if (isMonthPast)  return { label: 'Quá hạn',      color: 'text-red-700',   bg: 'bg-red-50',    bgAlt: 'bg-red-100/70',    dot: 'bg-red-500', pill: 'bg-red-500' }
                return               { label: 'Chưa thu',         color: 'text-red-600',  bg: 'bg-red-50',    bgAlt: 'bg-red-100/70',    dot: 'bg-red-400', pill: 'bg-red-500' }
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

                  {/* ===== KHỐI DÒNG TIỀN CÔNG NỢ PHÒNG =====
                      Tồn đầu kỳ + phí phát sinh trong kỳ − đã thu = còn phải thu chuyển kỳ sau.
                      Mọi con số do MÁY CHỦ tính (lib/dongTienPhong.js) — trang KHÔNG tự cộng lại,
                      vì mỗi trang tự cộng là lại ra số khác nhau (ca %-công nợ 01/10/2026).
                      Thẻ đầu/cuối tách 3 dòng đúng 3 loại thu: kế toán · HCNS · dịch vụ khác. */}
                  {dongTien && (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <button onClick={() => toggleCard('ton')}
                      className={'text-left bg-white border border-t-4 border-t-orange-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                        (openDebtCard === 'ton' ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-100')}>
                      <p className="text-xs text-gray-400 mb-1">📦 Tồn đầu kỳ chuyển sang</p>
                      <p className={'text-lg font-bold ' + (dongTien.tonDau.total > 0 ? 'text-orange-500' : 'text-green-600')}>{fmt(dongTien.tonDau.total)}đ</p>
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-200 space-y-0.5">
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Kế toán</span><span className="font-semibold text-gray-700">{fmt(dongTien.tonDau.ketoan)}đ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">HCNS</span>
                          {dongTien.tonDau.hcnsCoSoLieu
                            ? <span className="font-semibold text-violet-600">{fmt(dongTien.tonDau.hcns)}đ</span>
                            : <span className="text-gray-400 italic">chưa tách riêng</span>}
                        </div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Dịch vụ khác</span><span className="font-semibold text-teal-600">{fmt(dongTien.tonDau.dvk)}đ</span></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dongTien.tonDau.soCty} công ty
                        {dongTien.tonDau.daThuTrongKy > 0 && <span className="text-green-600"> · kỳ này đã thu {fmt(dongTien.tonDau.daThuTrongKy)}đ</span>}
                        {dongTien.tonDau.daXoaTrongKy > 0 && <span className="text-gray-500"> · đã xoá nợ {fmt(dongTien.tonDau.daXoaTrongKy)}đ</span>}
                      </p>
                      <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.tonDau.soCty === 0 ? '—' : (openDebtCard === 'ton' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                    </button>

                    <div className="bg-white border border-gray-100 border-t-4 border-t-green-500 rounded-2xl px-4 py-3 flex flex-col">
                      <p className="text-xs text-gray-400 mb-1">📋 Phí kế toán trong kỳ</p>
                      <p className="text-lg font-bold text-gray-900">{fmt(dongTien.phiKetoan.phi)}đ</p>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-600 font-medium">Đã thu: {fmt(dongTien.phiKetoan.daThu)}đ</span>
                        <span className={pctClr(dongTien.phiKetoan.pct) + ' font-bold'}>{dongTien.phiKetoan.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                        <div className={'h-full rounded-full ' + barClr(dongTien.phiKetoan.pct)} style={{ width: dongTien.phiKetoan.pct + '%' }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dongTien.phiKetoan.soCty} công ty đến hạn
                        {/* Công ty đã ngưng dịch vụ vẫn có phí ở các kỳ họ còn là khách — nói rõ để
                            không ai thắc mắc vì sao thẻ nhỉnh hơn tổng danh sách nhân viên bên dưới. */}
                        {dongTien.phiKetoan.ctyNgung > 0 && (
                          <span className="text-amber-600"> · gồm {fmt(dongTien.phiKetoan.phiNgung)}đ của {dongTien.phiKetoan.ctyNgung} cty đã ngưng DV</span>
                        )}
                      </p>
                    </div>

                    {/* Tím cho HCNS. Thẻ tự ẩn ở bản clone (không có bảng hcns_*). */}
                    {hcnsOn && (
                      <button onClick={() => toggleCard('hcns')}
                        className={'text-left bg-white border border-t-4 border-t-violet-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                          (openDebtCard === 'hcns' ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-100')}>
                        <p className="text-xs text-gray-400 mb-1">🏢 Phí HCNS trong kỳ</p>
                        <p className={'text-lg font-bold ' + (dongTien.phiHcns.phi > 0 ? 'text-violet-600' : 'text-gray-300')}>{fmt(dongTien.phiHcns.phi)}đ</p>
                        {dongTien.phiHcns.phi > 0 ? (<>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-violet-600 font-medium">Đã thu: {fmt(dongTien.phiHcns.daThu)}đ</span>
                            <span className="text-violet-600 font-bold">{dongTien.phiHcns.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: dongTien.phiHcns.pct + '%' }} />
                          </div>
                        </>) : <p className="text-xs text-gray-400 mt-1">Chưa công ty nào dùng DV HCNS</p>}
                        <p className="text-xs text-gray-400 mt-1.5">{dongTien.phiHcns.soCty} công ty dùng DV HCNS</p>
                        <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.phiHcns.phi === 0 ? '—' : (openDebtCard === 'hcns' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                      </button>
                    )}

                    <button onClick={() => toggleCard('khac')}
                      className={'text-left bg-white border border-t-4 border-t-teal-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                        (openDebtCard === 'khac' ? 'border-teal-300 ring-1 ring-teal-200' : 'border-gray-100')}>
                      <p className="text-xs text-gray-400 mb-1">🗂 Phí thu khác trong kỳ</p>
                      <p className={'text-lg font-bold ' + (dongTien.thuKhac.phaiThu > 0 ? 'text-teal-600' : 'text-gray-300')}>{fmt(dongTien.thuKhac.phaiThu)}đ</p>
                      {dongTien.thuKhac.phaiThu > 0 ? (<>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-teal-600 font-medium">Đã thu: {fmt(dongTien.thuKhac.daThu)}đ</span>
                          <span className="text-teal-600 font-bold">{dongTien.thuKhac.pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: dongTien.thuKhac.pct + '%' }} />
                        </div>
                      </>) : <p className="text-xs text-gray-400 mt-1">Kỳ này không phát sinh</p>}
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dongTien.thuKhac.soCty} công ty
                        {dongTien.thuKhac.soHoSo > 0 && <span> · {dongTien.thuKhac.soHoSo} hồ sơ Dịch vụ khác</span>}
                      </p>
                      <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.thuKhac.hoSo.length === 0 ? '—' : (openDebtCard === 'khac' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                    </button>

                    <button onClick={() => toggleCard('chuyen')}
                      className={'text-left bg-white border border-t-4 border-t-red-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                        (openDebtCard === 'chuyen' ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100')}>
                      <p className="text-xs text-gray-400 mb-1">💰 Còn phải thu chuyển kỳ sau</p>
                      <p className={'text-lg font-bold ' + (dongTien.chuyenKySau.total > 0 ? 'text-red-500' : 'text-green-600')}>{fmt(dongTien.chuyenKySau.total)}đ</p>
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-200 space-y-0.5">
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Kế toán</span><span className="font-semibold text-gray-700">{fmt(dongTien.chuyenKySau.ketoan)}đ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">HCNS</span><span className="font-semibold text-violet-600">{fmt(dongTien.chuyenKySau.hcns)}đ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Dịch vụ khác</span><span className="font-semibold text-teal-600">{fmt(dongTien.chuyenKySau.dvk)}đ</span></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">{dongTien.chuyenKySau.soCty} công ty</p>
                      <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.chuyenKySau.soCty === 0 ? '—' : (openDebtCard === 'chuyen' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                    </button>
                  </div>
                  )}

                  {/* Bảng chi tiết của thẻ đang mở */}
                  {openDebtCard === 'hcns' && hcnsByStaff.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-100 bg-violet-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-violet-800">🏢 Công ty có dùng DV HCNS — theo từng nhân viên</p>
                        <button onClick={() => setOpenDebtCard(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                      </div>
                      {hcnsByStaff.map(g => (
                        <div key={g.id}>
                          <div className="px-4 py-2 bg-gray-100/70 flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-700">{g.name}</p>
                            <p className="text-xs font-semibold text-violet-700">
                              {g.items.length} cty · {fmt(g.paid)} / {fmt(g.fee)}đ
                            </p>
                          </div>
                          {g.items.map((c, i) => (
                            <div key={c.id} className={'px-4 py-2 pl-7 flex items-center justify-between gap-3 border-b border-gray-50 ' + zebra(i)}>
                              <p className="text-xs text-gray-700 truncate">{c.name}</p>
                              <p className="text-xs whitespace-nowrap flex-shrink-0">
                                <span className="text-gray-400">{fmt(c.hcnsPaid)} / </span>
                                <span className="font-semibold text-gray-800">{fmt(c.hcnsFee)}đ</span>
                                <span className={'ml-2 text-white px-2 py-0.5 rounded-full ' +
                                  (c.hcnsRemain === 0 ? 'bg-green-600' : c.hcnsPaid > 0 ? 'bg-yellow-500' : 'bg-red-500')}>
                                  {c.hcnsRemain === 0 ? 'Đã thu đủ' : c.hcnsPaid > 0 ? 'Thu một phần' : 'Chưa thu'}
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      ))}
                      <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                        Phí HCNS có dòng riêng trong "Tồn đầu kỳ" và "Còn phải thu chuyển kỳ sau",
                        nhưng KHÔNG tính vào %-KPI thu hồi công nợ.
                      </p>
                    </div>
                  )}

                  {/* Bảng chi tiết: nhóm theo nhân viên, 3 cột đúng 3 loại thu của thẻ.
                      Dùng THẲNG dongTien.*.theoCty do máy chủ trả — không lọc/cộng lại ở đây. */}
                  {(openDebtCard === 'ton' || openDebtCard === 'chuyen') && dongTien && (() => {
                    const k = openDebtCard === 'ton' ? dongTien.tonDau : dongTien.chuyenKySau
                    const nhom = []
                    for (const x of k.theoCty) {
                      let g = nhom.find(n => n.id === x.staffId)
                      if (!g) { g = { id: x.staffId, name: staffNameOf(x.staffId), items: [], total: 0 }; nhom.push(g) }
                      g.items.push(x); g.total += x.total
                    }
                    nhom.sort((a, b) => b.total - a.total)
                    const ton = openDebtCard === 'ton'
                    return (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className={'px-4 py-2.5 border-b border-gray-100 flex items-center justify-between ' + (ton ? 'bg-orange-50' : 'bg-red-50')}>
                          <p className={'text-xs font-semibold ' + (ton ? 'text-orange-800' : 'text-red-800')}>
                            {ton ? '📦 Tồn đầu kỳ chuyển sang' : '💰 Còn phải thu chuyển kỳ sau'} — {k.soCty} công ty · {fmt(k.total)}đ
                          </p>
                          <button onClick={() => setOpenDebtCard(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1fr_96px_96px_96px_104px] gap-2 text-xs text-gray-400">
                          <span>Công ty</span><span className="text-right">Kế toán</span><span className="text-right">HCNS</span>
                          <span className="text-right">DV khác</span><span className="text-right">Tổng</span>
                        </div>
                        {k.theoCty.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-gray-400">{ton ? 'Đầu kỳ không công ty nào còn nợ 🎉' : 'Tất cả đã thu đủ, không có gì chuyển kỳ sau 🎉'}</p>
                        ) : nhom.map(g => (
                          <div key={g.id || 'khong-ro'}>
                            <div className="px-4 py-2 bg-gray-100/70 flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-700">{g.name}</p>
                              <p className={'text-xs font-semibold ' + (ton ? 'text-orange-600' : 'text-red-600')}>{g.items.length} cty · {fmt(g.total)}đ</p>
                            </div>
                            {g.items.map((x, i) => (
                              <div key={x.clientId} className={'px-4 py-2 pl-7 border-b border-gray-50 grid grid-cols-[1fr_96px_96px_96px_104px] gap-2 items-center text-xs ' + zebra(i)}>
                                <span className="text-gray-700 truncate">
                                  {x.name}
                                  {x.ngung && <span className="ml-1.5 text-[10px] font-semibold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">Ngưng DV</span>}
                                </span>
                                <span className="text-right text-gray-700">{x.ketoan > 0 ? fmt(x.ketoan) : '—'}</span>
                                <span className="text-right text-violet-600">{x.hcns > 0 ? fmt(x.hcns) : '—'}</span>
                                <span className="text-right text-teal-600">{x.dvk > 0 ? fmt(x.dvk) : '—'}</span>
                                <span className="text-right font-semibold text-gray-900">{fmt(x.total)}đ</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {ton && !dongTien.tonDau.hcnsCoSoLieu && (
                          <p className="px-4 py-2.5 text-xs text-gray-500 bg-amber-50 border-t border-amber-100">
                            Cột HCNS trống vì phí HCNS mới tách riêng từ T9/2026 — các kỳ trước đó không có số HCNS để chuyển sang.
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {openDebtCard === 'khac' && dongTien && (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-100 bg-teal-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-teal-800">
                          🗂 Phí thu khác T{selMonth}/{selYear} — phải thu {fmt(dongTien.thuKhac.phaiThu)}đ · đã thu {fmt(dongTien.thuKhac.daThu)}đ
                        </p>
                        <button onClick={() => setOpenDebtCard(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                      </div>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1fr_104px_104px_104px_90px] gap-2 text-xs text-gray-400">
                        <span>Công ty / hồ sơ</span><span className="text-right">Phải thu</span><span className="text-right">Đã thu</span>
                        <span className="text-right">Còn lại</span><span className="text-right">Trạng thái</span>
                      </div>
                      {dongTien.thuKhac.hoSo.length === 0 ? (
                        <p className="px-4 py-4 text-xs text-gray-400">Kỳ này không có khoản thu khác nào.</p>
                      ) : dongTien.thuKhac.hoSo.map((h, i) => (
                        <div key={h.id} className={'px-4 py-2.5 border-b border-gray-50 grid grid-cols-[1fr_104px_104px_104px_90px] gap-2 items-center text-xs ' + zebra(i)}>
                          <span className="min-w-0">
                            <span className="text-gray-800 block truncate">{h.clientName}</span>
                            <span className="text-gray-400 block truncate">
                              {h.name}
                              {h.le ? ' · thu khác lẻ' : (h.moTrongKy ? ' · hồ sơ mở kỳ này' : ' · hồ sơ kỳ trước, kỳ này có thu')}
                            </span>
                          </span>
                          <span className="text-right text-gray-700">{fmt(h.phaiThu)}</span>
                          <span className="text-right text-green-600 font-medium">{fmt(h.daThu)}</span>
                          <span className={'text-right font-medium ' + (h.conLai > 0 ? 'text-red-500' : 'text-gray-300')}>{h.conLai > 0 ? fmt(h.conLai) : '0'}</span>
                          <span className={'text-right ' + (h.status === 'done' ? 'text-green-600' : 'text-orange-500')}>{h.status === 'done' ? 'Đã đóng' : 'Đang mở'}</span>
                        </div>
                      ))}
                      <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                        Hồ sơ chưa thu đủ thì phần còn lại tự chảy vào thẻ “Còn phải thu chuyển kỳ sau”, dòng Dịch vụ khác.
                      </p>
                    </div>
                  )}

                  {/* Warning */}
                  {overdue.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <span className="text-red-500">🔴</span>
                      <p className="text-xs font-semibold text-red-700">{overdue.length} công ty quá hạn thu phí dịch vụ kế toán</p>
                    </div>
                  )}

                  {/* Công ty ĐÃ NGƯNG dịch vụ mà còn nợ. Đã ra khỏi checklist công việc và khỏi %-KPI,
                      nhưng tiền thì vẫn phải đòi — không hiện ở đây thì ngưng xong là khoản nợ biến
                      khỏi mọi màn hình (anh chốt 05/10/2026). */}
                  {dongTien?.ngungConNo?.length > 0 && (
                    <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-800">
                          ⏸ Đã ngưng dịch vụ — còn phải thu · {dongTien.ngungConNo.length} công ty
                        </p>
                        <p className="text-xs font-bold text-amber-800">{fmt(dongTien.ngungConNo.reduce((a, x) => a + x.total, 0))}đ</p>
                      </div>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1fr_140px_96px_96px_96px_104px] gap-2 text-xs text-gray-400">
                        <span>Công ty</span><span>Nhân viên</span><span className="text-right">Kế toán</span>
                        <span className="text-right">HCNS</span><span className="text-right">DV khác</span><span className="text-right">Còn phải thu</span>
                      </div>
                      {dongTien.ngungConNo.map((x, i) => (
                        <div key={x.clientId} className={'border-b border-gray-50 ' + zebra(i)}>
                        <div className="px-4 py-2 grid grid-cols-[1fr_140px_96px_96px_96px_104px] gap-2 items-center text-xs">
                          {/* Bấm tên để mở bảng ghi công nợ ngay tại đây — quản trị / trưởng phòng không
                              có các công ty này ở trang Quản lý công nợ của riêng mình. */}
                          <button onClick={() => setOpenClient(p => ({ ...p, ['ngung-' + x.clientId]: !p['ngung-' + x.clientId] }))}
                            className="text-left text-gray-700 truncate hover:text-blue-600">
                            {x.name} <span className="text-blue-600">{openClient['ngung-' + x.clientId] ? '▴ đóng' : '▾ ghi thu'}</span>
                          </button>
                          <span className="text-gray-500 truncate">{staffNameOf(x.staffId)}</span>
                          <span className="text-right text-gray-700">{x.ketoan > 0 ? fmt(x.ketoan) : '—'}</span>
                          <span className="text-right text-violet-600">{x.hcns > 0 ? fmt(x.hcns) : '—'}</span>
                          <span className="text-right text-teal-600">{x.dvk > 0 ? fmt(x.dvk) : '—'}</span>
                          <span className="text-right font-semibold text-red-500">
                            {fmt(x.total)}đ
                            {isTrueAdmin && x.ketoan > 0 && (
                              <button disabled={xoaNoBusy === x.clientId} onClick={() => xoaNo(x)}
                                className="block ml-auto mt-0.5 text-[11px] font-medium text-gray-500 underline hover:text-red-600 disabled:opacity-40">
                                {xoaNoBusy === x.clientId ? 'Đang xoá…' : 'Xoá nợ'}
                              </button>
                            )}
                          </span>
                        </div>
                        {openClient['ngung-' + x.clientId] && x.client && (
                          <ClientChecklist
                            client={x.client}
                            defaultMonth={selMonth}
                            defaultYear={selYear}
                            defaultPanel="debt"
                            clientMonth={clientMonth[x.clientId] || selMonth}
                            onMonthChange={m => setClientMonth(p => ({ ...p, [x.clientId]: m }))}
                            onDebtSaved={load}
                            isAdmin={isAdmin}
                            isTrueAdmin={isTrueAdmin}
                            canUncheck={canUncheck}
                          />
                        )}
                        </div>
                      ))}
                      <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                        Các công ty này không còn trong checklist công việc và không tính vào %-KPI, nhưng số nợ vẫn nằm trong “Còn phải thu chuyển kỳ sau”.
                      </p>
                    </div>
                  )}

                  {/* Per staff */}
                  {staffData.map(s => {
                    const myClients = s.clients.map(c => ({
                      ...c, ketoan: Number(c.collected) || 0, khach: Number(c.collectedKhach) || 0,
                      hcnsFee: Number(c.hcnsFee) || 0, hcnsPaid: Number(c.hcnsCollected) || 0,
                      hcnsRemain: Math.max(0, (Number(c.hcnsFee) || 0) - (Number(c.hcnsCollected) || 0)),
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
                            {/* Nói rõ ô % chỉ tính phí kế toán — nếu không, thu xong phí HCNS mà
                                % đứng im sẽ bị hiểu là hệ thống lỗi. */}
                            <p className="text-xs text-gray-400">chỉ phí kế toán</p>
                          </div>
                        </div>
                        {/* Company rows */}
                        <div className="divide-y divide-gray-50">
                          {myClients.map((c, ci) => {
                            const fee = Number(c.monthly_fee) || 0
                            const notDueYet = c.fee_period === 'quarterly' && !c.dueThisMonth && fee > 0
                            const st  = debtStatus(c.ketoan, fee, notDueYet, c.rolloverRemaining)
                            const colPct = fee === 0 ? 0 : Math.min(100, Math.round(c.ketoan / fee * 100))
                            return (
                              <div key={c.id} className={'px-4 py-3 ' + (ci % 2 === 0 ? st.bg : st.bgAlt)}>
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
                                      {c.usesHcns && c.hcnsFee > 0 && (
                                        <span className="text-xs font-bold bg-violet-100 text-violet-700 border border-violet-300 px-1.5 py-0.5 rounded-full flex-shrink-0">Có DV HCNS</span>
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
                                    {c.usesHcns && c.hcnsFee > 0 ? (
                                      <>
                                        {/* Hai khoản thu độc lập — một khoản xong không nói gì về
                                            khoản kia, nên mỗi khoản có badge trạng thái riêng. */}
                                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                          <span className="text-xs text-gray-500">📋 Phí kế toán</span>
                                          <span className="text-sm font-bold text-gray-800">
                                            {c.ketoan > 0 ? fmt(c.ketoan) + ' / ' : ''}{fmt(fee)}đ
                                          </span>
                                          <span className={'text-xs font-medium text-white px-2 py-0.5 rounded-full ' + st.pill}>{st.label}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 whitespace-nowrap mt-1 pt-1 border-t border-dashed border-gray-300">
                                          <span className="text-xs text-violet-600">🏢 Phí HCNS</span>
                                          <span className="text-sm font-bold text-gray-800">
                                            {c.hcnsPaid > 0 ? fmt(c.hcnsPaid) + ' / ' : ''}{fmt(c.hcnsFee)}đ
                                          </span>
                                          <span className={'text-xs font-medium text-white px-2 py-0.5 rounded-full ' +
                                            (c.hcnsRemain === 0 ? 'bg-green-600' : c.hcnsPaid > 0 ? 'bg-yellow-500' : 'bg-red-500')}>
                                            {c.hcnsRemain === 0 ? 'Đã thu đủ' : c.hcnsPaid > 0 ? 'Thu một phần' : 'Chưa thu'}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-base font-bold text-gray-800 whitespace-nowrap">
                                          {c.ketoan > 0 ? fmt(c.ketoan) + ' / ' : ''}{fmt(fee)}đ
                                        </p>
                                        <span className={'inline-block mt-1 text-xs font-medium text-white px-2.5 py-1 rounded-full ' + st.pill}>
                                          {st.label}
                                        </span>
                                      </>
                                    )}
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
