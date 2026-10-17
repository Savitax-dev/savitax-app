'use client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import ThanhChotLuong from './ThanhChotLuong'

// Tab "Bảng lương" — phân hệ Tiền lương BƯỚC 2 (chỉ ban lãnh đạo / kế toán nội bộ: view_payroll).
// Chỉ ĐỌC: tính từ chấm công, lương, KPI và doanh thu thật (lib/luong/bangLuong.js). Cột khoản trừ /
// thực lĩnh tạm hiện số của bước 3 (lib/luong/khauTru.js); thanh chốt + Excel là ThanhChotLuong.js.

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={ky.nam + '-' + ky.thang} onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setKy({ nam: y, thang: m }) }}
          className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-medium shadow-sm">
          {thangChon.map(t => <option key={t.nam + '-' + t.thang} value={t.nam + '-' + t.thang}>Lương tháng {t.thang}/{t.nam}</option>)}
        </select>
        {dsPhong.length > 1 && (
          <select value={phong} onChange={e => setPhong(e.target.value)} className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm shadow-sm">
            <option value="">Tất cả phòng</option>
            {dsPhong.map(p => <option key={p} value={p}>Phòng {p}</option>)}
          </select>
        )}
        <input value={tim} onChange={e => setTim(e.target.value)} placeholder="🔍 Tìm nhân viên…" className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm shadow-sm w-56" />
        {d && <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1">Công chuẩn {d.ngayCongChuan}</span>
          <span className="rounded-full bg-violet-50 text-violet-800 border border-violet-200 px-3 py-1">%-công việc T{d.kyViec.thang}/{d.kyViec.nam}</span>
          <span className="rounded-full bg-violet-50 text-violet-800 border border-violet-200 px-3 py-1">%-công nợ T{d.kyNo.thang}/{d.kyNo.nam}</span>
          <span className="rounded-full bg-violet-50 text-violet-800 border border-violet-200 px-3 py-1">Doanh thu T{d.kyDoanhThu.thang}/{d.kyDoanhThu.nam} (chưa VAT)</span>
        </div>}
      </div>

      {/* Bước 3: trạng thái chốt + nút Xuất Excel / Chốt / Mở chốt — components/luong/ThanhChotLuong.js */}
      {d && <ThanhChotLuong d={d} ky={ky} onXong={tai} />}
      {loi && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2.5 text-sm">{loi}</div>}
      {!d && !loi && <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">Đang tính bảng lương (KPI hai tháng + doanh thu)… mất vài giây.</div>}

      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
            {[['Lương theo công', tong('luongTheoCong'), 'bg-blue-50 border-blue-200 text-blue-900'],
              ['Thưởng KPI công việc', tong('thuongViec'), 'bg-emerald-50 border-emerald-200 text-emerald-900'],
              ['Thưởng KPI công nợ', tong('thuongNo'), 'bg-teal-50 border-teal-200 text-teal-900'],
              ['Thưởng doanh số', tong('thuongDoanhSo'), 'bg-violet-50 border-violet-200 text-violet-900'],
              ['Thưởng dịch vụ khác', tong('thuongDvk'), 'bg-orange-50 border-orange-200 text-orange-900'],
              ['Thu nhập tạm', tong('thuNhapTam'), 'bg-slate-50 border-slate-200 text-slate-900'],
              ['Khoản trừ', ds.reduce((a, x) => a + (x.khauTru?.tong || 0), 0), 'bg-rose-50 border-rose-200 text-rose-900'],
              ['Thực lĩnh tạm', tong('thucLinhTam'), 'bg-gray-900 border-gray-900 text-white']].map(([l, v, c]) => (
              <div key={l} className={'rounded-2xl border p-4 ' + c}><div className="text-xs font-medium opacity-80">{l}</div><div className="text-xl font-bold mt-1">{fmt(v)}</div></div>
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
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right">Tổng thưởng</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right text-rose-700">Trừ BHXH · KPCĐ · Đoàn</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold text-right">Thực lĩnh tạm</th>
                  <th className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-3 font-semibold">Cần xem</th>
                </tr></thead>
                <tbody>
                  {ds.map((x, i) => (
                    <Fragment key={x.staff_id}>
                    {(i === 0 || ds[i - 1].phong !== x.phong) && (
                      <tr className="bg-rose-50/70 border-t-2 border-rose-200">
                        <td colSpan={13} className="sticky left-0 px-3 py-2 text-sm font-bold text-[#8B1A1A]">
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
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">{fmt(x.tongThuong)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-700 whitespace-nowrap">{x.khauTru?.tong ? <span title={'BHXH ' + fmt(x.khauTru.bhxh) + ' · KPCĐ ' + fmt(x.khauTru.kpcd) + ' · Đoàn phí ' + fmt(x.khauTru.doanPhi)}>−{fmt(x.khauTru.tong)}</span> : <span className="text-xs text-gray-400">không BHXH</span>}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">{x.luongCoBan === null ? '—' : fmt(x.thucLinhTam)}</td>
                      <td className="px-3 py-2.5">{x.canhBao.map(c => <div key={c} className="text-xs text-amber-700 whitespace-nowrap">⚠ {c}</div>)}</td>
                    </tr>
                    </Fragment>
                  ))}
                  {!ds.length && <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-400">Không có nhân viên nào khớp bộ lọc.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white font-semibold text-violet-900">🏢 KPI phòng — thưởng phòng tính trên file Excel (cần KPI tác phong)</div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-2.5 font-semibold">Phòng</th><th className="px-4 py-2.5 font-semibold text-right">%-công việc T{d.kyViec.thang}</th>
                <th className="px-4 py-2.5 font-semibold text-right">%-công nợ T{d.kyNo.thang}</th><th className="px-4 py-2.5 font-semibold text-right">KPI tác phong</th>
              </tr></thead>
              <tbody>{d.phong.map(r => (
                <tr key={r.room_id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900">{r.ten}</td>
                  <td className={'px-4 py-2 text-right font-semibold ' + pctMau(r.pctViec)}>{r.pctViec ?? '—'}%</td>
                  <td className={'px-4 py-2 text-right font-semibold ' + pctMau(r.pctNo)}>{r.pctNo ?? '—'}%</td>
                  <td className="px-4 py-2 text-right text-xs text-gray-400">nhập trên file</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">Thưởng KPI: dưới 80% → 0 · 80–90% → 300.000 · trên 90% → 500.000. Doanh thu = phí kế toán phải thu của công ty phụ trách chính, chưa VAT, công ty quý chia 3. Bấm số doanh thu để xem từng công ty. Khoản trừ: BHXH 10,5% + KPCĐ 0,5% × lương đóng BHXH + Đoàn phí 40.000 (chỉ người tham gia BHXH). "Thực lĩnh tạm" chưa gồm thưởng phòng, phụ cấp và điều chỉnh ngoại lệ — nhập trên file Excel, file tự tính lại.</p>
        </>
      )}
    </div>
  )
}
