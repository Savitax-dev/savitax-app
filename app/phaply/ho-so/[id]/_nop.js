'use client'
// Phân hệ Pháp lý — tab "Trình ký & nộp" (GĐ 4, sql/58): trình ký từng tờ · các lần nộp + đồng hồ hạn · kết quả GCN · tệp scan lên Drive.
// Máy chủ kiểm lại quyền (app/api/admin/phaply/ho-so/[id]/nop, /tep) — ở đây chỉ ẩn nút cho gọn.
import { useCallback, useEffect, useState } from 'react'
import { Modal, Field, inputCls, btnPrimary, btnGhost, api, dmy, dmyTime } from '../../_ui'
import { mauCuaBo } from '@/lib/phaply/word/danhMuc'
import { CO_QUAN, KET_QUA, coQuanLabel, hanTheoDoi, soNgayToiHan } from '@/lib/phaply/nop'
import { THU_MUC } from '@/lib/phaply/drive'
import { homNayVN } from '@/lib/phaply/hoSo'

const TEN_BO = { so: 'Hồ sơ thành lập — nộp Phòng ĐKKD', thue: 'Hồ sơ pháp lý ban đầu' }
const LOAI_CO_MAU = ['1tv', '2tv', 'cp']

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
        {LOAI_CO_MAU.includes(d.loai_hinh) && ['so', 'thue'].map(dot => <TrinhKy key={dot} dot={dot} d={d} sua={coSua} goi={goi} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KetQuaGcn d={d} sua={coSua} goi={goi} />
        <TepScan d={d} id={id} sua={coSua} toast={toast} load={load} />
      </div>
    </div>
  )
}

// ─── Trình ký ─────────────────────────────────────────────────────────────────────────────────────────────
function TrinhKy({ dot, d, sua, goi }) {
  const bo = mauCuaBo(dot, d.loai_hinh)
  const da = new Map(d.ky.filter(k => k.dot === dot).map(k => [k.ma, k]))
  const xong = bo.filter(m => da.has(m.ma)).length
  return (
    <div className="p-panel">
      <div className="p-panel-h flex justify-between gap-2"><span>Trình ký — {TEN_BO[dot]}</span>
        <span className={'text-xs px-2 py-0.5 rounded-full ' + (xong === bo.length ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>{xong}/{bo.length} tờ đã ký</span></div>
      <table className="p-tbl w-full"><tbody>
        {bo.map(m => {
          const k = da.get(m.ma)
          return (
            <tr key={m.ma}>
              <td className="l w-8"><input type="checkbox" checked={!!k} disabled={!sua} onChange={e => goi({ action: 'ky', dot, ma: m.ma, da_ky: e.target.checked })} aria-label={'Đã ký ' + m.ten} /></td>
              <td className="l">{m.ten}<div className="text-xs text-gray-500">{m.nguoiKy[d.loai_hinh]}</div></td>
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
