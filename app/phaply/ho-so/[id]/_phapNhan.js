'use client'
// Phân hệ Pháp lý — 4 tab dữ liệu pháp nhân của một hồ sơ: Doanh nghiệp · Người & CCCD · Ngành nghề · Còn thiếu & xuất Word.
// Một lần tải /api/admin/phaply/ho-so/[id]/phap-nhan dùng chung cho cả 4 tab (component luôn gắn, tab khác thì ẩn).
// Máy chủ kiểm lại quyền + lọc cột — ở đây chỉ ẩn nút cho gọn.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Modal, Field, NumInput, inputCls, btnPrimary, btnGhost, api, fmt } from '../../_ui'
import { NguoiForm, DiaChiChon, noiDiaChiNgan } from '../../_nguoi'
import { VAI_TRO, VAI_TRO_THEO_LOAI, CHUC_DANH, THOI_HAN_GOP } from '@/lib/phaply/phapNhan'
import { mauCuaBo } from '@/lib/phaply/word/danhMuc'

export const TAB_PHAP_NHAN = [['doanh_nghiep', 'Doanh nghiệp'], ['nguoi', 'Người & CCCD'], ['nganh', 'Ngành nghề'], ['word', 'Còn thiếu & xuất Word']]

export default function PhapNhan({ id, tab, sua, loaiHinh, toast, taiLaiHoSo }) {
  const [d, setD] = useState(null)
  const load = useCallback(async () => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/phap-nhan`)
    if (!r.ok) { setD({ loi: r.data.error || 'Không tải được dữ liệu pháp nhân' }); return }
    setD(r.data)
  }, [id])
  useEffect(() => { load() }, [load])
  if (!TAB_PHAP_NHAN.some(([k]) => k === tab)) return null
  if (!d) return <div className="p-panel p-6 text-sm text-gray-400">Đang tải…</div>
  if (d.loi) return <div className="p-panel p-6 text-sm text-red-700">{d.loi}</div>
  const coSua = sua && d.sua_duoc
  const goi = async (body, thongBao) => {
    const r = await api(`/api/admin/phaply/ho-so/${id}/phap-nhan`, { method: 'PATCH', body })
    if (!r.ok) { toast(r.data.error || 'Không lưu được', true); return null }
    if (thongBao) toast(thongBao)
    await load(); if (body.action === 'cty') taiLaiHoSo()
    return r.data
  }
  const lh = d.entity?.entity_type || loaiHinh
  return (
    <div className="space-y-4">
      {tab !== 'word' && <ThieuGon thieu={d.thieu} />}
      {tab === 'doanh_nghiep' && <DoanhNghiep d={d} lh={lh} sua={coSua} goi={goi} />}
      {tab === 'nguoi' && <Nguoi d={d} lh={lh} sua={coSua} goi={goi} id={id} toast={toast} />}
      {tab === 'nganh' && <Nganh d={d} sua={coSua} goi={goi} />}
      {tab === 'word' && <XuatWord d={d} id={id} lh={lh} toast={toast} sua={coSua} taiLai={load} />}
    </div>
  )
}

// Dải "còn thiếu" gọn ở đầu mỗi tab
function ThieuGon({ thieu }) {
  const chan = [...new Map([...(thieu?.so || []), ...(thieu?.thue || [])].filter(t => t.chan).map(t => [t.muc, t])).values()]
  if (!chan.length) return <div className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-800">✓ Đủ dữ liệu chính để xuất bộ hồ sơ.</div>
  return (
    <div className="text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-900">
      <b>Còn thiếu {chan.length} mục:</b> {chan.slice(0, 6).map(t => t.muc).join(' · ')}{chan.length > 6 ? ` · … (+${chan.length - 6}, xem tab Còn thiếu & xuất Word)` : ''}
    </div>
  )
}

// ─── Doanh nghiệp ─────────────────────────────────────────────────────────────────────────────────────────
const PP_GTGT = [['khau_tru', 'Khấu trừ'], ['truc_tiep_gtgt', 'Trực tiếp trên GTGT'], ['truc_tiep_doanh_so', 'Trực tiếp trên doanh số'], ['khong_nop', 'Không phải nộp']]
const BHXH = [['hang_thang', 'Hằng tháng'], ['3_thang', '03 tháng một lần'], ['6_thang', '06 tháng một lần']]

function DoanhNghiep({ d, lh, sua, goi }) {
  const e = d.entity || {}
  const dau = () => ({
    name: e.name || '', name_en: e.name_en || '', name_short: e.name_short || '', tax_code: e.tax_code || '',
    tru_so: { so_nha: e.tru_so_so_nha || '', ma_xa: e.tru_so_ma_xa || '', xa: e.tru_so_xa || '', ma_tinh: e.tru_so_ma_tinh || '', tinh: e.tru_so_tinh || '' },
    phone: e.phone || '', email: e.email || '', fax: e.fax || '', website: e.website || '',
    von_dieu_le: Number(e.von_dieu_le) || 0, menh_gia: Number(e.menh_gia) || (lh === 'cp' ? 10000 : 0), so_lao_dong: e.so_lao_dong ?? '',
    mo_hinh: e.mo_hinh || 'chu_tich', csh_la_to_chuc: !!e.csh_la_to_chuc, co_ndt_nuoc_ngoai: !!e.co_ndt_nuoc_ngoai,
    phong_dkkd: e.phong_dkkd || '', co_quan_thue: e.co_quan_thue || '', dien_thue_san: !!e.dien_thue_san,
    thue: { ...(e.thue || {}) }, so_sach: { ...(e.so_sach || {}) }, khau_hao: e.khau_hao || '', quy_uoc_phieu: Number(e.quy_uoc_phieu) || 0,
  })
  const [f, setF] = useState(dau)
  const [goiY, setGoiY] = useState(d.goi_y || {})
  useEffect(() => { setF(dau()); setGoiY(d.goi_y || {}) }, [d]) // eslint-disable-line react-hooks/exhaustive-deps
  const doi = useMemo(() => JSON.stringify(f) !== JSON.stringify(dau()), [f, d]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const setT = (k, v) => setF(o => ({ ...o, thue: { ...o.thue, [k]: v } }))
  const setS = (k, v) => setF(o => ({ ...o, so_sach: { ...o.so_sach, [k]: v } }))
  // đổi địa chỉ trụ sở → hỏi gợi ý Phòng ĐKKD + Thuế cơ sở ngay
  const doiTruSo = async ts => {
    set('tru_so', ts)
    if (ts.ma_tinh !== f.tru_so.ma_tinh || ts.ma_xa !== f.tru_so.ma_xa) {
      const r = await api(`/api/admin/phaply/danh-muc?loai=goi_y&ma_tinh=${ts.ma_tinh || ''}&ma_xa=${ts.ma_xa || ''}`)
      if (r.ok) setGoiY(r.data)
    }
  }
  const luu = () => {
    const { tru_so: ts, ...con } = f
    goi({ action: 'cty', fields: { ...con, tru_so_so_nha: ts.so_nha, tru_so_ma_xa: ts.ma_xa, tru_so_xa: ts.xa, tru_so_ma_tinh: ts.ma_tinh, tru_so_tinh: ts.tinh } }, 'Đã lưu thông tin doanh nghiệp')
  }
  const o = (lb, k, them = {}) => (
    <Field label={lb} hint={them.hint} className={them.cls}>
      <input className={inputCls + (them.so ? ' num' : '')} value={f[k] ?? ''} disabled={!sua} placeholder={them.ph} onChange={ev => set(k, ev.target.value)} />
    </Field>
  )
  const chon = (lb, gt, ds, onC, cls) => (
    <Field label={lb} className={cls}><select className={inputCls} value={gt} disabled={!sua} onChange={ev => onC(ev.target.value)}>
      {ds.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
  )
  const hop = (lb, gt, onC) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!gt} disabled={!sua} onChange={ev => onC(ev.target.checked)} />{lb}</label>
  return (
    <div className="p-panel">
      <div className="p-panel-h">Doanh nghiệp</div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {o('Tên công ty (tiếng Việt)', 'name', { cls: 'md:col-span-4', hint: 'tự in hoa khi lưu' })}
          {o('Mã số doanh nghiệp', 'tax_code', { cls: 'md:col-span-2', so: true, hint: 'có sau khi được cấp GCN' })}
          {o('Tên tiếng nước ngoài', 'name_en', { cls: 'md:col-span-4' })}
          {o('Tên viết tắt', 'name_short', { cls: 'md:col-span-2' })}
        </div>
        <DiaChiChon nhan="Trụ sở chính" value={f.tru_so} disabled={!sua} onChange={doiTruSo} />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {o('Điện thoại', 'phone', { so: true })}{o('Email', 'email', { cls: 'md:col-span-2' })}{o('Fax', 'fax', { so: true })}{o('Website', 'website', { cls: 'md:col-span-2' })}
          <Field label="Vốn điều lệ (đồng)" className="col-span-2"><NumInput value={f.von_dieu_le} disabled={!sua} onChange={v => set('von_dieu_le', v)} /></Field>
          {lh === 'cp' && <Field label="Mệnh giá cổ phần"><NumInput value={f.menh_gia} disabled={!sua} onChange={v => set('menh_gia', v)} /></Field>}
          {lh === 'cp' && <Field label="Tổng số cổ phần"><input className={inputCls + ' num text-right'} disabled value={f.menh_gia ? fmt(Math.round(f.von_dieu_le / f.menh_gia)) : ''} /></Field>}
          {o('Số lao động dự kiến', 'so_lao_dong', { so: true })}
          {lh !== '1tv' && <Field label="Biên bản họp: mấy đồng = 1 phiếu" hint="mặc định 10.000"><NumInput value={f.quy_uoc_phieu} disabled={!sua} onChange={v => set('quy_uoc_phieu', v)} placeholder="10.000" /></Field>}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {lh === '1tv' && hop('Chủ sở hữu là tổ chức', f.csh_la_to_chuc, v => set('csh_la_to_chuc', v))}
          {lh === '1tv' && f.csh_la_to_chuc && chon('Mô hình tổ chức', f.mo_hinh, [['chu_tich', 'Chủ tịch công ty'], ['hdtv', 'Hội đồng thành viên']], v => set('mo_hinh', v))}
          {lh === 'cp' && hop('Có nhà đầu tư nước ngoài (in câu cam kết ở Mẫu 4)', f.co_ndt_nuoc_ngoai, v => set('co_ndt_nuoc_ngoai', v))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Phòng Đăng ký kinh doanh nộp hồ sơ" hint={goiY.phong_dkkd ? 'để trống = theo tỉnh trụ sở' : 'chọn tỉnh trụ sở để tự điền'}>
            <input className={inputCls} value={f.phong_dkkd} disabled={!sua} placeholder={goiY.phong_dkkd || ''} onChange={ev => set('phong_dkkd', ev.target.value)} />
          </Field>
          <Field label="Cơ quan thuế quản lý" hint={goiY.co_quan_thue ? `để trống = theo phường/xã${goiY.ma_cqt ? ' · mã ' + goiY.ma_cqt : ''}` : 'chọn phường/xã trụ sở để tự điền'}>
            <input className={inputCls} value={f.co_quan_thue} disabled={!sua} placeholder={goiY.co_quan_thue || ''} onChange={ev => set('co_quan_thue', ev.target.value)} />
          </Field>
        </div>

        <details className="rounded-lg border border-gray-200">
          <summary className="px-3 py-2 text-sm font-semibold cursor-pointer">Đăng ký thuế (Mẫu 2/3/4) + hồ sơ pháp lý ban đầu (sau khi có GPKD)</summary>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Field label="Ngày bắt đầu hoạt động" className="col-span-2"><input className={inputCls + ' num'} value={f.thue.ngay_bat_dau || ''} disabled={!sua} placeholder="dd/mm/yyyy" onChange={ev => setT('ngay_bat_dau', ev.target.value)} /></Field>
              {chon('Phương pháp tính thuế GTGT', f.thue.pp_gtgt || 'khau_tru', PP_GTGT, v => setT('pp_gtgt', v), 'col-span-2')}
              {chon('Đóng BHXH', f.thue.bhxh || 'hang_thang', BHXH, v => setT('bhxh', v), 'col-span-2')}
              {chon('Hạch toán', f.thue.hach_toan || 'doc_lap', [['doc_lap', 'Độc lập'], ['phu_thuoc', 'Phụ thuộc']], v => setT('hach_toan', v), 'col-span-2')}
              <Field label="Năm tài chính từ"><input className={inputCls + ' num'} value={f.thue.nam_tc_tu || ''} placeholder="01/01" disabled={!sua} onChange={ev => setT('nam_tc_tu', ev.target.value)} /></Field>
              <Field label="đến"><input className={inputCls + ' num'} value={f.thue.nam_tc_den || ''} placeholder="31/12" disabled={!sua} onChange={ev => setT('nam_tc_den', ev.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {hop('Có báo cáo tài chính hợp nhất', f.thue.bctc_hop_nhat, v => setT('bctc_hop_nhat', v))}
              {hop('Có dự án BOT / BTO / BT…', f.thue.bot, v => setT('bot', v))}
              {hop('Khách yêu cầu điền sẵn MST + cơ quan thuế (mặc định để trống cho viết tay)', f.dien_thue_san, v => set('dien_thue_san', v))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Field label="Phần mềm kế toán" className="col-span-2"><input className={inputCls} value={f.so_sach.phan_mem || ''} disabled={!sua} placeholder="VD: Misa" onChange={ev => setS('phan_mem', ev.target.value)} /></Field>
              <Field label="Niên độ đầu tiên từ"><input className={inputCls + ' num'} value={f.so_sach.nien_do_dau_tu || ''} placeholder="dd/mm/yyyy" disabled={!sua} onChange={ev => setS('nien_do_dau_tu', ev.target.value)} /></Field>
              <Field label="đến"><input className={inputCls + ' num'} value={f.so_sach.nien_do_dau_den || ''} placeholder="31/12/yyyy" disabled={!sua} onChange={ev => setS('nien_do_dau_den', ev.target.value)} /></Field>
              {chon('Kỳ kế toán', f.so_sach.ky || 'nam', [['nam', 'Năm'], ['quy', 'Quý'], ['thang', 'Tháng']], v => setS('ky', v), 'col-span-2')}
              <Field label="Hình thức sổ" className="col-span-2"><input className={inputCls} value={f.so_sach.hinh_thuc || ''} placeholder="Nhật ký chung" disabled={!sua} onChange={ev => setS('hinh_thuc', ev.target.value)} /></Field>
              <Field label="Phương pháp khấu hao" className="col-span-2"><input className={inputCls} value={f.khau_hao} placeholder="Đường thẳng" disabled={!sua} onChange={ev => set('khau_hao', ev.target.value)} /></Field>
            </div>
            <div className="text-xs text-gray-500">Ô để trống in theo mặc định của mẫu (Nhật ký chung, Bình quân gia quyền, Thông tư 99/2025/TT-BTC, Đường thẳng…).</div>
          </div>
        </details>
      </div>
      {sua && <div className="px-4 pb-4 flex justify-end gap-2">
        {doi && <button className={btnGhost} onClick={() => setF(dau())}>Bỏ thay đổi</button>}
        <button className={btnPrimary} disabled={!doi} onClick={luu}>Lưu doanh nghiệp</button>
      </div>}
    </div>
  )
}

// ─── Người & CCCD ─────────────────────────────────────────────────────────────────────────────────────────
function Nguoi({ d, lh, sua, goi, id, toast }) {
  const [mo, setMo] = useState(null)   // { nguoi, vai_tro: [] } đang sửa
  // gom vai trò theo người
  const nguoi = useMemo(() => {
    const m = new Map()
    for (const v of d.vai_tro) {
      if (!m.has(v.person_id)) m.set(v.person_id, { nguoi: v.nguoi, vai_tro: [] })
      m.get(v.person_id).vai_tro.push(v)
    }
    return [...m.values()]
  }, [d])
  const choPhep = VAI_TRO_THEO_LOAI[lh] || Object.keys(VAI_TRO)
  const vdl = Number(d.entity?.von_dieu_le) || 0, menh = Number(d.entity?.menh_gia) || 10000
  const tongTv = d.vai_tro.filter(v => v.vai_tro === 'thanh_vien').reduce((s, v) => s + (Number(v.von_gop) || 0), 0)
  const tongCp = d.vai_tro.filter(v => v.vai_tro === 'co_dong').reduce((s, v) => s + (Number(v.so_co_phan) || 0), 0)
  return (
    <div className="space-y-4">
      {choPhep.map(k => {
        const ds = d.vai_tro.filter(v => v.vai_tro === k)
        if (!ds.length && ['thu_ky', 'giam_doc'].includes(k)) return null
        return (
          <div key={k} className="p-panel">
            <div className="p-panel-h flex items-center justify-between gap-2">
              <span>{VAI_TRO[k]}{k === 'thanh_vien' && vdl ? ` — đã góp ${fmt(tongTv)} / ${fmt(vdl)}` : ''}{k === 'co_dong' && vdl ? ` — ${fmt(tongCp)} cổ phần = ${fmt(tongCp * menh)} / ${fmt(vdl)}` : ''}</span>
              {sua && <button className="p-btn p-btn-sm" onClick={() => setMo({ nguoi: { loai_giay_to: 'Căn cước công dân', quoc_tich: 'Việt Nam', dan_toc: 'Kinh' }, vai_tro: [{ vai_tro: k, thoi_han_gop: ['thanh_vien', 'co_dong'].includes(k) ? THOI_HAN_GOP : '' }] })}>+ Thêm</button>}
            </div>
            {!ds.length ? <div className="px-4 py-3 text-sm text-gray-400">Chưa có.</div> : (
              <table className="p-tbl w-full"><tbody>
                {ds.map(v => {
                  const p = nguoi.find(n => n.nguoi?.id === v.person_id)
                  return (
                    <tr key={v.id} className={sua ? 'p-click' : ''} onClick={() => sua && p && setMo({ nguoi: p.nguoi, vai_tro: p.vai_tro })}>
                      <td className="l"><b>{v.nguoi?.ho_ten || '(chưa có tên)'}</b>{v.chu_tich ? <span className="ml-2 text-xs px-1.5 rounded bg-amber-100">Chủ tịch</span> : null}
                        {v.chuc_danh ? <span className="ml-2 text-xs text-gray-500">{v.chuc_danh}</span> : null}
                        <div className="text-xs text-gray-500">{v.nguoi?.loai_giay_to || 'Giấy tờ'} {v.nguoi?.so_giay_to || '—'} · {noiDiaChiNgan(v.nguoi?.thuong_tru) || 'chưa có thường trú'}</div></td>
                      <td className="r num whitespace-nowrap">{k === 'thanh_vien' ? fmt(v.von_gop) + ' đ' : k === 'co_dong' ? fmt(v.so_co_phan) + ' CP' : ''}</td>
                      <td className="r text-xs text-gray-500 whitespace-nowrap">{(p?.vai_tro || []).filter(x => x.vai_tro !== k).map(x => VAI_TRO[x.vai_tro].split(' /')[0]).join(', ')}</td>
                    </tr>
                  )
                })}
              </tbody></table>
            )}
          </div>
        )
      })}
      {sua && <div className="text-xs text-gray-500">Một người giữ nhiều vai trò (VD chủ sở hữu kiêm giám đốc, đại diện pháp luật): mở người đó và tích thêm vai trò — không nhập hai lần. Giám đốc trống = lấy người đại diện theo pháp luật.</div>}
      {mo && <SuaNguoi mo={mo} choPhep={choPhep} goi={goi} id={id} toast={toast} onClose={() => setMo(null)} />}
    </div>
  )
}

function SuaNguoi({ mo, choPhep, goi, id, toast, onClose }) {
  const [canhBao, setCanhBao] = useState([])
  const [p, setP] = useState(mo.nguoi)
  const [vt, setVt] = useState(() => Object.fromEntries(mo.vai_tro.map(v => [v.vai_tro, { ...v }])))
  const [dang, setDang] = useState(false)
  const bat = (k, on) => setVt(o => { const n = { ...o }; if (on) n[k] = { vai_tro: k, thoi_han_gop: ['thanh_vien', 'co_dong'].includes(k) ? THOI_HAN_GOP : '' }; else delete n[k]; return n })
  const setV = (k, f, v) => setVt(o => ({ ...o, [k]: { ...o[k], [f]: v } }))
  const luu = async () => {
    setDang(true)
    const r = await goi({ action: 'nguoi', nguoi: p, vai_tro: Object.values(vt) }, 'Đã lưu ' + (p.ho_ten || 'người'))
    setDang(false); if (r) onClose()
  }
  const bo = async () => {
    if (!confirm(`Gỡ ${p.ho_ten || 'người này'} khỏi doanh nghiệp?`)) return
    if (await goi({ action: 'bo_nguoi', person_id: p.id }, 'Đã gỡ')) onClose()
  }
  return (
    <Modal wide title={p.id ? 'Sửa ' + (p.ho_ten || 'người') : 'Thêm người'} onClose={onClose}
      footer={<>{p.id && <button className="p-btn mr-auto text-red-700" onClick={bo}>Gỡ khỏi doanh nghiệp</button>}
        <button className={btnGhost} onClick={onClose}>Huỷ</button>
        <button className={btnPrimary} disabled={dang || !p.ho_ten?.trim() || !Object.keys(vt).length} onClick={luu}>Lưu</button></>}>
      <div className="space-y-4">
        <TaiCccd caseId={id} p={p} setP={setP} toast={toast} canhBao={canhBao} setCanhBao={setCanhBao} />
        <NguoiForm value={p} onChange={setP} noiBat={new Set(canhBao.map(c => c.truong))} />
        <div className="border-t pt-3">
          <div className="text-sm font-semibold mb-2">Vai trò trong doanh nghiệp</div>
          <div className="space-y-2">
            {choPhep.map(k => (
              <div key={k} className="rounded-lg border border-gray-200 px-3 py-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!vt[k]} onChange={e => bat(k, e.target.checked)} />{VAI_TRO[k]}</label>
                {vt[k] && ['dai_dien', 'giam_doc'].includes(k) && (
                  <Field label="Chức danh" className="mt-2"><input className={inputCls} list="pl-chuc-danh" value={vt[k].chuc_danh || ''} onChange={e => setV(k, 'chuc_danh', e.target.value)} placeholder="Giám đốc" />
                    <datalist id="pl-chuc-danh">{CHUC_DANH.map(c => <option key={c} value={c} />)}</datalist></Field>
                )}
                {vt[k] && k === 'thanh_vien' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <Field label="Vốn góp (đồng)"><NumInput value={vt[k].von_gop} onChange={v => setV(k, 'von_gop', v)} /></Field>
                    <Field label="Thời hạn góp" className="md:col-span-2"><input className={inputCls} value={vt[k].thoi_han_gop || ''} onChange={e => setV(k, 'thoi_han_gop', e.target.value)} /></Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!vt[k].chu_tich} onChange={e => setV(k, 'chu_tich', e.target.checked)} />Chủ tịch Hội đồng thành viên</label>
                  </div>
                )}
                {vt[k] && k === 'co_dong' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <Field label="Số cổ phần"><NumInput value={vt[k].so_co_phan} onChange={v => setV(k, 'so_co_phan', v)} /></Field>
                    <Field label="Thời hạn góp" className="md:col-span-2"><input className={inputCls} value={vt[k].thoi_han_gop || ''} onChange={e => setV(k, 'thoi_han_gop', e.target.value)} /></Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!vt[k].chu_tich} onChange={e => setV(k, 'chu_tich', e.target.checked)} />Chủ tịch Hội đồng quản trị</label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Ngành nghề ───────────────────────────────────────────────────────────────────────────────────────────
const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
let nhoVsic = null

function Nganh({ d, sua, goi }) {
  const dau = () => d.nganh.map(n => ({ ma: n.ma, ten: n.ten, chi_tiet: n.chi_tiet || '', chinh: !!n.chinh }))
  const [ds, setDs] = useState(dau)
  const [vsic, setVsic] = useState(nhoVsic || [])
  const [tim, setTim] = useState('')
  useEffect(() => setDs(dau()), [d]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (nhoVsic) return
    api('/api/admin/phaply/danh-muc?loai=nganh').then(r => { if (r.ok) { nhoVsic = r.data.ds; setVsic(r.data.ds) } })
  }, [])
  const doi = JSON.stringify(ds) !== JSON.stringify(dau())
  // Danh sách sổ xuống: bấm vào ô là hiện cả danh mục, gõ tới đâu loại trừ tới đó. Gõ nhiều chữ = phải có ĐỦ các chữ
  // (không cần dấu, không cần đúng thứ tự): "ban buon thuc" → các ngành bán buôn thực phẩm / thức ăn…; gõ số = lọc theo mã.
  const [mo, setMo] = useState(false)
  const [chonIdx, setChonIdx] = useState(0)
  const goiYTim = useMemo(() => {
    const tu = boDau(tim.trim()).split(/\s+/).filter(Boolean)
    const co = new Set(ds.map(n => n.ma))
    return vsic.filter(n => {
      const chu = n.ma + ' ' + boDau(n.ten)
      return tu.every(t => (/^\d+$/.test(t) ? n.ma.startsWith(t) : chu.includes(t)))
    }).map(n => ({ ...n, daCo: co.has(n.ma) }))   // ngành đã chọn vẫn hiện (mờ, ghi "đã có") để khỏi tưởng tìm không ra
      // ngành có ĐÚNG cụm chữ liền nhau lên đầu ("tu van quan ly" → 7020 trước 6220 "tư vấn máy vi tính và quản lý…")
      .map(n => ({ ...n, lien: tu.length > 1 && boDau(n.ten).includes(tu.join(' ')) ? 0 : 1 }))
      .sort((a, b) => a.lien - b.lien || a.ma.localeCompare(b.ma))
  }, [tim, vsic, ds])
  const them = n => { if (n.daCo) return; setDs(o => [...o, { ma: n.ma, ten: n.ten, chi_tiet: '', chinh: !o.length }]); setTim(''); setChonIdx(0) }
  const phim = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setMo(true); setChonIdx(i => Math.min(i + 1, goiYTim.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setChonIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Escape') setMo(false)
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (mo && goiYTim[chonIdx]) them(goiYTim[chonIdx])
      else if (maTay) them({ ma: tim.trim(), ten: '' })
    }
  }
  // giữ dòng đang chọn bằng phím trong tầm nhìn
  useEffect(() => { document.getElementById('pl-vsic-' + chonIdx)?.scrollIntoView({ block: 'nearest' }) }, [chonIdx])
  const setN = (i, k, v) => setDs(o => o.map((n, j) => (j === i ? { ...n, [k]: v } : k === 'chinh' && v ? { ...n, chinh: false } : n)))
  const doiCho = (i, buoc) => setDs(o => { const n = [...o], j = i + buoc; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n })
  const maTay = /^\d{4}$/.test(tim.trim()) && !vsic.some(n => n.ma === tim.trim())
  return (
    <div className="p-panel">
      <div className="p-panel-h">Ngành nghề kinh doanh ({ds.length})</div>
      <div className="p-4 space-y-3">
        {sua && (
          <div className="relative">
            <div className="relative">
              <input className={inputCls + ' pr-8'} value={tim} onKeyDown={phim} onFocus={() => setMo(true)} onBlur={() => setTimeout(() => setMo(false), 150)}
                onChange={e => { setTim(e.target.value); setMo(true); setChonIdx(0) }}
                placeholder={vsic.length ? `Chọn ngành để thêm — bấm để xem cả ${vsic.length} ngành, gõ mã hoặc chữ để lọc (không cần dấu)` : 'Danh mục ngành chưa nạp — gõ mã 4 số rồi Enter để thêm tay'} />
              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs" aria-label="Mở danh sách ngành"
                onMouseDown={e => { e.preventDefault(); setMo(m => !m) }}>▼</button>
            </div>
            {mo && vsic.length > 0 && (
              <div className="mt-1 bg-white rounded-lg shadow-lg border">
                <div className="px-3 py-1.5 text-xs text-gray-500 border-b">
                  {goiYTim.length ? `${goiYTim.length} ngành${tim.trim() ? ' khớp "' + tim.trim() + '"' : ''} — ↑↓ chọn, Enter thêm` : `Không có ngành nào khớp "${tim.trim()}"`}
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {goiYTim.map((n, i) => (
                    <button key={n.ma} id={'pl-vsic-' + i} type="button" onMouseDown={e => { e.preventDefault(); them(n) }} onMouseEnter={() => setChonIdx(i)}
                      className={'flex gap-2 w-full text-left px-3 py-1.5 text-sm ' + (n.daCo ? 'text-gray-400 cursor-default ' : '') + (i === chonIdx ? 'bg-amber-100' : 'hover:bg-amber-50')}>
                      <b className="num w-11 shrink-0">{n.ma}</b><span className="flex-1">{n.ten}</span>{n.daCo && <span className="text-xs">✓ đã có</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {maTay && <div className="text-xs text-gray-500 mt-1">Mã {tim.trim()} không có trong danh mục — Enter để thêm tay rồi gõ tên ngành.</div>}
          </div>
        )}
        {!ds.length && <div className="text-sm text-gray-400">Chưa có ngành nào.</div>}
        {ds.map((n, i) => (
          <div key={n.ma + i} className={'rounded-lg border px-3 py-2 ' + (n.chinh ? 'border-amber-400 bg-amber-50/40' : 'border-gray-200')}>
            <div className="flex items-start gap-2">
              <span className="num text-sm font-bold w-12 pt-1.5">{n.ma}</span>
              <div className="flex-1 space-y-1">
                <input className={inputCls} value={n.ten} disabled={!sua} onChange={e => setN(i, 'ten', e.target.value)} placeholder="Tên ngành" />
                <textarea rows={n.chi_tiet ? 2 : 1} className={inputCls} value={n.chi_tiet} disabled={!sua} onChange={e => setN(i, 'chi_tiet', e.target.value)} placeholder="Chi tiết (không bắt buộc): ghi rõ hoạt động, loại trừ…" />
              </div>
              <div className="flex flex-col items-end gap-1 text-xs whitespace-nowrap">
                <label className="flex items-center gap-1"><input type="radio" checked={n.chinh} disabled={!sua} onChange={() => setN(i, 'chinh', true)} />Ngành chính</label>
                {sua && <div className="flex gap-1">
                  <button className="p-btn p-btn-sm" onClick={() => doiCho(i, -1)} disabled={!i} aria-label="Lên">↑</button>
                  <button className="p-btn p-btn-sm" onClick={() => doiCho(i, 1)} disabled={i === ds.length - 1} aria-label="Xuống">↓</button>
                  <button className="p-btn p-btn-sm text-red-700" onClick={() => setDs(o => o.filter((_, j) => j !== i))} aria-label="Xoá">×</button>
                </div>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {sua && <div className="px-4 pb-4 flex justify-end gap-2">
        {doi && <button className={btnGhost} onClick={() => setDs(dau())}>Bỏ thay đổi</button>}
        <button className={btnPrimary} disabled={!doi || ds.some(n => !n.ten.trim())} onClick={() => goi({ action: 'nganh', nganh: ds }, 'Đã lưu ngành nghề')}>Lưu ngành nghề</button>
      </div>}
    </div>
  )
}

// ─── Còn thiếu & xuất Word ────────────────────────────────────────────────────────────────────────────────
const TEN_DOT = { so: 'Hồ sơ thành lập — nộp Phòng ĐKKD', thue: 'Hồ sơ pháp lý ban đầu — sau khi có GPKD' }

function XuatWord({ d, id, lh, toast, sua, taiLai }) {
  const [dang, setDang] = useState(null)
  const [luuDrive, setLuuDrive] = useState(false)
  if (!['1tv', '2tv', 'cp'].includes(lh)) return <div className="p-panel p-4 text-sm text-gray-500">Mẫu Word hiện chỉ có cho công ty TNHH 1TV, 2TV và cổ phần.</div>
  // kieu: 'word' | 'pdf' (PDF đổi ở VPS — chậm hơn vài giây)
  const tai = async (dot, ma, kieu = 'word') => {
    setDang(dot + (ma || '') + kieu)
    try {
      const r = await fetch(`/api/admin/phaply/ho-so/${id}/${kieu}?dot=${dot}${ma ? '&ma=' + ma : ''}`)
      if (!r.ok) { const j = await r.json().catch(() => ({})); toast(j.error || 'Không xuất được', true); return }
      const cd = r.headers.get('Content-Disposition') || ''
      const ten = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/) || [])[1] || (ma || dot) + (ma ? (kieu === 'pdf' ? '.pdf' : '.docx') : '.zip'))
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = ten; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally { setDang(null) }
  }
  const guiDrive = async () => {
    setLuuDrive(true)
    const r = await api(`/api/admin/phaply/ho-so/${id}/drive`, { method: 'POST', body: {} })
    setLuuDrive(false)
    if (!r.ok) return toast(r.data.error || 'Không lưu được lên Drive', true)
    toast(`Đã lưu ${r.data.so_file} file lên Drive${r.data.loi_pdf ? ' (PDF lỗi: ' + r.data.loi_pdf + ' — chỉ lưu Word)' : ''}`, !!r.data.loi_pdf); taiLai()
  }
  const dv = d.drive || {}
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="lg:col-span-2 p-panel px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold">☁ Drive phòng pháp lý</span>
        {dv.co ? (<>
          <span className="text-xs text-gray-500 flex-1 min-w-[200px]">Lưu cả 2 bộ Word (4. SOẠN HỒ SƠ) + ảnh CCCD (2. THU THẬP THÔNG TIN) vào thư mục của hồ sơ; lưu lại thì ghi đè file cùng tên.
            {dv.luc ? ` Lần lưu gần nhất: ${new Date(dv.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.` : ' Chưa lưu lần nào.'}</span>
          {dv.url && <a className="p-btn p-btn-sm" href={dv.url} target="_blank" rel="noopener noreferrer">Mở thư mục ↗</a>}
          {sua && <button className={btnPrimary + ' p-btn-sm'} disabled={luuDrive || !!dang} onClick={guiDrive}>{luuDrive ? 'Đang lưu… (có thể tới 1 phút)' : 'Lưu lên Drive'}</button>}
        </>) : <span className="text-xs text-gray-500">Chưa cấu hình thư mục Drive cho thủ tục này{process.env.NEXT_PUBLIC_DEMO_MODE === '1' ? ' (bản demo không lưu Drive)' : ''}.</span>}
      </div>
      {['so', 'thue'].map(dot => {
        const thieu = d.thieu?.[dot] || []
        const chan = thieu.filter(t => t.chan), nhac = thieu.filter(t => !t.chan)
        return (
          <div key={dot} className="p-panel">
            <div className="p-panel-h flex items-center justify-between gap-2">
              <span>{TEN_DOT[dot]}</span>
              <span className="flex gap-1.5">
                <button className={btnPrimary + ' p-btn-sm'} disabled={!!dang} onClick={() => tai(dot)}>{dang === dot + 'word' ? 'Đang dựng…' : '⬇ Cả bộ Word'}</button>
                {d.pdf && <button className={btnPrimary + ' p-btn-sm'} disabled={!!dang} onClick={() => tai(dot, null, 'pdf')} title="Từng PDF + 1 file gộp cả bộ để in">{dang === dot + 'pdf' ? 'Đang đổi PDF…' : '⬇ Cả bộ PDF'}</button>}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {chan.length ? (
                <div className="text-sm rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  <b>Còn thiếu ({chan.length}) — xuất vẫn được, chỗ thiếu in “…………” để viết tay:</b>
                  <ul className="list-disc ml-5 mt-1">{chan.map(t => <li key={t.muc}><span className="text-gray-500">{t.nhom}:</span> {t.muc}</li>)}</ul>
                </div>
              ) : <div className="text-sm rounded-lg bg-green-50 px-3 py-2 text-green-800">✓ Đủ dữ liệu chính.</div>}
              {nhac.length > 0 && <ul className="text-xs text-gray-500 list-disc ml-5">{nhac.map(t => <li key={t.muc}>{t.muc}</li>)}</ul>}
              <table className="p-tbl w-full"><tbody>
                {mauCuaBo(dot, lh).map(m => (
                  <tr key={m.ma}>
                    <td className="l num w-8">{String(m.thuTu).padStart(2, '0')}</td>
                    <td className="l">{m.ten}<div className="text-xs text-gray-500">{m.nguoiKy[lh]}</div></td>
                    <td className="r whitespace-nowrap"><button className="p-btn p-btn-sm" disabled={!!dang} onClick={() => tai(dot, m.ma)}>{dang === dot + m.ma + 'word' ? '…' : '.docx'}</button>
                      {d.pdf && <button className="p-btn p-btn-sm ml-1" disabled={!!dang} onClick={() => tai(dot, m.ma, 'pdf')}>{dang === dot + m.ma + 'pdf' ? '…' : '.pdf'}</button>}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>
        )
      })}
      <div className="lg:col-span-2 text-xs text-gray-500">
        Người được ủy quyền (Giấy ủy quyền nộp Phòng ĐKKD) = nhân viên phụ trách hồ sơ, lấy từ <Link className="underline" href="/phaply/toi">Thông tin cá nhân pháp lý</Link> của người đó.
        {!d.uy_quyen && <b className="text-amber-800"> Người phụ trách hồ sơ này chưa nhập thông tin cá nhân.</b>}
      </div>
    </div>
  )
}

// ─── Ảnh CCCD: chọn 2 mặt → thu nhỏ ở máy → lưu kho riêng tư → Claude đọc → điền form + cảnh báo kiểm chéo ───────────────
const LA_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === '1'

// Ảnh điện thoại 3–8 MB; Vercel nhận tối đa 4,5 MB mỗi lượt gửi → thu về cạnh dài 1800px, JPEG 0,88 (~300–600 KB, vẫn đọc rõ chữ)
async function thuNho(file) {
  const bmp = await createImageBitmap(file)
  const tl = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * tl); c.height = Math.round(bmp.height * tl)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.88))
}

function TaiCccd({ caseId, p, setP, toast, canhBao, setCanhBao }) {
  // anh = ảnh vừa chọn, CHƯA tải lên · daLuu = ảnh đang hiện của bản đã lưu (giữ lại sau khi đọc để đối chiếu — anh yêu cầu 17/11/2026)
  const [anh, setAnh] = useState({})      // { truoc: { blob, url }, sau: … }
  const [daLuu, setDaLuu] = useState({})  // { truoc: url, sau: url }
  const [phong, setPhong] = useState(null) // ảnh đang phóng to
  const [dang, setDang] = useState(false)
  const [loiDoc, setLoiDoc] = useState('')
  const blobs = useRef([])
  useEffect(() => () => blobs.current.forEach(u => URL.revokeObjectURL(u)), [])   // chỉ dọn khi đóng hộp
  // mở lại người đã lưu: lấy link ký 5 phút để hiện ảnh (người không có quyền xem ảnh CCCD nhận 'an' → không hiện)
  useEffect(() => {
    for (const [mat, path] of [['truoc', p.cccd_front_path], ['sau', p.cccd_back_path]]) {
      if (!path || path === 'an' || daLuu[mat]) continue
      api(`/api/admin/phaply/ho-so/${caseId}/cccd?path=${encodeURIComponent(path)}`).then(r => r.ok && setDaLuu(o => ({ ...o, [mat]: r.data.url })))
    }
  }, [p.cccd_front_path, p.cccd_back_path]) // eslint-disable-line react-hooks/exhaustive-deps
  const chon = async (mat, file) => {
    if (!file) return
    try {
      const blob = await thuNho(file)
      const url = URL.createObjectURL(blob)
      blobs.current.push(url)
      setAnh(o => ({ ...o, [mat]: { blob, url } }))
    } catch { toast('Không mở được ảnh này — chọn ảnh JPG / PNG', true) }
  }
  const doc = async () => {
    setDang(true); setLoiDoc('')
    const fd = new FormData()
    for (const mat of ['truoc', 'sau']) if (anh[mat]) fd.append(mat, anh[mat].blob, mat + '.jpg')
    try {
      const r = await fetch(`/api/admin/phaply/ho-so/${caseId}/cccd`, { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast(j.error || 'Không tải được ảnh', true); return }
      setP(o => ({
        ...o, ...(j.nguoi || {}),
        cccd_front_path: j.duong_dan?.truoc || o.cccd_front_path, cccd_back_path: j.duong_dan?.sau || o.cccd_back_path,
        ...(j.cccd_doc ? { cccd_doc: j.cccd_doc } : {}),
      }))
      setCanhBao(j.canh_bao || [])
      setLoiDoc(j.loi_doc || '')
      // giữ nguyên ảnh vừa tải để đối chiếu với các ô bên dưới
      setDaLuu(o => ({ ...o, ...Object.fromEntries(Object.entries(anh).map(([m, a]) => [m, a.url])) }))
      setAnh({})
      if (!j.loi_doc) toast(j.canh_bao?.length ? `Đã đọc — ${j.canh_bao.length} chỗ cần đối chiếu (tô vàng)` : 'Đã đọc CCCD — đối chiếu ảnh với các ô rồi bấm Lưu')
    } catch { toast('Mất kết nối — thử lại', true) } finally { setDang(false) }
  }
  const o = (mat, ten) => {
    const url = anh[mat]?.url || daLuu[mat]
    return (
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">{ten}{anh[mat] ? <span className="ml-1 text-amber-700">· chưa tải lên</span> : daLuu[mat] ? <span className="ml-1 text-green-700">· đã lưu</span> : ''}</span>
          <label className="text-xs underline text-gray-600 cursor-pointer">{url ? 'Chọn ảnh khác' : ''}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { chon(mat, e.target.files?.[0]); e.target.value = '' }} /></label>
        </div>
        {url ? (
          <button type="button" className="block w-full h-56 rounded-lg border border-gray-300 overflow-hidden bg-gray-50 cursor-zoom-in" onClick={() => setPhong(url)} title="Bấm để phóng to">
            <img src={url} alt={ten} className="w-full h-full object-contain" />
          </button>
        ) : (
          <label className="flex h-56 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 hover:border-amber-400 bg-gray-50 items-center justify-center text-xs text-gray-400 text-center px-2">
            Bấm chọn / chụp ảnh {ten.toLowerCase()}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { chon(mat, e.target.files?.[0]); e.target.value = '' }} />
          </label>
        )}
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2">
      <div className="text-sm font-semibold">📷 Ảnh CCCD — đọc tự động</div>
      {LA_DEMO && <div className="text-xs rounded bg-amber-50 text-amber-900 px-2 py-1.5">Bản demo: chỉ tài khoản phòng pháp lý tải được; mọi ảnh <b>tự xoá lúc 2h sáng</b>. Tài khoản demo dùng chung mật khẩu — chỉ dùng CCCD thử, đừng tải CCCD khách thật.</div>}
      <div className="flex gap-3 flex-wrap">{o('truoc', 'Mặt trước')}{o('sau', 'Mặt sau')}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={btnPrimary + ' p-btn-sm'} disabled={dang || (!anh.truoc && !anh.sau)} onClick={doc}>{dang ? 'Đang đọc… (10–30 giây)' : 'Tải lên & đọc CCCD'}</button>
        <span className="text-xs text-gray-500">Nên chụp cả 2 mặt: mặt sau có mã MRZ để kiểm chéo số, ngày sinh, giới tính. Bấm vào ảnh để phóng to.</span>
      </div>
      {loiDoc && <div className="text-xs rounded bg-amber-50 text-amber-900 px-2 py-1.5">{loiDoc}</div>}
      {canhBao.length > 0 && (
        <ul className="text-xs rounded bg-amber-50 text-amber-900 px-2 py-1.5 list-disc pl-5 space-y-0.5">
          {canhBao.map((c, i) => <li key={i}>{c.muc}</li>)}
        </ul>
      )}
      {phong && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setPhong(null)}>
          <img src={phong} alt="Ảnh CCCD phóng to" className="max-w-full max-h-full object-contain rounded" />
        </div>
      )}
    </div>
  )
}
