'use client'
// Hộp nhập PHỤ CẤP · ĐIỀU CHỈNH nhiều dòng giữa màn hình — dùng chung cho tab Bảng lương (nhân viên) và Lương CTV
// (chiDieuChinh: chỉ loại Điều chỉnh, anh yêu cầu 18/11/2026). Mỗi khoản BẮT BUỘC nội dung; máy chủ chặn lại lần nữa
// (lib/luong/dieuChinh.js). Tách từ BangLuong.js — giữ nguyên giao diện cũ.
//   sua: { ten, phong, thucLinh, dong:[{khoa, id?, loai, so_tien, noi_dung, tenNguoi?, luc?}] } · setSua · onLuu()
const fmt = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('vi-VN')

export default function HopDieuChinh({ sua, setSua, ky, loiSua, onLuu, chiDieuChinh = false }) {
  const luuDieuChinh = onLuu
  const so = v => v ? Math.abs(Number(v)).toLocaleString('vi-VN') : ''
  const doiDong = (i, patch) => setSua(v => ({ ...v, dong: v.dong.map((x, j) => j === i ? { ...x, ...patch } : x) }))
  const dongCo = sua.dong.filter(x => Number(x.so_tien) || String(x.noi_dung || '').trim())
  const loiDong = x => !Number(x.so_tien) ? 'Chưa nhập số tiền' : String(x.noi_dung || '').trim().length < 3 ? 'Ghi nội dung khoản' : null
  const coLoi = dongCo.some(loiDong)
  const tongPc = dongCo.filter(x => x.loai === 'phu_cap').reduce((a, x) => a + (Number(x.so_tien) || 0), 0)
  const tongDc = dongCo.filter(x => x.loai === 'dieu_chinh').reduce((a, x) => a + (Number(x.so_tien) || 0), 0)
  const O = 'border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#8B1A1A]'
  const moi = () => ({ khoa: Math.random(), loai: chiDieuChinh ? 'dieu_chinh' : 'phu_cap', so_tien: 0, noi_dung: '' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSua(null) }}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl p-5" onKeyDown={e => { if (e.key === 'Escape') setSua(null) }}>
        <div className="mb-3">
          <div className="font-bold text-gray-900">{chiDieuChinh ? 'Điều chỉnh tăng / giảm — lương CTV' : 'Phụ cấp · điều chỉnh — lương'} tháng {ky.thang}/{ky.nam}</div>
          <div className="text-sm text-gray-500">{sua.ten}{sua.phong ? ' · Phòng ' + sua.phong : ''}{sua.thucLinh != null ? (chiDieuChinh ? ' · thực nhận hiện tại ' : ' · thực lĩnh hiện tại ') + fmt(sua.thucLinh) : ''}</div>
        </div>
        <div className="overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-[130px_150px_1fr_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1 px-0.5">
            <span>Loại</span><span className="text-right">Số tiền</span><span>Nội dung <span className="text-rose-600">*</span></span><span />
          </div>
          {sua.dong.map((x, i) => {
            const am = Number(x.so_tien) < 0
            const l = (Number(x.so_tien) || String(x.noi_dung || '').trim()) ? loiDong(x) : null
            return (
              <div key={x.khoa} className="mb-2">
                <div className="grid grid-cols-[130px_150px_1fr_32px] gap-2 items-center">
                  {chiDieuChinh
                    ? <span className={O + ' bg-gray-50 text-gray-600'}>Điều chỉnh</span>
                    : <select value={x.loai} onChange={e => doiDong(i, { loai: e.target.value, so_tien: e.target.value === 'phu_cap' ? Math.abs(Number(x.so_tien) || 0) : x.so_tien })} className={O}>
                        <option value="phu_cap">Phụ cấp</option>
                        <option value="dieu_chinh">Điều chỉnh</option>
                      </select>}
                  <div className="flex gap-1">
                    {/* dấu +/− tách riêng cho khỏi gõ nhầm số âm; phụ cấp luôn cộng */}
                    {x.loai === 'dieu_chinh'
                      ? <button type="button" onClick={() => doiDong(i, { so_tien: -(Number(x.so_tien) || 0) })} title="Đổi cộng / trừ"
                          className={'w-9 shrink-0 rounded-lg border text-sm font-bold ' + (am ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700')}>{am ? '−' : '+'}</button>
                      : <span className="w-9 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center justify-center">+</span>}
                    <input autoFocus={i === sua.dong.length - 1 && !x.so_tien} value={so(x.so_tien)} placeholder="0" inputMode="numeric"
                      onChange={e => { const n = Number(e.target.value.replace(/[^\d]/g, '')) || 0; doiDong(i, { so_tien: am ? -n : n }) }} className={O + ' w-full text-right'} />
                  </div>
                  <input value={x.noi_dung} onChange={e => doiDong(i, { noi_dung: e.target.value })} maxLength={200}
                    placeholder={x.loai === 'phu_cap' ? 'vd: Phụ cấp xăng xe tháng 10' : 'vd: Truy thu BHXH T9, giám đốc duyệt 01/11'}
                    className={O + ' w-full ' + (l === 'Ghi nội dung khoản' ? 'border-rose-400 bg-rose-50' : '')} />
                  <button type="button" onClick={() => setSua(v => ({ ...v, dong: v.dong.filter((_, j) => j !== i) }))} title="Xoá khoản này"
                    className="h-8 w-8 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600">🗑️</button>
                </div>
                {(l || x.tenNguoi) && <div className="text-[11px] mt-0.5 pl-0.5">
                  {l ? <span className="text-rose-600">{l}</span> : <span className="text-gray-400">Nhập: {x.tenNguoi}{x.luc ? ' · ' + new Date(x.luc).toLocaleString('vi-VN') : ''}</span>}
                </div>}
              </div>
            )
          })}
          <button type="button" onClick={() => setSua(v => ({ ...v, dong: [...v.dong, moi()] }))}
            className="mt-1 text-sm font-semibold text-[#8B1A1A] hover:underline">＋ Thêm khoản</button>
        </div>
        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm flex flex-wrap gap-x-5 gap-y-1">
          {!chiDieuChinh && <span>Phụ cấp <b className="text-emerald-700">+{fmt(tongPc)}</b></span>}
          <span>Điều chỉnh <b className={tongDc < 0 ? 'text-rose-700' : 'text-emerald-700'}>{tongDc > 0 ? '+' : ''}{fmt(tongDc)}</b></span>
          <span className="ml-auto">Cộng vào thu nhập <b className="text-gray-900">{tongPc + tongDc > 0 ? '+' : ''}{fmt(tongPc + tongDc)}</b></span>
        </div>
        <p className="mt-2 text-xs text-gray-500">Xoá hết các khoản rồi Lưu = bỏ {chiDieuChinh ? '' : 'phụ cấp / '}điều chỉnh của tháng này. Trên bảng lương hiện số tổng, rê chuột vào để xem từng khoản.</p>
        {loiSua && <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-sm">{loiSua}</div>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setSua(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Hủy</button>
          <button onClick={luuDieuChinh} disabled={coLoi} className="px-5 py-2 rounded-lg bg-[#8B1A1A] text-white text-sm font-semibold disabled:opacity-40">Lưu</button>
        </div>
      </div>
    </div>
  )
}
