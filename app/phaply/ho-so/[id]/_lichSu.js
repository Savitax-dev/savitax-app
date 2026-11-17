'use client'
// Phân hệ Pháp lý — trong tab Thông tin của hồ sơ: khung RIÊNG theo thủ tục (thời hạn tạm ngừng + nhắc khách · ngày hoạt động lại · nội dung
// thay đổi) và LỊCH SỬ PHÁP LÝ CỦA CÔNG TY (các hồ sơ khác cùng pháp nhân — anh yêu cầu 17/11/2026 "lấy thông tin qua lại"), kèm nút
// tạo hồ sơ tiếp theo trên CÙNG công ty (mở trang nhóm với ?tiep=<id>&loai=…).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Field, inputCls, btnPrimary, btnGhost, dmy, dmyTime, BuocChip } from '../../_ui'
import { NHOM, NOI_DUNG_THAY_DOI, MUC_TAM_NGUNG, denToiDa, hanThongBao, kiemTamNgung, canNhac } from '@/lib/phaply/nhom'

export default function ThongTinThuTuc({ d, sua, lam, setHoi }) {
  const hs = d.ho_so
  return (
    <div className="space-y-4">
      {hs.procedure_code === 'tam_ngung' && <TamNgung d={d} sua={sua} lam={lam} setHoi={setHoi} />}
      {hs.procedure_code === 'hoat_dong_lai' && <HoatDongLai hs={hs} sua={sua && hs.stage < 10} lam={lam} />}
      {hs.procedure_code === 'thay_doi' && <NoiDungThayDoi hs={hs} sua={sua && hs.stage < 10} lam={lam} />}
      <LichSuCongTy d={d} sua={sua} />
    </div>
  )
}

function TamNgung({ d, sua, lam, setHoi }) {
  const hs = d.ho_so, tt = d.tam_ngung
  const router = useRouter()
  const [tu, setTu] = useState(hs.tam_ngung_tu || '')
  const [den, setDen] = useState(hs.tam_ngung_den || '')
  useEffect(() => { setTu(hs.tam_ngung_tu || ''); setDen(hs.tam_ngung_den || '') }, [hs.tam_ngung_tu, hs.tam_ngung_den])
  const doi = tu !== (hs.tam_ngung_tu || '') || den !== (hs.tam_ngung_den || '')
  const loiTN = tu || den ? kiemTamNgung(tu, den) : null
  const daDong = hs.stage >= 10
  const m = tt ? MUC_TAM_NGUNG[tt.muc] : null
  const tiep = loai => router.push(`${NHOM[loai === 'giai_the' ? 'giai_the' : 'tam_ngung'].duong}?tiep=${hs.id}&loai=${loai}`)
  return (
    <div className={'p-panel ' + (tt && canNhac(tt.muc) ? 'ring-2 ring-amber-400' : '')}>
      <div className="p-panel-h flex justify-between items-center gap-2"><span>⏸️ Thời hạn tạm ngừng</span>
        {m && <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: m.mau }}>{m.label}{tt.muc !== 'da_xu_ly' && tt.muc !== 'chua_bat_dau' ? ` · ${tt.con_ngay >= 0 ? 'còn ' + tt.con_ngay : 'quá ' + -tt.con_ngay} ngày` : ''}</span>}</div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Tạm ngừng từ ngày"><input type="date" className={inputCls} value={tu} disabled={!sua || daDong} onChange={e => { setTu(e.target.value); if (!den && e.target.value) setDen(denToiDa(e.target.value)) }} /></Field>
          <Field label="Đến ngày" hint="tối đa 1 năm mỗi lần"><input type="date" className={inputCls} value={den} disabled={!sua || daDong} onChange={e => setDen(e.target.value)} /></Field>
          {sua && !daDong && <div className="flex items-end"><button className={btnPrimary} disabled={!doi || !!loiTN} onClick={() => lam({ action: 'tam_ngung', tu, den }, 'Đã lưu thời hạn tạm ngừng')}>Lưu thời hạn</button></div>}
        </div>
        <div className={'text-xs ' + (loiTN ? 'text-red-700' : 'text-gray-500')}>
          {loiTN || (tu ? `Thông báo tạm ngừng nộp chậm nhất ${dmy(hanThongBao(tu))}. ` : '') + (tt?.han_thong_bao_tiep && tt.muc !== 'da_xu_ly' ? `Muốn gia hạn / hoạt động lại đúng hạn: nộp thông báo chậm nhất ${dmy(tt.han_thong_bao_tiep)}.` : '')}
          {daDong && ' Hồ sơ đã đóng — thời hạn vẫn được theo dõi để nhắc khách.'}
        </div>
        {hs.nhac_khach_luc && <div className="text-sm rounded-lg bg-gray-50 px-3 py-2">Đã nhắc khách {dmyTime(hs.nhac_khach_luc)}{hs.nhac_khach_ghi_chu ? ': ' + hs.nhac_khach_ghi_chu : ''}</div>}
        {sua && tt && tt.muc !== 'da_xu_ly' && (
          <div className="flex gap-2 flex-wrap">
            <button className={btnGhost} onClick={() => setHoi({ tieuDe: 'Đã nhắc khách — khách trả lời thế nào?', batBuoc: false, goi: note => lam({ action: 'nhac_khach', note }, 'Đã ghi nhắc khách') })}>Đã nhắc khách</button>
            <button className={btnGhost} onClick={() => tiep('hoat_dong_lai')}>Tạo hồ sơ hoạt động lại</button>
            <button className={btnGhost} onClick={() => tiep('gia_han')}>Gia hạn tạm ngừng</button>
            <button className={btnGhost} onClick={() => tiep('giai_the')}>Giải thể</button>
          </div>
        )}
      </div>
    </div>
  )
}

function HoatDongLai({ hs, sua, lam }) {
  const [ngay, setNgay] = useState(hs.hoat_dong_lai_tu || '')
  useEffect(() => setNgay(hs.hoat_dong_lai_tu || ''), [hs.hoat_dong_lai_tu])
  return (
    <div className="p-panel">
      <div className="p-panel-h">▶️ Hoạt động trở lại</div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <Field label="Hoạt động trở lại từ ngày"><input type="date" className={inputCls} value={ngay} disabled={!sua} onChange={e => setNgay(e.target.value)} /></Field>
        <div className="text-xs text-gray-500 pb-2">{ngay ? `Nộp thông báo chậm nhất ${dmy(hanThongBao(ngay))} (3 ngày làm việc trước).` : ''}</div>
        {sua && <div><button className={btnPrimary} disabled={!ngay || ngay === (hs.hoat_dong_lai_tu || '')} onClick={() => lam({ action: 'tam_ngung', hoat_dong_lai_tu: ngay }, 'Đã lưu ngày hoạt động lại')}>Lưu</button></div>}
      </div>
    </div>
  )
}

function NoiDungThayDoi({ hs, sua, lam }) {
  const [ds, setDs] = useState(hs.noi_dung_thay_doi || [])
  useEffect(() => setDs(hs.noi_dung_thay_doi || []), [hs.noi_dung_thay_doi])
  const doi = JSON.stringify([...ds].sort()) !== JSON.stringify([...(hs.noi_dung_thay_doi || [])].sort())
  return (
    <div className="p-panel">
      <div className="p-panel-h">✏️ Nội dung thay đổi</div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {NOI_DUNG_THAY_DOI.map(x => <label key={x.k} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!sua} checked={ds.includes(x.k)}
          onChange={e => setDs(o => (e.target.checked ? [...o, x.k] : o.filter(k => k !== x.k)))} />{x.label}</label>)}
      </div>
      {sua && <div className="px-4 pb-4 flex justify-end gap-2">
        {doi && <button className={btnGhost} onClick={() => setDs(hs.noi_dung_thay_doi || [])}>Bỏ thay đổi</button>}
        <button className={btnPrimary} disabled={!doi} onClick={() => lam({ action: 'noi_dung', ds }, 'Đã lưu nội dung thay đổi')}>Lưu nội dung</button>
      </div>}
    </div>
  )
}

function LichSuCongTy({ d, sua }) {
  const hs = d.ho_so, ls = d.lich_su || []
  const router = useRouter()
  const tao = loai => router.push(`${NHOM[loai].duong}?tiep=${hs.id}&loai=${loai === 'thanh_lap' ? 'tlm' : loai}`)
  return (
    <div className="p-panel">
      <div className="p-panel-h flex justify-between items-center gap-2"><span>🗂️ Lịch sử pháp lý của công ty ({ls.length + 1} hồ sơ)</span>
        {sua && hs.entity_id && <span className="flex gap-1 flex-wrap">
          <button className="p-btn p-btn-sm" onClick={() => tao('thay_doi')}>+ Thay đổi</button>
          <button className="p-btn p-btn-sm" onClick={() => router.push(`${NHOM.tam_ngung.duong}?tiep=${hs.id}&loai=tam_ngung`)}>+ Tạm ngừng</button>
          <button className="p-btn p-btn-sm" onClick={() => tao('giai_the')}>+ Giải thể</button>
        </span>}</div>
      {!ls.length ? <div className="px-4 py-3 text-sm text-gray-500">Đây là hồ sơ đầu tiên của công ty trong app. Hồ sơ sau (thay đổi, tạm ngừng, giải thể…) tạo bằng nút bên trên — dùng lại doanh nghiệp, người, CCCD, ngành nghề đã nhập.</div> : (
        <table className="p-tbl w-full"><tbody>
          {ls.map(c => (
            <tr key={c.id}>
              <td className="l num whitespace-nowrap">{c.xem_duoc ? <Link className="underline" href={'/phaply/ho-so/' + c.id}>{c.ma}</Link> : c.ma}</td>
              <td className="l">{c.thu_tuc}{c.la_goc && <span className="ml-1 text-xs text-gray-500">(hồ sơ trước)</span>}{c.la_tiep_theo && <span className="ml-1 text-xs text-green-700">(hồ sơ tiếp theo)</span>}
                {c.tam_ngung_den && <div className="text-xs text-blue-800">Tạm ngừng {dmy(c.tam_ngung_tu)} → {dmy(c.tam_ngung_den)}</div>}</td>
              <td><BuocChip stage={c.buoc} /></td>
              <td className="l num whitespace-nowrap text-xs">Nhận {dmy(c.nhan)}{c.dong ? ' · đóng ' + dmy(c.dong) : ''}</td>
              <td className="l text-xs text-gray-400">{c.xem_duoc ? '' : 'người khác phụ trách'}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  )
}
