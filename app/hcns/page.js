'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { loadPermissionData, can } from '@/lib/permissions'
import AppShell from '@/components/AppShell'
import ClientChecklist from '@/components/ClientChecklist'
import { HCNS_STATUSES, HCNS_STATUS_LABEL } from '@/lib/hcnsStatus'

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
  const [showAdd, setShowAdd] = useState(false)

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
      await Promise.all([loadClients(), loadReport(), loadStaff(), loadTemplates()])
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => { if (allowed) loadReport() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selYear, selMonth, mode, allowed])

  const loadClients = async () => {
    const res = await fetch('/api/admin/hcns/clients')
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

  const byCat = (c) => c === 'all' ? clients : clients.filter(x => x.category === c)
  const q = noAccent(search)
  const filtered = (list) => !q ? list : list.filter(c =>
    noAccent(c.name).includes(q) || noAccent(c.tax_code).includes(q) ||
    noAccent(c.client_code).includes(q) || noAccent(c.case_code).includes(q))

  const counts = {
    all: clients.length,
    thoi_ky: byCat('thoi_ky').length,
    thoi_diem: byCat('thoi_diem').length,
    vang_lai: byCat('vang_lai').length,
  }
  const TABS = [
    { key: 'report',    label: 'Báo cáo phòng HCNS' },
    { key: 'all',       label: 'Tất cả',    count: counts.all },
    { key: 'thoi_ky',   label: 'Thời kỳ',   count: counts.thoi_ky },
    { key: 'thoi_diem', label: 'Thời điểm', count: counts.thoi_diem },
    { key: 'vang_lai',  label: 'Vãng lai',  count: counts.vang_lai },
  ]

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">Công ty phụ trách</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Phòng HCNS · {clients.length} công ty
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
            {canManage && (tab === 'thoi_diem' || tab === 'vang_lai') && (
              <button onClick={() => setShowAdd(true)}
                className="px-3 py-1.5 bg-[#8B1A1A] text-white rounded-lg text-sm font-medium hover:bg-[#6B1212]">
                + Thêm công ty
              </button>
            )}
          </div>
        )}

        {tab === 'report' && <ReportBlock report={report} mode={mode} setMode={setMode}
          selYear={selYear} selMonth={selMonth} setSelYear={setSelYear} setSelMonth={setSelMonth} monthOpts={monthOpts} />}

        {tab !== 'report' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {filtered(byCat(tab)).length === 0 && (
              <p className="text-sm text-slate-500 px-4 py-8 text-center">
                {search ? 'Không tìm thấy công ty nào khớp.' : 'Chưa có công ty nào ở mục này.'}
              </p>
            )}
            {filtered(byCat(tab)).map((c, ri) => (
              <ClientRow key={c.id} c={c} ri={ri} showCat={tab === 'all'} report={report}
                expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                clientMonth={clientMonth} setClientMonth={setClientMonth}
                selMonth={selMonth} canManage={canManage}
                canAssign={canAssign} staffList={staffList}
                templates={templates} onChanged={() => { loadClients(); loadReport() }} />
            ))}
          </div>
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
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-900">Thời kỳ</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tk.clientCount} công ty</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-600">KPI Công nợ — trung bình theo nhân viên</p>
            <p className={'text-2xl font-bold mt-0.5 ' + pctText(tk.debtPercent)}>
              {tk.debtPercent === null ? '—' : tk.debtPercent + '%'}
            </p>
            <div className="mt-1.5"><Meter value={tk.debtPercent ?? 0} /></div>
            <p className="text-xs text-slate-500 mt-1.5">Đã thu {fmt(tk.totalCollected)}đ / {fmt(tk.totalFee)}đ</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-600">KPI % Công việc — trung bình theo nhân viên</p>
            <p className={'text-2xl font-bold mt-0.5 ' + pctText(tk.taskPercent)}>
              {tk.taskPercent === null ? '—' : tk.taskPercent + '%'}
            </p>
            <div className="mt-1.5"><Meter value={tk.taskPercent ?? 0} /></div>
            <p className="text-xs text-slate-500 mt-1.5">Checklist DV HCNS Thời Kỳ</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-2">
          KPI phòng là <b>trung bình cộng % của từng nhân viên</b>, không phải tổng thu chia tổng phí — hai số này khác nhau.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase tracking-wide">
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
                  <td className="py-2 px-2 text-slate-800">{s.staffName}</td>
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

      {/* Hai khối case chia đôi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CaseBlock title="Thời điểm" data={report.thoiDiem} />
        <CaseBlock title="Vãng lai"  data={report.vangLai} />
      </div>
    </div>
  )
}

function CaseBlock({ title, data }) {
  const max = Math.max(1, ...data.byStatus.map(s => s.count))
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{data.caseCount} hồ sơ</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[['Hồ sơ', data.caseCount], ['Dịch vụ', data.serviceCount], ['Chi phí', fmt(data.totalCost) + 'đ']].map(([k, v]) => (
          <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-sm font-bold text-slate-800 tabular-nums">{v}</p>
          </div>
        ))}
        {/* Nhân viên tích việc trên hồ sơ thì con số này phải nhúc nhích — trước đây báo cáo chỉ
            tính checklist định kỳ của Thời kỳ nên tích xong không thấy gì đổi. */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
          <p className="text-xs text-slate-500">% Công việc</p>
          <p className={'text-sm font-bold tabular-nums ' + pctText(data.taskPercent)}>
            {data.taskPercent === null ? '—' : data.taskPercent + '%'}
          </p>
          {data.taskTotal > 0 && (
            <p className="text-[11px] text-slate-500 tabular-nums">{data.taskDone}/{data.taskTotal} việc</p>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-600 mb-1.5">Dịch vụ theo bước xử lý</p>
      {data.byStatus.map(s => (
        <div key={s.status} className="flex items-center gap-2 mb-1">
          <span className="text-xs text-slate-700 w-28 flex-shrink-0">{s.label}</span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#1E4E8C] rounded-full" style={{ width: (s.count / max * 100) + '%' }} />
          </div>
          <span className="text-xs tabular-nums w-4 text-right text-slate-800">{s.count}</span>
        </div>
      ))}
      {data.byStaff.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-200">
          {data.byStaff.map(s => (
            <div key={s.staffId} className="flex justify-between gap-2 text-xs text-slate-600 py-1">
              <span className="truncate">{s.staffName || '(chưa gán)'}</span>
              <span className="tabular-nums flex-shrink-0">
                {s.cases} hồ sơ · {s.services} dịch vụ
                {s.taskPercent !== null && (
                  <span className={'ml-1.5 font-semibold ' + pctText(s.taskPercent)}>{s.taskPercent}%</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Một dòng công ty ─────────────────────────── */
function ClientRow({ c, ri, showCat, report, expanded, onToggle, clientMonth, setClientMonth, selMonth, canManage, canAssign, staffList, templates, onChanged }) {
  const stat = report?.thoiKy?.perClient?.find(p => p.id === c.id)
  const isThoiKy = c.category === 'thoi_ky'
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
          (expanded ? 'bg-[#8B1A1A]/[0.06]' : (ri % 2 ? 'bg-slate-50' : 'bg-white') + ' hover:bg-[#8B1A1A]/[0.04]')}>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
            {c.name}
            {showCat && <span className={'text-[11px] font-medium px-2 py-0.5 rounded-full ' + CAT_STYLE[c.category]}>{CAT_LABEL[c.category]}</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {[c.case_code || c.client_code, c.tax_code,
              isThoiKy ? fmt(c.hcns_fee) + 'đ/' + (c.fee_period === 'quarterly' ? 'Quý' : 'Tháng') : null,
              c.staff?.full_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        {isThoiKy && stat && (
          <>
            <DebtBadge stat={stat} />
            {stat.taskPercent !== null && (
              <span className={'text-xs font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white flex-shrink-0 ' + pctText(stat.taskPercent)}>
                {stat.taskDone}/{stat.taskTotal} việc · {stat.taskPercent}%
              </span>
            )}
          </>
        )}
        {/* Phân công nhân viên phụ trách — KPI và công nợ của công ty này sẽ tính cho người được
            chọn. Bấm vào select không được mở/đóng dòng nên chặn sự kiện lan lên nút cha. */}
        {canAssign ? (
          <span onClick={e => { e.stopPropagation() }} className="flex-shrink-0">
            <select value={c.assigned_to || ''} disabled={assigning}
              onChange={e => assign(e.target.value)}
              className={'text-xs border rounded-lg px-2 py-1 bg-white max-w-[150px] ' +
                (c.assigned_to ? 'border-slate-300 text-slate-800' : 'border-amber-400 bg-amber-50 text-amber-900')}>
              <option value="">⚠ Chưa phân công</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </span>
        ) : !c.assigned_to && (
          <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-400 flex-shrink-0">Chưa phân công</span>
        )}
        <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="bg-slate-50 border-t border-slate-200">
          {isThoiKy && c.linkedClient ? (
            <ClientChecklist
              client={{ ...c.linkedClient, uses_hcns: true }}
              hcnsClient={c}
              context="hcns"
              defaultPanel="debt"
              clientMonth={clientMonth[c.id] || selMonth}
              onMonthChange={m => setClientMonth(p => ({ ...p, [c.id]: m }))}
              onDebtSaved={onChanged}
            />
          ) : isThoiKy ? (
            <p className="text-xs text-slate-500 px-4 py-4">
              Chưa tìm thấy công ty kế toán gốc — có thể công ty đã bị xoá bên Danh sách công ty.
            </p>
          ) : (
            <CaseServices hcnsClient={c} canManage={canManage} templates={templates} onChanged={onChanged} />
          )}
        </div>
      )}
    </div>
  )
}

// Đỏ "Chưa thu" / vàng "Thu thiếu ..." / xanh "Đã thu" — kế toán cập nhật xong là phòng HCNS
// thấy đổi màu ngay, không cần báo tay.
function DebtBadge({ stat }) {
  // Viền cùng tông chữ — badge nền nhạt trơn bị chìm khi dòng có nền sọc xám.
  const cls = 'text-xs font-semibold px-2 py-1 rounded-md border flex-shrink-0 '
  if (!stat.dueFee) return <span className={cls + 'bg-slate-100 text-slate-600 border-slate-300'}>Chưa tới kỳ</span>
  if (stat.remain === 0) return <span className={cls + 'bg-[#EBF3EB] text-[#2E6B3A] border-[#2E6B3A]/40'}>Đã thu</span>
  if (stat.collected > 0) return <span className={cls + 'bg-[#FAF1DC] text-[#87590B] border-[#D89614]'}>Thu thiếu {fmt(stat.remain)}đ</span>
  return <span className={cls + 'bg-[#FAEBEA] text-[#B3261E] border-[#B3261E]/40'}>Chưa thu</span>
}

/* ──────────────── Dịch vụ trong hồ sơ Thời điểm / Vãng lai ──────────────── */
function CaseServices({ hcnsClient, canManage, templates, onChanged }) {
  const [services, setServices] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [panel, setPanel] = useState(null)   // null | 'debt' | 'dntt'
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
  const changeStatus = async (id, status) => {
    await fetch('/api/admin/hcns/case-services', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load(); onChanged && onChanged()
  }

  if (services === null) return <p className="text-xs text-slate-500 px-4 py-4">Đang tải dịch vụ...</p>

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-slate-600 flex-1 min-w-[160px]">
          {hcnsClient.phone && <span>SĐT: {hcnsClient.phone} · </span>}
          {hcnsClient.representative && <span>Đại diện: {hcnsClient.representative} · </span>}
          {services.length} dịch vụ
          {debt?.totals && (
            <span className={'ml-1 font-semibold ' +
              (debt.totals.remain === 0 ? 'text-[#2E6B3A]' : debt.totals.totalPaid > 0 ? 'text-[#87590B]' : 'text-[#B3261E]')}>
              · {debt.totals.remain === 0 ? 'Đã thu đủ' : 'Còn phải thu ' + fmt(debt.totals.remain) + 'đ'}
            </span>
          )}
        </p>
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
        {canManage && (
          <button onClick={() => setShowAdd(true)}
            className="text-xs px-3 py-1.5 bg-[#8B1A1A] text-white rounded-lg font-medium hover:bg-[#6B1212]">
            + Thêm dịch vụ
          </button>
        )}
      </div>

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
            <p className="text-sm font-semibold text-slate-900 flex-1 min-w-[160px]">{s.templateName}</p>
            <p className="text-xs text-slate-600">
              Nhận {fmtDate(s.received_at)} · Dự kiến trả {fmtDate(s.expected_at)} · Chi phí {fmt(s.cost)}đ
            </p>
            {s.totalCount > 0 && (
              <span className={'text-xs font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white ' + pctText(s.percent)}>
                {s.doneCount}/{s.totalCount} việc · {s.percent}%
              </span>
            )}
          </div>

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
      body: JSON.stringify({ hcnsClientId: hcnsClient.id, caseServiceId: serviceId || null, amount: amt, note: note || null }),
    })
    const j = await res.json()
    setSaving(false)
    if (j.error) { setErr(j.error); return }
    setAmount(''); setNote('')
    onChanged()
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
                <span className="text-slate-500 tabular-nums">{fmt(s.paid)} / {fmt(s.cost)}đ</span>
                <span className={'w-24 text-right tabular-nums font-medium ' +
                  (s.remain === 0 ? 'text-[#2E6B3A]' : 'text-[#B3261E]')}>
                  {s.remain === 0 ? 'đủ' : 'còn ' + fmt(s.remain) + 'đ'}
                </span>
              </div>
            ))}
            {t.unassigned > 0 && (
              <p className="text-xs text-slate-500 pt-1">
                Trong đó {fmt(t.unassigned)}đ thu chung cho cả hồ sơ, chưa tách theo dịch vụ.
              </p>
            )}
          </div>
        )}

        {canManage && (
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  {p.createdByName || '—'} · {new Date(p.created_at).toLocaleString('vi-VN')}
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

function AddCaseModal({ category, staffList, onClose, onDone }) {
  const [f, setF] = useState({ category, case_code: '', name: '', tax_code: '', address: '', representative: '', phone: '', assigned_to: '', note: '' })
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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    })
    const j = await res.json()
    setSaving(false)
    if (j.error) return setErr(j.error)
    onDone()
  }

  return (
    <Modal title="Thêm công ty" subtitle={'Phòng HCNS · loại ' + CAT_LABEL[category]} onClose={onClose}>
      <div className="p-4 space-y-3">
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
            <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} className={inputCls}>
              <option value="thoi_diem">Thời điểm</option>
              <option value="vang_lai">Vãng lai</option>
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
          {saving ? 'Đang lưu...' : 'Thêm công ty'}
        </button>
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

  const submit = async () => {
    setErr('')
    if (!f.templateId) return setErr('Vui lòng chọn loại dịch vụ')
    if (!f.cost) return setErr('Vui lòng nhập chi phí')
    if (!f.received_at) return setErr('Vui lòng chọn thời gian nhận')
    setSaving(true)
    const res = await fetch('/api/admin/hcns/case-services', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, hcnsClientId: hcnsClient.id, cost: Number(f.cost) }),
    })
    const j = await res.json()
    setSaving(false)
    if (j.error) return setErr(j.error)
    onDone()
  }

  return (
    <Modal title="Thêm dịch vụ" subtitle={hcnsClient.case_code + ' · ' + hcnsClient.name} onClose={onClose}>
      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Loại dịch vụ triển khai <span className="text-red-500">*</span></label>
          {/* Gom theo nhóm nghiệp vụ — 24 dịch vụ trong một danh sách phẳng rất khó tìm. */}
          <select value={f.templateId} onChange={e => setF(p => ({ ...p, templateId: e.target.value }))} className={inputCls}>
            <option value="">-- Chọn dịch vụ --</option>
            {[['BHXH', 'Bảo hiểm xã hội'], ['HCNS', 'Hành chính nhân sự'], [null, 'Khác']].map(([k, lbl]) => {
              const list = templates.filter(t => (t.group_name || null) === k)
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
        <div>
          <label className={labelCls}>Chi phí (đ) <span className="text-red-500">*</span> <span className="text-blue-600 font-semibold">— đã bao gồm VAT</span></label>
          <input type="text" inputMode="numeric"
            value={f.cost ? Number(f.cost).toLocaleString('vi-VN') : ''}
            onChange={e => setF(p => ({ ...p, cost: e.target.value.replace(/\D/g, '') }))}
            className={inputCls} placeholder="VD: 4.500.000" />
        </div>
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
          {saving ? 'Đang lưu...' : 'Thêm dịch vụ'}
        </button>
      </div>
    </Modal>
  )
}
