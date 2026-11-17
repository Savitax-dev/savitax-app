'use client'
// Phân hệ Pháp lý — Mẫu & checklist: checklist theo thủ tục (việc theo từng bước + số ngày hạn nội bộ) và lịch thu mẫu.
// Trưởng phòng (manage_phaply_template) sửa; người khác chỉ xem. Đổi mẫu chỉ áp cho hồ sơ tạo SAU.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { BUOC } from '@/lib/phaply/hoSo'
import { PageHead, Field, inputCls, btnPrimary, btnGhost, useToast, api, ThanhPhapLy } from '../_ui'

export default function MauPage() {
  const router = useRouter()
  const [d, setD] = useState(null)
  const [chon, setChon] = useState('tlm')
  const [toastNode, toast] = useToast()
  const load = useCallback(async () => {
    const r = await api('/api/admin/phaply/mau')
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { router.push('/dashboard'); return }
    if (!r.ok) return toast(r.data.error || 'Không tải được mẫu', true)
    setD(r.data)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (async () => { const { data } = await createClient().auth.getSession(); if (!data.session) return router.push('/login'); load() })() }, [load, router])

  if (!d) return <AppShell><div className="pl-ui p-8 text-sm text-gray-400">Đang tải…</div></AppShell>
  if (d.chua_cai) return <AppShell><div className="pl-ui p-8 text-sm">Chưa chạy sql/56_phap_ly_ho_so.sql trên cơ sở dữ liệu này.</div></AppShell>
  const tt = d.thu_tuc.find(t => t.k === chon)
  const trong = d.thu_tuc.every(t => !t.template_id) && !d.lich_mau.length

  const napMacDinh = async () => {
    const r = await api('/api/admin/phaply/mau', { method: 'PUT', body: { nap_mac_dinh: true } })
    if (!r.ok) return toast(r.data.error || 'Không nạp được', true)
    toast(`Đã nạp checklist ${r.data.soThuTuc} thủ tục, ${r.data.soLich} lịch thu mẫu`); load()
  }

  return (
    <AppShell>
      <div className="pl-ui">
        <div className="px-4 md:px-8 py-5 space-y-4">
          <PageHead title="Mẫu & checklist pháp lý" sub={d.sua_duoc ? 'Đổi mẫu chỉ áp cho hồ sơ tạo sau — việc của hồ sơ đang làm giữ nguyên' : 'Chỉ trưởng phòng sửa được'}>
            {d.sua_duoc && <button className={btnPrimary} onClick={napMacDinh} title="Chỉ nạp cho thủ tục chưa có mẫu, không đè mẫu đã sửa">Nạp mẫu mặc định</button>}
          </PageHead>
          <ThanhPhapLy dang="/phaply/mau" />
          {trong && <div className="p-panel px-4 py-3 text-sm">Chưa có mẫu nào. {d.sua_duoc ? 'Bấm “Nạp mẫu mặc định” để có sẵn checklist 9 thủ tục + 3 lịch thu, rồi sửa lại theo phòng.' : 'Nhờ trưởng phòng nạp mẫu.'}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
            <div className="p-panel">
              <div className="p-panel-h">Thủ tục</div>
              <div className="p-2 space-y-1">
                {d.thu_tuc.map(t => (
                  <button key={t.k} onClick={() => setChon(t.k)} className={'w-full text-left px-3 py-2 rounded-lg text-sm ' + (chon === t.k ? 'bg-[#8E1F1F] text-white font-semibold' : 'hover:bg-gray-50')}>
                    {t.label}<span className="float-right opacity-70 num">{t.items.length || ''}</span>
                  </button>
                ))}
              </div>
            </div>
            <SuaChecklist key={chon + (tt?.template_id || '') + tt?.items.length} tt={tt} sua={d.sua_duoc} toast={toast} load={load} />
          </div>
          <SuaLichMau key={d.lich_mau.map(p => p.id).join()} lichMau={d.lich_mau} sua={d.sua_duoc} toast={toast} load={load} />
        </div>
        {toastNode}
      </div>
    </AppShell>
  )
}

function SuaChecklist({ tt, sua, toast, load }) {
  const [sla, setSla] = useState(tt.sla_days ?? 7)
  const [items, setItems] = useState(tt.items.map(i => ({ id: i.id, stage: i.stage, title: i.title })))
  const luu = async () => {
    const r = await api('/api/admin/phaply/mau', { method: 'PUT', body: { procedure_code: tt.k, sla_days: sla, items } })
    if (!r.ok) return toast(r.data.error || 'Không lưu được', true)
    toast('Đã lưu checklist ' + tt.label); load()
  }
  const set = (i, k, v) => setItems(ds => ds.map((x, j) => j === i ? { ...x, [k]: v } : x))
  return (
    <div className="p-panel">
      <div className="p-panel-h">Checklist — {tt.label}</div>
      <div className="p-3 space-y-3">
        <Field label="Hạn xử lý nội bộ (số ngày, bỏ chủ nhật, ngày nhận là ngày 1)" className="max-w-xs">
          <input type="number" min="0" className={inputCls + ' num'} value={sla} disabled={!sua} onChange={e => setSla(Number(e.target.value) || 0)} /></Field>
        {BUOC.map(b => {
          const ds = items.map((x, i) => ({ ...x, i })).filter(x => x.stage === b.n)
          return (
            <div key={b.n}>
              <div className="text-sm font-bold text-gray-600">{b.n}. {b.label}</div>
              {ds.map(x => (
                <div key={x.i} className="flex gap-2 items-center mt-1">
                  <input className={inputCls} value={x.title} disabled={!sua} onChange={e => set(x.i, 'title', e.target.value)} />
                  {sua && <select className={inputCls + ' !w-auto'} value={x.stage} onChange={e => set(x.i, 'stage', Number(e.target.value))}>{BUOC.map(y => <option key={y.n} value={y.n}>Bước {y.n}</option>)}</select>}
                  {sua && <button className="text-red-700 px-1" onClick={() => setItems(o => o.filter((_, j) => j !== x.i))}>✕</button>}
                </div>
              ))}
              {sua && <button className="text-xs mt-1 text-[#8E1F1F]" onClick={() => setItems(o => [...o, { stage: b.n, title: '' }])}>+ thêm việc</button>}
            </div>
          )
        })}
        {sua && <div className="flex justify-end"><button className={btnPrimary} onClick={luu}>Lưu checklist</button></div>}
      </div>
    </div>
  )
}

function SuaLichMau({ lichMau, sua, toast, load }) {
  const [ds, setDs] = useState(lichMau.map(p => ({ id: p.id, name: p.name, items: (p.items || []).map(x => ({ ...x })) })))
  const luu = async () => {
    const r = await api('/api/admin/phaply/mau', { method: 'PUT', body: { lich_mau: ds } })
    if (!r.ok) return toast(r.data.error || 'Không lưu được', true)
    toast('Đã lưu lịch thu mẫu'); load()
  }
  const setP = (i, f) => setDs(o => o.map((p, j) => j === i ? f(p) : p))
  return (
    <div className="p-panel">
      <div className="p-panel-h">Lịch thu mẫu — tổng % phí dịch vụ và % thu hộ của mỗi lịch phải đúng 100</div>
      <div className="p-3 space-y-3">
        {ds.map((p, i) => (
          <div key={p.id || 'moi' + i} className="border rounded-lg p-2 space-y-1.5">
            <div className="flex gap-2 items-center">
              <input className={inputCls + ' font-semibold'} value={p.name} disabled={!sua} onChange={e => setP(i, x => ({ ...x, name: e.target.value }))} />
              {sua && <button className="text-red-700 px-1" onClick={() => setDs(o => o.filter((_, j) => j !== i))}>✕</button>}
            </div>
            {p.items.map((it, k) => {
              const setIt = (key, v) => setP(i, x => ({ ...x, items: x.items.map((y, m) => m === k ? { ...y, [key]: v } : y) }))
              return (
                <div key={k} className="grid grid-cols-2 md:grid-cols-[1fr_110px_110px_170px_auto] gap-2 items-end text-xs">
                  <Field label="Tên đợt"><input className={inputCls} value={it.ten} disabled={!sua} onChange={e => setIt('ten', e.target.value)} /></Field>
                  <Field label="% dịch vụ"><input type="number" className={inputCls + ' num'} value={it.pt_dich_vu} disabled={!sua} onChange={e => setIt('pt_dich_vu', Number(e.target.value))} /></Field>
                  <Field label="% thu hộ"><input type="number" className={inputCls + ' num'} value={it.pt_thu_ho} disabled={!sua} onChange={e => setIt('pt_thu_ho', Number(e.target.value))} /></Field>
                  <Field label="Đến hạn khi sang bước"><select className={inputCls} value={it.due_stage || ''} disabled={!sua} onChange={e => setIt('due_stage', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>{BUOC.map(b => <option key={b.n} value={b.n}>{b.n}. {b.ngan}</option>)}</select></Field>
                  {sua && <button className="text-red-700 pb-2" onClick={() => setP(i, x => ({ ...x, items: x.items.filter((_, m) => m !== k) }))}>✕</button>}
                </div>
              )
            })}
            {sua && <button className="text-xs text-[#8E1F1F]" onClick={() => setP(i, x => ({ ...x, items: [...x.items, { ten: `Đợt ${x.items.length + 1}`, pt_dich_vu: 0, pt_thu_ho: 0, due_stage: null }] }))}>+ thêm đợt</button>}
          </div>
        ))}
        {sua && <div className="flex gap-2">
          <button className={btnGhost} onClick={() => setDs(o => [...o, { name: 'Lịch thu mới', items: [{ ten: 'Thu đủ', pt_dich_vu: 100, pt_thu_ho: 100, due_stage: 1 }] }])}>+ Lịch thu</button>
          <button className={btnPrimary + ' ml-auto'} onClick={luu}>Lưu lịch thu mẫu</button>
        </div>}
      </div>
    </div>
  )
}
