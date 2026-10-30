'use client'
// Soát xét báo cáo — màn "Soát kỳ" (mockup docs/mockup-phan-tich/soat-8-soat-ky.html, soat-9-soat-ky-quy.html).
// GĐ 3a lát 1: phần thuế GTGT — kỳ khai, chuỗi khấu trừ, tờ khai tự khớp, tờ khai ↔ bảng kê cổng ↔ bảng kê phần mềm,
// từng hóa đơn. Bộ máy: lib/phanTich/soatKy.js (hàm thuần). CHỈ ĐỌC thư mục, không lưu gì, chỉ nêu sự việc.
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { TabSoat, OTongSinhDong, ChipMau, KieuBang } from '@/components/phanTich/phanTichUI'
import { useHoSoCty, docExcelBuf } from '@/components/phanTich/useHoSoCty'
import ThanhCongTy, { Bao } from '@/components/phanTich/ThanhCongTy'
import RuiRoLuyKe from '@/components/phanTich/RuiRoLuyKe'
import HanNopKy, { useHanNop, hanTheoLich } from '@/components/phanTich/HanNopKy'
import { docBangKeDayDu } from '@/lib/phanTich/docHoSo'
import { soatKy, daiKy, kyKhaiNam, coSoSach } from '@/lib/phanTich/soatKy'

const NHOM = {
  ky_khai: { nhan: 'Kỳ khai', mau: '#7C3AED' }, gtgt: { nhan: 'GTGT', mau: '#8B1A1A' }, dau_ra: { nhan: 'GTGT đầu ra', mau: '#059669' },
  dau_vao: { nhan: 'GTGT đầu vào', mau: '#9333EA' }, hoa_don: { nhan: 'Hóa đơn', mau: '#2563EB' },
  tncn: { nhan: 'TNCN', mau: '#DB2777' }, bao_hiem: { nhan: 'Bảo hiểm', mau: '#475569' }, ngan_hang: { nhan: 'Ngân hàng', mau: '#0891B2' },
}
const KQ = { khop: ['Khớp', 'xanhLa'], chenh: ['Có chênh lệch', 'hoPhach'], thieu: ['Thiếu hồ sơ', 'do'], thong_tin: ['Để biết', 'xanhDuong'] }
const KY_TT = {
  da_nop: { chu: 'Đã nộp', lop: 'border-emerald-300 bg-emerald-50/60', cham: 'text-emerald-700' },
  chua_nop: { chu: 'Bản chưa nộp', lop: 'border-orange-300 bg-orange-50/60', cham: 'text-orange-700' },
  cho_han: { chu: 'Chưa có tờ khai · chờ hạn', lop: 'border-amber-300 bg-amber-50/50', cham: 'text-amber-700' },
  thieu: { chu: 'Thiếu tờ khai', lop: 'border-red-300 bg-red-50/60', cham: 'text-red-700' },
  chua_den: { chu: 'Chưa đến kỳ', lop: 'border-gray-200 bg-gray-50', cham: 'text-gray-400' },
}
const LOAI_CT = {
  chi_cong: ['Có trên cổng · chưa vào phần mềm', 'hoPhach'], chi_pm: ['Trong phần mềm · không có trên cổng', 'tim'],
  lech: ['Lệch tiền / thuế', 'do'], het_hieu_luc: ['Bị thay thế / hủy mà vẫn kê', 'do'], ngoai_ky: ['Ngày ngoài kỳ', 'xanhDuong'],
  nh_chi_sao_ke: ['Có trên sổ phụ · chưa thấy trên sổ 112', 'hoPhach'], nh_chi_so: ['Có trên sổ 112 · chưa thấy trên sổ phụ', 'tim'],
  tien_mat_nguong: ['Chi tiền mặt từ ngưỡng', 'do'],
}
const CHIEU = { ban_ra: 'Bán ra', mua_vao: 'Mua vào', ngan_hang: 'Ngân hàng', tien_mat: 'Tiền mặt' }
const so = n => (n == null || n === '' ? <span className="text-gray-300">—</span> : typeof n === 'number' ? (n < 0 ? `(${Math.round(-n).toLocaleString('vi-VN')})` : Math.round(n).toLocaleString('vi-VN')) : n)
const ngayVN = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
const conNgay = han => Math.ceil((new Date(han + 'T23:59:59+07:00') - Date.now()) / 864e5)

export default function TrangSoatKy() {
  return <Suspense fallback={null}><SoatKy /></Suspense>
}

function SoatKy() {
  const router = useRouter()
  const params = useSearchParams()
  const ctyId = params.get('cty') || ''
  const hs = useHoSoCty(ctyId, { docNamTruoc: true, docLuong: true })
  const { cty, nam, doc, docTruoc, mstCty, qn } = hs
  const [maKy, setMaKy] = useState(params.get('ky') || '')
  const [bangKeDu, setBangKeDu] = useState(null)
  const [dangDocBk, setDangDocBk] = useState(false)
  const [locCt, setLocCt] = useState('')

  const toKhai = useMemo(() => doc?.toKhai || [], [doc])
  const nk = useMemo(() => kyKhaiNam(toKhai, nam), [toKhai, nam])
  const loaiKy = nk.loai || (cty?.kyKhai === 'thang' ? 'T' : 'Q')
  const homNay = new Date().toISOString().slice(0, 10)
  const dai = useMemo(() => (nam ? daiKy(nam, loaiKy, toKhai, homNay) : []), [nam, loaiKy, toKhai, homNay])

  // Kỳ mặc định: kỳ gần nhất đã có tờ khai (bản chưa nộp ưu tiên), không thì kỳ gần nhất đã kết thúc
  useEffect(() => {
    // Đợi đọc xong tờ khai mới chọn — chọn sớm thì mọi kỳ đều "chưa có tờ khai" và luôn rơi vào kỳ mới nhất
    if (!doc || !dai.length || (maKy && dai.some(k => k.ma === maKy))) return
    const coTk = [...dai].reverse().find(k => k.tt === 'chua_nop' || k.tt === 'da_nop')
    const daHet = [...dai].reverse().find(k => k.tt !== 'chua_den')
    setMaKy((coTk || daHet || dai[0]).ma)
  }, [doc, dai, maKy])

  const chonKy = ma => { setMaKy(ma); setLocCt(''); router.replace(`/soatbaocao/soat-ky?cty=${ctyId}&ky=${ma}`) }

  // Đọc đầy đủ từng hóa đơn của các bảng kê liên quan tới kỳ (giữ trong bộ nhớ tab)
  useEffect(() => {
    setBangKeDu(null)
    if (!doc || !maKy || !nam) return
    const k = dai.find(x => x.ma === maKy)
    if (!k) return
    const thang = k.loai === 'T' ? [k.so] : [3 * k.so - 2, 3 * k.so - 1, 3 * k.so]
    const coThang = b => (b.thang || []).some(t => t.startsWith(nam + '-') && thang.includes(+t.slice(5, 7)))
    let huy = false
    setDangDocBk(true)
    docBangKeDayDu(doc.bangKe, { docExcelBuf, mstCty: mstCty || toKhai[0]?.mst || '', chon: b => (b.mau === 'cong' ? coThang(b) : b.mau?.startsWith('pm_') || b.mau === 'tk_pm') })
      .then(r => { if (!huy) setBangKeDu(r) })
      .finally(() => { if (!huy) setDangDocBk(false) })
    return () => { huy = true }
  }, [doc, maKy, nam, dai, mstCty, toKhai])

  const kq = useMemo(() => {
    if (!cty || !doc || !maKy || !bangKeDu) return null
    return soatKy({ nam, ma: maKy, toKhai, toKhaiTruoc: docTruoc?.toKhai || [], bangKe: bangKeDu.bangKe, bangLuong: doc.bangLuong || [], c12: doc.c12 || [], saoKeTien: doc.saoKeTien || [], soTien: doc.soTien || [], soSach: coSoSach(qn), cty })
  }, [cty, doc, docTruoc, maKy, bangKeDu, nam, toKhai, qn])

  const chiTietLoc = kq ? kq.chiTiet.filter(c => !locCt || c.loai === locCt) : []

  async function taiExcel() {
    if (!kq) return
    const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
    const wb = await soExcelMoi()
    const tieuDe = `SOÁT KỲ ${kq.ky.ma}/${kq.nam} — ${cty.ten}`
    themSheetMang(wb, 'Kết quả soát', [
      [tieuDe], [`MST ${cty.mst} · soát ${kq.banSoat === 'chua_nop' ? 'bản chưa nộp' : kq.banSoat === 'da_nop' ? 'bản đã nộp' : 'chưa có tờ khai'} · xuất ${new Date().toLocaleString('vi-VN')}`],
      ['Nhóm', 'Kiểm tra', 'Số cần soát', 'Nguồn số cần soát', 'Số đối chiếu', 'Nguồn số đối chiếu', 'Chênh lệch', 'Kết quả', 'Ghi chú / hồ sơ cần có'],
      ...kq.dong.map(d => [NHOM[d.nhom]?.nhan || d.nhom, d.ten, typeof d.so1 === 'number' ? d.so1 : d.so1 ?? '', d.nhan1 || '', typeof d.so2 === 'number' ? d.so2 : d.so2 ?? '',
        d.nhan2 || '', d.chenh ?? d.chenhChu ?? '', KQ[d.kq][0], d.thieuFile || d.ghiChu || '']),
    ], { doRong: [14, 52, 16, 26, 16, 26, 16, 14, 50], cotTien: [2, 4, 6] })
    themSheetMang(wb, 'Hóa đơn cần xem', [
      [`HÓA ĐƠN CẦN XEM — KỲ ${kq.ky.ma}/${kq.nam}`], [cty.ten],
      ['Chiều', 'Loại', 'Ngày', 'Ký hiệu', 'Số', 'MST đối tác', 'Tên đối tác', 'Tiền chưa thuế', 'Thuế', 'Lý do'],
      ...kq.chiTiet.map(c => [CHIEU[c.chieu] || c.chieu, LOAI_CT[c.loai][0], ngayVN(c.hd.ngay), c.hd.kyHieu || c.cong?.kyHieu || '', c.hd.so, c.hd.mst, c.hd.ten || c.cong?.ten || '',
        c.hd.tienChuaThue ?? '', c.hd.thue ?? '', c.lyDo]),
    ], { doRong: [10, 30, 12, 12, 10, 16, 40, 16, 14, 50], cotTien: [7, 8] })
    await taiVeExcel(wb, `SoatKy_${cty.maKH || cty.mst}_${kq.ky.ma}_${kq.nam}.xlsx`)
  }

  const hoSoKhop = cty && nk.loai ? (cty.kyKhai === 'thang' ? 'T' : 'Q') === nk.loai : null
  const kyDangChon = dai.find(k => k.ma === maKy)
  // Hạn nộp + trạng thái nộp từ phân hệ Tờ khai; hạn theo lịch Tờ khai (đã tính ngày nghỉ) ưu tiên hơn hạn app tự tính
  const hanNop = useHanNop(ctyId, nam, hs.lanDoc)
  const han = kq && !kq.loi ? (hanTheoLich(hanNop.nghiaVu, kq.ky, kq.nam) || kq.han) : null

  return (
    <AppShell>
      <KieuBang />
      <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔎</span>
          <h1 className="text-xl font-bold text-gray-800">Soát xét báo cáo</h1>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">🔒 Chỉ đọc thư mục — không ghi gì vào Drive</span>
        </div>
        <TabSoat giuCty={ctyId} />
        <ThanhCongTy hs={hs} duongDan="/soatbaocao/soat-ky" chuChonCty="Chọn một công ty để soát kỳ."
          themTruoc={kq && <button type="button" onClick={taiExcel} className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212] whitespace-nowrap flex-shrink-0">⬇ Tải Excel</button>} />

        {doc && cty && (
          <>
            {/* Kỳ khai cả năm + dải kỳ */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-sm font-bold text-gray-800">Kỳ khai năm {nam}: {loaiKy === 'T' ? 'Tháng' : 'Quý'} (cả năm)</p>
                <ChipMau nhan={nk.loai ? `Theo tờ khai ${nam}${nk.lan ? ' — LẪN tháng và quý' : ''}` : 'Chưa có tờ khai — tạm theo hồ sơ công ty'} mau={nk.lan ? 'do' : nk.loai ? 'xanhLa' : 'xam'} />
                {hoSoKhop != null && <ChipMau nhan={`Hồ sơ công ty trên app: ${cty.kyKhai === 'thang' ? 'Tháng' : 'Quý'} — ${hoSoKhop ? 'khớp' : 'KHÁC (có thể tick nhầm)'}`} mau={hoSoKhop ? 'xanhLa' : 'hoPhach'} />}
                <span className="ml-auto text-[11px] text-gray-400">Kỳ khai cố định trọn năm · trạng thái tính từ thư mục, không lưu</span>
              </div>
              <div className={`grid gap-2 ${loaiKy === 'T' ? 'grid-cols-3 md:grid-cols-6 xl:grid-cols-12' : 'grid-cols-2 md:grid-cols-4'}`}>
                {dai.map(k => {
                  const t = KY_TT[k.tt]
                  const dangChon = k.ma === maKy
                  return (
                    <button key={k.ma} type="button" onClick={() => chonKy(k.ma)} disabled={k.tt === 'chua_den'}
                      className={`text-left rounded-xl border-2 px-3 py-2 transition ${t.lop} ${dangChon ? 'ring-2 ring-[#8B1A1A] ring-offset-1' : 'hover:shadow-sm'} disabled:opacity-60`}>
                      <span className="text-lg font-bold text-gray-800 mr-1.5">{k.ma.replace(/^T0/, 'T')}</span>
                      {loaiKy === 'Q' && <span className="text-[11px] text-gray-500">T{3 * k.so - 2}–T{3 * k.so}/{nam}</span>}
                      <span className={`block text-[11px] font-semibold ${t.cham}`}>● {t.chu}{k.lanBoSung ? ` · BS lần ${k.lanBoSung}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {(dangDocBk || (!kq && maKy)) && !hs.buoc && <p className="text-sm text-gray-500 py-3 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />Đang đọc bảng kê của kỳ {maKy}…</p>}
            {kq?.loi && <Bao mau="amber">{kq.loi}</Bao>}

            {kq && !kq.loi && (
              <>
                {/* Đang soát bản nào */}
                <div className={`rounded-2xl px-5 py-3.5 mb-4 flex flex-wrap items-center gap-4 text-white shadow-sm ${kq.banSoat === 'chua_nop' ? 'bg-gradient-to-r from-orange-600 to-amber-500' : kq.banSoat === 'da_nop' ? 'bg-gradient-to-r from-emerald-700 to-teal-500' : 'bg-gradient-to-r from-slate-600 to-slate-400'}`}>
                  <span className="text-2xl">📝</span>
                  <div className="flex-1 min-w-[260px]">
                    <p className="font-bold">
                      {kq.banSoat === 'chua_nop' ? 'Đang soát BẢN CHƯA NỘP' : kq.banSoat === 'da_nop' ? 'Đang soát BẢN ĐÃ NỘP' : 'Chưa có tờ khai của kỳ này'}
                      {kq.toKhai && ` · tờ khai 01/GTGT ${kq.ky.loai === 'Q' ? 'quý ' + kq.ky.so : 'tháng ' + kq.ky.so}/${kq.nam}`}
                      {kq.toKhai?.lanBoSung ? ` · bổ sung lần ${kq.toKhai.lanBoSung}` : ''}{kq.toKhai?.nguon === 'pdf' ? ' · đọc từ PDF' : ''}
                    </p>
                    {kq.toKhai && <p className="text-[11px] font-mono opacity-90 truncate">{kq.toKhai.tep.duongDan.slice(-3).join('\\')}\{kq.toKhai.tep.ten}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] opacity-90">Hạn nộp</p>
                    <p className="text-lg font-bold leading-tight">{ngayVN(han)}{conNgay(han) >= 0 ? ` · còn ${conNgay(han)} ngày` : ''}</p>
                  </div>
                </div>

                <HanNopKy data={hanNop} k={kq.ky} nam={kq.nam} />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <OTongSinhDong so={kq.oTong.tong} nhan="Phép kiểm tra trong kỳ" mau="xanhDuong" phu="GTGT · TNCN · bảo hiểm · ngân hàng" />
                  <OTongSinhDong so={kq.oTong.khop} nhan="Khớp" mau="xanhLa" />
                  <OTongSinhDong so={kq.oTong.chenh} nhan="Có chênh lệch" mau="hoPhach" phu={kq.dong.filter(d => d.kq === 'chenh').map(d => NHOM[d.nhom]?.nhan).filter((x, i, a) => a.indexOf(x) === i).join(' · ')} />
                  <OTongSinhDong so={kq.oTong.thieu} nhan="Thiếu hồ sơ" mau="do" phu={kq.oTong.thieu ? 'Xem cột ghi chú: file cần có' : 'Đủ hồ sơ cho các phép kiểm'} />
                </div>

                <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Kết quả soát {kq.ky.loai === 'Q' ? 'quý' : 'tháng'} {kq.ky.so}/{kq.nam} · dòng có chênh lệch lên trước</h2>
                <div className="pt-bang overflow-x-auto mb-5">
                  <table className="text-sm">
                    <thead><tr><th>Nhóm</th><th>Kiểm tra</th><th className="text-right" title="Số của hồ sơ / chứng từ đang soát — nguồn ghi ngay dưới số">Số cần soát</th><th className="text-right" title="Số đem ra so — nguồn ghi ngay dưới số">Số đối chiếu</th><th className="text-right">Chênh lệch</th><th>Kết quả</th></tr></thead>
                    <tbody>
                      {kq.dong.map((d, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap"><span className="inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: NHOM[d.nhom]?.mau }}>{NHOM[d.nhom]?.nhan}</span></td>
                          <td className="max-w-[420px]">
                            <p className="text-gray-800">{d.ten}</p>
                            {(d.ghiChu || d.thieuFile) && <p className={`text-[11px] mt-0.5 ${d.kq === 'thieu' ? 'text-red-700' : 'text-gray-500'}`}>{d.kq === 'thieu' ? 'Cần: ' : ''}{d.thieuFile || d.ghiChu}</p>}
                          </td>
                          <td className="text-right whitespace-nowrap"><p className="font-semibold tabular-nums text-gray-800">{so(d.so1)}</p><p className="text-[10px] text-gray-400">{d.nhan1}</p></td>
                          <td className="text-right whitespace-nowrap"><p className="font-semibold tabular-nums text-gray-800">{so(d.so2)}</p><p className="text-[10px] text-gray-400">{d.nhan2}</p></td>
                          <td className={`text-right whitespace-nowrap tabular-nums font-semibold ${d.kq === 'chenh' ? 'text-amber-700' : 'text-gray-400'}`}>
                            {d.chenhChu ? <span className="text-xs">{d.chenhChu}</span> : d.chenh != null ? so(d.chenh) : d.kq === 'khop' ? '0' : ''}
                          </td>
                          <td className="whitespace-nowrap"><ChipMau nhan={KQ[d.kq][0]} mau={KQ[d.kq][1]} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {kq.chiTiet.length > 0 && (
                  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-4">
                    <div className="pt-khung-tieu-de px-4 py-2.5 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-gray-800 mr-2">Chi tiết · {kq.chiTiet.length} hóa đơn / giao dịch cần xem</p>
                      {['', ...Object.keys(LOAI_CT)].map(l => {
                        const n = l ? kq.chiTiet.filter(c => c.loai === l).length : kq.chiTiet.length
                        if (l && !n) return null
                        return (
                          <button key={l || 'tat'} type="button" onClick={() => setLocCt(l)}
                            className={`text-[11px] px-2 py-0.5 rounded-lg border ${locCt === l ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]' : 'bg-white text-gray-600 border-gray-200'}`}>
                            {l ? LOAI_CT[l][0] : 'Tất cả'} · {n}
                          </button>
                        )
                      })}
                    </div>
                    <div className="pt-bang overflow-x-auto max-h-[520px] overflow-y-auto m-3">
                      <table className="text-xs">
                        <thead><tr><th>Loại</th><th>Ngày</th><th>Ký hiệu · số</th><th>Đối tác</th><th className="text-right">Tiền chưa thuế</th><th className="text-right">Thuế</th><th>Lý do</th></tr></thead>
                        <tbody>
                          {chiTietLoc.slice(0, 300).map((c, i) => (
                            <tr key={i}>
                              <td className="whitespace-nowrap"><ChipMau nhan={`${CHIEU[c.chieu] || c.chieu} · ${LOAI_CT[c.loai][0]}`} mau={LOAI_CT[c.loai][1]} /></td>
                              <td className="tabular-nums whitespace-nowrap">{ngayVN(c.hd.ngay)}</td>
                              <td className="font-mono whitespace-nowrap">{c.hd.kyHieu || c.cong?.kyHieu || '—'} · {c.hd.so}</td>
                              <td className="max-w-[280px]"><p className="truncate" title={c.hd.ten || c.cong?.ten}>{c.hd.ten || c.cong?.ten || '—'}</p><p className="text-gray-400 tabular-nums">{c.hd.mst ? 'MST ' + c.hd.mst : 'không MST'}</p></td>
                              <td className="text-right tabular-nums">{so(c.hd.tienChuaThue)}</td>
                              <td className="text-right tabular-nums">{so(c.hd.thue)}</td>
                              <td className="text-gray-600 max-w-[320px]">{c.lyDo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {chiTietLoc.length > 300 && <p className="text-xs text-gray-500 px-3 py-2">… và {chiTietLoc.length - 300} hóa đơn nữa — bấm “Tải Excel” để xem đủ.</p>}
                    </div>
                  </div>
                )}
                {kyDangChon && conNgay(han) >= 0 && kq.oTong.chenh > 0 && (
                  <p className="text-xs text-orange-700 mb-6">Còn trong hạn nộp ({ngayVN(han)}): sửa trong phần mềm, xuất lại bảng kê và tờ khai vào thư mục kỳ, bấm “Tải lại thư mục” để soát lại trước khi nộp.</p>
                )}
                <RuiRoLuyKe quet={hs.quet} nam={kq.nam} ky={kq.ky} mst={mstCty || toKhai[0]?.mst || ''} ctyId={ctyId} />
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
