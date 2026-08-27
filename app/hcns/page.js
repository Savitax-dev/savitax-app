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
const pctText = (v) => v >= 90 ? 'text-[#2E6B3A]' : v >= 70 ? 'text-[#87590B]' : 'text-[#B3261E]'
const pctBar  = (v) => v >= 90 ? 'bg-[#2E6B3A]'   : v >= 70 ? 'bg-[#D89614]'   : 'bg-[#B3261E]'

const CAT_LABEL = { thoi_ky: 'Thời kỳ', thoi_diem: 'Thời điểm', vang_lai: 'Vãng lai' }
const CAT_STYLE = {
  thoi_ky:   'bg-emerald-50 text-emerald-700',
  thoi_diem: 'bg-indigo-50 text-indigo-700',
  vang_lai:  'bg-orange-50 text-orange-700',
}
const STATUS_STYLE = {
  thu_thap:    'bg-gray-100 text-gray-600',
  trinh_ky:    'bg-amber-50 text-amber-700',
  nop_ho_so:   'bg-blue-50 text-blue-700',
  tra_ket_qua: 'bg-violet-50 text-violet-700',
  hoan_thanh:  'bg-emerald-50 text-emerald-700',
}

// Bỏ dấu để tìm kiếm gõ không dấu vẫn ra.
const noAccent = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/gi, 'd').toLowerCase()

function Meter({ value }) {
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
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
      const { data: me } = await supabase.from('staff').select('role').eq('id', sd.session.user.id).single()
      const perm = await loadPermissionData()
      const role = me?.role
      if (!can(role, 'view_hcns', perm)) { router.push('/dashboard'); return }
      setAllowed(true)
      setCanManage(can(role, 'manage_hcns', perm))
      setCanAssign(can(role, 'view_hcns_all_staff', perm))
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

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
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
          <h1 className="text-xl font-bold text-gray-900">Công ty phụ trách</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Phòng HCNS · {clients.length} công ty
            {report?.scope === 'own' && <span className="ml-1.5 text-amber-600">· chỉ hiện phần bạn phụ trách</span>}
          </p>
        </div>

        <div className="flex gap-1 flex-wrap border-b border-gray-200 mb-3">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={'px-3 py-2 text-sm rounded-t-lg transition-colors ' +
                (tab === t.key ? 'bg-[#8B1A1A] text-white font-medium' : 'text-gray-500 hover:text-gray-800')}>
              {t.label}{t.count !== undefined ? ' (' + t.count + ')' : ''}
            </button>
          ))}
        </div>

        {/* Thanh công cụ — dùng chung cho mọi tag danh sách */}
        {tab !== 'report' && (
          <div className="flex gap-2 flex-wrap items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên công ty hoặc MST"
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30" />
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white text-sm">
              {[['month','Tháng'],['quarter','Quý'],['year','Năm']].map(([k,l]) => (
                <button key={k} onClick={() => setMode(k)}
                  className={'px-3 py-1.5 border-l first:border-l-0 border-gray-200 ' +
                    (mode === k ? 'bg-[#8B1A1A] text-white' : 'text-gray-600 hover:bg-gray-50')}>{l}</button>
              ))}
            </div>
            <select value={selYear + '-' + selMonth}
              onChange={e => { const [y, m] = e.target.value.split('-'); setSelYear(Number(y)); setSelMonth(Number(m)) }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
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
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {filtered(byCat(tab)).length === 0 && (
              <p className="text-sm text-gray-400 px-4 py-8 text-center">
                {search ? 'Không tìm thấy công ty nào khớp.' : 'Chưa có công ty nào ở mục này.'}
              </p>
            )}
            {filtered(byCat(tab)).map(c => (
              <ClientRow key={c.id} c={c} showCat={tab === 'all'} report={report}
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
  if (!report) return <p className="text-sm text-gray-400 px-4 py-8 text-center">Chưa có số liệu.</p>
  const tk = report.thoiKy

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white text-sm">
          {[['month','Tháng'],['quarter','Quý'],['year','Năm']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)}
              className={'px-3 py-1.5 border-l first:border-l-0 border-gray-200 ' +
                (mode === k ? 'bg-[#8B1A1A] text-white' : 'text-gray-600 hover:bg-gray-50')}>{l}</button>
          ))}
        </div>
        <select value={selYear + '-' + selMonth}
          onChange={e => { const [y, m] = e.target.value.split('-'); setSelYear(Number(y)); setSelMonth(Number(m)) }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
          {monthOpts.map(o => <option key={o.label} value={o.y + '-' + o.m}>{o.label}</option>)}
        </select>
      </div>

      {/* Khối Thời kỳ — chiếm hết chiều ngang */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-sm font-bold text-gray-900">Thời kỳ</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{tk.clientCount} công ty</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">KPI Công nợ — trung bình theo nhân viên</p>
            <p className={'text-2xl font-bold mt-0.5 ' + pctText(tk.debtPercent ?? 0)}>
              {tk.debtPercent === null ? '—' : tk.debtPercent + '%'}
            </p>
            <div className="mt-1.5"><Meter value={tk.debtPercent ?? 0} /></div>
            <p className="text-xs text-gray-400 mt-1.5">Đã thu {fmt(tk.totalCollected)}đ / {fmt(tk.totalFee)}đ</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">KPI % Công việc — trung bình theo nhân viên</p>
            <p className={'text-2xl font-bold mt-0.5 ' + pctText(tk.taskPercent ?? 0)}>
              {tk.taskPercent === null ? '—' : tk.taskPercent + '%'}
            </p>
            <div className="mt-1.5"><Meter value={tk.taskPercent ?? 0} /></div>
            <p className="text-xs text-gray-400 mt-1.5">Checklist DV HCNS Thời Kỳ</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-2">
          KPI phòng là <b>trung bình cộng % của từng nhân viên</b>, không phải tổng thu chia tổng phí — hai số này khác nhau.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium py-2 px-2">Nhân viên</th>
                <th className="text-right font-medium py-2 px-2">Cty</th>
                <th className="text-right font-medium py-2 px-2">Đã thu / Phải thu</th>
                <th className="text-left font-medium py-2 px-2 w-32">Công nợ</th>
                <th className="text-left font-medium py-2 px-2 w-32">Công việc</th>
              </tr>
            </thead>
            <tbody>
              {tk.perStaff.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400">Chưa có nhân viên nào thuộc phòng HCNS.</td></tr>
              )}
              {tk.perStaff.map(s => (
                <tr key={s.staffId} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 px-2 text-gray-800">{s.staffName}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-500">{s.clientCount}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-500">{fmt(s.totalCollected)} / {fmt(s.totalFee)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Meter value={s.debtPercent ?? 0} />
                      <span className={'tabular-nums font-medium w-9 text-right ' + pctText(s.debtPercent ?? 0)}>
                        {s.debtPercent === null ? '—' : s.debtPercent + '%'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Meter value={s.taskPercent ?? 0} />
                      <span className={'tabular-nums font-medium w-9 text-right ' + pctText(s.taskPercent ?? 0)}>
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
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{data.caseCount} hồ sơ</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[['Hồ sơ', data.caseCount], ['Dịch vụ', data.serviceCount], ['Chi phí', fmt(data.totalCost) + 'đ']].map(([k, v]) => (
          <div key={k} className="bg-gray-50 rounded-lg px-2 py-1.5">
            <p className="text-xs text-gray-400">{k}</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-1.5">Dịch vụ theo bước xử lý</p>
      {data.byStatus.map(s => (
        <div key={s.status} className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-600 w-28 flex-shrink-0">{s.label}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#1E4E8C] rounded-full" style={{ width: (s.count / max * 100) + '%' }} />
          </div>
          <span className="text-xs tabular-nums w-4 text-right text-gray-800">{s.count}</span>
        </div>
      ))}
      {data.byStaff.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          {data.byStaff.map(s => (
            <div key={s.staffId} className="flex justify-between text-xs text-gray-500 py-1">
              <span>{s.staffName || '(chưa gán)'}</span>
              <span className="tabular-nums">{s.cases} hồ sơ · {s.services} dịch vụ</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Một dòng công ty ─────────────────────────── */
function ClientRow({ c, showCat, report, expanded, onToggle, clientMonth, setClientMonth, selMonth, canManage, canAssign, staffList, templates, onChanged }) {
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
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 flex items-center gap-2 flex-wrap">
            {c.name}
            {showCat && <span className={'text-xs px-2 py-0.5 rounded-full ' + CAT_STYLE[c.category]}>{CAT_LABEL[c.category]}</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {[c.case_code || c.client_code, c.tax_code,
              isThoiKy ? fmt(c.hcns_fee) + 'đ/' + (c.fee_period === 'quarterly' ? 'Quý' : 'Tháng') : null,
              c.staff?.full_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        {isThoiKy && stat && (
          <>
            <DebtBadge stat={stat} />
            {stat.taskPercent !== null && (
              <span className={'text-xs px-2 py-0.5 rounded-full bg-gray-50 ' + pctText(stat.taskPercent)}>
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
                (c.assigned_to ? 'border-gray-200 text-gray-700' : 'border-amber-300 text-amber-700')}>
              <option value="">⚠ Chưa phân công</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </span>
        ) : !c.assigned_to && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex-shrink-0">Chưa phân công</span>
        )}
        <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="bg-gray-50/60 border-t border-gray-100">
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
            <p className="text-xs text-gray-400 px-4 py-4">
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
  if (!stat.dueFee) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">Chưa tới kỳ</span>
  if (stat.remain === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-[#EBF3EB] text-[#2E6B3A]">Đã thu</span>
  if (stat.collected > 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAF1DC] text-[#87590B]">Thu thiếu {fmt(stat.remain)}đ</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAEBEA] text-[#B3261E]">Chưa thu</span>
}

/* ──────────────── Dịch vụ trong hồ sơ Thời điểm / Vãng lai ──────────────── */
function CaseServices({ hcnsClient, canManage, templates, onChanged }) {
  const [services, setServices] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [panel, setPanel] = useState(null)   // null | 'debt' | 'dntt'
  const [debt, setDebt] = useState(null)

  const load = async () => {
    const [svcRes, debtRes] = await Promise.all([
      fetch('/api/admin/hcns/case-services?hcnsClientId=' + hcnsClient.id).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/hcns/case-payments?hcnsClientId=' + hcnsClient.id).then(r => r.json()).catch(() => ({})),
    ])
    setServices(svcRes.data || [])
    setDebt(debtRes.totals ? debtRes : null)
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

  if (services === null) return <p className="text-xs text-gray-400 px-4 py-4">Đang tải dịch vụ...</p>

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500 flex-1 min-w-[160px]">
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
        <button onClick={() => setPanel(panel === 'debt' ? null : 'debt')}
          className={'text-xs px-3 py-1.5 rounded-lg font-medium border ' +
            (panel === 'debt' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
          💰 Công nợ
        </button>
        <button onClick={() => setPanel(panel === 'dntt' ? null : 'dntt')}
          className={'text-xs px-3 py-1.5 rounded-lg font-medium border ' +
            (panel === 'dntt' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200')}>
          📄 ĐNTT
        </button>
        {canManage && (
          <button onClick={() => setShowAdd(true)}
            className="text-xs px-3 py-1.5 bg-[#8B1A1A] text-white rounded-lg font-medium hover:bg-[#6B1212]">
            + Thêm dịch vụ
          </button>
        )}
      </div>

      {panel === 'debt' && (
        <CaseDebtPanel hcnsClient={hcnsClient} debt={debt} canManage={canManage}
          onChanged={() => { load(); onChanged && onChanged() }} />
      )}
      {panel === 'dntt' && <CaseDnttPanel hcnsClient={hcnsClient} services={services} />}

      {services.length === 0 && <p className="text-xs text-gray-400 py-2">Hồ sơ chưa có dịch vụ nào.</p>}

      {services.map(s => (
        <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-gray-900 flex-1">{s.templateName}</p>
            <span className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_STYLE[s.status] || 'bg-gray-100')}>{s.statusLabel}</span>
            {canManage && (
              <select value={s.status} onChange={e => changeStatus(s.id, e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                {HCNS_STATUSES.map(st => <option key={st} value={st}>{HCNS_STATUS_LABEL[st]}</option>)}
              </select>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Nhận {fmtDate(s.received_at)} · Dự kiến trả {fmtDate(s.expected_at)} · Chi phí {fmt(s.cost)}đ
            {s.totalCount > 0 && <span className={'ml-2 ' + pctText(s.percent)}>{s.doneCount}/{s.totalCount} việc · {s.percent}%</span>}
          </p>

          {s.tasks.length > 0 && (
            <div className="mt-2 space-y-1">
              {s.tasks.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={t.done} disabled={!canManage}
                    onChange={e => toggleTask(t.id, e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#2E6B3A]" />
                  <span className={t.done ? 'line-through text-gray-400' : ''}>{t.name}</span>
                  {t.done && t.doneByName && (
                    <span className="text-gray-400">— {t.doneByName}{t.done_at ? ' · ' + fmtDate(t.done_at) : ''}</span>
                  )}
                  {!t.stillActive && <span className="text-amber-500">(đã bỏ khỏi mẫu)</span>}
                </label>
              ))}
            </div>
          )}

          {s.statusLog.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer">Nhật ký trạng thái ({s.statusLog.length})</summary>
              <div className="mt-1 space-y-0.5">
                {s.statusLog.map(l => (
                  <p key={l.id} className="text-xs text-gray-400">
                    {l.statusLabel} · {l.changedByName || '—'} · {new Date(l.changed_at).toLocaleString('vi-VN')}
                  </p>
                ))}
              </div>
            </details>
          )}
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
        <span className="text-xs text-gray-600">
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
                <span className="text-gray-600 flex-1 truncate">{s.name}</span>
                <span className="text-gray-400 tabular-nums">{fmt(s.paid)} / {fmt(s.cost)}đ</span>
                <span className={'w-24 text-right tabular-nums font-medium ' +
                  (s.remain === 0 ? 'text-[#2E6B3A]' : 'text-[#B3261E]')}>
                  {s.remain === 0 ? 'đủ' : 'còn ' + fmt(s.remain) + 'đ'}
                </span>
              </div>
            ))}
            {t.unassigned > 0 && (
              <p className="text-xs text-gray-400 pt-1">
                Trong đó {fmt(t.unassigned)}đ thu chung cho cả hồ sơ, chưa tách theo dịch vụ.
              </p>
            )}
          </div>
        )}

        {canManage && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Thu cho</label>
                <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={inputCls}>
                  <option value="">Thu chung cho cả hồ sơ</option>
                  {debt.perService.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (còn {fmt(s.remain)}đ)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Số tiền đã thu (đ)</label>
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

        <div className="border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500 mb-1">Nhật ký thu ({debt.data.length})</p>
          {debt.data.length === 0 && <p className="text-xs text-gray-400">Chưa có khoản thu nào.</p>}
          {debt.data.map(p => (
            <div key={p.id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
              <span className="text-[#2E6B3A] font-semibold tabular-nums w-24 flex-shrink-0">{fmt(p.amount)}đ</span>
              <span className="flex-1 min-w-0">
                <span className="text-gray-700">{p.serviceName || 'Thu chung cả hồ sơ'}</span>
                {p.note && <span className="text-gray-400"> — {p.note}</span>}
                <span className="block text-gray-400">
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
        <p className="text-xs text-gray-400 mb-2">
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
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-500">{no ? 'B' + no : '—'}</td>
                    <td className="border border-gray-200 px-1 py-1">
                      <input value={r.desc} onChange={e => setRow(i, { desc: e.target.value })} disabled={!r.on}
                        className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs" />
                    </td>
                    <td className="border border-gray-200 px-1 py-1">
                      <input type="text" inputMode="numeric" disabled={!r.on}
                        value={r.amount ? Number(r.amount).toLocaleString('vi-VN') : ''}
                        onChange={e => setRow(i, { amount: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs text-right" />
                    </td>
                    <td className="border border-gray-200 px-1 py-1 text-center">
                      <input type="checkbox" checked={r.on} onChange={e => setRow(i, { on: e.target.checked })}
                        title="Đưa dòng này lên phiếu" className="w-3.5 h-3.5 accent-indigo-600" />
                    </td>
                  </tr>
                )
              })}
              <tr><td className="border border-gray-200 px-2 py-1 text-center text-gray-400">VAT</td>
                <td className="border border-gray-200 px-2 py-1 text-gray-500 italic">Thuế VAT 8%</td>
                <td className="border border-gray-200 px-2 py-1 text-right text-gray-500">{fmt(vat)}</td>
                <td className="border border-gray-200"></td></tr>
              <tr className="bg-red-50"><td className="border border-gray-200 px-2 py-1 text-center font-bold">C</td>
                <td className="border border-gray-200 px-2 py-1 font-bold">Tổng đề nghị thanh toán</td>
                <td className="border border-gray-200 px-2 py-1 text-right font-bold text-red-600">{fmt(total)}</td>
                <td className="border border-gray-200"></td></tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-400 flex-shrink-0">QR:</label>
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
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30'
const labelCls = 'text-xs text-gray-500 mb-1 block'

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
          <p className="text-xs text-gray-400 mt-1">Tra cứu tự điền tên, địa chỉ, người đại diện. Khách cá nhân không có MST thì nhập tay.</p>
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
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Hủy</button>
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
          <select value={f.templateId} onChange={e => setF(p => ({ ...p, templateId: e.target.value }))} className={inputCls}>
            <option value="">-- Chọn dịch vụ --</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
          <p className="text-xs text-gray-400 mt-1">{HCNS_STATUSES.map(st => HCNS_STATUS_LABEL[st]).join(' → ')}</p>
        </div>
        <div>
          <label className={labelCls}>Ghi chú</label>
          <input value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} className={inputCls} />
        </div>
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
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Hủy</button>
        <button onClick={submit} disabled={saving}
          className="px-4 py-2 text-sm bg-[#8B1A1A] text-white rounded-lg font-medium disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Thêm dịch vụ'}
        </button>
      </div>
    </Modal>
  )
}
