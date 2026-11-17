'use client'
// Phân hệ Pháp lý — trang chính: thẻ số liệu, danh sách / bảng theo bước, tiếp nhận hồ sơ mới.
// Phạm vi lọc ở MÁY CHỦ (nhân viên: hồ sơ mình + chưa ai nhận; trưởng phòng: cả phòng).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { THU_TUC, LOAI_HINH, NGUON, BUOC, BUOC_DONG, thuTucLabel, loaiHinhLabel, homNayVN } from '@/lib/phaply/hoSo'
import {
  PageHead, StatCard, Modal, Field, NumInput, inputCls, btnPrimary, btnGhost, useToast, api, fmt, fmtMoney, dmy,
  BuocChip, ChoChip, ThanhPhapLy,
} from './_ui'

const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function PhapLyPage() {
  const router = useRouter()
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [coDong, setCoDong] = useState(false)
  const [xem, setXem] = useState('ds')            // ds | buoc
  const [loc, setLoc] = useState('')              // khoá thẻ số liệu đang lọc
  const [q, setQ] = useState('')
  const [fThuTuc, setFThuTuc] = useState('')
  const [fNv, setFNv] = useState('')
  const [moTao, setMoTao] = useState(false)
  const [toastNode, toast] = useToast()

  const load = useCallback(async () => {
    const r = await api('/api/admin/phaply/ho-so' + (coDong ? '?dong=1' : ''))
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { router.push('/dashboard'); return }
    if (!r.ok) { toast(r.data.error || 'Không tải được danh sách', true); setLoading(false); return }
    setRes(r.data); setLoading(false)
  }, [router, coDong]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const { data: sd } = await createClient().auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      load()
    })()
  }, [load, router])

  const ds = useMemo(() => {
    let x = res?.ho_so || []
    if (loc === 'khach') x = x.filter(r => r.wait_state === 'khach')
    if (loc === 'co_quan') x = x.filter(r => r.wait_state === 'so' || r.wait_state === 'thue')
    if (loc === 'bo_sung') x = x.filter(r => r.wait_state === 'bo_sung')
    if (loc === 'tre') x = x.filter(r => r.tre_han)
    if (loc === 'chua_giao') x = x.filter(r => !r.assigned_to)
    if (loc === 'no') x = x.filter(r => r.no_den_han > 0)
    if (fThuTuc) x = x.filter(r => r.procedure_code === fThuTuc)
    if (fNv) x = x.filter(r => (fNv === '_' ? !r.assigned_to : r.assigned_to === fNv))
    if (q.trim()) {
      const k = boDau(q.trim())
      x = x.filter(r => [r.code, r.title, r.ten_phap_nhan, r.mst, r.contact_name, r.contact_phone].some(v => boDau(v).includes(k)))
    }
    return x
  }, [res, loc, fThuTuc, fNv, q])

  if (loading) return <AppShell><div className="pl-ui flex items-center justify-center"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
  if (!res) return <AppShell><div className="pl-ui p-8 text-sm text-gray-500">Chưa tải được dữ liệu. {toastNode}</div></AppShell>
  if (res.chua_cai) return <AppShell><div className="pl-ui p-8 text-sm text-gray-600">Phân hệ Pháp lý chưa được cài trên cơ sở dữ liệu này (chưa chạy <code>sql/56_phap_ly_ho_so.sql</code>).</div></AppShell>

  const { the = {}, q: quyen = {}, nhan_vien: nv = [] } = res
  const taoDuoc = quyen.sua || quyen.ca_phong
  const bam = k => setLoc(v => (v === k ? '' : k))

  return (
    <AppShell>
      <div className="pl-ui">
        <div className="px-4 md:px-8 py-5 space-y-4">
          <PageHead title="Hồ sơ pháp lý" sub={quyen.ca_phong ? 'Toàn phòng Pháp lý' : 'Hồ sơ bạn phụ trách + hồ sơ chưa ai nhận'}>
            {taoDuoc && <button className={btnPrimary} onClick={() => setMoTao(true)}>+ Tiếp nhận hồ sơ</button>}
          </PageHead>
          <ThanhPhapLy dang="/phaply" />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <StatCard label="Đang xử lý" value={fmt(the.dang_lam)} tone="wine" onClick={() => setLoc('')} on={!loc} />
            <StatCard label="Chờ khách" value={fmt(the.cho_khach)} tone="amb" onClick={() => bam('khach')} on={loc === 'khach'} />
            <StatCard label="Chờ Sở / Thuế" value={fmt(the.cho_co_quan)} tone="blue" onClick={() => bam('co_quan')} on={loc === 'co_quan'} />
            <StatCard label="Cần bổ sung" value={fmt(the.bo_sung)} tone="red" onClick={() => bam('bo_sung')} on={loc === 'bo_sung'} />
            <StatCard label="Trễ hạn nội bộ" value={fmt(the.tre_han)} tone="red" onClick={() => bam('tre')} on={loc === 'tre'} />
            <StatCard label="Chưa giao" value={fmt(the.chua_giao)} tone="sky" onClick={() => bam('chua_giao')} on={loc === 'chua_giao'} />
            {quyen.tien && <StatCard label="Nợ đến hạn" value={fmt(the.no_den_han)} unit="đ" tone="gold" onClick={() => bam('no')} on={loc === 'no'} />}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1">
              <button className={'p-chip' + (xem === 'ds' ? ' on' : '')} onClick={() => setXem('ds')}>Danh sách</button>
              <button className={'p-chip' + (xem === 'buoc' ? ' on' : '')} onClick={() => setXem('buoc')}>Theo bước</button>
            </div>
            <input className={inputCls + ' !w-64'} placeholder="Tìm mã, tên, SĐT, MST…" value={q} onChange={e => setQ(e.target.value)} />
            <select className={inputCls + ' !w-auto'} value={fThuTuc} onChange={e => setFThuTuc(e.target.value)}>
              <option value="">Mọi thủ tục</option>
              {THU_TUC.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
            </select>
            {quyen.ca_phong && (
              <select className={inputCls + ' !w-auto'} value={fNv} onChange={e => setFNv(e.target.value)}>
                <option value="">Mọi người phụ trách</option>
                <option value="_">(Chưa giao)</option>
                {nv.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}
              </select>
            )}
            <label className="text-sm flex items-center gap-1.5 ml-auto"><input type="checkbox" checked={coDong} onChange={e => setCoDong(e.target.checked)} /> Gồm hồ sơ đã đóng</label>
          </div>

          {xem === 'ds' ? <BangDanhSach ds={ds} tien={quyen.tien} moi={id => router.push('/phaply/ho-so/' + id)} />
            : <BangTheoBuoc ds={ds} coDong={coDong} tien={quyen.tien} moi={id => router.push('/phaply/ho-so/' + id)} />}
        </div>
        {moTao && <TaoHoSo quyen={quyen} nv={nv} toi={res.toi} onClose={() => setMoTao(false)} toast={toast}
          onDone={id => { setMoTao(false); router.push('/phaply/ho-so/' + id) }} />}
        {toastNode}
      </div>
    </AppShell>
  )
}

function BangDanhSach({ ds, tien, moi }) {
  if (!ds.length) return <div className="p-panel p-8 text-center text-sm text-gray-500">Không có hồ sơ nào khớp bộ lọc.</div>
  return (
    <div className="p-panel overflow-x-auto">
      <table className="p-tbl">
        <thead><tr>
          <th className="l">Mã</th><th className="l">Hồ sơ</th><th>Bước</th><th>Việc bước này</th><th className="l">Phụ trách</th>
          <th>Nhận</th><th>Hạn</th>{tien && <><th className="r">Phí</th><th className="r">Đã thu</th><th className="r">Nợ đến hạn</th></>}
        </tr></thead>
        <tbody>
          {ds.map(r => (
            <tr key={r.id} className="p-click" onClick={() => moi(r.id)}>
              <td className="l num whitespace-nowrap">{r.code}</td>
              <td className="l">
                <div className="font-semibold">{r.ten_phap_nhan || r.contact_name || r.title}</div>
                <div className="text-xs text-gray-500">{thuTucLabel(r.procedure_code)} · {loaiHinhLabel(r.entity_type, true)}{r.contact_phone ? ' · ' + r.contact_phone : ''}</div>
              </td>
              <td><div className="flex flex-col items-center gap-1"><BuocChip stage={r.stage} /><ChoChip k={r.wait_state} /></div></td>
              <td className="num">{r.viec_buoc.tong ? `${r.viec_buoc.xong}/${r.viec_buoc.tong}` : '—'}</td>
              <td className="l">{r.ten_phu_trach || <span className="text-amber-700 font-medium">Chưa giao</span>}</td>
              <td className="num whitespace-nowrap">{dmy(r.received_at)}</td>
              <td className={'num whitespace-nowrap' + (r.tre_han ? ' text-red-700 font-bold' : '')}>{r.due_at ? dmy(r.due_at) : '—'}{r.tre_han && ' ⚠'}</td>
              {tien && <>
                <td className="r num">{fmt(r.phi)}</td><td className="r num">{fmt(r.da_thu)}</td>
                <td className={'r num' + (r.no_den_han > 0 ? ' text-red-700 font-semibold' : '')}>{fmt(r.no_den_han)}</td>
              </>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BangTheoBuoc({ ds, coDong, tien, moi }) {
  const cot = BUOC.filter(b => coDong || b.n < BUOC_DONG)
  return (
    <div className="p-kanban">
      {cot.map(b => {
        const x = ds.filter(r => r.stage === b.n)
        return (
          <div key={b.n} className="p-col">
            <div className="p-col-h"><span>{b.n}. {b.label}</span><span className="num text-gray-500">{x.length}</span></div>
            <div className="pb-2">
              {x.map(r => (
                <div key={r.id} className="p-the" onClick={() => moi(r.id)}>
                  <div className="flex justify-between gap-2"><span className="num text-xs text-gray-500">{r.code}</span><ChoChip k={r.wait_state} /></div>
                  <div className="font-semibold leading-snug mt-0.5">{r.ten_phap_nhan || r.contact_name || r.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{thuTucLabel(r.procedure_code)} · {r.ten_phu_trach || 'Chưa giao'}</div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className={r.tre_han ? 'text-red-700 font-bold' : 'text-gray-500'}>Hạn {r.due_at ? dmy(r.due_at) : '—'}</span>
                    {tien && r.no_den_han > 0 && <span className="text-red-700 font-semibold num">Nợ {fmt(r.no_den_han)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TaoHoSo({ quyen, nv, toi, onClose, onDone, toast }) {
  const [f, setF] = useState({
    procedure_code: 'tlm', entity_type: '1tv', ten_phap_nhan: '', mst: '', contact_name: '', contact_phone: '', contact_email: '',
    source: 'moi', received_at: homNayVN(), assigned_to: quyen.ca_phong ? '' : toi, note: '', phi_dv: 0, phi_th: 0, lich_mau_id: '',
  })
  const [lichMau, setLichMau] = useState([])
  const [dang, setDang] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  useEffect(() => { if (quyen.tien) api('/api/admin/phaply/mau').then(r => r.ok && setLichMau(r.data.lich_mau || [])) }, [quyen.tien])

  const luu = async () => {
    setDang(true)
    const phi = []
    if (f.phi_dv > 0) phi.push({ kind: 'dich_vu', name: 'Phí dịch vụ', amount: f.phi_dv })
    if (f.phi_th > 0) phi.push({ kind: 'thu_ho', name: 'Lệ phí, chi phí thu hộ', amount: f.phi_th })
    const r = await api('/api/admin/phaply/ho-so', { method: 'POST', body: { ...f, phi, lich_mau_id: f.lich_mau_id || null } })
    setDang(false)
    if (!r.ok) return toast(r.data.error || 'Không tạo được hồ sơ', true)
    toast('Đã tạo hồ sơ ' + r.data.code)
    onDone(r.data.id)
  }

  return (
    <Modal title="Tiếp nhận hồ sơ pháp lý" onClose={onClose} wide
      footer={<><button className={btnGhost} onClick={onClose}>Huỷ</button><button className={btnPrimary} disabled={dang} onClick={luu}>{dang ? 'Đang tạo…' : 'Tạo hồ sơ'}</button></>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Thủ tục"><select className={inputCls} value={f.procedure_code} onChange={e => set('procedure_code', e.target.value)}>
          {THU_TUC.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Loại hình"><select className={inputCls} value={f.entity_type} onChange={e => set('entity_type', e.target.value)}>
          {LOAI_HINH.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Tên doanh nghiệp" hint={f.procedure_code === 'tlm' ? 'tên dự kiến, sửa sau được' : ''} className="md:col-span-2">
          <input className={inputCls} value={f.ten_phap_nhan} onChange={e => set('ten_phap_nhan', e.target.value)} placeholder="CÔNG TY TNHH …" /></Field>
        <Field label="Mã số thuế" hint="nếu đã có"><input className={inputCls + ' num'} value={f.mst} onChange={e => set('mst', e.target.value)} /></Field>
        <Field label="Nguồn khách"><select className={inputCls} value={f.source} onChange={e => set('source', e.target.value)}>
          {NGUON.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Người liên hệ"><input className={inputCls} value={f.contact_name} onChange={e => set('contact_name', e.target.value)} /></Field>
        <Field label="Số điện thoại"><input className={inputCls + ' num'} value={f.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></Field>
        <Field label="Email" hint="tuỳ chọn"><input className={inputCls} value={f.contact_email} onChange={e => set('contact_email', e.target.value)} /></Field>
        <Field label="Ngày nhận hồ sơ"><input type="date" className={inputCls} value={f.received_at} onChange={e => set('received_at', e.target.value)} /></Field>
        {quyen.ca_phong && (
          <Field label="Giao cho"><select className={inputCls} value={f.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)}>
            <option value="">(Chưa giao — ai trong phòng cũng nhận được)</option>
            {nv.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}</select></Field>
        )}
        <Field label="Ghi chú" className="md:col-span-2"><textarea rows={2} className={inputCls} value={f.note} onChange={e => set('note', e.target.value)} /></Field>
        {quyen.tien && <>
          <div className="md:col-span-2 text-xs font-semibold text-gray-500 pt-1 border-t">Phí (gồm VAT) — nhập sau ở tab Công nợ cũng được</div>
          <Field label="Phí dịch vụ" hint="doanh số"><NumInput value={f.phi_dv} onChange={v => set('phi_dv', v)} /></Field>
          <Field label="Thu hộ" hint="lệ phí Sở, dấu, chữ ký số…"><NumInput value={f.phi_th} onChange={v => set('phi_th', v)} /></Field>
          <Field label="Lịch thu" className="md:col-span-2"><select className={inputCls} value={f.lich_mau_id} onChange={e => set('lich_mau_id', e.target.value)}>
            <option value="">(Lập lịch thu sau)</option>
            {lichMau.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          {f.phi_dv + f.phi_th > 0 && <div className="md:col-span-2 text-sm text-right">Tổng: <b className="num">{fmtMoney(f.phi_dv + f.phi_th)}</b></div>}
        </>}
      </div>
    </Modal>
  )
}
