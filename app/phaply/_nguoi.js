'use client'
// Phân hệ Pháp lý — ô nhập dùng chung: chọn địa chỉ (tỉnh → phường/xã theo danh mục 34 tỉnh sau sáp nhập) và form một người
// (họ tên, giấy tờ, thường trú, liên lạc). Dùng ở tab Người của hồ sơ và trang Thông tin cá nhân (người được ủy quyền).
import { useEffect, useState } from 'react'
import { Field, inputCls, api } from './_ui'

export const NOI_CAP_CCCD = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội'
const LOAI_GIAY_TO = ['Căn cước công dân', 'Căn cước', 'Hộ chiếu', 'Chứng minh nhân dân', 'Giấy tờ khác']

// Nhớ danh mục trong phiên (34 tỉnh + xã theo tỉnh) — không tải lại mỗi lần mở form
const nho = { tinh: null, xa: new Map() }
async function dsTinh() {
  if (!nho.tinh) { const r = await api('/api/admin/phaply/danh-muc?loai=tinh'); nho.tinh = r.ok ? r.data.ds : [] }
  return nho.tinh
}
async function dsXa(maTinh) {
  if (!maTinh) return []
  if (!nho.xa.has(maTinh)) { const r = await api('/api/admin/phaply/danh-muc?loai=xa&ma_tinh=' + maTinh); nho.xa.set(maTinh, r.ok ? r.data.ds : []) }
  return nho.xa.get(maTinh)
}

// value: { so_nha, ma_xa, xa, ma_tinh, tinh, quoc_gia } · Việt Nam: chọn từ danh mục; nước ngoài: gõ tự do
export function DiaChiChon({ value, onChange, disabled, nhan = 'Địa chỉ' }) {
  const v = value || {}
  const [tinh, setTinh] = useState(nho.tinh || [])
  const [xa, setXa] = useState([])
  const nuocNgoai = v.quoc_gia && v.quoc_gia !== 'Việt Nam'
  useEffect(() => { dsTinh().then(setTinh) }, [])
  useEffect(() => { let huy = false; dsXa(v.ma_tinh).then(ds => { if (!huy) setXa(ds) }); return () => { huy = true } }, [v.ma_tinh])
  const doi = o => onChange({ ...v, ...o })
  // địa chỉ cũ (trước sáp nhập) gõ tay chưa khớp danh mục: vẫn hiện để người dùng chọn lại
  const xaLa = v.xa && !v.ma_xa
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
      <Field label={nhan + ' — số nhà, đường, tổ/ấp'} className="md:col-span-6">
        <input className={inputCls} value={v.so_nha || ''} disabled={disabled} onChange={e => doi({ so_nha: e.target.value })} placeholder="VD: 12 Lê Lợi, Tổ 3" />
      </Field>
      {nuocNgoai ? (
        <Field label="Địa chỉ ở nước ngoài (tỉnh / bang, thành phố)" className="md:col-span-4">
          <input className={inputCls} value={v.tinh || ''} disabled={disabled} onChange={e => doi({ tinh: e.target.value, xa: '', ma_xa: '', ma_tinh: '' })} />
        </Field>
      ) : (<>
        <Field label="Tỉnh / thành phố" className="md:col-span-2">
          <select className={inputCls} value={v.ma_tinh || ''} disabled={disabled}
            onChange={e => { const t = tinh.find(x => x.ma === e.target.value); doi({ ma_tinh: t?.ma || '', tinh: t?.ten || '', ma_xa: '', xa: '' }) }}>
            <option value="">{v.tinh && !v.ma_tinh ? v.tinh + ' (chọn lại)' : '— chọn tỉnh —'}</option>
            {tinh.map(t => <option key={t.ma} value={t.ma}>{t.ten}</option>)}
          </select>
        </Field>
        <Field label="Phường / xã / đặc khu" hint={xaLa ? 'đang ghi tay: ' + v.xa : undefined} className="md:col-span-2">
          <select className={inputCls} value={v.ma_xa || ''} disabled={disabled || !v.ma_tinh}
            onChange={e => { const x = xa.find(z => z.ma === e.target.value); doi({ ma_xa: x?.ma || '', xa: x?.ten || '' }) }}>
            <option value="">{v.ma_tinh ? '— chọn phường / xã —' : 'chọn tỉnh trước'}</option>
            {xa.map(x => <option key={x.ma} value={x.ma}>{x.ten}</option>)}
          </select>
        </Field>
      </>)}
      <Field label="Quốc gia" className="md:col-span-2">
        <select className={inputCls} value={nuocNgoai ? 'khac' : 'vn'} disabled={disabled}
          onChange={e => doi(e.target.value === 'vn' ? { quoc_gia: 'Việt Nam' } : { quoc_gia: 'Nước ngoài', ma_tinh: '', ma_xa: '', xa: '' })}>
          <option value="vn">Việt Nam</option><option value="khac">Nước ngoài…</option>
        </select>
        {nuocNgoai && <input className={inputCls + ' mt-1'} value={v.quoc_gia === 'Nước ngoài' ? '' : v.quoc_gia} placeholder="Tên nước" disabled={disabled} onChange={e => doi({ quoc_gia: e.target.value || 'Nước ngoài' })} />}
      </Field>
    </div>
  )
}

// Ngày gõ dd/mm/yyyy: tự chèn dấu "/" khi gõ số liền
const dinhNgay = s => { const d = s.replace(/\D/g, '').slice(0, 8); return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/') }

// value: dòng legal_people (hoặc một phần) · onChange(nguoiMoi)
export function NguoiForm({ value, onChange, disabled }) {
  const p = value || {}
  const set = (k, v) => onChange({ ...p, [k]: v })
  const canCuoc = !p.loai_giay_to || /căn cước/i.test(p.loai_giay_to)
  const o = (lb, k, them = {}) => (
    <Field label={lb} className={them.cls}>
      <input className={inputCls + (them.so ? ' num' : '')} value={p[k] || ''} disabled={disabled} placeholder={them.ph}
        onChange={e => set(k, them.ngay ? dinhNgay(e.target.value) : e.target.value)} />
    </Field>
  )
  const lienLacRieng = p.lien_lac && Object.values(p.lien_lac).some(Boolean)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {o('Họ và tên', 'ho_ten', { cls: 'col-span-2 md:col-span-3' })}
        <Field label="Giới tính"><select className={inputCls} value={p.gioi_tinh || ''} disabled={disabled} onChange={e => set('gioi_tinh', e.target.value)}>
          <option value="">—</option><option>Nam</option><option>Nữ</option></select></Field>
        {o('Ngày sinh', 'ngay_sinh', { so: true, ngay: true, ph: 'dd/mm/yyyy' })}
        {o('Dân tộc', 'dan_toc', { ph: 'Kinh' })}
        <Field label="Loại giấy tờ" className="col-span-2">
          <select className={inputCls} value={p.loai_giay_to || 'Căn cước công dân'} disabled={disabled} onChange={e => set('loai_giay_to', e.target.value)}>
            {LOAI_GIAY_TO.map(l => <option key={l}>{l}</option>)}
          </select></Field>
        {o('Số giấy tờ', 'so_giay_to', { so: true, cls: 'col-span-2' })}
        {o('Ngày cấp', 'ngay_cap', { so: true, ngay: true, ph: 'dd/mm/yyyy' })}
        {o('Có giá trị đến', 'ngay_het_han', { so: true, ngay: true, ph: 'dd/mm/yyyy' })}
        <Field label="Nơi cấp" className="col-span-2 md:col-span-4">
          <input className={inputCls} value={p.noi_cap || ''} disabled={disabled} onChange={e => set('noi_cap', e.target.value)} list="pl-noi-cap" />
          <datalist id="pl-noi-cap"><option value={NOI_CAP_CCCD} /><option value="Bộ Công an" /><option value="Cục Quản lý xuất nhập cảnh" /></datalist>
        </Field>
        {o('Quốc tịch', 'quoc_tich', { cls: 'col-span-2', ph: 'Việt Nam' })}
        {o('Điện thoại', 'dien_thoai', { so: true, cls: 'col-span-1 md:col-span-2' })}
        {o('Email', 'email', { cls: 'col-span-1 md:col-span-2' })}
      </div>
      {canCuoc && !p.noi_cap && !disabled && <button type="button" className="text-xs underline text-gray-600" onClick={() => set('noi_cap', NOI_CAP_CCCD)}>Điền nơi cấp căn cước: {NOI_CAP_CCCD}</button>}
      <DiaChiChon nhan="Thường trú" value={p.thuong_tru} disabled={disabled} onChange={v => set('thuong_tru', v)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!lienLacRieng} disabled={disabled}
          onChange={e => set('lien_lac', e.target.checked ? {} : { ...(p.thuong_tru || {}) })} />
        Địa chỉ liên lạc giống thường trú
      </label>
      {lienLacRieng && <DiaChiChon nhan="Liên lạc" value={p.lien_lac} disabled={disabled} onChange={v => set('lien_lac', v)} />}
    </div>
  )
}

export const noiDiaChiNgan = d => (d ? [d.so_nha, d.xa, d.tinh, d.quoc_gia && d.quoc_gia !== 'Việt Nam' ? d.quoc_gia : ''].filter(Boolean).join(', ') : '')
