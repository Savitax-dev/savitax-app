'use client'
import { useState } from 'react'
import { xuatExcelBangLuong } from '@/lib/luong/excel'

// Phân hệ Tiền lương — BƯỚC 3: thanh trạng thái chốt bảng lương + nút Xuất Excel / Chốt / Mở chốt.
// Chốt = chụp nguyên bảng lương tháng vào luong_bang_chot (route app/api/admin/luong/chot, sql/33).
export default function ThanhChotLuong({ d, ky, onXong }) {
  const [ban, setBan] = useState(false)
  const [msg, setMsg] = useState(null)

  const chot = async (moLai) => {
    let lyDo = ''
    if (moLai) { lyDo = prompt('Lý do MỞ CHỐT bảng lương tháng ' + ky.thang + '/' + ky.nam + ':') || ''; if (lyDo.trim().length < 5) return }
    else if (!confirm('Chốt bảng lương tháng ' + ky.thang + '/' + ky.nam + '? Sau khi chốt, màn hình và file Excel tháng này dùng bản chụp, không tính lại theo dữ liệu mới nữa.')) return
    setBan(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/luong/chot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viec: moLai ? 'mo_chot' : 'chot_bang', nam: ky.nam, thang: ky.thang, ly_do: lyDo }) })
      const j = await res.json()
      if (j.error) setMsg(j.error); else await onXong()
    } catch (e) { setMsg(String(e.message || e)) }
    setBan(false)
  }

  // Gửi phiếu lương cho nhân viên (bước 4). Chỉ tháng đã chốt. Gửi lại sau khi sửa: người đã xác nhận mà
  // thực lĩnh không đổi thì giữ xác nhận.
  const gui = async () => {
    if (!confirm((d.daChot?.daGui ? 'Gửi LẠI' : 'Gửi') + ' phiếu lương tháng ' + ky.thang + '/' + ky.nam + ' cho từng nhân viên xác nhận? Mỗi người chỉ thấy phiếu của mình.')) return
    setBan(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/luong/chot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viec: 'gui_xac_nhan', nam: ky.nam, thang: ky.thang }) })
      const j = await res.json()
      if (j.error) setMsg(j.error); else await onXong()
    } catch (e) { setMsg(String(e.message || e)) }
    setBan(false)
  }
  const phieu = (d.dong || []).map(x => x.phieu).filter(Boolean)
  const dem = { xn: phieu.filter(p => p.trang_thai === 'da_xac_nhan').length, sai: phieu.filter(p => p.trang_thai === 'bao_sai').length, cho: phieu.filter(p => p.trang_thai === 'cho_xac_nhan').length }

  return (
    <>
      {(
        <div className={'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ' + (d.daChot ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
          <div className={'text-sm ' + (d.daChot ? 'text-emerald-800' : 'text-amber-800')}>
            {d.daChot
              ? <>🔒 <b>Đã chốt</b> lúc {new Date(d.daChot.luc).toLocaleString('vi-VN')}{d.daChot.boi ? ' bởi ' + d.daChot.boi : ''} — số liệu tháng này không đổi nữa.{d.daChot.daGui && <> · 📨 Đã gửi phiếu: <b className="text-emerald-700">{dem.xn} xác nhận</b> · <b className="text-amber-700">{dem.cho} chờ</b> · <b className="text-rose-600">{dem.sai} báo sai</b></>}</>
              : <>⏳ <b>Chưa chốt</b> — số tính từ dữ liệu hiện tại, có thể đổi khi chấm công / công nợ / KPI thay đổi.{d.daMoChot ? ' (Đã mở chốt: ' + d.daMoChot.lyDo + ')' : ''}</>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => xuatExcelBangLuong(d)} className="text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700">⬇ Xuất Excel</button>
            {d.duocChot && (d.daChot
              ? <><button onClick={gui} disabled={ban} className="text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm disabled:opacity-50">📨 {d.daChot.daGui ? 'Gửi lại phiếu' : 'Gửi nhân viên xác nhận'}</button><button onClick={() => chot(true)} disabled={ban} className="text-sm px-4 py-2 rounded-xl border border-rose-300 text-rose-700 bg-white disabled:opacity-50">Mở chốt</button></>
              : <button onClick={() => chot(false)} disabled={ban} className="text-sm px-4 py-2 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm disabled:opacity-50">🔒 Chốt bảng lương</button>)}
          </div>
        </div>
      )}
      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2.5 text-sm">{msg}</div>}
    </>
  )
}
