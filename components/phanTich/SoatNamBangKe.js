'use client'
// Màn "Bảng kê hóa đơn" của Soát xét năm (mockup soat-4): bảng kê cổng HĐĐT ↔ bảng kê phần mềm kế toán ↔ tờ khai 01/GTGT
// theo từng kỳ hoặc cả năm, mua vào / bán ra. Dùng đúng bước ghép hóa đơn của Soát kỳ (lib/phanTich/soatKy.js bangKeKy).
// Dữ liệu: tờ khai + bảng kê do useHoSoCty đọc (năm thư mục = năm đang soát), bảng kê đọc đầy đủ từng hóa đơn ở đây.
import { useEffect, useMemo, useState } from 'react'
import { ChipMau, OTongSinhDong } from '@/components/phanTich/phanTichUI'
import { docExcelBuf } from '@/components/phanTich/useHoSoCty'
import { docBangKeDayDu } from '@/lib/phanTich/docHoSo'
import { bangKeKy, gopBangKeKy, kyKhaiNam } from '@/lib/phanTich/soatKy'

const so = n => (n == null || n === '' ? <span className="text-gray-300">—</span> : typeof n === 'number' ? (n < 0 ? `(${Math.round(-n).toLocaleString('vi-VN')})` : Math.round(n).toLocaleString('vi-VN')) : String(n))
const ngayVN = s => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : '—')
const tong = (ds, f) => ds.reduce((s, x) => s + (Number((x.hd || x)[f]) || 0), 0)
const NHOM_HD = [
  ['chiCong', 'Có trên cổng, chưa có trong bảng kê kèm tờ khai', 'do'], ['chiPm', 'Có trong bảng kê kèm tờ khai, không có trên cổng', 'tim'],
  ['lech', 'Lệch tiền / thuế', 'hoPhach'], ['hetHieuLuc', 'Hóa đơn bị thay thế / hủy mà bảng kê kèm tờ khai vẫn kê', 'do'], ['ngoaiKy', 'Ngày ngoài kỳ (kê khai muộn — để biết)', 'xanhDuong'],
]

export default function SoatNamBangKe({ hs, nam, cty }) {
  const { doc, mstCty, buoc } = hs
  const [du, setDu] = useState(null)
  const [dangDoc, setDangDoc] = useState(false)
  const [chieu, setChieu] = useState('mua_vao')
  const [chon, setChon] = useState('nam')

  // Đọc ĐẦY ĐỦ từng hóa đơn của mọi bảng kê trong năm (giữ trong bộ nhớ tab)
  useEffect(() => {
    setDu(null)
    if (!doc || hs.nam !== nam) return
    let huy = false
    setDangDoc(true)
    docBangKeDayDu(doc.bangKe, { docExcelBuf, mstCty: mstCty || doc.toKhai[0]?.mst || '' })
      .then(r => { if (!huy) setDu(r) })
      .finally(() => { if (!huy) setDangDoc(false) })
    return () => { huy = true }
  }, [doc, hs.nam, nam, mstCty])

  const toKhai = useMemo(() => doc?.toKhai || [], [doc])
  const loaiKy = kyKhaiNam(toKhai, nam).loai || (cty?.kyKhai === 'thang' ? 'T' : 'Q')
  const cacKy = useMemo(() => (loaiKy === 'T' ? Array.from({ length: 12 }, (_, i) => ({ loai: 'T', so: i + 1 })) : [1, 2, 3, 4].map(q => ({ loai: 'Q', so: q }))), [loaiKy])
  const theoKy = useMemo(() => {
    if (!du) return null
    const ra = {}
    for (const c of ['mua_vao', 'ban_ra']) ra[c] = cacKy.map(k => bangKeKy({ nam, k, loaiKy, chieu: c, toKhai, bangKe: du.bangKe }))
    return ra
  }, [du, cacKy, nam, loaiKy, toKhai])

  if (!hs.quet?.nam?.[nam]) return <p className="text-sm text-gray-500 py-6">Không có thư mục năm {nam} — bảng kê hóa đơn đọc từ thư mục năm (bấm “＋ Năm cũ” nếu là năm ≤ 2025).</p>
  if (buoc || dangDoc || !theoKy) return <p className="text-sm text-gray-500 py-3 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />{buoc || 'Đang đọc bảng kê hóa đơn của năm…'}</p>

  const dsKy = theoKy[chieu]
  // Kỳ đang chọn không có trong năm này (đổi quý ↔ tháng) → xem cả năm, không để trang sập
  const r = (chon !== 'nam' && dsKy.find(x => x.ky.ma === chon)) || gopBangKeKy(dsKy)
  const laCaNam = !r.ky.loai
  const tenKy = laCaNam ? `cả năm ${nam}` : `${r.ky.loai === 'Q' ? 'quý' : 'tháng'} ${r.ky.so}/${nam}`
  const tenChieu = chieu === 'ban_ra' ? 'bán ra' : 'mua vào'
  const thueLe = r.chiCong.length || r.chiPm.length

  async function taiExcel() {
    const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
    const wb = await soExcelMoi()
    for (const c of ['mua_vao', 'ban_ra']) {
      const ten = c === 'ban_ra' ? 'Bán ra' : 'Mua vào'
      themSheetMang(wb, `Tổng ${ten}`, [
        [`BẢNG KÊ HÓA ĐƠN ${ten.toUpperCase()} NĂM ${nam} — ${cty.ten}`], ['Bảng kê cổng HĐĐT (2. HÓA ĐƠN) ↔ bảng kê kèm tờ khai (7. BỘ BÁO CÁO) ↔ tờ khai 01/GTGT, theo kỳ'],
        ['Kỳ', 'HĐ trên cổng', 'Tiền cổng', 'Thuế cổng', 'HĐ kèm tờ khai', 'Tiền kèm TK', 'Thuế kèm TK', 'Tiền tờ khai', 'Thuế tờ khai', 'Khớp', 'Chưa có trong BK kèm TK', 'Không có trên cổng', 'Lệch tiền', 'Bị thay thế mà vẫn kê'],
        ...theoKy[c].map(x => [x.ky.ma, x.cong.so, x.cong.tien ?? '', x.cong.thue ?? '', x.pm.so, x.pm.tien ?? '', x.pm.thue ?? '', x.tk.tien ?? '', x.tk.thue ?? '', x.khop ?? '', x.chiCong.length, x.chiPm.length, x.lech.length, x.hetHieuLuc.length]),
      ], { doRong: [8, 12, 18, 16, 12, 18, 16, 18, 16, 8, 12, 14, 10, 14], cotTien: [2, 3, 5, 6, 7, 8] })
      const g = gopBangKeKy(theoKy[c])
      themSheetMang(wb, `Chênh lệch ${ten}`, [
        [`HÓA ĐƠN ${ten.toUpperCase()} CHÊNH LỆCH NĂM ${nam} — ${cty.ten}`], [''],
        ['Loại', 'Ngày', 'Ký hiệu', 'Số', 'MST', 'Tên', 'Tiền chưa thuế', 'Thuế', 'Ghi chú'],
        ...NHOM_HD.flatMap(([l, nhan]) => g[l].map(x => { const h = x.hd || x; return [nhan, ngayVN(h.ngay), h.kyHieu || '', h.so, h.mst || '', h.ten || x.cong?.ten || '', h.tienChuaThue ?? '', h.thue ?? '', x.lyDo || (x.cong ? `Cổng: ${x.cong.tienChuaThue ?? ''} / ${x.cong.thue ?? ''}${x.cong.trangThai ? ' · ' + x.cong.trangThai : ''}` : '')] })),
      ], { doRong: [36, 12, 12, 10, 14, 40, 16, 14, 50], cotTien: [6, 7] })
    }
    await taiVeExcel(wb, `BangKeHoaDon_${cty.maKH || cty.mst}_${nam}.xlsx`)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {[['mua_vao', 'Mua vào'], ['ban_ra', 'Bán ra']].map(([c, t]) => <button key={c} type="button" onClick={() => setChieu(c)} className={`px-3 py-1 rounded-full text-sm border ${chieu === c ? 'bg-[#8B1A1A] text-white border-[#8B1A1A] font-semibold' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>)}
        <span className="w-3" />
        {[{ ma: 'nam', t: 'Cả năm' }, ...dsKy.map(x => ({ ma: x.ky.ma, t: x.ky.loai === 'Q' ? 'Quý ' + x.ky.so : 'T' + x.ky.so }))].map(k => <button key={k.ma} type="button" onClick={() => setChon(k.ma)} className={`px-2.5 py-1 rounded-full text-xs border ${chon === k.ma ? 'bg-[#8B1A1A] text-white border-[#8B1A1A] font-semibold' : 'bg-white text-gray-600 border-gray-200'}`}>{k.t}</button>)}
        <button type="button" onClick={taiExcel} className="ml-auto px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212]">⬇ Excel bảng kê</button>
      </div>

      {/* Đủ bảng kê từng kỳ chưa: cổng · kèm tờ khai · tờ khai */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-2.5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[11px] text-gray-500">Đủ hồ sơ {tenChieu}:<br />cổng · PM · tờ khai</span>
        {dsKy.map(x => (
          <span key={x.ky.ma} className="inline-flex items-center gap-1 text-xs">
            <b className="text-gray-700 w-7">{x.ky.ma.replace(/^T0/, 'T')}</b>
            {[x.coCong, x.coPm, x.coTk].map((c, i) => <span key={i} title={['Bảng kê cổng HĐĐT (2. HÓA ĐƠN)', 'Bảng kê kèm tờ khai (7. BỘ BÁO CÁO)', 'Tờ khai 01/GTGT'][i] + (c ? ': có' : ': chưa có')} className={`w-5 h-5 inline-flex items-center justify-center rounded border text-[10px] ${c ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>{c ? '✓' : '—'}</span>)}
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-3">
        {[['Bảng kê cổng hóa đơn điện tử', r.nguon.cong, r.cong.so ? `${r.cong.so} hóa đơn` : ''], ['Bảng kê kèm tờ khai (7. BỘ BÁO CÁO)', r.nguon.pm, r.pm.so ? `${r.pm.so} hóa đơn` : ''], ['Tờ khai 01/GTGT', r.nguon.tk, r.tk.banChuaNop ? 'bản chưa nộp' : '']].map(([t, tep, phu]) => (
          <div key={t} className={`rounded-2xl border px-4 py-2.5 ${tep.length ? 'bg-emerald-50/40 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-sm font-bold text-gray-800">{tep.length ? '✅' : '⬜'} {t}</p>
            {tep.slice(0, 3).map((x, i) => <p key={i} className="text-[11px] text-gray-500 font-mono truncate" title={[...(x?.duongDan || []), x?.ten].join('\\')}>{x?.ten}</p>)}
            {tep.length > 3 && <p className="text-[11px] text-gray-400">… và {tep.length - 3} file nữa</p>}
            <p className="text-[11px] text-gray-500">{tep.length ? phu : 'Chưa có trong thư mục'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <OTongSinhDong so={r.cong.so} nhan="Hóa đơn trên cổng" mau="xanhDuong" />
        <OTongSinhDong so={r.pm.so} nhan="Hóa đơn trên bảng kê kèm tờ khai" mau="xanhDuong" />
        <OTongSinhDong so={r.khop ?? '—'} nhan="Khớp" mau="xanhLa" />
        <OTongSinhDong so={r.chiCong.length} nhan="Có trên cổng, chưa có trong bảng kê kèm tờ khai" mau="do" phu={r.chiCong.length ? 'thuế ' + Math.round(tong(r.chiCong, 'thue')).toLocaleString('vi-VN') : ''} />
        <OTongSinhDong so={r.chiPm.length} nhan="Có trong bảng kê kèm tờ khai, không có trên cổng" mau="tim" phu={r.chiPm.length ? 'thuế ' + Math.round(tong(r.chiPm, 'thue')).toLocaleString('vi-VN') : ''} />
        <OTongSinhDong so={r.lech.length + r.hetHieuLuc.length} nhan="Lệch tiền + trạng thái bất thường" mau="hoPhach" phu={`${r.lech.length} lệch · ${r.hetHieuLuc.length} bị thay thế`} />
      </div>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Tổng theo nguồn · {tenKy} · {tenChieu}</h2>
      {laCaNam && r.kyBo?.length > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-1.5">
          Chỉ cộng các kỳ có đủ bảng kê cổng và bảng kê kèm tờ khai: <b>{r.kyDu.join(', ')}</b>. Không cộng {r.kyBo.map(b => `${b.ma} (thiếu ${b.thieu})`).join(', ')} — cộng vào thì tổng hai bên lệch giả.
        </p>
      )}
      <div className="pt-bang overflow-x-auto mb-1">
        <table className="text-sm">
          <thead><tr><th>Nguồn</th><th className="text-right">Số hóa đơn</th><th className="text-right">Tiền chưa thuế</th><th className="text-right">Thuế GTGT</th><th className="text-right">Thuế: chênh với bảng kê kèm tờ khai</th></tr></thead>
          <tbody>
            {[['Bảng kê cổng HĐĐT', r.cong.so, r.cong.tien, r.cong.thue], ['Bảng kê kèm tờ khai', r.pm.so, r.pm.tien, r.pm.thue], [`Tờ khai 01/GTGT ${chieu === 'ban_ra' ? '[34] [35]' : '[23] [24]'}`, null, r.tk.tien, r.tk.thue]].map(([t, n, a, b], i) => {
              const d = i !== 1 && b != null && r.pm.thue != null ? b - r.pm.thue : null
              return <tr key={t}><td className="text-gray-800">{t}</td><td className="text-right tabular-nums">{n == null ? '' : n}</td><td className="text-right tabular-nums">{so(a)}</td><td className="text-right tabular-nums font-semibold">{so(b)}</td><td className={`text-right tabular-nums ${d && Math.abs(d) >= 1 ? 'font-semibold bg-amber-50/70' : 'text-gray-300'}`}>{i === 1 ? '' : d == null ? '—' : so(d)}</td></tr>
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mb-5">Ghép theo MST người bán + ký hiệu + số hóa đơn (không có ký hiệu thì MST + số + ngày). Hóa đơn bị thay thế / hủy trên cổng không tính vào tổng cổng.{thueLe ? '' : ''}</p>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Hóa đơn chênh lệch</h2>
      {!r.coCong || !r.coPm ? <p className="text-sm text-gray-500 mb-6">Cần cả bảng kê cổng HĐĐT (2. HÓA ĐƠN) và bảng kê kèm tờ khai (7. BỘ BÁO CÁO) của {tenKy} để đối chiếu từng hóa đơn.</p> : null}
      {NHOM_HD.map(([l, nhan, mau]) => r[l].length > 0 && (
        <div key={l} className="mb-4">
          <div className="flex items-center gap-2 mb-1"><ChipMau nhan={nhan} mau={mau} /><span className="text-xs text-gray-500">{r[l].length} hóa đơn · thuế {Math.round(tong(r[l], 'thue')).toLocaleString('vi-VN')}</span></div>
          <div className="pt-bang overflow-auto max-h-[420px]">
            <table className="text-xs">
              <thead><tr><th>Ngày</th><th>Ký hiệu · số</th><th>Đối tác</th><th className="text-right">Tiền chưa thuế</th><th className="text-right">Thuế</th><th>Trên cổng</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {r[l].slice(0, 300).map((x, i) => {
                  const h = x.hd || x
                  return (
                    <tr key={i}>
                      <td className="tabular-nums whitespace-nowrap">{ngayVN(h.ngay)}</td>
                      <td className="font-mono whitespace-nowrap">{h.kyHieu || x.cong?.kyHieu || '—'} · {h.so}</td>
                      <td className="max-w-[300px]"><p className="truncate" title={h.ten || x.cong?.ten}>{h.ten || x.cong?.ten || '—'}</p><p className="text-gray-400 tabular-nums">{h.mst ? 'MST ' + h.mst : 'không MST'}</p></td>
                      <td className="text-right tabular-nums">{so(h.tienChuaThue)}</td>
                      <td className="text-right tabular-nums font-semibold">{so(h.thue)}</td>
                      <td className="text-gray-500 whitespace-nowrap">{x.cong ? `${so(x.cong.tienChuaThue)} / ${so(x.cong.thue)}${x.cong.trangThai ? ' · ' + x.cong.trangThai : ''}` : h.trangThai || '—'}</td>
                      <td className="text-gray-600 max-w-[320px]">{x.lyDo || (l === 'lech' ? `Lệch tiền ${so(x.lechTien)} · thuế ${so(x.lechThue)} (kèm tờ khai − cổng)` : '')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {r[l].length > 300 && <p className="text-xs text-gray-500 px-3 py-2">… và {r[l].length - 300} hóa đơn nữa — bấm “Excel bảng kê” để xem đủ.</p>}
          </div>
        </div>
      ))}
      {r.coCong && r.coPm && !NHOM_HD.some(([l]) => r[l].length) && <p className="text-sm text-emerald-700 mb-6">✓ Bảng kê cổng và bảng kê kèm tờ khai {tenKy} khớp từng hóa đơn.</p>}
    </>
  )
}
