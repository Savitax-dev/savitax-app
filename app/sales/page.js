'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import {
  STAGES, NEEDS, ACT_KINDS, StageChip, Modal, Field, inputCls, btnPrimary, btnGhost, useToast, api,
  needLabel, actLabel, fmtMoney, dmy, dmyTime, todayVN, isoVN, addDaysISO, StatCard, PageHead,
} from './_ui'

const OPEN_STAGES = ['moi', 'tu_van', 'bao_gia', 'gui_hd']

export default function SalesLeadsPage() {
  const router = useRouter()
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fStage, setFStage] = useState('open')
  const [fChannel, setFChannel] = useState('')
  const [fStaff, setFStaff] = useState('')
  const [showNew, setShowNew] = useState(false)
  // Mở thẳng một khách khi đi từ trang Báo giá sang (/sales?lead=<id>)
  const [openId, setOpenId] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('lead'))
  const [showChannels, setShowChannels] = useState(false)
  const [toastNode, toast] = useToast()

  const load = useCallback(async () => {
    const r = await api('/api/admin/sales/leads')
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { router.push('/dashboard'); return }
    if (!r.ok) { toast(r.data.error || 'Không tải được danh sách', true); setLoading(false); return }
    setRes(r.data); setLoading(false)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      const { data: sd } = await createClient().auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      load()
    }
    init()
  }, [router, load])

  const today = todayVN()
  const staffMap = useMemo(() => {
    const m = new Map()
    for (const s of [...(res?.staff || []), ...(res?.otherStaff || [])]) m.set(s.id, s.full_name)
    return m
  }, [res])
  const chMap = useMemo(() => new Map((res?.channels || []).map(c => [c.id, c.name])), [res])

  const leads = res?.leads || []
  const me = res?.me
  const dueList = leads
    .filter(l => OPEN_STAGES.includes(l.stage) && l.next_follow_up && l.next_follow_up <= today &&
      (res?.perms?.all ? true : l.assigned_to === me))
    .sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up))
  const unassigned = leads.filter(l => !l.assigned_to && OPEN_STAGES.includes(l.stage))

  const needle = q.trim().toLowerCase()
  const needleDigits = needle.replace(/\D/g, '')
  const filtered = leads.filter(l => {
    if (fStage === 'open' && !OPEN_STAGES.includes(l.stage)) return false
    if (fStage === 'due' && !(OPEN_STAGES.includes(l.stage) && l.next_follow_up && l.next_follow_up <= today)) return false
    if (fStage === 'none' && l.assigned_to) return false
    if (!['open', 'due', 'none', 'all'].includes(fStage) && l.stage !== fStage) return false
    if (fChannel && l.channel_id !== fChannel) return false
    if (fStaff === 'me' && l.assigned_to !== me) return false
    if (fStaff && fStaff !== 'me' && l.assigned_to !== fStaff) return false
    if (needle) {
      const hay = [l.company_name, l.contact_name, l.email, l.source_note].join(' ').toLowerCase()
      const digits = String(l.phone || '').replace(/\D/g, '') + ' ' + String(l.tax_code || '').replace(/\D/g, '')
      if (!hay.includes(needle) && !(needleDigits.length >= 3 && digits.includes(needleDigits))) return false
    }
    return true
  })

  const countStage = k => leads.filter(l => l.stage === k).length
  const monthKey = today.slice(0, 7)
  const newThisMonth = leads.filter(l => isoVN(l.created_at).slice(0, 7) === monthKey).length

  if (loading) return <AppShell><div className="sales-ui flex items-center justify-center"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
  if (!res) return <AppShell><div className="sales-ui p-8 text-sm text-gray-500">Chưa tải được dữ liệu. {toastNode}</div></AppShell>

  return (
    <AppShell>
      <div className="sales-ui">
      <div className="px-4 md:px-8 py-5">
        <div className="mb-4">
          <PageHead title="Khách tiềm năng" sub="Khách từ các kênh truyền thông Savitax đưa về — tiếp nhận, chăm sóc, tư vấn và lập báo giá">
            {res.perms.all && <button onClick={() => setShowChannels(true)} className={btnGhost}>Kênh truyền thông</button>}
            {res.perms.view && <button onClick={() => setShowNew(true)} className={btnPrimary}>+ Tiếp nhận khách</button>}
          </PageHead>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Khách mới tháng này" value={newThisMonth} foot={'tổng ' + leads.length + ' khách trong danh sách'} tone="blue" />
          <StatCard label="Đang chăm sóc" value={leads.filter(l => OPEN_STAGES.includes(l.stage)).length}
            foot={unassigned.length ? unassigned.length + ' khách chưa ai nhận' : 'mọi khách đều có người phụ trách'} tone="sky" />
          <StatCard label={res.perms.all ? 'Cần chăm sóc hôm nay (cả phòng)' : 'Tôi cần chăm sóc hôm nay'} value={dueList.length}
            foot={dueList.filter(l => l.next_follow_up < today).length + ' khách đã quá hẹn'} tone="red" />
          <StatCard label="Chốt HĐ (toàn thời gian)" value={countStage('chot')} foot={countStage('that_bai') + ' khách không thành'} tone="grn" />
        </div>

        {dueList.length > 0 && (
          <div className="bg-red-50/60 border border-red-100 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-red-800 mb-2">⏰ Cần gọi lại / chăm sóc hôm nay</p>
            <div className="flex flex-wrap gap-2">
              {dueList.slice(0, 12).map(l => (
                <button key={l.id} onClick={() => setOpenId(l.id)}
                  className="text-left bg-white border border-red-100 rounded-xl px-3 py-2 hover:border-red-300 max-w-xs">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.company_name || l.contact_name}</p>
                  <p className={'text-xs ' + (l.next_follow_up < today ? 'text-red-600 font-medium' : 'text-gray-500')}>
                    {l.next_follow_up < today ? 'Quá hẹn từ ' + dmy(l.next_follow_up) : 'Hẹn hôm nay'}
                    {res.perms.all && ' · ' + (staffMap.get(l.assigned_to) || 'chưa ai nhận')}
                  </p>
                </button>
              ))}
              {dueList.length > 12 && <button onClick={() => setFStage('due')} className="text-sm text-red-700 underline px-2">+{dueList.length - 12} khách nữa</button>}
            </div>
          </div>
        )}

        {/* Ô tìm giãn hết phần còn trống, bộ lọc dồn về cuối hàng — giống trang Báo giá */}
        <div className="flex gap-2 flex-wrap items-center mb-3">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên công ty, người liên hệ, SĐT, MST, email…"
            className="s-input !w-auto flex-1 min-w-[260px]" />
          <div className="ml-auto flex gap-2 flex-wrap">
            <select value={fChannel} onChange={e => setFChannel(e.target.value)} className="s-input !w-auto">
              <option value="">Mọi kênh</option>
              {res.channels.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (đã ẩn)'}</option>)}
            </select>
            <select value={fStaff} onChange={e => setFStaff(e.target.value)} className="s-input !w-auto">
              <option value="">Mọi người phụ trách</option>
              <option value="me">Khách của tôi</option>
              {res.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap mb-3">
          {[['open', 'Đang chăm sóc'], ['due', 'Cần chăm sóc'], ['none', 'Chưa ai nhận'], ...STAGES.map(s => [s.k, s.label]), ['all', 'Tất cả']].map(([k, lb]) => {
            const n = k === 'open' ? leads.filter(l => OPEN_STAGES.includes(l.stage)).length
              : k === 'due' ? leads.filter(l => OPEN_STAGES.includes(l.stage) && l.next_follow_up && l.next_follow_up <= today).length
              : k === 'none' ? unassigned.length
              : k === 'all' ? leads.length : countStage(k)
            return (
              <button key={k} onClick={() => setFStage(k)} className={'s-chip' + (fStage === k ? ' on' : '')}>
                {lb}<span className="n num">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="s-panel">
          {!filtered.length ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">{leads.length ? 'Không có khách nào khớp bộ lọc' : 'Chưa có khách tiềm năng nào'}</p>
              <p className="text-xs text-gray-400 mt-1">{leads.length ? 'Thử bỏ bớt bộ lọc hoặc chọn "Tất cả"' : 'Bấm "+ Tiếp nhận khách" khi có khách liên hệ qua Facebook, Zalo, website, hotline…'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="s-tbl">
                <thead>
                  <tr>
                    <th className="l">Khách</th>
                    <th>Liên hệ</th>
                    <th>Kênh · Nhu cầu</th>
                    <th>Giai đoạn</th>
                    <th>Phụ trách</th>
                    <th>Hẹn chăm sóc</th>
                    <th>Báo giá</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const lastQ = l.quotes[0]
                    const overdue = OPEN_STAGES.includes(l.stage) && l.next_follow_up && l.next_follow_up < today
                    return (
                      <tr key={l.id} onClick={() => setOpenId(l.id)} className="s-click">
                        <td className="l max-w-[280px]">
                          <p className="font-medium text-gray-900 truncate">{l.company_name || l.contact_name}</p>
                          <p className="text-xs text-gray-400 truncate">{l.company_name && l.contact_name ? l.contact_name : ''}{l.tax_code ? (l.company_name && l.contact_name ? ' · ' : '') + 'MST ' + l.tax_code : ''}</p>
                        </td>
                        <td className="whitespace-nowrap text-gray-700 num">{l.phone || l.email || '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <p className="text-gray-700">{chMap.get(l.channel_id) || '—'}</p>
                          <p className="text-xs text-gray-400">{needLabel(l.need)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center"><StageChip stage={l.stage} /></td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {l.assigned_to ? <span className="text-gray-700">{staffMap.get(l.assigned_to) || '—'}</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">Chưa ai nhận</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {l.next_follow_up && OPEN_STAGES.includes(l.stage)
                            ? <span className={overdue ? 'text-red-600 font-medium' : l.next_follow_up === today ? 'text-amber-700 font-medium' : 'text-gray-700'}>
                                {overdue ? '⚠ ' : ''}{dmy(l.next_follow_up)}
                              </span>
                            : <span className="text-gray-300">—</span>}
                          <p className="text-xs text-gray-400">{l.lastContactAt ? 'liên hệ ' + dmy(isoVN(l.lastContactAt)) : 'chưa liên hệ'}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {lastQ ? (<><p className="num text-gray-900">{fmtMoney(lastQ.monthly_final)}</p><p className="text-xs text-gray-400">số {lastQ.quote_no}{l.quotes.length > 1 ? ' +' + (l.quotes.length - 1) : ''}</p></>)
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNew && <NewLeadModal res={res} onClose={() => setShowNew(false)} toast={toast}
        onSaved={(id) => { setShowNew(false); load(); setOpenId(id) }} onOpen={id => { setShowNew(false); setOpenId(id) }} />}
      {openId && <LeadDetailModal id={openId} res={res} staffMap={staffMap} chMap={chMap} toast={toast}
        onClose={() => { setOpenId(null); if (window.location.search) window.history.replaceState(null, '', '/sales') }} onChanged={load} />}
      {showChannels && <ChannelsModal res={res} toast={toast} onClose={() => setShowChannels(false)} onChanged={load} />}
      {toastNode}
      </div>
    </AppShell>
  )
}

// ── Cảnh báo trùng: khách tiềm năng cũ + công ty đang phục vụ ─────────────────
function DuplicateNotice({ dup, staffMap, onOpen }) {
  if (!dup || (!dup.leads?.length && !dup.clients?.length)) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm space-y-1.5">
      {dup.clients?.map(c => (
        <p key={c.id} className="text-amber-900">🏢 MST trùng công ty <b>đang phục vụ</b>: {c.name}{c.client_code ? ' (' + c.client_code + ')' : ''}{c.is_active === false ? ' — đã ngưng' : ''}</p>
      ))}
      {dup.leads?.map(l => (
        <p key={l.id} className="text-amber-900">
          👤 Trùng khách tiềm năng: <b>{l.company_name || l.contact_name}</b> · <StageChip stage={l.stage} /> · {staffMap.get(l.assigned_to) || 'chưa ai nhận'}
          {onOpen && <button type="button" onClick={() => onOpen(l.id)} className="ml-2 underline text-amber-800">Mở khách này</button>}
        </p>
      ))}
    </div>
  )
}

function NewLeadModal({ res, onClose, onSaved, onOpen, toast }) {
  const [f, setF] = useState({ company_name: '', contact_name: '', phone: '', email: '', tax_code: '', address: '',
    need: 'ke_toan', channel_id: '', source_note: '', assigned_to: res.me, next_follow_up: todayVN(), note: '' })
  const [dup, setDup] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const staffMap = new Map([...(res.staff || []), ...(res.otherStaff || [])].map(s => [s.id, s.full_name]))

  const check = async () => {
    if (!f.phone.trim() && !f.tax_code.trim()) { setDup(null); return }
    const r = await api('/api/admin/sales/leads?check=1&phone=' + encodeURIComponent(f.phone) + '&tax=' + encodeURIComponent(f.tax_code))
    if (r.ok) setDup(r.data)
  }

  const save = async () => {
    setSaving(true)
    const r = await api('/api/admin/sales/leads', { method: 'POST', body: f })
    setSaving(false)
    if (!r.ok) { toast(r.data.error || 'Chưa lưu được', true); return }
    toast('Đã tiếp nhận khách ' + (r.data.data.company_name || r.data.data.contact_name))
    onSaved(r.data.data.id)
  }

  return (
    <Modal title="Tiếp nhận khách mới" onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Hủy</button><button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Đang lưu…' : 'Lưu khách'}</button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Kênh khách đến *" className="sm:col-span-1">
          <select value={f.channel_id} onChange={e => set('channel_id', e.target.value)} className={inputCls}>
            <option value="">— Chọn kênh —</option>
            {res.channels.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Nhu cầu">
          <select value={f.need} onChange={e => set('need', e.target.value)} className={inputCls}>
            {NEEDS.map(n => <option key={n.k} value={n.k}>{n.label}</option>)}
          </select>
        </Field>
        <Field label="Chi tiết nguồn" hint="bài đăng, chiến dịch, người giới thiệu…" className="sm:col-span-2">
          <input value={f.source_note} onChange={e => set('source_note', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tên công ty / hộ kinh doanh" className="sm:col-span-2">
          <input value={f.company_name} onChange={e => set('company_name', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Người liên hệ"><input value={f.contact_name} onChange={e => set('contact_name', e.target.value)} className={inputCls} /></Field>
        <Field label="Số điện thoại"><input value={f.phone} onChange={e => set('phone', e.target.value)} onBlur={check} className={inputCls} inputMode="tel" /></Field>
        <Field label="Email"><input value={f.email} onChange={e => set('email', e.target.value)} className={inputCls} type="email" /></Field>
        <Field label="Mã số thuế"><input value={f.tax_code} onChange={e => set('tax_code', e.target.value)} onBlur={check} className={inputCls} /></Field>
        <Field label="Địa chỉ" className="sm:col-span-2"><input value={f.address} onChange={e => set('address', e.target.value)} className={inputCls} /></Field>
        {res.perms.all && (
          <Field label="Người phụ trách">
            <select value={f.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} className={inputCls}>
              {!res.staff.some(s => s.id === res.me) && <option value={res.me}>Tôi</option>}
              {res.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Hẹn chăm sóc">
          <input type="date" value={f.next_follow_up} onChange={e => set('next_follow_up', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Ghi chú ban đầu" hint="khách hỏi gì, mong muốn gì" className="sm:col-span-2">
          <textarea rows={3} value={f.note} onChange={e => set('note', e.target.value)} className={inputCls} />
        </Field>
        <div className="sm:col-span-2"><DuplicateNotice dup={dup} staffMap={staffMap} onOpen={onOpen} /></div>
      </div>
    </Modal>
  )
}

function LeadDetailModal({ id, res, staffMap, chMap, toast, onClose, onChanged }) {
  const router = useRouter()
  const [d, setD] = useState(null)
  const [edit, setEdit] = useState(null)
  const [act, setAct] = useState({ kind: 'goi', content: '', next_follow_up: '' })
  const [lost, setLost] = useState(null) // lý do khi chuyển "Không thành"
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0) // tăng lên để tải lại khách sau mỗi lần sửa

  useEffect(() => {
    let off = false
    api('/api/admin/sales/leads?id=' + id).then(r => {
      if (off) return
      if (!r.ok) { toast(r.data.error || 'Không mở được khách', true); onClose(); return }
      setD(r.data)
      setEdit(null)
    })
    return () => { off = true }
  }, [id, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const load = async () => setTick(t => t + 1)

  if (!d) return <Modal title="Khách tiềm năng" onClose={onClose}><p className="text-sm text-gray-400 py-6 text-center">Đang tải…</p></Modal>
  const l = d.lead
  const today = todayVN()

  const patch = async (body, okMsg) => {
    setBusy(true)
    const r = await api('/api/admin/sales/leads', { method: 'PATCH', body: { id: l.id, ...body } })
    setBusy(false)
    if (!r.ok) { toast(r.data.error || 'Chưa lưu được', true); return false }
    if (okMsg) toast(okMsg)
    await load(); onChanged()
    return true
  }

  const addAct = async () => {
    setBusy(true)
    const r = await api('/api/admin/sales/lead-activities', { method: 'POST', body: { lead_id: l.id, ...act } })
    setBusy(false)
    if (!r.ok) { toast(r.data.error || 'Chưa ghi được', true); return }
    toast(act.next_follow_up ? 'Đã ghi nhật ký · hẹn ' + dmy(act.next_follow_up) : 'Đã ghi nhật ký chăm sóc')
    setAct({ kind: act.kind, content: '', next_follow_up: '' })
    await load(); onChanged()
  }

  const del = async () => {
    if (!window.confirm('Xoá khách "' + (l.company_name || l.contact_name) + '" khỏi danh sách? Chỉ nên xoá khi nhập trùng/nhầm.')) return
    const r = await api('/api/admin/sales/leads?id=' + l.id, { method: 'DELETE' })
    if (!r.ok) { toast(r.data.error || 'Chưa xoá được', true); return }
    toast('Đã xoá khách'); onChanged(); onClose()
  }

  const canEdit = d.canEdit
  const E = edit
  const setE = (k, v) => setEdit(p => ({ ...p, [k]: v }))

  return (
    <Modal wide title={(l.company_name || l.contact_name) + ''} onClose={onClose}
      footer={<>
        {canEdit && !d.quotes.length && <button onClick={del} className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 mr-auto">Xoá khách</button>}
        {canEdit && l.stage !== 'that_bai' && l.stage !== 'chot' &&
          <button onClick={() => router.push('/sales/quotes?new=1&lead=' + l.id)} className={btnPrimary}>🧾 Lập báo giá</button>}
        <button onClick={onClose} className={btnGhost}>Đóng</button>
      </>}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Cột trái: thông tin + giai đoạn */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <StageChip stage={l.stage} />
            <span className="text-xs text-gray-500">từ {dmy(isoVN(l.stage_changed_at))}</span>
            {!l.assigned_to && canEdit && (
              <button onClick={() => patch({ assigned_to: res.me }, 'Đã nhận chăm sóc khách')} disabled={busy}
                className="text-xs px-2 py-1 rounded-lg bg-orange-100 text-orange-800 hover:bg-orange-200">✋ Nhận chăm sóc</button>
            )}
          </div>
          {l.stage === 'that_bai' && l.lost_reason && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">Lý do không thành: {l.lost_reason}</p>}

          {!E ? (
            <div className="text-sm space-y-1.5">
              <Row k="Người liên hệ" v={l.contact_name} />
              <Row k="Điện thoại" v={l.phone && <a href={'tel:' + l.phone} className="text-[#2A6CA8] underline">{l.phone}</a>} />
              <Row k="Email" v={l.email} />
              <Row k="Mã số thuế" v={l.tax_code} />
              <Row k="Địa chỉ" v={l.address} />
              <Row k="Kênh" v={(chMap.get(l.channel_id) || '—') + (l.source_note ? ' · ' + l.source_note : '')} />
              <Row k="Nhu cầu" v={needLabel(l.need)} />
              <Row k="Phụ trách" v={staffMap.get(l.assigned_to) || 'Chưa ai nhận'} />
              <Row k="Tiếp nhận" v={dmyTime(l.created_at)} />
              {l.note && <Row k="Ghi chú" v={<span className="whitespace-pre-wrap">{l.note}</span>} />}
              {canEdit && <button onClick={() => setEdit({ ...l })} className="mt-2 text-sm text-[#2A6CA8] underline">Sửa thông tin</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              <Field label="Tên công ty"><input value={E.company_name || ''} onChange={e => setE('company_name', e.target.value)} className={inputCls} /></Field>
              <Field label="Người liên hệ"><input value={E.contact_name || ''} onChange={e => setE('contact_name', e.target.value)} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Điện thoại"><input value={E.phone || ''} onChange={e => setE('phone', e.target.value)} className={inputCls} /></Field>
                <Field label="Mã số thuế"><input value={E.tax_code || ''} onChange={e => setE('tax_code', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Email"><input value={E.email || ''} onChange={e => setE('email', e.target.value)} className={inputCls} /></Field>
              <Field label="Địa chỉ"><input value={E.address || ''} onChange={e => setE('address', e.target.value)} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Kênh">
                  <select value={E.channel_id || ''} onChange={e => setE('channel_id', e.target.value)} className={inputCls}>
                    {res.channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Nhu cầu">
                  <select value={E.need || ''} onChange={e => setE('need', e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {NEEDS.map(n => <option key={n.k} value={n.k}>{n.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Chi tiết nguồn"><input value={E.source_note || ''} onChange={e => setE('source_note', e.target.value)} className={inputCls} /></Field>
              {res.perms.all && (
                <Field label="Người phụ trách">
                  <select value={E.assigned_to || ''} onChange={e => setE('assigned_to', e.target.value)} className={inputCls}>
                    <option value="">— Chưa giao —</option>
                    {res.staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    {E.assigned_to && !res.staff.some(s => s.id === E.assigned_to) && <option value={E.assigned_to}>{staffMap.get(E.assigned_to) || 'Người cũ'}</option>}
                  </select>
                </Field>
              )}
              <Field label="Ghi chú"><textarea rows={3} value={E.note || ''} onChange={e => setE('note', e.target.value)} className={inputCls} /></Field>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => patch({
                  company_name: E.company_name, contact_name: E.contact_name, phone: E.phone, tax_code: E.tax_code, email: E.email,
                  address: E.address, channel_id: E.channel_id, need: E.need, source_note: E.source_note, note: E.note,
                  ...(res.perms.all ? { assigned_to: E.assigned_to || null } : {}),
                }, 'Đã lưu thông tin khách')} className={btnPrimary}>Lưu</button>
                <button onClick={() => setEdit(null)} className={btnGhost}>Hủy</button>
              </div>
            </div>
          )}

          <DuplicateNotice dup={d.duplicates} staffMap={staffMap} />

          {canEdit && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-600 mb-1.5">Chuyển giai đoạn</p>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.filter(s => s.k !== l.stage && s.k !== 'chot').map(s => (
                  <button key={s.k} disabled={busy}
                    onClick={() => s.k === 'that_bai' ? setLost('') : patch({ stage: s.k }, 'Đã chuyển sang ' + s.label)}
                    className={'text-xs px-2.5 py-1 rounded-lg border ' + s.cls}>{s.label}</button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">“Chốt HĐ” tự chuyển khi báo giá của khách được đổi sang Chốt HĐ.</p>
              {lost !== null && (
                <div className="mt-2 space-y-2">
                  <input autoFocus value={lost} onChange={e => setLost(e.target.value)} placeholder="Lý do không thành (giá cao, chọn bên khác, chưa có nhu cầu…)" className={inputCls} />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={async () => { if (await patch({ stage: 'that_bai', lost_reason: lost }, 'Đã chuyển Không thành')) setLost(null) }} className={btnPrimary}>Xác nhận</button>
                    <button onClick={() => setLost(null)} className={btnGhost}>Hủy</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Báo giá của khách</p>
            {!d.quotes.length ? <p className="text-sm text-gray-400">Chưa có báo giá</p> : d.quotes.map(qq => (
              <Link key={qq.id} href={'/sales/quotes?id=' + qq.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-300 mb-1.5">
                <span><b className="text-[#2A6CA8] tabular-nums">{qq.quote_no}</b> <span className="text-gray-400">· {dmy(qq.quote_date)}</span></span>
                <span className="tabular-nums">{fmtMoney(qq.monthly_final)}/tháng</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Cột phải: nhật ký chăm sóc */}
        <div className="lg:col-span-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">Nhật ký chăm sóc</p>
          {canEdit && l.stage !== 'chot' && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
              <div className="flex flex-wrap gap-1">
                {ACT_KINDS.map(k => (
                  <button key={k.k} onClick={() => setAct(a => ({ ...a, kind: k.k }))}
                    className={'text-xs px-2.5 py-1 rounded-lg border ' + (act.kind === k.k ? 'bg-[#2A6CA8] text-white border-[#2A6CA8]' : 'bg-white text-gray-600 border-gray-200')}>{k.label}</button>
                ))}
              </div>
              <textarea rows={2} value={act.content} onChange={e => setAct(a => ({ ...a, content: e.target.value }))}
                placeholder="Đã trao đổi gì với khách, khách phản hồi thế nào…" className={inputCls} />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">Hẹn lần sau:</span>
                {[[1, 'Mai'], [3, '3 ngày'], [7, '1 tuần']].map(([n, lb]) => (
                  <button key={n} onClick={() => setAct(a => ({ ...a, next_follow_up: addDaysISO(today, n) }))}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-400">{lb}</button>
                ))}
                <input type="date" value={act.next_follow_up} onChange={e => setAct(a => ({ ...a, next_follow_up: e.target.value }))}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white" />
                <button onClick={addAct} disabled={busy || !act.content.trim()} className={btnPrimary + ' ml-auto !py-1.5'}>Ghi nhật ký</button>
              </div>
              {l.next_follow_up && <p className="text-xs text-gray-500">Đang hẹn: <b className={l.next_follow_up < today ? 'text-red-600' : ''}>{dmy(l.next_follow_up)}</b> — ghi nhật ký mới sẽ thay ngày hẹn này (để trống = không hẹn nữa).</p>}
            </div>
          )}
          <div className="space-y-2">
            {!d.activities.length && <p className="text-sm text-gray-400">Chưa có hoạt động nào</p>}
            {d.activities.map(a => (
              <div key={a.id} className={'rounded-xl px-3 py-2 border ' + (a.kind === 'he_thong' ? 'border-transparent bg-gray-50/70' : 'border-gray-100 bg-white')}>
                <div className="flex items-center justify-between gap-2">
                  <span className={'text-xs ' + (a.kind === 'he_thong' ? 'text-gray-400' : 'text-gray-600 font-medium')}>{actLabel(a.kind)}</span>
                  <span className="text-xs text-gray-400">{a.staffName ? a.staffName + ' · ' : ''}{dmyTime(a.created_at)}</span>
                </div>
                <p className={'text-sm mt-0.5 whitespace-pre-wrap ' + (a.kind === 'he_thong' ? 'text-gray-500' : 'text-gray-900')}>{a.content}</p>
                {a.next_follow_up && <p className="text-xs text-amber-700 mt-0.5">Hẹn chăm sóc: {dmy(a.next_follow_up)}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-400 w-24 flex-shrink-0">{k}</span>
      <span className="text-gray-900 min-w-0 break-words">{v || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

function ChannelsModal({ res, toast, onClose, onChanged }) {
  const [list, setList] = useState(res.channels)
  const [name, setName] = useState('')
  const reload = async () => { const r = await api('/api/admin/sales/channels'); if (r.ok) setList(r.data.data); onChanged() }
  const add = async () => {
    const r = await api('/api/admin/sales/channels', { method: 'POST', body: { name } })
    if (!r.ok) { toast(r.data.error, true); return }
    setName(''); reload()
  }
  const upd = async (id, body) => {
    const r = await api('/api/admin/sales/channels', { method: 'PATCH', body: { id, ...body } })
    if (!r.ok) { toast(r.data.error, true); return }
    reload()
  }
  return (
    <Modal title="Kênh truyền thông" onClose={onClose} footer={<button onClick={onClose} className={btnGhost}>Đóng</button>}>
      <p className="text-xs text-gray-500 mb-3">Kênh đã ẩn không chọn được cho khách mới, nhưng khách cũ vẫn giữ đúng tên kênh trong báo cáo.</p>
      <div className="space-y-1.5 mb-3">
        {list.map(c => (
          <div key={c.id} className="flex items-center gap-2">
            <input defaultValue={c.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== c.name) upd(c.id, { name: e.target.value }) }}
              className={inputCls + (c.is_active ? '' : ' text-gray-400 line-through')} />
            <button onClick={() => upd(c.id, { is_active: !c.is_active })} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 whitespace-nowrap">
              {c.is_active ? 'Ẩn' : 'Hiện lại'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên kênh mới (VD: YouTube)" className={inputCls} />
        <button onClick={add} disabled={!name.trim()} className={btnPrimary}>Thêm</button>
      </div>
    </Modal>
  )
}
