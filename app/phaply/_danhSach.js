'use client'
// Phân hệ Pháp lý — KHUÔN trang danh sách hồ sơ theo NHÓM thủ tục (anh yêu cầu 17/11/2026: Thành lập · Thay đổi · Tạm ngừng · Giải thể ·
// Khác mỗi nhóm một trang riêng). /phaply = tất cả. Thủ tục làm trên công ty ĐÃ CÓ → tạo hồ sơ bắt đầu bằng CHỌN CÔNG TY (dùng lại
// doanh nghiệp, người, CCCD, ngành nghề). Trang Tạm ngừng có khung THEO DÕI THỜI HẠN (cả hồ sơ đã đóng) để nhắc khách.
// Phạm vi lọc ở MÁY CHỦ (nhân viên: hồ sơ mình + chưa ai nhận; trưởng phòng: cả phòng).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { THU_TUC, LOAI_HINH, NGUON, BUOC, BUOC_DONG, thuTucLabel, loaiHinhLabel, homNayVN } from '@/lib/phaply/hoSo'
import { NHOM, nhomCuaThuTuc, NOI_DUNG_THAY_DOI, noiDungLabel, congNgay, denToiDa, hanThongBao, kiemTamNgung, MUC_TAM_NGUNG, canNhac } from '@/lib/phaply/nhom'
import {
  PageHead, StatCard, Modal, Field, NumInput, inputCls, btnPrimary, btnGhost, useToast, api, fmt, fmtMoney, dmy, dmyTime,
  BuocChip, ChoChip, ThanhPhapLy, Nhan,
} from './_ui'

const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function TrangDanhSach({ nhom = null }) {
  const router = useRouter()
  const sp = useSearchParams()
  const N = nhom ? NHOM[nhom] : null
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [coDong, setCoDong] = useState(false)
  const [xem, setXem] = useState('ds')            // ds | buoc
  const [loc, setLoc] = useState('')              // khoá thẻ số liệu đang lọc
  const [q, setQ] = useState('')
  const [fThuTuc, setFThuTuc] = useState('')
  const [fNv, setFNv] = useState('')
  const [moTao, setMoTao] = useState(null)        // null | { preset }
  const [toastNode, toast] = useToast()

  const load = useCallback(async () => {
    const r = await api('/api/admin/phaply/ho-so?' + new URLSearchParams({ ...(coDong ? { dong: '1' } : {}), ...(nhom ? { nhom } : {}) }))
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { router.push('/dashboard'); return }
    if (!r.ok) { toast(r.data.error || 'Không tải được danh sách', true); setLoading(false); return }
    setRes(r.data); setLoading(false)
  }, [router, coDong, nhom]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const { data: sd } = await createClient().auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      load()
    })()
  }, [load, router])

  // Mở sẵn hộp tạo hồ sơ tiếp theo từ trang hồ sơ: ?tiep=<id hồ sơ gốc>&loai=hoat_dong_lai|gia_han|thay_doi|giai_the
  useEffect(() => {
    const tiep = sp.get('tiep'), loai = sp.get('loai')
    if (!tiep || !loai) return
    api('/api/admin/phaply/ho-so/' + tiep).then(r => {
      if (!r.ok) return
      setMoTao({ preset: presetTiepTheo(r.data.ho_so, r.data.phap_nhan, loai) })
      router.replace(N?.duong || '/phaply')
    })
  }, [sp]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const thuTucNhom = THU_TUC.filter(t => !N || N.thuTuc.includes(t.k))

  return (
    <AppShell>
      <div className="pl-ui">
        <div className="px-4 md:px-8 py-5 space-y-4">
          <PageHead icon="⚖️" title="Hồ sơ pháp lý" sub={(N ? N.ten + ' · ' : 'Tất cả thủ tục · ') + (quyen.ca_phong ? 'toàn phòng Pháp lý' : 'hồ sơ bạn phụ trách + hồ sơ chưa ai nhận')}>
            {taoDuoc && <button className={btnPrimary} onClick={() => setMoTao({ preset: { procedure_code: N?.thuTuc[0] || 'tlm' } })}>+ Tiếp nhận hồ sơ</button>}
          </PageHead>
          <ThanhPhapLy dang={N?.duong || '/phaply'} />

          {the.tam_ngung_can_nhac > 0 && nhom !== 'tam_ngung' && (
            <Link href={NHOM.tam_ngung.duong} className="block rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              ⏰ <b>{the.tam_ngung_can_nhac} công ty sắp hết / đã hết thời hạn tạm ngừng</b> — cần nhắc khách hoạt động lại hoặc gia hạn. Bấm để xem →
            </Link>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <StatCard label="● Đang xử lý" value={fmt(the.dang_lam)} tone="blue" onClick={() => setLoc('')} on={!loc} />
            <StatCard label="● Chờ khách" value={fmt(the.cho_khach)} tone="amb" onClick={() => bam('khach')} on={loc === 'khach'} />
            <StatCard label="● Chờ Sở / Thuế" value={fmt(the.cho_co_quan)} tone="tim" onClick={() => bam('co_quan')} on={loc === 'co_quan'} />
            <StatCard label="● Cần bổ sung" value={fmt(the.bo_sung)} tone="red" onClick={() => bam('bo_sung')} on={loc === 'bo_sung'} />
            <StatCard label="⚠ Trễ hạn nội bộ" value={fmt(the.tre_han)} tone="wine" onClick={() => bam('tre')} on={loc === 'tre'} />
            <StatCard label="● Chưa giao" value={fmt(the.chua_giao)} tone="xam" onClick={() => bam('chua_giao')} on={loc === 'chua_giao'} />
            {quyen.tien && <StatCard label="₫ Nợ đến hạn" value={fmt(the.no_den_han)} unit="đ" tone="gold" onClick={() => bam('no')} on={loc === 'no'} />}
          </div>

          {nhom === 'tam_ngung' && <TheoDoiTamNgung ds={res.theo_doi_tam_ngung || []} sua={taoDuoc} toast={toast} load={load}
            taoTiep={(c, loai) => api('/api/admin/phaply/ho-so/' + c.id).then(r => r.ok && setMoTao({ preset: presetTiepTheo(r.data.ho_so, r.data.phap_nhan, loai) }))} />}

          <div className="flex gap-2 flex-wrap items-center">
            <input className={inputCls + ' !w-72'} placeholder="🔎 Tìm mã, tên, SĐT, MST…" value={q} onChange={e => setQ(e.target.value)} />
            {thuTucNhom.length > 1 && (
              <select className={inputCls + ' !w-auto'} value={fThuTuc} onChange={e => setFThuTuc(e.target.value)}>
                <option value="">Mọi thủ tục</option>
                {thuTucNhom.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
            )}
            {quyen.ca_phong && (
              <select className={inputCls + ' !w-auto'} value={fNv} onChange={e => setFNv(e.target.value)}>
                <option value="">Mọi người phụ trách</option>
                <option value="_">(Chưa giao)</option>
                {nv.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}
              </select>
            )}
            <div className="p-seg">
              <button className={xem === 'ds' ? 'on' : ''} onClick={() => setXem('ds')}>Danh sách</button>
              <button className={xem === 'buoc' ? 'on' : ''} onClick={() => setXem('buoc')}>Theo bước</button>
            </div>
            <label className="text-sm text-gray-600 flex items-center gap-1.5 ml-auto"><input type="checkbox" checked={coDong} onChange={e => setCoDong(e.target.checked)} /> Gồm hồ sơ đã đóng</label>
          </div>

          {xem === 'ds' ? <BangDanhSach ds={ds} tien={quyen.tien} nhom={nhom} moi={id => router.push('/phaply/ho-so/' + id)} />
            : <BangTheoBuoc ds={ds} coDong={coDong} tien={quyen.tien} moi={id => router.push('/phaply/ho-so/' + id)} />}
        </div>
        {moTao && <TaoHoSo quyen={quyen} nv={nv} toi={res.toi} nhom={nhom} preset={moTao.preset} onClose={() => setMoTao(null)} toast={toast}
          onDone={id => { setMoTao(null); router.push('/phaply/ho-so/' + id) }} />}
        {toastNode}
      </div>
    </AppShell>
  )
}

// Hồ sơ tiếp theo dựng từ hồ sơ gốc (cùng công ty): hoạt động lại / gia hạn tạm ngừng / thay đổi / giải thể
export function presetTiepTheo(hs, pn, loai) {
  const chung = { entity_id: hs.entity_id, cong_ty: pn ? { id: pn.id, name: pn.name, tax_code: pn.tax_code, entity_type: pn.entity_type } : null,
    case_goc_id: hs.id, contact_name: hs.contact_name || '', contact_phone: hs.contact_phone || '', contact_email: hs.contact_email || '' }
  if (loai === 'gia_han' && hs.tam_ngung_den) {
    const tu = congNgay(hs.tam_ngung_den, 1)
    return { ...chung, procedure_code: 'tam_ngung', tam_ngung_tu: tu, tam_ngung_den: denToiDa(tu), note: `Gia hạn tạm ngừng tiếp theo hồ sơ ${hs.code}` }
  }
  if (loai === 'hoat_dong_lai') return { ...chung, procedure_code: 'hoat_dong_lai', hoat_dong_lai_tu: hs.tam_ngung_den ? congNgay(hs.tam_ngung_den, 1) : '' }
  return { ...chung, procedure_code: loai }
}

// ─── Theo dõi thời hạn tạm ngừng ──────────────────────────────────────────────────────────────────────────
function TheoDoiTamNgung({ ds, sua, toast, load, taoTiep }) {
  const [nhac, setNhac] = useState(null)
  const canN = ds.filter(c => canNhac(c.muc))
  return (
    <div className="p-panel overflow-x-auto">
      <div className="p-panel-h flex justify-between items-center gap-2">
        <span>⏰ Theo dõi thời hạn tạm ngừng ({ds.length})</span>
        <span className={'text-xs px-2 py-0.5 rounded-full ' + (canN.length ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800')}>
          {canN.length ? `${canN.length} công ty cần nhắc khách` : 'chưa có công ty sắp hết hạn'}</span>
      </div>
      {!ds.length ? <div className="px-4 py-3 text-sm text-gray-400">Chưa có lần tạm ngừng nào ghi thời hạn. Ghi ở hồ sơ tạm ngừng (tab Thông tin) — app tự nhắc khi còn 30 ngày.</div> : (
        <table className="p-tbl w-full">
          <thead><tr><th className="l">Công ty</th><th className="l">Tạm ngừng</th><th className="l">Trạng thái</th><th className="l">Hạn nộp thông báo tiếp</th><th className="l">Đã nhắc</th><th className="l">Xử lý</th></tr></thead>
          <tbody>
            {ds.map(c => {
              const m = MUC_TAM_NGUNG[c.muc]
              return (
                <tr key={c.id}>
                  <td className="l"><Link className="font-semibold underline" href={'/phaply/ho-so/' + c.id}>{c.ten_phap_nhan}</Link>
                    <div className="text-xs text-gray-500">{c.code}{c.mst ? ' · MST ' + c.mst : ''} · {c.ten_phu_trach || 'Chưa giao'}{c.contact_phone ? ' · ' + c.contact_phone : ''}</div></td>
                  <td className="l num whitespace-nowrap">{dmy(c.tam_ngung_tu)} → <b>{dmy(c.tam_ngung_den)}</b></td>
                  <td className="l"><span className="text-xs px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: m.mau }}>{m.label}</span>
                    {c.muc !== 'da_xu_ly' && c.muc !== 'chua_bat_dau' && <div className="text-xs mt-0.5">{c.con_ngay >= 0 ? `còn ${c.con_ngay} ngày` : `quá ${-c.con_ngay} ngày`}</div>}
                    {c.tiep_theo && <div className="text-xs mt-0.5"><Link className="underline" href={'/phaply/ho-so/' + c.tiep_theo.id}>{c.tiep_theo.ma}</Link> · {c.tiep_theo.thu_tuc}</div>}</td>
                  <td className="l num whitespace-nowrap">{c.muc !== 'da_xu_ly' && c.han_thong_bao_tiep ? dmy(c.han_thong_bao_tiep) : '—'}</td>
                  <td className="l text-xs">{c.nhac_khach_luc ? <>{dmyTime(c.nhac_khach_luc)}{c.nhac_khach_ghi_chu && <div className="text-gray-500">{c.nhac_khach_ghi_chu}</div>}</> : <span className="text-gray-400">chưa</span>}</td>
                  <td className="l">{sua && c.muc !== 'da_xu_ly' && <div className="flex gap-1 flex-wrap">
                    <button className="p-btn p-btn-sm" onClick={() => setNhac(c)}>Đã nhắc khách</button>
                    <button className="p-btn p-btn-sm" onClick={() => taoTiep(c, 'hoat_dong_lai')}>Hoạt động lại</button>
                    <button className="p-btn p-btn-sm" onClick={() => taoTiep(c, 'gia_han')}>Gia hạn</button>
                    <button className="p-btn p-btn-sm" onClick={() => taoTiep(c, 'giai_the')}>Giải thể</button>
                  </div>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="px-4 py-2 text-xs text-gray-500">Mỗi lần tạm ngừng tối đa 1 năm. Muốn gia hạn hoặc hoạt động lại trước hạn: nộp thông báo chậm nhất 3 ngày làm việc trước ngày đó (Luật Doanh nghiệp 2020, Đ.206). App nhắc khi còn 30 ngày, báo đỏ khi còn 7 ngày.</div>
      {nhac && <NhacKhach c={nhac} onClose={() => setNhac(null)} toast={toast} load={load} />}
    </div>
  )
}

function NhacKhach({ c, onClose, toast, load }) {
  const [note, setNote] = useState('')
  const [dang, setDang] = useState(false)
  const luu = async () => {
    setDang(true)
    const r = await api('/api/admin/phaply/ho-so/' + c.id, { method: 'PATCH', body: { action: 'nhac_khach', note } })
    setDang(false)
    if (!r.ok) return toast(r.data.error || 'Không lưu được', true)
    toast('Đã ghi nhắc khách'); onClose(); load()
  }
  return (
    <Modal title={`Đã nhắc khách — ${c.ten_phap_nhan}`} onClose={onClose}
      footer={<><button className={btnGhost} onClick={onClose}>Huỷ</button><button className={btnPrimary} disabled={dang} onClick={luu}>Lưu</button></>}>
      <div className="text-sm mb-2">Tạm ngừng tới <b>{dmy(c.tam_ngung_den)}</b>. Khách trả lời thế nào?</div>
      <textarea rows={3} className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="VD: khách muốn gia hạn thêm 1 năm, gửi hồ sơ tuần sau…" autoFocus />
    </Modal>
  )
}

function BangDanhSach({ ds, tien, nhom, moi }) {
  if (!ds.length) return <div className="p-panel p-8 text-center text-sm text-gray-500">Không có hồ sơ nào khớp bộ lọc.</div>
  return (
    <div className="p-panel p-scroll">
      <table className="p-tbl">
        <thead><tr>
          <th className="l w-[104px]">Mã</th><th className="l">Hồ sơ</th><th className="l w-[200px]">Bước · tình trạng</th><th className="w-[120px]">Việc bước này</th>
          <th className="l w-[140px]">Phụ trách</th><th className="w-[116px]">Nhận → Hạn</th>{tien && <><th className="r w-[110px]">Phí</th><th className="r w-[110px]">Nợ đến hạn</th></>}
        </tr></thead>
        <tbody>
          {ds.map(r => (
            <tr key={r.id} className="p-click" onClick={() => moi(r.id)}>
              <td className="l num whitespace-nowrap font-bold text-[#8B1A1A]">{r.code}</td>
              <td className="l">
                <div className="font-bold">{r.ten_phap_nhan || r.contact_name || r.title}</div>
                <div className="text-xs text-gray-500">{thuTucLabel(r.procedure_code)} · {loaiHinhLabel(r.entity_type, true)}{r.mst ? ' · MST ' + r.mst : ''}{r.contact_phone ? ' · ' + r.contact_phone : ''}</div>
                {r.procedure_code === 'thay_doi' && r.noi_dung_thay_doi?.length > 0 && <div className="flex gap-1 flex-wrap mt-1">
                  {r.noi_dung_thay_doi.map(k => <span key={k} className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800">{noiDungLabel(k)}</span>)}</div>}
                {r.procedure_code === 'tam_ngung' && r.tam_ngung_den && <div className="text-xs text-blue-800 mt-0.5">Tạm ngừng {dmy(r.tam_ngung_tu)} → {dmy(r.tam_ngung_den)}</div>}
                {r.procedure_code === 'hoat_dong_lai' && r.hoat_dong_lai_tu && <div className="text-xs text-green-800 mt-0.5">Hoạt động lại từ {dmy(r.hoat_dong_lai_tu)}</div>}
              </td>
              <td className="l"><div className="flex flex-wrap gap-1"><BuocChip stage={r.stage} /><ChoChip k={r.wait_state} />{!r.assigned_to && <Nhan>Chưa giao</Nhan>}</div></td>
              <td className="num whitespace-nowrap">{r.viec_buoc.tong
                ? <span className="p-tien"><i><b style={{ width: Math.round(100 * r.viec_buoc.xong / r.viec_buoc.tong) + '%' }} /></i>{r.viec_buoc.xong}/{r.viec_buoc.tong}</span> : '—'}</td>
              <td className="l">{r.ten_phu_trach || <span className="text-gray-400">—</span>}</td>
              <td className="num whitespace-nowrap"><div className="text-xs text-gray-500">{dmy(r.received_at)}</div>
                <div className={r.tre_han ? 'text-red-700 font-bold' : ''}>{r.due_at ? dmy(r.due_at) : '—'}{r.tre_han && ' ⚠'}</div></td>
              {tien && <>
                <td className="r num">{fmt(r.phi)}</td>
                <td className={'r num' + (r.no_den_han > 0 ? ' text-amber-700 font-bold' : '')} title={'Đã thu ' + fmt(r.da_thu)}>{fmt(r.no_den_han)}</td>
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

// ─── Chọn công ty đã có (hồ sơ pháp lý cũ / khách kế toán) ─────────────────────────────────────────────────
function ChonCongTy({ chon, onChon }) {
  const [tim, setTim] = useState('')
  const [kq, setKq] = useState(null)
  useEffect(() => {
    const t = tim.trim()
    if (t.length < 2) { setKq(null); return }
    const h = setTimeout(() => api('/api/admin/phaply/doanh-nghiep?q=' + encodeURIComponent(t)).then(r => r.ok && setKq(r.data)), 300)
    return () => clearTimeout(h)
  }, [tim])
  if (chon) return (
    <div className="rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 flex items-start gap-2">
      <div className="flex-1 text-sm"><b>{chon.name || '(chưa có tên)'}</b>{chon.tax_code ? <span className="num"> · MST {chon.tax_code}</span> : ''}
        <div className="text-xs text-gray-600">{chon.nguon === 'ke_toan' ? 'Khách kế toán — app tạo hồ sơ công ty mới từ thông tin này' : 'Dùng lại doanh nghiệp, người, CCCD, ngành nghề đã nhập ở hồ sơ trước'}</div></div>
      <button className="p-btn p-btn-sm" onClick={() => onChon(null)}>Đổi</button>
    </div>
  )
  return (
    <div className="space-y-2">
      <input className={inputCls} value={tim} onChange={e => setTim(e.target.value)} placeholder="Gõ tên công ty hoặc MST (≥ 2 ký tự)…" autoFocus />
      {kq && (
        <div className="rounded-lg border max-h-72 overflow-y-auto divide-y">
          {kq.phap_ly.map(e => (
            <button key={e.id} type="button" className="block w-full text-left px-3 py-2 hover:bg-amber-50" onClick={() => onChon({ ...e, nguon: 'phap_ly' })}>
              <div className="text-sm font-semibold">{e.name}{e.tax_code && <span className="num font-normal text-gray-500"> · {e.tax_code}</span>}</div>
              <div className="text-xs text-gray-500">⚖️ Đã có hồ sơ pháp lý: {e.ho_so.map(h => `${h.ma} ${h.thu_tuc}`).join(' · ')}</div>
            </button>
          ))}
          {kq.ke_toan.map(c => (
            <button key={c.id} type="button" className="block w-full text-left px-3 py-2 hover:bg-amber-50" onClick={() => onChon({ ...c, nguon: 'ke_toan' })}>
              <div className="text-sm font-semibold">{c.name}{c.tax_code && <span className="num font-normal text-gray-500"> · {c.tax_code}</span>}</div>
              <div className="text-xs text-gray-500">📒 Khách kế toán{c.client_code ? ' ' + c.client_code : ''}{c.representative ? ' · ' + c.representative : ''}</div>
            </button>
          ))}
          {!kq.phap_ly.length && !kq.ke_toan.length && <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy — nhập tên công ty mới ở ô bên dưới.</div>}
        </div>
      )}
    </div>
  )
}

function TaoHoSo({ quyen, nv, toi, nhom, preset = {}, onClose, onDone, toast }) {
  const [f, setF] = useState(() => ({
    procedure_code: 'tlm', entity_type: '1tv', ten_phap_nhan: '', mst: '', contact_name: '', contact_phone: '', contact_email: '',
    source: 'khach_cu', received_at: homNayVN(), assigned_to: quyen.ca_phong ? '' : toi, note: '', phi_dv: 0, phi_th: 0, lich_mau_id: '',
    noi_dung_thay_doi: [], tam_ngung_tu: '', tam_ngung_den: '', hoat_dong_lai_tu: '', ...preset,
    ...(preset.procedure_code === 'tlm' || !preset.procedure_code ? { source: 'moi' } : {}),
  }))
  const [congTy, setCongTy] = useState(preset.cong_ty ? { ...preset.cong_ty, nguon: 'phap_ly' } : null)
  const [lichMau, setLichMau] = useState([])
  const [dang, setDang] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  useEffect(() => { if (quyen.tien) api('/api/admin/phaply/mau').then(r => r.ok && setLichMau(r.data.lich_mau || [])) }, [quyen.tien])
  const nhomTT = nhomCuaThuTuc(f.procedure_code)
  const coSan = NHOM[nhomTT].coSan
  const thuTucDuoc = THU_TUC.filter(t => !nhom || NHOM[nhom].thuTuc.includes(t.k))
  const loiTN = f.procedure_code === 'tam_ngung' && (f.tam_ngung_tu || f.tam_ngung_den) ? kiemTamNgung(f.tam_ngung_tu, f.tam_ngung_den) : null

  const chonCongTy = c => {
    setCongTy(c)
    if (c?.nguon === 'phap_ly' && c.lien_he) setF(o => ({ ...o, contact_name: o.contact_name || c.lien_he.ten, contact_phone: o.contact_phone || c.lien_he.sdt, contact_email: o.contact_email || c.lien_he.email, entity_type: c.entity_type || o.entity_type }))
    if (c?.nguon === 'ke_toan') setF(o => ({ ...o, contact_name: o.contact_name || c.representative || '' }))
  }
  const luu = async () => {
    if (loiTN) return toast(loiTN, true)
    setDang(true)
    const phi = []
    if (f.phi_dv > 0) phi.push({ kind: 'dich_vu', name: 'Phí dịch vụ', amount: f.phi_dv })
    if (f.phi_th > 0) phi.push({ kind: 'thu_ho', name: 'Lệ phí, chi phí thu hộ', amount: f.phi_th })
    const body = { ...f, phi, lich_mau_id: f.lich_mau_id || null,
      entity_id: congTy?.nguon === 'phap_ly' ? congTy.id : undefined, client_id: congTy?.nguon === 'ke_toan' ? congTy.id : undefined }
    delete body.cong_ty
    const r = await api('/api/admin/phaply/ho-so', { method: 'POST', body })
    setDang(false)
    if (!r.ok) return toast(r.data.error || 'Không tạo được hồ sơ', true)
    toast('Đã tạo hồ sơ ' + r.data.code)
    onDone(r.data.id)
  }

  return (
    <Modal title={preset.case_goc_id ? 'Tạo hồ sơ tiếp theo cho công ty' : 'Tiếp nhận hồ sơ pháp lý'} onClose={onClose} wide
      footer={<><button className={btnGhost} onClick={onClose}>Huỷ</button><button className={btnPrimary} disabled={dang || !!loiTN} onClick={luu}>{dang ? 'Đang tạo…' : 'Tạo hồ sơ'}</button></>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Thủ tục"><select className={inputCls} value={f.procedure_code} onChange={e => set('procedure_code', e.target.value)}>
          {thuTucDuoc.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Loại hình"><select className={inputCls} value={f.entity_type} disabled={congTy?.nguon === 'phap_ly'} onChange={e => set('entity_type', e.target.value)}>
          {LOAI_HINH.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>

        {coSan ? <>
          <Field label="Công ty" hint="chọn công ty đã có để dùng lại thông tin" className="md:col-span-2"><ChonCongTy chon={congTy} onChon={chonCongTy} /></Field>
          {!congTy && <>
            <Field label="Hoặc nhập công ty chưa có trong app" className="md:col-span-2"><input className={inputCls} value={f.ten_phap_nhan} onChange={e => set('ten_phap_nhan', e.target.value)} placeholder="CÔNG TY TNHH …" /></Field>
            <Field label="Mã số thuế"><input className={inputCls + ' num'} value={f.mst} onChange={e => set('mst', e.target.value)} /></Field><div />
          </>}
        </> : <>
          <Field label="Tên doanh nghiệp" hint="tên dự kiến, sửa sau được" className="md:col-span-2">
            <input className={inputCls} value={f.ten_phap_nhan} onChange={e => set('ten_phap_nhan', e.target.value)} placeholder="CÔNG TY TNHH …" /></Field>
        </>}

        {f.procedure_code === 'thay_doi' && (
          <Field label="Nội dung thay đổi (chọn được nhiều)" className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {NOI_DUNG_THAY_DOI.map(x => <label key={x.k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.noi_dung_thay_doi.includes(x.k)}
                onChange={e => set('noi_dung_thay_doi', e.target.checked ? [...f.noi_dung_thay_doi, x.k] : f.noi_dung_thay_doi.filter(k => k !== x.k))} />{x.label}</label>)}
            </div>
          </Field>
        )}
        {f.procedure_code === 'tam_ngung' && <>
          <Field label="Tạm ngừng từ ngày"><input type="date" className={inputCls} value={f.tam_ngung_tu} onChange={e => setF(o => ({ ...o, tam_ngung_tu: e.target.value, tam_ngung_den: o.tam_ngung_den || (e.target.value ? denToiDa(e.target.value) : '') }))} /></Field>
          <Field label="Đến ngày" hint="tối đa 1 năm"><input type="date" className={inputCls} value={f.tam_ngung_den} onChange={e => set('tam_ngung_den', e.target.value)} /></Field>
          <div className={'md:col-span-2 text-xs ' + (loiTN ? 'text-red-700' : 'text-gray-500')}>{loiTN || (f.tam_ngung_tu ? `Nộp thông báo chậm nhất ${dmy(hanThongBao(f.tam_ngung_tu))} (3 ngày làm việc trước ngày tạm ngừng). App nhắc khi còn 30 ngày tới ngày kết thúc.` : 'Ghi ngay hoặc ghi sau ở tab Thông tin của hồ sơ.')}</div>
        </>}
        {f.procedure_code === 'hoat_dong_lai' && <>
          <Field label="Hoạt động trở lại từ ngày"><input type="date" className={inputCls} value={f.hoat_dong_lai_tu} onChange={e => set('hoat_dong_lai_tu', e.target.value)} /></Field>
          <div className="text-xs text-gray-500 self-end pb-2">{f.hoat_dong_lai_tu ? `Nộp thông báo chậm nhất ${dmy(hanThongBao(f.hoat_dong_lai_tu))}` : ''}</div>
        </>}

        <Field label="Người liên hệ"><input className={inputCls} value={f.contact_name} onChange={e => set('contact_name', e.target.value)} /></Field>
        <Field label="Số điện thoại"><input className={inputCls + ' num'} value={f.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></Field>
        <Field label="Email" hint="tuỳ chọn"><input className={inputCls} value={f.contact_email} onChange={e => set('contact_email', e.target.value)} /></Field>
        <Field label="Nguồn khách"><select className={inputCls} value={f.source} onChange={e => set('source', e.target.value)}>
          {NGUON.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}</select></Field>
        <Field label="Ngày nhận hồ sơ"><input type="date" className={inputCls} value={f.received_at} onChange={e => set('received_at', e.target.value)} /></Field>
        {quyen.ca_phong ? (
          <Field label="Giao cho"><select className={inputCls} value={f.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)}>
            <option value="">(Chưa giao — ai trong phòng cũng nhận được)</option>
            {nv.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}</select></Field>
        ) : <div />}
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
