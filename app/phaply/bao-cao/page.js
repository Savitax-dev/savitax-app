'use client'
// Phân hệ Pháp lý — báo cáo: doanh số theo tháng THU (phần dịch vụ), dòng tiền công nợ (tồn đầu + phát sinh − đã thu = chuyển
// kỳ sau, tách dịch vụ / thu hộ), hồ sơ mới / đóng, theo nhân viên. Trưởng phòng xem cả phòng; nhân viên xem của mình.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { homNayVN } from '@/lib/phaply/hoSo'
import { PageHead, StatCard, inputCls, btnGhost, useToast, api, fmt, thangLabel, ThanhPhapLy } from '../_ui'

export default function BaoCaoPage() {
  const router = useRouter()
  const nay = homNayVN().slice(0, 7)
  const [tu, setTu] = useState(nay.slice(0, 4) + '-01')
  const [toi, setToi] = useState(nay)
  const [d, setD] = useState(null)
  const [tach, setTach] = useState(false)
  const [toastNode, toast] = useToast()
  const load = useCallback(async () => {
    const r = await api(`/api/admin/phaply/bao-cao?tu=${tu}&toi=${toi}`)
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { setD({ loi: r.data.error }); return }
    if (!r.ok) return toast(r.data.error || 'Không tải được báo cáo', true)
    setD(r.data)
  }, [tu, toi, router]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (async () => { const { data } = await createClient().auth.getSession(); if (!data.session) return router.push('/login'); load() })() }, [load, router])

  const xuatExcel = async () => {
    const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
    const wb = await soExcelMoi()
    const dt = d.phong.dong_tien
    themSheetMang(wb, 'Dòng tiền', [
      [`DÒNG TIỀN CÔNG NỢ PHÁP LÝ ${thangLabel(d.tu)} – ${thangLabel(d.toi)}`],
      ['Tồn đầu kỳ + phát sinh − đã thu = chuyển kỳ sau. Số tiền gồm VAT.'],
      ['Tháng', 'Tồn đầu kỳ', 'Phát sinh', 'Đã thu', 'Chuyển kỳ sau', 'Trong đó DV chuyển', 'Trong đó thu hộ chuyển', 'Doanh số (gồm VAT)', 'Doanh số (trước VAT)', 'Hồ sơ mới', 'Hồ sơ đóng'],
      ...dt.map((o, i) => [thangLabel(o.thang), o.tong.ton_dau, o.tong.phat_sinh, o.tong.da_thu, o.tong.chuyen, o.dich_vu.chuyen, o.thu_ho.chuyen,
        d.phong.doanh_so[i].gom_vat, d.phong.doanh_so[i].truoc_vat, d.phong.ho_so_moi[i], d.phong.ho_so_dong[i]]),
    ], { cotTien: [1, 2, 3, 4, 5, 6, 7, 8] })
    themSheetMang(wb, 'Nhân viên', [
      ['DOANH SỐ & CÔNG NỢ THEO NHÂN VIÊN'],
      ['Doanh số = phần dịch vụ đã thu, tính cho người phụ trách lúc thu. Công nợ = của hồ sơ người đó đang phụ trách.'],
      ['Nhân viên', ...d.thangs.map(m => 'DS ' + thangLabel(m)), 'Tổng doanh số', 'Nợ cuối kỳ'],
      ...d.nhan_vien.map(n => [n.ten, ...n.doanh_so, n.doanh_so.reduce((a, b) => a + b, 0), n.dong_tien[n.dong_tien.length - 1].tong.chuyen]),
    ], { cotTien: Array.from({ length: d.thangs.length + 2 }, (_, i) => i + 1) })
    await taiVeExcel(wb, `BaoCao-PhapLy_${d.tu}_${d.toi}.xlsx`)
  }

  if (!d) return <AppShell><div className="pl-ui p-8 text-sm text-gray-400">Đang tải…</div></AppShell>
  if (d.loi) return <AppShell><div className="pl-ui p-8 text-sm">{d.loi}</div></AppShell>
  if (d.chua_cai) return <AppShell><div className="pl-ui p-8 text-sm">Chưa chạy sql/56_phap_ly_ho_so.sql trên cơ sở dữ liệu này.</div></AppShell>
  const dt = d.phong.dong_tien, dau = dt[0], cuoi = dt[dt.length - 1]
  const tongKy = k => dt.reduce((a, o) => a + o.tong[k], 0)
  const dsKy = d.phong.doanh_so.reduce((a, o) => a + o.gom_vat, 0)
  const dsKyTruoc = d.phong.doanh_so.reduce((a, o) => a + o.truoc_vat, 0)

  return (
    <AppShell>
      <div className="pl-ui">
        <div className="px-4 md:px-8 py-5 space-y-4">
          <PageHead title="Báo cáo pháp lý" sub={d.ca_phong ? 'Toàn phòng Pháp lý' : 'Hồ sơ bạn phụ trách'}>
            <span className="text-sm">Từ</span><input type="month" className={inputCls + ' !w-auto'} value={tu} onChange={e => setTu(e.target.value)} />
            <span className="text-sm">đến</span><input type="month" className={inputCls + ' !w-auto'} value={toi} onChange={e => setToi(e.target.value)} />
            <button className={btnGhost} onClick={xuatExcel}>⬇ Excel</button>
          </PageHead>
          <ThanhPhapLy dang="/phaply/bao-cao" />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <StatCard label="Tồn đầu kỳ" value={fmt(dau.tong.ton_dau)} unit="đ" tone="sky" foot={'đầu ' + thangLabel(d.tu)} />
            <StatCard label="Phát sinh (đến hạn)" value={fmt(tongKy('phat_sinh'))} unit="đ" tone="blue" />
            <StatCard label="Đã thu" value={fmt(tongKy('da_thu'))} unit="đ" tone="grn" />
            <StatCard label="Chuyển kỳ sau" value={fmt(cuoi.tong.chuyen)} unit="đ" tone="red" foot={`DV ${fmt(cuoi.dich_vu.chuyen)} · TH ${fmt(cuoi.thu_ho.chuyen)}`} />
            <StatCard label="Doanh số (đã thu)" value={fmt(dsKy)} unit="đ" tone="gold" foot={'trước VAT ' + fmt(dsKyTruoc)} />
          </div>

          <div className="p-panel overflow-x-auto">
            <div className="p-panel-h flex justify-between items-center">Theo tháng
              <label className="text-xs font-normal flex items-center gap-1.5"><input type="checkbox" checked={tach} onChange={e => setTach(e.target.checked)} /> Tách dịch vụ / thu hộ</label></div>
            <table className="p-tbl">
              <thead><tr><th className="l">Tháng</th><th className="r">Tồn đầu kỳ</th><th className="r">Phát sinh</th><th className="r">Đã thu</th><th className="r">Chuyển kỳ sau</th>
                <th className="r">Doanh số</th><th className="r">Trước VAT</th><th>Hồ sơ mới</th><th>Đóng</th></tr></thead>
              <tbody>
                {dt.map((o, i) => [
                  <tr key={o.thang}>
                    <td className="l num font-semibold">{thangLabel(o.thang)}</td>
                    <td className="r num">{fmt(o.tong.ton_dau)}</td><td className="r num">{fmt(o.tong.phat_sinh)}</td>
                    <td className="r num">{fmt(o.tong.da_thu)}</td><td className="r num font-semibold">{fmt(o.tong.chuyen)}</td>
                    <td className="r num">{fmt(d.phong.doanh_so[i].gom_vat)}</td><td className="r num">{fmt(d.phong.doanh_so[i].truoc_vat)}</td>
                    <td className="num">{d.phong.ho_so_moi[i]}</td><td className="num">{d.phong.ho_so_dong[i]}</td>
                  </tr>,
                  ...(tach ? [['dich_vu', '↳ phí dịch vụ'], ['thu_ho', '↳ thu hộ']].map(([k, lb]) => (
                    <tr key={o.thang + k} className="text-xs text-gray-600">
                      <td className="l">{lb}</td><td className="r num">{fmt(o[k].ton_dau)}</td><td className="r num">{fmt(o[k].phat_sinh)}</td>
                      <td className="r num">{fmt(o[k].da_thu)}</td><td className="r num">{fmt(o[k].chuyen)}</td><td colSpan={4} />
                    </tr>)) : []),
                ])}
              </tbody>
            </table>
          </div>

          <div className="p-panel overflow-x-auto">
            <div className="p-panel-h">Theo nhân viên</div>
            <table className="p-tbl">
              <thead><tr><th className="l">Nhân viên</th>{d.thangs.map(m => <th key={m} className="r">DS {thangLabel(m)}</th>)}<th className="r">Tổng doanh số</th><th className="r">Nợ cuối kỳ</th></tr></thead>
              <tbody>
                {d.nhan_vien.map(n => (
                  <tr key={n.id}><td className="l">{n.ten}</td>{n.doanh_so.map((v, i) => <td key={i} className="r num">{fmt(v)}</td>)}
                    <td className="r num font-semibold">{fmt(n.doanh_so.reduce((a, b) => a + b, 0))}</td>
                    <td className="r num">{fmt(n.dong_tien[n.dong_tien.length - 1].tong.chuyen)}</td></tr>
                ))}
                {d.nhan_vien.length > 1 && <tr className="font-semibold"><td className="l">Tổng</td>{d.thangs.map((m, i) => <td key={m} className="r num">{fmt(d.nhan_vien.reduce((a, n) => a + n.doanh_so[i], 0))}</td>)}
                  <td className="r num">{fmt(d.nhan_vien.reduce((a, n) => a + n.doanh_so.reduce((x, y) => x + y, 0), 0))}</td>
                  <td className="r num">{fmt(d.nhan_vien.reduce((a, n) => a + n.dong_tien[n.dong_tien.length - 1].tong.chuyen, 0))}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {toastNode}
      </div>
    </AppShell>
  )
}
