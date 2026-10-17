'use client'
import { useState } from 'react'

// Ô "Cấp bậc · Lương" ở trang Quản lý nhân viên — phân hệ Tiền lương (sql/31). Chỉ hiện với người có
// view_payroll / manage_payroll; chỉ manage_payroll mới sửa được.
//
// Chọn cấp thì tự điền lương cơ bản / doanh thu tối thiểu / lương BHXH theo bảng cấp bậc, rồi sửa
// riêng được cho từng người. Mỗi lần lưu là một dòng lịch sử "áp dụng từ tháng" — tháng cũ giữ số cũ.

const fmt = n => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('vi-VN')
const soNhap = s => { const v = String(s ?? '').replace(/[^\d]/g, ''); return v === '' ? null : Number(v) }
const thangNay = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') }

export default function OLuongNhanVien({ staffId, tenNv, hienHanh, capBac, sua, onDaLuu }) {
  const [mo, setMo] = useState(false)
  const [f, setF] = useState(null)
  const [loi, setLoi] = useState(null)
  const [ban, setBan] = useState(false)

  const batDau = () => {
    const h = hienHanh || {}
    setF({
      thang: thangNay(), cap_bac: h.cap_bac || '', luong_co_ban: h.luong_co_ban ?? null,
      doanh_thu_toi_thieu: h.doanh_thu_toi_thieu ?? null, luong_bhxh: h.luong_bhxh ?? null,
      tham_gia_bhxh: !!h.tham_gia_bhxh, ghi_chu: '',
    })
    setLoi(null); setMo(true)
  }
  const chonCap = (ma) => {
    const c = (capBac || []).find(x => x.ma === ma)
    setF(v => c ? { ...v, cap_bac: ma, luong_co_ban: c.luong_co_ban, doanh_thu_toi_thieu: c.doanh_thu_toi_thieu, luong_bhxh: c.luong_bhxh, tham_gia_bhxh: c.luong_bhxh ? v.tham_gia_bhxh : false } : { ...v, cap_bac: '' })
  }
  const luu = async () => {
    setBan(true); setLoi(null)
    const res = await fetch('/api/admin/luong', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viec: 'luu_luong_nv', staffId, ...f }) })
    const j = await res.json().catch(() => ({ error: 'Lỗi máy chủ' }))
    setBan(false)
    if (j.error) { setLoi(j.error); return }
    setMo(false); onDaLuu && onDaLuu()
  }

  const ten = capBac?.find(c => c.ma === hienHanh?.cap_bac)?.ten
  const tom = (
    <div className="text-xs leading-relaxed whitespace-nowrap">
      {hienHanh ? <>
        <div className="text-gray-800"><b>{ten || 'Chưa gán cấp'}</b> · {fmt(hienHanh.luong_co_ban)}</div>
        <div className="text-gray-400">BHXH {hienHanh.tham_gia_bhxh ? fmt(hienHanh.luong_bhxh) : 'không tham gia'} · từ {String(hienHanh.ap_dung_tu).slice(5, 7)}/{String(hienHanh.ap_dung_tu).slice(0, 4)}</div>
      </> : <span className="text-gray-400">Chưa đặt lương</span>}
      {sua && <button onClick={batDau} className="text-[#8B1A1A] underline mt-0.5">{hienHanh ? 'Đổi' : 'Đặt lương'}</button>}
    </div>
  )
  if (!mo) return tom

  // Mở thành hộp nổi giữa màn hình — sửa ngay trong ô làm bảng nhân viên phình ngang, phải kéo thanh cuộn.
  return (<>{tom}
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setMo(false)}>
    <div className="text-sm space-y-2 w-full max-w-sm bg-white border border-gray-200 rounded-xl p-4 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="font-semibold text-gray-900">{tenNv ? 'Lương · ' + tenNv : 'Cấp bậc & lương'}</div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-28">Áp dụng từ</span>
        <input type="month" value={f.thang} onChange={e => setF(v => ({ ...v, thang: e.target.value }))} className="border border-gray-300 rounded px-1 py-0.5" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-28">Cấp bậc</span>
        <select value={f.cap_bac} onChange={e => chonCap(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5">
          <option value="">— Không theo cấp —</option>
          {(capBac || []).map(c => <option key={c.ma} value={c.ma}>{c.ten}{c.mo_ta ? ' · ' + c.mo_ta : ''}</option>)}
        </select>
      </div>
      {[['luong_co_ban', 'Lương CB'], ['doanh_thu_toi_thieu', 'DT tối thiểu'], ['luong_bhxh', 'Lương BHXH']].map(([k, l]) => (
        <div key={k} className="flex items-center gap-1">
          <span className="text-gray-500 w-28">{l}</span>
          <input value={f[k] === null ? '' : Number(f[k]).toLocaleString('vi-VN')} onChange={e => setF(v => ({ ...v, [k]: soNhap(e.target.value) }))}
            placeholder="—" className="w-36 border border-gray-300 rounded px-2 py-1 text-right" />
        </div>
      ))}
      <label className="flex items-center gap-1 text-gray-700">
        <input type="checkbox" checked={f.tham_gia_bhxh} onChange={e => setF(v => ({ ...v, tham_gia_bhxh: e.target.checked }))} />
        Chính thức, có tham gia BHXH
      </label>
      <input value={f.ghi_chu} onChange={e => setF(v => ({ ...v, ghi_chu: e.target.value }))} placeholder="Ghi chú (vd: lên cấp 4)" maxLength={300}
        className="w-full border border-gray-300 rounded px-1 py-0.5" />
      {loi && <div className="text-red-600">{loi}</div>}
      <div className="flex gap-2">
        <button onClick={luu} disabled={ban} className="px-2 py-0.5 rounded bg-[#8B1A1A] text-white disabled:opacity-50">Lưu</button>
        <button onClick={() => setMo(false)} className="text-gray-500">Hủy</button>
      </div>
    </div>
    </div>
  </>)
}
