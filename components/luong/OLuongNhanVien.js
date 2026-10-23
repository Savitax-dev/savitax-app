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

// dsNganHang: tài khoản của mọi nhân viên — dùng gợi ý tên ngân hàng + tự điền mã ngân hàng đã từng nhập.
// hoSo: { ma_nhan_vien, ngay_vao_lam, cham_cong_may } (sql/38) — mã theo phần mềm chấm công, ngày vào làm (thâm niên).
export default function OLuongNhanVien({ staffId, tenNv, hienHanh, nganHang, dsNganHang = [], hoSo = null, capBac, sua, onDaLuu }) {
  const [mo, setMo] = useState(false)
  const [f, setF] = useState(null)
  const [loi, setLoi] = useState(null)
  const [ban, setBan] = useState(false)

  const batDau = () => {
    const h = hienHanh || {}
    setF({
      thang: thangNay(), cap_bac: h.cap_bac || '', luong_co_ban: h.luong_co_ban ?? null,
      doanh_thu_toi_thieu: h.doanh_thu_toi_thieu ?? null, luong_bhxh: h.luong_bhxh ?? null,
      tham_gia_bhxh: !!h.tham_gia_bhxh, so_nguoi_phu_thuoc: Number(h.so_nguoi_phu_thuoc) || 0, ghi_chu: '',
      ngan_hang: nganHang?.ngan_hang || '', so_tai_khoan: nganHang?.so_tai_khoan || '', chu_tai_khoan: nganHang?.chu_tai_khoan || tenNv || '', ma_ngan_hang: nganHang?.ma_ngan_hang || '',
      ma_nhan_vien: hoSo?.ma_nhan_vien || '', ngay_vao_lam: hoSo?.ngay_vao_lam || '', cham_cong_may: hoSo?.cham_cong_may !== false,
    })
    setLoi(null); setMo(true)
  }
  const chonCap = (ma) => {
    const c = (capBac || []).find(x => x.ma === ma)
    setF(v => c ? { ...v, cap_bac: ma, luong_co_ban: c.luong_co_ban, doanh_thu_toi_thieu: c.doanh_thu_toi_thieu, luong_bhxh: c.luong_bhxh, tham_gia_bhxh: c.luong_bhxh ? v.tham_gia_bhxh : false } : { ...v, cap_bac: '' })
  }
  // Hai phần lưu riêng: lương (lịch sử theo tháng) chỉ ghi khi số liệu lương đổi; tài khoản nhận lương
  // (không theo tháng) chỉ ghi khi đổi — sửa mỗi số tài khoản không đẻ thêm dòng lịch sử lương.
  const goi = async (body) => {
    const res = await fetch('/api/admin/luong', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId, ...body }) })
    return res.json().catch(() => ({ error: 'Lỗi máy chủ' }))
  }
  const luu = async () => {
    const h = hienHanh || {}
    const doiLuong = !hienHanh ? f.luong_co_ban !== null : f.ghi_chu || f.thang !== String(h.ap_dung_tu || '').slice(0, 7)
      || ['cap_bac', 'luong_co_ban', 'doanh_thu_toi_thieu', 'luong_bhxh'].some(k => String(f[k] ?? '') !== String(h[k] ?? ''))
      || f.tham_gia_bhxh !== !!h.tham_gia_bhxh || f.so_nguoi_phu_thuoc !== (Number(h.so_nguoi_phu_thuoc) || 0)
    const doiNh = ['ngan_hang', 'so_tai_khoan', 'chu_tai_khoan', 'ma_ngan_hang'].some(k => (f[k] || '') !== (nganHang?.[k] || (k === 'chu_tai_khoan' && !nganHang ? tenNv || '' : '')))
      && (f.so_tai_khoan || nganHang)
    const doiHs = (f.ma_nhan_vien || '') !== (hoSo?.ma_nhan_vien || '') || (f.ngay_vao_lam || '') !== (hoSo?.ngay_vao_lam || '')
      || f.cham_cong_may !== (hoSo?.cham_cong_may !== false)
    setBan(true); setLoi(null)
    if (doiHs) {
      const j = await goi({ viec: 'luu_ho_so_nv', ma_nhan_vien: f.ma_nhan_vien, ngay_vao_lam: f.ngay_vao_lam, cham_cong_may: f.cham_cong_may })
      if (j.error) { setBan(false); setLoi(j.error); return }
    }
    if (doiLuong) {
      const { ngan_hang, so_tai_khoan, chu_tai_khoan, ma_ngan_hang, ma_nhan_vien, ngay_vao_lam, cham_cong_may, ...luong } = f
      const j = await goi({ viec: 'luu_luong_nv', ...luong })
      if (j.error) { setBan(false); setLoi(j.error); return }
    }
    if (doiNh) {
      const j = await goi({ viec: 'luu_ngan_hang', ngan_hang: f.ngan_hang, so_tai_khoan: f.so_tai_khoan, chu_tai_khoan: f.chu_tai_khoan, ma_ngan_hang: f.ma_ngan_hang })
      if (j.error) { setBan(false); setLoi((doiLuong ? 'Đã lưu lương, NHƯNG chưa lưu được tài khoản: ' : '') + j.error); onDaLuu && onDaLuu(); return }
    }
    setBan(false)
    setMo(false); onDaLuu && onDaLuu()
  }

  const maTheoTen = new Map(dsNganHang.filter(x => x.ngan_hang && x.ma_ngan_hang).map(x => [x.ngan_hang.trim().toLowerCase(), String(x.ma_ngan_hang)]))
  const ten = capBac?.find(c => c.ma === hienHanh?.cap_bac)?.ten
  // Ô tóm tắt GỌN 2 dòng (anh yêu cầu 23/10/2026) — chi tiết đầy đủ hiện khi rê chuột.
  const fmtGon = n => { const v = Number(n) || 0; return v >= 1e6 ? (Math.round(v / 1e5) / 10).toLocaleString('vi-VN') + 'tr' : v.toLocaleString('vi-VN') }
  const npt = Number(hienHanh?.so_nguoi_phu_thuoc) || 0
  const stk = nganHang?.so_tai_khoan ? String(nganHang.so_tai_khoan) : ''
  const chiTiet = [
    hienHanh ? (ten || 'Chưa gán cấp') + ' · lương ' + fmt(hienHanh.luong_co_ban) : 'Chưa đặt lương',
    hienHanh ? (hienHanh.tham_gia_bhxh ? 'Đóng BHXH trên ' + fmt(hienHanh.luong_bhxh) : 'Không tham gia BHXH') : null,
    hienHanh ? npt + ' người phụ thuộc' : null,
    hienHanh ? 'Áp dụng từ ' + String(hienHanh.ap_dung_tu).slice(5, 7) + '/' + String(hienHanh.ap_dung_tu).slice(0, 4) : null,
    stk ? 'Tài khoản: ' + (nganHang.ngan_hang || '') + ' ' + stk + (nganHang.chu_tai_khoan ? ' · ' + nganHang.chu_tai_khoan : '') : 'Chưa có tài khoản nhận lương',
    hoSo?.ma_nhan_vien ? 'Mã NV ' + hoSo.ma_nhan_vien : 'Chưa có mã NV',
    hoSo?.ngay_vao_lam ? 'Vào làm ' + String(hoSo.ngay_vao_lam).split('-').reverse().join('/') : null,
    hoSo?.cham_cong_may === false ? 'Tự khai công (không chấm máy)' : null,
  ].filter(Boolean).join('\n')
  const phu = [
    hienHanh ? (hienHanh.tham_gia_bhxh ? 'BHXH ' + fmtGon(hienHanh.luong_bhxh) : 'Không BHXH') : null,
    npt ? npt + ' NPT' : null,
    stk ? '🏦 ··' + stk.slice(-4) : null,
    hoSo?.cham_cong_may === false ? 'tự khai công' : null,
  ].filter(Boolean).join(' · ')
  const tom = (
    <div className="text-xs leading-relaxed whitespace-nowrap cursor-default" title={chiTiet}>
      <div className={hienHanh ? 'text-gray-800' : 'text-gray-400'}>
        {hienHanh ? <><b>{ten || 'Chưa gán cấp'}</b> · {fmt(hienHanh.luong_co_ban)}</> : 'Chưa đặt lương'}
        {sua && <button onClick={batDau} className="ml-1.5 text-[#8B1A1A] underline">{hienHanh ? 'Đổi' : 'Đặt lương'}</button>}
      </div>
      {phu && <div className="text-gray-400">{phu}</div>}
    </div>
  )
  if (!mo) return tom

  // Mở thành hộp nổi giữa màn hình — sửa ngay trong ô làm bảng nhân viên phình ngang, phải kéo thanh cuộn.
  return (<>{tom}
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setMo(false)}>
    <div className="text-sm space-y-2 w-full max-w-sm bg-white border border-gray-200 rounded-xl p-4 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="font-semibold text-gray-900">{tenNv ? 'Lương · ' + tenNv : 'Cấp bậc & lương'}</div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-28">Mã nhân viên</span>
        <input value={f.ma_nhan_vien} onChange={e => setF(v => ({ ...v, ma_nhan_vien: e.target.value.replace(/\s+/g, '').toUpperCase() }))} maxLength={20}
          placeholder="theo máy chấm công" className="w-36 border border-gray-300 rounded px-2 py-1" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-28">Ngày vào làm</span>
        <input type="date" value={f.ngay_vao_lam} onChange={e => setF(v => ({ ...v, ngay_vao_lam: e.target.value }))} className="border border-gray-300 rounded px-1 py-0.5" />
      </div>
      <label className="flex items-center gap-1 text-gray-700">
        <input type="checkbox" checked={f.cham_cong_may} onChange={e => setF(v => ({ ...v, cham_cong_may: e.target.checked }))} />
        Chấm công bằng máy <span className="text-xs text-gray-400">(bỏ tick: NV online / ban giám đốc tự khai)</span>
      </label>
      <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
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
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-28">Người phụ thuộc</span>
        <input type="number" min={0} max={20} value={f.so_nguoi_phu_thuoc} onChange={e => setF(v => ({ ...v, so_nguoi_phu_thuoc: Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))) }))}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-right" />
        <span className="text-xs text-gray-400">× 6.200.000 giảm trừ</span>
      </div>
      <div className="text-xs text-gray-500">{f.tham_gia_bhxh ? 'Thuế TNCN: biểu lũy tiến (giảm trừ bản thân + người phụ thuộc + BHXH).' : 'Chưa tham gia BHXH (thử việc / học việc): khấu trừ thuế 10% tổng thu nhập.'}</div>
      <div className="pt-2 mt-1 border-t border-gray-100 font-semibold text-gray-800">🏦 Tài khoản nhận lương</div>
      {[['ngan_hang', 'Ngân hàng', 'vd: Vietcombank'], ['ma_ngan_hang', 'Mã ngân hàng', 'mã số trong file chi lương'], ['so_tai_khoan', 'Số tài khoản', ''], ['chu_tai_khoan', 'Tên chủ TK', '']].map(([k, l, ph]) => (
        <div key={k} className="flex items-center gap-1">
          <span className="text-gray-500 w-28">{l}</span>
          <input value={f[k]} list={k === 'ngan_hang' ? 'ds-ngan-hang-' + staffId : undefined} onChange={e => {
            const v0 = e.target.value
            setF(v => {
              if (k === 'ngan_hang') {
                // Ngân hàng đã có người khác nhập mã → tự điền mã (vẫn sửa tay được).
                const ma = maTheoTen.get(v0.trim().toLowerCase())
                return { ...v, ngan_hang: v0, ma_ngan_hang: ma && !v.ma_ngan_hang ? ma : v.ma_ngan_hang }
              }
              return { ...v, [k]: k === 'so_tai_khoan' ? v0.replace(/\s+/g, '') : k === 'ma_ngan_hang' ? v0.replace(/\D/g, '') : k === 'chu_tai_khoan' ? v0.toUpperCase() : v0 }
            })
          }}
            placeholder={ph} maxLength={k === 'so_tai_khoan' ? 30 : k === 'ma_ngan_hang' ? 10 : 120} className="flex-1 border border-gray-300 rounded px-2 py-1" />
        </div>
      ))}
      <datalist id={'ds-ngan-hang-' + staffId}>{[...new Set(dsNganHang.map(x => (x.ngan_hang || '').trim()).filter(Boolean))].map(t => <option key={t} value={t} />)}</datalist>
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
