'use client'
// Phân hệ Pháp lý — tab "Trình ký & nộp" (GĐ 4, sql/58–59): trình ký từng tờ · các lần nộp + đồng hồ hạn · kết quả GCN · tệp scan lên Drive ·
// bàn giao (Biên bản bàn giao) · điều kiện đóng hồ sơ.
// Máy chủ kiểm lại quyền (app/api/admin/phaply/ho-so/[id]/nop, /tep) — ở đây chỉ ẩn nút cho gọn.
import { useCallback, useEffect, useState } from 'react'
import { Modal, Field, inputCls, btnPrimary, btnGhost, api, dmy, dmyTime } from '../../_ui'
import { mauCuaBo } from '@/lib/phaply/word/danhMuc'
import { dsBo, tenBo } from '@/lib/phaply/boHoSo'
import { CO_QUAN, KET_QUA, coQuanLabel, hanTheoDoi, soNgayToiHan } from '@/lib/phaply/nop'
import { THU_MUC } from '@/lib/phaply/drive'
import { homNayVN } from '@/lib/phaply/hoSo'


export default function TabNop({ id, sua, toast, taiLaiHoSo }) {
  const [d, setD] = useState(null)
  const load = useCallback(async () => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/nop`)
    setD(r.ok ? r.data : { loi: r.data.error || 'Không tải được' })
  }, [id])
  useEffect(() => { load() }, [load])
  if (!d) return <div className="p-panel p-6 text-sm text-gray-400">Đang tải…</div>
  if (d.loi) return <div className="p-panel p-6 text-sm text-red-700">{d.loi}</div>
  const coSua = sua && d.sua_duoc
  const goi = async (body, tb) => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/nop`, { method: 'PATCH', body })
    if (!r.ok) { toast(r.data.error || 'Không lưu được', true); return false }
    if (tb) toast(tb)
    await load(); if (body.action?.startsWith('nop')) taiLaiHoSo()
    return true
  }
  return (
    <div className="space-y-4">
      <NopHoSo d={d} sua={coSua} goi={goi} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {d.lh_mau && dsBo(d.bt).filter(b => mauCuaBo(b.dot, d.lh_mau, d.bt, d.don_vi).length).map(({ dot }) => <TrinhKy key={dot} dot={dot} d={d} sua={coSua} goi={goi} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KetQuaGcn d={d} sua={coSua} goi={goi} />
        <TepScan d={d} id={id} sua={coSua} toast={toast} load={load} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><BanGiao d={d} id={id} sua={coSua} goi={goi} toast={toast} /></div>
        <DieuKienDong ds={d.dieu_kien_dong || []} />
      </div>
    </div>
  )
}

// ─── Trình ký ─────────────────────────────────────────────────────────────────────────────────────────────
function TrinhKy({ dot, d, sua, goi }) {
  const bo = mauCuaBo(dot, d.lh_mau, d.bt, d.don_vi)
  const da = new Map(d.ky.filter(k => k.dot === dot).map(k => [k.ma, k]))
  const xong = bo.filter(m => da.has(m.ma)).length
  return (
    <div className="p-panel">
      <div className="p-panel-h flex justify-between gap-2"><span>Trình ký — {tenBo(d.bt, dot)}</span>
        <span className={'text-xs px-2 py-0.5 rounded-full ' + (xong === bo.length ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>{xong}/{bo.length} tờ đã ký</span></div>
      <table className="p-tbl w-full"><tbody>
        {bo.map(m => {
          const k = da.get(m.ma)
          return (
            <tr key={m.ma}>
              <td className="l w-8"><input type="checkbox" checked={!!k} disabled={!sua} onChange={e => goi({ action: 'ky', dot, ma: m.ma, da_ky: e.target.checked })} aria-label={'Đã ký ' + m.ten} /></td>
              <td className="l">{m.ten}<div className="text-xs text-gray-500">{m.nguoiKy[d.lh_mau]}</div></td>
              <td className="r text-xs text-gray-500 whitespace-nowrap">{k ? `${dmyTime(k.signed_at)}${k.ten_nguoi ? ' · ' + k.ten_nguoi : ''}` : ''}</td>
            </tr>
          )
        })}
      </tbody></table>
    </div>
  )
}

// ─── Nộp hồ sơ ────────────────────────────────────────────────────────────────────────────────────────────
function DemNgay({ han }) {
  const n = soNgayToiHan(han, homNayVN())
  if (n == null) return null
  const [cls, chu] = n < 0 ? ['bg-red-100 text-red-800', `quá hạn ${-n} ngày`] : n === 0 ? ['bg-amber-100 text-amber-900', 'hạn hôm nay'] : n <= 2 ? ['bg-amber-100 text-amber-900', `còn ${n} ngày`] : ['bg-gray-100 text-gray-700', `còn ${n} ngày`]
  return <span className={'text-xs px-1.5 py-0.5 rounded ' + cls}>{chu}</span>
}

function NopHoSo({ d, sua, goi }) {
  const [mo, setMo] = useState(null)
  return (
    <div className="p-panel">
      <div className="p-panel-h flex items-center justify-between gap-2">
        <span>Nộp hồ sơ & theo dõi ({d.nop.length} lần)</span>
        {sua && <button className="p-btn p-btn-sm" onClick={() => setMo({ co_quan: d.nop.some(s => s.co_quan === 'so' && s.ket_qua === 'dat') ? 'thue' : 'so', ngay_nop: homNayVN(), hinh_thuc: 'online', ket_qua: 'cho' })}>+ Ghi lần nộp</button>}
      </div>
      {!d.nop.length ? <div className="px-4 py-3 text-sm text-gray-400">Chưa nộp lần nào. Ghi lần nộp → hồ sơ tự chuyển trạng thái “Chờ Sở” / “Chờ Thuế”.</div> : (
        <div className="overflow-x-auto"><table className="p-tbl w-full">
          <thead><tr><th className="l">Lần</th><th className="l">Cơ quan</th><th className="l">Ngày nộp</th><th className="l">Mã biên nhận</th><th className="l">Kết quả</th><th className="l">Hạn theo dõi</th></tr></thead>
          <tbody>
            {[...d.nop].reverse().map(s => {
              const kq = KET_QUA.find(k => k.k === s.ket_qua)
              const han = hanTheoDoi(s)
              return (
                <tr key={s.id} className={sua ? 'p-click' : ''} onClick={() => sua && setMo(s)}>
                  <td className="l num">{s.lan}</td>
                  <td className="l">{coQuanLabel(s.co_quan)}<div className="text-xs text-gray-500">{s.hinh_thuc === 'giay' ? 'Nộp giấy' : 'Nộp online'}</div></td>
                  <td className="l num">{dmy(s.ngay_nop)}</td>
                  <td className="l num">{s.ma_bien_nhan || '—'}</td>
                  <td className="l"><span className="text-xs px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: kq?.mau }}>{kq?.label}</span>
                    {s.noi_dung_bo_sung && <div className="text-xs text-gray-600 mt-1 max-w-md whitespace-pre-wrap">{s.noi_dung_bo_sung}</div>}</td>
                  <td className="l whitespace-nowrap">{han ? <><span className="num">{dmy(han)}</span> <DemNgay han={han} /><div className="text-xs text-gray-500">{s.ket_qua === 'cho' ? 'hẹn trả kết quả' : 'hạn nộp bổ sung'}</div></> : s.ngay_ket_qua ? <span className="text-xs text-gray-500">có kết quả {dmy(s.ngay_ket_qua)}</span> : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      )}
      {mo && <SuaLanNop mo={mo} goi={goi} onClose={() => setMo(null)} />}
    </div>
  )
}

function SuaLanNop({ mo, goi, onClose }) {
  const [f, setF] = useState({ ...mo })
  const [dang, setDang] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const luu = async () => { setDang(true); const ok = await goi({ action: 'nop_luu', id: mo.id, fields: f }, 'Đã lưu lần nộp'); setDang(false); if (ok) onClose() }
  const xoa = async () => { if (confirm('Xoá lần nộp này?') && await goi({ action: 'nop_xoa', id: mo.id }, 'Đã xoá')) onClose() }
  const o = (lb, k, kieu = 'text', cls) => <Field label={lb} className={cls}><input type={kieu} className={inputCls + (kieu === 'date' ? ' num' : '')} value={f[k] || ''} onChange={e => set(k, e.target.value)} /></Field>
  return (
    <Modal title={mo.id ? `Lần nộp ${mo.lan} — ${coQuanLabel(mo.co_quan)}` : 'Ghi lần nộp hồ sơ'} onClose={onClose}
      footer={<>{mo.id && <button className="p-btn mr-auto text-red-700" onClick={xoa}>Xoá</button>}<button className={btnGhost} onClick={onClose}>Huỷ</button>
        <button className={btnPrimary} disabled={dang || !f.ngay_nop} onClick={luu}>Lưu</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nộp tới"><select className={inputCls} value={f.co_quan} onChange={e => set('co_quan', e.target.value)}>{CO_QUAN.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}</select></Field>
        <Field label="Hình thức"><select className={inputCls} value={f.hinh_thuc} onChange={e => set('hinh_thuc', e.target.value)}><option value="online">Nộp online</option><option value="giay">Nộp giấy</option></select></Field>
        {o('Ngày nộp', 'ngay_nop', 'date')}
        {o('Mã hồ sơ / số biên nhận', 'ma_bien_nhan')}
        {o('Ngày hẹn trả kết quả', 'ngay_hen_tra', 'date')}
        <Field label="Kết quả"><select className={inputCls} value={f.ket_qua} onChange={e => set('ket_qua', e.target.value)}>{KET_QUA.map(k => <option key={k.k} value={k.k}>{k.label}</option>)}</select></Field>
        {f.ket_qua !== 'cho' && o('Ngày có kết quả / thông báo', 'ngay_ket_qua', 'date')}
        {f.ket_qua === 'bo_sung' && o('Hạn nộp bổ sung', 'han_bo_sung', 'date')}
        {['bo_sung', 'tu_choi'].includes(f.ket_qua) && <Field label={f.ket_qua === 'bo_sung' ? 'Nội dung yêu cầu sửa đổi, bổ sung (bắt buộc)' : 'Lý do từ chối'} className="col-span-2">
          <textarea rows={3} className={inputCls} value={f.noi_dung_bo_sung || ''} onChange={e => set('noi_dung_bo_sung', e.target.value)} /></Field>}
        <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={f.ghi_chu || ''} onChange={e => set('ghi_chu', e.target.value)} /></Field>
      </div>
      <div className="text-xs text-gray-500 mt-3">Bổ sung xong nộp lại thì bấm “+ Ghi lần nộp” mới (lần 2, 3…), giữ lần cũ làm lịch sử.</div>
    </Modal>
  )
}

// ─── Kết quả GCN ──────────────────────────────────────────────────────────────────────────────────────────
function KetQuaGcn({ d, sua, goi }) {
  const dau = () => ({ ma_so: d.gcn.ma_so, ngay_cap: d.gcn.ngay_cap, noi_cap: d.gcn.noi_cap })
  const [f, setF] = useState(dau)
  useEffect(() => setF(dau()), [d]) // eslint-disable-line react-hooks/exhaustive-deps
  const doi = JSON.stringify(f) !== JSON.stringify(dau())
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  return (
    <div className="p-panel">
      <div className="p-panel-h">Kết quả — Giấy chứng nhận đăng ký doanh nghiệp</div>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Field label="Mã số doanh nghiệp (MST)"><input className={inputCls + ' num'} value={f.ma_so} disabled={!sua} placeholder="10 chữ số" onChange={e => set('ma_so', e.target.value)} /></Field>
        <Field label="Ngày đăng ký lần đầu"><input className={inputCls + ' num'} value={f.ngay_cap} disabled={!sua} placeholder="dd/mm/yyyy" onChange={e => set('ngay_cap', e.target.value)} /></Field>
        <Field label="Nơi cấp" className="col-span-2"><input className={inputCls} value={f.noi_cap} disabled={!sua} placeholder={d.gcn.goi_y_noi_cap} onChange={e => set('noi_cap', e.target.value)} /></Field>
        <div className="col-span-2 text-xs text-gray-500">Lưu mã số là bộ “Hồ sơ pháp lý ban đầu” tự có MST (khi bật “điền sẵn MST” ở tab Doanh nghiệp). Bản scan GCN tải ở khung Tệp scan → 7. KẾT QUẢ.</div>
      </div>
      {sua && <div className="px-4 pb-4 flex justify-end gap-2">
        {doi && <button className={btnGhost} onClick={() => setF(dau())}>Bỏ thay đổi</button>}
        <button className={btnPrimary} disabled={!doi} onClick={() => goi({ action: 'gcn', ...f, noi_cap: f.noi_cap || d.gcn.goi_y_noi_cap }, 'Đã lưu kết quả')}>Lưu kết quả</button>
      </div>}
    </div>
  )
}

// ─── Tệp scan lên Drive ───────────────────────────────────────────────────────────────────────────────────
function TepScan({ d, id, sua, toast, load }) {
  const [thuMuc, setThuMuc] = useState('trinh_ky')
  const [dang, setDang] = useState(false)
  const tai = async file => {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return toast('Tệp quá 4 MB — mở thư mục Drive của hồ sơ và kéo thả trực tiếp', true)
    setDang(true)
    const fd = new FormData(); fd.append('file', file); fd.append('thu_muc', thuMuc)
    try {
      const r = await fetch(`/api/admin/phaply/ho-so/${id}/tep`, { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return toast(j.error || 'Không tải được', true)
      toast('Đã lưu lên Drive: ' + THU_MUC[thuMuc]); load()
    } catch { toast('Mất kết nối — thử lại', true) } finally { setDang(false) }
  }
  const xoa = async f => {
    if (!confirm(`Bỏ "${f.ten}" vào thùng rác Drive?`)) return
    const r = await api(`/api/admin/phaply/ho-so/${id}/tep?id=${f.id}`, { method: 'DELETE' })
    if (!r.ok) return toast(r.data.error || 'Không xoá được', true)
    toast('Đã bỏ vào thùng rác Drive (khôi phục được 30 ngày)'); load()
  }
  return (
    <div className="p-panel">
      <div className="p-panel-h">Tệp scan trên Drive ({d.tep.length})</div>
      <div className="p-4 space-y-3">
        {!d.drive ? <div className="text-xs text-gray-500">Chưa cấu hình thư mục Drive cho thủ tục này{process.env.NEXT_PUBLIC_DEMO_MODE === '1' ? ' (bản demo không lưu Drive)' : ''}.</div> : sua && (
          <div className="flex gap-2 flex-wrap items-center">
            <select className={inputCls + ' !w-auto'} value={thuMuc} onChange={e => setThuMuc(e.target.value)}>
              {Object.entries(THU_MUC).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            <label className={btnPrimary + ' p-btn-sm cursor-pointer' + (dang ? ' opacity-60 pointer-events-none' : '')}>
              {dang ? 'Đang tải…' : 'Chọn tệp (PDF / ảnh / Word, ≤ 4 MB)'}
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx,.zip" onChange={e => { tai(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
        )}
        {!d.tep.length ? <div className="text-sm text-gray-400">Chưa có tệp.</div> : (
          <table className="p-tbl w-full"><tbody>
            {d.tep.map(f => (
              <tr key={f.id}>
                <td className="l"><a className="underline" href={f.drive_url || '#'} target="_blank" rel="noopener noreferrer">{f.ten}</a>
                  <div className="text-xs text-gray-500">{THU_MUC[f.thu_muc] || f.thu_muc} · {dmyTime(f.created_at)}{f.ten_nguoi ? ' · ' + f.ten_nguoi : ''}</div></td>
                <td className="r">{sua && <button className="p-btn p-btn-sm text-red-700" onClick={() => xoa(f)} aria-label={'Xoá ' + f.ten}>×</button>}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  )
}

// ─── Bàn giao (bước 9) ────────────────────────────────────────────────────────────────────────────────────
function BanGiao({ d, id, sua, goi, toast }) {
  const bg = d.ban_giao
  const dau = () => ({ ngay: bg.ngay || '', nguoi_nhan: bg.nguoi_nhan || '', ghi_chu: bg.ghi_chu || '', muc: (bg.muc || []).map(m => ({ ten: m.ten || '', so_luong: m.so_luong || '', ghi_chu: m.ghi_chu || '' })) })
  const [f, setF] = useState(dau)
  const [dang, setDang] = useState(false)
  useEffect(() => setF(dau()), [d]) // eslint-disable-line react-hooks/exhaustive-deps
  const doi = JSON.stringify(f) !== JSON.stringify(dau())
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const setM = (i, k, v) => setF(o => ({ ...o, muc: o.muc.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }))
  const taiBbbg = async (kieu = 'word') => {
    if (doi) return toast('Lưu bàn giao trước rồi mới tải biên bản', true)
    setDang(true)
    try {
      const r = await fetch(`/api/admin/phaply/ho-so/${id}/${kieu}?dot=ban_giao&ma=BBBG`)
      if (!r.ok) { const j = await r.json().catch(() => ({})); toast(j.error || 'Không xuất được', true); return }
      const cd = r.headers.get('Content-Disposition') || ''
      const ten = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/) || [])[1] || 'Bien ban ban giao.docx')
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = ten; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally { setDang(false) }
  }
  return (
    <div className="p-panel">
      <div className="p-panel-h flex items-center justify-between gap-2"><span>Bàn giao cho khách</span>
        {d.lh_mau && mauCuaBo('ban_giao', d.lh_mau).length > 0 && <span className="flex gap-1.5"><button className="p-btn p-btn-sm" disabled={dang || !f.muc.length} onClick={() => taiBbbg()}>{dang ? '…' : '⬇ Biên bản (.docx)'}</button>
          {d.pdf && <button className="p-btn p-btn-sm" disabled={dang || !f.muc.length} onClick={() => taiBbbg('pdf')}>{dang ? '…' : '.pdf'}</button>}</span>}</div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày bàn giao" hint="ghi khi đã giao thật"><input type="date" className={inputCls + ' num'} value={f.ngay} disabled={!sua} onChange={e => set('ngay', e.target.value)} /></Field>
          <Field label="Người nhận"><input className={inputCls} value={f.nguoi_nhan} disabled={!sua} placeholder={bg.goi_y_nguoi_nhan} onChange={e => set('nguoi_nhan', e.target.value)} /></Field>
        </div>
        {f.muc.map((m, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="num text-xs text-gray-500 w-5 pt-2.5 text-right">{i + 1}</span>
            <input className={inputCls + ' flex-1'} value={m.ten} disabled={!sua} placeholder="Tên hồ sơ, giấy tờ" onChange={e => setM(i, 'ten', e.target.value)} />
            <input className={inputCls + ' !w-16 num text-center'} value={m.so_luong} disabled={!sua} placeholder="SL" onChange={e => setM(i, 'so_luong', e.target.value)} />
            <input className={inputCls + ' !w-32'} value={m.ghi_chu} disabled={!sua} placeholder="Ghi chú" onChange={e => setM(i, 'ghi_chu', e.target.value)} />
            {sua && <button className="p-btn p-btn-sm text-red-700" onClick={() => set('muc', f.muc.filter((_, j) => j !== i))} aria-label="Bỏ mục">×</button>}
          </div>
        ))}
        {sua && <div className="flex gap-2 flex-wrap">
          <button className="p-btn p-btn-sm" onClick={() => set('muc', [...f.muc, { ten: '', so_luong: '01', ghi_chu: '' }])}>+ Thêm mục</button>
          {!f.muc.length && <button className="p-btn p-btn-sm" onClick={() => set('muc', bg.muc_mac_dinh)}>Nạp danh mục gợi ý ({bg.muc_mac_dinh.length} mục)</button>}
        </div>}
        <Field label="Ghi chú (in trên biên bản)"><input className={inputCls} value={f.ghi_chu} disabled={!sua} onChange={e => set('ghi_chu', e.target.value)} /></Field>
        <div className="text-xs text-gray-500">Bản ký xong: scan tải ở khung Tệp scan → 8. BÀN GIAO (là một điều kiện đóng hồ sơ). Mẫu biên bản app soạn — chờ phòng pháp lý duyệt câu chữ.</div>
      </div>
      {sua && <div className="px-4 pb-4 flex justify-end gap-2">
        {doi && <button className={btnGhost} onClick={() => setF(dau())}>Bỏ thay đổi</button>}
        <button className={btnPrimary} disabled={!doi} onClick={() => goi({ action: 'ban_giao', ...f, nguoi_nhan: f.nguoi_nhan || (f.ngay ? bg.goi_y_nguoi_nhan : '') }, 'Đã lưu bàn giao')}>Lưu bàn giao</button>
      </div>}
    </div>
  )
}

// ─── Điều kiện đóng hồ sơ (bước 10) ───────────────────────────────────────────────────────────────────────
function DieuKienDong({ ds }) {
  const thieu = ds.filter(x => !x.dat).length
  return (
    <div className="p-panel">
      <div className="p-panel-h flex justify-between gap-2"><span>Điều kiện đóng hồ sơ</span>
        <span className={'text-xs px-2 py-0.5 rounded-full ' + (thieu ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800')}>{thieu ? `còn thiếu ${thieu}` : 'đủ — đóng được'}</span></div>
      <ul className="p-4 space-y-1.5 text-sm">
        {ds.map(x => <li key={x.k} className={x.dat ? 'text-green-800' : 'text-amber-900'}>{x.dat ? '✓' : '○'} {x.muc}</li>)}
      </ul>
      <div className="px-4 pb-4 text-xs text-gray-500">Thiếu điều kiện thì nhân viên không đóng được; trưởng phòng đóng được kèm lý do (ghi vào nhật ký).</div>
    </div>
  )
}
