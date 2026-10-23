'use client'
// Báo cáo CHI TRẢ HOA HỒNG GIỚI THIỆU (tab ở trang Báo cáo KPI, anh yêu cầu 23/10/2026; sql/39).
// Theo nhân viên giới thiệu → bấm xem từng công ty: đã thu (chưa VAT), tồn đầu kỳ + phát sinh − đã chi = chuyển kỳ sau,
// và "chờ tính" (tiền khách đã trả chưa vào bảng lương đã chốt). Kỳ = tháng LƯƠNG. Chỉ người có quyền xem lương.
import { Fragment, useEffect, useState } from 'react'
import { soExcelMoi, themSheetMang, taiVeExcel } from '@/lib/excelDep'

const fmt = n => Number(n || 0).toLocaleString('vi-VN')
const pad = n => String(n).padStart(2, '0')
const homNay = () => { const d = new Date(Date.now() + 7 * 3600e3); return { nam: d.getUTCFullYear(), thang: d.getUTCMonth() + 1 } }

export default function BaoCaoHoaHong() {
  const h = homNay()
  const [loai, setLoai] = useState('thang')   // thang | quy | nam
  const [nam, setNam] = useState(h.nam)
  const [so, setSo] = useState(h.thang)       // tháng hoặc quý
  const [d, setD] = useState(null)
  const [loi, setLoi] = useState(null)
  const [mo, setMo] = useState(null)

  const ky = loai === 'thang' ? [nam + '-' + pad(so), nam + '-' + pad(so)]
    : loai === 'quy' ? [nam + '-' + pad(so * 3 - 2), nam + '-' + pad(so * 3)] : [nam + '-01', nam + '-12']
  useEffect(() => {
    setD(null); setLoi(null)
    fetch('/api/admin/luong?viec=bao_cao_hoa_hong&tu=' + ky[0] + '&den=' + ky[1], { cache: 'no-store' }).then(r => r.json())
      .then(j => j.error ? setLoi(j.error) : setD(j)).catch(e => setLoi(String(e.message || e)))
  }, [ky[0], ky[1]])   // eslint-disable-line react-hooks/exhaustive-deps

  const ds = d?.nhanVien || []
  const tong = k => ds.reduce((a, x) => a + (x[k] || 0), 0)
  const tenKy = loai === 'thang' ? 'tháng ' + so + '/' + nam : loai === 'quy' ? 'quý ' + so + '/' + nam : 'năm ' + nam

  const xuatExcel = async () => {
    const wb = await soExcelMoi()
    const dong = [['BÁO CÁO CHI TRẢ HOA HỒNG GIỚI THIỆU — ' + tenKy.toUpperCase()], [],
      ['Nhân viên', 'Phòng', 'Mã KH', 'Công ty', 'Đã thu (chưa VAT)', 'Tồn đầu kỳ', 'Phát sinh', 'Đã chi', 'Chuyển kỳ sau', 'Chờ tính']]
    for (const x of ds) {
      dong.push(['TỔNG ' + x.ten, x.phong, '', x.congTy.length + ' công ty', x.daThu, x.tonDau, x.phatSinh, x.daChi, x.chuyenKySau, x.choTinh])
      for (const c of x.congTy) dong.push(['', '', c.ma, c.ten, c.daThu, c.tonDau, c.phatSinh, c.daChi, c.chuyenKySau, c.choTinh])
    }
    dong.push(['TỔNG CỘNG', '', '', '', tong('daThu'), tong('tonDau'), tong('phatSinh'), tong('daChi'), tong('chuyenKySau'), tong('choTinh')])
    themSheetMang(wb, 'Hoa hong GT', dong, { doRong: [24, 12, 12, 40, 16, 14, 14, 14, 15, 13], cotTien: [4, 5, 6, 7, 8, 9] })
    await taiVeExcel(wb, 'Hoa_hong_gioi_thieu_' + ky[0] + (ky[1] !== ky[0] ? '_' + ky[1] : '') + '.xlsx')
  }

  const The = ({ nhan, so: v, mau, phu }) => (
    <div className={'rounded-2xl border p-4 ' + mau}>
      <div className="text-sm font-medium opacity-80">{nhan}</div>
      <div className="text-2xl font-bold mt-1">{fmt(v)}</div>
      {phu && <div className="text-xs opacity-70 mt-0.5">{phu}</div>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={loai} onChange={e => { setLoai(e.target.value); setSo(e.target.value === 'quy' ? Math.ceil(h.thang / 3) : h.thang) }} className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm">
          <option value="thang">Theo tháng</option><option value="quy">Theo quý</option><option value="nam">Theo năm</option>
        </select>
        {loai !== 'nam' && <select value={so} onChange={e => setSo(Number(e.target.value))} className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm">
          {Array.from({ length: loai === 'quy' ? 4 : 12 }, (_, i) => i + 1).map(i => <option key={i} value={i}>{loai === 'quy' ? 'Quý ' + i : 'Tháng ' + i}</option>)}
        </select>}
        <select value={nam} onChange={e => setNam(Number(e.target.value))} className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm">
          {[h.nam - 1, h.nam, h.nam + 1].map(y => <option key={y} value={y}>Năm {y}</option>)}
        </select>
        <span className="text-xs text-gray-500">Kỳ = tháng lương · tiền chưa VAT</span>
        <button onClick={xuatExcel} disabled={!d} className="ml-auto text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm disabled:opacity-40">⬇ Xuất Excel</button>
      </div>

      {loi && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm">{loi}</div>}
      {!d && !loi && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Đang tải…</div>}
      {d && <>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {The({ nhan: 'Đã thu (chưa VAT)', so: tong('daThu'), mau: 'bg-slate-50 border-slate-200 text-slate-900', phu: 'của công ty được giới thiệu' })}
          {The({ nhan: 'Tồn đầu kỳ', so: tong('tonDau'), mau: 'bg-amber-50 border-amber-200 text-amber-900', phu: 'hoa hồng chưa chi' })}
          {The({ nhan: 'Phát sinh', so: tong('phatSinh'), mau: 'bg-emerald-50 border-emerald-200 text-emerald-900', phu: 'bảng lương đã chốt' })}
          {The({ nhan: 'Đã chi', so: tong('daChi'), mau: 'bg-teal-50 border-teal-200 text-teal-900', phu: 'đã chuyển lương' })}
          {The({ nhan: 'Chuyển kỳ sau', so: tong('chuyenKySau'), mau: 'bg-gray-900 border-gray-900 text-white', phu: 'còn nợ nhân viên' })}
          {The({ nhan: 'Chờ tính', so: tong('choTinh'), mau: 'bg-cyan-50 border-cyan-200 text-cyan-900', phu: d.choTinhKy ? 'vào bảng lương ' + d.choTinhKy.split('-').reverse().join('/') : 'tháng cuối kỳ đã chốt' })}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left">Nhân viên giới thiệu</th><th className="px-4 py-2.5 text-right">Công ty</th>
              <th className="px-4 py-2.5 text-right">Đã thu</th><th className="px-4 py-2.5 text-right text-amber-700">Tồn đầu kỳ</th>
              <th className="px-4 py-2.5 text-right text-emerald-700">Phát sinh</th><th className="px-4 py-2.5 text-right text-teal-700">Đã chi</th>
              <th className="px-4 py-2.5 text-right">Chuyển kỳ sau</th><th className="px-4 py-2.5 text-right text-cyan-700">Chờ tính</th>
            </tr></thead>
            <tbody>
              {!ds.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Chưa có công ty nào được ghi người giới thiệu (ghi ở trang Quản lý khách hàng, cột "Giới thiệu").</td></tr>}
              {ds.map(x => (
                <Fragment key={x.staff_id}>
                  <tr onClick={() => setMo(mo === x.staff_id ? null : x.staff_id)} className="border-t border-gray-100 cursor-pointer hover:bg-emerald-50/40">
                    <td className="px-4 py-2.5"><span className="text-gray-400 mr-1">{mo === x.staff_id ? '▾' : '▸'}</span><b className="text-gray-900">{x.ten}</b>
                      <span className="text-xs text-gray-400 ml-1.5">{x.phong}{!x.dangLam ? ' · đã nghỉ' : ''}{x.tyLeHienTai ? ' · bậc ' + x.tyLeHienTai + '%' : ''}</span></td>
                    <td className="px-4 py-2.5 text-right">{x.congTy.length}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(x.daThu)}</td>
                    <td className="px-4 py-2.5 text-right text-amber-800">{fmt(x.tonDau)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-800">{fmt(x.phatSinh)}</td>
                    <td className="px-4 py-2.5 text-right text-teal-800">{fmt(x.daChi)}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmt(x.chuyenKySau)}</td>
                    <td className="px-4 py-2.5 text-right text-cyan-800">{fmt(x.choTinh)}</td>
                  </tr>
                  {mo === x.staff_id && x.congTy.map(c => (
                    <tr key={c.client_id} className="bg-gray-50/70 text-xs">
                      <td className="pl-10 pr-4 py-2">{c.ma && <span className="font-mono text-blue-700 mr-1.5">{c.ma}</span>}{c.ten}
                        <span className="text-gray-400 ml-1.5">{c.tuThang ? 'từ ' + String(c.tuThang).slice(5, 7) + '/' + String(c.tuThang).slice(0, 4) : ''}{!c.dangDung ? ' · đã ngưng' : ''}</span></td>
                      <td></td>
                      <td className="px-4 py-2 text-right">{fmt(c.daThu)}</td>
                      <td className="px-4 py-2 text-right">{fmt(c.tonDau)}</td>
                      <td className="px-4 py-2 text-right">{fmt(c.phatSinh)}</td>
                      <td className="px-4 py-2 text-right">{fmt(c.daChi)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(c.chuyenKySau)}</td>
                      <td className="px-4 py-2 text-right">{fmt(c.choTinh)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {ds.length > 0 && <tr className="border-t-2 border-gray-300 bg-gray-900 text-white font-bold">
                <td className="px-4 py-2.5">TỔNG CỘNG</td><td className="px-4 py-2.5 text-right">{ds.reduce((a, x) => a + x.congTy.length, 0)}</td>
                <td className="px-4 py-2.5 text-right">{fmt(tong('daThu'))}</td><td className="px-4 py-2.5 text-right">{fmt(tong('tonDau'))}</td>
                <td className="px-4 py-2.5 text-right">{fmt(tong('phatSinh'))}</td><td className="px-4 py-2.5 text-right">{fmt(tong('daChi'))}</td>
                <td className="px-4 py-2.5 text-right">{fmt(tong('chuyenKySau'))}</td><td className="px-4 py-2.5 text-right">{fmt(tong('choTinh'))}</td>
              </tr>}
            </tbody>
          </table></div>
          <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">Tồn đầu kỳ + Phát sinh − Đã chi = Chuyển kỳ sau (bằng tồn đầu kỳ của kỳ sau). Phát sinh ghi khi chốt bảng lương; Đã chi khi bấm "Đánh dấu đã chuyển lương". Chờ tính: khách đã trả nhưng chưa vào bảng lương đã chốt.</p>
        </div>
      </>}
    </div>
  )
}
