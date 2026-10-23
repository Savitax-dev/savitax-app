'use client'
// Báo cáo THÂM NIÊN (tab ở trang Báo cáo KPI, anh yêu cầu 23/10/2026): thâm niên từng người, đối chiếu cấp bậc
// theo thâm niên, sắp đến mốc lên cấp, thống kê theo phòng. Quy tắc ở lib/luong/thamNien.js — mốc mỗi cấp đọc
// từ mô tả cấp bậc (tab Tiền lương → Cấp bậc & ngày lễ). Chỉ người có quyền xem lương (có cột cấp bậc).
import { useEffect, useMemo, useState } from 'react'
import { soSanhCap, chuThamNien, soThangThamNien } from '@/lib/luong/thamNien'
import { soExcelMoi, themSheetMang, taiVeExcel } from '@/lib/excelDep'

const TT = {
  den_han: ['Đến hạn lên cấp', 'bg-amber-100 text-amber-800 border-amber-200'],
  dung: ['Đúng cấp', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
  cao_hon: ['Cao hơn thâm niên', 'bg-violet-100 text-violet-800 border-violet-200'],
  chua_cap: ['Chưa gán cấp', 'bg-gray-100 text-gray-600 border-gray-200'],
  chua_ngay: ['Chưa có ngày vào làm', 'bg-rose-50 text-rose-700 border-rose-200'],
  truong_phong: ['Trưởng phòng', 'bg-slate-100 text-slate-700 border-slate-200'],
}
const NHOM = [['Dưới 6 tháng', 0, 6], ['6–12 tháng', 6, 12], ['1–2 năm', 12, 24], ['2–3 năm', 24, 36], ['3–5 năm', 36, 60], ['Trên 5 năm', 60, Infinity]]
const dmy = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—'
const congThang = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10) }

export default function BaoCaoThamNien() {
  const [d, setD] = useState(null)
  const [loi, setLoi] = useState(null)
  const [phong, setPhong] = useState('')
  const [loc, setLoc] = useState('')
  const [trong, setTrong] = useState(3)   // "sắp đến mốc" trong n tháng

  useEffect(() => {
    fetch('/api/admin/luong?viec=tham_nien', { cache: 'no-store' }).then(r => r.json())
      .then(j => j.error ? setLoi(j.error) : setD(j)).catch(e => setLoi(String(e.message || e)))
  }, [])

  const ds = useMemo(() => {
    if (!d) return []
    const capTen = new Map(d.capBac.map(c => [c.ma, c.ten]))
    return d.nhanVien.map(x => {
      const ss = soSanhCap(d.capBac, x.capHienTai, x.ngayVao, d.homNay)
      return { ...x, ...ss, thangTN: soThangThamNien(x.ngayVao, d.homNay), capTen: capTen.get(x.capHienTai) || null }
    }).sort((a, b) => (a.phong ? 0 : 1) - (b.phong ? 0 : 1) || a.phong.localeCompare(b.phong, 'vi')
      || (b.laTruongPhong ? 1 : 0) - (a.laTruongPhong ? 1 : 0) || a.ten.localeCompare(b.ten, 'vi'))
  }, [d])

  if (loi) return <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm">{loi}</div>
  if (!d) return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Đang tải…</div>

  const dsPhong = [...new Set(ds.map(x => x.phong).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  const theoPhong = ds.filter(x => !phong || x.phong === phong)
  const coNgay = theoPhong.filter(x => x.thangTN != null)
  const tb = coNgay.length ? Math.round(coNgay.reduce((a, x) => a + x.thangTN, 0) / coNgay.length) : null
  const hanMoc = congThang(d.homNay, trong)
  const sapLen = theoPhong.filter(x => x.ngayLenCap && x.ngayLenCap > d.homNay && x.ngayLenCap <= hanMoc && x.tt !== 'cao_hon')
    .sort((a, b) => a.ngayLenCap.localeCompare(b.ngayLenCap))
  const dem = {}
  for (const x of theoPhong) dem[x.tt] = (dem[x.tt] || 0) + 1
  const hien = theoPhong.filter(x => !loc || x.tt === loc)

  const thongKe = dsPhong.filter(p => !phong || p === phong).map(p => {
    const nguoi = ds.filter(x => x.phong === p), co = nguoi.filter(x => x.thangTN != null)
    return { p, n: nguoi.length, nhom: NHOM.map(([, a, b]) => co.filter(x => x.thangTN >= a && x.thangTN < b).length),
      tb: co.length ? Math.round(co.reduce((a, x) => a + x.thangTN, 0) / co.length) : null, chua: nguoi.length - co.length, denHan: nguoi.filter(x => x.tt === 'den_han').length }
  })

  const xuatExcel = async () => {
    const wb = await soExcelMoi()
    themSheetMang(wb, 'Tham nien', [
      ['BÁO CÁO THÂM NIÊN NHÂN VIÊN — ngày ' + dmy(d.homNay)], [],
      ['STT', 'Mã NV', 'Họ tên', 'Phòng', 'Ngày vào làm', 'Thâm niên', 'Số tháng', 'Cấp hiện tại', 'Cấp theo thâm niên', 'Đánh giá', 'Lên cấp kế', 'Ngày đủ mốc'],
      ...theoPhong.map((x, i) => [i + 1, x.ma || '', x.ten, x.phong, dmy(x.ngayVao), chuThamNien(x.thangTN), x.thangTN, x.capTen || '', x.dung?.ten || '', TT[x.tt]?.[0] || '', x.ke?.ten || '', x.ngayLenCap ? dmy(x.ngayLenCap) : '']),
    ], { doRong: [5, 9, 26, 12, 13, 15, 9, 12, 16, 20, 11, 13] })
    themSheetMang(wb, 'Theo phong', [
      ['THỐNG KÊ THÂM NIÊN THEO PHÒNG — ngày ' + dmy(d.homNay)], [],
      ['Phòng', 'Số người', ...NHOM.map(n => n[0]), 'TB (tháng)', 'Chưa có ngày vào', 'Đến hạn lên cấp'],
      ...thongKe.map(t => [t.p, t.n, ...t.nhom, t.tb ?? '', t.chua, t.denHan]),
    ], { doRong: [16, 10, 12, 12, 10, 10, 10, 12, 11, 16, 15] })
    await taiVeExcel(wb, 'Bao_cao_tham_nien_' + d.homNay + '.xlsx')
  }

  const The = ({ nhan, so, phu, mau, khoa }) => (
    <button onClick={() => khoa && setLoc(loc === khoa ? '' : khoa)}
      className={'text-left rounded-2xl border p-4 ' + mau + (khoa ? ' hover:shadow-md' : ' cursor-default') + (khoa && loc === khoa ? ' ring-2 ring-offset-1 ring-[#8B1A1A]' : '')}>
      <div className="text-sm font-medium opacity-80">{nhan}</div>
      <div className="text-3xl font-bold mt-1">{so}</div>
      {phu && <div className="text-xs opacity-70 mt-0.5">{phu}</div>}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={phong} onChange={e => setPhong(e.target.value)} className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm shadow-sm">
          <option value="">Tất cả phòng</option>
          {dsPhong.map(p => <option key={p} value={p}>Phòng {p}</option>)}
        </select>
        <span className="text-sm text-gray-500">Tính tới ngày {dmy(d.homNay)} · phòng remote không tính</span>
        <button onClick={xuatExcel} className="ml-auto text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700">⬇ Xuất Excel</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {The({ nhan: 'Nhân viên', so: theoPhong.length, phu: (dem.chua_ngay || 0) + ' chưa có ngày vào làm', mau: 'bg-slate-50 border-slate-200 text-slate-900' })}
        {The({ nhan: 'Thâm niên trung bình', so: tb == null ? '—' : chuThamNien(tb), mau: 'bg-blue-50 border-blue-200 text-blue-900' })}
        {The({ nhan: 'Đến hạn lên cấp', so: dem.den_han || 0, phu: 'Bấm để lọc', khoa: 'den_han', mau: 'bg-amber-50 border-amber-200 text-amber-900' })}
        {The({ nhan: 'Sắp đủ mốc (' + trong + ' tháng)', so: sapLen.length, phu: 'Xem danh sách bên dưới', mau: 'bg-cyan-50 border-cyan-200 text-cyan-900' })}
        {The({ nhan: 'Chưa có ngày vào làm', so: dem.chua_ngay || 0, phu: 'Bấm để lọc', khoa: 'chua_ngay', mau: 'bg-rose-50 border-rose-200 text-rose-900' })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <div className="xl:col-span-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900 bg-gradient-to-r from-slate-50 to-white">📊 Thống kê theo phòng</div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <th className="px-3 py-2 text-left">Phòng</th><th className="px-3 py-2 text-right">Người</th>
              {NHOM.map(n => <th key={n[0]} className="px-3 py-2 text-right">{n[0]}</th>)}
              <th className="px-3 py-2 text-right">TB</th><th className="px-3 py-2 text-right text-amber-700">Đến hạn</th>
            </tr></thead>
            <tbody>{thongKe.map(t => (
              <tr key={t.p} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{t.p}</td><td className="px-3 py-2 text-right">{t.n}</td>
                {t.nhom.map((v, i) => <td key={i} className={'px-3 py-2 text-right ' + (v ? 'text-gray-900' : 'text-gray-300')}>{v || '·'}</td>)}
                <td className="px-3 py-2 text-right text-blue-800 whitespace-nowrap">{t.tb == null ? '—' : chuThamNien(t.tb)}</td>
                <td className="px-3 py-2 text-right font-semibold text-amber-700">{t.denHan || ''}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="xl:col-span-2 rounded-2xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-cyan-100 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-white">
            <span className="font-semibold text-cyan-900">⏳ Sắp đủ mốc lên cấp</span>
            <select value={trong} onChange={e => setTrong(Number(e.target.value))} className="border border-cyan-200 rounded-lg px-2 py-1 text-sm">
              {[1, 2, 3, 6].map(n => <option key={n} value={n}>trong {n} tháng</option>)}
            </select>
          </div>
          {sapLen.length ? <ul className="divide-y divide-gray-100">{sapLen.map(x => (
            <li key={x.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <div><div className="font-medium text-gray-900">{x.ten}</div><div className="text-xs text-gray-500">{x.phong} · {chuThamNien(x.thangTN)} · đang {x.capTen || 'chưa gán cấp'}</div></div>
              <div className="text-right whitespace-nowrap"><div className="font-semibold text-cyan-800">→ {x.ke?.ten}</div><div className="text-xs text-gray-500">{dmy(x.ngayLenCap)}</div></div>
            </li>
          ))}</ul> : <div className="px-4 py-6 text-center text-sm text-gray-400">Không ai đủ mốc trong {trong} tháng tới.</div>}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-gradient-to-r from-rose-50/50 to-white">
          <span className="font-semibold text-gray-900 mr-2">👥 Thâm niên từng người</span>
          {Object.entries(TT).filter(([k]) => dem[k]).map(([k, [nhan, lop]]) => (
            <button key={k} onClick={() => setLoc(loc === k ? '' : k)} className={'text-xs rounded-full border px-2.5 py-0.5 font-medium ' + lop + (loc === k ? ' ring-2 ring-offset-1 ring-gray-700' : '')}>{nhan}: {dem[k]}</button>
          ))}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
            <th className="px-4 py-2.5">Nhân viên</th><th className="px-4 py-2.5">Phòng</th><th className="px-4 py-2.5">Ngày vào làm</th><th className="px-4 py-2.5">Thâm niên</th>
            <th className="px-4 py-2.5">Cấp hiện tại</th><th className="px-4 py-2.5">Theo thâm niên</th><th className="px-4 py-2.5">Đánh giá</th><th className="px-4 py-2.5">Mốc kế</th>
          </tr></thead>
          <tbody>{hien.map((x, i) => (
            <tr key={x.id} className={'border-t border-gray-100 ' + (i % 2 ? 'bg-gray-50/50' : '')}>
              <td className="px-4 py-2"><div className="font-medium text-gray-900">{x.ten}{x.laTruongPhong && <span className="ml-1.5 text-[10px] font-bold rounded px-1.5 py-0.5 bg-violet-100 text-violet-800">TP</span>}</div><div className="text-[11px] text-gray-400">{x.ma || 'chưa có mã'}</div></td>
              <td className="px-4 py-2">{x.phong || '—'}</td>
              <td className="px-4 py-2 whitespace-nowrap">{dmy(x.ngayVao)}</td>
              <td className="px-4 py-2 whitespace-nowrap font-medium text-blue-800">{chuThamNien(x.thangTN)}</td>
              <td className="px-4 py-2">{x.capTen || '—'}</td>
              <td className="px-4 py-2">{x.dung?.ten || '—'}</td>
              <td className="px-4 py-2"><span className={'text-xs rounded-full border px-2 py-0.5 font-medium whitespace-nowrap ' + (TT[x.tt]?.[1] || '')}>{TT[x.tt]?.[0]}</span></td>
              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{x.ke ? x.ke.ten + ' · ' + dmy(x.ngayLenCap) : ''}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">Mốc lên cấp lấy theo mô tả từng cấp ở Tiền lương → Cấp bậc & ngày lễ (vd "Trên 1 năm – dưới 2 năm"). Ngày vào làm nhập ở trang Quản lý nhân viên hoặc file hồ sơ lương.</p>
      </div>
    </div>
  )
}
