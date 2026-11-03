'use client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import ThanhChotLuong from './ThanhChotLuong'

// Tab "Bảng lương" — phân hệ Tiền lương BƯỚC 2 (chỉ ban lãnh đạo / kế toán nội bộ: view_payroll).
// Chỉ ĐỌC: tính từ chấm công, lương, KPI và doanh thu thật (lib/luong/bangLuong.js). Cột khoản trừ /
// thực lĩnh hiện số của bước 3 (lib/luong/khauTru.js + thueTncn.js); thanh chốt + Excel là ThanhChotLuong.js.

const fmt = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('vi-VN')
const pctMau = p => p === null || p === undefined ? 'text-gray-400' : p > 90 ? 'text-emerald-700' : p >= 80 ? 'text-amber-700' : 'text-rose-600'
const searchKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function BangLuong({ quyen }) {
  const [ky, setKy] = useState(quyen.thangDuocKhai[0])
  const [d, setD] = useState(null)
  const [loi, setLoi] = useState(null)
  const [phong, setPhong] = useState('')
  const [tim, setTim] = useState('')
  const [mo, setMo] = useState(null)
  const [moHh, setMoHh] = useState(null)   // ô Hoa hồng GT đang mở danh sách công ty (như cột Doanh thu)
  const [sua, setSua] = useState(null)     // { staff_id, ten, phong, thucLinh, dong:[{khoa, id?, loai, so_tien, noi_dung}] } — đang nhập
  const [loiSua, setLoiSua] = useState(null)
  const [xemDc, setXemDc] = useState(null) // hộp nổi từng khoản phụ cấp · điều chỉnh khi rê chuột
  const moSua = x => {
    setLoiSua(null)
    const dong = (x.dongDieuChinh || []).map(d => ({ ...d, khoa: d.id || Math.random(), id: String(d.id || '').startsWith('cu-') ? undefined : d.id }))
    setSua({ staff_id: x.staff_id, ten: x.ten || '', phong: x.phong || '', thucLinh: x.thucLinh,
      dong: dong.length ? dong : [{ khoa: Math.random(), loai: 'phu_cap', so_tien: 0, noi_dung: '' }] })
  }
  const luuDieuChinh = async () => {
    setLoiSua(null)
    try {
      const dong = sua.dong.filter(x => Number(x.so_tien) || String(x.noi_dung || '').trim()).map(x => ({ id: x.id, loai: x.loai, so_tien: Number(x.so_tien) || 0, noi_dung: x.noi_dung }))
      const res = await fetch('/api/admin/luong/chot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viec: 'dieu_chinh', nam: ky.nam, thang: ky.thang, staffId: sua.staff_id, dong }) })
      const j = await res.json()
      if (j.error) { setLoiSua(j.error); return }
      setSua(null); await tai()
    } catch (e) { setLoiSua(String(e.message || e)) }
  }

  const tai = useCallback(async () => {
    setD(null); setLoi(null)
    try {
      const res = await fetch('/api/admin/luong/thuong?viec=bang_luong&nam=' + ky.nam + '&thang=' + ky.thang, { cache: 'no-store' })
      const j = await res.json()
      if (j.error) setLoi(j.error); else setD(j)
    } catch (e) { setLoi('Không tải được bảng lương: ' + (e.message || e)) }
  }, [ky])
  useEffect(() => { tai() }, [tai])

  const dsPhong = useMemo(() => [...new Set((d?.dong || []).map(x => x.phong).filter(Boolean))].sort(), [d])
  const k = searchKey(tim)
  // Xếp theo PHÒNG, trong mỗi phòng trưởng phòng đứng đầu rồi tới nhân viên theo tên (anh yêu cầu 18/10/2026).
  const ds = (d?.dong || []).filter(x => (!phong || x.phong === phong) && (!k || searchKey(x.ten).includes(k)))
    .sort((a, b) => (a.phong ? 0 : 1) - (b.phong ? 0 : 1) || String(a.phong).localeCompare(String(b.phong), 'vi')
      || (b.laTruongPhong ? 1 : 0) - (a.laTruongPhong ? 1 : 0) || String(a.ten).localeCompare(String(b.ten), 'vi'))
  const tong = f => ds.reduce((a, x) => a + (Number(x[f]) || 0), 0)

  const thangChon = []
  for (let i = 0; i < 6; i++) {
    let y = quyen.thangDuocKhai[0].nam, m = quyen.thangDuocKhai[0].thang - i
    while (m < 1) { m += 12; y-- }
    thangChon.push({ nam: y, thang: m })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={ky.nam + '-' + ky.thang} onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setKy({ nam: y, thang: m }) }}
          className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm">
          {thangChon.map(t => <option key={t.nam + '-' + t.thang} value={t.nam + '-' + t.thang}>Lương tháng {t.thang}/{t.nam}</option>)}
        </select>
        {dsPhong.length > 1 && (
          <select value={phong} onChange={e => setPhong(e.target.value)} className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-sm shadow-sm">
            <option value="">Tất cả phòng</option>
            {dsPhong.map(p => <option key={p} value={p}>Phòng {p}</option>)}
          </select>
        )}
        <input value={tim} onChange={e => setTim(e.target.value)} placeholder="🔍 Tìm nhân viên…" className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-sm shadow-sm w-56" />
        {d && <span className="text-xs text-gray-500" title="Kỳ số liệu của bảng lương: %-công việc tháng N, %-công nợ tháng N−1, doanh thu tháng N (chưa VAT)">
          Công chuẩn <b className="text-blue-800">{d.ngayCongChuan}</b> · việc <b className="text-violet-800">T{d.kyViec.thang}</b> · nợ <b className="text-violet-800">T{d.kyNo.thang}</b> · doanh thu <b className="text-violet-800">T{d.kyDoanhThu.thang}</b>
        </span>}
      </div>

      {/* Bước 3: trạng thái chốt + nút Xuất Excel / Chốt / Mở chốt — components/luong/ThanhChotLuong.js */}
      {d && <ThanhChotLuong d={d} ky={ky} onXong={tai} />}
      {loi && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2.5 text-sm">{loi}</div>}
      {/* Hộp nhập PHỤ CẤP · ĐIỀU CHỈNH riêng giữa màn hình (anh chỉ 02/11/2026). NHIỀU DÒNG, mỗi khoản một nội dung
          (anh yêu cầu 02/11/2026, sql/47) — nội dung BẮT BUỘC từng dòng, máy chủ chặn lại lần nữa (lib/luong/dieuChinh.js). */}
      {sua && (() => {
        const so = v => v ? Math.abs(Number(v)).toLocaleString('vi-VN') : ''
        const doiDong = (i, patch) => setSua(v => ({ ...v, dong: v.dong.map((x, j) => j === i ? { ...x, ...patch } : x) }))
        const dongCo = sua.dong.filter(x => Number(x.so_tien) || String(x.noi_dung || '').trim())
        const loiDong = x => !Number(x.so_tien) ? 'Chưa nhập số tiền' : String(x.noi_dung || '').trim().length < 3 ? 'Ghi nội dung khoản' : null
        const coLoi = dongCo.some(loiDong)
        const tongPc = dongCo.filter(x => x.loai === 'phu_cap').reduce((a, x) => a + (Number(x.so_tien) || 0), 0)
        const tongDc = dongCo.filter(x => x.loai === 'dieu_chinh').reduce((a, x) => a + (Number(x.so_tien) || 0), 0)
        const O = 'border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#8B1A1A]'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSua(null) }}>
            <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl p-5" onKeyDown={e => { if (e.key === 'Escape') setSua(null) }}>
              <div className="mb-3">
                <div className="font-bold text-gray-900">Phụ cấp · điều chỉnh — lương tháng {ky.thang}/{ky.nam}</div>
                <div className="text-sm text-gray-500">{sua.ten}{sua.phong ? ' · Phòng ' + sua.phong : ''}{sua.thucLinh != null ? ' · thực lĩnh hiện tại ' + fmt(sua.thucLinh) : ''}</div>
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
                        <select value={x.loai} onChange={e => doiDong(i, { loai: e.target.value, so_tien: e.target.value === 'phu_cap' ? Math.abs(Number(x.so_tien) || 0) : x.so_tien })} className={O}>
                          <option value="phu_cap">Phụ cấp</option>
                          <option value="dieu_chinh">Điều chỉnh</option>
                        </select>
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
                <button type="button" onClick={() => setSua(v => ({ ...v, dong: [...v.dong, { khoa: Math.random(), loai: 'phu_cap', so_tien: 0, noi_dung: '' }] }))}
                  className="mt-1 text-sm font-semibold text-[#8B1A1A] hover:underline">＋ Thêm khoản</button>
              </div>
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm flex flex-wrap gap-x-5 gap-y-1">
                <span>Phụ cấp <b className="text-emerald-700">+{fmt(tongPc)}</b></span>
                <span>Điều chỉnh <b className={tongDc < 0 ? 'text-rose-700' : 'text-emerald-700'}>{tongDc > 0 ? '+' : ''}{fmt(tongDc)}</b></span>
                <span className="ml-auto">Cộng vào thu nhập <b className="text-gray-900">{tongPc + tongDc > 0 ? '+' : ''}{fmt(tongPc + tongDc)}</b></span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Xoá hết các khoản rồi Lưu = bỏ phụ cấp / điều chỉnh của tháng này. Trên bảng lương hiện số tổng, rê chuột vào để xem từng khoản.</p>
              {loiSua && <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-sm">{loiSua}</div>}
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setSua(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Hủy</button>
                <button onClick={luuDieuChinh} disabled={coLoi} className="px-5 py-2 rounded-lg bg-[#8B1A1A] text-white text-sm font-semibold disabled:opacity-40">Lưu</button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* Rê chuột vào ô phụ cấp · điều chỉnh → hiện từng khoản. Hộp nổi FIXED để không bị khung cuộn của bảng cắt mất. */}
      {xemDc && (
        <div className="fixed z-50 w-80 rounded-xl border border-amber-200 bg-white shadow-xl p-3 text-xs pointer-events-none"
          style={{ top: Math.min(xemDc.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 40 - xemDc.dong.length * 44), left: Math.max(8, xemDc.x - 320) }}>
          <div className="font-semibold text-gray-900 mb-1.5">{xemDc.ten} · {xemDc.dong.length} khoản</div>
          {xemDc.dong.map((x, i) => (
            <div key={i} className="flex gap-2 py-1 border-t border-gray-100 first:border-t-0">
              <div className="flex-1 min-w-0">
                <div className="text-gray-800">{x.noi_dung || <i className="text-amber-600">chưa có nội dung</i>}</div>
                <div className="text-[11px] text-gray-400">{x.loai === 'phu_cap' ? 'Phụ cấp' : 'Điều chỉnh'}{x.tenNguoi ? ' · Nhập: ' + x.tenNguoi : ''}</div>
              </div>
              <div className={'font-semibold whitespace-nowrap ' + (x.so_tien < 0 ? 'text-rose-600' : 'text-emerald-700')}>{x.so_tien > 0 ? '+' : ''}{fmt(x.so_tien)}</div>
            </div>
          ))}
        </div>
      )}
      {d?.hoaHongNgoai?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-2.5 text-sm">
          ⚠ <b>Hoa hồng giới thiệu KHÔNG nằm trong bảng lương</b> (người giới thiệu không có dòng lương — phòng remote / chưa đặt lương / đã nghỉ), cần chi tay:
          {' '}{d.hoaHongNgoai.map(h => h.ten + ' ' + Number(h.hoaHong).toLocaleString('vi-VN') + 'đ (' + h.soCty + ' cty × ' + h.tyLe + '%)').join(' · ')}.
          Khoản này không ghi sổ nên tháng sau vẫn hiện lại.
        </div>
      )}
      {!d && !loi && <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">Đang tính bảng lương (KPI hai tháng + doanh thu)… mất vài giây.</div>}

      {d && (
        <>
          {/* 15 thẻ: hàng 1 (8) các khoản thu nhập, hàng 2 (7) tổng / khoản trừ / thực lĩnh — thêm thẻ DS phòng 02/11/2026 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[['Lương theo công', tong('luongTheoCong'), 'bg-blue-50 border-blue-200 text-blue-900'],
              ['Thưởng KPI công việc', tong('thuongViec'), 'bg-emerald-50 border-emerald-200 text-emerald-900'],
              ['Thưởng KPI công nợ', tong('thuongNo'), 'bg-teal-50 border-teal-200 text-teal-900'],
              ['Thưởng doanh số', tong('thuongDoanhSo'), 'bg-violet-50 border-violet-200 text-violet-900'],
              ['Thưởng DS phòng (TP 1%)', tong('thuongDsPhong'), 'bg-purple-50 border-purple-200 text-purple-900'],
              ['Thưởng dịch vụ khác', tong('thuongDvk'), 'bg-orange-50 border-orange-200 text-orange-900'],
              ['Hoa hồng giới thiệu', tong('thuongHoaHong'), 'bg-emerald-50 border-emerald-200 text-emerald-900'],
              ['Thưởng phòng', tong('thuongPhong'), 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900'],
              ['Phụ cấp + điều chỉnh', tong('phuCap') + tong('dieuChinh'), 'bg-amber-50 border-amber-200 text-amber-900'],
              ['Thu nhập', tong('thuNhap'), 'bg-slate-50 border-slate-200 text-slate-900'],
              ['Khoản trừ', ds.reduce((a, x) => a + (x.khauTru?.tong || 0), 0), 'bg-rose-50 border-rose-200 text-rose-900'],
              ['Thuế TNCN', ds.reduce((a, x) => a + (x.thueTncn?.thue || 0), 0), 'bg-red-50 border-red-200 text-red-900'],
              // Phần công ty đóng (không trừ lương) + tổng nộp cơ quan BHXH 32% (anh yêu cầu 23/10/2026).
              ['Cty đóng BH + KPCĐ', ds.reduce((a, x) => a + (x.congTyDong?.tong || 0), 0), 'bg-indigo-50 border-indigo-200 text-indigo-900'],
              ['Tổng nộp BHXH (32%)', ds.reduce((a, x) => a + (x.khauTru?.bhxh || 0) + (x.congTyDong?.nopBhxh || 0), 0), 'bg-indigo-100 border-indigo-300 text-indigo-950'],
              ['Thực lĩnh', tong('thucLinh'), 'bg-gray-900 border-gray-900 text-white']].map(([l, v, c]) => (
              <div key={l} className={'rounded-xl border px-3 py-2 ' + c}><div className="text-[11px] font-medium opacity-80 leading-tight truncate">{l}</div><div className="text-lg font-bold leading-tight mt-0.5">{fmt(v)}</div></div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {/* Cuộn NGAY TRONG khung (thanh kéo ngang luôn nằm trong màn hình), hàng tiêu đề và cột tên nhân viên
                đứng yên khi kéo — trước đây thanh kéo ngang nằm tận cuối bảng 60 dòng, kéo thì mất tiêu đề. */}
            <div className="overflow-auto max-h-[calc(100vh-170px)]">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gradient-to-r from-gray-50 to-rose-50/40 border-b border-gray-200">
                  <th className="sticky top-0 left-0 z-30 bg-gray-50 shadow-[2px_0_0_0_#f3f4f6] border-b border-gray-200 px-3 py-3 font-semibold">Nhân viên</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold">Cấp</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right">Lương CB</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right">Công</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-blue-700">Lương theo công</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-emerald-700">% việc → thưởng</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-teal-700">% nợ → thưởng</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-violet-700">Doanh thu / tối thiểu → thưởng</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-orange-700">DVK</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-emerald-700">Hoa hồng GT</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-purple-700" title="Trưởng phòng: 1% tổng doanh thu kế toán của phòng mình làm trưởng (phí theo kỳ, chưa VAT, không xét đã thu). Kiêm nhiệm chỉ tính phòng kiêm nhiệm.">DS phòng TP 1%</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-fuchsia-700">Tác phong · KPI phòng → thưởng</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-amber-700">Phụ cấp · điều chỉnh</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right">Tổng thưởng</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-rose-700">Trừ BHXH · KPCĐ · Đoàn</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-red-700">Thuế TNCN</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right">Thực lĩnh</th>
                  {d.daChot?.daGui && <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold">Nhân viên xác nhận</th>}
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold">Cần xem</th>
                </tr></thead>
                <tbody>
                  {ds.map((x, i) => (
                    <Fragment key={x.staff_id}>
                    {(i === 0 || ds[i - 1].phong !== x.phong) && (
                      <tr className="bg-rose-50/70 border-t-2 border-rose-200">
                        <td colSpan={19} className="sticky left-0 px-3 py-2 text-sm font-bold text-[#8B1A1A]">
                          🏢 {x.phong ? 'Phòng ' + x.phong : 'Chưa xếp phòng'} <span className="font-normal text-gray-500">· {ds.filter(y => y.phong === x.phong).length} người</span>
                        </td>
                      </tr>
                    )}
                    <tr className={'border-t border-gray-100 align-top ' + (i % 2 ? 'bg-gray-50/50' : 'bg-white') + ' hover:bg-rose-50/40'}>
                      <td className={'sticky left-0 z-20 px-3 py-2.5 shadow-[2px_0_0_0_#f3f4f6] ' + (i % 2 ? 'bg-gray-50' : 'bg-white')}><div className="font-medium text-gray-900 whitespace-nowrap">{x.ten}{x.laTruongPhong && <span className="ml-1.5 text-[10px] font-bold rounded px-1.5 py-0.5 bg-violet-100 text-violet-800 align-middle">TP</span>}</div><div className="text-xs text-gray-500">{x.phong || '—'}</div></td>
                      <td className="px-3 py-2.5">{x.capBac ? <span className={'text-xs font-bold rounded-lg px-2 py-0.5 whitespace-nowrap ' + (x.laTruongPhong ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800')}>{x.capBac}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(x.luongCoBan)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{x.ngayTinhLuong === null ? '—' : x.ngayTinhLuong.toLocaleString('vi-VN') + '/' + x.ngayCongChuan}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-800">{fmt(x.luongTheoCong)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{x.kpiApDung ? <><span className={'font-semibold ' + pctMau(x.pctViec)}>{x.pctViec ?? '—'}%</span> → {fmt(x.thuongViec)}</> : <span className="text-xs text-gray-400">nhập tay</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{x.kpiApDung ? <><span className={'font-semibold ' + pctMau(x.pctNo)}>{x.pctNo ?? '—'}%</span> → {fmt(x.thuongNo)}</> : <span className="text-xs text-gray-400">nhập tay</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setMo(mo === x.staff_id ? null : x.staff_id)} className="hover:underline">{fmt(x.doanhThu)}</button>
                        <span className="text-gray-400"> / {x.laTruongPhong && !x.hcns ? 'TP 20%' : fmt(x.toiThieu)}</span> → <b className="text-violet-800">{fmt(x.thuongDoanhSo)}</b>
                        {/* Phòng HCNS (03/11/2026): thời kỳ lấp tối thiểu trước, phần thời điểm còn dư × 20% */}
                        {x.hcns && <div className="text-[11px] text-gray-500" title={'Thời kỳ lấp mức tối thiểu trước; thiếu thì lấy thời điểm bù; phần thời điểm còn dư × 20%. Thời kỳ vượt không thưởng.'}>
                          TK {fmt(x.hcns.thoiKy)} + TĐ {fmt(x.hcns.thoiDiem)}{x.hcns.thieu ? ' · thiếu ' + fmt(x.hcns.thieu) : ''}{x.hcns.thoiDiemDu ? ' · TĐ dư ' + fmt(x.hcns.thoiDiemDu) + ' × 20%' : ''}</div>}
                        {mo === x.staff_id && <div className="text-left text-xs text-gray-600 mt-1 space-y-0.5 max-h-48 overflow-y-auto">{x.congTyDoanhThu.map(c => <div key={c.id}>{c.ma || c.ten}: {fmt(c.doanhThu)}{c.quy ? ' (quý ÷3)' : ''}{c.khongVat ? ' (không VAT)' : ''}</div>)}
                          {(x.hcns?.hoSo || []).map((h, i) => <div key={'td' + i} className="text-violet-700">TĐ · {h.cty} · {h.ten}: {fmt(h.doanhThu)}</div>)}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-orange-700">{fmt(x.thuongDvk)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{x.hoaHongGt ? <>
                        <button onClick={() => setMoHh(moHh === x.staff_id ? null : x.staff_id)} className="font-semibold text-emerald-700 hover:underline">{fmt(x.thuongHoaHong)}</button>
                        <div className="text-[11px] text-gray-500" title={(x.hoaHongGt.chiTiet || []).map(c => (c.ma || c.ten) + ' · ' + c.nguon + ' kỳ ' + c.kyThang + (c.thangThu && c.thangThu !== c.kyThang ? ' (thu ' + c.thangThu + ')' : '') + ': ' + Number(c.so_tien).toLocaleString('vi-VN')).join('\n')}>
                          {x.hoaHongGt.soCty}/{x.hoaHongGt.soCtyTong} cty{x.hoaHongGt.doanhSo ? ' · DS ' + Number(x.hoaHongGt.doanhSo).toLocaleString('vi-VN') + 'đ' : ''} × {x.hoaHongGt.tyLe}%</div>
                        {/* Bấm số hoa hồng → từng công ty: tiền thu (kỳ phí, tháng ghi thu) → hoa hồng (anh yêu cầu 03/11/2026) */}
                        {moHh === x.staff_id && (() => {
                          const NG = { ketoan: 'KT', hcns: 'HCNS', dvk: 'DVK', khach: 'Thu khác', no_ton: 'Nợ tồn' }
                          const g = new Map()
                          for (const c of x.hoaHongGt.chiTiet || []) {
                            const o = g.get(c.client_id) || { ten: c.ma || c.ten, thu: 0, hh: 0, khoan: [] }
                            o.thu += Number(c.so_tien) || 0; o.hh += Number(c.hoa_hong) || 0
                            o.khoan.push((NG[c.nguon] || c.nguon) + ' T' + Number(String(c.kyThang || '').slice(5, 7)) + (c.thangThu && c.thangThu !== c.kyThang ? ' (thu T' + Number(String(c.thangThu).slice(5, 7)) + ')' : ''))
                            g.set(c.client_id, o)
                          }
                          const ds = [...g.values()].sort((a, b) => b.hh - a.hh)
                          return <div className="text-left text-xs text-gray-600 mt-1 space-y-0.5 max-h-56 overflow-y-auto">
                            {ds.length ? ds.map((o, i) => <div key={i} title={o.khoan.join(' + ')}>{o.ten}: {fmt(o.thu)} → <b className="text-emerald-700">{fmt(o.hh)}</b> <span className="text-gray-400">({o.khoan.join(', ')})</span></div>)
                              : <div className="text-gray-400">Chưa có tiền thu trong kỳ</div>}
                          </div>
                        })()}
                      </> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{x.phongTp?.length ? <>
                        <div className="font-semibold text-purple-800">{fmt(x.thuongDsPhong)}</div>
                        <div className="text-[11px] text-gray-500" title={x.phongTp.map(r => 'Phòng ' + r.ten + ': ' + fmt(r.doanhThu)).join('\n')}>
                          1% × {fmt(x.doanhThuPhongTp)}{x.phongTp.some(r => r.theoToiThieu) ? ' (tối thiểu HCNS)' : ''}{x.phongTp.some(r => r.room_id !== x.room_id) ? ' · kiêm ' + x.phongTp.map(r => r.ten).join(', ') : ''}</div>
                      </> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className={'font-semibold ' + pctMau(x.pctTacPhong)} title={(x.soLanViPham || 0) + ' lần vi phạm'}>{x.pctTacPhong ?? 100}%</span>
                        {x.kpiApDung ? <> · <span className={pctMau(x.diemKpiPhong)}>{x.diemKpiPhong ?? '—'}%</span> → <b className="text-fuchsia-800">{fmt(x.thuongPhong)}</b></> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {/* Chỉ HIỆN trong bảng — nhập ở hộp riêng giữa màn hình (anh chỉ 02/11/2026: nhập chen trong bảng bị chồng chéo) */}
                        {(() => {
                          // Bảng lương chỉ hiện TỔNG; rê chuột hiện từng khoản (anh yêu cầu 02/11/2026). Bản chốt cũ chưa có
                          // dongDieuChinh thì dựng lại từ hai cột tổng.
                          const dong = x.dongDieuChinh || [
                            ...(x.phuCap ? [{ loai: 'phu_cap', so_tien: x.phuCap, noi_dung: x.lyDoDieuChinh, tenNguoi: x.nguoiNhapDieuChinh }] : []),
                            ...(x.dieuChinh ? [{ loai: 'dieu_chinh', so_tien: x.dieuChinh, noi_dung: x.lyDoDieuChinh, tenNguoi: x.nguoiNhapDieuChinh }] : [])]
                          const tongDc = (x.phuCap || 0) + (x.dieuChinh || 0)
                          if (!dong.length) return <span className="text-gray-300">—</span>
                          const thieu = dong.some(z => !String(z.noi_dung || '').trim())
                          return (
                            <div className="inline-block cursor-help" onMouseLeave={() => setXemDc(null)}
                              onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setXemDc({ x: r.right, y: r.bottom + 4, ten: x.ten, dong }) }}>
                              <div className={'font-semibold border-b border-dotted ' + (tongDc < 0 ? 'text-rose-600 border-rose-300' : 'text-emerald-700 border-emerald-300')}>{tongDc > 0 ? '+' : ''}{fmt(tongDc)}</div>
                              <div className="text-[11px] text-gray-500">{dong.length} khoản{thieu ? <span className="text-amber-600"> · ⚠ thiếu nội dung</span> : null}</div>
                            </div>
                          )
                        })()}
                        {d.duocChot && !d.daChot && <div><button onClick={() => moSua(x)} className="text-xs text-[#8B1A1A] underline">{x.phuCap || x.dieuChinh ? 'Sửa' : 'Nhập'}</button></div>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">{fmt(x.tongThuong)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-700 whitespace-nowrap">{x.khauTru?.tong ? <span title={'BHXH ' + fmt(x.khauTru.bhxh) + ' · KPCĐ ' + fmt(x.khauTru.kpcd) + ' · Đoàn phí ' + fmt(x.khauTru.doanPhi)}>−{fmt(x.khauTru.tong)}</span> : <span className="text-xs text-gray-400">không BHXH</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{!x.thueTncn ? <span className="text-gray-300">—</span> : <>
                        <div className="text-red-700 font-semibold">{x.thueTncn.thue ? '−' + fmt(x.thueTncn.thue) : '0'}</div>
                        <div className="text-[11px] text-gray-500" title={x.thueTncn.cach === 'luy_tien'
                          ? 'Chịu thuế ' + fmt(x.thueTncn.thuNhapChiuThue) + ' − bản thân ' + fmt(x.thueTncn.giamTruBanThan) + ' − NPT ' + fmt(x.thueTncn.giamTruPhuThuoc) + ' − BHXH ' + fmt(x.thueTncn.giamTruBhxh) + ' = tính thuế ' + fmt(x.thueTncn.thuNhapTinhThue)
                          : '10% × tổng thu nhập ' + fmt(x.thueTncn.thuNhapChiuThue)}>
                          {x.thueTncn.cach === 'luy_tien' ? 'lũy tiến' + (x.soNguoiPhuThuoc ? ' · ' + x.soNguoiPhuThuoc + ' NPT' : '') : 'khấu trừ 10%'}</div>
                      </>}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">{x.luongCoBan === null ? '—' : fmt(x.thucLinh)}
                        {x.nganHang?.stk && <div className="text-[11px] font-normal text-gray-500" title={x.nganHang.ten + ' · ' + x.nganHang.stk + ' · ' + x.nganHang.chu}>🏦 {x.nganHang.ten || 'NH'} ·· {x.nganHang.stk.slice(-4)}</div>}
                      </td>
                      {d.daChot?.daGui && <td className="px-3 py-2.5 whitespace-nowrap">{
                        !x.phieu ? <span className="text-xs text-gray-400">không gửi</span>
                          : x.phieu.trang_thai === 'da_xac_nhan' ? <span className="text-xs rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5">✓ Đã xác nhận</span>
                          : x.phieu.trang_thai === 'bao_sai' ? <div><span className="text-xs rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5">⚠ Báo sai</span><div className="text-xs text-rose-700 mt-0.5 max-w-[220px] whitespace-normal">{x.phieu.ghi_chu}</div></div>
                          : <span className="text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5">Chờ xác nhận</span>}</td>}
                      <td className="px-3 py-2.5">{x.canhBao.map(c => <div key={c} className="text-xs text-amber-700 whitespace-nowrap">⚠ {c}</div>)}</td>
                    </tr>
                    </Fragment>
                  ))}
                  {!ds.length && <tr><td colSpan={19} className="px-4 py-8 text-center text-gray-400">Không có nhân viên nào khớp bộ lọc.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white font-semibold text-violet-900">🏢 KPI phòng = trung bình 3 tiêu chí · mỗi người trong phòng nhận đủ mức thưởng</div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-2.5 font-semibold">Phòng</th><th className="px-4 py-2.5 font-semibold text-right">%-công việc T{d.kyViec.thang}</th>
                <th className="px-4 py-2.5 font-semibold text-right">%-công nợ T{d.kyNo.thang}</th><th className="px-4 py-2.5 font-semibold text-right">% tác phong</th><th className="px-4 py-2.5 font-semibold text-right">Điểm KPI phòng</th><th className="px-4 py-2.5 font-semibold text-right">Thưởng / người</th>
              </tr></thead>
              <tbody>{d.phong.map(r => (
                <tr key={r.room_id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900">{r.ten}</td>
                  <td className={'px-4 py-2 text-right font-semibold ' + pctMau(r.pctViec)}>{r.pctViec ?? '—'}%</td>
                  <td className={'px-4 py-2 text-right font-semibold ' + pctMau(r.pctNo)}>{r.pctNo ?? '—'}%</td>
                  <td className={'px-4 py-2 text-right font-semibold ' + pctMau(r.pctTacPhong)} title={(r.soLanViPham || 0) + ' lần vi phạm / ' + (r.soNguoi || 0) + ' người'}>{r.pctTacPhong ?? '—'}%</td>
                  <td className={'px-4 py-2 text-right font-bold ' + pctMau(r.diem)}>{r.diem ?? '—'}%</td>
                  <td className="px-4 py-2 text-right font-bold text-fuchsia-800">{fmt(r.thuongMoiNguoi)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">Thưởng KPI: dưới 80% → 0 · 80–90% → 300.000 · trên 90% → 500.000. Doanh thu = phí kế toán phải thu của công ty phụ trách chính, chưa VAT, công ty quý chia 3. Trưởng phòng thêm 1% tổng doanh thu kế toán của phòng mình làm trưởng (kiêm nhiệm: chỉ phòng kiêm nhiệm), không xét đã thu. Bấm số doanh thu để xem từng công ty. Khoản trừ: BHXH 10,5% + KPCĐ 0,5% × lương đóng BHXH + Đoàn phí 40.000 (chỉ người tham gia BHXH). Tác phong mỗi người = 100% − 20% × số lần vi phạm tự khai; % tác phong phòng = trung bình cả phòng. Phụ cấp / điều chỉnh ngoại lệ: kế toán nội bộ bấm "Nhập" ở từng dòng trước khi chốt.</p>
        </>
      )}
    </div>
  )
}
