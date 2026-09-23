'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { loadPermissionData, can } from '@/lib/permissions'
import AppShell from '@/components/AppShell'
import ClientChecklist from '@/components/ClientChecklist'
import * as XLSX from 'xlsx'
import { HCNS_PER_HEAD } from '@/lib/salesPricing'
import { HCNS_STATUSES, HCNS_STATUS_LABEL } from '@/lib/hcnsStatus'
import { hcnsDueState, hcnsDueDate } from '@/lib/hcnsDue'

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

// Bảng màu %-KPI: bộ đang dùng trong app (yellow-400/red-400) quá nhạt và tương phản dưới 3:1,
// cặp vàng↔xanh gần như không phân biệt được với người mù màu. Bộ dưới đây đã kiểm đạt cả 6 tiêu
// chí, vẫn giữ ngôn ngữ xanh–vàng–đỏ. LUÔN hiện số % bằng chữ cạnh thanh — không để màu là thông
// tin duy nhất.
const pctText = (v) => v === null || v === undefined ? 'text-slate-400'
  : v >= 90 ? 'text-[#2E6B3A]' : v >= 70 ? 'text-[#87590B]' : 'text-[#B3261E]'
const pctBar  = (v) => v >= 90 ? 'bg-[#2E6B3A]'   : v >= 70 ? 'bg-[#D89614]'   : 'bg-[#B3261E]'

const CAT_LABEL = { thoi_ky: 'Thời kỳ', thoi_diem: 'Thời điểm', vang_lai: 'Vãng lai' }
const CAT_STYLE = {
  thoi_ky:   'bg-emerald-50 text-emerald-800 border border-emerald-300',
  thoi_diem: 'bg-indigo-50 text-indigo-800 border border-indigo-300',
  vang_lai:  'bg-orange-50 text-orange-900 border border-orange-300',
}

// Bỏ dấu để tìm kiếm gõ không dấu vẫn ra.
const noAccent = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/gi, 'd').toLowerCase()

const AVATAR_TONES = [
  'bg-blue-100 text-blue-800', 'bg-violet-100 text-violet-800', 'bg-pink-100 text-pink-800',
  'bg-cyan-100 text-cyan-800', 'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800',
]
const avatarTone = (id) => {
  const key = String(id || '')
  let sum = 0
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i)
  return AVATAR_TONES[sum % AVATAR_TONES.length]
}
const initialOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/)
  return (parts[parts.length - 1][0] || '?').toUpperCase()
}

function Meter({ value }) {
  return (
    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
      <div className={'h-full rounded-full transition-all ' + pctBar(value || 0)}
        style={{ width: Math.min(100, value || 0) + '%' }} />
    </div>
  )
}

export default function HcnsPage() {
  const router = useRouter()
  const now = new Date()
  const [tab, setTab] = useState('report')
  const [mode, setMode] = useState('month')
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState([])
  const [report, setReport] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [templates, setTemplates] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [clientMonth, setClientMonth] = useState({})
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [canManage, setCanManage] = useState(false)
  // Trưởng phòng mới được phân công nhân viên phụ trách — số liệu KPI/công nợ đi theo người này.
  const [canAssign, setCanAssign] = useState(false)
  // Chỉ Quản trị: sửa thông tin / xoá hồ sơ Thời điểm-Vãng lai tạo trùng, nhầm.
  const [isAdmin, setIsAdmin] = useState(false)
  // Quyền riêng edit_hcns_case_info (sql/17) — tích cho nhân viên HCNS ở trang Vai trò.
  const [canEditInfo, setCanEditInfo] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showPhatSinh, setShowPhatSinh] = useState(false)

  const monthOpts = []
  { let y = now.getFullYear(), m = now.getMonth() + 1
    for (let i = 0; i < 18; i++) { monthOpts.push({ y, m, label: 'T' + m + '/' + y }); m--; if (m === 0) { m = 12; y-- } } }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      // Lấy ĐỦ vai trò (chính + kiêm nhiệm) — người vừa làm kế toán vừa là trưởng phòng HCNS chỉ
      // có quyền HCNS ở vai trò kiêm nhiệm, đọc mỗi staff.role sẽ bị đá về trang chủ.
      const [{ data: me }, myPerm] = await Promise.all([
        supabase.from('staff').select('role').eq('id', sd.session.user.id).single(),
        fetch('/api/admin/me').then(r => r.json()).catch(() => ({})),
      ])
      const perm = await loadPermissionData()
      const roles = myPerm?.roles?.length ? myPerm.roles : [me?.role].filter(Boolean)
      if (!can(roles, 'view_hcns', perm)) { router.push('/dashboard'); return }
      setAllowed(true)
      setCanManage(can(roles, 'manage_hcns', perm))
      setCanAssign(can(roles, 'view_hcns_all_staff', perm))
      setIsAdmin(roles.includes('admin'))
      setCanEditInfo(can(roles, 'edit_hcns_case_info', perm))
      await Promise.all([loadClients(), loadReport(), loadStaff(), loadTemplates()])
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => { if (allowed) loadReport() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selYear, selMonth, mode, allowed])

  const loadClients = async () => {
    // includeStopped: cần cả công ty đã ngừng DV để dựng thẻ "Ngưng DV HCNS".
    const res = await fetch('/api/admin/hcns/clients?includeStopped=1')
    const json = await res.json()
    setClients(json.data || [])
  }
  const loadReport = async () => {
    const res = await fetch('/api/admin/hcns/room?year=' + selYear + '&month=' + selMonth + '&mode=' + mode)
    const json = await res.json()
    setReport(json.error ? null : json)
  }
  // Nhân viên phòng HCNS — dùng endpoint riêng vì /api/admin/staff chỉ mở rộng danh sách cho
  // role 'admin' và 'leader', còn 'hcns_leader' sẽ chỉ thấy chính mình.
  const loadStaff = async () => {
    const res = await fetch('/api/admin/hcns/staff')
    const json = await res.json()
    setStaffList(json.data || [])
  }
  const loadTemplates = async () => {
    const res = await fetch('/api/admin/hcns/templates')
    const json = await res.json()
    setTemplates((json.data || []).filter(t => !t.is_recurring))
  }

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-slate-500 text-sm">Đang tải...</p></div></AppShell>
  if (!allowed) return null

  // Công ty đã ngừng DV có thẻ riêng, không lẫn vào danh sách đang làm.
  const live    = clients.filter(x => x.is_active !== false)
  const stopped = clients.filter(x => x.is_active === false)
  const isCase  = (x) => x.category === 'thoi_diem' || x.category === 'vang_lai'
  const byCat = (c) => {
    if (c === 'all')      return live
    if (c === 'stopped')  return stopped
    // Hồ sơ xong hết dịch vụ rời khỏi thẻ Thời điểm/Vãng lai — số đếm ở đó là việc ĐANG chạy.
    if (c === 'done')     return live.filter(x => isCase(x) && x.allDone)
    // Công ty Thời kỳ có việc thời điểm phát sinh (không thu phí riêng) — dịch vụ gắn thẳng vào
    // chính bản ghi Thời kỳ, không tạo hồ sơ trùng.
    if (c === 'phat_sinh') return live.filter(x => x.category === 'thoi_ky' && x.serviceCount > 0)
    if (c === 'thoi_diem' || c === 'vang_lai') return live.filter(x => x.category === c && !x.allDone)
    return live.filter(x => x.category === c)
  }
  const q = noAccent(search)
  const filtered = (list) => !q ? list : list.filter(c =>
    noAccent(c.name).includes(q) || noAccent(c.tax_code).includes(q) ||
    noAccent(c.client_code).includes(q) || noAccent(c.case_code).includes(q))

  // Xuất Excel theo KỲ đang lọc (Tháng/Quý/Năm). Dùng lại đúng số của báo cáo phòng (đã tính theo
  // kỳ + đã thu hẹp theo quyền xem) để file luôn khớp với màn hình.
  const exportExcel = async (kind) => {
    if (!report) return
    const q = Math.ceil(selMonth / 3)
    const periodLabel = mode === 'year' ? 'Năm ' + selYear : mode === 'quarter' ? 'Quý ' + q + '/' + selYear : 'T' + selMonth + '/' + selYear
    const fileTag = mode === 'year' ? 'Nam' + selYear : mode === 'quarter' ? 'Q' + q + '-' + selYear : 'T' + selMonth + '-' + selYear
    const pct = (v) => v === null || v === undefined ? '' : v / 100
    const wb = XLSX.utils.book_new()
    const addSheet = (name, rows, widths, pctCols = [], moneyCols = []) => {
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = widths.map(w => ({ wch: w }))
      // Định dạng ô số / % (bỏ qua các dòng tiêu đề chữ).
      for (let r = 0; r < rows.length; r++) {
        for (const c of [...pctCols, ...moneyCols]) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })]
          if (cell && typeof cell.v === 'number') cell.z = pctCols.includes(c) ? '0%' : '#,##0'
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    if (kind === 'thoi_ky') {
      const tk = report.thoiKy
      const nameOf = new Map((tk.perStaff || []).map(s => [s.staffId, s.staffName]))
      const byId = new Map(clients.map(c => [c.id, c]))
      const order = new Map(byCat('thoi_ky').map((c, i) => [c.id, i]))
      const staffOrder = new Map((tk.perStaff || []).map((s, i) => [s.staffId, i]))
      const rank = (c) => !c.assigned_to ? -1 : staffOrder.has(c.assigned_to) ? staffOrder.get(c.assigned_to) : 999
      const list = [...(tk.perClient || [])].sort((a, b) =>
        rank(a) - rank(b) || (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999))

      const s1 = [
        ['BÁO CÁO HCNS THỜI KỲ — ' + periodLabel],
        ['KPI phòng = trung bình cộng % của từng nhân viên. % công việc tính theo tháng cuối của kỳ, chỉ đếm việc đúng hạn.'],
        [],
        ['Nhân viên', 'Số cty', 'Phí phải thu', 'Đã thu', 'Còn phải thu', '% Công nợ', '% Công việc'],
        ...(tk.perStaff || []).map(s => [s.staffName, s.clientCount, s.totalFee, s.totalCollected,
          Math.max(0, s.totalFee - s.totalCollected), pct(s.debtPercent), pct(s.taskPercent)]),
      ]
      const un = list.filter(c => !c.assigned_to)
      if (un.length) {
        const fee = un.reduce((a, c) => a + c.dueFee, 0), col = un.reduce((a, c) => a + c.collected, 0)
        s1.push(['Chưa phân công', un.length, fee, col, Math.max(0, fee - col), '', ''])
      }
      s1.push(['KPI PHÒNG', tk.clientCount, tk.totalFee, tk.totalCollected,
        Math.max(0, tk.totalFee - tk.totalCollected), pct(tk.debtPercent), pct(tk.taskPercent)])
      addSheet('Tổng hợp nhân viên', s1, [28, 8, 16, 16, 16, 11, 12], [5, 6], [2, 3, 4])

      const s2 = [
        ['CHI TIẾT CÔNG TY THỜI KỲ — ' + periodLabel],
        [],
        ['STT', 'Mã KH', 'Tên công ty', 'MST', 'NV phụ trách', 'Kỳ thu phí', 'Tồn đầu kỳ', 'Phí trong kỳ', 'Đã thu', 'Còn phải thu', '% Công nợ', 'Việc xong/Tổng', '% Công việc'],
        ...list.map((c, i) => {
          const src = byId.get(c.id)
          return [i + 1, c.client_code || '', c.name, src?.linkedClient?.tax_code || src?.tax_code || '',
            c.assigned_to ? (nameOf.get(c.assigned_to) || '') : 'Chưa phân công',
            c.fee_period === 'quarterly' ? 'Quý' : 'Tháng',
            c.opening || 0, c.dueFee, c.collected, c.totalRemain ?? c.remain, pct(c.debtPercent),
            c.taskTotal ? c.taskDone + '/' + c.taskTotal : '', pct(c.taskPercent)]
        }),
      ]
      addSheet('Chi tiết công ty', s2, [5, 14, 45, 14, 22, 10, 14, 14, 14, 14, 10, 13, 11], [10, 12], [6, 7, 8, 9])

      // Sheet 3 — Biến động nhân sự trong kỳ (số nhập ở việc "Cập nhật số lượng nhân sự"), làm căn
      // cứ điều chỉnh phí HCNS. Phí đề xuất = số người cuối kỳ × HCNS_PER_HEAD (cùng mức báo giá).
      const mList = report.period?.months || [selMonth]
      const hj = await fetch('/api/admin/hcns/headcount?year=' + selYear + '&months=' + mList.join(','))
        .then(r => r.json()).catch(() => ({ data: [] }))
      const hrows = [...(hj.data || [])].sort((a, b) =>
        (a.staffName === 'Chưa phân công' ? -1 : 0) - (b.staffName === 'Chưa phân công' ? -1 : 0) ||
        (a.staffName || '').localeCompare(b.staffName || '') || (a.name || '').localeCompare(b.name || ''))
      const s3 = [
        ['BIẾN ĐỘNG NHÂN SỰ — ' + periodLabel],
        ['Số nhân sự tham gia BHXH nhập hằng tháng · "—" = tháng chưa nhập · Phí đề xuất = số người cuối kỳ × ' +
          HCNS_PER_HEAD.toLocaleString('vi-VN') + 'đ/người/tháng (như báo giá). Phí quý quy về tháng để so sánh.'],
        [],
        ['STT', 'Mã KH', 'Tên công ty', 'MST', 'NV phụ trách', 'Trước kỳ',
          ...mList.map(m => 'T' + m), 'Cuối kỳ', 'Biến động', 'Phí HCNS/tháng', 'Phí / người', 'Phí đề xuất', 'Chênh lệch'],
        ...hrows.map((c, i) => {
          const vals = mList.map(m => c.values[m])
          const known = vals.filter(v => v !== null && v !== undefined)
          const endVal = known.length ? known[known.length - 1] : null
          const startVal = c.baseline ?? (known.length ? known[0] : null)
          const monthly = c.feePeriod === 'quarterly' ? Math.round(c.hcnsFee / 3) : c.hcnsFee
          const suggest = endVal !== null ? endVal * HCNS_PER_HEAD : ''
          return [i + 1, c.clientCode || '', c.name, c.taxCode || '', c.staffName, c.baseline ?? '—',
            ...vals.map(v => v ?? '—'),
            endVal ?? '—',
            endVal !== null && startVal !== null ? endVal - startVal : '',
            monthly,
            endVal ? Math.round(monthly / endVal) : '',
            suggest,
            suggest !== '' ? suggest - monthly : '']
        }),
      ]
      const nM = mList.length
      const moneyIdx = [8 + nM, 9 + nM, 10 + nM, 11 + nM]
      addSheet('Biến động nhân sự', s3, [5, 14, 45, 14, 22, 9, ...mList.map(() => 7), 9, 10, 15, 13, 15, 15], [], moneyIdx)
    } else {
      const td = report.thoiDiem
      const cases = (td.cases || []).filter(c => c.periodServices > 0)
        .sort((a, b) => (a.staffName || '').localeCompare(b.staffName || '') || (a.caseCode || '').localeCompare(b.caseCode || ''))
      const dateVN = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : ''
      const s1 = [
        ['BÁO CÁO HCNS THỜI ĐIỂM — ' + periodLabel],
        ['Tồn đầu kỳ = chi phí dịch vụ nhận trước kỳ trừ tiền thu trước kỳ · Phí trong kỳ = dịch vụ nhận trong kỳ · Đã thu = tiền ghi nhận trong kỳ · % công việc chỉ tính việc xong trong hạn.'],
        [],
        ['STT', 'Mã hồ sơ', 'Tên công ty', 'MST', 'NV phụ trách', 'Số DV trong kỳ', '% Công việc', 'Tồn đầu kỳ', 'Phí trong kỳ', 'Đã thu', 'Còn phải thu', 'Tình trạng'],
        ...cases.map((c, i) => [i + 1, c.caseCode || '', c.name, c.taxCode || '', c.staffName || 'Chưa phân công',
          c.periodServices, pct(c.taskPercent), c.opening || 0, c.periodFee || 0, c.periodPaid || 0, c.periodRemain || 0,
          c.allDone ? 'Xong việc' : 'Đang làm']),
      ]
      const sum = (k) => cases.reduce((a, c) => a + (c[k] || 0), 0)
      s1.push(['', '', 'TỔNG', '', '', sum('periodServices'), '', sum('opening'), sum('periodFee'), sum('periodPaid'), sum('periodRemain'), ''])
      addSheet('Hồ sơ', s1, [5, 26, 45, 14, 22, 12, 11, 15, 15, 15, 15, 11], [6], [7, 8, 9, 10])

      const svcs = [...(td.services || [])].sort((a, b) =>
        (a.caseCode || '').localeCompare(b.caseCode || '') || (a.receivedAt || '').localeCompare(b.receivedAt || ''))
      const s2 = [
        ['CHI TIẾT DỊCH VỤ THỜI ĐIỂM — ' + periodLabel],
        [],
        ['STT', 'Mã hồ sơ', 'Tên công ty', 'NV phụ trách', 'Dịch vụ', 'Ngày nhận', 'Hạn hoàn thành', 'Đúng hạn', 'Trạng thái', 'Việc xong/Tổng', 'Chi phí'],
        ...svcs.map((s, i) => [i + 1, s.caseCode || '', s.name, s.staffName || '', s.serviceName,
          dateVN(s.receivedAt), dateVN(s.dueAt), s.dueLabel || '', s.status,
          s.taskTotal ? s.taskDone + '/' + s.taskTotal : '', s.cost]),
      ]
      addSheet('Chi tiết dịch vụ', s2, [5, 26, 45, 22, 32, 12, 14, 18, 18, 13, 15], [], [10])
    }
    XLSX.writeFile(wb, 'HCNS_' + (kind === 'thoi_ky' ? 'ThoiKy' : 'ThoiDiem') + '_' + fileTag + '.xlsx')
  }

  const TABS = [
    { key: 'report',    label: 'Báo cáo phòng HCNS' },
    { key: 'all',       label: 'Tất cả' },
    { key: 'thoi_ky',   label: 'Thời kỳ' },
    { key: 'phat_sinh', label: 'Thời kỳ – Phát sinh' },
    { key: 'thoi_diem', label: 'Thời điểm' },
    { key: 'done',      label: 'Hoàn thành' },
    { key: 'stopped',   label: 'Ngưng DV HCNS' },
  ].map(t => t.key === 'report' ? t : { ...t, count: byCat(t.key).length })

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">Phòng HCNS</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {clients.length} công ty
            {report?.scope === 'own' && <span className="ml-1.5 text-amber-600">· chỉ hiện phần bạn phụ trách</span>}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={'px-4 py-2 text-sm rounded-lg border transition-colors ' +
                (tab === t.key
                  ? 'bg-[#8B1A1A] text-white border-[#8B1A1A] font-semibold shadow-sm'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 hover:text-slate-900')}>
              {t.label}{t.count !== undefined ? ' (' + t.count + ')' : ''}
            </button>
          ))}
        </div>

        {/* Thanh công cụ — dùng chung cho mọi tag danh sách */}
        {tab !== 'report' && (
          <div className="flex gap-2 flex-wrap items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 mb-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên công ty hoặc MST"
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30" />
            <div className="flex border border-slate-300 rounded-lg overflow-hidden bg-white text-sm">
              {[['month','Tháng'],['quarter','Quý'],['year','Năm']].map(([k,l]) => (
                <button key={k} onClick={() => setMode(k)}
                  className={'px-3 py-1.5 border-l first:border-l-0 border-slate-300 ' +
                    (mode === k ? 'bg-[#8B1A1A] text-white' : 'text-slate-700 hover:bg-slate-50')}>{l}</button>
              ))}
            </div>
            <select value={selYear + '-' + selMonth}
              onChange={e => { const [y, m] = e.target.value.split('-'); setSelYear(Number(y)); setSelMonth(Number(m)) }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
              {monthOpts.map(o => <option key={o.label} value={o.y + '-' + o.m}>{o.label}</option>)}
            </select>
            {(tab === 'thoi_ky' || tab === 'thoi_diem') && (
              <button onClick={() => exportExcel(tab)} disabled={!report}
                className="px-3 py-1.5 bg-[#2E6B3A] text-white rounded-lg text-sm font-medium hover:bg-[#245530] disabled:opacity-40">
                📥 Xuất Excel
              </button>
            )}
            {canManage && (tab === 'thoi_diem' || tab === 'vang_lai') && (
              <button onClick={() => setShowAdd(true)}
                className="px-3 py-1.5 bg-[#8B1A1A] text-white rounded-lg text-sm font-medium hover:bg-[#6B1212]">
                + Thêm công ty
              </button>
            )}
            {canManage && tab === 'phat_sinh' && (
              <button onClick={() => setShowPhatSinh(true)}
                className="px-3 py-1.5 bg-[#8B1A1A] text-white rounded-lg text-sm font-medium hover:bg-[#6B1212]">
                + Việc phát sinh
              </button>
            )}
          </div>
        )}

        {tab === 'report' && <ReportBlock report={report} mode={mode} setMode={setMode}
          selYear={selYear} selMonth={selMonth} setSelYear={setSelYear} setSelMonth={setSelMonth} monthOpts={monthOpts} />}

        {tab !== 'report' && (() => {
          const rows = filtered(byCat(tab))
          const rowProps = (c, ri) => ({
            c, ri, showCat: tab === 'all' || tab === 'done',
            stopped: tab === 'stopped', phatSinh: tab === 'phat_sinh', report,
            expanded: expanded === c.id, onToggle: () => setExpanded(expanded === c.id ? null : c.id),
            clientMonth, setClientMonth, selMonth, canManage, canAssign, isAdmin, canEditInfo, staffList, templates,
            onChanged: () => { loadClients(); loadReport() },
          })
          const empty = (
            <p className="text-sm text-slate-500 px-4 py-8 text-center">
              {search ? 'Không tìm thấy công ty nào khớp.'
                : tab === 'done' ? 'Chưa có hồ sơ nào xong hết dịch vụ.'
                : tab === 'stopped' ? 'Chưa có công ty nào ngừng DV HCNS.'
                : 'Chưa có công ty nào ở mục này.'}
            </p>
          )

          // Tag "Thời kỳ" gom theo nhân viên phụ trách — 55 công ty xếp phẳng thì không theo dõi
          // được ai đang giữ công ty nào. Các tag khác chỉ vài dòng nên để nguyên danh sách phẳng.
          if (tab !== 'thoi_ky') {
            return (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {rows.length === 0 && empty}
                {rows.map((c, ri) => <ClientRow key={c.id} {...rowProps(c, ri)} />)}
              </div>
            )
          }

          // Nhóm CHƯA PHÂN CÔNG luôn đứng đầu — đó là việc cần xử lý trước, không phải để cuối.
          const groups = []
          const unassigned = rows.filter(c => !c.assigned_to)
          if (unassigned.length) groups.push({ key: 'none', staff: null, items: unassigned })
          for (const st of staffList) {
            const items = rows.filter(c => c.assigned_to === st.id)
            if (items.length) groups.push({ key: st.id, staff: st, items })
          }
          // Người phụ trách không còn trong danh sách nhân viên HCNS (đổi phòng, nghỉ) vẫn phải
          // hiện ra, nếu không công ty của họ biến mất khỏi trang.
          const shownIds = new Set(groups.flatMap(g => g.items.map(x => x.id)))
          const orphan = rows.filter(c => !shownIds.has(c.id))
          if (orphan.length) groups.push({ key: 'orphan', staff: null, orphan: true, items: orphan })

          if (rows.length === 0) {
            return <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">{empty}</div>
          }

          return (
            <div className="space-y-3">
              {groups.map(g => {
                // Số liệu lấy THẲNG từ Báo cáo phòng, không tính lại — tính riêng ở đây thì hai
                // trang dễ ra hai con số khác nhau, đúng loại lỗi khó truy nhất.
                const st = g.staff ? report?.thoiKy?.perStaff?.find(x => x.staffId === g.staff.id) : null
                const fee = g.items.reduce((a, c) => a + (Number(c.hcns_fee) || 0), 0)
                const border = !g.staff ? '#EA580C'
                  : st?.debtPercent === null || st?.debtPercent === undefined ? '#CBD5E1'
                  : st.debtPercent >= 90 ? '#2E6B3A' : st.debtPercent >= 70 ? '#D89614' : '#B3261E'
                return (
                  <div key={g.key}
                    className={'bg-white rounded-2xl overflow-hidden shadow-sm border ' +
                      (g.staff ? 'border-slate-200' : 'border-amber-300')}>
                    <div className={'flex items-center justify-between gap-3 px-3 py-2.5 ' +
                      (g.staff ? 'bg-slate-50 border-b border-slate-200' : 'bg-amber-50 border-b border-amber-200')}
                      style={{ borderLeft: '5px solid ' + border }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {g.staff ? (
                          <span className={'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ' + avatarTone(g.staff.id)}>
                            {initialOf(g.staff.full_name)}
                          </span>
                        ) : (
                          <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-100 text-amber-700">⚠</span>
                        )}
                        <div className="min-w-0">
                          <p className={'text-sm font-semibold truncate ' + (g.staff ? 'text-slate-900' : 'text-amber-900')}>
                            {g.staff ? g.staff.full_name : g.orphan ? 'Người phụ trách không thuộc phòng HCNS' : 'Chưa phân công'}
                          </p>
                          <p className={'text-xs ' + (g.staff ? 'text-slate-500' : 'text-amber-800')}>
                            {g.items.length} cty{g.staff ? '' : ' · cần gán nhân viên phụ trách'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {g.staff && st ? (
                          <>
                            <p className={'text-xl font-bold leading-none ' + pctText(st.debtPercent)}>
                              {st.debtPercent === null ? '—' : st.debtPercent + '%'}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                              {fmt(st.totalCollected)} / {fmt(st.totalFee)}đ
                            </p>
                            <p className="text-[11px] text-slate-500">
                              công việc {st.taskPercent === null ? '—' : st.taskPercent + '%'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className={'text-xs ' + (g.staff ? 'text-slate-500' : 'text-amber-800')}>Phí HCNS</p>
                            <p className={'text-sm font-bold tabular-nums ' + (g.staff ? 'text-slate-800' : 'text-amber-900')}>
                              {fmt(fee)}đ/tháng
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {g.items.map((c, ri) => <ClientRow key={c.id} {...rowProps(c, ri)} />)}
                  </div>
                )
              })}
            </div>
          )
        })()}

        {showPhatSinh && (
          <AddPhatSinhModal companies={live.filter(x => x.category === 'thoi_ky')} templates={templates}
            onClose={() => setShowPhatSinh(false)}
            onDone={() => { setShowPhatSinh(false); loadClients(); loadReport() }} />
        )}
        {showAdd && (
          <AddCaseModal category={tab === 'vang_lai' ? 'vang_lai' : 'thoi_diem'} staffList={staffList}
            onClose={() => setShowAdd(false)}
            onDone={() => { setShowAdd(false); loadClients(); loadReport() }} />
        )}
      </div>
    </AppShell>
  )
}

/* ─────────────────────────────── Báo cáo phòng ─────────────────────────────── */
function ReportBlock({ report, mode, setMode, selYear, selMonth, setSelYear, setSelMonth, monthOpts }) {
  if (!report) return <p className="text-sm text-slate-500 px-4 py-8 text-center">Chưa có số liệu.</p>
  const tk = report.thoiKy

  return (
    <div className="space-y-3">
      {/* Tag này không có ô tìm kiếm nên khung lọc chỉ ôm vừa 2 điều khiển (w-fit) và dạt phải
          (ml-auto) — cho khớp vị trí bộ lọc kỳ ở 4 tag danh sách. */}
      <div className="w-fit ml-auto flex gap-2 flex-wrap items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
        <div className="flex border border-slate-300 rounded-lg overflow-hidden bg-white text-sm">
          {[['month','Tháng'],['quarter','Quý'],['year','Năm']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)}
              className={'px-3 py-1.5 border-l first:border-l-0 border-slate-300 ' +
                (mode === k ? 'bg-[#8B1A1A] text-white' : 'text-slate-700 hover:bg-slate-50')}>{l}</button>
          ))}
        </div>
        <select value={selYear + '-' + selMonth}
          onChange={e => { const [y, m] = e.target.value.split('-'); setSelYear(Number(y)); setSelMonth(Number(m)) }}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
          {monthOpts.map(o => <option key={o.label} value={o.y + '-' + o.m}>{o.label}</option>)}
        </select>
      </div>

      {/* Khối Thời kỳ — chiếm hết chiều ngang */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        {/* Vạch màu nhận diện khối — kéo trang xuống là biết đang ở khối nào mà không phải đọc
            chữ. Màu nhận diện TÁCH RIÊNG khỏi màu trạng thái (xanh/vàng/đỏ) để hai thứ không lẫn. */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-4 rounded-full bg-[#8B1A1A]" />
          <h2 className="text-sm font-bold text-slate-900">Thời kỳ</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#FCE8E8] text-[#8B1A1A] border border-[#E8B4B4]">{tk.clientCount} công ty</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-indigo-200 border-t-[3px] border-t-indigo-600 rounded-b-xl p-3">
            <p className="text-xs text-indigo-800">KPI Công nợ — trung bình theo nhân viên</p>
            <p className={'text-3xl font-bold mt-0.5 leading-none ' + pctText(tk.debtPercent)}>
              {tk.debtPercent === null ? '—' : tk.debtPercent + '%'}
            </p>
            <div className="mt-2"><Meter value={tk.debtPercent ?? 0} /></div>
            <p className="text-xs text-slate-600 mt-1.5">Đã thu {fmt(tk.totalCollected)}đ / {fmt(tk.totalFee)}đ</p>
          </div>
          <div className="bg-white border border-violet-200 border-t-[3px] border-t-violet-600 rounded-b-xl p-3">
            <p className="text-xs text-violet-800">KPI % Công việc — trung bình theo nhân viên</p>
            <p className={'text-3xl font-bold mt-0.5 leading-none ' + pctText(tk.taskPercent)}>
              {tk.taskPercent === null ? '—' : tk.taskPercent + '%'}
            </p>
            <div className="mt-2"><Meter value={tk.taskPercent ?? 0} /></div>
            <p className="text-xs text-slate-600 mt-1.5">Checklist DV HCNS Thời Kỳ · chỉ tính việc đúng hạn</p>
          </div>
          {/* Nợ tồn có NGUỒN HCNS. Kỳ nào không thu đủ, qua ngày 10 tháng sau sẽ tự chuyển vào
              đây và phải thu ở mục "Nợ tồn cũ" trong hồ sơ công ty. */}
          <div className="bg-white border border-orange-200 border-t-[3px] border-t-orange-500 rounded-b-xl p-3">
            <p className="text-xs text-orange-800">Nợ tồn HCNS chuyển tháng sau</p>
            <p className={'text-3xl font-bold mt-0.5 leading-none ' +
              (tk.oldDebt > 0 ? 'text-orange-600' : 'text-[#2E6B3A]')}>
              {fmt(tk.oldDebt || 0)}đ
            </p>
            <p className="text-xs text-slate-600 mt-2">
              {tk.oldDebt > 0
                ? tk.oldDebtClients + ' công ty · thu ở mục “Nợ tồn cũ”'
                : 'Chưa có kỳ nào quá hạn chuyển sang'}
            </p>
            <p className="text-xs text-slate-500 mt-1.5">Tính đến hiện tại, không theo tháng đang chọn</p>
          </div>
        </div>
        {tk.flow && (() => {
          const nameOf = new Map((tk.perStaff || []).map(x => [x.staffId, x.staffName]))
          return (
            <FlowTiles flow={tk.flow} unit="cty"
              note="Tồn đầu kỳ = nợ tồn HCNS còn lại của các tháng trước kỳ. Tháng đã chuyển nợ tồn thì còn phải thu lấy theo số nợ tồn còn lại."
              rows={(tk.perClient || []).map(c => ({
                id: c.id, name: c.name, sub: c.assigned_to ? nameOf.get(c.assigned_to) : 'Chưa phân công',
                opening: c.opening || 0, fee: c.dueFee, paid: c.collected, remain: c.totalRemain || 0,
              }))} />
          )
        })()}
        <p className="text-xs text-slate-500 mb-2">
          KPI phòng là <b>trung bình cộng % của từng nhân viên</b>, không phải tổng thu chia tổng phí — hai số này khác nhau.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="bg-indigo-50 text-indigo-900 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold py-2 px-2 rounded-l-lg">Nhân viên</th>
                <th className="text-right font-semibold py-2 px-2">Cty</th>
                <th className="text-right font-semibold py-2 px-2">Đã thu / Phải thu</th>
                <th className="text-left font-semibold py-2 px-2 w-32">Công nợ</th>
                <th className="text-left font-semibold py-2 px-2 w-32 rounded-r-lg">Công việc</th>
              </tr>
            </thead>
            <tbody>
              {tk.perStaff.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-500">Chưa có nhân viên nào thuộc phòng HCNS.</td></tr>
              )}
              {tk.perStaff.map((s, ri) => (
                <tr key={s.staffId} className={'border-b border-slate-200 last:border-0 ' + (ri % 2 ? 'bg-slate-50' : '')}>
                  <td className="py-2 px-2 text-slate-800">
                    <span className="flex items-center gap-2">
                      <span className={'w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ' + avatarTone(s.staffId)}>
                        {initialOf(s.staffName)}
                      </span>
                      {s.staffName}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-600">{s.clientCount}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-600">{fmt(s.totalCollected)} / {fmt(s.totalFee)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Meter value={s.debtPercent ?? 0} />
                      <span className={'tabular-nums font-medium w-9 text-right ' + pctText(s.debtPercent)}>
                        {s.debtPercent === null ? '—' : s.debtPercent + '%'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Meter value={s.taskPercent ?? 0} />
                      <span className={'tabular-nums font-medium w-9 text-right ' + pctText(s.taskPercent)}>
                        {s.taskPercent === null ? '—' : s.taskPercent + '%'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Đã ẩn Vãng lai (2026-09-21) — chỉ còn Thời kỳ + Thời điểm, khối Thời điểm trải hết bề
          ngang cho cân với khối Thời kỳ phía trên. */}
      <CaseBlock title="Thời điểm" data={report.thoiDiem} wide />
      {report.phatSinh && <PhatSinhBlock data={report.phatSinh} />}
    </div>
  )
}

// Việc thời điểm của công ty Thời kỳ — không có tiền, chỉ theo dõi tiến độ + đúng hạn.
function PhatSinhBlock({ data }) {
  const max = Math.max(1, ...data.byStatus.map(s => s.count))
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-4 rounded-full bg-violet-600" />
        <h2 className="text-sm font-bold text-slate-900">Thời kỳ – Phát sinh</h2>
        <span className="text-xs px-2 py-0.5 rounded-full border bg-violet-50 text-violet-900 border-violet-200">{data.companyCount} công ty</span>
        <span className="text-xs text-slate-500">· không thu phí riêng, không tính công nợ</span>
      </div>
      {data.serviceCount === 0 ? (
        <p className="text-xs text-slate-500">Chưa có việc phát sinh nào trong kỳ.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="border rounded-lg px-2 py-1.5 bg-violet-50 border-violet-200 text-violet-900">
                <p className="text-xs opacity-80">Việc phát sinh</p>
                <p className="text-base font-bold tabular-nums">{data.serviceCount}</p>
              </div>
              <div className="border rounded-lg px-2 py-1.5 bg-emerald-50 border-emerald-200 text-emerald-900">
                <p className="text-xs opacity-80">Đã xong</p>
                <p className="text-base font-bold tabular-nums">{data.doneCount}</p>
              </div>
              <OnTimeTile ot={data.onTime} />
            </div>
            <p className="text-xs text-slate-600 mb-1.5">Theo bước xử lý</p>
            {data.byStatus.map((s, i) => (
              <div key={s.status} className="flex items-center gap-2 mb-1">
                <span className="text-xs w-28 flex-shrink-0 text-slate-700">{s.label}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={'h-full rounded-full ' + (STEP_BAR[i] || 'bg-blue-600')} style={{ width: (s.count / max * 100) + '%' }} />
                </div>
                <span className="text-xs tabular-nums w-4 text-right">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-600 mb-1.5">Công ty có việc phát sinh</p>
            {data.companies.map(c => (
              <div key={c.id} className="flex justify-between gap-2 text-xs text-slate-700 py-1 border-b border-slate-100 last:border-0">
                <span className="truncate">{c.name} <span className="text-slate-400">· {c.staffName || 'Chưa phân công'}</span></span>
                <span className="tabular-nums flex-shrink-0">
                  {c.done}/{c.services} xong
                  {c.late > 0 && <span className="ml-1.5 font-semibold text-[#B3261E]">· {c.late} trễ</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Màu nhận diện riêng cho từng khối để phân biệt Thời điểm / Vãng lai khi hai khối nằm cạnh nhau.
const CASE_TONE = {
  'Thời điểm': { bar: 'bg-indigo-600', chip: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
  'Vãng lai':  { bar: 'bg-amber-500',  chip: 'bg-amber-50 text-amber-900 border-amber-300' },
}

// Dải xanh nhạt -> đậm theo THỨ TỰ 5 bước xử lý (chuỗi có thứ tự nên dùng dải chuyển sắc, không
// phải 5 màu ngẫu nhiên). Bước cuối "Hoàn thành" chuyển xanh lá — đó là đích, không phải một bước
// xanh dương đậm hơn.
const STEP_BAR = ['bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-600', 'bg-[#2E6B3A]']

// Thẻ đúng hạn: tỉ lệ dịch vụ ĐÃ TỚI HẠN mà xong đúng hạn.
//   mẫu số = xong đúng hạn + xong trễ + đang làm mà đã quá hạn
//   dịch vụ đang làm, CHƯA tới hạn không tính vào (chưa thể nói đúng hay trễ).
function OnTimeTile({ ot }) {
  if (!ot) return null
  const lateAll = ot.doneLate + ot.openLate
  const base = ot.doneOk + lateAll
  const pct = base > 0 ? Math.round(ot.doneOk / base * 100) : null
  return (
    <div className={'border rounded-lg px-2 py-1.5 ' + (lateAll > 0 ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-200')}>
      <p className={'text-xs ' + (lateAll > 0 ? 'text-red-800' : 'text-emerald-800')}>Hoàn thành đúng hạn</p>
      <p className={'text-base font-bold tabular-nums leading-tight ' + pctText(pct)}>{pct === null ? '—' : pct + '%'}</p>
      <p className="text-[11px] tabular-nums text-slate-600">
        {ot.doneOk} đúng hạn · <span className={lateAll > 0 ? 'text-[#B3261E] font-semibold' : ''}>{lateAll} trễ hạn</span>
        {ot.open > 0 ? ' · ' + ot.open + ' chưa tới hạn' : ''}
      </p>
    </div>
  )
}

// Công nợ 4 bước theo kỳ: Tồn đầu kỳ → Phí trong kỳ → Đã thu → Còn phải thu. Bấm từng thẻ để
// xem danh sách công ty/hồ sơ đứng sau con số. Dùng chung cho khối Thời kỳ và Thời điểm.
function FlowTiles({ flow, rows, unit, note }) {
  const [open, setOpen] = useState(null)   // null | 'opening' | 'fee' | 'paid' | 'remain'
  const TILES = [
    ['opening', 'Tồn đầu kỳ',      'bg-amber-50 border-amber-300 text-amber-900',   flow.opening],
    ['fee',     '+ Phí trong kỳ',  'bg-blue-50 border-blue-200 text-blue-900',      flow.periodFee],
    ['paid',    '− Đã thu',        'bg-emerald-50 border-emerald-200 text-emerald-900', flow.periodPaid],
    ['remain',  '= Còn phải thu',  flow.remain > 0 ? 'bg-red-50 border-red-300 text-[#8B1A1A]' : 'bg-emerald-50 border-emerald-200 text-emerald-900', flow.remain],
  ]
  const count = (k) => rows.filter(r => r[k] > 0).length
  const shown = open ? rows.filter(r => r[open] > 0).sort((a, b) => b[open] - a[open]) : []
  const label = { opening: 'Có tồn đầu kỳ', fee: 'Có phí trong kỳ', paid: 'Đã thu trong kỳ', remain: 'Còn phải thu' }
  return (
    <div className="mb-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {TILES.map(([k, lbl, cls, v]) => (
          <button key={k} onClick={() => setOpen(open === k ? null : k)}
            className={'text-left border rounded-lg px-2.5 py-1.5 transition-colors hover:brightness-95 ' + cls +
              (open === k ? ' ring-2 ring-offset-1 ring-slate-300' : '')}>
            <p className="text-xs opacity-80">{lbl}</p>
            <p className="text-base font-bold tabular-nums leading-tight">{fmt(v)}đ</p>
            <p className="text-[11px] tabular-nums opacity-80">
              {k === 'paid' && flow.periodFee + flow.opening > 0
                ? Math.round(flow.periodPaid / (flow.periodFee + flow.opening) * 100) + '% · '
                : ''}
              {count(k) + ' ' + unit + (open === k ? ' · đang mở' : ' · xem')}
            </p>
          </button>
        ))}
      </div>
      {open && (
        <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <span>{label[open]} ({shown.length})</span>
            <button onClick={() => setOpen(null)} className="normal-case tracking-normal text-slate-500 hover:text-slate-800">✕ Đóng</button>
          </div>
          {shown.length === 0 && <p className="px-2.5 py-3 text-xs text-slate-500">Không có {unit} nào.</p>}
          <div className="max-h-80 overflow-y-auto">
            {shown.map((r, i) => (
              <div key={r.id} className={'px-2.5 py-1.5 border-t border-slate-100 flex justify-between gap-3 items-start ' + (i % 2 ? 'bg-slate-50' : 'bg-white')}>
                <span className="text-xs text-slate-800 flex-1 min-w-0">
                  <span className="block truncate">{r.name}</span>
                  <span className="text-[11px] text-slate-500">{r.sub}</span>
                </span>
                <span className="text-[11px] tabular-nums text-slate-500 text-right hidden md:block">
                  tồn {fmt(r.opening)} · phí {fmt(r.fee)} · thu {fmt(r.paid)} ·{' '}
                  <b className={r.remain > 0 ? 'text-[#B3261E] font-semibold' : 'text-[#2E6B3A] font-semibold'}>
                    {r.remain > 0 ? 'còn ' + fmt(r.remain) + 'đ cuối kỳ' : 'đã thu đủ'}
                  </b>
                </span>
                <span className={'text-xs font-semibold tabular-nums w-28 text-right flex-shrink-0 ' +
                  (open === 'remain' ? 'text-[#B3261E]' : 'text-slate-800')}>
                  {fmt(r[open])}đ
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {note && <p className="text-[11px] text-slate-500 mt-1.5">{note}</p>}
    </div>
  )
}

function CaseBlock({ title, data, wide }) {
  const max = Math.max(1, ...data.byStatus.map(s => s.count))
  const tone = CASE_TONE[title] || CASE_TONE['Thời điểm']
  const cases = data.cases || []
  const tile = (label, value, cls, sub) => (
    <div className={'border rounded-lg px-2 py-1.5 ' + cls}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-base font-bold tabular-nums leading-tight">{value}</p>
      {/* Dòng phụ LUÔN chiếm chỗ, kể cả khi rỗng — nếu chỉ hiện khi có dữ liệu thì ô này cao hơn
          ô kia một dòng, kéo lệch cả khối bên dưới giữa Thời điểm và Vãng lai. */}
      <p className="text-[11px] tabular-nums opacity-70">{sub || ' '}</p>
    </div>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className={'w-1 h-4 rounded-full ' + tone.bar} />
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className={'text-xs px-2 py-0.5 rounded-full border ' + tone.chip}>{data.caseCount} hồ sơ</span>
      </div>

      {/* Hàng việc CỦA KỲ đang chọn: số hồ sơ, dịch vụ, % công việc (chỉ việc tích trong hạn) và
          tình hình đúng hạn theo hạn hoàn thành chốt lúc thêm dịch vụ. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        {tile('Hồ sơ', data.caseCount, 'bg-indigo-50 border-indigo-200 text-indigo-900')}
        {tile('Dịch vụ', data.serviceCount, 'bg-violet-50 border-violet-200 text-violet-900')}
        <div className="border rounded-lg px-2 py-1.5 bg-slate-50 border-slate-200">
          <p className="text-xs text-slate-600">% Công việc (việc tích trong hạn)</p>
          <p className={'text-base font-bold tabular-nums leading-tight ' + pctText(data.taskPercent)}>
            {data.taskPercent === null ? '—' : data.taskPercent + '%'}
          </p>
          <p className="text-[11px] tabular-nums text-slate-500">
            {data.taskTotal > 0 ? data.taskDone + '/' + data.taskTotal + ' việc' : ' '}
          </p>
        </div>
        <OnTimeTile ot={data.onTime} />
      </div>

      {data.flow && (
        <FlowTiles flow={data.flow} unit="hồ sơ"
          note="Tồn đầu kỳ = chi phí dịch vụ nhận trước kỳ trừ tiền đã thu trước kỳ. Phí trong kỳ = dịch vụ nhận trong kỳ. Đã thu = tiền ghi nhận trong kỳ."
          rows={cases.map(c => ({
            id: c.id, name: c.name, sub: [c.caseCode, c.staffName].filter(Boolean).join(' · ') + (c.allDone ? ' · xong việc' : ''),
            opening: c.opening || 0, fee: c.periodFee || 0, paid: c.periodPaid || 0, remain: c.periodRemain || 0,
          }))} />
      )}

      {/* Xong việc mà chưa thu đủ — nhóm dễ bị bỏ quên nhất vì đã rời sang thẻ Hoàn thành. */}
      {data.doneUnpaidCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-3">
          <span className="text-amber-700">⚠</span>
          <p className="text-xs text-amber-900">
            <b>{data.doneUnpaidCount} hồ sơ đã xong việc nhưng chưa thu đủ</b> · còn {fmt(data.doneUnpaidRemain)}đ
          </p>
        </div>
      )}

      <div className={wide ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
      <div>
      <p className="text-xs text-slate-600 mb-1.5">Dịch vụ theo bước xử lý</p>
      {data.byStatus.map((s, i) => (
        <div key={s.status} className="flex items-center gap-2 mb-1">
          <span className={'text-xs w-28 flex-shrink-0 ' +
            (i === data.byStatus.length - 1 && s.count > 0 ? 'text-[#2E6B3A] font-semibold' : 'text-slate-700')}>
            {s.label}
          </span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={'h-full rounded-full ' + (STEP_BAR[i] || 'bg-blue-600')}
              style={{ width: (s.count / max * 100) + '%' }} />
          </div>
          <span className={'text-xs tabular-nums w-4 text-right ' +
            (s.count > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400')}>{s.count}</span>
        </div>
      ))}

      </div>
      {data.byStaff.length > 0 && (
        <div className={wide ? 'lg:border-l lg:border-slate-200 lg:pl-6' : 'mt-3 pt-2 border-t border-slate-200'}>
          {wide && <p className="text-xs text-slate-600 mb-1.5">Theo nhân viên phụ trách</p>}
          {data.byStaff.map(s => (
            <div key={s.staffId} className="flex justify-between gap-2 text-xs text-slate-600 py-1">
              <span className="truncate">{s.staffName || '(chưa gán)'}</span>
              <span className="tabular-nums flex-shrink-0">
                {s.cases} hồ sơ · {s.services} dịch vụ
                {s.late > 0 && <span className="ml-1.5 font-semibold text-[#B3261E]">· {s.late} trễ hạn</span>}
                {s.taskPercent !== null && (
                  <span className={'ml-1.5 font-semibold ' + pctText(s.taskPercent)}>{s.taskPercent}%</span>
                )}
                {s.remain > 0 && (
                  <span className="ml-1.5 font-semibold text-[#B3261E]">· còn thu {fmt(s.remain)}đ</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

/* ─────────────────────────── Một dòng công ty ─────────────────────────── */
function ClientRow({ c, ri, showCat, stopped, phatSinh, report, expanded, onToggle, clientMonth, setClientMonth, selMonth, canManage, canAssign, isAdmin, canEditInfo, staffList, templates, onChanged }) {
  const stat = report?.thoiKy?.perClient?.find(p => p.id === c.id)
  const isThoiKy = c.category === 'thoi_ky'
  // Xong hết việc mà vẫn còn nợ tiền — phải nhìn thấy được, kẻo nằm im ở thẻ Hoàn thành.
  const doneUnpaid = !stopped && c.allDone && Number(c.caseRemain) > 0
  const [assigning, setAssigning] = useState(false)

  const assign = async (staffId) => {
    setAssigning(true)
    const res = await fetch('/api/admin/hcns/clients', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, assigned_to: staffId || null }),
    })
    const j = await res.json()
    setAssigning(false)
    if (j.error) alert('Không lưu được: ' + j.error)
    else onChanged()
  }

  return (
    <div className="border-b border-slate-200 last:border-0">
      {/* Kẻ sọc chẵn/lẻ để mắt lần đúng hàng khi bảng trải hết bề ngang. */}
      <button onClick={onToggle}
        className={'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ' +
          (doneUnpaid ? 'border-l-[3px] border-l-orange-500 ' : '') +
          (expanded ? 'bg-[#8B1A1A]/[0.06]'
            : doneUnpaid ? 'bg-orange-50 hover:bg-orange-100'
            : (ri % 2 ? 'bg-slate-50' : 'bg-white') + ' hover:bg-[#8B1A1A]/[0.04]')}>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
            {c.name}
            {showCat && <span className={'text-[11px] font-medium px-2 py-0.5 rounded-full ' + CAT_STYLE[c.category]}>{CAT_LABEL[c.category]}</span>}
            {stopped && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-400">
                Đã ngưng DV
              </span>
            )}
            {!stopped && c.lateServiceCount > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-[#B3261E] border border-red-300">
                ⏰ Trễ hạn {c.lateServiceCount > 1 ? c.lateServiceCount + ' dịch vụ' : ''}
              </span>
            )}
            {!stopped && !isThoiKy && c.allDone && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                Xong {c.doneServiceCount}/{c.serviceCount} dịch vụ
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {[c.case_code || c.client_code, c.tax_code,
              isThoiKy ? (Number(c.hcns_fee) > 0
                ? fmt(c.hcns_fee) + 'đ/' + (c.fee_period === 'quarterly' ? 'Quý' : 'Tháng')
                : 'Miễn phí') : null,
              c.staff?.full_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        {phatSinh && (
          <span className={'text-xs font-semibold px-2 py-1 rounded-md border flex-shrink-0 ' +
            (c.doneServiceCount === c.serviceCount ? 'bg-emerald-50 text-[#2E6B3A] border-emerald-300' : 'bg-violet-50 text-violet-900 border-violet-300')}>
            {c.doneServiceCount}/{c.serviceCount} việc phát sinh xong
          </span>
        )}
        {!phatSinh && isThoiKy && stat && (
          <>
            <DebtBadge stat={stat} />
            {stat.taskPercent !== null && (
              <span className={'text-xs font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white flex-shrink-0 ' + pctText(stat.taskPercent)}>
                {stat.taskDone}/{stat.taskTotal} việc · {stat.taskPercent}%
              </span>
            )}
          </>
        )}
        {/* Khối tiền của hồ sơ — LUÔN ở cùng một vị trí trên mọi dòng để mắt chỉ phải nhìn một
            chỗ khi lướt danh sách. Số tiền luôn đi kèm thanh màu: màu một mình thì người mù màu
            không đọc được, mà số cụ thể mới dùng được để gọi khách. */}
        {!stopped && !isThoiKy && Number(c.caseCost) > 0 && (
          <span className="w-[196px] flex-shrink-0 text-right">
            <span className="block text-xs">
              <b className={'font-semibold ' + (c.caseRemain === 0 ? 'text-[#2E6B3A]' : c.casePaid > 0 ? 'text-[#87590B]' : 'text-[#B3261E]')}>
                {fmt(c.casePaid)}
              </b>
              <span className="text-slate-400"> / {fmt(c.caseCost)}đ</span>
            </span>
            <span className="flex items-center gap-1.5 justify-end mt-0.5">
              <span className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <span className={'block h-1.5 rounded-full ' +
                  (c.caseRemain === 0 ? 'bg-[#2E6B3A]' : c.casePaid > 0 ? 'bg-[#D89614]' : 'bg-[#B3261E]')}
                  style={{ width: (c.caseCost > 0 ? Math.min(100, Math.round(c.casePaid / c.caseCost * 100)) : 0) + '%' }} />
              </span>
              {doneUnpaid ? (
                // Xong hết việc mà còn nợ — nhóm dễ bị quên nhất vì hồ sơ đã rời sang thẻ Hoàn thành.
                <span className="text-[11px] font-semibold text-white bg-[#B3261E] rounded px-1.5 py-0.5 whitespace-nowrap">
                  còn thu {fmt(c.caseRemain)}đ
                </span>
              ) : (
                <span className={'text-[11px] font-semibold whitespace-nowrap ' +
                  (c.caseRemain === 0 ? 'text-[#2E6B3A]' : c.casePaid > 0 ? 'text-[#87590B]' : 'text-[#B3261E]')}>
                  {c.caseRemain === 0 ? 'đã thu đủ' : c.casePaid > 0 ? 'còn ' + fmt(c.caseRemain) + 'đ' : 'chưa thu'}
                </span>
              )}
            </span>
          </span>
        )}
        {/* Phân công nhân viên phụ trách — KPI và công nợ của công ty này sẽ tính cho người được
            chọn. Bấm vào select không được mở/đóng dòng nên chặn sự kiện lan lên nút cha. */}
        {canAssign && !stopped ? (
          <span onClick={e => { e.stopPropagation() }} className="flex-shrink-0">
            <select value={c.assigned_to || ''} disabled={assigning}
              onChange={e => assign(e.target.value)}
              className={'text-xs border rounded-lg px-2 py-1 bg-white max-w-[150px] ' +
                (c.assigned_to ? 'border-slate-300 text-slate-800' : 'border-amber-400 bg-amber-50 text-amber-900')}>
              <option value="">⚠ Chưa phân công</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </span>
        ) : !stopped && !c.assigned_to && (
          <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-400 flex-shrink-0">Chưa phân công</span>
        )}
        <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="bg-slate-50 border-t border-slate-200">
          {stopped ? (
            <StoppedSummary c={c} canManage={canManage} onChanged={onChanged} />
          ) : phatSinh ? (
            <CaseServices hcnsClient={c} canManage={canManage} isAdmin={isAdmin} canEditInfo={canEditInfo} staffList={staffList} templates={templates} onChanged={onChanged} />
          ) : isThoiKy && c.linkedClient ? (
            <ClientChecklist
              client={{ ...c.linkedClient, uses_hcns: true }}
              hcnsClient={c}
              context="hcns"
              defaultPanel="hcns_work"
              clientMonth={clientMonth[c.id] || selMonth}
              onMonthChange={m => setClientMonth(p => ({ ...p, [c.id]: m }))}
              onDebtSaved={onChanged}
              toolbarExtra={canManage ? <HcnsFeeBar c={c} onChanged={onChanged} /> : null}
            />
          ) : isThoiKy ? (
            <p className="text-xs text-slate-500 px-4 py-4">
              Chưa tìm thấy công ty kế toán gốc — có thể công ty đã bị xoá bên Danh sách công ty.
            </p>
          ) : (
            <CaseServices hcnsClient={c} canManage={canManage} isAdmin={isAdmin} canEditInfo={canEditInfo} staffList={staffList} templates={templates} onChanged={onChanged} />
          )}
        </div>
      )}
    </div>
  )
}

// Đỏ "Chưa thu" / vàng "Thu thiếu ..." / xanh "Đã thu" — kế toán cập nhật xong là phòng HCNS
// thấy đổi màu ngay, không cần báo tay.
/* ──────────────── Công ty đã ngưng DV HCNS — chỉ XEM lại ──────────────── */
// Ngừng dịch vụ KHÔNG xoá gì: mức phí từng tháng, tiền đã thu, checklist đã tích đều còn nguyên.
// Khối này mở lại phần đó để tra cứu. Cố ý không cho ghi công nợ hay tích việc — muốn làm tiếp
// thì tick lại "Có sử dụng DV HCNS" bên Danh sách công ty trước.
// Phí HCNS + ngưng dịch vụ, thao tác ngay trong Phòng HCNS (người HCNS không sửa được công ty
// bên Danh sách công ty, trước đây phải nhờ kế toán).
function HcnsFeeBar({ c, onChanged }) {
  const [mode, setMode] = useState(null)      // null | 'fee' | 'stop'
  const [fee, setFee] = useState('')
  const [month, setMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const per = c.fee_period === 'quarterly' ? 'Quý' : 'Tháng'
  const now = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    opts.push({ v: d.getFullYear() + '-' + (d.getMonth() + 1), label: 'T' + (d.getMonth() + 1) + '/' + d.getFullYear() })
  }

  const send = async (body, okMsg) => {
    setBusy(true); setErr('')
    const j = await fetch('/api/admin/hcns/clients', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, ...body }),
    }).then(r => r.json()).catch(() => ({ error: 'Không lưu được, thử lại.' }))
    setBusy(false)
    if (j.error) { setErr(j.error); return }
    setMode(null)
    if (okMsg) window.alert(okMsg)
    onChanged && onChanged()
  }

  const saveFee = () => {
    const v = Number(String(fee).replace(/\D/g, ''))
    if (!Number.isFinite(v)) { setErr('Nhập mức phí.'); return }
    send({ hcns_fee: v })
  }
  const doStop = () => {
    const [y, m] = (month || opts[0].v).split('-').map(Number)
    if (!window.confirm('Ngưng DV HCNS của "' + c.name + '" từ T' + m + '/' + y + '?')) return
    send({ hcns_stop_from: { year: y, month: m } },
      'Đã ghi ngưng DV HCNS. Nếu chọn tháng sau thì công ty còn ở tag Thời kỳ tới tháng đó.')
  }

  // Hai nút nằm CÙNG HÀNG với Thông tin / Công việc HCNS / ĐNTT / Công nợ / Tài liệu; bấm vào thì
  // ô nhập bung ra ngay tại chỗ (dùng position absolute để không đẩy lệch hàng nút).
  const btnCls = 'text-xs px-2.5 py-1.5 rounded-lg font-medium border leading-none flex-shrink-0 '
  return (
    <span className="relative flex items-center gap-2 flex-shrink-0">
      <button onClick={() => { setMode(mode === 'fee' ? null : 'fee'); setFee(String(Number(c.hcns_fee) || '')); setErr('') }}
        title={'Phí DV HCNS hiện tại: ' + (Number(c.hcns_fee) > 0 ? fmt(c.hcns_fee) + 'đ/' + per : 'Miễn phí')}
        className={btnCls + (mode === 'fee'
          ? 'bg-sky-600 text-white border-sky-600'
          : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100')}>
        🏢 Sửa phí HCNS
      </button>
      <button onClick={() => { setMode(mode === 'stop' ? null : 'stop'); setMonth(opts[0].v); setErr('') }}
        className={btnCls + (mode === 'stop'
          ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
          : 'bg-red-50 text-[#B3261E] border-red-200 hover:bg-red-100')}>
        ⏹ Ngưng DV HCNS
      </button>

      {mode && (
        <span className="absolute left-0 top-full mt-1 z-20 flex items-center gap-2 flex-wrap bg-white border border-slate-300 rounded-xl shadow-lg px-3 py-2 min-w-[420px]">
          {mode === 'fee' ? (
            <>
              <span className="text-xs text-slate-600">
                Phí hiện tại <b className="text-slate-800">{Number(c.hcns_fee) > 0 ? fmt(c.hcns_fee) + 'đ' : '0đ'}</b> →
              </span>
              <input autoFocus inputMode="numeric"
                value={fee ? Number(String(fee).replace(/\D/g, '') || 0).toLocaleString('vi-VN') : ''}
                onChange={e => { setFee(e.target.value.replace(/\D/g, '')); setErr('') }}
                className="w-32 px-2 py-1 border border-sky-300 rounded-md text-sm" placeholder={'đ/' + per} />
              <span className="text-xs text-slate-500">đ/{per} · đã gồm VAT</span>
              <button onClick={saveFee} disabled={busy} className="text-xs px-3 py-1 rounded-md bg-sky-700 text-white disabled:opacity-60">
                {busy ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button onClick={() => setMode(null)} className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-600">Hủy</button>
              <p className="basis-full text-[11px] text-slate-500">
                Mức mới áp từ tháng này trở đi, các tháng trước giữ nguyên mức cũ để công nợ cũ không đổi.
              </p>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-700">Ngưng DV HCNS từ</span>
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="px-2 py-1 border border-red-300 rounded-md text-sm bg-white">
                {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <button onClick={doStop} disabled={busy} className="text-xs px-3 py-1 rounded-md bg-[#8B1A1A] text-white disabled:opacity-60">
                {busy ? 'Đang lưu...' : 'Xác nhận ngưng'}
              </button>
              <button onClick={() => setMode(null)} className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-600">Hủy</button>
              <p className="basis-full text-[11px] text-slate-500">
                Chọn tháng sau thì công ty còn ở tag Thời kỳ tới tháng đó rồi mới tự gỡ.
              </p>
            </>
          )}
          {err && <span className="basis-full text-xs text-[#B3261E]">{err}</span>}
        </span>
      )}
    </span>
  )
}

// Bật lại DV HCNS cho công ty đã ngưng — dùng ở thẻ "Ngưng DV HCNS".
function HcnsResume({ c, onChanged }) {
  const [open, setOpen] = useState(false)
  const [fee, setFee] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const per = c.fee_period === 'quarterly' ? 'Quý' : 'Tháng'
  const save = async () => {
    const v = Number(String(fee).replace(/\D/g, ''))
    if (!Number.isFinite(v)) { setErr('Nhập mức phí HCNS mới.'); return }
    setBusy(true); setErr('')
    const j = await fetch('/api/admin/hcns/clients', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, hcns_resume: { hcns_fee: v } }),
    }).then(r => r.json()).catch(() => ({ error: 'Không lưu được, thử lại.' }))
    setBusy(false)
    if (j.error) { setErr(j.error); return }
    setOpen(false); onChanged && onChanged()
  }
  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setFee(String(Number(c.hcns_fee) || '')) }}
        className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-[#2E6B3A] hover:bg-emerald-50">
        Dùng lại DV HCNS
      </button>
    )
  }
  return (
    <span className="flex items-center gap-2 flex-wrap">
      <input autoFocus inputMode="numeric"
        value={fee ? Number(String(fee).replace(/\D/g, '') || 0).toLocaleString('vi-VN') : ''}
        onChange={e => { setFee(e.target.value.replace(/\D/g, '')); setErr('') }}
        className="w-32 px-2 py-1 border border-emerald-300 rounded-md text-sm" placeholder={'Phí đ/' + per} />
      <span className="text-xs text-slate-500">đ/{per}</span>
      <button onClick={save} disabled={busy} className="text-xs px-3 py-1 rounded-md bg-[#2E6B3A] text-white disabled:opacity-60">
        {busy ? 'Đang lưu...' : 'Bật lại'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-600">Hủy</button>
      {err && <span className="text-xs text-[#B3261E]">{err}</span>}
    </span>
  )
}

function StoppedSummary({ c, canManage, onChanged }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/admin/hcns/debt-history?hcnsClientId=' + c.id)
      .then(r => r.json()).then(j => setData(j)).catch(() => setData({ data: [] }))
  }, [c.id])

  if (!data) return <p className="text-xs text-slate-500 px-4 py-4">Đang tải lịch sử...</p>

  const rows = data.data || []
  const plans = data.plans || []
  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  return (
    <div className="px-4 py-3 space-y-3 max-w-3xl">
      <div className="text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 leading-relaxed">
        <p>
          Công ty đã ngưng dùng DV HCNS. Toàn bộ lịch sử bên dưới được giữ nguyên. Bật lại là công ty
          quay về thẻ <b>Thời kỳ</b> với đầy đủ dữ liệu cũ.
        </p>
        {canManage && <div className="mt-2"><HcnsResume c={c} onChanged={onChanged} /></div>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[['Số lần đã thu', rows.length], ['Tổng đã thu', fmt(total) + 'đ'],
          ['Số lần đổi phí', plans.length]].map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-sm font-bold text-slate-800 tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div>
        <p className={colHeadCls}>Lịch sử thu phí HCNS</p>
        {rows.length === 0 && <p className="text-xs text-slate-500">Chưa từng ghi nhận khoản thu nào.</p>}
        <div className="space-y-0.5">
          {rows.map(r => (
            <div key={r.year + '-' + r.month} className="flex justify-between text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-700">T{r.month}/{r.year}{r.note ? ' · ' + r.note : ''}</span>
              <span className="font-semibold text-slate-800 tabular-nums">{fmt(r.amount)}đ</span>
            </div>
          ))}
        </div>
      </div>

      {plans.length > 0 && (
        <div>
          <p className={colHeadCls}>Lịch sử mức phí</p>
          <div className="space-y-0.5">
            {plans.map(r => (
              <div key={'p' + r.year + '-' + r.month} className="flex justify-between text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-700">
                  Từ T{r.month}/{r.year}
                  {Number(r.amount) === 0 && <span className="text-slate-500"> · ngưng dịch vụ</span>}
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmt(r.amount)}đ</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DebtBadge({ stat }) {
  // Viền cùng tông chữ — badge nền nhạt trơn bị chìm khi dòng có nền sọc xám.
  const cls = 'text-xs font-semibold px-2 py-1 rounded-md border flex-shrink-0 '
  // Phí HCNS = 0 là công ty được hỗ trợ miễn phí — nói rõ để nhân viên không đi đòi tiền, và để
  // không lẫn với "Chưa tới kỳ" (công ty thu theo quý, tháng này chưa đến kỳ thu).
  if (!stat.dueFee && stat.freeOfCharge) return <span className={cls + 'bg-[#E6F1FB] text-[#0C447C] border-[#378ADD]'}>Miễn phí</span>
  if (!stat.dueFee) return <span className={cls + 'bg-slate-100 text-slate-600 border-slate-300'}>Chưa tới kỳ</span>
  if (stat.remain === 0) return <span className={cls + 'bg-[#EBF3EB] text-[#2E6B3A] border-[#2E6B3A]/40'}>Đã thu</span>
  if (stat.collected > 0) return <span className={cls + 'bg-[#FAF1DC] text-[#87590B] border-[#D89614]'}>Thu thiếu {fmt(stat.remain)}đ</span>
  return <span className={cls + 'bg-[#FAEBEA] text-[#B3261E] border-[#B3261E]/40'}>Chưa thu</span>
}

/* ──────────────── Dịch vụ trong hồ sơ Thời điểm / Vãng lai ──────────────── */
function CaseServices({ hcnsClient, canManage, isAdmin, canEditInfo, staffList, templates, onChanged }) {
  // Việc phát sinh của công ty Thời kỳ: không thu phí riêng (phí đã nằm trong phí HCNS tháng) —
  // ẩn chi phí, ĐNTT, công nợ; hồ sơ là chính công ty Thời kỳ nên không sửa/xoá ở đây.
  const noFee = hcnsClient.category === 'thoi_ky'
  const [services, setServices] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEditCase, setShowEditCase] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [panel, setPanel] = useState(null)   // null | 'debt' | 'dntt'
  // Sửa lại thông tin dịch vụ đã khai (nhập nhầm phí, nhầm ngày). API đã nhận sẵn, trước đây chỉ
  // thiếu chỗ bấm nên nhập sai là phải xoá dịch vụ rồi khai lại — mất luôn checklist đã tích.
  const [editSvc, setEditSvc] = useState(null)   // { id, cost, received_at, expected_at }
  const [savingSvc, setSavingSvc] = useState(false)
  const [svcErr, setSvcErr] = useState('')
  const [debt, setDebt] = useState(null)
  // Ghi chú nội bộ: gom theo case_service_id. notesOk=false nghĩa là chưa chạy
  // sql/10_hcns_case_notes.sql (hoặc bản clone) — cột 3 báo rõ thay vì im lặng hỏng.
  const [notes, setNotes] = useState({})
  const [notesOk, setNotesOk] = useState(true)

  const loadNotes = async (svcs) => {
    const ids = (svcs || services || []).map(s => s.id)
    if (!ids.length) { setNotes({}); return }
    const r = await fetch('/api/admin/hcns/case-notes?caseServiceIds=' + ids.join(','))
      .then(r => r.json()).catch(() => ({}))
    setNotes(r.data || {})
    setNotesOk(!r.notInstalled)
  }

  const load = async () => {
    const [svcRes, debtRes] = await Promise.all([
      fetch('/api/admin/hcns/case-services?hcnsClientId=' + hcnsClient.id).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/hcns/case-payments?hcnsClientId=' + hcnsClient.id).then(r => r.json()).catch(() => ({})),
    ])
    const svcs = svcRes.data || []
    setServices(svcs)
    setDebt(debtRes.totals ? debtRes : null)
    loadNotes(svcs)
  }
  useEffect(() => { load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcnsClient.id])

  const toggleTask = async (taskId, done) => {
    await fetch('/api/admin/hcns/task-toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'case', taskId, done }),
    })
    load(); onChanged && onChanged()
  }
  const openEdit = (sv) => {
    setSvcErr('')
    setEditSvc({
      id: sv.id,
      cost: String(Number(sv.cost) || ''),
      received_at: sv.received_at || '',
      expected_at: sv.expected_at || '',
      note: sv.note || '',
    })
  }

  const saveSvc = async () => {
    const cost = noFee ? 0 : Number(String(editSvc.cost).replace(/\D/g, '')) || 0
    if (!noFee && cost <= 0) { setSvcErr('Chi phí phải lớn hơn 0.'); return }
    if (!editSvc.received_at) { setSvcErr('Chọn ngày nhận hồ sơ.'); return }
    // Hạ phí xuống dưới số ĐÃ THU thì hồ sơ thành "thu dư" — hỏi lại cho chắc thay vì lặng lẽ lưu.
    const paid = Number(debt?.perService?.find(x => x.id === editSvc.id)?.paid) || 0
    if (cost < paid) {
      const ok = window.confirm([
        'Dịch vụ này ĐÃ THU ' + fmt(paid) + 'đ, nhiều hơn mức phí mới ' + fmt(cost) + 'đ.',
        '',
        'Lưu tiếp thì hồ sơ sẽ thành thu dư ' + fmt(paid - cost) + 'đ. Vẫn lưu?',
      ].join('\n'))
      if (!ok) return
    }
    setSavingSvc(true)
    const j = await fetch('/api/admin/hcns/case-services', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editSvc.id, cost,
        received_at: editSvc.received_at || null,
        expected_at: editSvc.expected_at || null,
        note: editSvc.note || null,
      }),
    }).then(r => r.json()).catch(() => ({ error: 'Không lưu được, thử lại.' }))
    setSavingSvc(false)
    if (j.error) { setSvcErr(j.error); return }
    setEditSvc(null)
    load(); onChanged && onChanged()
  }

  // Việc tích sau ngày hạn (theo giờ VN) — bị loại khỏi %-công việc.
  const vnDay = (t) => new Date(new Date(t).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const taskLate = (sv, t) => !!(sv.due_at && t.done && t.done_at && vnDay(t.done_at) > sv.due_at)
  const hasLate = (sv) => hcnsDueState(sv).kind === 'done_late' || (sv.tasks || []).some(t => taskLate(sv, t))

  // Chỉ Quản trị — sửa / gia hạn ngày hạn hoàn thành của dịch vụ đang làm.
  const [editDue, setEditDue] = useState(null)   // { id, value }
  const saveDue = async (sv) => {
    const j = await fetch('/api/admin/hcns/case-services', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sv.id, due_at: editDue.value || null }),
    }).then(r => r.json()).catch(() => ({ error: 'Không lưu được, thử lại.' }))
    if (j.error) { window.alert(j.error); return }
    setEditDue(null)
    load(); onChanged && onChanged()
  }

  // Chỉ Quản trị — giống "Sửa đúng hạn" bên checklist kế toán.
  const fixOnTime = async (sv) => {
    if (!window.confirm([
      'Sửa "' + sv.templateName + '" thành hoàn thành ĐÚNG HẠN?',
      '',
      'Mốc hoàn thành và các việc tích sau hạn sẽ được đưa về ngày hạn ' + fmtDate(sv.due_at) + '.',
    ].join('\n'))) return
    const j = await fetch('/api/admin/hcns/case-services', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sv.id, fixOnTime: true }),
    }).then(r => r.json()).catch(() => ({ error: 'Không lưu được, thử lại.' }))
    if (j.error) { window.alert(j.error); return }
    load(); onChanged && onChanged()
  }

  const changeStatus = async (id, status) => {
    await fetch('/api/admin/hcns/case-services', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load(); onChanged && onChanged()
  }

  // Chỉ Quản trị. Server tự từ chối nếu hồ sơ đã có khoản thu — không xoá mất dấu tiền thật.
  const deleteCase = async () => {
    const paidCount = debt?.data?.length || 0
    const taskDone = (services || []).reduce((n, s) => n + (s.tasks || []).filter(t => t.done).length, 0)
    const ok = window.confirm([
      'XOÁ HỒ SƠ: ' + hcnsClient.name,
      'Mã hồ sơ: ' + (hcnsClient.case_code || '—'),
      '',
      'Sẽ xoá luôn ' + (services || []).length + ' dịch vụ, ' + taskDone + ' việc đã tích, ghi chú và nhật ký trạng thái.',
      paidCount ? 'Hồ sơ đang có ' + paidCount + ' khoản thu — hệ thống sẽ từ chối xoá.' : 'Hồ sơ chưa có khoản thu nào.',
      '',
      'Thao tác này KHÔNG khôi phục được. Xoá?',
    ].join('\n'))
    if (!ok) return
    setDeleting(true)
    const j = await fetch('/api/admin/hcns/clients?id=' + hcnsClient.id, { method: 'DELETE' })
      .then(r => r.json()).catch(() => ({ error: 'Không xoá được, thử lại.' }))
    setDeleting(false)
    if (j.error) { window.alert(j.error); return }
    onChanged && onChanged()
  }

  if (services === null) return <p className="text-xs text-slate-500 px-4 py-4">Đang tải dịch vụ...</p>

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-slate-600 flex-1 min-w-[160px]">
          {hcnsClient.phone && <span>SĐT: {hcnsClient.phone} · </span>}
          {hcnsClient.representative && <span>Đại diện: {hcnsClient.representative} · </span>}
          {services.length} dịch vụ
          {!noFee && debt?.totals && (
            <span className={'ml-1 font-semibold ' +
              (debt.totals.remain === 0 ? 'text-[#2E6B3A]' : debt.totals.totalPaid > 0 ? 'text-[#87590B]' : 'text-[#B3261E]')}>
              · {debt.totals.remain === 0 ? 'Đã thu đủ' : 'Còn phải thu ' + fmt(debt.totals.remain) + 'đ'}
            </span>
          )}
        </p>
        {!noFee && (<>
        <button onClick={() => setPanel(panel === 'dntt' ? null : 'dntt')}
          className={'text-xs px-3 py-1.5 rounded-lg font-medium border ' +
            (panel === 'dntt' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200')}>
          📄 ĐNTT
        </button>
        <button onClick={() => setPanel(panel === 'debt' ? null : 'debt')}
          className={'text-xs px-3 py-1.5 rounded-lg font-medium border ' +
            (panel === 'debt' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
          💰 Công nợ
        </button>
        </>)}
        {canManage && (
          <button onClick={() => setShowAdd(true)}
            className="text-xs px-3 py-1.5 bg-[#8B1A1A] text-white rounded-lg font-medium hover:bg-[#6B1212]">
            {noFee ? '+ Việc phát sinh' : '+ Thêm dịch vụ'}
          </button>
        )}
        {!noFee && (isAdmin || canEditInfo) && (
          <button onClick={() => setShowEditCase(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium border bg-white text-slate-700 border-slate-300 hover:bg-slate-50">
            ✏️ Sửa thông tin
          </button>
        )}
        {/* Xoá hồ sơ: CHỈ Quản trị. */}
        {!noFee && isAdmin && (
          <button onClick={deleteCase} disabled={deleting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium border bg-red-50 text-[#B3261E] border-red-300 hover:bg-red-100 disabled:opacity-50">
            {deleting ? 'Đang xoá...' : '🗑 Xoá hồ sơ'}
          </button>
        )}
      </div>
      {showEditCase && (
        <AddCaseModal category={hcnsClient.category} staffList={staffList || []} initial={hcnsClient}
          onClose={() => setShowEditCase(false)}
          onDone={() => { setShowEditCase(false); onChanged && onChanged() }} />
      )}

      {panel === 'dntt' && <CaseDnttPanel hcnsClient={hcnsClient} services={services} />}
      {panel === 'debt' && (
        <CaseDebtPanel hcnsClient={hcnsClient} debt={debt} canManage={canManage}
          onChanged={() => { load(); onChanged && onChanged() }} />
      )}

      {services.length === 0 && <p className="text-xs text-slate-500 py-2">Hồ sơ chưa có dịch vụ nào.</p>}

      {/* Mỗi dịch vụ chia 3 cột: Công việc | Tiến độ hồ sơ | Ghi chú nội bộ.
          Trước đây checklist chiếm hết bề ngang còn 2/3 bên phải bỏ trống. */}
      {services.map(s => (
        <div key={s.id} className="bg-white border border-slate-300 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
            {/* Ghi chú nhập lúc thêm dịch vụ — hiện ngay dưới tên để phân biệt các dịch vụ trùng
                tên (VD 2 lần "Điều chỉnh Mức Đóng" cho 2 người lao động khác nhau). */}
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-semibold text-slate-900">{s.templateName}</p>
              {s.note && (
                <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">📝 {String(s.note).replace(/^"+|"+$/g, '')}</p>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Nhận {fmtDate(s.received_at)}{s.expected_at ? ' · Dự kiến trả ' + fmtDate(s.expected_at) : ''}
              {!noFee && ' · Chi phí ' + fmt(s.cost) + 'đ'}
            </p>
            <DueBadge svc={s} />
            {/* Chỉ Quản trị: xong trễ → "Sửa đúng hạn" (kéo mốc về ngày hạn, giống kế toán);
                còn đang làm → sửa / gia hạn ngày hạn. */}
            {isAdmin && hasLate(s) && (
              <button onClick={() => fixOnTime(s)} title="Kéo mốc hoàn thành / các việc tích sau hạn về đúng ngày hạn"
                className="text-xs font-medium px-2 py-1 rounded-md border border-blue-300 bg-white text-blue-700 hover:bg-blue-50">
                Sửa đúng hạn
              </button>
            )}
            {isAdmin && s.status !== 'hoan_thanh' && editDue?.id !== s.id && (
              <button onClick={() => setEditDue({ id: s.id, value: s.due_at || new Date().toISOString().slice(0, 10) })}
                title="Sửa / gia hạn ngày hạn hoàn thành (chỉ Quản trị)"
                className="text-xs font-medium px-2 py-1 rounded-md border border-blue-300 bg-white text-blue-700 hover:bg-blue-50">
                {hcnsDueState(s).kind === 'late' ? 'Gia hạn' : 'Sửa hạn'}
              </button>
            )}
            {editDue?.id === s.id && (
              <span className="flex items-center gap-1">
                <input type="date" value={editDue.value} onChange={e => setEditDue(p => ({ ...p, value: e.target.value }))}
                  className="px-2 py-0.5 border border-blue-300 rounded-md text-xs bg-white" />
                <button onClick={() => saveDue(s)} className="text-xs px-2 py-1 rounded-md bg-blue-700 text-white">Lưu</button>
                <button onClick={() => setEditDue(null)} className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-600">Hủy</button>
              </span>
            )}
            {/* Sửa ngày (việc phát sinh) chỉ Quản trị. Sửa phí (Thời điểm) vẫn cho nhân viên, nhưng
                ngày nhận bị khoá — đổi ngày nhận là dời hạn hoàn thành. */}
            {(noFee ? isAdmin : canManage) && editSvc?.id !== s.id && (
              <button onClick={() => openEdit(s)}
                className="text-xs font-medium px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
                {noFee ? 'Sửa ngày' : 'Sửa phí'}
              </button>
            )}
            {s.totalCount > 0 && (
              <span className={'text-xs font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white ' + pctText(s.percent)}>
                {s.doneCount}/{s.totalCount} việc · {s.percent}%
              </span>
            )}
          </div>

          {/* Form sửa — mở ngay dưới đầu thẻ, không phải bật cửa sổ riêng. */}
          {editSvc?.id === s.id && (
            <div className="px-3 py-3 bg-sky-50 border-b border-sky-200">
              <div className="flex gap-2 flex-wrap items-end max-w-3xl">
                <div className={noFee ? 'hidden' : 'flex-1 min-w-[150px]'}>
                  <label className="text-xs text-slate-600 mb-1 block">
                    Chi phí (đ) <span className="text-sky-700 font-bold">— đã gồm VAT</span>
                  </label>
                  <input type="text" inputMode="numeric" autoFocus
                    value={editSvc.cost ? Number(String(editSvc.cost).replace(/\D/g, '') || 0).toLocaleString('vi-VN') : ''}
                    onChange={e => { setEditSvc(p => ({ ...p, cost: e.target.value.replace(/\D/g, '') })); if (svcErr) setSvcErr('') }}
                    className="w-full px-2 py-1.5 border border-sky-300 rounded-lg text-sm bg-white text-slate-800" />
                </div>
                <div className="min-w-[140px]">
                  <label className="text-xs text-slate-600 mb-1 block">
                    Ngày nhận{!isAdmin && <span className="text-slate-400"> · chỉ Quản trị sửa</span>}
                  </label>
                  <input type="date" value={editSvc.received_at || ''} disabled={!isAdmin}
                    onChange={e => setEditSvc(p => ({ ...p, received_at: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-sky-300 rounded-lg text-sm bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-500" />
                </div>
                <div className="min-w-[140px]">
                  <label className="text-xs text-slate-600 mb-1 block">Dự kiến trả</label>
                  <input type="date" value={editSvc.expected_at || ''}
                    onChange={e => setEditSvc(p => ({ ...p, expected_at: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-sky-300 rounded-lg text-sm bg-white text-slate-800" />
                </div>
                <div className="basis-full">
                  <label className="text-xs text-slate-600 mb-1 block">Ghi chú dịch vụ</label>
                  <input value={editSvc.note || ''} onChange={e => setEditSvc(p => ({ ...p, note: e.target.value }))}
                    placeholder="VD: điều chỉnh mức đóng cho NLĐ Nguyễn Văn A"
                    className="w-full px-2 py-1.5 border border-sky-300 rounded-lg text-sm bg-white text-slate-800" />
                </div>
                <button onClick={saveSvc} disabled={savingSvc}
                  className="px-4 py-1.5 bg-sky-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {savingSvc ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button onClick={() => { setEditSvc(null); setSvcErr('') }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-600 bg-white">Hủy</button>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {noFee ? 'Đổi ngày nhận thì hạn hoàn thành tự tính lại theo số ngày của dịch vụ.'
                  : 'Sửa phí không đụng tới checklist đã tích hay các khoản đã thu — chỉ đổi số phải thu của dịch vụ này. Đổi ngày nhận thì hạn tự tính lại.'}
              </p>
              {svcErr && <p className="text-xs text-red-700 mt-1">{svcErr}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Phần 1 — Công việc */}
            <div className="p-3 lg:col-span-3">
              <p className={colHeadCls}>Công việc</p>
              {s.tasks.length === 0 && <p className="text-xs text-slate-500">Mẫu dịch vụ này chưa khai báo công việc nào.</p>}
              {/* Ô tick bọc trong khối cao đúng bằng 1 dòng chữ (leading-5) nên luôn nằm giữa
                  dòng ĐẦU TIÊN, kể cả khi tên công việc dài phải xuống 2-3 dòng. */}
              <div className="space-y-1">
                {s.tasks.map(t => (
                  <label key={t.id} className="flex gap-2 text-xs leading-5 text-slate-800 cursor-pointer">
                    <span className="flex h-5 items-center flex-shrink-0">
                      <input type="checkbox" checked={t.done} disabled={!canManage}
                        onChange={e => toggleTask(t.id, e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#2E6B3A]" />
                    </span>
                    <span className="flex-1">
                      <span className={t.done ? 'line-through text-slate-500' : ''}>{t.name}</span>
                      {t.done && t.doneByName && (
                        <span className="text-slate-500"> — {t.doneByName}{t.done_at ? ' · ' + fmtDate(t.done_at) : ''}</span>
                      )}
                      {!t.stillActive && <span className="text-amber-700"> (đã bỏ khỏi mẫu)</span>}
                      {taskLate(s, t) && <span className="text-[#B3261E] font-medium"> · trễ hạn</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Phần 2 — Tiến độ hồ sơ */}
            <div className="p-3 lg:col-span-1">
              <p className={colHeadCls}>Tiến độ hồ sơ</p>
              <StatusSteps status={s.status} />
              {canManage && (
                <>
                  <p className="text-[11px] text-slate-500 mt-2 mb-1">Chuyển sang bước</p>
                  <select value={s.status} onChange={e => changeStatus(s.id, e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-800">
                    {HCNS_STATUSES.map(st => <option key={st} value={st}>{HCNS_STATUS_LABEL[st]}</option>)}
                  </select>
                </>
              )}
              {s.statusLog.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-600 cursor-pointer">Nhật ký trạng thái ({s.statusLog.length})</summary>
                  <div className="mt-1 space-y-0.5">
                    {s.statusLog.map(l => (
                      <p key={l.id} className="text-xs text-slate-500">
                        {l.statusLabel} · {l.changedByName || '—'} · {new Date(l.changed_at).toLocaleString('vi-VN')}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Phần 3 — Ghi chú nội bộ + xác nhận đã đọc */}
            <div className="p-3 lg:col-span-2 bg-slate-50/70">
              <CaseNotes notes={notes[s.id] || []} installed={notesOk}
                caseServiceId={s.id} onChanged={loadNotes} />
            </div>
          </div>
        </div>
      ))}

      {showAdd && (
        <AddServiceModal hcnsClient={hcnsClient} templates={templates}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); load(); onChanged && onChanged() }} />
      )}
    </div>
  )
}

const colHeadCls = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2'

/* ──────────────── Tiến độ hồ sơ — 5 bước xử lý ──────────────── */
// Thay cho badge trạng thái cũ (vốn lặp lại đúng nội dung ô chọn ngay bên cạnh): hiện cả 5 bước
// để nhân viên thấy hồ sơ đang ở đâu và còn mấy bước nữa, không phải bung ô chọn ra mới biết.
// Hạn hoàn thành CHỐT lúc thêm dịch vụ (ngày nhận + số ngày của mẫu, bỏ chủ nhật).
function DueBadge({ svc }) {
  const st = hcnsDueState(svc)
  if (st.kind === 'none') return null
  const due = fmtDate(svc.due_at)
  const [cls, txt] =
    st.kind === 'done_ok'   ? ['bg-emerald-50 text-[#2E6B3A] border-emerald-300', 'Xong đúng hạn · hạn ' + due]
  : st.kind === 'done_late' ? ['bg-amber-50 text-[#87590B] border-amber-300', 'Xong trễ ' + st.days + ' ngày · hạn ' + due]
  : st.kind === 'late'      ? ['bg-red-50 text-[#B3261E] border-red-300', 'Trễ hạn ' + st.daysLate + ' ngày · hạn ' + due]
  : st.daysLeft === 0       ? ['bg-amber-50 text-[#87590B] border-amber-300', 'Hạn hôm nay ' + due]
  :                           ['bg-blue-50 text-blue-800 border-blue-300', 'Hạn ' + due + ' · còn ' + st.daysLeft + ' ngày']
  return <span className={'text-xs font-semibold px-2 py-1 rounded-md border whitespace-nowrap ' + cls}>{txt}</span>
}

function StatusSteps({ status }) {
  const cur = HCNS_STATUSES.indexOf(status)
  return (
    <ol className="space-y-1">
      {HCNS_STATUSES.map((st, i) => {
        const done = i < cur, now = i === cur
        return (
          <li key={st} className="flex items-start gap-2 text-xs">
            <span className={'w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold border ' +
              (done ? 'bg-[#2E6B3A] text-white border-[#2E6B3A]'
                : now ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                : 'bg-white text-slate-400 border-slate-300')}>
              {done ? '✓' : i + 1}
            </span>
            {/* flex + truncate: nhãn "đang ở đây" luôn nằm cùng dòng với tên bước, tên bước dài
                thì bị cắt bớt chứ không đẩy nhãn xuống dòng. */}
            <span className="flex-1 min-w-0 leading-5 flex items-center gap-1.5">
              <span className={'truncate ' + (now ? 'font-semibold text-slate-900' : done ? 'text-slate-600' : 'text-slate-400')}>
                {HCNS_STATUS_LABEL[st]}
              </span>
              {now && <span className="text-[10px] font-semibold text-[#8B1A1A] whitespace-nowrap">← đang ở đây</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ──────────────── Ghi chú nội bộ trên hồ sơ + xác nhận đã đọc ──────────────── */
// Dặn dò giữa nhân viên, trưởng phòng và quản lý trước đây nằm ngoài hệ thống (Zalo, nói miệng)
// nên người tiếp nhận sau dễ làm sót. Ở đây mỗi lời nhắn có dấu "đã đọc" theo từng người, biết
// ngay ai đã nắm và ai chưa.
function CaseNotes({ notes, installed, caseServiceId, onChanged }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const post = async (body) => {
    setErr('')
    setBusy(true)
    const j = await fetch('/api/admin/hcns/case-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => ({ error: 'Không gửi được, thử lại.' }))
    setBusy(false)
    if (j.error) { setErr(j.error); return false }
    await onChanged()
    return true
  }

  const add = async () => {
    if (!text.trim()) { setErr('Nhập nội dung ghi chú trước khi lưu.'); return }
    if (await post({ caseServiceId, content: text.trim() })) setText('')
  }

  const remove = async (id) => {
    if (!window.confirm('Xoá ghi chú này?')) return
    setErr('')
    const j = await fetch('/api/admin/hcns/case-notes?id=' + id, { method: 'DELETE' })
      .then(r => r.json()).catch(() => ({ error: 'Không xoá được.' }))
    if (j.error) setErr(j.error)
    else onChanged()
  }

  const unread = notes.filter(n => !n.readByMe).length

  if (!installed) {
    return (
      <>
        <p className={colHeadCls}>Ghi chú nội bộ</p>
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1.5">
          Chưa bật tính năng này — cần chạy <b>sql/10_hcns_case_notes.sql</b> trong Supabase.
        </p>
      </>
    )
  }

  return (
    <>
      <p className={colHeadCls + ' flex items-center gap-2'}>
        <span>Ghi chú nội bộ</span>
        {unread > 0 && (
          <span className="normal-case tracking-normal text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#B3261E] text-white">
            {unread} chưa đọc
          </span>
        )}
      </p>

      {notes.length === 0 && (
        <p className="text-xs text-slate-500 mb-2">
          Chưa có ghi chú nào. Dặn dò gì cho người làm hồ sơ này thì ghi vào đây.
        </p>
      )}

      <div className="space-y-2 mb-2 max-h-64 overflow-y-auto">
        {notes.map(n => (
          <div key={n.id}
            className={'rounded-lg border px-2 py-1.5 ' +
              (n.readByMe ? 'bg-white border-slate-200' : 'bg-amber-50 border-amber-400')}>
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{n.content}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {n.createdByName || '—'} · {new Date(n.created_at).toLocaleString('vi-VN')}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {n.readByMe ? (
                <span className="text-[11px] font-medium text-[#2E6B3A]">✓ Bạn đã đọc</span>
              ) : (
                <button onClick={() => post({ noteId: n.id, read: true })} disabled={busy}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[#8B1A1A] text-white hover:bg-[#6B1212] disabled:opacity-60">
                  Xác nhận đã đọc
                </button>
              )}
              {n.readers.length > 0 && (
                <span className="text-[11px] text-slate-500" title={n.readers.map(r => r.name).join(', ')}>
                  · {n.readers.length} người đã đọc: {n.readers.map(r => r.name || '—').join(', ')}
                </span>
              )}
              {n.isMine && (
                <button onClick={() => remove(n.id)} className="text-[11px] text-red-700 hover:text-red-900 ml-auto">
                  Xoá
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {err && <p className="text-[11px] text-red-800 bg-red-100 border border-red-300 rounded-lg px-2 py-1 mb-1">{err}</p>}

      <textarea value={text} onChange={e => { setText(e.target.value); if (err) setErr('') }}
        rows={2} placeholder="Ghi chú cho hồ sơ này (nhân viên, trưởng phòng, quản lý cùng đọc)..."
        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30" />
      <button onClick={add} disabled={busy}
        className="mt-1 w-full px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-60">
        {busy ? 'Đang lưu...' : 'Lưu ghi chú'}
      </button>
    </>
  )
}

/* ──────────────── Công nợ hồ sơ Thời điểm / Vãng lai ──────────────── */
// Khách trả nhiều lần trong cùng tháng, mỗi lần có thể cho một dịch vụ khác nhau — nên đây là
// SỔ GHI NỐI TIẾP, không phải một dòng một kỳ như công nợ kế toán.
function CaseDebtPanel({ hcnsClient, debt, canManage, onChanged }) {
  const [amount, setAmount] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [note, setNote] = useState('')
  // Ngày khách trả THẬT — báo cáo Tồn đầu kỳ / Đã thu trong kỳ tính theo ngày này (sql/20).
  const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const [paidAt, setPaidAt] = useState(todayVN)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  if (!debt) {
    return (
      <div className="bg-white border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-700">
          Chưa cài phần công nợ hồ sơ — cần chạy <b>sql/07_hcns_case_payments.sql</b> trong Supabase.
        </p>
      </div>
    )
  }

  const t = debt.totals
  const save = async () => {
    setErr('')
    const amt = Number(String(amount).replace(/\D/g, ''))
    if (!amt) { setErr('Nhập số tiền đã thu.'); return }
    setSaving(true)
    const res = await fetch('/api/admin/hcns/case-payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hcnsClientId: hcnsClient.id, caseServiceId: serviceId || null, amount: amt, note: note || null, paid_at: paidAt || null }),
    })
    const j = await res.json()
    setSaving(false)
    if (j.error) { setErr(j.error); return }
    setAmount(''); setNote(''); setPaidAt(todayVN)
    onChanged()
  }

  // Sửa ngày thu của khoản đã ghi (ghi muộn / chọn nhầm ngày).
  const editPaidAt = async (p) => {
    const cur = p.paid_at ? String(p.paid_at).slice(0, 10) : ''
    const txt = window.prompt('Ngày khách trả thật (dd/mm/yyyy):', cur ? cur.split('-').reverse().join('/') : '')
    if (txt === null) return
    const m = txt.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) { setErr('Ngày phải có dạng dd/mm/yyyy.'); return }
    const iso = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')
    const res = await fetch('/api/admin/hcns/case-payments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, paid_at: iso }),
    })
    const j = await res.json()
    if (j.error) setErr(j.error)
    else onChanged()
  }

  const removePayment = async (p) => {
    if (!window.confirm('Xoá khoản thu ' + fmt(p.amount) + 'đ ngày ' + fmtDate(p.created_at) + '?')) return
    const res = await fetch('/api/admin/hcns/case-payments?id=' + p.id, { method: 'DELETE' })
    const j = await res.json()
    if (j.error) setErr(j.error)
    else onChanged()
  }

  return (
    <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold text-emerald-800 flex-1">💰 Công nợ hồ sơ</p>
        <span className="text-xs text-slate-700">
          Tổng chi phí <b>{fmt(t.totalCost)}đ</b> · Đã thu <b className="text-[#2E6B3A]">{fmt(t.totalPaid)}đ</b>
          {' · '}
          <b className={t.remain === 0 ? 'text-[#2E6B3A]' : 'text-[#B3261E]'}>
            {t.remain === 0 ? 'Đã thu đủ' : 'Còn ' + fmt(t.remain) + 'đ'}
          </b>
        </span>
      </div>

      <div className="p-3 space-y-3">
        {debt.perService.length > 0 && (
          <div className="space-y-1">
            {debt.perService.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="text-slate-700 flex-1 truncate">{s.name}</span>
                <span className="text-slate-500 tabular-nums">
                  {s.paidShared > 0
                    ? (s.paidDirect > 0 ? fmt(s.paidDirect) + ' + ' : '') + fmt(s.paidShared) + ' thu chung'
                    : fmt(s.paid)} / {fmt(s.cost)}đ
                </span>
                <span className={'w-24 text-right tabular-nums font-medium ' +
                  (s.remain === 0 ? 'text-[#2E6B3A]' : 'text-[#B3261E]')}>
                  {s.remain === 0 ? 'đủ' : 'còn ' + fmt(s.remain) + 'đ'}
                </span>
              </div>
            ))}
            {t.unassigned > 0 && (
              <p className="text-xs text-slate-500 pt-1">
                Trong đó {fmt(t.unassigned)}đ thu chung cho cả hồ sơ — tự trừ lần lượt vào các dịch vụ, dịch vụ nhận trước trừ trước.
              </p>
            )}
          </div>
        )}

        {canManage && (
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Thu cho</label>
                <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={inputCls}>
                  <option value="">Thu chung cho cả hồ sơ</option>
                  {debt.perService.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (còn {fmt(s.remain)}đ)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Số tiền đã thu (đ)</label>
                <input type="text" inputMode="numeric"
                  value={amount ? Number(String(amount).replace(/\D/g, '') || 0).toLocaleString('vi-VN') : ''}
                  onChange={e => { setAmount(e.target.value.replace(/\D/g, '')); if (err) setErr('') }}
                  placeholder={'Còn phải thu ' + fmt(t.remain) + 'đ'} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Ngày thu <span className="text-slate-400">(ngày khách trả)</span></label>
                <input type="date" value={paidAt} max={todayVN} onChange={e => setPaidAt(e.target.value)} className={inputCls} />
              </div>
            </div>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Ghi chú: ngày chuyển khoản, số UNC, thu tiền mặt..." className={inputCls} />
            {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{err}</p>}
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Đang lưu...' : '✓ Ghi nhận khoản thu'}
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 pt-2">
          <p className="text-xs text-slate-600 mb-1">Nhật ký thu ({debt.data.length})</p>
          {debt.data.length === 0 && <p className="text-xs text-slate-500">Chưa có khoản thu nào.</p>}
          {debt.data.map(p => (
            <div key={p.id} className="flex items-start gap-2 text-xs py-1 border-b border-slate-200 last:border-0">
              <span className="text-[#2E6B3A] font-semibold tabular-nums w-24 flex-shrink-0">{fmt(p.amount)}đ</span>
              <span className="flex-1 min-w-0">
                <span className="text-slate-800">{p.serviceName || 'Thu chung cả hồ sơ'}</span>
                {p.note && <span className="text-slate-500"> — {p.note}</span>}
                <span className="block text-slate-500">
                  <b className="text-slate-700 font-medium">Ngày thu {fmtDate(p.paid_at || p.created_at)}</b>
                  {canManage && (
                    <button onClick={() => editPaidAt(p)} className="ml-1 text-blue-600 hover:underline">sửa ngày</button>
                  )}
                  {' · ghi bởi '}{p.createdByName || '—'} · {new Date(p.created_at).toLocaleString('vi-VN')}
                </span>
              </span>
              {canManage && (
                <button onClick={() => removePayment(p)} className="text-red-300 hover:text-red-600 flex-shrink-0">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ──────────────── ĐNTT hồ sơ Thời điểm / Vãng lai ──────────────── */
// Dùng CHÍNH mẫu phiếu của phòng nghiệp vụ (app/api/admin/dntt) — mỗi dịch vụ là một dòng B,
// bỏ bớt dòng được để thu riêng từng loại dịch vụ.
function CaseDnttPanel({ hcnsClient, services }) {
  const now = new Date()
  // Chi phí lưu là số ĐÃ gồm VAT (cùng quy ước phí kế toán) -> tách 1.08 để dòng B là số chưa VAT.
  const [rows, setRows] = useState(() => services.map(s => ({
    key: s.id, desc: s.templateName, amount: String(Math.round((Number(s.cost) || 0) / 1.08)), on: true,
  })))
  const [qr, setQr] = useState(
    (hcnsClient.case_code || hcnsClient.client_code || '') +
    '_Phidichvu_T' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear())

  const active = rows.filter(r => r.on)
  const subTotal = active.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const vat = Math.round(subTotal * 0.08)
  const total = subTotal + vat

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  const openPdf = () => {
    if (!active.length) return
    const [first, ...rest] = active
    const url = '/api/admin/dntt?hcnsClientId=' + hcnsClient.id +
      '&month=' + (now.getMonth() + 1) + '&year=' + now.getFullYear() +
      '&b1Label=' + encodeURIComponent(first.desc) +
      '&b1Amount=' + encodeURIComponent(Number(first.amount) || 0) +
      '&qrContent=' + encodeURIComponent(qr) +
      '&extra=' + encodeURIComponent(JSON.stringify(rest.map(r => ({ desc: r.desc, amount: Number(r.amount) || 0 }))))
    window.open(url, '_blank')
  }

  return (
    <div className="bg-white border border-indigo-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <p className="text-xs font-bold text-indigo-800 flex-1">
          📄 Phiếu Đề Nghị Thanh Toán — T{now.getMonth() + 1}/{now.getFullYear()}
        </p>
        <button onClick={openPdf} disabled={!active.length}
          className="text-xs px-3 py-1.5 bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-40">
          Mở PDF
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs text-slate-500 mb-2">
          Bỏ tick dòng nào thì dòng đó không lên phiếu — dùng khi muốn thu riêng từng dịch vụ.
          Số tiền hiển thị là <b>chưa VAT</b> (chi phí đã tách 1,08).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[420px]">
            <thead>
              <tr className="bg-indigo-900 text-white">
                <th className="px-2 py-1 w-10">Mã</th>
                <th className="px-2 py-1 text-left">Diễn giải</th>
                <th className="px-2 py-1 w-28 text-right">Số tiền (đ)</th>
                <th className="px-2 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const no = r.on ? active.findIndex(a => a.key === r.key) + 1 : null
                return (
                  <tr key={r.key} className={r.on ? 'bg-indigo-50/40' : 'opacity-40'}>
                    <td className="border border-slate-300 px-2 py-1 text-center text-slate-600">{no ? 'B' + no : '—'}</td>
                    <td className="border border-slate-300 px-1 py-1">
                      <input value={r.desc} onChange={e => setRow(i, { desc: e.target.value })} disabled={!r.on}
                        className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs" />
                    </td>
                    <td className="border border-slate-300 px-1 py-1">
                      <input type="text" inputMode="numeric" disabled={!r.on}
                        value={r.amount ? Number(r.amount).toLocaleString('vi-VN') : ''}
                        onChange={e => setRow(i, { amount: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs text-right" />
                    </td>
                    <td className="border border-slate-300 px-1 py-1 text-center">
                      <input type="checkbox" checked={r.on} onChange={e => setRow(i, { on: e.target.checked })}
                        title="Đưa dòng này lên phiếu" className="w-3.5 h-3.5 accent-indigo-600" />
                    </td>
                  </tr>
                )
              })}
              <tr><td className="border border-slate-300 px-2 py-1 text-center text-slate-500">VAT</td>
                <td className="border border-slate-300 px-2 py-1 text-slate-600 italic">Thuế VAT 8%</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-slate-600">{fmt(vat)}</td>
                <td className="border border-slate-300"></td></tr>
              <tr className="bg-red-50"><td className="border border-slate-300 px-2 py-1 text-center font-bold">C</td>
                <td className="border border-slate-300 px-2 py-1 font-bold">Tổng đề nghị thanh toán</td>
                <td className="border border-slate-300 px-2 py-1 text-right font-bold text-red-600">{fmt(total)}</td>
                <td className="border border-slate-300"></td></tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-slate-500 flex-shrink-0">QR:</label>
          <input value={qr} onChange={e => setQr(e.target.value)}
            className="flex-1 px-2 py-1 border border-indigo-200 rounded text-xs text-indigo-800 font-mono" />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────── Modal ─────────────────────────────── */
function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30'
const labelCls = 'text-xs text-slate-600 mb-1 block'

// Chọn nhanh 1 công ty trong "Danh sách công ty" để tự điền form — đỡ gõ lại tên/MST/địa chỉ.
// Tải danh sách 1 lần khi mở form, lọc không dấu ở trình duyệt.
function PickExistingClient({ onPick }) {
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(null)
  useEffect(() => {
    fetch('/api/admin/hcns/client-lookup').then(r => r.json()).then(j => setAll(j.data || [])).catch(() => setAll([]))
  }, [])
  const nq = noAccent(q.trim())
  const hits = !nq || !all ? [] : all.filter(c =>
    noAccent(c.name).includes(nq) || noAccent(c.tax_code).includes(nq) || noAccent(c.client_code).includes(nq)).slice(0, 8)
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5">
      <label className={labelCls}>Chọn từ Danh sách công ty <span className="text-slate-400">(tên, MST hoặc mã KH)</span></label>
      <input value={q} onChange={e => { setQ(e.target.value); setPicked(null) }} className={inputCls}
        placeholder={all === null ? 'Đang tải danh sách...' : 'Gõ để tìm công ty có sẵn'} />
      {picked && <p className="text-xs text-[#2E6B3A] mt-1">✓ Đã điền theo {picked.name}</p>}
      {!picked && hits.length > 0 && (
        <div className="mt-1 bg-white border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
          {hits.map(c => (
            <button key={c.id} type="button" onClick={() => { onPick(c); setPicked(c); setQ(c.name) }}
              className="w-full text-left px-2.5 py-1.5 border-t first:border-t-0 border-slate-100 hover:bg-sky-50">
              <span className="block text-xs text-slate-900">{c.name}</span>
              <span className="text-[11px] text-slate-500">{[c.tax_code, c.client_code].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      {!picked && nq && all && hits.length === 0 && (
        <p className="text-xs text-slate-500 mt-1">Không có trong danh sách — tra cứu MST hoặc nhập tay bên dưới.</p>
      )}
    </div>
  )
}

// initial có giá trị = chế độ SỬA hồ sơ đã có (Quản trị sửa hồ sơ nhân viên nhập nhầm).
function AddCaseModal({ category, staffList, initial, onClose, onDone }) {
  const editing = !!initial?.id
  const [f, setF] = useState(() => {
    const blank = { category, case_code: '', name: '', tax_code: '', address: '', representative: '', phone: '', assigned_to: '', note: '' }
    if (!editing) return blank
    const out = { ...blank }
    for (const k of Object.keys(blank)) out[k] = initial[k] ?? ''
    return out
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [lookup, setLookup] = useState(false)

  const doLookup = async () => {
    if (!f.tax_code) return
    setLookup(true); setErr('')
    try {
      const res = await fetch('/api/lookup-tax?mst=' + f.tax_code.trim())
      const j = await res.json()
      if (j.error) setErr(j.error)
      else setF(p => ({ ...p, name: j.name || p.name, address: j.address || p.address, representative: j.representative || p.representative }))
    } catch (_) { setErr('Không tra cứu được, vui lòng nhập tay') }
    setLookup(false)
  }

  const submit = async () => {
    setErr('')
    if (!f.case_code) return setErr('Vui lòng nhập Mã hồ sơ')
    if (!f.name) return setErr('Vui lòng nhập tên công ty / khách hàng')
    if (!f.assigned_to) return setErr('Vui lòng chọn nhân viên phụ trách')
    setSaving(true)
    const res = await fetch('/api/admin/hcns/clients', {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...f, id: initial.id } : f),
    })
    const j = await res.json()
    setSaving(false)
    if (j.error) return setErr(j.error)
    onDone()
  }

  return (
    <Modal title={editing ? 'Sửa thông tin hồ sơ' : 'Thêm công ty'}
      subtitle={editing ? (initial.case_code || initial.name) : 'Phòng HCNS · loại ' + CAT_LABEL[category]} onClose={onClose}>
      <div className="p-4 space-y-3">
        {!editing && <PickExistingClient onPick={c => setF(p => ({ ...p,
          name: c.name || p.name, tax_code: c.tax_code || p.tax_code,
          address: c.address || p.address, representative: c.representative || p.representative,
        }))} />}
        <div>
          <label className={labelCls}>Mã số thuế</label>
          <div className="flex gap-2">
            <input value={f.tax_code} onChange={e => setF(p => ({ ...p, tax_code: e.target.value }))}
              className={inputCls} placeholder="Nhập MST rồi bấm Tra cứu" />
            <button onClick={doLookup} disabled={!f.tax_code || lookup}
              className="px-3 py-2 bg-[#185FA5] text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-40">
              {lookup ? '...' : 'Tra cứu'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Tra cứu tự điền tên, địa chỉ, người đại diện. Khách cá nhân không có MST thì nhập tay.</p>
        </div>
        <div>
          <label className={labelCls}>Mã hồ sơ <span className="text-red-500">*</span></label>
          <input value={f.case_code} onChange={e => setF(p => ({ ...p, case_code: e.target.value }))}
            className={inputCls} placeholder="VD: HS2608-012" />
        </div>
        <div>
          <label className={labelCls}>Tên công ty / khách hàng <span className="text-red-500">*</span></label>
          <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Địa chỉ</label>
          <input value={f.address} onChange={e => setF(p => ({ ...p, address: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Người đại diện pháp luật</label>
          <input value={f.representative} onChange={e => setF(p => ({ ...p, representative: e.target.value }))} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Số điện thoại</label>
            <input value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Loại khách <span className="text-red-500">*</span></label>
            {/* Đã ẩn Vãng lai — chỉ còn hiện lựa chọn này nếu hồ sơ đang sửa vốn là Vãng lai. */}
            <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} className={inputCls}>
              <option value="thoi_diem">Thời điểm</option>
              {f.category === 'vang_lai' && <option value="vang_lai">Vãng lai</option>}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Nhân viên phụ trách <span className="text-red-500">*</span></label>
          <select value={f.assigned_to} onChange={e => setF(p => ({ ...p, assigned_to: e.target.value }))} className={inputCls}>
            <option value="">-- Chọn nhân viên --</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ghi chú</label>
          <input value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} className={inputCls} />
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
      <div className="px-4 py-3 border-t border-slate-200 flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700">Hủy</button>
        <button onClick={submit} disabled={saving}
          className="px-4 py-2 text-sm bg-[#8B1A1A] text-white rounded-lg font-medium disabled:opacity-50">
          {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm công ty'}
        </button>
      </div>
    </Modal>
  )
}

// Bước 1 của "+ Việc phát sinh": chọn công ty Thời kỳ, rồi mở form thêm việc (không phí).
function AddPhatSinhModal({ companies, templates, onClose, onDone }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(null)
  if (picked) return <AddServiceModal hcnsClient={picked} templates={templates} onClose={onClose} onDone={onDone} />
  const nq = noAccent(q.trim())
  const hits = companies.filter(c => !nq || noAccent(c.name).includes(nq) ||
    noAccent(c.client_code).includes(nq) || noAccent(c.linkedClient?.tax_code).includes(nq)).slice(0, 30)
  return (
    <Modal title="Thêm việc phát sinh" subtitle="Bước 1 · chọn công ty Thời kỳ" onClose={onClose}>
      <div className="p-4 space-y-2">
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} className={inputCls}
          placeholder="Tìm tên công ty, mã KH hoặc MST" />
        <div className="border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
          {hits.length === 0 && <p className="px-3 py-3 text-xs text-slate-500">Không có công ty Thời kỳ nào khớp.</p>}
          {hits.map(c => (
            <button key={c.id} type="button" onClick={() => setPicked(c)}
              className="w-full text-left px-3 py-2 border-t first:border-t-0 border-slate-100 hover:bg-violet-50">
              <span className="block text-sm text-slate-900">{c.name}</span>
              <span className="text-[11px] text-slate-500">
                {[c.client_code, c.linkedClient?.tax_code, c.staff?.full_name || 'Chưa phân công'].filter(Boolean).join(' · ')}
                {c.serviceCount > 0 && ' · đang có ' + c.serviceCount + ' việc phát sinh'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function AddServiceModal({ hcnsClient, templates, onClose, onDone }) {
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ templateId: '', cost: '', received_at: today, expected_at: '', status: 'thu_thap', note: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const tpl = templates.find(t => t.id === f.templateId)
  // Công ty Thời kỳ: việc phát sinh, không thu phí riêng.
  const noFee = hcnsClient.category === 'thoi_ky'
  const duePreview = tpl ? hcnsDueDate(f.received_at, tpl.sla_days) : null

  const submit = async () => {
    setErr('')
    if (!f.templateId) return setErr('Vui lòng chọn loại dịch vụ')
    if (!noFee && !f.cost) return setErr('Vui lòng nhập chi phí')
    if (!f.received_at) return setErr('Vui lòng chọn thời gian nhận')
    setSaving(true)
    const res = await fetch('/api/admin/hcns/case-services', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, hcnsClientId: hcnsClient.id, cost: noFee ? 0 : Number(f.cost) }),
    })
    const j = await res.json()
    setSaving(false)
    if (j.error) return setErr(j.error)
    onDone()
  }

  return (
    <Modal title={noFee ? 'Thêm việc phát sinh' : 'Thêm dịch vụ'}
      subtitle={(hcnsClient.case_code || hcnsClient.client_code || 'Thời kỳ') + ' · ' + hcnsClient.name} onClose={onClose}>
      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Loại dịch vụ triển khai <span className="text-red-500">*</span></label>
          {/* Gom theo nhóm nghiệp vụ — 24 dịch vụ trong một danh sách phẳng rất khó tìm. */}
          <select value={f.templateId} onChange={e => setF(p => ({ ...p, templateId: e.target.value }))} className={inputCls}>
            <option value="">-- Chọn dịch vụ --</option>
            {/* Mục cuối là "vét" — MỌI nhóm khác BHXH/HCNS đều rơi vào đây (gồm cả nhóm Cá nhân
                dùng để sắp xếp bên trang Checklist). Nếu lọc đúng bằng null như trước thì dịch vụ
                thuộc nhóm mới sẽ KHÔNG hiện ra ở đây, tạo xong không dùng được mà không báo gì. */}
            {[['BHXH', 'Bảo hiểm xã hội'], ['HCNS', 'Hành chính nhân sự'], [null, 'Khác']].map(([k, lbl]) => {
              const list = templates.filter(t => k
                ? t.group_name === k
                : !['BHXH', 'HCNS'].includes(t.group_name))
              if (!list.length) return null
              return (
                <optgroup key={lbl} label={lbl}>
                  {list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              )
            })}
          </select>
          {templates.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">Chưa khai báo dịch vụ nào — vào trang Checklist HCNS để thêm trước.</p>
          )}
        </div>
        {noFee ? (
          <p className="text-xs text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
            Công ty Thời kỳ — việc phát sinh <b>không thu phí riêng</b> (đã nằm trong phí HCNS hằng tháng), không có ĐNTT/công nợ.
          </p>
        ) : (
        <div>
          <label className={labelCls}>Chi phí (đ) <span className="text-red-500">*</span> <span className="text-blue-600 font-semibold">— đã bao gồm VAT</span></label>
          <input type="text" inputMode="numeric"
            value={f.cost ? Number(f.cost).toLocaleString('vi-VN') : ''}
            onChange={e => setF(p => ({ ...p, cost: e.target.value.replace(/\D/g, '') }))}
            className={inputCls} placeholder="VD: 4.500.000" />
        </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Thời gian nhận <span className="text-red-500">*</span></label>
            <input type="date" value={f.received_at} onChange={e => setF(p => ({ ...p, received_at: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dự kiến trả kết quả</label>
            <input type="date" value={f.expected_at} onChange={e => setF(p => ({ ...p, expected_at: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Trạng thái</label>
          <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} className={inputCls}>
            {HCNS_STATUSES.map(st => <option key={st} value={st}>{HCNS_STATUS_LABEL[st]}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">{HCNS_STATUSES.map(st => HCNS_STATUS_LABEL[st]).join(' → ')}</p>
        </div>
        <div>
          <label className={labelCls}>Ghi chú</label>
          <input value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} className={inputCls} />
        </div>
        {tpl && (
          <p className={'text-xs rounded-lg px-3 py-2 border ' + (duePreview
            ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-amber-50 border-amber-300 text-amber-900')}>
            {duePreview
              ? <>Hạn hoàn thành: <b>{fmtDate(duePreview)}</b> ({tpl.sla_days} ngày kể từ ngày nhận, bỏ chủ nhật) — chốt khi lưu.</>
              : 'Dịch vụ này chưa khai "Hạn xử lý" ở trang Checklist HCNS — hồ sơ sẽ không có hạn.'}
          </p>
        )}
        {tpl?.note && (
          <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">⏱ {tpl.note}</p>
        )}
        {tpl && (
          <div className="bg-sky-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-sky-800 mb-1">Checklist tự gắn theo mẫu ({tpl.tasks.length} việc)</p>
            {tpl.tasks.length === 0
              ? <p className="text-xs text-sky-700">Mẫu này chưa có công việc nào.</p>
              : tpl.tasks.map(t => <p key={t.id} className="text-xs text-sky-700">☐ {t.name}</p>)}
          </div>
        )}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
      <div className="px-4 py-3 border-t border-slate-200 flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700">Hủy</button>
        <button onClick={submit} disabled={saving}
          className="px-4 py-2 text-sm bg-[#8B1A1A] text-white rounded-lg font-medium disabled:opacity-50">
          {saving ? 'Đang lưu...' : noFee ? 'Thêm việc' : 'Thêm dịch vụ'}
        </button>
      </div>
    </Modal>
  )
}
