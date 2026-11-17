'use client'
// Phân hệ Pháp lý — chi tiết một hồ sơ: thanh 10 bước, trạng thái chờ, giao người, đóng / mở lại; tab Thông tin · Việc cần
// làm · 4 tab pháp nhân (_phapNhan.js: Doanh nghiệp, Người & CCCD, Ngành nghề, Còn thiếu & xuất Word) · Công nợ · Lịch sử. Mọi quyền kiểm lại ở máy chủ (app/api/admin/phaply/ho-so/[id]/**) — ở đây chỉ ẩn nút cho gọn.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { THU_TUC, LOAI_HINH, NGUON, BUOC, BUOC_DONG, CHO, thuTucLabel, loaiHinhLabel, buocLabel, homNayVN } from '@/lib/phaply/hoSo'
import { tachKhoanThu } from '@/lib/phaply/tien'
import {
  Modal, Field, NumInput, inputCls, btnPrimary, btnGhost, useToast, api, fmt, fmtMoney, dmy, dmyTime, StatCard, BuocChip, ChoChip,
} from '../../_ui'
import PhapNhan, { TAB_PHAP_NHAN } from './_phapNhan'

export default function HoSoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [d, setD] = useState(null)
  const [tab, setTab] = useState('viec')
  const [hoi, setHoi] = useState(null)        // hộp hỏi lý do: { tieuDe, goi(note) }
  const [toastNode, toast] = useToast()

  const load = useCallback(async () => {
    const r = await api('/api/admin/phaply/ho-so/' + id)
    if (r.status === 401) { router.push('/login'); return }
    if (!r.ok) { toast(r.data.error || 'Không tải được hồ sơ', true); setD({ loi: r.data.error }); return }
    setD(r.data)
  }, [id, router]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    (async () => {
      const { data: sd } = await createClient().auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      load()
    })()
  }, [load, router])

  const lam = async (body, thongBao) => {
    const r = await api('/api/admin/phaply/ho-so/' + id, { method: 'PATCH', body })
    if (!r.ok) { toast(r.data.error || 'Không thực hiện được', true); return false }
    if (thongBao) toast(thongBao)
    await load(); return true
  }

  if (!d) return <AppShell><div className="pl-ui p-8 text-sm text-gray-400">Đang tải…</div></AppShell>
  if (d.loi) return <AppShell><div className="pl-ui p-8 text-sm text-gray-600">{d.loi} · <Link className="underline" href="/phaply">Về danh sách</Link>{toastNode}</div></AppShell>

  const hs = d.ho_so, q = d.q || {}, sua = d.sua_duoc, daDong = hs.stage >= BUOC_DONG
  const tabs = [['thong_tin', 'Thông tin'], ['viec', 'Việc cần làm'], ...TAB_PHAP_NHAN, ...(q.tien ? [['tien', 'Công nợ']] : []), ['lich_su', 'Lịch sử & ghi chú']]

  const chuyenBuoc = n => {
    if (!sua || daDong || n === hs.stage) return
    if (n === BUOC_DONG) return dongHoSo()
    lam({ action: 'buoc', stage: n }, `Đã chuyển sang bước ${n}. ${buocLabel(n)}`)
  }
  const dongHoSo = () => {
    const no = d.tien?.con_phai_thu > 0
    if (no && !q.dong) return toast(`Còn phải thu ${fmtMoney(d.tien.con_phai_thu)} — chỉ trưởng phòng đóng được hồ sơ còn nợ`, true)
    setHoi({ tieuDe: no ? 'Đóng hồ sơ còn nợ — ghi lý do' : 'Đóng hồ sơ (ghi chú nếu cần)', batBuoc: no, goi: note => lam({ action: 'dong', note }, 'Đã đóng hồ sơ') })
  }

  return (
    <AppShell>
      <div className="pl-ui">
        <div className="px-4 md:px-8 py-5 space-y-4">
          <div className="p-topbar">
            <Link href="/phaply" className="p-back"><span className="ar">‹</span>Danh sách hồ sơ</Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="num text-sm text-gray-500">{hs.code}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{thuTucLabel(hs.procedure_code)} · {loaiHinhLabel(hs.entity_type, true)}</span>
                <ChoChip k={hs.wait_state} />
                {hs.is_deleted && <span className="text-xs text-red-700 font-bold">ĐÃ XOÁ</span>}
              </div>
              <div className="font-bold text-lg leading-tight">{d.phap_nhan?.name || hs.contact_name || hs.title}</div>
              <div className="text-xs text-gray-500">Nhận {dmy(hs.received_at)} · Hạn nội bộ {hs.due_at ? dmy(hs.due_at) : '—'} · Phụ trách: <b>{hs.ten_phu_trach || 'Chưa giao'}</b></div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {!hs.assigned_to && q.sua && !q.ca_phong && <button className={btnPrimary} onClick={() => lam({ action: 'nhan' }, 'Bạn đã nhận hồ sơ')}>Nhận hồ sơ này</button>}
              {q.ca_phong && !daDong && (
                <select className={inputCls + ' !w-auto'} value={hs.assigned_to || ''} onChange={e => lam({ action: 'giao', assigned_to: e.target.value || null }, 'Đã giao hồ sơ')}>
                  <option value="">(Chưa giao)</option>
                  {(d.nhan_vien || []).map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}
                </select>
              )}
              {sua && !daDong && (
                <select className={inputCls + ' !w-auto'} value={hs.wait_state || ''} onChange={e => lam({ action: 'cho', wait_state: e.target.value || null })}>
                  <option value="">Không chờ ai</option>
                  {CHO.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}
                </select>
              )}
              {sua && !daDong && hs.stage < BUOC_DONG - 1 && <button className={btnPrimary} onClick={() => chuyenBuoc(hs.stage + 1)}>Sang bước {hs.stage + 1} ›</button>}
              {sua && !daDong && hs.stage === BUOC_DONG - 1 && <button className={btnPrimary} onClick={dongHoSo}>Đóng hồ sơ</button>}
              {daDong && q.dong && <button className={btnGhost} onClick={() => setHoi({ tieuDe: 'Mở lại hồ sơ — ghi lý do', batBuoc: true, goi: note => lam({ action: 'mo_lai', note }, 'Đã mở lại hồ sơ') })}>Mở lại</button>}
            </div>
          </div>

          <div className="p-steps">
            {BUOC.map(b => {
              const cls = b.n < hs.stage ? 'xong' : b.n === hs.stage ? 'dang' : ''
              const C = sua && !daDong ? 'button' : 'div'
              return <C key={b.n} className={'p-step ' + cls} onClick={() => chuyenBuoc(b.n)} title={sua && !daDong ? 'Chuyển sang bước này' : undefined}><b>{b.n}</b>{b.ngan}</C>
            })}
          </div>
          {daDong && <div className="text-sm p-panel px-4 py-2.5">Hồ sơ đã đóng {dmyTime(hs.closed_at)}{hs.ten_nguoi_dong ? ' bởi ' + hs.ten_nguoi_dong : ''}{hs.close_note ? ' — ' + hs.close_note : ''}.</div>}

          <div className="flex gap-1.5 flex-wrap">
            {tabs.map(([k, lb]) => <button key={k} className={'p-chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{lb}</button>)}
          </div>

          {tab === 'thong_tin' && <TabThongTin d={d} sua={sua && !daDong} q={q} lam={lam} />}
          {tab === 'viec' && <TabViec d={d} sua={sua && !daDong} id={id} load={load} toast={toast} />}
          <PhapNhan id={id} tab={tab} sua={sua && !daDong} loaiHinh={hs.entity_type} toast={toast} taiLaiHoSo={load} />
          {tab === 'tien' && q.tien && <TabTien d={d} sua={sua && !daDong} q={q} id={id} load={load} toast={toast} setHoi={setHoi} />}
          {tab === 'lich_su' && <TabLichSu d={d} q={q} id={id} load={load} toast={toast} />}

          {q.dong && !hs.is_deleted && (
            <div className="text-right"><button className="text-xs text-red-700 underline" onClick={() => setHoi({ tieuDe: 'Xoá hồ sơ (xoá mềm, giữ mã) — ghi lý do', batBuoc: true, goi: async note => { if (await lam({ action: 'xoa', note }, 'Đã xoá hồ sơ')) router.push('/phaply') } })}>Xoá hồ sơ…</button></div>
          )}
        </div>
        {hoi && <HoiLyDo {...hoi} onClose={() => setHoi(null)} />}
        {toastNode}
      </div>
    </AppShell>
  )
}

function HoiLyDo({ tieuDe, batBuoc, goi, onClose }) {
  const [note, setNote] = useState('')
  const [dang, setDang] = useState(false)
  return (
    <Modal title={tieuDe} onClose={onClose}
      footer={<><button className={btnGhost} onClick={onClose}>Huỷ</button>
        <button className={btnPrimary} disabled={dang || (batBuoc && !note.trim())} onClick={async () => { setDang(true); await goi(note.trim()); setDang(false); onClose() }}>Xác nhận</button></>}>
      <textarea rows={3} className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder={batBuoc ? 'Bắt buộc' : 'Không bắt buộc'} autoFocus />
    </Modal>
  )
}

// ─── Thông tin ─────────────────────────────────────────────────────────────────────────────────────────────────
function TabThongTin({ d, sua, q, lam }) {
  const hs = d.ho_so
  const dau = () => ({
    ten_phap_nhan: d.phap_nhan?.name || '', mst: d.phap_nhan?.tax_code || '', procedure_code: hs.procedure_code, entity_type: hs.entity_type,
    contact_name: hs.contact_name || '', contact_phone: hs.contact_phone || '', contact_email: hs.contact_email || '',
    source: hs.source, received_at: hs.received_at, due_at: hs.due_at || '', note: hs.note || '',
  })
  const [f, setF] = useState(dau)
  useEffect(() => setF(dau()), [d]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const doi = useMemo(() => Object.keys(f).some(k => (f[k] || '') !== (dau()[k] || '')), [f, d]) // eslint-disable-line react-hooks/exhaustive-deps
  const luu = () => {
    const fields = { ...f }
    if (!q.ca_phong) delete fields.due_at
    lam({ action: 'sua', fields }, 'Đã lưu thông tin')
  }
  const o = (lb, k, kieu = 'text', hint) => (
    <Field label={lb} hint={hint}><input type={kieu} className={inputCls + (kieu === 'text' ? '' : ' num')} value={f[k] || ''} disabled={!sua} onChange={e => set(k, e.target.value)} /></Field>
  )
  return (
    <div className="p-panel">
      <div className="p-panel-h">Thông tin hồ sơ</div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Tên doanh nghiệp" className="md:col-span-2"><input className={inputCls} value={f.ten_phap_nhan} disabled={!sua} onChange={e => set('ten_phap_nhan', e.target.value)} /></Field>
        {o('Mã số thuế', 'mst')}
        <Field label="Thủ tục"><select className={inputCls} value={f.procedure_code} disabled={!sua} onChange={e => set('procedure_code', e.target.value)}>{THU_TUC.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Loại hình"><select className={inputCls} value={f.entity_type} disabled={!sua} onChange={e => set('entity_type', e.target.value)}>{LOAI_HINH.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Nguồn khách"><select className={inputCls} value={f.source} disabled={!sua} onChange={e => set('source', e.target.value)}>{NGUON.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        {o('Người liên hệ', 'contact_name')}{o('Số điện thoại', 'contact_phone')}{o('Email', 'contact_email')}
        {o('Ngày nhận', 'received_at', 'date', 'đổi là tính lại hạn')}
        <Field label="Hạn nội bộ" hint={q.ca_phong ? 'trưởng phòng sửa được' : 'tự tính theo thủ tục'}>
          <input type="date" className={inputCls + ' num'} value={f.due_at || ''} disabled={!sua || !q.ca_phong} onChange={e => set('due_at', e.target.value)} /></Field>
        <div />
        <Field label="Ghi chú hồ sơ" className="md:col-span-3"><textarea rows={3} className={inputCls} value={f.note} disabled={!sua} onChange={e => set('note', e.target.value)} /></Field>
      </div>
      {sua && <div className="px-4 pb-4 flex justify-end gap-2">
        {doi && <button className={btnGhost} onClick={() => setF(dau())}>Bỏ thay đổi</button>}
        <button className={btnPrimary} disabled={!doi} onClick={luu}>Lưu thông tin</button>
      </div>}
      <div className="px-4 pb-4 text-xs text-gray-500">Địa chỉ, vốn, người (chủ sở hữu, thành viên, CCCD…), ngành nghề nhập ở các tab Doanh nghiệp · Người & CCCD · Ngành nghề.</div>
    </div>
  )
}

// ─── Việc cần làm ──────────────────────────────────────────────────────────────────────────────────────────────
function TabViec({ d, sua, id, load, toast }) {
  const [moi, setMoi] = useState({ title: '', stage: d.ho_so.stage })
  const goi = async body => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/viec`, { method: 'POST', body })
    if (!r.ok) return toast(r.data.error || 'Không cập nhật được', true)
    load()
  }
  const theoBuoc = BUOC.map(b => ({ ...b, viec: d.viec.filter(v => v.stage === b.n) })).filter(b => b.viec.length || b.n === d.ho_so.stage)
  return (
    <div className="p-panel">
      <div className="p-panel-h">Việc cần làm theo bước</div>
      <div className="p-4 space-y-4">
        {!d.viec.length && <div className="text-sm text-gray-500">Thủ tục này chưa có checklist mẫu — trưởng phòng thêm ở “Mẫu &amp; checklist”, hoặc thêm việc riêng bên dưới.</div>}
        {theoBuoc.map(b => (
          <div key={b.n}>
            <div className={'text-sm font-bold mb-1 ' + (b.n === d.ho_so.stage ? 'text-[#8E1F1F]' : 'text-gray-600')}>{b.n}. {b.label}{b.n === d.ho_so.stage && ' — bước hiện tại'}</div>
            <ul className="space-y-1">
              {b.viec.map(v => (
                <li key={v.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={!!v.done_at} disabled={!sua} onChange={e => goi({ task_id: v.id, done: e.target.checked })} />
                  <span className={'flex-1 ' + (v.done_at ? 'line-through text-gray-400' : '')}>{v.title}
                    {v.done_at && <span className="text-xs text-gray-400 no-underline"> · {v.ten_nguoi_xong} {dmyTime(v.done_at)}</span>}</span>
                  {sua && !v.template_item_id && <button className="text-xs text-red-700" onClick={() => goi({ xoa: v.id })}>Xoá</button>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sua && (
          <div className="flex gap-2 flex-wrap items-end pt-2 border-t">
            <Field label="Thêm việc riêng cho hồ sơ này" className="flex-1 min-w-[240px]"><input className={inputCls} value={moi.title} onChange={e => setMoi(o => ({ ...o, title: e.target.value }))} /></Field>
            <Field label="Bước"><select className={inputCls + ' !w-auto'} value={moi.stage} onChange={e => setMoi(o => ({ ...o, stage: Number(e.target.value) }))}>
              {BUOC.map(b => <option key={b.n} value={b.n}>{b.n}. {b.label}</option>)}</select></Field>
            <button className={btnPrimary} disabled={!moi.title.trim()} onClick={async () => { await goi({ them: moi }); setMoi(o => ({ ...o, title: '' })) }}>Thêm</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Công nợ ───────────────────────────────────────────────────────────────────────────────────────────────────
function TabTien({ d, sua, q, id, load, toast, setHoi }) {
  const t = d.tien
  const coThu = d.payments.some(p => !p.deleted_at)
  const suaPhi = sua && (!coThu || q.dong)
  const [phi, setPhi] = useState(() => d.fees.map(f => ({ kind: f.kind, name: f.name, amount: Number(f.amount) })))
  const [dots, setDots] = useState(() => d.installments.map(x => ({ ...x, amount_dich_vu: Number(x.amount_dich_vu), amount_thu_ho: Number(x.amount_thu_ho) })))
  const [lichMau, setLichMau] = useState([])
  useEffect(() => { setPhi(d.fees.map(f => ({ kind: f.kind, name: f.name, amount: Number(f.amount) }))); setDots(d.installments.map(x => ({ ...x, amount_dich_vu: Number(x.amount_dich_vu), amount_thu_ho: Number(x.amount_thu_ho) }))) }, [d])
  useEffect(() => { api('/api/admin/phaply/mau').then(r => r.ok && setLichMau(r.data.lich_mau || [])) }, [])

  const put = async (body, tb) => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/tien`, { method: 'PUT', body })
    if (!r.ok) return toast(r.data.error || 'Không lưu được', true)
    toast(tb); load()
  }
  const tongPhi = k => phi.filter(f => f.kind === k).reduce((a, f) => a + (Number(f.amount) || 0), 0)
  const tongDot = k => dots.reduce((a, x) => a + (Number(x[k]) || 0), 0)
  const lechLich = dots.length && (tongDot('amount_dich_vu') !== tongPhi('dich_vu') || tongDot('amount_thu_ho') !== tongPhi('thu_ho'))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <StatCard label="Phí dịch vụ" value={fmt(t.phi_dich_vu)} unit="đ" tone="wine" foot="doanh số khi thu" />
        <StatCard label="Thu hộ" value={fmt(t.phi_thu_ho)} unit="đ" tone="sky" foot="không tính doanh số" />
        <StatCard label="Đã thu" value={fmt(t.da_thu)} unit="đ" tone="grn" foot={`DV ${fmt(t.da_thu_dich_vu)} · TH ${fmt(t.da_thu_thu_ho)}`} />
        <StatCard label="Còn phải thu" value={fmt(t.con_phai_thu)} unit="đ" tone="amb" />
        <StatCard label="Nợ đến hạn" value={fmt(t.no_den_han)} unit="đ" tone="red" foot="đợt đã đến hạn mà chưa thu" />
      </div>
      {t.canh_bao.map((c, i) => <div key={i} className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ {c}</div>)}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-panel">
          <div className="p-panel-h">Các khoản phí (gồm VAT){coThu && !q.dong && <span className="font-normal text-xs"> · đã có khoản thu, chỉ trưởng phòng sửa</span>}</div>
          <div className="p-3 space-y-2">
            {phi.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className={inputCls + ' !w-36'} value={f.kind} disabled={!suaPhi} onChange={e => setPhi(ds => ds.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>
                  <option value="dich_vu">Phí dịch vụ</option><option value="thu_ho">Thu hộ</option></select>
                <input className={inputCls} value={f.name} disabled={!suaPhi} onChange={e => setPhi(ds => ds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <div className="w-40 shrink-0"><NumInput value={f.amount} disabled={!suaPhi} onChange={v => setPhi(ds => ds.map((x, j) => j === i ? { ...x, amount: v } : x))} /></div>
                {suaPhi && <button className="text-red-700 px-1" onClick={() => setPhi(ds => ds.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            {suaPhi && <div className="flex gap-2">
              <button className={btnGhost + ' p-btn-sm'} onClick={() => setPhi(ds => [...ds, { kind: 'dich_vu', name: 'Phí dịch vụ', amount: 0 }])}>+ Phí dịch vụ</button>
              <button className={btnGhost + ' p-btn-sm'} onClick={() => setPhi(ds => [...ds, { kind: 'thu_ho', name: 'Lệ phí đăng ký', amount: 0 }])}>+ Thu hộ</button>
              <button className={btnPrimary + ' p-btn-sm ml-auto'} onClick={() => put({ fees: phi }, 'Đã lưu phí')}>Lưu phí</button>
            </div>}
            <div className="text-sm text-right">Dịch vụ <b className="num">{fmt(tongPhi('dich_vu'))}</b> · Thu hộ <b className="num">{fmt(tongPhi('thu_ho'))}</b></div>
          </div>
        </div>

        <div className="p-panel">
          <div className="p-panel-h flex items-center justify-between gap-2">Lịch thu theo đợt
            {sua && lichMau.length > 0 && (
              <select className={inputCls + ' !w-auto !py-1 text-xs'} value="" onChange={e => e.target.value && put({ ap_lich_mau: e.target.value }, 'Đã áp lịch thu mẫu')}>
                <option value="">Áp lịch mẫu…</option>{lichMau.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            )}
          </div>
          <div className="p-3 space-y-2">
            {dots.map((x, i) => {
              const tt = t.dots.find(y => y.id === x.id)
              const setX = (k, v) => setDots(ds => ds.map((y, j) => j === i ? { ...y, [k]: v } : y))
              return (
                <div key={x.id || 'moi' + i} className="border rounded-lg p-2 space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <input className={inputCls} value={x.name} disabled={!sua} onChange={e => setX('name', e.target.value)} />
                    {sua && <button className="text-red-700 px-1" onClick={() => setDots(ds => ds.filter((_, j) => j !== i))}>✕</button>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Field label="Phí dịch vụ"><NumInput value={x.amount_dich_vu} disabled={!sua} onChange={v => setX('amount_dich_vu', v)} /></Field>
                    <Field label="Thu hộ"><NumInput value={x.amount_thu_ho} disabled={!sua} onChange={v => setX('amount_thu_ho', v)} /></Field>
                    <Field label="Đến hạn khi sang bước"><select className={inputCls} value={x.due_stage || ''} disabled={!sua} onChange={e => setX('due_stage', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">—</option>{BUOC.map(b => <option key={b.n} value={b.n}>{b.n}. {b.ngan}</option>)}</select></Field>
                    <Field label="hoặc tới ngày"><input type="date" className={inputCls} value={x.due_date || ''} disabled={!sua} onChange={e => setX('due_date', e.target.value || null)} /></Field>
                  </div>
                  {tt && <div className="text-xs text-gray-600 flex items-center gap-2 flex-wrap"><span>{tt.da_den_han ? <span className="text-red-700 font-semibold">Đến hạn {dmy(tt.den_han_ngay)}</span> : tt.den_han_ngay ? `Đến hạn ${dmy(tt.den_han_ngay)}` : 'Chưa đến hạn'}
                    {' · '}đã thu <b className="num">{fmt(tt.da_thu)}</b> · còn <b className={'num' + (tt.con > 0 && tt.da_den_han ? ' text-red-700' : '')}>{fmt(tt.con)}</b></span>
                    {tt.con > 0 && <a className="p-btn p-btn-sm ml-auto" target="_blank" rel="noreferrer" href={`/api/admin/phaply/ho-so/${id}/dntt?dot=${tt.id}`}>🧾 ĐNTT đợt này</a>}</div>}
                </div>
              )
            })}
            {sua && <div className="flex gap-2 items-center">
              <button className={btnGhost + ' p-btn-sm'} onClick={() => setDots(ds => [...ds, { name: `Đợt ${ds.length + 1}`, amount_dich_vu: 0, amount_thu_ho: 0, due_stage: null, due_date: null }])}>+ Thêm đợt</button>
              {lechLich ? <span className="text-xs text-amber-800">Lịch chưa khớp tổng phí</span> : null}
              <button className={btnPrimary + ' p-btn-sm ml-auto'} onClick={() => put({ dots }, 'Đã lưu lịch thu')}>Lưu lịch thu</button>
            </div>}
          </div>
        </div>
      </div>

      {sua && <GhiThu d={d} id={id} load={load} toast={toast} />}
      <SoThu d={d} q={q} id={id} load={load} toast={toast} setHoi={setHoi} />
    </div>
  )
}

function GhiThu({ d, id, load, toast }) {
  const dauTien = d.tien.dots.find(x => x.con > 0)
  const [f, setF] = useState({ installment_id: dauTien?.id || '', so_tien: 0, paid_at: homNayVN(), method: 'chuyen_khoan', note: '', tachTay: false, dv: 0, th: 0 })
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const dot = d.tien.dots.find(x => x.id === f.installment_id)
  const conTh = dot ? dot.con_thu_ho : d.tien.phi_thu_ho - d.tien.da_thu_thu_ho
  const tach = f.tachTay ? { amount_dich_vu: f.dv, amount_thu_ho: f.th } : tachKhoanThu(f.so_tien, conTh)
  const luu = async () => {
    const body = { installment_id: f.installment_id || null, so_tien: f.so_tien, paid_at: f.paid_at, method: f.method, note: f.note }
    if (f.tachTay) Object.assign(body, { amount_dich_vu: f.dv, amount_thu_ho: f.th })
    const r = await api(`/api/admin/phaply/ho-so/${id}/tien`, { method: 'POST', body })
    if (!r.ok) return toast(r.data.error || 'Không ghi được', true)
    toast('Đã ghi khoản thu'); setF(o => ({ ...o, so_tien: 0, dv: 0, th: 0, note: '' })); load()
  }
  return (
    <div className="p-panel">
      <div className="p-panel-h">Ghi khoản khách trả</div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <Field label="Trả cho đợt" className="md:col-span-2"><select className={inputCls} value={f.installment_id} onChange={e => set('installment_id', e.target.value)}>
          <option value="">(Không gắn đợt)</option>
          {d.tien.dots.map(x => <option key={x.id} value={x.id}>{x.name} — còn {fmt(x.con)}</option>)}</select></Field>
        {!f.tachTay
          ? <Field label="Số tiền khách trả"><NumInput value={f.so_tien} onChange={v => set('so_tien', v)} /></Field>
          : <><Field label="Phần dịch vụ"><NumInput value={f.dv} onChange={v => set('dv', v)} /></Field><Field label="Phần thu hộ"><NumInput value={f.th} onChange={v => set('th', v)} /></Field></>}
        <Field label="Ngày tiền về" hint="ngày thật"><input type="date" className={inputCls} value={f.paid_at} max={homNayVN()} onChange={e => set('paid_at', e.target.value)} /></Field>
        <Field label="Cách trả"><select className={inputCls} value={f.method} onChange={e => set('method', e.target.value)}>
          <option value="chuyen_khoan">Chuyển khoản</option><option value="tien_mat">Tiền mặt</option><option value="khac">Khác</option></select></Field>
        <Field label="Ghi chú" className="md:col-span-4"><input className={inputCls} value={f.note} onChange={e => set('note', e.target.value)} /></Field>
        <label className="text-xs flex items-center gap-1.5"><input type="checkbox" checked={f.tachTay} onChange={e => set('tachTay', e.target.checked)} /> Tự tách dịch vụ / thu hộ</label>
        <button className={btnPrimary} disabled={tach.amount_dich_vu + tach.amount_thu_ho <= 0} onClick={luu}>Ghi thu</button>
      </div>
      <div className="px-3 pb-3 text-xs text-gray-600">Sẽ ghi: thu hộ <b className="num">{fmt(tach.amount_thu_ho)}</b> + phí dịch vụ <b className="num">{fmt(tach.amount_dich_vu)}</b>
        {!f.tachTay && ' (mặc định trừ phần thu hộ còn thiếu trước)'}</div>
    </div>
  )
}

function SoThu({ d, q, id, load, toast, setHoi }) {
  const xoa = p => setHoi({ tieuDe: 'Xoá khoản thu ' + fmtMoney(Number(p.amount_dich_vu) + Number(p.amount_thu_ho)) + ' — ghi lý do', batBuoc: true, goi: async reason => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/tien`, { method: 'DELETE', body: { payment_id: p.id, reason } })
    if (!r.ok) return toast(r.data.error || 'Không xoá được', true)
    toast('Đã xoá khoản thu'); load()
  } })
  const dotTen = iid => d.tien.dots.find(x => x.id === iid)?.name || '—'
  if (!d.payments.length) return <div className="p-panel p-4 text-sm text-gray-500">Chưa ghi khoản thu nào.</div>
  return (
    <div className="p-panel overflow-x-auto">
      <div className="p-panel-h">Sổ thu (ghi nối tiếp)</div>
      <table className="p-tbl">
        <thead><tr><th>Ngày tiền về</th><th className="l">Đợt</th><th className="r">Dịch vụ</th><th className="r">Thu hộ</th><th className="l">Tính doanh số cho</th><th className="l">Ghi chú</th><th className="l">Người ghi</th><th></th></tr></thead>
        <tbody>
          {d.payments.map(p => (
            <tr key={p.id} className={p.deleted_at ? 'opacity-50' : ''}>
              <td className="num">{dmy(p.paid_at)}</td><td className="l">{dotTen(p.installment_id)}</td>
              <td className="r num">{fmt(p.amount_dich_vu)}</td><td className="r num">{fmt(p.amount_thu_ho)}</td>
              <td className="l">{p.ten_phu_trach || '—'}</td>
              <td className="l text-xs">{p.note}{p.deleted_at && <div className="text-red-700">Đã xoá {dmyTime(p.deleted_at)} ({p.ten_nguoi_xoa}): {p.delete_reason}</div>}</td>
              <td className="l text-xs">{p.ten_nguoi_ghi}<div className="text-gray-400">{dmyTime(p.created_at)}</div></td>
              <td>{q.dong && !p.deleted_at && <button className="text-xs text-red-700" onClick={() => xoa(p)}>Xoá</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Lịch sử & ghi chú ─────────────────────────────────────────────────────────────────────────────────────────
const KIND = { stage: 'Chuyển bước', wait: 'Trạng thái chờ', assign: 'Giao hồ sơ', create: 'Tạo hồ sơ', close: 'Đóng hồ sơ', reopen: 'Mở lại', edit: 'Sửa' }
function TabLichSu({ d, q, id, load, toast }) {
  const [body, setBody] = useState('')
  const nv = new Map((d.nhan_vien || []).map(n => [n.id, n.ten]))
  const giaTri = l => {
    if (l.kind === 'stage' || l.kind === 'close' || l.kind === 'reopen') return `${l.from_value ? buocLabel(l.from_value) + ' → ' : ''}${buocLabel(l.to_value)}`
    if (l.kind === 'assign') return `${nv.get(l.from_value) || (l.from_value ? 'người khác' : 'chưa giao')} → ${nv.get(l.to_value) || (l.to_value ? 'người khác' : 'chưa giao')}`
    if (l.kind === 'wait') return `${l.from_value} → ${l.to_value}`
    return ''
  }
  const goi = async b => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/ghi-chu`, { method: 'POST', body: b })
    if (!r.ok) return toast(r.data.error || 'Không lưu được', true)
    load()
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="p-panel">
        <div className="p-panel-h">Ghi chú</div>
        <div className="p-3 space-y-2">
          <div className="flex gap-2"><textarea rows={2} className={inputCls} value={body} onChange={e => setBody(e.target.value)} placeholder="Trao đổi với khách, việc cần nhớ…" />
            <button className={btnPrimary} disabled={!body.trim()} onClick={async () => { await goi({ body }); setBody('') }}>Lưu</button></div>
          {d.ghi_chu.map(g => (
            <div key={g.id} className="border-t pt-2 text-sm">
              <div className="text-xs text-gray-500">{g.ten_nguoi} · {dmyTime(g.created_at)}
                {(g.created_by === d.toi || q.ca_phong) && <button className="ml-2 text-red-700" onClick={() => goi({ xoa: g.id })}>Xoá</button>}</div>
              <div className="whitespace-pre-wrap">{g.body}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-panel">
        <div className="p-panel-h">Nhật ký hồ sơ</div>
        <ul className="p-3 space-y-1.5 text-sm">
          {[...d.nhat_ky].reverse().map(l => (
            <li key={l.id} className="border-b pb-1.5">
              <div className="text-xs text-gray-500">{dmyTime(l.created_at)} · {l.ten_nguoi || '—'}</div>
              <div><b>{KIND[l.kind] || l.kind}</b> {giaTri(l)}{l.note ? <span className="text-gray-600"> — {l.note}</span> : null}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
