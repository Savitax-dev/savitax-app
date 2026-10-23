'use client'
import { useState } from 'react'
import { xuatExcelBangLuong } from '@/lib/luong/excel'
import { dongChuyenKhoan, xuatFileChuyenKhoan, khongDau } from '@/lib/luong/fileChuyenKhoan'

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
  // File chuyển khoản chi lương hàng loạt (mẫu ngân hàng anh gửi 20/10/2026) — CHỈ từ bảng đã chốt, để số
  // tiền chuyển đúng bằng phiếu lương. Tài khoản lấy số HIỆN TẠI ở trang Quản lý nhân viên.
  const chuyenKhoan = async () => {
    setMsg(null)
    if (!d.daChot) { setMsg('Bấm "🔒 Chốt bảng lương" trước — file chuyển khoản phải lấy số tiền của bản đã chốt.'); return }
    const noiDung = prompt('Nội dung giao dịch (không dấu):', 'SVT thanh toan luong thang ' + ky.thang + '.' + ky.nam)
    if (noiDung === null) return
    if (!khongDau(noiDung)) { setMsg('Chưa nhập nội dung giao dịch.'); return }
    setBan(true)
    try {
      const j = await fetch('/api/admin/luong?viec=luong_nv', { cache: 'no-store' }).then(r => r.json())
      if (j.error) { setMsg(j.error); return }
      const kq = dongChuyenKhoan(d.dong, new Map((j.nganHang || []).map(x => [x.staff_id, x])), noiDung)
      const fmt = n => Number(n).toLocaleString('vi-VN')
      const baoSai = kq.ra.filter(r => r.baoSai)
      const NL = '\n'
      const loi = [
        kq.thieu.length ? '⚠ ' + kq.thieu.length + ' người KHÔNG có trong file (thiếu tài khoản — bổ sung ở Quản lý nhân viên):' + NL + kq.thieu.map(x => '  • ' + x.ten + ' — ' + x.ly + ' (' + fmt(x.tien) + 'đ)').join(NL) : '',
        baoSai.length ? '⚠ ' + baoSai.length + ' người đang BÁO SAI phiếu lương nhưng vẫn có trong file:' + NL + baoSai.map(r => '  • ' + r.ten + ' (' + fmt(r.tien) + 'đ)').join(NL) : '',
        kq.khongTra.length ? kq.khongTra.length + ' người thực lĩnh ≤ 0 — không chuyển.' : '',
      ].filter(Boolean)
      if (!kq.ra.length) { setMsg('Không có ai đủ điều kiện chuyển khoản. ' + loi.join(' ').split(NL).join(' ')); return }
      if (!confirm('Xuất file chuyển khoản lương tháng ' + ky.thang + '/' + ky.nam + ':' + NL + kq.ra.length + ' người · tổng ' + fmt(kq.tong) + 'đ' +
        (loi.length ? NL + NL + loi.join(NL + NL) : '') + NL + NL + 'Xuất file?')) return
      await xuatFileChuyenKhoan(kq.ra, ky.nam, ky.thang)
      if (kq.thieu.length) setMsg('Đã xuất file, còn ' + kq.thieu.length + ' người thiếu tài khoản phải chuyển tay: ' + kq.thieu.map(x => x.ten).join(', ') + '.')
    } catch (e) { setMsg(String(e.message || e)) } finally { setBan(false) }
  }

  // Đã chuyển lương (sql/39): hoa hồng giới thiệu coi là ĐÃ CHI từ lúc bấm (báo cáo Hoa hồng giới thiệu).
  const chuyenLuong = async () => {
    const dang = !!d.daChot?.daChuyenLuong
    if (!confirm(dang ? 'Bỏ đánh dấu "Đã chuyển lương" tháng ' + ky.thang + '/' + ky.nam + '?' : 'Xác nhận ĐÃ CHUYỂN LƯƠNG tháng ' + ky.thang + '/' + ky.nam + ' cho nhân viên? Hoa hồng giới thiệu trong bảng này sẽ tính là đã chi.')) return
    setBan(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/luong/chot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viec: 'chuyen_luong', nam: ky.nam, thang: ky.thang, da: !dang }) })
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
        <div className={'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-1.5 ' + (d.daChot ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
          <div className={'text-sm ' + (d.daChot ? 'text-emerald-800' : 'text-amber-800')}>
            {d.daChot
              ? <>🔒 <b>Đã chốt</b> lúc {new Date(d.daChot.luc).toLocaleString('vi-VN')}{d.daChot.boi ? ' bởi ' + d.daChot.boi : ''} — số liệu tháng này không đổi nữa.{d.daChot.daChuyenLuong && <> · 💸 <b>Đã chuyển lương</b> {d.daChot.chuyenLuongLuc ? new Date(d.daChot.chuyenLuongLuc).toLocaleDateString('vi-VN') : ''}</>}{d.daChot.daGui && <> · 📨 Đã gửi phiếu: <b className="text-emerald-700">{dem.xn} xác nhận</b> · <b className="text-amber-700">{dem.cho} chờ</b> · <b className="text-rose-600">{dem.sai} báo sai</b></>}</>
              : <>⏳ <b>Chưa chốt</b> — số còn đổi theo dữ liệu.{d.daMoChot ? ' (Đã mở chốt: ' + d.daMoChot.lyDo + ')' : ''}</>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => xuatExcelBangLuong(d)} className="text-sm px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700">⬇ Xuất Excel</button>
            <button onClick={chuyenKhoan} disabled={ban} title={d.daChot ? 'File chi lương hàng loạt theo mẫu ngân hàng' : 'Chốt bảng lương trước rồi mới xuất được'}
              className={'text-sm px-3 py-1.5 rounded-xl font-semibold shadow-sm disabled:opacity-50 ' + (d.daChot ? 'bg-cyan-700 text-white hover:bg-cyan-800' : 'bg-cyan-100 text-cyan-800 cursor-not-allowed')}>🏦 File chuyển khoản</button>
            {d.duocChot && (d.daChot
              ? <><button onClick={gui} disabled={ban} className="text-sm px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm disabled:opacity-50">📨 {d.daChot.daGui ? 'Gửi lại phiếu' : 'Gửi nhân viên xác nhận'}</button><button onClick={chuyenLuong} disabled={ban} className={'text-sm px-3 py-1.5 rounded-xl font-semibold shadow-sm disabled:opacity-50 ' + (d.daChot.daChuyenLuong ? 'border border-emerald-300 bg-emerald-50 text-emerald-800' : 'bg-emerald-600 text-white')}>💸 {d.daChot.daChuyenLuong ? 'Đã chuyển lương ✓' : 'Đánh dấu đã chuyển lương'}</button><button onClick={() => chot(true)} disabled={ban} className="text-sm px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 bg-white disabled:opacity-50">Mở chốt</button></>
              : <><button onClick={() => chot(false)} disabled={ban} className="text-sm px-3 py-1.5 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm disabled:opacity-50">🔒 Chốt bảng lương</button>
                {/* Nút gửi luôn hiện để dễ tìm; chưa chốt thì bấm chỉ nhắc — phiếu gửi đi phải là bản đã chốt. */}
                <button onClick={() => setMsg('Bấm "🔒 Chốt bảng lương" trước — phiếu gửi cho nhân viên phải là bản đã chốt. Chốt xong nút này mới gửi được.')}
                  title="Chốt bảng lương trước rồi mới gửi" className="text-sm px-3 py-1.5 rounded-xl bg-indigo-200 text-indigo-800 font-semibold cursor-not-allowed">📨 Gửi nhân viên xác nhận</button></>)}
          </div>
        </div>
      )}
      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2.5 text-sm">{msg}</div>}
    </>
  )
}
