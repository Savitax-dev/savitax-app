'use client'
// Phân hệ Pháp lý — báo cáo: doanh số theo tháng THU (phần dịch vụ), dòng tiền công nợ (tồn đầu + phát sinh − đã thu = chuyển
// kỳ sau, tách dịch vụ / thu hộ), hồ sơ mới / đóng, theo nhân viên; tab Theo hồ sơ + Hồ sơ treo (GĐ 6). Trưởng phòng xem cả phòng;
// nhân viên xem của mình.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { homNayVN } from '@/lib/phaply/hoSo'
import { PageHead, StatCard, inputCls, btnGhost, useToast, api, fmt, dmy, thangLabel, ThanhPhapLy } from '../_ui'

export default function BaoCaoPage() {
  const router = useRouter()
  const nay = homNayVN().slice(0, 7)
  const [tu, setTu] = useState(nay.slice(0, 4) + '-01')
  const [toi, setToi] = useState(nay)
  const [d, setD] = useState(null)
  const [tach, setTach] = useState(false)
  const [tab, setTab] = useState('tong')
  const [chiNo, setChiNo] = useState(false)
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
    themSheetMang(wb, 'Theo hồ sơ', [
      [`HỒ SƠ PHÁP LÝ ${thangLabel(d.tu)} – ${thangLabel(d.toi)}`],
      ['Hồ sơ nhận trước hết kỳ và chưa đóng / đóng trong kỳ. Số tiền gồm VAT. Số ngày = từ ngày nhận tới ngày đóng (đang làm: tới hôm nay).'],
      ['Mã', 'Khách / doanh nghiệp', 'Thủ tục', 'Loại hình', 'Phụ trách', 'Ngày nhận', 'Bước', 'Đang chờ', 'Ngày đóng', 'Số ngày', 'Trễ hạn', 'Phí', 'Đã thu', 'Còn nợ'],
      ...d.ho_so.map(h => [h.ma, h.ten, h.thu_tuc, h.loai_hinh, h.phu_trach, dmy(h.nhan), h.buoc_ten, h.cho, h.ngay_dong ? dmy(h.ngay_dong) : '', h.so_ngay, h.tre ? 'Trễ' : '', h.phi, h.da_thu, h.con_no]),
    ], { cotTien: [11, 12, 13] })
    themSheetMang(wb, 'Hồ sơ treo', [
      ['HỒ SƠ TREO (tại ngày xuất)'],
      ['Chưa đóng và đang chờ khách / Sở / Thuế / cần bổ sung, hoặc trễ hạn nội bộ, hoặc quá hạn nộp bổ sung.'],
      ['Mã', 'Khách / doanh nghiệp', 'Phụ trách', 'Bước', 'Đang chờ', 'Số ngày chờ', 'Hạn nội bộ', 'Trễ (ngày)', 'Hạn bổ sung', 'Quá hạn bổ sung', 'Nội dung bổ sung'],
      ...d.treo.map(h => [h.ma, h.ten, h.phu_trach, h.buoc_ten, h.cho, h.so_ngay_cho ?? '', h.han ? dmy(h.han) : '', h.so_ngay_tre ?? '', h.han_bo_sung ? dmy(h.han_bo_sung) : '', h.qua_han_bo_sung ? 'Quá hạn' : '', h.noi_dung_bo_sung]),
    ], {})
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
          <div className="flex gap-1.5 flex-wrap">
            {[['tong', 'Tổng quan'], ['ho_so', `Theo hồ sơ (${d.ho_so.length})`], ['treo', `Hồ sơ treo (${d.treo.length})`]].map(([k, lb]) =>
              <button key={k} className={'p-chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{lb}</button>)}
          </div>
          {tab === 'ho_so' && <BangHoSo ds={chiNo ? d.ho_so.filter(h => h.con_no > 0) : d.ho_so} chiNo={chiNo} setChiNo={setChiNo} />}
          {tab === 'treo' && <BangTreo ds={d.treo} />}
          {tab === 'tong' && <>

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
              <thead><tr><th className="l">Nhân viên</th>{d.thangs.map(m => <th key={m} className="r">DS {thangLabel(m)}</th>)}<th className="r">Tổng doanh số</th><th className="r">Nợ cuối kỳ</th><th>HS mới</th><th>HS xong</th><th>Đang làm</th></tr></thead>
              <tbody>
                {d.nhan_vien.map(n => (
                  <tr key={n.id}><td className="l">{n.ten}</td>{n.doanh_so.map((v, i) => <td key={i} className="r num">{fmt(v)}</td>)}
                    <td className="r num font-semibold">{fmt(n.doanh_so.reduce((a, b) => a + b, 0))}</td>
                    <td className="r num">{fmt(n.dong_tien[n.dong_tien.length - 1].tong.chuyen)}</td>
                    <td className="num">{n.ho_so.reduce((a, o) => a + o.moi, 0)}</td><td className="num">{n.ho_so.reduce((a, o) => a + o.xong, 0)}</td><td className="num">{n.ho_so[n.ho_so.length - 1].dang}</td></tr>
                ))}
                {d.nhan_vien.length > 1 && <tr className="font-semibold"><td className="l">Tổng</td>{d.thangs.map((m, i) => <td key={m} className="r num">{fmt(d.nhan_vien.reduce((a, n) => a + n.doanh_so[i], 0))}</td>)}
                  <td className="r num">{fmt(d.nhan_vien.reduce((a, n) => a + n.doanh_so.reduce((x, y) => x + y, 0), 0))}</td>
                  <td className="r num">{fmt(d.nhan_vien.reduce((a, n) => a + n.dong_tien[n.dong_tien.length - 1].tong.chuyen, 0))}</td></tr>}
              </tbody>
            </table>
          </div>
          </>}
        </div>
        {toastNode}
      </div>
    </AppShell>
  )
}

// ─── Theo hồ sơ ───────────────────────────────────────────────────────────────────────────────────────────
function BangHoSo({ ds, chiNo, setChiNo }) {
  const tong = k => ds.reduce((a, h) => a + (h[k] || 0), 0)
  return (
    <div className="p-panel overflow-x-auto">
      <div className="p-panel-h flex justify-between items-center gap-2"><span>Theo hồ sơ — nhận trước hết kỳ, chưa đóng hoặc đóng trong kỳ</span>
        <label className="text-xs font-normal flex items-center gap-1.5"><input type="checkbox" checked={chiNo} onChange={e => setChiNo(e.target.checked)} /> Chỉ hồ sơ còn nợ</label></div>
      <table className="p-tbl">
        <thead><tr><th className="l">Mã</th><th className="l">Khách</th><th className="l">Thủ tục</th><th className="l">Phụ trách</th><th className="l">Nhận</th><th className="l">Bước</th>
          <th>Số ngày</th><th className="r">Phí</th><th className="r">Đã thu</th><th className="r">Còn nợ</th></tr></thead>
        <tbody>
          {ds.map(h => (
            <tr key={h.id}>
              <td className="l num"><Link className="underline" href={'/phaply/ho-so/' + h.id}>{h.ma}</Link></td>
              <td className="l">{h.ten || '—'}</td><td className="l text-xs">{h.thu_tuc} · {h.loai_hinh}</td><td className="l">{h.phu_trach}</td>
              <td className="l num">{dmy(h.nhan)}</td>
              <td className="l whitespace-nowrap">{h.buoc_ten}{h.cho && <span className="text-xs text-amber-800"> · {h.cho}</span>}</td>
              <td className="num">{h.so_ngay ?? '—'}{h.tre && <span className="ml-1 text-xs px-1 rounded bg-red-100 text-red-800">trễ</span>}</td>
              <td className="r num">{fmt(h.phi)}</td><td className="r num">{fmt(h.da_thu)}</td>
              <td className={'r num ' + (h.con_no > 0 ? 'font-semibold text-red-700' : '')}>{fmt(h.con_no)}</td>
            </tr>
          ))}
          {ds.length > 1 && <tr className="font-semibold"><td className="l" colSpan={7}>Tổng {ds.length} hồ sơ</td>
            <td className="r num">{fmt(tong('phi'))}</td><td className="r num">{fmt(tong('da_thu'))}</td><td className="r num">{fmt(tong('con_no'))}</td></tr>}
          {!ds.length && <tr><td className="l text-gray-400" colSpan={10}>Không có hồ sơ.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ─── Hồ sơ treo ───────────────────────────────────────────────────────────────────────────────────────────
function BangTreo({ ds }) {
  return (
    <div className="p-panel overflow-x-auto">
      <div className="p-panel-h">Hồ sơ treo — đang chờ, trễ hạn nội bộ hoặc quá hạn nộp bổ sung (tính tới hôm nay)</div>
      <table className="p-tbl">
        <thead><tr><th className="l">Mã</th><th className="l">Khách</th><th className="l">Phụ trách</th><th className="l">Bước</th><th className="l">Đang chờ</th>
          <th>Số ngày chờ</th><th className="l">Hạn nội bộ</th><th className="l">Bổ sung</th></tr></thead>
        <tbody>
          {ds.map(h => (
            <tr key={h.id}>
              <td className="l num"><Link className="underline" href={'/phaply/ho-so/' + h.id}>{h.ma}</Link></td>
              <td className="l">{h.ten || '—'}</td><td className="l">{h.phu_trach}</td><td className="l">{h.buoc_ten}</td>
              <td className="l">{h.cho || '—'}</td><td className="num">{h.so_ngay_cho ?? '—'}</td>
              <td className="l whitespace-nowrap">{h.han ? dmy(h.han) : '—'}{h.tre_noi_bo && <span className="ml-1 text-xs px-1 rounded bg-red-100 text-red-800">trễ {h.so_ngay_tre} ngày</span>}</td>
              <td className="l text-xs max-w-xs">{h.han_bo_sung ? <><span className={h.qua_han_bo_sung ? 'text-red-700 font-semibold' : ''}>hạn {dmy(h.han_bo_sung)}{h.qua_han_bo_sung ? ' — QUÁ HẠN' : ''}</span>{h.noi_dung_bo_sung && <div className="text-gray-500">{h.noi_dung_bo_sung}</div>}</> : '—'}</td>
            </tr>
          ))}
          {!ds.length && <tr><td className="l text-gray-400" colSpan={8}>Không có hồ sơ treo. 👍</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
