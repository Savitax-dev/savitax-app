'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import {
  SECTORS, AREA_SURCHARGE, EXTRA_SERVICES, HCNS_PER_HEAD, CONTRACT_STATES, PRICE_STATES,
  emptySurvey, syncDocs, priceQuote, canExportPrice,
} from '@/lib/salesPricing'
import { readSurveyDocx, applySurveyRows } from '@/lib/salesSurvey'
import {
  PeriodFilter, defaultPeriod, inPeriod, periodLabel, StatCard, Field, inputCls, btnPrimary, btnGhost,
  NumInput, useToast, api, fmt, fmtMoney, dmy, dmyTime, StageChip, GOLD, Modal, PageHead,
} from '../_ui'

const DRAFT_KEY = 'svt_sales_quote_draft_v1'
const readDraft = () => { try { const o = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return o && o.d && o.d.survey ? o : null } catch (_) { return null } }
const writeDraft = d => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ t: Date.now(), d })) } catch (_) {} }
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch (_) {} }

// Tình trạng chăm sóc (giai đoạn của khách, suy ra ở server — lib/salesScope careOf)
const CARE = [
  { k: 'cham_soc', label: 'Đang chăm sóc', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { k: 'ky_hd',    label: 'Ký hợp đồng',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { k: 'that_bai', label: 'Thất bại',      cls: 'bg-gray-100 text-gray-600 border-gray-200' },
]

function PriceChip({ status }) {
  const p = PRICE_STATES[status] || PRICE_STATES.ok
  return <span className={'inline-block text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ' + p.cls}>{p.label}</span>
}

async function downloadWord(id, toast) {
  const r = await api('/api/admin/sales/quotes/export', { method: 'POST', body: { id } })
  if (!r.ok) { toast(r.data.error || 'Chưa xuất được file Word', true); return null }
  const bin = atob(r.data.base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  const a = document.createElement('a')
  a.href = url; a.download = r.data.fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  if (r.data.drive?.ok) toast('Đã tải file Word và nộp vào thư mục Drive của báo giá')
  else toast('Đã tải file Word. ' + (r.data.drive?.warning || ''), !!r.data.drive?.warning)
  return r.data
}

export default function SalesQuotesPage() {
  const router = useRouter()
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(defaultPeriod)
  const [onlyPending, setOnlyPending] = useState(false)
  const [editor, setEditor] = useState(null) // { mode:'new'|'edit', id?, leadId? , restore? }
  const [draftInfo, setDraftInfo] = useState(null)
  const [qText, setQText] = useState('')
  const [fCare, setFCare] = useState('')
  const [lostFor, setLostFor] = useState(null)
  const [lostText, setLostText] = useState('')
  const [toastNode, toast] = useToast()

  const load = useCallback(async () => {
    const r = await api('/api/admin/sales/quotes')
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { router.push('/dashboard'); return }
    if (!r.ok) { toast(r.data.error || 'Không tải được danh sách', true); setLoading(false); return }
    setRes(r.data); setLoading(false)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      const { data: sd } = await createClient().auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      await load()
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('id')) setEditor({ mode: 'edit', id: sp.get('id') })
      else if (sp.get('new')) setEditor({ mode: 'new', leadId: sp.get('lead') || null })
      setDraftInfo(readDraft())
    }
    init()
  }, [router, load])

  const closeEditor = (reload) => {
    setEditor(null)
    window.history.replaceState(null, '', '/sales/quotes')
    setDraftInfo(readDraft())
    if (reload) load()
    window.scrollTo(0, 0)
  }

  const setContract = async (q, st) => {
    const r = await api('/api/admin/sales/quotes', { method: 'PATCH', body: { id: q.id, action: 'contract', contract_status: st } })
    if (!r.ok) { toast(r.data.error || 'Chưa đổi được trạng thái', true); load(); return }
    toast('Báo giá ' + q.quote_no + ': ' + CONTRACT_STATES.find(c => c[0] === st)[1])
    load()
  }
  // Tình trạng chăm sóc — "Thất bại" phải ghi lý do nên mở hộp hỏi trước, không đổi ngay.
  const setCare = async (q, care, lostReason) => {
    if (care === 'that_bai' && lostReason === undefined) { setLostFor(q); setLostText(''); return }
    const r = await api('/api/admin/sales/quotes', { method: 'PATCH', body: { id: q.id, action: 'care', care, lost_reason: lostReason } })
    if (!r.ok) { toast(r.data.error || 'Chưa đổi được tình trạng', true); load(); return }
    setLostFor(null)
    toast((q.company_name || 'Khách') + ': ' + CARE.find(c => c.k === care).label)
    load()
  }
  const del = async (q) => {
    if (!window.confirm('Xoá báo giá số ' + q.quote_no + ' – ' + (q.company_name || '') + '? Số báo giá này sẽ không được dùng lại.')) return
    const r = await api('/api/admin/sales/quotes?id=' + q.id, { method: 'DELETE' })
    if (!r.ok) { toast(r.data.error || 'Chưa xoá được', true); return }
    toast('Đã xoá báo giá ' + q.quote_no); load()
  }

  const all = res?.quotes || []
  const chMap = useMemo(() => new Map((res?.channels || []).map(c => [c.id, c.name])), [res])

  if (loading) return <AppShell><div className="sales-ui flex items-center justify-center"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
  if (!res) return <AppShell><div className="sales-ui p-8 text-sm text-gray-500">Chưa tải được dữ liệu. {toastNode}</div></AppShell>

  if (editor) {
    return (
      <AppShell>
        <div className="sales-ui">
          <QuoteEditor key={(editor.id || 'new') + (editor.restore ? '-r' : '')} editor={editor} res={res} toast={toast}
            onClose={closeEditor} onSavedNew={(id) => { setEditor({ mode: 'edit', id }); window.history.replaceState(null, '', '/sales/quotes?id=' + id); load() }} />
          {toastNode}
        </div>
      </AppShell>
    )
  }

  // Tìm theo số báo giá, tên công ty, MST, người liên hệ, SĐT (bỏ dấu cách/chấm khi so số).
  const needle = qText.trim().toLowerCase()
  const needleDigits = needle.replace(/\D/g, '')
  const match = q => {
    if (!needle) return true
    const hay = [q.quote_no, q.company_name, q.contact, q.author_name].join(' ').toLowerCase()
    const digits = [q.tax_code, q.phone].map(x => String(x || '').replace(/\D/g, '')).join(' ')
    return hay.includes(needle) || (needleDigits.length >= 3 && digits.includes(needleDigits))
  }

  const pendingAll = all.filter(q => q.price_status === 'pending')
  const inKy = all.filter(q => inPeriod(q.quote_date, period)).filter(q => !onlyPending || q.price_status === 'pending').filter(match)
  const qs = inKy.filter(q => !fCare || q.care === fCare)
  const pl = periodLabel(period)
  const pending = inKy.filter(q => q.price_status === 'pending').length
  const sent = inKy.filter(q => q.contract_status === 'sent' || q.contract_status === 'signed').length
  const signed = inKy.filter(q => q.contract_status === 'signed').length
  const sum = inKy.reduce((a, q) => a + (Number(q.monthly_final) || 0), 0)
  const sumSigned = inKy.filter(q => q.contract_status === 'signed').reduce((a, q) => a + (Number(q.monthly_final) || 0), 0)
  // Mọi cột canh giữa cả tiêu đề lẫn nội dung, riêng cột Khách hàng canh trái — tiêu đề và số liệu
  // luôn thẳng một hàng (trước đây trộn trái/phải nên nhìn lộn xộn).
  const th = ''
  const td = ''

  return (
    <AppShell>
      <div className="sales-ui">
      <div className="px-4 md:px-8 py-5">
        <div className="mb-4">
          <PageHead title="Báo giá" sub="Phí tự tính theo biểu phí Savitax, số báo giá tự đánh theo ngày, xuất Word đúng mẫu SVT.MB03">
            {res.perms.view && <button onClick={() => setEditor({ mode: 'new' })} className={btnPrimary}>+ Tạo báo giá mới</button>}
          </PageHead>
        </div>

        {draftInfo && (draftInfo.d.survey.company || '').trim() && (
          <div className="flex items-center gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Còn một báo giá đang soạn dở</p>
              <p className="text-xs text-amber-800">{draftInfo.d.survey.company} · lưu tạm lúc {new Date(draftInfo.t).toLocaleString('vi-VN')}</p>
            </div>
            <button onClick={() => setEditor({ mode: draftInfo.d.id ? 'edit' : 'new', id: draftInfo.d.id, restore: true })} className={btnPrimary}>Mở lại</button>
            <button onClick={() => { clearDraft(); setDraftInfo(null) }} className={btnGhost}>Bỏ</button>
          </div>
        )}

        {res.perms.approve && pendingAll.length > 0 && (
          <button onClick={() => { setOnlyPending(v => !v); setPeriod(p => ({ ...p, mode: 'all' })) }}
            className="w-full text-left flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 hover:border-red-300">
            <span className="text-2xl">🔏</span>
            <span className="flex-1 text-sm text-red-900"><b>{pendingAll.length} báo giá</b> đang chờ Giám đốc duyệt mức phí đề xuất khác biểu phí</span>
            <span className="text-sm text-red-700 underline">{onlyPending ? 'Xem tất cả' : 'Lọc ra để duyệt'}</span>
          </button>
        )}

        {/* Ô tìm giãn hết phần còn trống, bộ lọc kỳ dồn về cuối hàng */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <input value={qText} onChange={e => setQText(e.target.value)} placeholder="Tìm số BG, tên công ty, MST, người liên hệ, SĐT…"
            className="s-input !w-auto flex-1 min-w-[260px]" />
          {onlyPending && <span className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-800">Đang lọc: chờ duyệt</span>}
          <div className="ml-auto"><PeriodFilter value={period} onChange={p => { setPeriod(p); setOnlyPending(false) }} /></div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <StatCard label="Tổng báo giá" value={inKy.length} foot={pl + (pending ? ' · ' + pending + ' chờ duyệt giá' : '')} tone="red" />
          <StatCard label="Hợp đồng đã gửi" value={sent} foot={inKy.length ? Math.round(sent * 100 / inKy.length) + '% số báo giá' : '—'} tone="amb" />
          <StatCard label="Hợp đồng đã chốt" value={signed} foot={sent ? Math.round(signed * 100 / sent) + '% số đã gửi' : '—'} tone="grn" />
          <StatCard label="Tổng phí báo giá" value={fmt(sum)} unit="đ/tháng" foot={pl} tone="blue" />
          <StatCard label="Phí đã chốt" value={fmt(sumSigned)} unit="đ/tháng" foot={sum ? Math.round(sumSigned * 100 / sum) + '% tổng phí báo giá' : 'chưa có hợp đồng chốt'} tone="gold" />
        </div>

        {/* Đếm theo tình trạng chăm sóc — bấm để lọc */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {[{ k: '', label: 'Tất cả', cls: 'bg-white text-gray-700 border-gray-200' }, ...CARE].map(c => {
            const n = c.k ? inKy.filter(q => q.care === c.k).length : inKy.length
            const on = fCare === c.k
            return (
              <button key={c.k || 'all'} onClick={() => setFCare(c.k)} className={'s-chip' + (on ? ' on' : '')}>
                {c.label}<span className="n num">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="s-panel">
          {!qs.length ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">{all.length ? 'Không có báo giá nào khớp bộ lọc' : 'Chưa có báo giá nào'}</p>
              <p className="text-xs text-gray-400 mt-1">{all.length ? 'Đổi từ khoá tìm kiếm, chọn kỳ khác hoặc bấm “Tất cả”' : 'Bấm “+ Tạo báo giá mới”, nhập khảo sát hoặc tải file khảo sát của khách lên'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="s-tbl">
                <thead>
                  <tr>
                    <th className={th}>Số</th>
                    <th className="l">Khách hàng</th>
                    <th className={th}>Ngày</th>
                    <th className={th}>Phí/tháng</th>
                    <th className={th}>Lưu ý</th>
                    <th className={th}>Tình trạng chăm sóc</th>
                    <th className={th}>Trạng thái HĐ</th>
                    <th className={th}>Người lập</th>
                    <th className={th}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {qs.map(q => {
                    const exportable = canExportPrice(q.price_status)
                    const careInfo = CARE.find(c => c.k === q.care) || CARE[0]
                    return (
                      <tr key={q.id}>
                        <td className={td}><button onClick={() => setEditor({ mode: 'edit', id: q.id })} className="font-semibold text-[#2A6CA8] num hover:underline">{q.quote_no}</button></td>
                        <td className="l min-w-[240px] max-w-[320px]">
                          <p className="text-gray-900 font-medium truncate">{q.company_name || '—'}</p>
                          <p className="text-xs text-gray-500 truncate">{q.tax_code ? 'MST ' + q.tax_code : 'Chưa có MST'}{q.channel_id ? ' · ' + chMap.get(q.channel_id) : ''}</p>
                          {(q.contact || q.phone) && (
                            <p className="text-xs text-gray-500 truncate">👤 {[q.contact, q.phone].filter(Boolean).join(' · ')}</p>
                          )}
                        </td>
                        <td className={td + ' whitespace-nowrap text-gray-700'}>{dmy(q.quote_date)}</td>
                        <td className="num whitespace-nowrap">
                          {fmtMoney(q.monthly_final)}
                          {q.override_on && <p className="text-xs text-gray-400 line-through">{fmtMoney(q.standard_monthly)}</p>}
                        </td>
                        <td className={td}><PriceChip status={q.price_status} /></td>
                        <td className={td}>
                          <select value={q.care} disabled={!q.canEdit || !q.lead_id} onChange={e => setCare(q, e.target.value)}
                            title={q.care === 'that_bai' && q.lost_reason ? 'Lý do: ' + q.lost_reason : undefined}
                            className={'px-2 py-1 rounded-lg text-xs border ' + careInfo.cls}>
                            {CARE.map(c => <option key={c.k} value={c.k} disabled={c.k === 'ky_hd' && !exportable}>{c.label}</option>)}
                          </select>
                          {q.care === 'that_bai' && q.lost_reason && <p className="text-[11px] text-gray-400 mt-0.5 max-w-[140px] mx-auto truncate">{q.lost_reason}</p>}
                        </td>
                        <td className={td}>
                          <select value={q.contract_status} disabled={!q.canEdit} onChange={e => setContract(q, e.target.value)}
                            className={'px-2 py-1 rounded-lg text-xs border ' + (q.contract_status === 'signed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : q.contract_status === 'sent' ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-white border-gray-200 text-gray-700')}>
                            {CONTRACT_STATES.map(([k, lb]) => <option key={k} value={k} disabled={k !== 'draft' && !exportable}>{lb}</option>)}
                          </select>
                        </td>
                        <td className={td + ' text-gray-500 whitespace-nowrap'}>{q.author_name || '—'}</td>
                        <td className={td + ' whitespace-nowrap'}>
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => setEditor({ mode: 'edit', id: q.id })} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Mở</button>
                            {exportable && (q.canEdit || res.perms.approve) && (
                              <button onClick={() => downloadWord(q.id, toast)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Word</button>
                            )}
                            {q.drive_folder_url && <a href={q.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Drive</a>}
                            {q.canEdit && q.contract_status !== 'signed' && (
                              <button onClick={() => del(q)} className="text-xs px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50">Xoá</button>
                            )}
                          </div>
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

      {lostFor && (
        <Modal title={'Thất bại — ' + (lostFor.company_name || '')} onClose={() => setLostFor(null)}
          footer={<>
            <button onClick={() => setLostFor(null)} className={btnGhost}>Hủy</button>
            <button onClick={() => setCare(lostFor, 'that_bai', lostText)} disabled={!lostText.trim()} className={btnPrimary}>Xác nhận thất bại</button>
          </>}>
          <Field label="Lý do khách không ký" hint="dùng để thống kê lý do mất khách">
            <input autoFocus value={lostText} onChange={e => setLostText(e.target.value)} className={inputCls}
              placeholder="VD: giá cao, chọn đơn vị khác, chưa có nhu cầu…" />
          </Field>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['Giá cao', 'Chọn đơn vị khác', 'Chưa có nhu cầu', 'Không liên lạc được'].map(r => (
              <button key={r} onClick={() => setLostText(r)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-gray-400">{r}</button>
            ))}
          </div>
        </Modal>
      )}
      {toastNode}
      </div>
    </AppShell>
  )
}

// Khung một bước nhập liệu. PHẢI khai báo ngoài QuoteEditor: khai báo bên trong thì mỗi lần gõ
// phím React coi là component mới, dựng lại cả khối và ô đang gõ mất con trỏ.
// Tiêu đề dạng "Bước 2 · Thông tin khách hàng" tách thành nhãn BƯỚC 2 + tên bước.
function Card({ title, children }) {
  const m = /^Bước (\d+) · (.*)$/.exec(title)
  return (
    <div className="s-panel">
      <div className="s-card-h">{m && <span className="st">BƯỚC {m[1]}</span>}{m ? m[2] : title}</div>
      <div className="s-card-b">{children}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
function QuoteEditor({ editor, res, toast, onClose, onSavedNew }) {
  const [d, setD] = useState(null)       // bản đang soạn
  const [meta, setMeta] = useState(null) // thông tin báo giá đã lưu (số, trạng thái, quyền…)
  const [leads, setLeads] = useState(null)
  const [file, setFile] = useState(null)
  const [importMsg, setImportMsg] = useState(null)
  const [dup, setDup] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [review, setReview] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      if (editor.restore) {
        const dr = readDraft()
        if (dr) { setD(dr.d); setDirty(true) }
      }
      if (editor.mode === 'edit') {
        const r = await api('/api/admin/sales/quotes?id=' + editor.id)
        if (!r.ok) { toast(r.data.error || 'Không mở được báo giá', true); onClose(false); return }
        const q = r.data.data
        setMeta({ ...q, canEdit: r.data.canEdit, lead: r.data.lead, driveReady: r.data.driveReady, driveRootUrl: r.data.driveRootUrl })
        if (!editor.restore) setD({
          id: q.id, lead_id: q.lead_id, survey: { ...emptySurvey(), ...q.survey },
          override: { on: !!q.override_on, amount: Number(q.override_amount) || 0, reason: q.override_reason || '' },
        })
      } else {
        setMeta({ canEdit: true, driveReady: res.driveReady })
        if (!editor.restore) setD({ id: null, lead_id: editor.leadId || null, channel_id: '', source_note: '', survey: emptySurvey(), override: { on: false, amount: 0, reason: '' } })
        const r = await api('/api/admin/sales/leads')
        if (r.ok) {
          setLeads(r.data)
          // Lập từ trang Khách tiềm năng: điền sẵn thông tin khách vào phiếu.
          if (editor.leadId && !editor.restore) {
            const l = r.data.leads.find(x => x.id === editor.leadId)
            if (l) setD(p => ({ ...p, survey: { ...p.survey, company: l.company_name || '', mst: l.tax_code || '', contact: l.contact_name || '', phone: l.phone || '', email: l.email || '', address: l.address || '' } }))
          }
        }
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Lưu nháp tạm trên máy — trang tải lại / lỡ đóng tab vẫn mở lại được đúng chỗ đang làm.
  useEffect(() => {
    if (!d || !dirty) return
    const t = setTimeout(() => writeDraft(d), 600)
    return () => clearTimeout(t)
  }, [d, dirty])

  const priced = useMemo(() => d ? priceQuote(d.survey, d.override) : null, [d])

  if (!d || !meta) return <div className="p-8 text-sm text-gray-400">Đang mở báo giá…</div>

  const isNew = !d.id
  const locked = !meta.canEdit || meta.contract_status === 'signed'
  const s = d.survey
  const upd = fn => { setD(p => { const n = structuredClone(p); fn(n); syncDocs(n.survey); return n }); setDirty(true) }
  const setS = (k, v) => upd(n => { n.survey[k] = v })
  const f = priced.fees

  const importFile = async (fl) => {
    if (!fl) return
    if (!/\.docx$/i.test(fl.name)) { setImportMsg({ bad: true, text: 'Chỉ nhận file Word .docx (mẫu SVT.MB01)' }); return }
    try {
      const rows = readSurveyDocx(new Uint8Array(await fl.arrayBuffer()))
      const next = structuredClone(d.survey)
      const got = applySurveyRows(rows, next)
      if (!got.length) throw new Error('Không nhận ra ô nào trong file. Kiểm tra lại có đúng mẫu SVT.MB01 không.')
      syncDocs(next)
      setD(p => ({ ...p, survey: next })); setDirty(true)
      setFile(fl)
      setImportMsg({ bad: false, text: 'Đã điền ' + got.length + ' ô từ file: ' + got.join(', ') + '. Kiểm tra lại rồi bổ sung ô còn thiếu.' })
      if (next.mst) checkDup(next.mst)
    } catch (e) {
      setImportMsg({ bad: true, text: 'Chưa đọc được file: ' + (e.message || 'lỗi không xác định') })
    }
  }

  const checkDup = async (mst) => {
    if (!isNew || d.lead_id || !String(mst || '').trim()) { setDup(null); return }
    const r = await api('/api/admin/sales/leads?check=1&tax=' + encodeURIComponent(mst))
    if (r.ok) setDup(r.data)
  }

  const save = async () => {
    if (!s.company.trim()) { toast('Nhập tên công ty khách hàng trước đã', true); return }
    if (d.override.on && !d.override.reason.trim()) { toast('Ghi lý do đề xuất mức phí khác', true); return }
    if (isNew && !d.lead_id && !d.channel_id) { toast('Chọn kênh khách đến, hoặc chọn khách tiềm năng đã có', true); return }
    const payload = isNew
      ? { lead_id: d.lead_id, channel_id: d.channel_id, source_note: d.source_note, survey: s, override: d.override }
      : { id: d.id, action: 'update', survey: s, override: d.override }
    let body = payload
    if (file) { body = new FormData(); body.append('payload', JSON.stringify(payload)); body.append('surveyFile', file) }
    setSaving(true)
    const r = await api('/api/admin/sales/quotes', { method: isNew ? 'POST' : 'PATCH', body })
    setSaving(false)
    if (r.status === 409 && r.data.duplicateLead) {
      const l = r.data.duplicateLead
      if (window.confirm('MST này đã có khách tiềm năng "' + (l.company_name || '') + '". Gắn báo giá vào khách đó?')) {
        upd(n => { n.lead_id = l.id })
        toast('Đã chọn khách tiềm năng có sẵn — bấm Lưu lần nữa')
      }
      return
    }
    if (!r.ok) { toast(r.data.error || 'Chưa lưu được báo giá', true); return }
    clearDraft(); setDirty(false); setFile(null)
    const q = r.data.data
    const dv = r.data.drive || {}
    toast((isNew ? 'Đã lưu báo giá số ' : 'Đã lưu thay đổi báo giá ') + q.quote_no +
      (q.price_status === 'pending' ? ' — chờ Giám đốc duyệt giá, duyệt xong mới nộp file báo giá' : '') +
      (dv.filed?.length ? '. Đã nộp ' + dv.filed.join(' + ') + ' vào Drive' : '') +
      (dv.warning ? '. ' + dv.warning : ''), !!dv.warning)
    if (isNew) onSavedNew(q.id)
    else {
      setMeta(m => ({ ...m, ...q }))
    }
  }

  const doReview = async (decision) => {
    const r = await api('/api/admin/sales/quotes', { method: 'PATCH', body: { id: d.id, action: 'review', decision, note: review } })
    if (!r.ok) { toast(r.data.error || 'Chưa duyệt được', true); return }
    toast(decision === 'approve'
      ? 'Đã duyệt mức phí' + (r.data.drive?.filed?.length ? ' và nộp file báo giá vào Drive' : r.data.drive?.warning ? '. ' + r.data.drive.warning : '')
      : 'Đã từ chối mức phí', !!(decision === 'approve' && r.data.drive?.warning))
    setMeta(m => ({ ...m, price_status: r.data.price_status, review_note: review || null,
      drive_folder_url: r.data.drive?.folderUrl || m.drive_folder_url }))
    setReview('')
  }

  const setContract = async (st) => {
    const r = await api('/api/admin/sales/quotes', { method: 'PATCH', body: { id: d.id, action: 'contract', contract_status: st } })
    if (!r.ok) { toast(r.data.error || 'Chưa đổi được trạng thái', true); return }
    setMeta(m => ({ ...m, contract_status: st }))
    toast('Đã chuyển: ' + CONTRACT_STATES.find(c => c[0] === st)[1])
  }

  const leadOptions = (leads?.leads || []).filter(l => l.canEdit && l.stage !== 'chot' && l.stage !== 'that_bai')
  const chosenLead = d.lead_id ? ((leads?.leads || []).find(l => l.id === d.lead_id) || meta.lead) : null
  const savedStatus = meta.price_status
  const exportable = !isNew && !dirty && canExportPrice(savedStatus)

  const T = (k, label, opt = {}) => (
    <Field label={label} hint={opt.hint} className={opt.span ? 'sm:col-span-2' : ''}>
      <input value={s[k] || ''} disabled={locked} onChange={e => setS(k, e.target.value)} onBlur={opt.onBlur} className={inputCls} placeholder={opt.ph} />
    </Field>
  )
  const N = (k, label, hint) => (
    <Field label={label} hint={hint}><NumInput value={s[k]} disabled={locked} onChange={v => setS(k, v)} /></Field>
  )
  const Tog = (k, label) => (
    <label className={'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ' + (s[k] ? 'border-[#2A6CA8] bg-[#E2EEF8] text-[#2A6CA8] font-medium' : 'border-[#D5E2ED] bg-white text-gray-700')}>
      <input type="checkbox" checked={!!s[k]} disabled={locked} onChange={e => setS(k, e.target.checked)} className="accent-[#2A6CA8]" />{label}
    </label>
  )
  return (
    <div className="px-4 md:px-8 py-5">
      {/* Thanh trên cùng ghim khi cuộn: nút quay lại nổi bật + Lưu / Xuất Word luôn trong tầm tay */}
      <div className="s-topbar mb-4">
        <button onClick={() => { if (!dirty || window.confirm('Có thay đổi chưa lưu (vẫn giữ trong bản nháp tạm). Quay lại danh sách?')) onClose(true) }}
          className="s-back"><span className="ar" aria-hidden="true">←</span>Danh sách báo giá</button>
        <h1 className="text-lg font-bold text-[#15283C]">
          {isNew ? 'Báo giá mới' : <>Báo giá số <span className="text-[#2A6CA8] num">{meta.quote_no}</span></>}
        </h1>
        {!isNew && <span className="text-sm text-[#5A6C7E]">ngày {dmy(meta.quote_date)} · {meta.author_name || '—'}</span>}
        {!isNew && <PriceChip status={savedStatus} />}
        {locked && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{meta.contract_status === 'signed' ? 'Đã chốt HĐ — chỉ xem' : 'Chỉ xem — báo giá của người khác'}</span>}
        <div className="ml-auto flex gap-2">
          {!isNew && (
            <button onClick={() => downloadWord(d.id, toast).then(r => { if (r?.drive?.folderUrl) setMeta(m => ({ ...m, drive_folder_url: r.drive.folderUrl })) })}
              disabled={!exportable || !(meta.canEdit || res.perms.approve)} className={btnGhost}>📄 Xuất Word</button>
          )}
          {!locked && (
            <button onClick={save} disabled={saving || (!isNew && !dirty)} className={btnPrimary}>
              {saving ? 'Đang lưu…' : isNew ? 'Lưu báo giá' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <div className="xl:col-span-3 space-y-4">
          {/* Khách tiềm năng — mọi báo giá gắn với 1 khách để báo cáo theo kênh không hụt */}
          <Card title="Khách hàng thuộc kênh nào">
            {chosenLead ? (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-gray-500">Khách tiềm năng:</span>
                <Link href={'/sales?lead=' + chosenLead.id} className="font-medium text-[#2A6CA8] hover:underline">{chosenLead.company_name || chosenLead.contact_name}</Link>
                {chosenLead.stage && <StageChip stage={chosenLead.stage} />}
                {isNew && !editor.leadId && <button onClick={() => upd(n => { n.lead_id = null })} className="text-xs text-gray-500 underline">Đổi</button>}
              </div>
            ) : isNew ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Chọn khách tiềm năng đã có" className="sm:col-span-2">
                  <select value="" onChange={e => { const id = e.target.value; if (!id) return; const l = leadOptions.find(x => x.id === id)
                    upd(n => { n.lead_id = id; if (l) { n.survey.company = n.survey.company || l.company_name || ''; n.survey.mst = n.survey.mst || l.tax_code || ''; n.survey.contact = n.survey.contact || l.contact_name || ''; n.survey.phone = n.survey.phone || l.phone || ''; n.survey.email = n.survey.email || l.email || '' } }) }}
                    className={inputCls}>
                    <option value="">{leads ? '— Khách mới chưa có trong danh sách —' : 'Đang tải…'}</option>
                    {leadOptions.map(l => <option key={l.id} value={l.id}>{(l.company_name || l.contact_name) + (l.phone ? ' · ' + l.phone : '')}</option>)}
                  </select>
                </Field>
                <Field label="Hoặc: kênh khách đến *" hint="tạo khách tiềm năng mới">
                  <select value={d.channel_id} onChange={e => upd(n => { n.channel_id = e.target.value })} className={inputCls}>
                    <option value="">— Chọn kênh —</option>
                    {(res.channels || []).filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Chi tiết nguồn" hint="bài đăng, người giới thiệu…">
                  <input value={d.source_note} onChange={e => upd(n => { n.source_note = e.target.value })} className={inputCls} />
                </Field>
                {dup && (dup.leads?.length > 0 || dup.clients?.length > 0) && (
                  <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-900 space-y-1">
                    {dup.clients.map(c => <p key={c.id}>🏢 MST trùng công ty <b>đang phục vụ</b>: {c.name}</p>)}
                    {dup.leads.map(l => (
                      <p key={l.id}>👤 Đã có khách tiềm năng <b>{l.company_name || l.contact_name}</b> ·{' '}
                        <button onClick={() => { upd(n => { n.lead_id = l.id }); setDup(null) }} className="underline">Gắn báo giá vào khách này</button></p>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-gray-400">Báo giá cũ chưa gắn khách tiềm năng</p>}
          </Card>

          {!locked && (
            <Card title="Bước 1 · Nhập từ file khảo sát">
              <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); importFile(e.dataTransfer.files[0]) }}
                className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-5 text-center">
                <button onClick={() => fileRef.current?.click()} className={btnGhost}>Chọn file khảo sát (.docx)</button>
                <p className="text-xs text-gray-500 mt-2">Kéo thả file SVT.MB01 vào đây, app tự điền các ô bên dưới. Không có file thì nhập tay cũng được.</p>
                <input ref={fileRef} type="file" accept=".docx" hidden onChange={e => { importFile(e.target.files[0]); e.target.value = '' }} />
                {file && <p className="text-xs text-emerald-700 mt-2">📎 {file.name} — sẽ nộp vào Drive khi lưu</p>}
                {!file && meta.survey_file_name && <p className="text-xs text-gray-500 mt-2">📎 Đã có file khảo sát: {meta.survey_file_name}</p>}
              </div>
              {importMsg && <p className={'text-sm mt-2 ' + (importMsg.bad ? 'text-red-600' : 'text-emerald-700')}>{importMsg.text}</p>}
            </Card>
          )}

          <Card title="Bước 2 · Thông tin khách hàng">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {T('company', 'Tên công ty *', { span: true })}
              {T('mst', 'Mã số thuế', { onBlur: e => checkDup(e.target.value) })}
              {T('contact', 'Người liên hệ')}
              {T('phone', 'Điện thoại')}
              {T('email', 'Email')}
              {T('address', 'Địa chỉ', { span: true })}
            </div>
          </Card>

          <Card title="Bước 3 · Quy mô và số liệu tính phí">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Nhóm ngành" className="sm:col-span-3">
                <select value={s.sector} disabled={locked} onChange={e => setS('sector', e.target.value)} className={inputCls}>
                  {Object.keys(SECTORS).map(k => <option key={k} value={k}>{SECTORS[k].label}</option>)}
                </select>
              </Field>
              <p className="sm:col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wide -mb-1">Chứng từ phát sinh mỗi tháng</p>
              {N('invIn', 'SLHĐ mua vào')}
              {N('invOut', 'SLHĐ bán ra')}
              {N('bankStmt', 'Số tờ sao kê ngân hàng')}
              <Field label="Tổng chứng từ/tháng">
                <input value={fmt(s.docs)} readOnly className={inputCls + ' bg-gray-50 tabular-nums font-semibold'} />
              </Field>
              {N('revenueYear', 'Doanh thu (đồng/năm)')}
              {T('taxMix', 'Cơ cấu thuế suất', { ph: 'VD: 100% thuế suất 8%' })}
              <p className="sm:col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wide -mb-1">Nhân sự</p>
              {N('laborBh', 'Lao động tham gia BHXH')}
              {N('laborNoBh', 'Lao động không tham gia BHXH')}
              {N('internalAcc', 'Kế toán nội bộ')}
              <p className="sm:col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wide -mb-1">Phần mềm và hồ sơ thuế</p>
              {T('software', 'Phần mềm kế toán')}
              {T('einvoice', 'Hóa đơn điện tử')}
              {T('settled', 'Tình trạng quyết toán thuế', { ph: 'VD: chưa quyết toán từ 2021' })}
              <Field label="Địa bàn (phụ thu đi lại)" className="sm:col-span-3">
                <select value={s.area} disabled={locked} onChange={e => setS('area', e.target.value)} className={inputCls}>
                  {AREA_SURCHARGE.map(a => <option key={a.k} value={a.k}>{a.label}{a.fee ? ' — ' + fmtMoney(a.fee) + '/tháng' : ''}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {Tog('customs', 'Có tờ khai hải quan')}
              {Tog('monthlyFiling', 'Kê khai thuế theo tháng')}
              {Tog('wantHcns', 'Dùng dịch vụ hành chính nhân sự')}
              {Tog('wantReview', 'Cần hoàn thiện sổ sách kỳ trước')}
            </div>
            {(s.customs || s.wantHcns) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {s.customs && T('customsCount', 'Số tờ khai hải quan', { ph: 'VD: 02 – 03 tờ khai/tháng' })}
                {s.wantHcns && N('hcnsHeads', 'Số lao động tính phí HCNS')}
              </div>
            )}
          </Card>

          <Card title="Bước 4 · Dịch vụ tùy chọn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXTRA_SERVICES.map(x => {
                const on = s.extras.includes(x.k)
                return (
                  <label key={x.k} className={'flex items-start gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ' + (on ? 'border-[#2A6CA8] bg-[#E2EEF8]' : 'border-[#D5E2ED] bg-white')}>
                    <input type="checkbox" checked={on} disabled={locked} className="mt-0.5 accent-[#2A6CA8]"
                      onChange={e => upd(n => { n.survey.extras = e.target.checked ? [...n.survey.extras.filter(k => k !== x.k), x.k] : n.survey.extras.filter(k => k !== x.k) })} />
                    <span>{x.label} <span className="text-gray-400 whitespace-nowrap">— {fmtMoney(x.fee)}/{x.unit}</span></span>
                  </label>
                )
              })}
            </div>
          </Card>

          <Card title="Bước 5 · Lưu ý gửi khách hàng">
            <Field label="Mỗi dòng là một gạch đầu dòng trong báo giá (để trống thì bỏ mục này)">
              <textarea rows={5} value={s.notes} disabled={locked} onChange={e => setS('notes', e.target.value)} className={inputCls}
                placeholder="VD: Chưa quyết toán thuế từ 2021 đến nay – toàn bộ nghĩa vụ thuế của 5 năm vẫn đang ở trạng thái mở." />
            </Field>
          </Card>
        </div>

        {/* ── Cột phải: phí + thao tác ── */}
        <div className="xl:col-span-2 space-y-4 xl:sticky xl:top-24">
          <div className="s-panel">
            <div className="s-card-h">Phí theo biểu phí Savitax</div>
            <div className="p-4 pb-0 space-y-2">
              {f.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900">{l.label}{l.yearly ? ' (năm)' : ''}</p>
                    {l.note && <p className="text-xs text-gray-400">{l.note}</p>}
                  </div>
                  <p className="num whitespace-nowrap text-gray-900">{fmtMoney(l.fee)}{l.yearly ? '/năm' : '/tháng'}</p>
                </div>
              ))}
            </div>
            <div className="s-total mt-3">
              <p className="text-sm font-bold text-[#15283C]">Tổng phí hàng tháng</p>
              <p className="num">{fmtMoney(priced.monthlyFinal)}</p>
            </div>
            <div className="px-4 pb-4">
            {d.override.on && <p className="text-xs text-gray-500 text-right mt-1">theo biểu phí: {fmtMoney(priced.standardMonthly)}</p>}
            {f.optional.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Dịch vụ tùy chọn (không cộng vào tổng)</p>
                {f.optional.map((o, i) => (
                  <div key={i} className="flex justify-between gap-3 text-xs text-gray-600"><span>{o.label}</span><span className="num whitespace-nowrap">{fmtMoney(o.fee)}/{o.unit}</span></div>
                ))}
              </div>
            )}
            {f.basis.filter(Boolean).length > 0 && <p className="text-xs text-gray-500 mt-3"><b>Căn cứ:</b> {f.basis.filter(Boolean).join(' ')}</p>}
            {f.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-2">⚠ {w}</p>)}

            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 mt-3">🔒 Mức phí do biểu phí Savitax quyết định. Muốn báo mức khác thì phải ghi lý do và chờ Giám đốc duyệt.</p>
            {!locked && (
              <div className="mt-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={d.override.on} className="accent-[#2A6CA8]"
                    onChange={e => upd(n => { n.override.on = e.target.checked; if (e.target.checked && !n.override.amount) n.override.amount = priced.standardMonthly; if (!e.target.checked) n.override.reason = '' })} />
                  Đề xuất mức phí khác
                </label>
                {d.override.on && (
                  <div className="space-y-2 mt-2">
                    <Field label="Mức phí đề xuất (đ/tháng)"><NumInput value={d.override.amount} onChange={v => upd(n => { n.override.amount = v })} /></Field>
                    <Field label="Lý do đề xuất *">
                      <textarea rows={2} value={d.override.reason} onChange={e => upd(n => { n.override.reason = e.target.value })} className={inputCls}
                        placeholder="VD: khách hàng cũ giới thiệu, cam kết ký 2 năm." />
                    </Field>
                    <p className="text-xs text-red-700">Báo giá sẽ hiện nhãn “Chờ Giám đốc duyệt” và chưa xuất được file gửi khách.</p>
                    {(() => {
                      // Cùng quy tắc với printedMonthlyLines (lib/salesDocx.js): phần chênh dồn vào dòng kế toán trọn gói.
                      const baseLine = f.lines.find(l => l.key === 'base')
                      const printed = baseLine ? baseLine.fee + (priced.monthlyFinal - priced.standardMonthly) : null
                      return baseLine && printed >= 0 && printed !== baseLine.fee
                        ? <p className="text-xs text-[#5A6C7E]">Trên file Word, dòng “Dịch vụ kế toán – thuế trọn gói” in <b className="num">{fmtMoney(printed)}</b>/tháng để các dòng cộng ra đúng tổng.</p>
                        : null
                    })()}
                  </div>
                )}
              </div>
            )}
            {locked && d.override.on && <p className="text-sm mt-3">Đề xuất: <b>{fmtMoney(d.override.amount)}</b> — {d.override.reason}</p>}
            </div>
          </div>

          {/* Giám đốc duyệt */}
          {!isNew && res.perms.approve && savedStatus === 'pending' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-semibold text-red-900">🔏 Duyệt mức phí đề xuất</p>
              <p className="text-sm text-red-900">Biểu phí <b>{fmtMoney(meta.standard_monthly)}</b> → đề xuất <b>{fmtMoney(meta.monthly_final)}</b>/tháng</p>
              <p className="text-sm text-red-900">Lý do: {meta.override_reason}</p>
              <textarea rows={2} value={review} onChange={e => setReview(e.target.value)} placeholder="Ghi chú cho nhân viên (bắt buộc khi từ chối)" className={inputCls} />
              <div className="flex gap-2">
                <button onClick={() => doReview('approve')} disabled={dirty} className={btnPrimary}>Duyệt</button>
                <button onClick={() => doReview('reject')} disabled={dirty} className={btnGhost}>Từ chối</button>
              </div>
            </div>
          )}
          {!isNew && (savedStatus === 'approved' || savedStatus === 'rejected') && (meta.review_note || meta.reviewerName) && (
            <div className={'rounded-2xl p-3 text-sm ' + (savedStatus === 'approved' ? 'bg-blue-50 text-blue-900' : 'bg-gray-100 text-gray-700')}>
              {savedStatus === 'approved' ? 'Giám đốc đã duyệt' : 'Giám đốc từ chối'}{meta.reviewerName ? ' (' + meta.reviewerName + (meta.reviewed_at ? ', ' + dmyTime(meta.reviewed_at) : '') + ')' : ''}
              {meta.review_note ? ': ' + meta.review_note : ''}
            </div>
          )}

          <div className="s-panel p-4 space-y-3">
            {!locked && (
              <button onClick={save} disabled={saving} className={btnPrimary + ' w-full !py-2.5'}>
                {saving ? 'Đang lưu…' : isNew ? 'Lưu báo giá (hệ thống tự đánh số)' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}
              </button>
            )}
            {!isNew && (
              <button onClick={() => downloadWord(d.id, toast).then(r => { if (r?.drive?.folderUrl) setMeta(m => ({ ...m, drive_folder_url: r.drive.folderUrl })) })}
                disabled={!exportable || !(meta.canEdit || res.perms.approve)} className={btnGhost + ' w-full !py-2.5'}>
                📄 Xuất file Word SVT.MB03
              </button>
            )}
            {!isNew && !exportable && (
              <p className="text-xs text-gray-500">
                {dirty ? 'Lưu thay đổi trước rồi mới xuất file.'
                  : savedStatus === 'pending' ? 'Chờ Giám đốc duyệt mức phí rồi mới xuất file gửi khách.'
                  : savedStatus === 'rejected' ? 'Mức phí bị từ chối — sửa lại mức phí rồi lưu để gửi duyệt lại.' : ''}
              </p>
            )}
            {!isNew && (
              <Field label="Trạng thái hợp đồng" hint="dùng để thống kê đã gửi / đã chốt">
                <select value={meta.contract_status} disabled={!meta.canEdit} onChange={e => setContract(e.target.value)} className={inputCls}>
                  {CONTRACT_STATES.map(([k, lb]) => <option key={k} value={k} disabled={k !== 'draft' && !canExportPrice(savedStatus)}>{lb}</option>)}
                </select>
              </Field>
            )}
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-3">
              <p className="font-medium text-gray-700 mb-1">Hồ sơ trên Drive</p>
              {meta.drive_folder_url
                ? <a href={meta.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-[#2A6CA8] underline">Mở thư mục báo giá trên Drive</a>
                : meta.driveReady
                  ? <p>Lưu kèm file khảo sát hoặc bấm Xuất Word — hệ thống tự tạo thư mục <i>DD-MM-YY_Tên công ty</i> trong “1. BÁO GIÁ” và nộp file.</p>
                  : <p className="text-amber-700">Chưa cấu hình kết nối Google Drive — file chưa tự nộp được, tạm thời tải về và nộp tay vào thư mục <i>DD-MM-YY_Tên công ty</i>.</p>}
              {(meta.driveRootUrl || res.driveRootUrl) && (
                <a href={meta.driveRootUrl || res.driveRootUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 text-[#2A6CA8] underline">Mở thư mục Drive chung của phòng</a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
