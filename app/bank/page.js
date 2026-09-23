'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { hasPermission } from '@/lib/permissions'

// Đối soát ngân hàng (/bank) — tiền vào từ VPS (ACB tức thì, Techcombank theo sao kê sáng hôm sau).
// Trang KHÔNG tự ghi gì: người có quyền `bank_reconcile` bấm "Ghi" mới ghi vào công nợ, và server
// luôn tính lại đề xuất trước khi ghi (xem app/api/admin/bank-transactions).

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
const pad = (n) => String(n).padStart(2, '0')

// Ngày theo giờ VN dạng YYYY-MM-DD.
function vnDate(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}
function vnTime(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
}

// Chuẩn hoá chuỗi tìm kiếm: bỏ dấu, viết hoa, bỏ mọi ký tự không phải chữ/số (gõ "1620000" hay
// "1.620.000" đều khớp, gõ "pho giay cu" khớp "PHỐ GIÀY CŨ").
const searchKey = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '')

// Nhóm hiển thị: đã ghi qua trang + đã bỏ qua + nhân viên đã ghi tay đều về "Đã khớp sổ".
const groupOf = (r) => (r.status === 'posted' || r.status === 'ignored' || r.status === 'done') ? 'done' : r.status

const ST = {
  done:    { label: 'Đã khớp sổ',   sub: 'đã có người ghi',          icon: '✓✓', card: 'bg-teal-50 border-teal-200 text-teal-800',       pill: 'bg-teal-50 text-teal-700 border-teal-200',       bar: 'bg-teal-500' },
  // Xanh lá cây cho "Sẵn sàng ghi" — viền đậm hơn để không lẫn với xanh ngọc của "Đã khớp sổ".
  ready:   { label: 'Sẵn sàng ghi', sub: 'bấm 1 lần là ghi',         icon: '✓',  card: 'bg-green-50 border-green-300 text-green-800',    pill: 'bg-green-50 text-green-700 border-green-300',    bar: 'bg-green-500' },
  review:  { label: 'Cần xem',      sub: 'lệch · theo tên · kỳ lạ',  icon: '!',  card: 'bg-amber-50 border-amber-200 text-amber-800',     pill: 'bg-amber-50 text-amber-700 border-amber-200',     bar: 'bg-amber-400' },
  unknown: { label: 'Chưa nhận ra', sub: 'chọn công ty tay',          icon: '?',  card: 'bg-rose-50 border-rose-200 text-rose-800',        pill: 'bg-rose-50 text-rose-700 border-rose-200',        bar: 'bg-rose-400' },
}
// "ignored" gồm 2 việc khác hẳn nhau: xác nhận nhân viên đã ghi tay, và bỏ qua vì không phải phí
// dịch vụ. Phân biệt bằng ghi chú lưu lúc đóng để người xem sau còn hiểu chuyện gì đã xảy ra.
const pillLabel = (r) => r.status === 'posted' ? 'Đã ghi qua đối soát'
  : r.status === 'ignored' ? (/ghi tay|khớp sổ/i.test(r.note || '') ? 'Đã khớp sổ' : 'Đã bỏ qua')
  : 'Đã khớp sổ'
const VIA = { code: ['qua Mã KH', 'bg-blue-50 text-blue-700'], mst: ['qua MST', 'bg-violet-50 text-violet-700'],
  name: ['qua Tên', 'bg-amber-50 text-amber-700'], manual: ['chọn tay', 'bg-gray-100 text-gray-600'] }
// Nhãn thao tác trong nhật ký từng giao dịch (bank_action_logs.action).
const ACTION_LABEL = { post: 'Ghi công nợ', ignore: 'Đóng giao dịch', reopen: 'Mở lại', assign: 'Chọn công ty', note: 'Ghi chú' }
const KIND = { ketoan: ['KT', 'bg-emerald-50 text-emerald-700'], hcns: ['HCNS', 'bg-violet-50 text-violet-700'], no_ton: ['Nợ tồn', 'bg-orange-50 text-orange-700'] }

// Tô mã KH (xanh) và kỳ (tím) trên nội dung gốc.
function Memo({ text, hl }) {
  const parts = []
  let at = 0
  for (const h of hl || []) {
    if (h.start < at) continue
    if (h.start > at) parts.push(<span key={'t' + at}>{text.slice(at, h.start)}</span>)
    parts.push(<b key={'h' + h.start} className={'font-medium rounded px-0.5 ' + (h.kind === 'code' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700')}>{text.slice(h.start, h.end)}</b>)
    at = h.end
  }
  if (at < text.length) parts.push(<span key={'t' + at}>{text.slice(at)}</span>)
  return <div className="font-mono text-[11.5px] text-gray-500 break-all line-clamp-2">{parts}</div>
}

function Chip({ cls, children }) {
  return <span className={'text-[11px] px-1.5 py-px rounded-md whitespace-nowrap ' + cls}>{children}</span>
}

export default function BankPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [from, setFrom] = useState(vnDate(-6))
  const [to, setTo] = useState(vnDate(0))
  const [bank, setBank] = useState('all')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [clients, setClients] = useState(null)

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/admin/me', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      if (!me || me.error) { router.push('/login'); return }
      const ok = await hasPermission(me.roles?.length ? me.roles : me.role, 'bank_reconcile')
      if (!ok) { router.push('/dashboard'); return }
      setAllowed(true)
    })()
  }, [router])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/bank-transactions?from=' + from + '&to=' + to, { cache: 'no-store' })
      const json = await res.json()
      if (json.error) setError(json.error)
      else setRows(json.data || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { if (allowed) load() }, [allowed, load])

  const loadClients = async () => {
    if (clients) return
    const json = await fetch('/api/admin/bank-transactions?clients=1', { cache: 'no-store' }).then(r => r.json())
    setClients(json.data || [])
  }

  const act = async (body, okText) => {
    setBusy(body.id); setMsg(null)
    try {
      const res = await fetch('/api/admin/bank-transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setMsg({ type: 'err', text: json.error || 'Lỗi' }); setBusy(null); await load(); return false }
      if (okText) setMsg({ type: 'ok', text: okText })
    } catch (e) { setMsg({ type: 'err', text: e.message }); setBusy(null); return false }
    setBusy(null)
    await load()
    return true
  }

  // Tìm theo nội dung chuyển khoản, tên/mã công ty hoặc số tiền — bỏ dấu để gõ không dấu vẫn ra.
  const shown = useMemo(() => {
    const key = searchKey(q)
    return rows.filter(r => (bank === 'all' || r.source === bank)
      && (!key || searchKey([r.memo, r.client?.name, r.client?.client_code, r.amount, r.reason].join(' ')).includes(key)))
  }, [rows, bank, q])
  const count = (g) => shown.filter(r => groupOf(r) === g).length
  const total = shown.reduce((a, r) => a + r.amount, 0)
  const list = shown.filter(r => filter === 'all' || groupOf(r) === filter)
  const readyRows = shown.filter(r => r.status === 'ready' && r.signature)

  const postAll = async () => {
    if (!readyRows.length) return
    if (!confirm('Ghi công nợ cho ' + readyRows.length + ' giao dịch khớp chắc chắn (' + fmt(readyRows.reduce((a, r) => a + r.amount, 0)) + ')?')) return
    setBusy('all'); setMsg(null)
    let ok = 0; const errs = []
    for (const r of readyRows) {
      const res = await fetch('/api/admin/bank-transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', id: r.id, signature: r.signature }),
      }).then(x => x.json()).catch(e => ({ error: e.message }))
      if (res.ok) ok++; else errs.push((r.client?.name || '') + ': ' + res.error)
    }
    setBusy(null)
    setMsg(errs.length ? { type: 'err', text: 'Ghi được ' + ok + ', lỗi ' + errs.length + ': ' + errs.join(' | ') } : { type: 'ok', text: 'Đã ghi ' + ok + ' giao dịch' })
    await load()
  }

  if (!allowed) return (
    <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
  )

  const cards = [
    { k: 'all', label: 'Tiền vào', value: fmt(total), sub: shown.length + ' giao dịch', icon: '₫', card: 'bg-blue-50 border-blue-200 text-blue-800' },
    ...['done', 'ready', 'review', 'unknown'].map(k => ({ k, label: ST[k].label, value: count(k), sub: ST[k].sub, icon: ST[k].icon, card: ST[k].card })),
  ]

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Đối soát ngân hàng</h1>
            <p className="text-sm text-gray-500 mt-1">Tiền vào từ VPS · ACB tức thì · Techcombank theo sao kê sáng hôm sau</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="relative">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm nội dung, công ty, số tiền…"
                className="border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 w-64 bg-white" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>}
            </div>
            <select value={bank} onChange={e => setBank(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="all">Tất cả ngân hàng</option>
              <option value="acb">ACB</option>
              <option value="tcb">Techcombank</option>
            </select>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
            <span className="text-gray-400">→</span>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
            <button onClick={load} disabled={loading} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50">
              {loading ? 'Đang tải...' : '↻ Tải lại'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          {cards.map(c => (
            <button key={c.k} onClick={() => setFilter(filter === c.k ? 'all' : c.k)}
              className={'text-left rounded-xl border px-3 py-2.5 transition hover:-translate-y-px ' + c.card + (filter === c.k && c.k !== 'all' ? ' ring-2 ring-offset-1 ring-current' : '')}>
              <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-xs font-semibold mb-1">{c.icon}</div>
              <p className="text-[11px] opacity-80">{c.label}</p>
              <p className={'font-semibold ' + (c.k === 'all' ? 'text-sm' : 'text-xl')}>{c.value}</p>
              <p className="text-[10.5px] opacity-70">{c.sub}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mb-2 px-0.5">
          <span><Chip cls="bg-blue-50 text-blue-700 font-medium">MÃ KH</Chip> mã KH / MST</span>
          <span><Chip cls="bg-violet-50 text-violet-700 font-medium">T09</Chip> kỳ phí</span>
          <span><Chip cls={KIND.ketoan[1]}>KT</Chip> phí kế toán</span>
          <span><Chip cls={KIND.hcns[1]}>HCNS</Chip> phí HCNS</span>
          <span><Chip cls={KIND.no_ton[1]}>Nợ tồn</Chip> trừ nợ tồn</span>
        </div>

        {msg && (
          <div className={'mb-2 text-sm rounded-lg px-3 py-2 border ' + (msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700')}>
            {msg.text}
          </div>
        )}
        {error && <div className="mb-2 text-sm rounded-lg px-3 py-2 border bg-rose-50 border-rose-200 text-rose-700">{error}</div>}

        {!loading && !list.length && (
          <div className="text-center text-sm text-gray-400 py-10 border border-dashed border-gray-200 rounded-xl">{q ? 'Không tìm thấy giao dịch nào khớp "' + q + '"' : 'Chưa có giao dịch nào trong khoảng này'}</div>
        )}

        <div>
          {list.map((r, i) => (
            <Row key={r.id} r={r} zebra={i % 2 === 1} open={!!open[r.id]}
              toggle={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}
              busy={busy === r.id || busy === 'all'} act={act}
              clients={clients} loadClients={loadClients} />
          ))}
        </div>

        {readyRows.length > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-green-300 bg-green-50 px-3 py-2.5">
            <span className="text-sm text-green-700">{readyRows.length} giao dịch khớp chắc chắn đang chờ ghi</span>
            <button onClick={postAll} disabled={!!busy}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-white border border-green-400 text-green-700 hover:bg-green-100 disabled:opacity-50">
              {busy === 'all' ? 'Đang ghi...' : 'Ghi tất cả'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Row({ r, zebra, open, toggle, busy, act, clients, loadClients }) {
  const g = groupOf(r)
  const st = ST[g]
  const pill = r.state === "open" ? st.label : pillLabel(r)
  const via = r.via && VIA[r.via]
  const periodTxt = r.period ? 'T' + r.period.month + '/' + r.period.year : null
  const [pick, setPick] = useState('')
  const [pYear, setPYear] = useState(r.period?.year || new Date().getFullYear())
  const [pMonth, setPMonth] = useState(r.period?.month || new Date().getMonth() + 1)
  const [note, setNote] = useState('')

  const pickedClient = clients && pick ? clients.find(c => c.name === pick || c.client_code === pick) : null
  const lines = r.status === 'posted' ? (r.post_detail?.done || []) : (r.plan || [])

  return (
    <div className={'rounded-xl border border-gray-200 mb-1.5 flex gap-2.5 pl-2.5 pr-3 py-2.5 cursor-pointer ' + (zebra ? 'bg-gray-50' : 'bg-white')} onClick={toggle}>
      <div className={'w-[3px] rounded-full flex-shrink-0 ' + st.bar} />
      <div className="flex-1 min-w-0">
        <div className="flex gap-3 items-start">
          <div className="w-16 flex-shrink-0">
            <p className="text-[11.5px] text-gray-500 mb-1">{vnTime(r.tx_time)}</p>
            <Chip cls="bg-blue-50 text-blue-700 text-[10px]">{r.source === 'tcb' ? 'TCB' : 'ACB'}</Chip>
          </div>
          <div className="flex-1 min-w-0">
            <Memo text={r.memo} hl={r.hl} />
            <div className="mt-1 text-[13px] flex flex-wrap items-center gap-1.5">
              {r.client
                ? <span className="font-semibold text-gray-800">{r.client.name}</span>
                : <span className="text-rose-600">{r.ambiguous?.length ? 'Mã trùng ' + r.ambiguous.length + ' công ty' : 'Không nhận ra công ty'}</span>}
              {periodTxt && r.state === 'open' && <Chip cls="bg-violet-50 text-violet-700">{periodTxt}</Chip>}
              {via && r.state === 'open' && <Chip cls={via[1]}>{via[0]}</Chip>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-semibold text-sm text-gray-900">+{fmt(r.amount)}</p>
            <span className={'inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ' + st.pill}>{pill}</span>
          </div>
        </div>

        {open && (
          <div className="mt-2 pt-2 border-t border-dashed border-gray-200 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs" onClick={e => e.stopPropagation()}>
            <span className="text-gray-500">{r.status === 'posted' ? 'Đã ghi' : 'Tách tiền'}</span>
            <span className="flex flex-wrap gap-1">
              {lines.length ? lines.map((l, i) => (
                <Chip key={i} cls={KIND[l.kind][1]}>{KIND[l.kind][0]}{l.month ? ' T' + l.month : ''} {fmt(l.amount)}</Chip>
              )) : '—'}
            </span>

            {r.state === 'open' && r.info && (<>
              <span className="text-gray-500">Trong app</span>
              <span className="text-gray-700">
                Kế toán T{r.info.month}: đã thu {fmt(r.info.ktPaid)} / phí {fmt(r.info.ktFee)}{r.info.ktRolled ? ' (đã chuyển nợ tồn)' : ''}
                {r.info.hFee > 0 && <> · HCNS: đã thu {fmt(r.info.hPaid)} / phí {fmt(r.info.hFee)}{r.info.hRolled ? ' (đã chuyển nợ tồn)' : ''}</>}
                {' · '}Nợ tồn {fmt(r.otherDebt)}
              </span>
            </>)}

            {r.state === 'open' && (<>
              <span className="text-gray-500">Đề xuất</span>
              <span className={g === 'ready' ? 'text-green-700' : g === 'review' ? 'text-amber-700' : g === 'unknown' ? 'text-rose-700' : 'text-teal-700'}>{r.reason}</span>
            </>)}

            {r.state !== 'open' && (<>
              <span className="text-gray-500">Người xử lý</span>
              <span className="text-gray-700">{r.posted_by_name || '—'}{r.posted_at ? ' · ' + vnTime(r.posted_at) : ''}{r.note ? ' · ' + r.note : ''}</span>
            </>)}

            {r.state === 'open' && g !== 'done' && (<>
              <span className="text-gray-500">Chọn tay</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <input list={'cl-' + r.id} value={pick} onFocus={loadClients} onChange={e => setPick(e.target.value)}
                  placeholder={r.client ? 'Đổi công ty: gõ tên / mã KH…' : 'Gõ tên / mã KH / MST…'}
                  className="border border-gray-200 rounded-md px-2 py-1 w-64 max-w-full" />
                <datalist id={'cl-' + r.id}>
                  {(clients || []).map(c => <option key={c.id} value={c.name}>{[c.client_code, c.tax_code].filter(Boolean).join(' · ')}</option>)}
                </datalist>
                <select value={pMonth} onChange={e => setPMonth(Number(e.target.value))} className="border border-gray-200 rounded-md px-1 py-1">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T{i + 1}</option>)}
                </select>
                <select value={pYear} onChange={e => setPYear(Number(e.target.value))} className="border border-gray-200 rounded-md px-1 py-1">
                  {[pYear - 1, pYear, pYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button disabled={busy || (!pickedClient && !r.client)}
                  onClick={() => act({ action: 'assign', id: r.id, clientId: pickedClient?.id || r.client?.id, year: pYear, month: pMonth, userNote: note.trim() || undefined }, 'Đã áp dụng — xem lại đề xuất')}
                  className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40">Áp dụng</button>
                {(r.manualClient || r.manualPeriod) && (
                  <button disabled={busy} onClick={() => act({ action: 'assign', id: r.id, clientId: null }, 'Đã về lại kết quả tự đọc')}
                    className="px-2 py-1 text-gray-500 hover:underline">Bỏ chọn tay</button>
                )}
              </span>
            </>)}

            {/* Ghi chú đi kèm THAO TÁC: gõ trước rồi bấm nút bên dưới thì ghi chú được lưu cùng
                việc vừa làm; không bấm nút nào thì bấm "Lưu ghi chú" để lưu riêng. */}
            <span className="text-gray-500">Ghi chú</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="Ghi chú cho giao dịch này (vd: khách báo trả hộ công ty khác)…"
                className="border border-gray-200 rounded-md px-2 py-1 flex-1 min-w-[16rem]" />
              <button disabled={busy || !note.trim()}
                onClick={async () => { if (await act({ action: 'note', id: r.id, note: note.trim() }, 'Đã lưu ghi chú')) setNote('') }}
                className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40">Lưu ghi chú</button>
            </span>

            {r.logs?.length > 0 && (<>
              <span className="text-gray-500">Nhật ký</span>
              <span className="space-y-0.5">
                {r.logs.map(l => (
                  <div key={l.id} className="text-gray-600">
                    <span className="text-gray-400">{vnTime(l.at)} · {l.by} · </span>
                    {ACTION_LABEL[l.action] || l.action}
                    {l.detail ? ': ' + l.detail : ''}
                    {l.note && <span className="text-gray-700"> — “{l.note}”</span>}
                  </div>
                ))}
              </span>
            </>)}

            <span />
            <span className="flex flex-wrap gap-1.5 mt-1">
              {r.state === 'open' && r.plan && r.signature && (g === 'ready' || g === 'review') && (
                <button disabled={busy} onClick={async () => {
                  const txt = r.plan.map(l => KIND[l.kind][0] + (l.month ? ' T' + l.month : '') + ' ' + fmt(l.amount)).join(', ')
                  if (confirm('Ghi vào công nợ ' + r.client.name + ':\n' + txt)) {
                    if (await act({ action: 'post', id: r.id, signature: r.signature, userNote: note.trim() || undefined }, 'Đã ghi công nợ ' + r.client.name)) setNote('')
                  }
                }}
                  className={'px-3 py-1 rounded-md font-medium border disabled:opacity-40 ' + st.pill}>
                  {busy ? 'Đang ghi...' : g === 'ready' ? 'Ghi công nợ' : 'Ghi theo đề xuất'}
                </button>
              )}
              {r.state === 'open' && (<>
                <button disabled={busy} onClick={async () => {
                  if (await act({ action: 'ignore', id: r.id, note: g === 'done' ? 'Nhân viên đã ghi tay' : 'Đã xử lý tay', userNote: note.trim() || undefined }, 'Đã đánh dấu')) setNote('')
                }}
                  className="px-3 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40">
                  {g === 'done' ? 'Xác nhận khớp sổ' : 'Đã xử lý tay'}
                </button>
                {g !== 'done' && (
                  <button disabled={busy} onClick={async () => {
                    if (await act({ action: 'ignore', id: r.id, note: 'Không phải phí dịch vụ', userNote: note.trim() || undefined }, 'Đã bỏ qua')) setNote('')
                  }}
                    className="px-3 py-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40">Bỏ qua</button>
                )}
              </>)}
              {r.state === 'ignored' && (
                <button disabled={busy} onClick={() => act({ action: 'reopen', id: r.id, userNote: note.trim() || undefined }, 'Đã mở lại')}
                  className="px-3 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40">Mở lại</button>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
