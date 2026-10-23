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
  const [sua, setSua] = useState(null)     // { staff_id, phu_cap, dieu_chinh, ly_do } — phụ cấp / điều chỉnh đang nhập
  const [loiSua, setLoiSua] = useState(null)
  const luuDieuChinh = async () => {
    setLoiSua(null)
    try {
      const res = await fetch('/api/admin/luong/chot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viec: 'dieu_chinh', nam: ky.nam, thang: ky.thang, staffId: sua.staff_id, phu_cap: Number(sua.phu_cap) || 0, dieu_chinh: Number(sua.dieu_chinh) || 0, ly_do: sua.ly_do }) })
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
      {loiSua && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2.5 text-sm">{loiSua}</div>}
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
          {/* 14 thẻ chia 2 hàng × 7 (anh yêu cầu 23/10): hàng 1 các khoản thu nhập, hàng 2 tổng / khoản trừ / thực lĩnh. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[['Lương theo công', tong('luongTheoCong'), 'bg-blue-50 border-blue-200 text-blue-900'],
              ['Thưởng KPI công việc', tong('thuongViec'), 'bg-emerald-50 border-emerald-200 text-emerald-900'],
              ['Thưởng KPI công nợ', tong('thuongNo'), 'bg-teal-50 border-teal-200 text-teal-900'],
              ['Thưởng doanh số', tong('thuongDoanhSo'), 'bg-violet-50 border-violet-200 text-violet-900'],
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
                        <td colSpan={18} className="sticky left-0 px-3 py-2 text-sm font-bold text-[#8B1A1A]">
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
                        <span className="text-gray-400"> / {x.laTruongPhong ? 'TP 20%' : fmt(x.toiThieu)}</span> → <b className="text-violet-800">{fmt(x.thuongDoanhSo)}</b>
                        {mo === x.staff_id && <div className="text-left text-xs text-gray-600 mt-1 space-y-0.5 max-h-48 overflow-y-auto">{x.congTyDoanhThu.map(c => <div key={c.id}>{c.ma || c.ten}: {fmt(c.doanhThu)}{c.quy ? ' (quý ÷3)' : ''}</div>)}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-orange-700">{fmt(x.thuongDvk)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{x.hoaHongGt ? <>
                        <div className="font-semibold text-emerald-700">{fmt(x.thuongHoaHong)}</div>
                        <div className="text-[11px] text-gray-500" title={(x.hoaHongGt.chiTiet || []).map(c => (c.ma || c.ten) + ' · ' + c.nguon + ' ' + c.kyThang + ': ' + Number(c.so_tien).toLocaleString('vi-VN')).join('\n')}>
                          {x.hoaHongGt.soCty}/{x.hoaHongGt.soCtyTong} cty × {x.hoaHongGt.tyLe}%</div>
                      </> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className={'font-semibold ' + pctMau(x.pctTacPhong)} title={(x.soLanViPham || 0) + ' lần vi phạm'}>{x.pctTacPhong ?? 100}%</span>
                        {x.kpiApDung ? <> · <span className={pctMau(x.diemKpiPhong)}>{x.diemKpiPhong ?? '—'}%</span> → <b className="text-fuchsia-800">{fmt(x.thuongPhong)}</b></> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {sua?.staff_id === x.staff_id ? (
                          <div className="space-y-1 text-left min-w-[200px]">
                            <input value={sua.phu_cap} onChange={e => setSua(v => ({ ...v, phu_cap: e.target.value.replace(/[^\d]/g, '') }))} placeholder="Phụ cấp" className="w-full border border-amber-300 rounded px-2 py-1 text-right" />
                            <input value={sua.dieu_chinh} onChange={e => setSua(v => ({ ...v, dieu_chinh: e.target.value.replace(/[^\d-]/g, '') }))} placeholder="Điều chỉnh (+/−)" className="w-full border border-amber-300 rounded px-2 py-1 text-right" />
                            <input value={sua.ly_do} onChange={e => setSua(v => ({ ...v, ly_do: e.target.value }))} placeholder="Lý do điều chỉnh" className="w-full border border-amber-300 rounded px-2 py-1" />
                            <div className="flex gap-2 justify-end"><button onClick={luuDieuChinh} className="text-xs px-2 py-1 rounded bg-[#8B1A1A] text-white">Lưu</button><button onClick={() => setSua(null)} className="text-xs text-gray-500">Hủy</button></div>
                          </div>
                        ) : (
                          <>
                            {x.phuCap ? <div>+{fmt(x.phuCap)}</div> : null}
                            {x.dieuChinh ? <div className={x.dieuChinh < 0 ? 'text-rose-600' : 'text-emerald-700'} title={x.lyDoDieuChinh}>{x.dieuChinh > 0 ? '+' : ''}{fmt(x.dieuChinh)}</div> : null}
                            {!x.phuCap && !x.dieuChinh && <span className="text-gray-300">—</span>}
                            {d.duocChot && !d.daChot && <div><button onClick={() => setSua({ staff_id: x.staff_id, phu_cap: x.phuCap ? String(x.phuCap) : '', dieu_chinh: x.dieuChinh ? String(x.dieuChinh) : '', ly_do: x.lyDoDieuChinh || '' })} className="text-xs text-[#8B1A1A] underline">Nhập</button></div>}
                          </>
                        )}
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
                  {!ds.length && <tr><td colSpan={18} className="px-4 py-8 text-center text-gray-400">Không có nhân viên nào khớp bộ lọc.</td></tr>}
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
          <p className="text-xs text-gray-500">Thưởng KPI: dưới 80% → 0 · 80–90% → 300.000 · trên 90% → 500.000. Doanh thu = phí kế toán phải thu của công ty phụ trách chính, chưa VAT, công ty quý chia 3. Bấm số doanh thu để xem từng công ty. Khoản trừ: BHXH 10,5% + KPCĐ 0,5% × lương đóng BHXH + Đoàn phí 40.000 (chỉ người tham gia BHXH). Tác phong mỗi người = 100% − 20% × số lần vi phạm tự khai; % tác phong phòng = trung bình cả phòng. Phụ cấp / điều chỉnh ngoại lệ: kế toán nội bộ bấm "Nhập" ở từng dòng trước khi chốt.</p>
        </>
      )}
    </div>
  )
}
