'use client'
// Màn "Nhiều năm" của Soát xét năm: chỉ tiêu BCTC chính, số chênh lệch / phát hiện theo nhóm và chỉ số tài chính qua các năm.
// Tính lại từng năm bằng cùng bộ máy (năm đang mở đổi tạm, xong trả lại năm đang xem). Chỉ số liệu, không chấm điểm.
import { useMemo } from 'react'
import { NHOM, gomKetQua, coChenh } from '@/components/phanTich/soatNamChung'

const CHI_TIEU = [['DThu', 'Doanh thu thuần'], ['GVHB', 'Giá vốn hàng bán'], ['LNG', 'Lợi nhuận gộp'], ['LNTT', 'Lợi nhuận trước thuế'], ['THUE', 'Chi phí thuế TNDN'], ['LNST', 'Lợi nhuận sau thuế'],
  ['TONG_TS', 'Tổng tài sản'], ['TIEN', 'Tiền và tương đương tiền'], ['PTKH', 'Phải thu khách hàng'], ['HTK', 'Hàng tồn kho'], ['TSCD', 'Tài sản cố định'], ['TONG_NO', 'Nợ phải trả'], ['VCSH', 'Vốn chủ sở hữu']]
const so = n => (n == null ? <span className="text-gray-300">—</span> : n < 0 ? `(${Math.round(-n).toLocaleString('vi-VN')})` : Math.round(n).toLocaleString('vi-VN'))
const so2 = (x, u) => (x == null ? '—' : u === '%' ? x.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('vi-VN') : x.toLocaleString('vi-VN', { maximumFractionDigits: 2 }))
const tang = (a, b) => (a == null || b == null || !b ? null : (a - b) / Math.abs(b))

export function tinhNhieuNam(bm, X, cacNam, namDangXem) {
  const ra = []
  for (const n of [...cacNam].sort((a, b) => a - b)) {
    const C = bm.tinhNamSoat(X, n)
    const S = X.getS()
    const v = Object.fromEntries(CHI_TIEU.map(([k]) => [k, S.v[k]?.t ?? null]))
    ra.push({ nam: n, v, gom: gomKetQua(C), Rt: C.Rt || [], coBctc: Object.keys(S.v).length > 10 })
  }
  if (namDangXem) bm.tinhNamSoat(X, namDangXem)   // trả bộ máy về năm đang xem
  return ra
}

export default function SoatNamNhieuNam({ bm, hoSo, nam, cty }) {
  const ds = useMemo(() => (bm && hoSo ? tinhNhieuNam(bm, hoSo.X, hoSo.cacNam, nam) : null), [bm, hoSo, nam])
  if (!ds) return null
  const cot = ds.map(x => x.nam)

  async function taiExcel() {
    const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
    const wb = await soExcelMoi()
    themSheetMang(wb, 'Nhiều năm', [
      [`SOÁT XÉT QUA CÁC NĂM — ${cty.ten}`], ['Chỉ tiêu BCTC, số phép kiểm có chênh lệch / phát hiện theo nhóm, chỉ số tài chính — chưa chấm điểm'],
      ['Chỉ tiêu', ...cot.map(n => `Năm ${n}`)],
      ...CHI_TIEU.map(([k, t]) => [t, ...ds.map(x => x.v[k] ?? '')]),
      [],
      ['A. Chênh lệch / phát hiện theo nhóm'],
      ['Nhóm', ...cot.map(n => `Năm ${n}`)],
      ...NHOM.map(g => [g.ten, ...ds.map(x => `${x.gom.phep.filter(p => p.nhom === g.ma && coChenh(p)).length} chênh / ${x.gom.phatHien.filter(r => r.nhom === g.ma).length} phát hiện`)]),
      [],
      ['B. Chỉ số tài chính'],
      ['Chỉ số', ...cot.map(n => `Năm ${n}`)],
      ...(ds.at(-1).Rt || []).map(r => [`${r.id} ${r.n} (${r.u})`, ...ds.map(x => { const t = x.Rt.find(y => y.id === r.id)?.t; return t == null ? '' : Math.round(t * 100) / 100 })]),
    ], { doRong: [46, ...cot.map(() => 22)] })
    await taiVeExcel(wb, `SoatXet_NhieuNam_${cty.maKH || cty.mst}.xlsx`)
  }

  return (
    <>
      <div className="flex items-center mb-2">
        <p className="text-xs text-gray-500">Năm theo nội dung BCTC / tờ khai / sổ đọc được. Năm chưa có BCTC thì các chỉ tiêu BCTC là “—”.</p>
        <button type="button" onClick={taiExcel} className="ml-auto px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212]">⬇ Excel nhiều năm</button>
      </div>
      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Chỉ tiêu BCTC</h2>
      <div className="pt-bang overflow-x-auto mb-5">
        <table className="text-sm">
          <thead><tr><th>Chỉ tiêu</th>{ds.map((x, i) => <th key={x.nam} className="text-right" colSpan={i ? 2 : 1}>Năm {x.nam}{i ? ' · so năm trước' : ''}</th>)}</tr></thead>
          <tbody>
            {CHI_TIEU.map(([k, t]) => (
              <tr key={k}>
                <td className="text-gray-800 whitespace-nowrap">{t}</td>
                {ds.map((x, i) => {
                  const g = i ? tang(x.v[k], ds[i - 1].v[k]) : null
                  return [<td key={x.nam} className="text-right tabular-nums whitespace-nowrap font-semibold">{so(x.v[k])}</td>,
                    i ? <td key={x.nam + 't'} className={`text-right tabular-nums text-xs whitespace-nowrap ${g != null && Math.abs(g) >= 0.2 ? 'bg-amber-50/70 text-gray-900' : 'text-gray-500'}`}>{g == null ? '—' : (g >= 0 ? '+' : '') + (g * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'}</td> : null]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Phép kiểm có chênh lệch / phát hiện theo nhóm</h2>
      <div className="pt-bang overflow-x-auto mb-5">
        <table className="text-sm">
          <thead><tr><th>Nhóm</th>{ds.map(x => <th key={x.nam} className="text-center">Năm {x.nam}</th>)}</tr></thead>
          <tbody>
            {NHOM.map(g => (
              <tr key={g.ma}>
                <td className="whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: g.mau }} />{g.ten}</td>
                {ds.map(x => {
                  const tong = x.gom.phep.filter(p => p.nhom === g.ma).length, c = x.gom.phep.filter(p => p.nhom === g.ma && coChenh(p)).length, ph = x.gom.phatHien.filter(r => r.nhom === g.ma).length
                  return <td key={x.nam} className={`text-center tabular-nums text-xs ${c ? 'bg-amber-50/70' : ''}`}>{tong || ph ? <><b className={c ? 'text-gray-900' : 'text-gray-400'}>{c}</b><span className="text-gray-400">/{tong} chênh</span> · <b className="text-gray-700">{ph}</b><span className="text-gray-400"> phát hiện</span></> : <span className="text-gray-300">chưa có số liệu</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Chỉ số tài chính (giá trị, chưa so ngưỡng)</h2>
      <div className="pt-bang overflow-auto max-h-[calc(100vh-260px)] mb-6">
        <table className="text-sm">
          <thead><tr><th>Chỉ số</th>{ds.map(x => <th key={x.nam} className="text-right">Năm {x.nam}</th>)}</tr></thead>
          <tbody>
            {(ds.at(-1).Rt || []).map(r => (
              <tr key={r.id}>
                <td className="text-gray-800"><b className="text-[#8B1A1A] text-xs mr-1.5">{r.id}</b>{r.n} <span className="text-[11px] text-gray-400">({r.u})</span></td>
                {ds.map(x => <td key={x.nam} className="text-right tabular-nums whitespace-nowrap">{so2(x.Rt.find(y => y.id === r.id)?.t ?? null, r.u)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
