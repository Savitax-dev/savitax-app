'use client'
// Soát xét báo cáo — màn "Soát xét năm" (kế hoạch GĐ 3, mockup docs/mockup-phan-tich/soat-2 tổng quan, soat-3 kiểm tra, soat-5 chỉ số).
// Bộ máy: lib/soatbaocao (chuyển từ bản offline Check BCTC V3 + 16 chỗ sửa lỗi). CHỈ ĐỌC thư mục, không lưu gì.
// CHƯA CHẤM ĐIỂM: ẩn điểm tin cậy / sức khỏe / Z-score / xếp loại chỉ số và mức nghiêm trọng — chỉ số liệu, chênh lệch, tỷ lệ.
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { TabSoat, ChipMau, KieuBang } from '@/components/phanTich/phanTichUI'
import { useHoSoCty } from '@/components/phanTich/useHoSoCty'
import { useSoatNam } from '@/components/phanTich/useSoatNam'
import ThanhCongTy, { Bao } from '@/components/phanTich/ThanhCongTy'
import { NHOM, NHOM_THEO_MA, gomKetQua, coChenh, xuatExcelSoatNam } from '@/components/phanTich/soatNamChung'
import SoatNamBangKe from '@/components/phanTich/SoatNamBangKe'
import SoatNamNhieuNam from '@/components/phanTich/SoatNamNhieuNam'

const so = n => (n == null || n === '' ? <span className="text-gray-300">—</span> : typeof n === 'number' ? (n < 0 ? `(${Math.round(-n).toLocaleString('vi-VN')})` : Math.round(n).toLocaleString('vi-VN')) : String(n))
const pt = t => (t == null ? '—' : (t * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%')
const ngayVN = s => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : '—')
const MAN = [['tong-quan', 'Tổng quan'], ['kiem-tra', 'Kiểm tra'], ['bang-ke', 'Bảng kê hóa đơn'], ['chi-so', 'Chỉ số tài chính'], ['nhieu-nam', 'Nhiều năm'], ['ho-so', 'Hồ sơ đã đọc']]
const TEN_LOAI = { tk: 'Tờ khai 01/GTGT', kk05: 'Tờ khai 05/KK-TNCN', qt05: 'Quyết toán 05/QTT-TNCN', tndn03: 'Quyết toán 03/TNDN', bctc: 'Báo cáo tài chính', cdps: 'Bảng cân đối tài khoản', nkc: 'Sổ nhật ký chung', sct: 'Sổ chi tiết tài khoản', quy: 'Sổ quỹ tiền mặt', tgnh: 'Sổ tiền gửi ngân hàng', cn131: 'Công nợ phải thu', cn331: 'Công nợ phải trả', nxt: 'Nhập – xuất – tồn', gt: 'Giá thành', hdr: 'Bảng kê hóa đơn bán ra', hdv: 'Bảng kê hóa đơn mua vào', sk: 'Sao kê ngân hàng', luong: 'Bảng lương' }

export default function TrangSoatNam() {
  return <Suspense fallback={null}><SoatNam /></Suspense>
}

function SoatNam() {
  const params = useSearchParams()
  const ctyId = params.get('cty') || ''
  const [man, setMan] = useState(params.get('xem') || 'tong-quan')
  const [nhom, setNhom] = useState('')
  // Tờ khai + bảng kê (đọc theo thư mục năm) chỉ cần cho màn Bảng kê hóa đơn
  const hs = useHoSoCty(ctyId, { chiQuet: man !== 'bang-ke' })
  const sn = useSoatNam(hs)
  const { cty } = hs
  const { hoSo, C, S, nam } = sn
  const gom = useMemo(() => (C ? gomKetQua(C) : null), [C])
  // Năm thư mục (useHoSoCty) đi theo năm đang soát — màn Bảng kê đọc tờ khai, bảng kê của đúng thư mục năm đó
  useEffect(() => { if (nam && hs.quet?.nam?.[nam] && hs.nam !== nam) hs.setNam(nam) }, [nam, hs])

  async function taiExcel() { if (gom) await xuatExcelSoatNam({ cty, nam, gom, C, file: hoSo.file }) }
  const moNhom = m => { setNhom(m); setMan('kiem-tra') }

  const oNam = hoSo?.cacNam?.length > 0 && (
    <>
      <select value={nam ?? ''} onChange={e => sn.setNam(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white font-semibold flex-shrink-0" title="Năm theo nội dung BCTC / tờ khai / sổ đọc được">
        {hoSo.cacNam.map(n => <option key={n} value={n}>Năm {n}</option>)}
      </select>
      {sn.MODELS && (
        <select value={sn.loai} onChange={e => sn.setLoai(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-xl text-sm bg-white flex-shrink-0" title="Loại hình — quyết định các kiểm tra và chỉ số đặc thù ngành">
          {Object.entries(sn.MODELS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
      )}
    </>
  )

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
        <ThanhCongTy hs={hs} duongDan="/soatbaocao/nam" anNamThuMuc oNam={oNam} chuChonCty="Chọn một công ty để soát xét báo cáo năm."
          themTruoc={gom && <button type="button" onClick={taiExcel} className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212] whitespace-nowrap flex-shrink-0">⬇ Tải Excel</button>} />

        {sn.loi && <Bao mau="red">{sn.loi}</Bao>}
        {sn.buoc && !hs.buoc && <p className="text-sm text-gray-500 py-3 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />{sn.buoc}</p>}
        {hoSo && !hoSo.cacNam.length && <Bao mau="amber">Không tìm thấy BCTC, tờ khai hay sổ sách (XML / Excel) nào trong thư mục đã trỏ. Năm cũ (≤ 2025) thì bấm “＋ Năm cũ” và trỏ vào thư mục năm đó.</Bao>}

        {cty && gom && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {MAN.map(([m, ten]) => (
                <button key={m} type="button" onClick={() => setMan(m)} className={`px-3 py-1.5 rounded-xl text-sm border ${man === m ? 'bg-[#8B1A1A] text-white border-[#8B1A1A] font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-[#8B1A1A]'}`}>{ten}</button>
              ))}
              <span className="ml-auto text-[11px] text-gray-400 self-center">Chế độ {S.meta.cheDo?.toUpperCase()} · BCTC {Object.keys(S.v).length} chỉ tiêu · CĐPS {S.tb.length} TK · {S.tk.length} tờ khai GTGT</span>
            </div>
            <div className="mb-3 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
              ℹ️ <b>Chưa chấm điểm, chưa xếp loại.</b> App chỉ hiện số liệu, chênh lệch và tỷ lệ. Số liệu đọc trực tiếp từ thư mục công ty, app không sửa và không ghi file nào.
            </div>
            {man === 'tong-quan' && <TongQuan gom={gom} moNhom={moNhom} />}
            {man === 'kiem-tra' && <KiemTra gom={gom} nhom={nhom} setNhom={setNhom} />}
            {man === 'bang-ke' && <SoatNamBangKe key={nam} hs={hs} nam={nam} cty={cty} />}
            {man === 'chi-so' && <ChiSo C={C} nam={nam} />}
            {man === 'nhieu-nam' && <SoatNamNhieuNam bm={sn.bm} hoSo={hoSo} nam={nam} cty={cty} />}
            {man === 'ho-so' && <HoSo hoSo={hoSo} />}
          </>
        )}
      </div>
    </AppShell>
  )
}

// ── Tổng quan ───────────────────────────────────────────────────────────────────
function TongQuan({ gom, moNhom }) {
  const saiSo = gom.phep.filter(p => coChenh(p) && (p.loai === 'can_doi' || p.ma === 'LK_CDPS' || p.ma === 'LK_BCTC'))
  const lonNhat = gom.phep.filter(p => coChenh(p) && p.tl != null).sort((a, b) => b.tl - a.tl).slice(0, 12)
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {NHOM.map(n => {
          const ph = gom.phep.filter(p => p.nhom === n.ma), chenh = ph.filter(coChenh).length, phat = gom.phatHien.filter(r => r.nhom === n.ma).length
          return (
            <button key={n.ma} type="button" onClick={() => moNhom(n.ma)} className="text-left rounded-2xl bg-white border shadow-sm overflow-hidden hover:shadow flex flex-col justify-start" style={{ borderColor: n.mau + '44' }}>
              <div className="px-4 py-2 text-white text-sm font-bold" style={{ background: n.mau }}>{n.ten}</div>
              <div className="px-4 pt-2 pb-3" style={{ background: `linear-gradient(180deg,${n.mau}10,#fff 70%)` }}>
                <p className="text-[11px] text-gray-500 mb-1.5">{n.mo}</p>
                <div className="flex items-end gap-5">
                  <div><p className="text-2xl font-bold leading-none" style={{ color: n.mau }}>{chenh}</p><p className="text-[11px] text-gray-600 mt-1">phép kiểm có chênh lệch</p></div>
                  <div className="pl-4 border-l border-gray-200"><p className="text-2xl font-bold leading-none text-gray-800">{ph.length}</p><p className="text-[11px] text-gray-600 mt-1">phép đối chiếu</p></div>
                  <div className="pl-4 border-l border-gray-200"><p className="text-2xl font-bold leading-none text-gray-800">{phat}</p><p className="text-[11px] text-gray-600 mt-1">phát hiện</p></div>
                </div>
                {!ph.length && !phat && <p className="text-[11px] text-gray-400 mt-1.5">Chưa có số liệu cho nhóm này trong thư mục</p>}
              </div>
            </button>
          )
        })}
      </div>

      {saiSo.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-5">
          <p className="pt-khung-tieu-de px-4 py-2.5 text-sm font-bold text-gray-800">Số liệu sai (không phụ thuộc ngưỡng) · {saiSo.length}</p>
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0">
            {saiSo.map((p, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-gray-100">
                <div className="flex gap-2"><p className="text-sm text-gray-800 flex-1">{p.ten}{p.ky ? ` (${p.ky})` : ''}</p><p className="text-sm font-semibold text-[#8B1A1A] whitespace-nowrap">lệch {so(p.d)}</p></div>
                <p className="text-xs text-gray-500">{p.la}: {so(p.a)} · {p.lb}: {so(p.b)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Chênh lệch lớn nhất · sắp theo tỷ lệ</h2>
      {lonNhat.length ? <BangPhep ds={lonNhat} coNhom /> : <p className="text-sm text-gray-500 mb-6">Không có phép đối chiếu nào chênh lệch.</p>}
    </>
  )
}

function BangPhep({ ds, coNhom }) {
  return (
    <div className="pt-bang overflow-x-auto mb-6">
      <table className="text-sm">
        <thead><tr>{coNhom && <th>Nhóm</th>}<th>Phép kiểm</th><th className="text-right" title="Số của hồ sơ / chứng từ đang soát — nguồn ghi ngay dưới số">Số cần soát</th><th className="text-right" title="Số đem ra so — nguồn ghi ngay dưới số">Số đối chiếu</th><th className="text-right">Chênh lệch</th><th className="text-right">Tỷ lệ</th><th>Kết quả</th></tr></thead>
        <tbody>
          {ds.map((p, i) => (
            <tr key={i}>
              {coNhom && <td className="text-xs text-gray-600 whitespace-nowrap">{NHOM_THEO_MA[p.nhom]?.ten}</td>}
              <td className="max-w-[460px]"><p className="text-gray-800">{p.ten}{p.ky ? <span className="text-gray-400"> ({p.ky})</span> : null}</p>{p.nhomGoc && <p className="text-[10px] text-gray-400">{p.nhomGoc}</p>}</td>
              <td className="text-right whitespace-nowrap"><p className="tabular-nums">{so(p.a)}</p><p className="text-[10px] text-gray-400">{p.la}</p></td>
              <td className="text-right whitespace-nowrap"><p className="tabular-nums">{so(p.b)}</p><p className="text-[10px] text-gray-400">{p.lb}</p></td>
              <td className={`text-right whitespace-nowrap tabular-nums font-semibold ${coChenh(p) ? 'bg-amber-50/70 text-gray-900' : 'text-gray-300'}`}>{coChenh(p) ? so(p.d) : '0'}</td>
              <td className="text-right tabular-nums text-xs text-gray-600 whitespace-nowrap">{coChenh(p) ? pt(p.tl) : ''}</td>
              <td className="whitespace-nowrap"><ChipMau nhan={p.st === 'fail' ? 'Có chênh lệch' : p.st === 'round' ? 'Lệch làm tròn' : 'Khớp'} mau={p.st === 'fail' ? 'hoPhach' : p.st === 'round' ? 'xanhDuong' : 'xanhLa'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Kiểm tra theo nhóm ──────────────────────────────────────────────────────────
function KiemTra({ gom, nhom, setNhom }) {
  const [mo, setMo] = useState(null)
  const chon = nhom || NHOM.find(n => gom.phep.some(p => p.nhom === n.ma && coChenh(p)) || gom.phatHien.some(r => r.nhom === n.ma))?.ma || 'cd'
  const ph = gom.phep.filter(p => p.nhom === chon).sort((a, b) => coChenh(b) - coChenh(a) || (b.tl ?? 0) - (a.tl ?? 0))
  const phat = gom.phatHien.filter(r => r.nhom === chon)
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {NHOM.map(n => {
          const c = gom.phep.filter(p => p.nhom === n.ma && coChenh(p)).length + gom.phatHien.filter(r => r.nhom === n.ma).length
          return <button key={n.ma} type="button" onClick={() => { setNhom(n.ma); setMo(null) }} className={`px-3 py-1 rounded-full text-xs border ${chon === n.ma ? 'text-white font-semibold' : 'bg-white text-gray-600 border-gray-200'}`} style={chon === n.ma ? { background: n.mau, borderColor: n.mau } : {}}>{n.ten}{c ? ` · ${c}` : ''}</button>
        })}
      </div>
      <div className="grid xl:grid-cols-[1fr_440px] gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4" style={{ borderColor: NHOM_THEO_MA[chon].mau }}>{NHOM_THEO_MA[chon].ten} · {ph.length} phép đối chiếu</h2>
          {ph.length ? <BangPhep ds={ph} /> : <p className="text-sm text-gray-500 mb-6">Nhóm này chưa có phép đối chiếu nào — thư mục chưa có tài liệu cần thiết (xem “Hồ sơ đã đọc”).</p>}
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4" style={{ borderColor: NHOM_THEO_MA[chon].mau }}>Phát hiện · {phat.length}</h2>
          {!phat.length && <p className="text-sm text-gray-500">Không có phát hiện.</p>}
          <div className="space-y-3 mb-6">
            {phat.map((r, i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3">
                <p className="text-sm font-bold text-gray-800">{r.t}</p>
                {r.d && <p className="text-xs text-gray-600 mt-0.5">{r.d}</p>}
                {r.kn && <p className="text-xs text-gray-700 mt-1.5"><b>Hướng xử lý:</b> {r.kn}</p>}
                {r.cb && <p className="text-[11px] text-gray-500 mt-1"><b>Căn cứ:</b> {r.cb}</p>}
                {(r.items || []).length > 0 && (
                  <>
                    <button type="button" onClick={() => setMo(mo === i ? null : i)} className="mt-1.5 text-[11px] text-[#8B1A1A] font-semibold hover:underline">{mo === i ? 'Ẩn' : 'Xem'} {r.items.length} chứng từ / hóa đơn</button>
                    {mo === i && (
                      <div className="pt-bang overflow-auto max-h-[320px] mt-2">
                        <table className="text-xs">
                          <thead><tr><th>Ngày</th><th>Số</th><th>Diễn giải</th><th className="text-right">Số tiền</th></tr></thead>
                          <tbody>{r.items.slice(0, 200).map((x, j) => <tr key={j}><td className="whitespace-nowrap tabular-nums">{ngayVN(x.d)}</td><td className="font-mono whitespace-nowrap">{x.so || '—'}</td><td>{x.dg}{x.tk ? <span className="text-gray-400"> · {x.tk}/{x.du}</span> : null}</td><td className="text-right tabular-nums whitespace-nowrap">{so(x.amt)}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Chỉ số tài chính — chỉ giá trị, chưa so ngưỡng ngành ──────────────────────────
function ChiSo({ C, nam }) {
  const dv = u => (u === '%' ? '%' : u === 'd' ? 'ngày' : u === 'x' || u === 'lần' ? 'lần' : u || '')
  const so2 = (x, u) => (x == null ? '—' : (u === '%' ? x.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('vi-VN') : x.toLocaleString('vi-VN', { maximumFractionDigits: 2 })))
  return (
    <>
      <p className="text-xs text-gray-500 mb-2">35 chỉ số chỉ hiện giá trị năm {nam} và năm {nam - 1}, chưa so ngưỡng ngành (chưa chốt ngưỡng).</p>
      <div className="pt-bang overflow-x-auto mb-5">
        <table className="text-sm">
          <thead><tr><th>Mã</th><th>Chỉ số</th><th className="text-right">Năm {nam}</th><th className="text-right">Năm {nam - 1}</th><th>Đơn vị</th><th>Công thức</th></tr></thead>
          <tbody>
            {(C.Rt || []).map(r => (
              <tr key={r.id}>
                <td className="font-bold text-[#8B1A1A] text-xs whitespace-nowrap">{r.id}</td>
                <td className="text-gray-800">{r.n}{r.na ? <span className="text-[11px] text-gray-400"> · {r.na}</span> : null}</td>
                <td className="text-right tabular-nums font-semibold whitespace-nowrap">{so2(r.t, r.u)}</td>
                <td className="text-right tabular-nums text-gray-500 whitespace-nowrap">{so2(r.p, r.u)}</td>
                <td className="text-xs text-gray-500 whitespace-nowrap">{dv(r.u)}</td>
                <td className="text-[11px] text-gray-500 font-mono">{r.xf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(C.K || []).length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-800 mb-1 pl-2 border-l-4 border-[#8B1A1A]">Chỉ số đặc thù theo loại hình</h2>
          <div className="pt-bang overflow-x-auto mb-6">
            <table className="text-sm">
              <thead><tr><th>Chỉ số</th><th className="text-right">Năm {nam}</th><th>Đơn vị</th><th>Ý nghĩa</th></tr></thead>
              <tbody>{C.K.map((k, i) => <tr key={i}><td className="text-gray-800">{k.n}</td><td className="text-right tabular-nums font-semibold">{so2(k.x, k.u)}</td><td className="text-xs text-gray-500">{dv(k.u)}</td><td className="text-xs text-gray-600">{k.m}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ── Hồ sơ đã đọc ────────────────────────────────────────────────────────────────
function HoSo({ hoSo }) {
  const theoNam = {}
  for (const f of hoSo.file) ((theoNam[f.nam] = theoNam[f.nam] || {})[f.kind] = theoNam[f.nam][f.kind] || []).push(f)
  const ds = Object.entries(theoNam).sort((a, b) => b[0] - a[0])
  return (
    <>
      <p className="text-xs text-gray-500 mb-2">Năm và loại tài liệu nhận theo NỘI DUNG file (tiêu đề, cột, mã tờ khai), không theo tên thư mục. Bỏ qua {hoSo.boQua} file / sheet không nhận ra, thông báo của cơ quan thuế, hóa đơn lẻ. Chưa đọc PDF, ảnh.</p>
      {hoSo.loi.length > 0 && <Bao mau="red">{hoSo.loi.length} file không đọc được: {hoSo.loi.map(l => `${l.tep.ten} (${l.loi})`).join(' · ')}</Bao>}
      {hoSo.canhBao.map((c, i) => <Bao key={i} mau="amber">{c}</Bao>)}
      <div className="pt-bang overflow-x-auto mb-6">
        <table className="text-sm">
          <thead><tr><th>Năm</th><th>Loại</th><th className="text-right">Số file</th><th>File · nội dung đọc được</th></tr></thead>
          <tbody>
            {ds.flatMap(([n, loai], iN) => Object.entries(loai).map(([k, fs], i) => (
              <tr key={n + k} className={iN % 2 ? 'pt-n1' : 'pt-n0'}>
                <td className="font-bold text-gray-800">{i === 0 ? n : ''}</td>
                <td className="whitespace-nowrap">{TEN_LOAI[k] || k}</td>
                <td className="text-right tabular-nums">{fs.length}</td>
                <td className="text-xs text-gray-500">{fs.slice(0, 6).map((f, j) => <p key={j} className="truncate max-w-[820px]" title={[...(f.duongDan || []), f.ten].join('\\')}><span className="font-mono">{f.ten}</span> · {f.note}</p>)}{fs.length > 6 && <p>… và {fs.length - 6} file nữa</p>}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mb-6">Muốn soát đủ các nhóm: cần BCTC (XML / Excel), bảng cân đối tài khoản, sổ nhật ký chung / sổ chi tiết, sổ quỹ, sổ tiền gửi, sao kê, bảng kê hóa đơn, bảng lương, tờ khai các kỳ và quyết toán. <Link href="/soatbaocao/ho-so" className="text-[#8B1A1A] hover:underline">Xem kiểm kê thư mục →</Link></p>
    </>
  )
}
