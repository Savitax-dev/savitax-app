'use client'
// Rủi ro thuế → 🔎 Tra cứu NCC: danh sách hóa đơn mua vào + trạng thái MST người bán (anh duyệt 19/11/2026).
// Lõi + lý do chọn nguồn: lib/phanTich/traNcc.js. Hai đường tra:
//   - Tra hàng loạt: VietQR, trình duyệt gọi thẳng, không mã xác nhận (chạy cả bản rời).
//   - Tra chính xác: tracuunnt.gdt.gov.vn qua tiện ích Chrome 1.3, NHÂN VIÊN TỰ GÕ mã xác nhận — có CQT quản lý.
// CHỈ ĐỌC thư mục như các màn khác; kết quả tra nhớ trên máy (IndexedDB), không lưu lên máy chủ.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { TabRuiRo, OTongSinhDong, ChipMau, KieuBang } from '@/components/phanTich/phanTichUI'
import { useHoSoCty, docExcelBuf } from '@/components/phanTich/useHoSoCty'
import ThanhCongTy, { Bao } from '@/components/phanTich/ThanhCongTy'
import { tepBangKeCuaNam } from '@/lib/phanTich/docHoSo'
import { docBangKe } from '@/lib/phanTich/doc/bangKe'
import { goiYTheoTen } from '@/lib/phanTich/thuMuc'
import { layDem, ghiDem } from '@/lib/phanTich/khoMay'
import { kiemTraTienIch, goiCong } from '@/lib/portalBridge'
import * as N from '@/lib/phanTich/traNcc'
import { soExcelMoi, themSheetMang, taiVeExcel } from '@/lib/excelDep'

const MAU_MUC = { tot: 'xanhLa', canh_bao: 'hoPhach', xau: 'do', khong_ro: 'xam' }
const tien = n => (n ? Math.round(n).toLocaleString('vi-VN') : '—')
const ngayVn = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')
const ngu = ms => new Promise(r => setTimeout(r, ms))

export default function TrangTraCuuNcc() {
  return <Suspense fallback={null}><TraCuuNcc /></Suspense>
}

function TraCuuNcc() {
  const params = useSearchParams()
  const ctyId = params.get('cty') || ''
  const hs = useHoSoCty(ctyId, { chiQuet: true })
  const { cty, qn, nam } = hs

  const [hoaDon, setHoaDon] = useState(null)        // null = chưa nạp
  const [nguon, setNguon] = useState('')
  const [baoDoc, setBaoDoc] = useState([])
  const [dangDoc, setDangDoc] = useState('')
  const [ketQua, setKetQua] = useState(() => new Map())   // mst → { vietqr, gdt }
  const [chay, setChay] = useState(null)              // { xong, tong } khi đang tra hàng loạt
  const huy = useRef(false)
  const [loc, setLoc] = useState('tat')
  const [chon, setChon] = useState(() => new Set())   // MST tick để tra chính xác theo lượt (anh yêu cầu 21/11/2026)
  const [tienIch, setTienIch] = useState(null)
  const tienIchRef = useRef(null)                     // layMa đọc bản MỚI NHẤT (sau "Kiểm lại tiện ích"), không đọc bản cũ trong closure
  useEffect(() => { tienIchRef.current = tienIch }, [tienIch])
  const [maXn, setMaXn] = useState(null)              // hộp gõ mã xác nhận
  const oMa = useRef(null)
  useEffect(() => { if (maXn?.anh && !maXn.dang) oMa.current?.focus() }, [maXn?.anh, maXn?.dang])

  const kiemTienIch = () => kiemTraTienIch().then(setTienIch).catch(e => setTienIch({ co: false, loi: String(e?.message || e) }))
  useEffect(() => { kiemTienIch() }, [])
  const coTraChinhXac = !!(tienIch?.co && tienIch.traNnt)
  // Bản chạy riêng trên máy (banRoi/shim/portalBridge.js) không bao giờ có tiện ích → ẩn hẳn nút; trong app thì nút LUÔN hiện,
  // tiện ích chưa đúng bản thì bấm vào ra hướng dẫn (anh 20/11/2026: "chưa thấy mục tra chính xác" khi tiện ích còn bản cũ).
  const banRoi = /Bản chạy riêng/.test(tienIch?.loi || '')

  // Đổi công ty / năm thì bỏ danh sách đang xem (danh sách tải file lên thì giữ)
  useEffect(() => { if (nguon.startsWith('📂')) { setHoaDon(null); setNguon(''); setBaoDoc([]) } }, [ctyId, nam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setChon(new Set()) }, [hoaDon])      // danh sách mới → bỏ hết tick
  const { ncc, thieuMst } = useMemo(() => (hoaDon ? N.gomNcc(hoaDon) : { ncc: [], thieuMst: [] }), [hoaDon])

  // Nạp kết quả đã tra (trên máy) cho danh sách NCC mới
  useEffect(() => {
    if (!ncc.length) return
    let bo = false
    ;(async () => {
      const m = new Map()
      for (const n of ncc) m.set(n.mst, { vietqr: await layDem(N.khoaVietQR(n.mst)), gdt: await layDem(N.khoaCqt(n.mst)) })
      if (!bo) setKetQua(m)
    })()
    return () => { bo = true }
  }, [ncc])

  const ghiKq = (mst, loai, kq) => setKetQua(cu => { const m = new Map(cu); m.set(mst, { ...(m.get(mst) || {}), [loai]: kq }); return m })
  const kqGop = mst => { const k = ketQua.get(mst) || {}; return N.ketQuaNcc(k.vietqr, k.gdt) }

  // ── Nạp hóa đơn ──
  async function hoaDonTuFile(f, ten, chieuGoiY) {
    const sheets = docBangKe(await docExcelBuf(await f.arrayBuffer()), { chieu: chieuGoiY || null, mstCty: hs.mstCty || '' })
    return N.hoaDonMuaVaoTuSheet(sheets, { tenFile: ten })
  }
  async function napThuMuc() {
    if (!qn) return
    const tatCa = tepBangKeCuaNam(qn)
    // Bảng kê CỔNG ở mục 2 là danh sách đủ nhất; không có thì dùng bảng kê kèm tờ khai ở mục 7
    const ds = tatCa.some(x => !x.boBaoCao) ? tatCa.filter(x => !x.boBaoCao) : tatCa
    const bao = [], gom = []
    for (let i = 0; i < ds.length; i++) {
      const { tep } = ds[i]
      setDangDoc(`Đang đọc ${i + 1}/${ds.length}: ${tep.ten}`)
      try { gom.push(...await hoaDonTuFile(await tep.tay.getFile(), tep.ten, tep.goiY?.chieu)) } catch (e) { bao.push(`${tep.ten}: ${e?.message || e}`) }
    }
    setDangDoc('')
    const hd = N.boTrungHoaDon(gom)
    if (!hd.length) bao.push(`Không thấy hóa đơn mua vào trong ${ds.length} file bảng kê của năm ${nam} (mục 2${ds.some(x => x.boBaoCao) ? ' / mục 7' : ''}). Tải file danh sách hóa đơn lên ở bên phải.`)
    setBaoDoc(bao); setHoaDon(hd); setNguon(`📂 Thư mục ${cty?.maKH || ''} · năm ${nam} · ${ds.length} file bảng kê`)
  }
  async function napFile(files) {
    if (!files?.length) return
    const bao = [], gom = []
    for (const f of files) {
      setDangDoc('Đang đọc ' + f.name)
      try { gom.push(...await hoaDonTuFile(f, f.name, goiYTheoTen(f.name)?.chieu || 'mua_vao')) } catch (e) { bao.push(`${f.name}: ${e?.message || e}`) }
    }
    setDangDoc('')
    const hd = N.boTrungHoaDon(gom)
    if (!hd.length) bao.push('Không thấy hóa đơn mua vào trong file — cần file bảng kê / danh sách hóa đơn có cột MST người bán, số hóa đơn, ngày.')
    setBaoDoc(bao); setHoaDon(hd); setNguon(`📤 ${files.length === 1 ? files[0].name : files.length + ' file tải lên'}`)
  }

  // ── Tra hàng loạt (VietQR) ──
  async function traHangLoat({ ca = false } = {}) {
    const can = ncc.filter(n => ca || !N.conHan(ketQua.get(n.mst)?.vietqr, N.HAN_VIETQR_NGAY))
    if (!can.length) return
    huy.current = false
    setChay({ xong: 0, tong: can.length })
    // Ngủ từng giây để bấm Dừng có tác dụng ngay cả lúc đang chờ VietQR mở khoá
    const choDem = async ms => { for (let con = ms; con > 0 && !huy.current; con -= 1000) { setChay(c => c && { ...c, choDen: Date.now() + con }); await ngu(Math.min(1000, con)) } setChay(c => c && { ...c, choDen: 0 }) }
    for (let i = 0; i < can.length; i++) {
      if (huy.current) break
      const kq = await N.traVietQR(can[i].mst, { huy: () => huy.current })
      if (kq.loai === 'bi_chan') {                         // bị khoá: chờ rồi tra lại ĐÚNG MST này, không ghi lỗi vào dòng
        await choDem(Math.max((kq.choGiay || 0) * 1000, N.CHO_KHI_CHAN_MS))
        i--; continue
      }
      if (kq.loai !== 'loi') await ghiDem(N.khoaVietQR(can[i].mst), kq)
      ghiKq(can[i].mst, 'vietqr', kq)
      setChay(c => ({ ...c, xong: i + 1, tong: can.length }))
      await ngu(N.NHIP_VIETQR_MS)
    }
    setChay(null)
  }

  // ── Tra chính xác (tracuunnt, gõ mã) ──
  async function layMa(mst, ten, tiep = [], bao = '') {
    const ti = tienIchRef.current
    if (!(ti?.co && ti.traNnt)) { setMaXn({ mst, ten, tiep, thieuTienIch: true }); return }
    setMaXn({ mst, ten, tiep, anh: '', ma: '', bao, dang: true })
    if (!tienIch?.daMoTrang) {                             // lần đầu: mở trang để cổng cấp phiên (cookie) cho mã xác nhận
      await goiCong(N.yeuCauMoTrang())
      setTienIch(t => ({ ...t, daMoTrang: true }))
    }
    const r = await goiCong(N.yeuCauCaptcha())
    if (!r.ok || !r.laNhiPhan) { setMaXn(x => x && { ...x, dang: false, bao: 'Không lấy được mã xác nhận: ' + (r.loi || 'cổng trả về lạ') }); return }
    setMaXn(x => x && { ...x, dang: false, anh: `data:${r.kieu || 'image/png'};base64,${r.noiDung}`, ma: '' })
  }
  async function guiMa() {
    const x = maXn
    if (!x?.ma?.trim()) return
    setMaXn({ ...x, dang: true, bao: '' })
    const r = await goiCong(N.yeuCauTra(x.mst.slice(0, 10), x.ma))
    if (!r.ok) { setMaXn({ ...x, dang: false, bao: 'Không gửi được: ' + (r.loi || '') }); return }
    const kq = N.docKetQuaTcnnt(r.noiDung)
    if (kq.loai === 'sai_ma' || kq.loai === 'khong_doc_duoc') {
      await layMa(x.mst, x.ten, x.tiep, kq.loai === 'sai_ma' ? 'Mã xác nhận sai hoặc cổng không trả kết quả — gõ mã mới.' : 'Không đọc được trang kết quả — gõ mã mới để thử lại.')
      return
    }
    const luc = new Date().toISOString()
    const d = kq.loai === 'ok' ? N.chonDongTcnnt(kq.dong, x.mst) : null
    const ghi = d ? { loai: 'ok', trangThai: d.trangThai, cqt: d.cqt, ten: d.ten, dc: d.dc, luc } : { loai: 'ok', trangThai: 'Không tìm thấy MST trên trang tra cứu Cục Thuế', cqt: '', luc }
    await ghiDem(N.khoaCqt(x.mst), ghi)
    ghiKq(x.mst, 'gdt', ghi)
    setChon(c => { if (!c.has(x.mst)) return c; const m = new Set(c); m.delete(x.mst); return m })
    const [ke, ...con] = x.tiep
    if (ke) await layMa(ke.mst, ke.ten, con)
    else setMaXn(null)
  }
  // Tra chính xác các MST đã tick, lần lượt: gõ mã → Enter → tự sang MST kế. Tra xong MST nào thì bỏ tick MST đó.
  const traChinhXacDaChon = () => {
    const ds = ncc.filter(n => chon.has(n.mst))
    if (ds.length) layMa(ds[0].mst, ds[0].ten, ds.slice(1))
  }
  const doiChon = mst => setChon(c => { const m = new Set(c); m.has(mst) ? m.delete(mst) : m.add(mst); return m })
  const traChinhXacRuiRo = () => {
    const ds = ncc.filter(n => ['xau', 'canh_bao'].includes(kqGop(n.mst).muc) && !N.conHan(ketQua.get(n.mst)?.gdt, N.HAN_CQT_NGAY))
    if (ds.length) layMa(ds[0].mst, ds[0].ten, ds.slice(1))
  }

  async function xuatExcel() {
    const m = new Map(ncc.map(n => [n.mst, kqGop(n.mst)]))
    const { hd, nb } = N.hangExcelNcc({ tenCty: cty ? `${cty.maKH} · ${cty.ten}` : '', hoaDon, ncc, ketQua: m })
    const wb = await soExcelMoi()
    themSheetMang(wb, 'Hóa đơn mua vào', hd, { doRong: [6, 12, 10, 12, 16, 40, 16, 14, 40, 14, 34, 30], cotTien: [6, 7] })
    themSheetMang(wb, 'Người bán', nb, { doRong: [6, 16, 40, 8, 16, 14, 12, 12, 40, 14, 34, 30], cotTien: [4, 5] })
    await taiVeExcel(wb, `TraCuuNCC_${cty?.maKH || 'DanhSach'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const dem = useMemo(() => {
    const d = { tot: 0, canh_bao: 0, xau: 0, khong_ro: 0 }
    for (const n of ncc) d[kqGop(n.mst).muc]++
    return d
  }, [ncc, ketQua]) // eslint-disable-line react-hooks/exhaustive-deps
  const dsHien = ncc.filter(n => loc === 'tat' || (loc === 'chua' ? kqGop(n.mst).muc === 'khong_ro' : kqGop(n.mst).muc === loc))
  const soRuiRoChuaTraCx = ncc.filter(n => ['xau', 'canh_bao'].includes(kqGop(n.mst).muc) && !N.conHan(ketQua.get(n.mst)?.gdt, N.HAN_CQT_NGAY)).length
  const nut = 'px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-40'

  return (
    <AppShell>
      <KieuBang />
      <div className="p-4 md:p-6 w-full">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⚖️</span>
          <h1 className="text-xl font-bold text-gray-800">Rủi ro thuế</h1>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">🔒 Chỉ đọc thư mục — kết quả tra nhớ trên máy này</span>
        </div>
        <TabRuiRo giuCty={ctyId} xem="ncc" />
        <ThanhCongTy hs={hs} duongDan="/ruirothue/tra-cuu-ncc" chuChonCty="Chọn công ty để lấy bảng kê mua vào trong thư mục — hoặc tải file danh sách hóa đơn lên ở dưới." />

        <div className="grid gap-3 md:grid-cols-2 mb-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-bold text-gray-800">📂 Lấy từ thư mục công ty</p>
            <p className="text-sm text-gray-500 my-1.5">Bảng kê mua vào ở mục <b>2. HÓA ĐƠN MUA VÀO_BÁN RA</b> (bảng kê tải từ cổng HĐĐT) của năm đang chọn; không có thì lấy bảng kê kèm tờ khai ở mục 7.</p>
            <button type="button" className={nut + ' text-white bg-[#8B1A1A] hover:bg-[#6B1212]'} disabled={!qn || !!dangDoc} onClick={napThuMuc}>
              Đọc bảng kê năm {nam || '…'}
            </button>
            {!qn && <span className="ml-2 text-xs text-gray-400">Chọn công ty đã trỏ thư mục trước.</span>}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-bold text-gray-800">📤 Tải file danh sách hóa đơn mua vào</p>
            <p className="text-sm text-gray-500 my-1.5">File Excel bảng kê / danh sách tổng hợp hóa đơn đầu vào (tải từ cổng hóa đơn điện tử hoặc xuất từ phần mềm). Chọn được nhiều file.</p>
            <label className={nut + ' inline-block cursor-pointer border border-[#8B1A1A] text-[#8B1A1A] hover:bg-[#fdf1f1]'}>
              Chọn file Excel
              <input type="file" accept=".xlsx,.xls" multiple hidden disabled={!!dangDoc} onChange={e => { napFile([...e.target.files]); e.target.value = '' }} />
            </label>
          </div>
        </div>

        {dangDoc && <p className="text-sm text-gray-500 py-2 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />{dangDoc}</p>}
        {baoDoc.map((b, i) => <Bao key={i} mau="amber">{b}</Bao>)}

        {hoaDon && hoaDon.length > 0 && (
          <>
            <p className="text-sm text-gray-600 mb-2">Nguồn: <b>{nguon}</b></p>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-3">
              <OTongSinhDong so={hoaDon.length} nhan="Hóa đơn mua vào" mau="xanhDuong" />
              <OTongSinhDong so={ncc.length} nhan="Người bán (MST)" mau="tim" />
              <OTongSinhDong so={dem.xau} nhan="Rủi ro" mau="do" phu="Không hoạt động tại địa chỉ, ngừng hoạt động, chuyển công an…" />
              <OTongSinhDong so={dem.canh_bao} nhan="Cần xem" mau="hoPhach" phu="Tạm ngừng kinh doanh, đã chuyển cơ quan thuế" />
              <OTongSinhDong so={dem.tot} nhan="Đang hoạt động" mau="xanhLa" />
              <OTongSinhDong so={dem.khong_ro + thieuMst.length} nhan="Chưa tra / thiếu MST" mau="xam" phu={thieuMst.length ? `${thieuMst.length} dòng hóa đơn không có / sai dạng MST người bán` : ''} />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {!chay ? (
                <>
                  <button type="button" className={nut + ' text-white bg-[#8B1A1A] hover:bg-[#6B1212]'} onClick={() => traHangLoat()} disabled={!!maXn}>
                    ▶ Tra hàng loạt (VietQR){dem.khong_ro ? ` · ${dem.khong_ro} chưa tra` : ''}
                  </button>
                  <button type="button" className={nut + ' border border-gray-300 text-gray-700 hover:bg-gray-50'} onClick={() => traHangLoat({ ca: true })} disabled={!!maXn}>↻ Tra lại tất cả</button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-700 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />
                    {chay.choDen > Date.now()
                      ? <>Đã tra {chay.xong}/{chay.tong} — VietQR tạm khoá lượt tra miễn phí, tự tra tiếp sau <b className="tabular-nums">{Math.floor((chay.choDen - Date.now()) / 60000)}:{String(Math.floor((chay.choDen - Date.now()) / 1000) % 60).padStart(2, '0')}</b>. Để trang mở là được.</>
                      : <>Đang tra {chay.xong}/{chay.tong} (không bị khoá thì khoảng {Math.ceil((chay.tong - chay.xong) * (N.NHIP_VIETQR_MS + 500) / 60000)} phút)</>}
                  </span>
                  <button type="button" className={nut + ' border border-gray-300 text-gray-700'} onClick={() => { huy.current = true }}>Dừng</button>
                </>
              )}
              {!banRoi && chon.size > 0 && !chay && (
                <>
                  <button type="button" className={nut + ' text-white bg-[#8B1A1A] hover:bg-[#6B1212]'} onClick={traChinhXacDaChon} disabled={!!maXn}>🔐 Tra chính xác {chon.size} MST đã chọn</button>
                  <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setChon(new Set())}>Bỏ chọn</button>
                </>
              )}
              {!banRoi && soRuiRoChuaTraCx > 0 && !chay && (
                <button type="button" className={nut + ' text-white bg-amber-600 hover:bg-amber-700'} onClick={traChinhXacRuiRo} disabled={!!maXn}>🔐 Tra chính xác {soRuiRoChuaTraCx} NCC rủi ro / cần xem</button>
              )}
              <button type="button" className={nut + ' ml-auto text-white bg-emerald-700 hover:bg-emerald-800'} onClick={xuatExcel}>⬇ Xuất Excel</button>
            </div>
            {tienIch && (
              <p className="text-xs text-gray-500 mb-2">
                {banRoi ? 'Bản chạy riêng không có “Tra chính xác” (cần tiện ích Chrome) — cần CQT quản lý thì tra tay ở tracuunnt.gdt.gov.vn.'
                  : coTraChinhXac ? `✅ Tiện ích Chrome bản ${tienIch.phienBan} — dùng được “🔐 Tra chính xác” (trang Cục Thuế, có CQT quản lý).`
                  : tienIch.co && /^1\.([3-9]|\d\d)/.test(tienIch.phienBan || '') ? `⚠ Tiện ích báo bản ${tienIch.phienBan} nhưng Chrome vẫn chạy MÃ NỀN CŨ (thiếu file background.js mới) — bấm nút ở một dòng để xem cách sửa.`
                  : tienIch.co ? `⚠ Tiện ích Chrome đang là bản ${tienIch.phienBan} — cần bản 1.3 để “🔐 Tra chính xác”. Bấm nút ở một dòng để xem cách cập nhật.`
                  : `⚠ Chưa nhận được tiện ích Chrome (${tienIch.loi || 'không phản hồi'}) — bấm “🔐 Tra chính xác” ở một dòng để xem cách cài.`}
              </p>
            )}

            <div className="flex gap-1.5 mb-2 text-sm">
              {[['tat', `Tất cả ${ncc.length}`], ['xau', `Rủi ro ${dem.xau}`], ['canh_bao', `Cần xem ${dem.canh_bao}`], ['chua', `Chưa tra ${dem.khong_ro}`]].map(([k, t]) => (
                <button key={k} type="button" onClick={() => setLoc(k)} className={'px-3 py-1 rounded-lg border ' + (loc === k ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>{t}</button>
              ))}
            </div>
            <div className="pt-bang overflow-auto max-h-[70vh]">
              <table>
                <thead><tr>{!banRoi && <th className="w-8" title="Chọn để tra chính xác (gõ mã) theo lượt"><input type="checkbox" className="accent-white cursor-pointer"
                  checked={dsHien.length > 0 && dsHien.every(n => chon.has(n.mst))}
                  onChange={e => setChon(c => { const m = new Set(c); for (const n of dsHien) e.target.checked ? m.add(n.mst) : m.delete(n.mst); return m })} /></th>}<th>#</th><th>MST người bán</th><th className="text-left">Tên người bán</th><th>Số HĐ</th><th>Tiền chưa thuế</th><th className="text-left">Trạng thái MST</th><th className="text-left">CQT quản lý</th><th className="text-left">Nguồn / ngày tra</th><th></th></tr></thead>
                <tbody>
                  {dsHien.map((n, i) => {
                    const k = kqGop(n.mst)
                    return (
                      <tr key={n.mst} className={chon.has(n.mst) ? 'bg-amber-50' : ''}>
                        {!banRoi && <td className="text-center"><input type="checkbox" className="accent-[#8B1A1A] cursor-pointer" checked={chon.has(n.mst)} onChange={() => doiChon(n.mst)} /></td>}
                        <td className="text-center text-gray-400">{i + 1}</td>
                        <td className="font-mono text-[13px] whitespace-nowrap">{n.mst}</td>
                        <td className="min-w-[220px]">{n.ten}<div className="text-[11px] text-gray-400">{ngayVn(n.tuNgay)}{n.denNgay !== n.tuNgay ? ' – ' + ngayVn(n.denNgay) : ''}</div></td>
                        <td className="text-center tabular-nums">{n.soHd}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{tien(n.tien)}</td>
                        <td className="min-w-[200px]">{k.trangThai ? <ChipMau nhan={k.trangThai} mau={MAU_MUC[k.muc]} /> : <span className="text-gray-300">—</span>}</td>
                        <td className="min-w-[160px] text-sm">{k.cqt || <span className="text-gray-300">—</span>}</td>
                        <td className="text-[11px] text-gray-500 min-w-[150px]">{k.nguon}</td>
                        <td className="whitespace-nowrap text-xs">
                          {!banRoi && <button type="button" className="text-[#8B1A1A] font-semibold hover:underline mr-2" disabled={!!maXn || !!chay} onClick={() => layMa(n.mst, n.ten)}>🔐 Tra chính xác</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {thieuMst.length > 0 && (
              <details className="mt-3 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-gray-700">{thieuMst.length} dòng hóa đơn không có MST người bán hoặc MST sai dạng (không phải 10 / 13 số) — không tra được</summary>
                <ul className="mt-2 space-y-0.5 text-gray-600">{thieuMst.slice(0, 200).map((h, i) => <li key={i}>{h.kyHieu} số {h.so} · {ngayVn(h.ngay)} · {h.ten || '(không tên)'}{h.mstGoc ? <> · MST ghi <span className="font-mono">“{h.mstGoc}”</span></> : ''} · {tien(h.tienChuaThue)} — {h.nguon}</li>)}</ul>
              </details>
            )}
            <p className="text-[11px] text-gray-400 mt-3">VietQR tổng hợp từ trang Cục Thuế, thường trễ 1–2 tuần, không có CQT quản lý. “Tra chính xác” lấy thẳng từ tracuunnt.gdt.gov.vn tại lúc tra. Kết quả nhớ trên máy: VietQR {N.HAN_VIETQR_NGAY} ngày, tra chính xác {N.HAN_CQT_NGAY} ngày.</p>
          </>
        )}
      </div>

      {maXn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget && !maXn.dang) setMaXn(null) }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-bold text-gray-800">🔐 Tra chính xác — trang Cục Thuế</p>
            <p className="text-sm text-gray-600 mt-1"><span className="font-mono">{maXn.mst}</span> · {maXn.ten}</p>
            {maXn.thieuTienIch ? (
              <div className="mt-3 text-sm text-gray-700 space-y-2">
                <p className="text-amber-700 font-semibold">{tienIch?.co && /^1\.([3-9]|\d\d)/.test(tienIch.phienBan || '') ? `Tiện ích báo bản ${tienIch.phienBan} nhưng Chrome vẫn chạy mã nền cũ: thư mục tiện ích có manifest.json mới mà background.js còn bản cũ, hoặc Chrome chưa nạp lại.`
                  : tienIch?.co ? `Tiện ích Chrome đang là bản ${tienIch.phienBan}, cần bản 1.3.` : `Chưa nhận được tiện ích Chrome (${tienIch?.loi || 'không phản hồi'}).`}</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Chép <b>CẢ thư mục</b> chrome-extension bản mới (1.3) đè lên thư mục tiện ích trên máy — đủ mọi file (manifest.json, background.js, phien.js…). Không biết thư mục nào: ở chrome://extensions bấm “Chi tiết” của tiện ích, xem dòng “Nguồn”.</li>
                  <li>Mở <span className="font-mono">chrome://extensions</span> → ô “Savitax — Cầu nối cổng thuế” → bấm <b>Tải lại</b> (mũi tên vòng).</li>
                  <li>Nếu Chrome tắt tiện ích và hỏi quyền vào <span className="font-mono">tracuunnt.gdt.gov.vn</span> → bật lại / cho phép.</li>
                  <li>Quay lại đây bấm <b>Kiểm lại tiện ích</b>.</li>
                </ol>
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setMaXn(null)}>Đóng</button>
                  <button type="button" className={nut + ' text-white bg-[#8B1A1A] hover:bg-[#6B1212]'} onClick={async () => {
                    const t = await kiemTraTienIch().catch(e => ({ co: false, loi: String(e?.message || e) }))
                    tienIchRef.current = t
                    setTienIch(t)
                    if (t?.co && t.traNnt) { const x = maXn; setMaXn(null); setTimeout(() => layMa(x.mst, x.ten, x.tiep), 0) }
                  }}>Kiểm lại tiện ích</button>
                </div>
              </div>
            ) : (<>
            {maXn.tiep?.length > 0 && <p className="text-xs text-gray-400">Còn {maXn.tiep.length} MST sau MST này</p>}
            <div className="my-3 flex items-center gap-3">
              {maXn.anh ? <img src={maXn.anh} alt="Mã xác nhận" className="h-12 rounded border border-gray-200 bg-white" /> : <div className="h-12 w-40 rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">{maXn.dang ? 'Đang lấy mã…' : '—'}</div>}
              <button type="button" className="text-xs text-[#8B1A1A] hover:underline" disabled={maXn.dang} onClick={() => layMa(maXn.mst, maXn.ten, maXn.tiep)}>↻ Mã khác</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); guiMa() }} className="flex gap-2">
              <input ref={oMa} autoFocus value={maXn.ma} onChange={e => setMaXn({ ...maXn, ma: e.target.value })} disabled={maXn.dang} placeholder="Gõ mã trong ảnh rồi Enter"
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm" autoComplete="off" />
              <button type="submit" className={nut + ' text-white bg-[#8B1A1A] hover:bg-[#6B1212]'} disabled={maXn.dang || !maXn.ma.trim()}>Tra</button>
            </form>
            {maXn.bao && <p className="mt-2 text-sm text-red-700">{maXn.bao}</p>}
            <div className="mt-3 flex justify-end gap-4">
              {maXn.tiep?.length > 0 && <button type="button" className="text-sm text-[#8B1A1A] hover:underline" disabled={maXn.dang} onClick={() => { const [ke, ...con] = maXn.tiep; layMa(ke.mst, ke.ten, con) }}>Bỏ qua MST này →</button>}
              <button type="button" className="text-sm text-gray-500 hover:underline" disabled={maXn.dang} onClick={() => setMaXn(null)}>Đóng</button>
            </div>
            </>)}
          </div>
        </div>
      )}
    </AppShell>
  )
}
