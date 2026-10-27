'use client'
// Soát xét báo cáo — màn "Tăng trưởng & phí" (mockup docs/mockup-phan-tich/soat-6-tang-truong.html, kế hoạch mục 3b).
// 6 chỉ tiêu theo quý từ thư mục công ty (mọi năm đã trỏ) + căn cứ điều chỉnh phí theo đúng engine biểu phí của phân hệ
// Kinh doanh. Khối phí chỉ hiện khi máy chủ cho (quyền xem_phi_de_xuat — trưởng phòng, admin). CHỈ ĐỌC, không lưu gì:
// phí đề xuất sửa được nhưng chỉ dùng trên màn hình / bản Excel lúc đó.
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { TabSoat, KieuBang } from '@/components/phanTich/phanTichUI'
import { useHoSoCty, DEM, docExcelBuf, docPdf } from '@/components/phanTich/useHoSoCty'
import ThanhCongTy, { Bao } from '@/components/phanTich/ThanhCongTy'
import BanGuiKhach from '@/components/phanTich/BanGuiKhach'
import { docToKhaiCuaNam, docBangKeCuaNam, docBangLuongCuaNam, docSaoKeCuaNam, docHaiQuanCuaNam } from '@/lib/phanTich/docHoSo'
import { tinhQuy, soSanh, chonMoc, phiTheoBieuPhi, phiDangThuThang, deXuatPhiKhach, CHI_TIEU } from '@/lib/phanTich/tangTruong'

const MAU = { doanhThu: '#8B1A1A', laoDong: '#7C3AED', hdVao: '#2563EB', hdRa: '#059669', haiQuan: '#D97706', saoKe: '#0891B2', chungTu: '#B8860B' }
const ICON = { doanhThu: '💰', laoDong: '👥', hdVao: '📥', hdRa: '📤', haiQuan: '🚢', saoKe: '🏦', chungTu: '📑' }
const tien = n => (n == null ? '—' : Math.round(n).toLocaleString('vi-VN'))
const ty = n => (n == null ? '—' : (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }))
const soCT = (k, v) => (v == null ? '—' : k === 'doanhThu' ? ty(v) : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 }))
const phanTram = p => (p == null ? null : `${p >= 0 ? '▲' : '▼'} ${p >= 0 ? '+' : ''}${(p * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`)

export default function TrangTangTruong() {
  return <Suspense fallback={null}><TangTruong /></Suspense>
}

function TangTruong() {
  const params = useSearchParams()
  const ctyId = params.get('cty') || ''
  const hs = useHoSoCty(ctyId)
  const { cty, quet, mstCty } = hs
  const [duLieu, setDuLieu] = useState(null)
  const [dangDoc, setDangDoc] = useState('')
  const [phi, setPhi] = useState(null)              // null = đang tải / không có quyền: { khongCoQuyen } | dữ liệu
  const [iMocChon, setIMocChon] = useState(null)
  const [phiSua, setPhiSua] = useState('')
  const [canCuSua, setCanCuSua] = useState(null)   // null = dùng câu mặc định; chuỗi = nội dung đã sửa (không lưu)
  const [moBanIn, setMoBanIn] = useState(false)

  // Đọc 6 nguồn của MỌI năm đã có trong thư mục (bộ nhớ đệm trên máy nên lần sau nhanh)
  useEffect(() => {
    setDuLieu(null)
    if (!quet || !Object.keys(quet.nam).length) return
    let huy = false
    ;(async () => {
      const ra = {}
      for (const [nam, qn] of Object.entries(quet.nam)) {
        if (huy) return
        setDangDoc(`Đang đọc dữ liệu năm ${nam}…`)
        const tk = await docToKhaiCuaNam(qn, { dem: DEM, docPdf })
        const mst = mstCty || tk.toKhai[0]?.mst || ''
        const [bk, bl, sk, hq] = await Promise.all([
          docBangKeCuaNam(qn, { dem: DEM, docExcelBuf, mstCty: mst }), docBangLuongCuaNam(qn, { dem: DEM, docExcelBuf }),
          docSaoKeCuaNam(qn, { dem: DEM, docExcelBuf }), docHaiQuanCuaNam(qn, { dem: DEM, docExcelBuf }),
        ])
        ra[nam] = { toKhai: tk.toKhai, bangKe: bk.bangKe, bangLuong: bl.bangLuong, saoKe: sk, haiQuan: { ...hq, coThuMuc: qn.thuMuc.some(t => t.ma === 'hai_quan') }, hoaDonTep: qn.hoaDon?.tep || [] }
      }
      if (!huy) { setDuLieu(ra); setDangDoc('') }
    })()
    return () => { huy = true }
  }, [quet, mstCty])

  // Số liệu phí: máy chủ chỉ trả cho trưởng phòng / admin
  useEffect(() => {
    setPhi(null); setPhiSua(''); setIMocChon(null); setCanCuSua(null)
    if (!ctyId) return
    fetch('/api/admin/phantich/phi?cty=' + ctyId).then(async r => { const j = await r.json(); setPhi(r.ok ? j : { khongCoQuyen: true }) }).catch(() => setPhi({ khongCoQuyen: true }))
  }, [ctyId])

  const quy = useMemo(() => (duLieu ? tinhQuy(duLieu) : []), [duLieu])
  const mocTuDong = useMemo(() => chonMoc(quy, { feePlans: phi?.feePlans || [], contractStart: phi?.contractStart || cty?.batDau || null }), [quy, phi, cty])
  const iMoc = iMocChon ?? mocTuDong.i
  const iCuoi = quy.length - 1
  const cuoi = quy[iCuoi]
  const phiNay = useMemo(() => (quy.length ? phiTheoBieuPhi(quy, iCuoi) : null), [quy, iCuoi])
  const phiMoc = useMemo(() => (quy.length && iMoc != null ? phiTheoBieuPhi(quy, iMoc) : null), [quy, iMoc])
  const coPhi = phi && !phi.khongCoQuyen
  const dangThu = coPhi ? phiDangThuThang(phi.monthlyFee, phi.feePeriod) : null
  const deXuat = phiSua !== '' ? Math.max(0, Number(String(phiSua).replace(/\D/g, '')) || 0) : phiNay?.gomVat ?? null
  // Căn cứ gửi khách: mặc định = câu khối lượng + câu căn cứ của biểu phí (deXuatPhiKhach); trưởng phòng sửa tự do
  const canCuMacDinh = useMemo(() => (quy.length && phiNay ? (deXuatPhiKhach(quy, quy.length - 1, iMoc, phiNay, dangThu, deXuat)?.doan || []) : []), [quy, iMoc, phiNay, dangThu, deXuat])
  const canCuGui = canCuSua != null ? canCuSua.split('\n').map(x => x.trim()).filter(Boolean) : canCuMacDinh

  async function taiExcel() {
    const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
    const wb = await soExcelMoi()
    const hang = [[`TĂNG TRƯỞNG THEO QUÝ — ${cty.ten}`], [`MST ${cty.mst} · mốc so sánh ${quy[iMoc]?.ma || '—'} · xuất ${new Date().toLocaleString('vi-VN')}`],
      ['Chỉ tiêu', ...quy.map(q => q.ma), 'Nguồn'],
      ...[...CHI_TIEU, { k: 'chungTu', nhan: 'Chứng từ/tháng (biểu phí)' }].map(c => [c.k === 'doanhThu' ? 'Doanh thu (đồng)' : c.nhan, ...quy.map(q => q.chiTieu[c.k]?.v ?? ''), cuoi?.chiTieu[c.k]?.nguon || ''])]
    if (coPhi && phiNay) {
      hang.push([], ['CĂN CỨ ĐIỀU CHỈNH PHÍ (mọi số đã gồm VAT)'], ['Khoản', 'Số tiền'],
        ['Phí đang thu (quy về tháng)', dangThu ?? ''], [`Biểu phí ở mốc ${phiMoc?.quy || ''}`, phiMoc?.gomVat ?? ''], [`Biểu phí hiện tại ${phiNay.quy}`, phiNay.gomVat],
        ['Phí đề xuất', deXuat ?? ''], ...phiNay.canCu.map(c => [c]), ...phiNay.canhBao.map(c => ['⚠ ' + c]))
    }
    themSheetMang(wb, 'Tăng trưởng', hang, { doRong: [34, ...quy.map(() => 16), 40], cotTien: quy.map((_, i) => i + 1) })
    await taiVeExcel(wb, `TangTruong_${cty.maKH || cty.mst}.xlsx`)
  }

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
        <ThanhCongTy hs={hs} duongDan="/soatbaocao/tang-truong" chuChonCty="Chọn một công ty để xem tăng trưởng theo quý."
          themTruoc={quy.length > 0 && <>
            <button type="button" onClick={() => setMoBanIn(true)} className="px-3 py-1.5 rounded-xl text-sm border border-[#8B1A1A] text-[#8B1A1A] font-semibold hover:bg-red-50 whitespace-nowrap flex-shrink-0">👁 Bản gửi khách</button>
            <button type="button" onClick={taiExcel} className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212] whitespace-nowrap flex-shrink-0">⬇ Excel</button>
          </>} />

        {dangDoc && <p className="text-sm text-gray-500 py-3 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />{dangDoc}</p>}
        {duLieu && !quy.length && <Bao mau="amber">Chưa có quý nào đã kết thúc có số liệu trong thư mục. Cần ít nhất tờ khai 01/GTGT hoặc bảng kê / sao kê của một quý.</Bao>}

        {cuoi && cty && (
          <>
            {/* Dải tóm tắt */}
            <div className="rounded-2xl mb-4 px-6 py-5 text-white shadow-md flex flex-wrap items-center gap-5" style={{ background: 'linear-gradient(110deg,#8B1A1A 0%,#A3262A 45%,#C9A84C 120%)' }}>
              <div className="flex-1 min-w-[280px]">
                <p className="text-xs tracking-widest opacity-80 font-semibold">TĂNG TRƯỞNG QUÝ {cuoi.so}/{cuoi.nam}</p>
                <p className="text-2xl font-bold leading-tight mt-1">{cty.ten}</p>
                <p className="text-sm opacity-90 mt-1">So với mốc <b>{quy[iMoc]?.ma || '—'}</b>{iMocChon == null && mocTuDong.lyDo ? ` (${mocTuDong.lyDo})` : ''} · {quy.length} quý dữ liệu</p>
              </div>
              {[['chungTu', 'Chứng từ/tháng', v => tien(v)], ['doanhThu', 'Doanh thu quý', v => ty(v) + ' tỷ'], ['laoDong', 'Lao động', v => soCT('laoDong', v) + ' người']].map(([k, nhan, f]) => {
                const v = cuoi.chiTieu[k]?.v
                const m = iMoc != null ? quy[iMoc]?.chiTieu[k]?.v : null
                const p = v != null && m ? (v - m) / m : null
                return (
                  <div key={k} className="rounded-xl bg-white/15 backdrop-blur px-4 py-2.5 min-w-[150px]">
                    <p className="text-[11px] opacity-85">{nhan}</p>
                    <p className="text-2xl font-bold tabular-nums">{v == null ? '—' : f(v)}</p>
                    <p className="text-[11px] opacity-90">{p == null ? '—' : `${phanTram(p)} so mốc`}</p>
                  </div>
                )
              })}
            </div>

            {/* 6 thẻ chỉ tiêu */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
              {CHI_TIEU.map(c => {
                const x = cuoi.chiTieu[c.k]
                const ss = soSanh(quy, iCuoi, c.k, iMoc)
                const vs = quy.map(q => q.chiTieu[c.k]?.v ?? null)
                const max = Math.max(1, ...vs.filter(v => v != null))
                const mau = MAU[c.k]
                return (
                  <div key={c.k} className="rounded-2xl bg-white shadow-sm overflow-hidden border" style={{ borderColor: mau + '40' }}>
                    <div className="px-4 py-2.5 text-white font-bold text-sm flex items-center gap-2" style={{ background: `linear-gradient(90deg,${mau},${mau}CC)` }}>
                      <span>{ICON[c.k]}</span>{c.nhan}
                    </div>
                    <div className="px-4 pt-3 pb-3" style={{ background: `linear-gradient(180deg,${mau}10,#fff 70%)` }}>
                      <p className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tabular-nums" style={{ color: mau }}>{soCT(c.k, x.v)}</span>
                        <span className="text-sm text-gray-500">{c.k === 'doanhThu' ? 'tỷ đồng' : c.donVi} · {cuoi.ma}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 min-h-[16px]">{x.nguon || 'Chưa có nguồn trong thư mục'}{x.thieu ? ` · thiếu ${x.thieu.join(', ')}` : ''}{c.k === 'laoDong' && x.coBh != null ? ` · ${soCT('laoDong', x.coBh)} người đóng BHXH` : ''}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2 min-h-[24px]">
                        {[['quý trước', ss.qTruoc], ['cùng kỳ', ss.cungKy], ['mốc', ss.moc]].filter(([, p]) => p != null).map(([n, p]) => (
                          <span key={n} className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${p >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{n} {phanTram(p)}</span>
                        ))}
                      </div>
                      {/* Cột theo quý — màu để phân biệt chỉ tiêu, không phải đánh giá tốt / xấu */}
                      <div className="flex items-end gap-1 h-[64px] mt-3">
                        {vs.map((v, i) => (
                          <div key={i} title={`${quy[i].ma}: ${soCT(c.k, v)}`} className="flex-1 rounded-t" style={{
                            height: v == null ? 3 : Math.max(3, (v / max) * 64), background: v == null ? '#E5E7EB' : i === iCuoi ? mau : mau + '55',
                            outline: i === iMoc ? `2px solid #C9A84C` : 'none', outlineOffset: 1 }} />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{quy[0].ma}</span>{iMoc != null && <span className="text-[#B8860B]">▪ mốc {quy[iMoc]?.ma}</span>}<span>{cuoi.ma}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bảng số liệu theo quý */}
            <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Số liệu theo quý</h2>
            <div className="pt-bang overflow-x-auto mb-1">
              <table className="text-sm">
                <thead>
                  <tr><th>Chỉ tiêu</th>{quy.map((q, i) => <th key={q.ma} className="text-right" style={i === iMoc ? { background: '#A3262A' } : undefined}>{q.ma}{i === iMoc ? <span className="block text-[10px] font-normal text-amber-200">mốc phí</span> : null}</th>)}</tr>
                </thead>
                <tbody>
                  {[...CHI_TIEU, { k: 'chungTu', nhan: 'Chứng từ/tháng (biểu phí)' }].map(c => (
                    <tr key={c.k}>
                      <td className="whitespace-nowrap font-medium text-gray-700"><span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: MAU[c.k] }} />{c.k === 'doanhThu' ? 'Doanh thu (tỷ)' : c.nhan}</td>
                      {quy.map((q, i) => {
                        const x = q.chiTieu[c.k]
                        return (
                          <td key={q.ma} className="text-right tabular-nums" title={[x?.nguon, x?.thieu && 'thiếu ' + x.thieu.join(', ')].filter(Boolean).join(' · ')}
                            style={i === iCuoi ? { background: MAU[c.k] + '14', fontWeight: 700, color: MAU[c.k] } : i === iMoc ? { background: '#FFF8E6' } : undefined}>
                            {soCT(c.k, x?.v)}{x?.thieu ? <span className="text-amber-600">*</span> : null}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-500 mb-5">Chứng từ/tháng = (hóa đơn đầu vào + hóa đơn đầu ra + giao dịch sao kê) ÷ 3, đúng đơn vị biểu phí. * = quý thiếu tháng (rê chuột xem). ▲▼ là tăng / giảm, không phải đánh giá.</p>

            {/* Căn cứ điều chỉnh phí — chỉ trưởng phòng, admin */}
            {coPhi && phiNay && (
              <div className="rounded-2xl p-[3px] mb-6" style={{ background: 'linear-gradient(110deg,#8B1A1A,#C9A84C)' }}>
                <div className="rounded-[14px] bg-[#FFFCF5] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <p className="text-lg font-bold text-[#8B1A1A]">💼 Căn cứ điều chỉnh phí</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#8B1A1A] text-white font-semibold">🔒 Chỉ trưởng phòng, admin</span>
                    <label className="ml-auto text-xs text-gray-600 flex items-center gap-1.5">Mốc so sánh
                      <select value={iMoc ?? ''} onChange={e => setIMocChon(Number(e.target.value))} className="px-2 py-1 border border-amber-300 rounded-lg bg-white text-xs font-semibold">
                        {quy.map((q, i) => <option key={q.ma} value={i}>{q.ma}{i === mocTuDong.i ? ` · ${mocTuDong.lyDo}` : ''}</option>)}
                      </select>
                    </label>
                  </div>
                  {mocTuDong.ngoaiDuLieu && <p className="text-xs text-amber-700 mb-2">Mốc {mocTuDong.lyDo} là {mocTuDong.ten} — chưa có thư mục năm đó, đang so với quý đầu tiên có dữ liệu. Bấm “＋ Năm cũ” để thêm.</p>}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <OPhi nhan={`Phí đang thu${phi.feePeriod === 'quarterly' ? ' (thu theo quý, quy về tháng)' : ''}`} so={dangThu} phu="mỗi tháng · đã gồm VAT" />
                    <OPhi nhan={`Biểu phí ở mốc ${phiMoc?.quy || '—'}`} so={phiMoc?.gomVat} phu={phiMoc ? `${tien(phiMoc.chungTu)} chứng từ/tháng · ${phiMoc.coHaiQuan ? 'có' : 'không'} hải quan · DT năm ${ty(phiMoc.doanhThu4Quy.v)} tỷ${phiMoc.doanhThu4Quy.du === false ? ' (quy đổi)' : ''}` : ''}
                      canhBao={quy[iMoc]?.chiTieu.chungTu.thieu ? `Số chứng từ ở mốc ${quy[iMoc].chiTieu.chungTu.thieu.join(', ')} → phí ở mốc có thể thấp hơn thực tế` : ''} />
                    <OPhi nhan={`Biểu phí hiện tại ${phiNay.quy}`} so={phiNay.gomVat} phu={`${tien(phiNay.chungTu)} chứng từ/tháng · ${phiNay.coHaiQuan ? 'có' : 'không'} hải quan · DT năm ${ty(phiNay.doanhThu4Quy.v)} tỷ${phiNay.doanhThu4Quy.du === false ? ` (quy đổi từ ${phiNay.doanhThu4Quy.soQuy} quý)` : ''}${phiNay.keKhaiThang ? ' · khai tháng' : ''}`} />
                    <div className="rounded-xl px-4 py-3 text-white" style={{ background: 'linear-gradient(135deg,#8B1A1A,#B4342F)' }}>
                      <p className="text-[11px] opacity-90">Phí đề xuất · sửa được</p>
                      <div className="mt-1 flex items-center bg-white rounded-lg px-2">
                        <input value={phiSua !== '' ? phiSua : (deXuat ?? '').toLocaleString('vi-VN')} onChange={e => setPhiSua(e.target.value)} onFocus={e => e.target.select()}
                          className="w-full py-1.5 text-lg font-bold text-gray-900 tabular-nums outline-none bg-transparent" />
                        <span className="text-xs text-gray-500 whitespace-nowrap">đ/tháng</span>
                      </div>
                      <p className="text-[11px] opacity-90 mt-1">Giá đã bao gồm VAT · không lưu, chỉ dùng để in{phiSua !== '' ? ' · ' : ''}{phiSua !== '' && <button type="button" onClick={() => setPhiSua('')} className="underline">về mặc định</button>}</p>
                      {dangThu != null && deXuat != null && (
                        <p className="text-sm font-bold mt-1">{deXuat >= dangThu ? '▲' : '▼'} {tien(Math.abs(deXuat - dangThu))} đ ({dangThu ? `${deXuat >= dangThu ? '+' : '−'}${(Math.abs(deXuat - dangThu) / dangThu * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so phí đang thu` : ''})</p>
                      )}
                    </div>
                  </div>
                  {/* Căn cứ gửi khách — SỬA ĐƯỢC (anh yêu cầu 27/10/2026), không lưu; bản gửi khách in đúng nội dung này */}
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-gray-700">✏️ Căn cứ đề xuất gửi khách · sửa được</p>
                      <span className="text-[11px] text-gray-500">mỗi dòng một đoạn · không lưu, chỉ dùng để in</span>
                      {canCuSua != null && <button type="button" onClick={() => setCanCuSua(null)} className="ml-auto text-[11px] text-[#8B1A1A] underline">về mặc định</button>}
                    </div>
                    <textarea value={canCuSua ?? canCuMacDinh.join('\n')} onChange={e => setCanCuSua(e.target.value)} rows={Math.max(3, canCuGui.length + 1)}
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <ul className="mt-2 text-[11px] text-gray-500 space-y-0.5">
                    <li>• Biểu phí là giá chưa VAT, app nhân 1,08 để cùng cơ sở với phí đang thu. Ngành tính mặc định: thương mại. (Ghi chú nội bộ — không in cho khách.)</li>
                    {phi.baoGia && <li>• Báo giá {phi.baoGia.soBaoGia} ngày {String(phi.baoGia.ngay).split('-').reverse().join('/')}: khảo sát {tien(phi.baoGia.khaoSat.docs)} chứng từ/tháng, doanh thu năm {ty(phi.baoGia.khaoSat.revenueYear)} tỷ — phí chốt {tien(phi.baoGia.phiThang)} đ/tháng.</li>}
                  </ul>
                  {phiNay.canhBao.map((c, i) => <p key={i} className="mt-2 text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">⚠ {c}</p>)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {moBanIn && cuoi && cty && (
        <BanGuiKhach cty={cty} quy={quy} iMoc={iMoc} phiNay={phiNay} phiDangThu={dangThu} phiDeXuat={deXuat} canCu={canCuGui} coPhi={!!(coPhi && phiNay)} onDong={() => setMoBanIn(false)} />
      )}
    </AppShell>
  )
}

function OPhi({ nhan, so, phu, canhBao }) {
  return (
    <div className="rounded-xl bg-white border border-amber-100 shadow-sm px-4 py-3">
      <p className="text-[11px] text-gray-500">{nhan}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums mt-1">{so == null ? '—' : `${tien(so)} đ`}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{phu}</p>
      {canhBao && <p className="text-[11px] text-amber-700 mt-0.5">⚠ {canhBao}</p>}
    </div>
  )
}
