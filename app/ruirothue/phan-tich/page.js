'use client'
// Rủi ro thuế — trang phân tích một công ty (mockup docs/mockup-phan-tich/ruiro-2…5). Bộ máy: lib/ruiro.
// Các màn Hồ sơ đã đọc / Bảng 39 tiêu chí / Chi tiết / Nhiều năm là CÙNG trang (?xem=…) để chuyển màn không đọc lại.
//
// CHỈ HIỆN SỐ LIỆU + TỶ LỆ, CHƯA ĐÁNH GIÁ (anh chốt 25/10/2026): ẩn mức Cao/TB/Thấp, điểm, màu đánh giá và câu kết
// luận "thuế ảnh hưởng ước tính" của bộ máy. Tỷ lệ chênh lệch = |SL1 − SL2| ÷ số lớn hơn — để so độ lớn, không phải đánh giá.
// CHỈ ĐỌC thư mục, không lưu gì: số tự tìm và số nhân viên sửa tạm mất khi đóng trang.
import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { TabRuiRo, OTongSinhDong, ChipMau, KieuBang, NhanDuoi } from '@/components/phanTich/phanTichUI'
import { useHoSoCty } from '@/components/phanTich/useHoSoCty'
import { useRuiRo } from '@/components/phanTich/useRuiRo'
import ThanhCongTy, { Bao } from '@/components/phanTich/ThanhCongTy'
import { xuatExcelRuiRo, tyLe, laDoiChieu, nhomCua, NHOM } from '@/components/phanTich/ruiRoChung'

const so = n => (n == null || n === '' ? <span className="text-gray-300">—</span> : typeof n === 'number' ? (n < 0 ? `(${Math.round(-n).toLocaleString('vi-VN')})` : Math.round(n).toLocaleString('vi-VN')) : String(n))
const pt = r => (r == null ? '—' : (r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%')
const TRANG_THAI_SO = {
  tu_tim: ['Tự tìm', 'xanhLa'], tam: ['Tạm — cần xác nhận', 'hoPhach'], tu_dong: ['Bộ máy tự lấy', 'xanhDuong'], can_nhap: ['Chờ nhân viên', 'xam'],
}
// Ô nhân viên sửa tạm được (không lưu)
const O_SUA = {
  loConDuocChuyen: 'so', hoanThue: 'so', chiTienMat5tr: 'so',
  coGdlk: [['', 'Không / chưa xác định'], ['co', 'Có']], batBuocKiemToan: [['', 'Không'], ['co', 'Có']],
}

export default function TrangPhanTich() {
  return <Suspense fallback={null}><PhanTich /></Suspense>
}

function PhanTich() {
  const router = useRouter()
  const params = useSearchParams()
  const ctyId = params.get('cty') || ''
  const xem = params.get('xem') || 'bang'
  const maTc = params.get('tc') || ''
  const hs = useHoSoCty(ctyId, { chiQuet: true })
  const rr = useRuiRo(hs)
  const { cty } = hs
  const { bm, hoSo, namSoat, danhGia } = rr

  const moTieuChi = id => router.push(`/ruirothue/phan-tich?cty=${ctyId}&xem=chi-tiet&tc=${id}`)

  async function taiExcel() {
    if (!danhGia) return
    await xuatExcelRuiRo({ cty, rr, R39: bm.R39 })
  }

  const oNam = hoSo?.cacNamCoDuLieu?.length > 0 && (
    <select value={namSoat ?? ''} onChange={e => rr.setNamSoat(Number(e.target.value))}
      className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white font-semibold flex-shrink-0" title="Năm theo nội dung tờ khai / quyết toán / BCTC đọc được">
      {hoSo.cacNamCoDuLieu.map(n => <option key={n} value={n}>Năm {n}</option>)}
    </select>
  )

  return (
    <AppShell>
      <KieuBang />
      <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⚖️</span>
          <h1 className="text-xl font-bold text-gray-800">Rủi ro thuế</h1>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">🔒 Chỉ đọc thư mục — không ghi gì vào Drive</span>
        </div>
        <TabRuiRo giuCty={ctyId} xem={xem} />
        <ThanhCongTy hs={hs} duongDan="/ruirothue/phan-tich" giuThamSo={`&xem=${xem}`} anNamThuMuc oNam={oNam}
          chuChonCty="Chọn một công ty để phân tích rủi ro thuế."
          themTruoc={danhGia && <button type="button" onClick={taiExcel} className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212] whitespace-nowrap flex-shrink-0">⬇ Tải Excel</button>} />

        {rr.loi && <Bao mau="red">{rr.loi}</Bao>}
        {rr.buoc && !hs.buoc && <p className="text-sm text-gray-500 py-3 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />{rr.buoc}</p>}
        {hoSo && !hoSo.cacNamCoDuLieu.length && (
          <Bao mau="amber">Không tìm thấy tờ khai 01/GTGT, quyết toán 03/TNDN hay BCTC (file XML / Excel) nào trong thư mục đã trỏ. Năm cũ (≤ 2025) thì bấm “＋ Năm cũ” và trỏ vào thư mục năm đó.</Bao>
        )}

        {cty && hoSo && danhGia && (
          <>
            {xem === 'ho-so' && <HoSoDaDoc rr={rr} />}
            {xem === 'bang' && <Bang39 rr={rr} moTieuChi={moTieuChi} ctyId={ctyId} />}
            {xem === 'chi-tiet' && <ChiTiet rr={rr} maTc={maTc} moTieuChi={moTieuChi} />}
            {xem === 'nhieu-nam' && <NhieuNam rr={rr} moTieuChi={moTieuChi} />}
          </>
        )}
      </div>
    </AppShell>
  )
}

// ── Hồ sơ đã đọc + số tự tìm ─────────────────────────────────────────────────────
const TEN_LOAI = { GTGT: 'Tờ khai 01/GTGT', TNDN: 'Quyết toán 03/TNDN', BCTC: 'Báo cáo tài chính', TMBCTC: 'Thuyết minh BCTC', SOCT: 'Sổ chi tiết công nợ', HDRR: 'Bảng kê hóa đơn rủi ro' }
function HoSoDaDoc({ rr }) {
  const { hoSo, namSoat, tuTim, suaNam, datSua } = rr
  const theoNam = useMemo(() => {
    const m = {}
    for (const i of hoSo.items) ((m[i.year] = m[i.year] || {})[i.kind] = m[i.year][i.kind] || []).push(i)
    return Object.entries(m).sort((a, b) => b[0] - a[0])
  }, [hoSo])
  const canNhap = tuTim.bang.filter(d => (d.trangThai === 'can_nhap' || d.trangThai === 'tam') && suaNam[d.khoa] == null).length
  return (
    <>
      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Thông tin bổ sung năm {namSoat} — bản cũ phải nhập tay, nay app tự tìm</h2>
      <p className="text-xs text-gray-500 mb-2">Ô có viền sửa tạm được để xem kết quả thay đổi thế nào — <b>không lưu</b>, đóng trang là mất. {canNhap ? `${canNhap} ô cần nhân viên xác nhận.` : ''}</p>
      <div className="pt-bang overflow-x-auto mb-5">
        <table className="text-sm">
          <thead><tr><th>Thông tin</th><th>Tiêu chí</th><th className="text-right">App tìm được</th><th>Sửa tạm</th><th>Nguồn</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {tuTim.bang.map(d => {
              const kieu = O_SUA[d.khoa]
              const gt = suaNam[d.khoa]
              return (
                <tr key={d.khoa}>
                  <td className="font-semibold text-gray-800">{d.ten}</td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{d.tieuChi}</td>
                  <td className="text-right tabular-nums whitespace-nowrap">{d.hienThi}</td>
                  <td>
                    {kieu === 'so' && (
                      <input inputMode="numeric" value={gt != null ? Number(gt).toLocaleString('vi-VN') : ''} placeholder="—"
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); datSua(d.khoa, v === '' ? '' : Number(v)) }}
                        className="w-40 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right tabular-nums" />
                    )}
                    {Array.isArray(kieu) && (
                      <select value={gt ?? ''} onChange={e => datSua(d.khoa, e.target.value)} className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white">
                        <option value="">{d.trangThai === 'tu_tim' ? `Theo app (${d.hienThi})` : kieu[0][1]}</option>
                        {kieu.slice(1).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="text-xs text-gray-600 max-w-[420px]">
                    <p>{d.nguon || '—'}</p>
                    {d.ghiChu.map((g, i) => <p key={i} className="text-amber-700 mt-0.5">• {g}</p>)}
                  </td>
                  <td className="whitespace-nowrap"><ChipMau nhan={gt != null ? 'Đang sửa tạm' : TRANG_THAI_SO[d.trangThai][0]} mau={gt != null ? 'tim' : TRANG_THAI_SO[d.trangThai][1]} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {!rr.docHoaDon
          ? <button type="button" onClick={() => rr.setDocHoaDon(true)} className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-[#8B1A1A] hover:text-[#8B1A1A]">🧾 Đọc hóa đơn XML năm {namSoat} để tìm chi tiền mặt ≥ 5 triệu</button>
          : <span className="text-xs text-gray-500">Đã đọc {hoSo.hoaDon?.length ?? 0} hóa đơn XML trong thư mục năm {namSoat}.</span>}
        <span className="text-[11px] text-gray-400">Một năm có thể vài nghìn file — chỉ đọc khi bấm; lần sau lấy từ bộ nhớ đệm trên máy.</span>
      </div>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">File app đọc được ({hoSo.items.length})</h2>
      <p className="text-xs text-gray-500 mb-2">Năm lấy theo nội dung file, không theo tên thư mục. Bỏ qua {hoSo.boQua} file XML / Excel không phải tờ khai rủi ro (05/KK, thông báo…).</p>
      {hoSo.nen.length > 0 && <Bao mau="amber">{hoSo.nen.length} file nén chưa giải nén (không thấy thư mục cùng tên bên cạnh): {hoSo.nen.map(x => x.split('\\').slice(-2).join('\\')).join(' · ')}</Bao>}
      {hoSo.loi.length > 0 && <Bao mau="red">{hoSo.loi.length} file không đọc được: {hoSo.loi.map(l => `${l.tep.ten} (${l.loi})`).join(' · ')}</Bao>}
      {hoSo.canhBao.map((c, i) => <Bao key={i} mau="amber">{c}</Bao>)}
      <div className="pt-bang overflow-x-auto mb-6">
        <table className="text-sm">
          <thead><tr><th>Năm</th><th>Loại</th><th className="text-right">Số file</th><th>File</th></tr></thead>
          <tbody>
            {theoNam.flatMap(([n, loai], iN) => Object.entries(loai).map(([k, ds], i) => (
              <tr key={n + k} className={iN % 2 ? 'pt-n1' : 'pt-n0'}>
                <td className="font-bold text-gray-800 whitespace-nowrap">{i === 0 ? n : ''}</td>
                <td className="whitespace-nowrap">{TEN_LOAI[k] || k}</td>
                <td className="text-right tabular-nums">{ds.length}</td>
                <td className="text-xs text-gray-500">
                  {ds.slice(0, 6).map((f, j) => <p key={j} className="font-mono truncate max-w-[760px]" title={[...f.duongDan, f.ten].join('\\')}>{f.duongDan.slice(-2).join('\\')}\{f.ten}</p>)}
                  {ds.length > 6 && <p>… và {ds.length - 6} file nữa</p>}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Bảng 39 tiêu chí ─────────────────────────────────────────────────────────────
function maRuiRo(R39, r) { return R39.CODES(r.guide) }
function nguonCua(r) {
  const tep = new Set()
  for (const x of r.refs || []) for (const f of [...(x.src?.files || []), x.src?.file].filter(Boolean)) tep.add(String(f).split('.').pop().toLowerCase())
  return [...tep]
}
function TrangThaiO({ r }) {
  if (r.level === 'missing') return <ChipMau nhan="Thiếu dữ liệu" mau="do" title={(r.missingDocs || []).join('; ')} />
  if (r.level === 'na') return <ChipMau nhan="Không áp dụng" mau="xam" title={r.text} />
  return null
}

function Bang39({ rr, moTieuChi, ctyId }) {
  const { bm, danhGia, namSoat, tuTim, suaNam } = rr
  const { ev, evTruoc } = danhGia
  const [nhom, setNhom] = useState('')
  const [ma, setMa] = useState('')
  const R39 = bm.R39
  const legend = Object.fromEntries((R39.GUIDE_LEGEND || []).map(([m, ten, mo]) => [m, `${ten} — ${mo}`]))
  const truoc = Object.fromEntries((evTruoc?.results || []).map(r => [r.id, r]))
  const loc = r => (!nhom || nhomCua(r) === nhom) && (!ma || maRuiRo(R39, r).includes(ma))
  const doiChieu = ev.results.filter(laDoiChieu)
  const soDu = ev.results.filter(r => !laDoiChieu(r))
  const coSo = r => r.level !== 'missing' && r.level !== 'na'
  const A = doiChieu.filter(loc).sort((a, b) => (coSo(b) - coSo(a)) || ((tyLe(b) ?? -1) - (tyLe(a) ?? -1)))
  const B = soDu.filter(loc)
  const coChenh = doiChieu.filter(r => coSo(r) && r.cl && Math.abs(r.cl) > 0.5).length
  const coPhatSinh = soDu.filter(r => coSo(r) && typeof r.sl1 === 'number' && r.sl1 !== 0).length
  const thieu = ev.results.filter(r => r.level === 'missing')
  const na = ev.results.filter(r => r.level === 'na')
  const canXacNhan = tuTim.bang.filter(d => (d.trangThai === 'can_nhap' || d.trangThai === 'tam') && suaNam[d.khoa] == null)
  const cacMa = [...new Set(ev.results.flatMap(r => maRuiRo(R39, r)))]
  const namHienTai = new Date().getFullYear()

  return (
    <>
      <div className="mb-3 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        ℹ️ <b>Chưa chấm điểm, chưa xếp loại.</b> Savitax chưa chốt ngưỡng nên app chỉ hiện số liệu, chênh lệch và tỷ lệ. Số liệu đọc trực tiếp từ thư mục công ty, app không sửa và không ghi file nào.
        {namSoat >= namHienTai && <> Năm {namSoat} chưa kết thúc — phần lớn tiêu chí cần quyết toán / BCTC năm nên sẽ “thiếu dữ liệu”.</>}
      </div>
      {canXacNhan.length > 0 && (
        <p className="text-xs text-gray-600 mb-3">
          {canXacNhan.length} thông tin bổ sung chưa có trong hồ sơ ({canXacNhan.map(d => d.ten.toLowerCase()).join(', ')}) —{' '}
          <Link href={`/ruirothue/phan-tich?cty=${ctyId}&xem=ho-so`} className="text-[#8B1A1A] font-semibold hover:underline">xem / sửa tạm ở “Hồ sơ đã đọc” →</Link>
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <OTongSinhDong so={ev.results.length} nhan="Tiêu chí" mau="xanhDuong" phu={`Năm ${namSoat}`} />
        <OTongSinhDong so={coChenh} nhan="Đối chiếu có chênh lệch" mau="hoPhach" phu={`trên ${doiChieu.length} tiêu chí đối chiếu`} />
        <OTongSinhDong so={coPhatSinh} nhan="Tiêu chí số dư có phát sinh" mau="tim" phu={`trên ${soDu.length} tiêu chí số dư`} />
        <OTongSinhDong so={thieu.length} nhan="Thiếu dữ liệu" mau="do" phu={thieu.map(r => r.id).join(', ') || 'Đủ dữ liệu'} />
        <OTongSinhDong so={na.length} nhan="Không áp dụng" mau="xam" phu={na.map(r => r.id).join(', ') || '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
        <span className="text-gray-500 mr-1">Nhóm</span>
        {['', ...Object.keys(NHOM)].map(k => (
          <button key={k || 'tat'} type="button" onClick={() => setNhom(k)} className={`px-2 py-0.5 rounded-lg border ${nhom === k ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]' : 'bg-white text-gray-600 border-gray-200'}`}>{k ? NHOM[k] : 'Tất cả'}</button>
        ))}
        <span className="text-gray-500 ml-3 mr-1">Mã rủi ro</span>
        {cacMa.map(m => (
          <button key={m} type="button" onClick={() => setMa(ma === m ? '' : m)} title={legend[m] || ''} className={`px-2 py-0.5 rounded-lg border ${ma === m ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]' : 'bg-white text-gray-600 border-gray-200'}`}>{m}</button>
        ))}
      </div>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">A. {A.length} tiêu chí đối chiếu · sắp theo tỷ lệ chênh lệch lớn nhất</h2>
      <div className="pt-bang overflow-x-auto mb-5">
        <table className="text-sm">
          <thead><tr><th>Mã</th><th>Tiêu chí</th><th className="text-right">SL1</th><th className="text-right">SL2</th><th className="text-right">Chênh lệch SL1 − SL2</th><th>Tỷ lệ chênh lệch</th><th>Nguồn</th></tr></thead>
          <tbody>
            {A.map(r => {
              const t = tyLe(r)
              return (
                <tr key={r.id} onClick={() => moTieuChi(r.id)} className="cursor-pointer">
                  <td className="font-bold text-[#8B1A1A] text-xs whitespace-nowrap">{r.id}</td>
                  <td className="max-w-[420px]"><p className="text-gray-800 leading-snug">{r.name}</p><MaChip ds={maRuiRo(R39, r)} legend={legend} /></td>
                  {coSo(r) ? (
                    <>
                      <td className="text-right tabular-nums whitespace-nowrap">{so(r.sl1)}</td>
                      <td className="text-right tabular-nums whitespace-nowrap">{so(r.sl2)}</td>
                      <td className={`text-right tabular-nums whitespace-nowrap font-semibold ${r.cl && Math.abs(r.cl) > 0.5 ? 'text-gray-900 bg-amber-50/70' : 'text-gray-300'}`}>{r.cl && Math.abs(r.cl) > 0.5 ? so(r.cl) : '0'}</td>
                      <td className="whitespace-nowrap">{t ? <ThanhTyLe t={t} /> : <span className="text-xs text-gray-400">khớp</span>}</td>
                    </>
                  ) : (
                    <td colSpan={4}><TrangThaiO r={r} /> <span className="text-xs text-gray-500">{r.level === 'missing' ? (r.missingDocs || []).join('; ') : ''}</span></td>
                  )}
                  <td className="whitespace-nowrap min-w-[96px]"><NhanDuoi dinhDang={nguonCua(r)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">B. {B.length} tiêu chí số dư · năm {namSoat} so với năm {namSoat - 1}</h2>
      <div className="pt-bang overflow-x-auto mb-3">
        <table className="text-sm">
          <thead><tr><th>Mã</th><th>Tiêu chí</th><th className="text-right">Năm {namSoat}</th><th className="text-right">Năm {namSoat - 1}</th><th className="text-right">Tăng (giảm)</th><th className="text-right">% thay đổi</th></tr></thead>
          <tbody>
            {B.map(r => {
              const t = truoc[r.id]
              const a = typeof r.sl1 === 'number' ? r.sl1 : null, b = t && typeof t.sl1 === 'number' && t.level !== 'missing' ? t.sl1 : null
              const tang = a != null && b != null ? a - b : null
              return (
                <tr key={r.id} onClick={() => moTieuChi(r.id)} className="cursor-pointer">
                  <td className="font-bold text-[#8B1A1A] text-xs whitespace-nowrap">{r.id}</td>
                  <td className="max-w-[460px]"><p className="text-gray-800 leading-snug">{r.name}</p><MaChip ds={maRuiRo(R39, r)} legend={legend} /></td>
                  {coSo(r) ? (
                    <>
                      <td className="text-right tabular-nums whitespace-nowrap font-semibold">{typeof r.sl1 === 'number' ? so(r.sl1) : <span className="text-xs">{String(r.sl1 ?? '—')}</span>}</td>
                      <td className="text-right tabular-nums whitespace-nowrap text-gray-500">{evTruoc ? so(b) : <span className="text-xs text-gray-400">chưa có năm {namSoat - 1}</span>}</td>
                      <td className="text-right tabular-nums whitespace-nowrap">{so(tang)}</td>
                      <td className="text-right tabular-nums whitespace-nowrap text-xs text-gray-600">{tang == null ? '—' : b ? (tang >= 0 ? '+' : '') + (tang / Math.abs(b) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%' : a ? 'mới phát sinh' : '—'}</td>
                    </>
                  ) : (
                    <td colSpan={4}><TrangThaiO r={r} /> <span className="text-xs text-gray-500">{r.level === 'missing' ? (r.missingDocs || []).join('; ') : ''}</span></td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mb-6">Tỷ lệ chênh lệch = |SL1 − SL2| ÷ số lớn hơn. Thanh tỷ lệ chỉ để so độ lớn, không phải đánh giá. Bấm một dòng để xem chi tiết và file nguồn.</p>
    </>
  )
}

function MaChip({ ds, legend }) {
  if (!ds.length) return null
  return <span className="inline-flex flex-wrap gap-1 mt-1">{ds.map(m => <span key={m} title={legend[m] || ''} className="text-[10px] px-1 rounded border border-gray-200 bg-gray-50 text-gray-500">{m}</span>)}</span>
}
function ThanhTyLe({ t }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-xs w-14 text-right">{pt(t)}</span>
      <span className="inline-block w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden"><span className="block h-full bg-slate-500" style={{ width: Math.min(100, Math.max(3, t * 100)) + '%' }} /></span>
    </span>
  )
}

// ── Chi tiết một tiêu chí ───────────────────────────────────────────────────────
function ChiTiet({ rr, maTc, moTieuChi }) {
  const { danhGia, namSoat } = rr
  const { ev, evTruoc } = danhGia
  const ds = ev.results
  const i = Math.max(0, ds.findIndex(r => r.id === maTc))
  const r = ds[i]
  if (!r) return null
  const dc = laDoiChieu(r)
  const t = evTruoc?.results.find(x => x.id === r.id)
  const coSo = r.level !== 'missing' && r.level !== 'na'
  const pts = r.pts || {}
  return (
    <>
      <div className="flex items-start gap-3 mb-3">
        <span className="px-2 py-1 rounded-lg bg-[#8B1A1A] text-white text-xs font-bold">{r.id}</span>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-gray-800 leading-snug">{r.name}</p>
          <p className="text-xs text-gray-500">Nhóm {NHOM[nhomCua(r)] || r.group} · {dc ? 'Đối chiếu: SL1 − SL2' : 'Số dư / giá trị'} · năm {namSoat}</p>
        </div>
        <select value={r.id} onChange={e => moTieuChi(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-xl text-sm bg-white max-w-[260px]">
          {ds.map(x => <option key={x.id} value={x.id}>{x.id} · {x.name.slice(0, 50)}</option>)}
        </select>
        <button type="button" disabled={i === 0} onClick={() => moTieuChi(ds[i - 1].id)} className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm disabled:opacity-30">← {ds[i - 1]?.id || ''}</button>
        <button type="button" disabled={i === ds.length - 1} onClick={() => moTieuChi(ds[i + 1].id)} className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm disabled:opacity-30">{ds[i + 1]?.id || ''} →</button>
      </div>

      {!coSo && <Bao mau={r.level === 'missing' ? 'red' : 'amber'}>{r.level === 'missing' ? `Thiếu dữ liệu: ${(r.missingDocs || []).join('; ')}` : r.text}</Bao>}
      {coSo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {dc ? (
            <>
              <OTongSinhDong so={so(r.sl1)} nhan={'SL1 · ' + (r.sl1Label || '')} mau="xanhDuong" />
              <OTongSinhDong so={so(r.sl2)} nhan={'SL2 · ' + (r.sl2Label || '')} mau="tim" phu={r.sl2Code} />
              <OTongSinhDong so={so(r.cl)} nhan="Chênh lệch SL1 − SL2" mau="hoPhach" />
              <OTongSinhDong so={pt(tyLe(r))} nhan="Tỷ lệ chênh lệch" mau="xam" phu="|SL1 − SL2| ÷ số lớn hơn" />
            </>
          ) : (
            <>
              <OTongSinhDong so={typeof r.sl1 === 'number' ? so(r.sl1) : String(r.sl1 ?? '—')} nhan={`Năm ${namSoat} · ${r.sl1Label || ''}`} mau="xanhDuong" />
              <OTongSinhDong so={t && typeof t.sl1 === 'number' ? so(t.sl1) : '—'} nhan={`Năm ${namSoat - 1}`} mau="xam" phu={t ? '' : 'Chưa có dữ liệu năm trước'} />
            </>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_420px] gap-4 mb-6">
        <div className="space-y-4">
          <Khung tieuDe="Số liệu lấy từ đâu">
            {(r.refs || []).length ? (
              <div className="pt-bang overflow-x-auto">
                <table className="text-xs">
                  <thead><tr><th>Chỉ tiêu</th><th className="text-right">Số</th><th>Nguồn</th></tr></thead>
                  <tbody>
                    {r.refs.map((x, k) => (
                      <tr key={k}>
                        <td className="text-gray-700 min-w-[260px]">{x.src?.text || x.name}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{so(x.value)}</td>
                        <td className="text-gray-500 font-mono">
                          {[...(x.src?.files || []), x.src?.file].filter(Boolean).slice(0, 4).map((f, j) => <p key={j} className="truncate max-w-[420px]" title={f}>{f}{x.src?.sheet ? ` · sheet ${x.src.sheet}` : ''}{x.src?.cell ? ` · ô ${x.src.cell}` : ''}</p>)}
                          {(x.src?.files || []).length > 4 && <p>… và {x.src.files.length - 4} file nữa</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-500">Không có số liệu.</p>}
          </Khung>
          {r.moTa && <Khung tieuDe="Tiêu chí này so gì"><p className="text-sm text-gray-700">{r.moTa}</p>{pts.yNghia && <p className="text-sm text-gray-600 mt-2">{pts.yNghia}</p>}</Khung>}
        </div>
        <div className="space-y-4">
          <DanhSach tieuDe="Nguyên nhân thường gặp" ds={r.causes} />
          <DanhSach tieuDe="Hồ sơ nên chuẩn bị" ds={r.docs} />
          <DanhSach tieuDe="Căn cứ" ds={r.basis} />
        </div>
      </div>
    </>
  )
}
function Khung({ tieuDe, children }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <p className="pt-khung-tieu-de px-4 py-2.5 text-sm font-bold text-gray-800">{tieuDe}</p>
      <div className="p-3">{children}</div>
    </div>
  )
}
function DanhSach({ tieuDe, ds }) {
  if (!ds?.length) return null
  return <Khung tieuDe={tieuDe}><ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">{ds.map((x, i) => <li key={i}>{x}</li>)}</ul></Khung>
}

// ── Nhiều năm ───────────────────────────────────────────────────────────────────
function NhieuNam({ rr, moTieuChi }) {
  const { nhieuNam } = rr
  if (!nhieuNam?.length) return null
  const cacNam = nhieuNam.map(x => x.nam)
  const theoId = nhieuNam[nhieuNam.length - 1].ev.results.map(r => r.id)
  const lay = (n, id) => nhieuNam.find(x => x.nam === n).ev.results.find(r => r.id === id)
  return (
    <>
      <p className="text-xs text-gray-500 mb-2">Đối chiếu: chênh lệch SL1 − SL2 và tỷ lệ. Số dư: số của từng năm. Năm chỉ có tờ khai GTGT thì nhiều tiêu chí là “thiếu dữ liệu”.</p>
      <div className="pt-bang overflow-auto max-h-[calc(100vh-260px)] mb-6">
        <table className="text-sm">
          <thead><tr><th className="sticky left-0 z-[2]">Mã</th><th>Tiêu chí</th>{cacNam.map(n => <th key={n} className="text-right">Năm {n}</th>)}</tr></thead>
          <tbody>
            {theoId.map(id => {
              const goc = lay(cacNam[cacNam.length - 1], id)
              return (
                <tr key={id} onClick={() => moTieuChi(id)} className="cursor-pointer">
                  <td className="font-bold text-[#8B1A1A] text-xs sticky left-0">{id}</td>
                  <td className="max-w-[380px] text-gray-800">{goc.name}</td>
                  {cacNam.map(n => {
                    const r = lay(n, id)
                    if (!r || r.level === 'missing') return <td key={n} className="text-right text-[11px] text-gray-400">thiếu dữ liệu</td>
                    if (r.level === 'na') return <td key={n} className="text-right text-[11px] text-gray-400">không áp dụng</td>
                    if (laDoiChieu(r)) return <td key={n} className="text-right tabular-nums whitespace-nowrap">{so(r.cl)}<p className="text-[10px] text-gray-400">{pt(tyLe(r))}</p></td>
                    return <td key={n} className="text-right tabular-nums whitespace-nowrap">{typeof r.sl1 === 'number' ? so(r.sl1) : <span className="text-xs">{String(r.sl1 ?? '—')}</span>}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
