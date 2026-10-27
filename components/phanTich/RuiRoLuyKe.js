'use client'
// Rủi ro thuế "lũy kế đến kỳ — tạm tính" ở màn Soát kỳ (kế hoạch mục 3c "Rủi ro thuế giữa năm").
//
// 39 tiêu chí cần BCTC + quyết toán năm nên giữa năm chỉ tính được phần dựa trên tờ khai GTGT và bảng cân đối tài khoản
// lũy kế. Tạm tính: chỉ lấy tờ khai 01/GTGT của năm tới HẾT kỳ đang soát; BCTC đầy đủ và quyết toán của chính năm đó bị bỏ
// (kỳ chưa phải kỳ cuối năm thì so nửa năm tờ khai với cả năm BCTC là lệch giả). Chỉ hiện số + tỷ lệ, không đánh giá.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DEM } from '@/components/phanTich/useHoSoCty'
import { catDenKy } from '@/lib/ruiro/luyKe'

const so = n => (n == null ? '—' : typeof n === 'number' ? (n < 0 ? `(${Math.round(-n).toLocaleString('vi-VN')})` : Math.round(n).toLocaleString('vi-VN')) : String(n))

export default function RuiRoLuyKe({ quet, nam, ky, mst, ctyId }) {
  const [kq, setKq] = useState(null)
  const [loi, setLoi] = useState('')
  const thangCuoi = ky ? (ky.loai === 'Q' ? 3 * ky.so : ky.so) : null

  useEffect(() => {
    setKq(null); setLoi('')
    if (!quet?.nam?.[nam] || !thangCuoi) return
    let huy = false
    ;(async () => {
      try {
        const [{ default: Risk }, { docHoSoRuiRo }, { laDoiChieu, tyLe }] = await Promise.all([import('@/lib/ruiro/risk'), import('@/lib/ruiro/docThuMuc'), import('@/components/phanTich/ruiRoChung')])
        const hs = await docHoSoRuiRo({ nam, quetTheoNam: quet.nam, mst, dem: DEM })
        if (huy) return
        if (!hs.client.mst) hs.client.mst = hs.client.decls[0]?.mst || ''
        const ev = Risk.evaluateYear(catDenKy(hs.client, nam, thangCuoi), nam)
        const coSo = ev.results.filter(r => r.level !== 'missing' && r.level !== 'na')
        setKq({ coSo: coSo.map(r => ({ id: r.id, ten: r.name, dc: laDoiChieu(r), sl1: r.sl1, sl2: r.sl2, cl: r.cl, tl: tyLe(r) })), cho: ev.results.length - coSo.length, tong: ev.results.length })
      } catch (e) {
        if (!huy) setLoi(e.message)
      }
    })()
    return () => { huy = true }
  }, [quet, nam, thangCuoi, mst])

  if (!ky) return null
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="pt-khung-tieu-de px-4 py-2.5 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-gray-800">⚖️ Rủi ro thuế lũy kế đến {ky.ma}/{nam} — tạm tính</p>
        <span className="text-[11px] text-gray-500">Chỉ tờ khai GTGT tới hết kỳ + bảng cân đối tài khoản lũy kế (nếu có). Chưa đánh giá, chỉ số liệu.</span>
        {ctyId && <Link href={`/ruirothue/phan-tich?cty=${ctyId}&xem=bang`} className="ml-auto text-xs text-[#8B1A1A] font-semibold hover:underline">Mở Rủi ro thuế cả năm →</Link>}
      </div>
      <div className="p-3">
        {loi && <p className="text-sm text-red-700">Không tính được: {loi}</p>}
        {!kq && !loi && <p className="text-sm text-gray-500">Đang tính…</p>}
        {kq && (
          <>
            <p className="text-xs text-gray-600 mb-2">
              Tính được <b>{kq.coSo.length}</b>/{kq.tong} tiêu chí · <b>{kq.cho}</b> tiêu chí chờ BCTC / quyết toán năm / bảng cân đối tài khoản.
            </p>
            {kq.coSo.length > 0 && (
              <div className="pt-bang overflow-x-auto">
                <table className="text-xs">
                  <thead><tr><th>Mã</th><th>Tiêu chí</th><th className="text-right">SL1</th><th className="text-right">SL2</th><th className="text-right">Chênh lệch</th><th className="text-right">Tỷ lệ</th></tr></thead>
                  <tbody>
                    {kq.coSo.map(r => (
                      <tr key={r.id}>
                        <td className="font-bold text-[#8B1A1A] whitespace-nowrap">{r.id}</td>
                        <td className="max-w-[460px] text-gray-800">{r.ten}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{so(r.sl1)}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{r.dc ? so(r.sl2) : ''}</td>
                        <td className={`text-right tabular-nums whitespace-nowrap ${r.dc && r.cl && Math.abs(r.cl) > 0.5 ? 'font-semibold bg-amber-50/70' : 'text-gray-400'}`}>{r.dc ? so(r.cl) : ''}</td>
                        <td className="text-right tabular-nums whitespace-nowrap text-gray-600">{r.dc && r.tl != null ? (r.tl * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
