'use client'
// Tab "📊 Báo cáo KH" trên thẻ công ty — thay sheet "5. BC Tháng_Quý" của SVT.MB07 (anh chốt 28/11/2026).
// Nhân viên nhập số → app tự cộng, tính thuế GTGT phải nộp / khấu trừ, lấy hạn nộp từ lịch Tờ khai, gợi ý đầu kỳ
// từ báo cáo kỳ trước → dựng ảnh + lời nhắn Zalo. "Chép ảnh" / "Tải ảnh" cất số liệu và ảnh (xem lại theo ngày ở
// tab Tài liệu). Chép ảnh / Tải ảnh tự lưu luôn (một thao tác). Nhân viên vẫn TỰ TICK việc trên Checklist.
import { useEffect, useRef, useState } from 'react'
import AnhBaoCaoKH, { RONG } from './AnhBaoCaoKH'
import {
  DONG, phanTichKy, maKy, nhanKy, khoangKy, tinh, docSo, vietSo, dauKyTuKyTruoc, nhanKetQua, ghiChuKetQua,
  MAU_LOI_NHAN, dienLoiNhan, tenFileAnh, denNgayMacDinh, ngayVN,
} from '@/lib/baoCaoKh'

const KHOA_LOI_NHAN = 'baoCaoKh.loiNhan'
const rong = () => Object.fromEntries(DONG.filter(d => !d.tinh).map(d => [d.k, '']))

function dsKy(kieu, nam) {
  if (kieu === 'T') return Array.from({ length: 12 }, (_, i) => maKy('T', i + 1, nam))
  if (kieu === 'Q') return [1, 2, 3, 4].map(q => maKy('Q', q, nam))
  return [maKy('NAM', 0, nam)]
}

export default function BaoCaoKhachHang({ client, kyBanDau, onDaLuu }) {
  const [ky, setKy] = useState(kyBanDau)
  const p = phanTichKy(ky) || { kieu: 'T', nam: new Date().getFullYear() }
  const [nhap, setNhap] = useState(rong)
  const [ghiChu, setGhiChu] = useState({})
  const [denNgay, setDenNgay] = useState(denNgayMacDinh(kyBanDau))
  const [svr, setSvr] = useState({ han: {}, ds: [], bao: null, truoc: null })
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState('')
  const [bao, setBao] = useState('')
  const [dangLuu, setDangLuu] = useState(false)
  const [goiYDauKy, setGoiYDauKy] = useState(false)
  const [loiNhanMau, setLoiNhanMau] = useState(MAU_LOI_NHAN)
  const anh = useRef(null)
  const [cao, setCao] = useState(900)
  useEffect(() => { const h = anh.current?.offsetHeight; if (h && Math.abs(h - cao) > 1) setCao(h) })

  useEffect(() => { if (kyBanDau) setKy(kyBanDau) }, [kyBanDau])
  useEffect(() => {
    try { const s = localStorage.getItem(KHOA_LOI_NHAN); if (s) setLoiNhanMau(s) } catch { /* bỏ qua */ }
  }, [])

  useEffect(() => {
    let huy = false
    setDangTai(true); setLoi(''); setBao('')
    fetch(`/api/admin/bao-cao-kh?clientId=${client.id}&ky=${ky}`).then(r => r.json()).then(j => {
      if (huy) return
      if (j.error) { setLoi(j.error); setSvr({ han: {}, ds: [], bao: null, truoc: null }); setDangTai(false); return }
      setSvr(j)
      const n = rong()
      if (j.bao) {
        for (const k of Object.keys(n)) { const v = j.bao.so_lieu?.[k]; n[k] = v === null || v === undefined ? '' : vietSo(v) }
        setGhiChu(j.bao.ghi_chu || {}); setDenNgay(j.bao.so_lieu?.den_ngay || denNgayMacDinh(ky)); setGoiYDauKy(false)
      } else {
        const dk = dauKyTuKyTruoc(j.truoc)
        if (dk !== null) n.gtgt_dk = vietSo(dk)
        setGhiChu({}); setDenNgay(denNgayMacDinh(ky)); setGoiYDauKy(dk !== null)
      }
      setNhap(n); setDangTai(false)
    }).catch(() => { if (!huy) { setLoi('Không tải được dữ liệu, thử lại'); setDangTai(false) } })
    return () => { huy = true }
  }, [client.id, ky])

  const soLieu = { ...Object.fromEntries(Object.entries(nhap).map(([k, v]) => [k, docSo(v)])), den_ngay: denNgay }
  const v = tinh(soLieu)
  const han = svr.han || {}
  const chu = dienLoiNhan(loiNhanMau, { ky, soLieu, han })
  const baoNhanh = s => { setBao(s); setTimeout(() => setBao(b => (b === s ? '' : b)), 3500) }

  async function chup() {
    await document.fonts.ready
    const { default: html2canvas } = await import('html2canvas')
    const el = anh.current
    const cv = await html2canvas(el, { scale: 1, width: RONG, height: el.offsetHeight, backgroundColor: '#ffffff', logging: false, useCORS: true })
    return new Promise((ok, hong) => cv.toBlob(b => (b ? ok(b) : hong(new Error('Không dựng được ảnh'))), 'image/png'))
  }
  // Chép ảnh / Tải ảnh TỰ LƯU số liệu + ảnh vào Tài liệu (anh yêu cầu 28/11/2026: khỏi thao tác 2 lần).
  // Số liệu không đổi so với lần lưu ảnh trước thì không tải thêm ảnh trùng.
  const khoaHienTai = JSON.stringify([ky, soLieu, ghiChu])
  const daLuuAnh = useRef('')
  async function luuKemAnh(blob) {
    if (daLuuAnh.current === khoaHienTai) return ' (ảnh này đã có trong Tài liệu)'
    const ok = await luu(true, blob)
    if (ok) daLuuAnh.current = khoaHienTai
    return ok ? ' và lưu vào Tài liệu' : ' — CHƯA lưu được vào Tài liệu'
  }
  async function chepAnh() {
    try {
      const p = chup()   // truyền Promise vào ClipboardItem để Chrome vẫn coi là trong cú bấm
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': p })])
      const kq = await luuKemAnh(await p)
      baoNhanh('✓ Đã chép ảnh' + kq + ' — mở nhóm Zalo, bấm Ctrl+V')
    } catch (e) { baoNhanh('Không chép được ảnh: ' + (e?.message || e) + ' — bấm ⬇ Tải ảnh') }
  }
  async function taiAnh() {
    try {
      const b = await chup(); const a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = tenFileAnh(ky, client.client_code || client.tax_code)
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      const kq = await luuKemAnh(b)
      baoNhanh('✓ Đã tải ảnh' + kq)
    } catch (e) { baoNhanh('Không tải được: ' + (e?.message || e)) }
  }
  async function chepChu() {
    try { await navigator.clipboard.writeText(chu); baoNhanh('✓ Đã chép lời nhắn') } catch (e) { baoNhanh('Không chép được: ' + (e?.message || e)) }
  }
  async function luu(kemAnh, blob) {
    setDangLuu(true); setBao('')
    try {
      const fd = new FormData()
      fd.append('clientId', client.id); fd.append('ky', ky)
      fd.append('soLieu', JSON.stringify(soLieu)); fd.append('ghiChu', JSON.stringify(ghiChu))
      if (kemAnh) fd.append('anh', blob || await chup(), 'anh.png')
      const j = await (await fetch('/api/admin/bao-cao-kh', { method: 'POST', body: fd })).json()
      if (j.error) { baoNhanh('Không lưu được: ' + j.error); setDangLuu(false); return false }
      if (!blob) baoNhanh(kemAnh ? '✓ Đã lưu số liệu và ảnh vào tab Tài liệu' : '✓ Đã lưu số liệu')
      setSvr(s => ({ ...s, ds: [{ ky, updated_at: j.updatedAt }, ...s.ds.filter(x => x.ky !== ky)] }))
      setGoiYDauKy(false)
      onDaLuu?.(kemAnh)
      setDangLuu(false)
      return true
    } catch (e) { baoNhanh('Không lưu được: ' + (e?.message || e)) }
    setDangLuu(false)
    return false
  }

  const doiKieu = kieu => {
    const nay = new Date(), namNay = nay.getFullYear(), thNay = nay.getMonth() + 1
    const nam = p.nam
    if (kieu === 'T') setKy(maKy('T', nam < namNay ? 12 : thNay, nam))
    else if (kieu === 'Q') setKy(maKy('Q', nam < namNay ? 4 : Math.ceil(thNay / 3), nam))
    else setKy(maKy('NAM', 0, nam < namNay ? nam : namNay - 1))
  }
  const namChon = []
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 3; y--) namChon.push(y)
  const kh = khoangKy(ky)

  const o = 'w-full px-2 py-1 border border-gray-200 rounded-md text-sm text-right font-mono focus:outline-none focus:border-[#C9A24D]'
  return (
    <div className="mx-3 my-2 bg-white border border-[#E8D3A9] rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-[#FBF5EA] border-b border-[#F1E3C6] flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-[#6B1212] mr-auto">📊 Báo cáo tình hình kinh doanh gửi khách — {client.name}</p>
        <div className="flex rounded-lg border border-[#E8D3A9] overflow-hidden text-xs">
          {[['T', 'Tháng'], ['Q', 'Quý'], ['NAM', 'Năm']].map(([k, t]) => (
            <button key={k} type="button" onClick={() => doiKieu(k)}
              className={'px-2.5 py-1 ' + (p.kieu === k ? 'bg-[#8B1A1A] text-white' : 'bg-white text-[#8B1A1A] hover:bg-[#FBF5EA]')}>{t}</button>
          ))}
        </div>
        {p.kieu !== 'NAM' && (
          <select value={ky} onChange={e => setKy(e.target.value)} className="text-xs border border-[#E8D3A9] rounded-lg px-2 py-1 bg-white">
            {dsKy(p.kieu, p.nam).map(k => <option key={k} value={k}>{nhanKy(k)}</option>)}
          </select>
        )}
        <select value={p.nam} onChange={e => setKy(maKy(p.kieu, p.so || 1, +e.target.value))} className="text-xs border border-[#E8D3A9] rounded-lg px-2 py-1 bg-white">
          {namChon.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {svr.ds?.length > 0 && (
        <div className="px-3 py-1.5 border-b border-gray-100 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
          <span>Đã lập:</span>
          {svr.ds.slice(0, 12).map(x => (
            <button key={x.ky} type="button" onClick={() => setKy(x.ky)}
              className={'px-1.5 py-0.5 rounded border ' + (x.ky === ky ? 'border-[#8B1A1A] bg-[#FBF5EA] text-[#6B1212]' : 'border-gray-200 hover:border-[#D9B978]')}>
              {nhanKy(x.ky)} <span className="text-gray-400">· {new Date(x.updated_at).toLocaleDateString('vi-VN')}</span>
            </button>
          ))}
        </div>
      )}

      {loi && <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{loi}</div>}
      {dangTai ? (
        <div className="flex justify-center py-6"><div className="w-4 h-4 border-2 border-[#C9A24D] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="p-3 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4">
          {/* Nhập số */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-600">
              <span>Kỳ: <b>{nhanKy(ky)}</b> ({ngayVN(kh?.tu)} – {ngayVN(kh?.den)})</span>
              <span className="ml-auto">Số liệu đến ngày</span>
              <input type="date" value={denNgay || ''} min={kh?.tu} max={kh?.den} onChange={e => setDenNgay(e.target.value)}
                className="border border-gray-200 rounded-md px-1.5 py-0.5 text-xs" />
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="border border-gray-100 px-1.5 py-1 w-10">STT</th>
                  <th className="border border-gray-100 px-1.5 py-1 text-left">Nội dung</th>
                  <th className="border border-gray-100 px-1.5 py-1 w-40">Số tiền / số chứng từ</th>
                  <th className="border border-gray-100 px-1.5 py-1 w-48">Ghi chú (in lên ảnh)</th>
                </tr>
              </thead>
              <tbody>
                {DONG.filter(d => !d.nam || p.kieu === 'NAM').map(d => {
                  const tuTinh = d.tinh
                  let ten = d.ten, giaTri = null, gcTu = ''
                  if (tuTinh) {
                    giaTri = v[d.k]
                    if (d.k === 'gtgt_kq') { ten = nhanKetQua(v.gtgt_kq); giaTri = Math.abs(v.gtgt_kq); gcTu = ghiChuKetQua(v.gtgt_kq, han.gtgt, p.kieu) }
                    if (d.k === 'tndn_con_lai' && v.tndn_con_lai !== null && han.tndn) gcTu = 'Nộp trước ngày ' + ngayVN(han.tndn)
                  }
                  return (
                    <tr key={d.k} className={tuTinh ? 'bg-[#FBF5EA]' : ''}>
                      <td className={'border border-gray-100 px-1.5 py-1 text-center ' + (d.phu ? 'text-gray-400' : 'font-semibold text-gray-700')}>{d.stt}</td>
                      <td className={'border border-gray-100 px-1.5 py-1 ' + (d.phu ? 'pl-4 text-gray-500' : 'text-gray-800') + (d.k === 'gtgt_kq' ? ' font-semibold' : '')}>
                        {ten}{d.tuyChon && !tuTinh && <span className="text-gray-300"> · tùy chọn</span>}
                        {d.k === 'gtgt_dk' && goiYDauKy && <span className="block text-[10px] text-[#A0522D]">lấy từ phần còn khấu trừ của báo cáo kỳ trước — sửa nếu khác</span>}
                      </td>
                      <td className="border border-gray-100 px-1 py-0.5">
                        {tuTinh
                          ? <div className={'text-right font-mono px-1 ' + (d.k === 'gtgt_kq' ? 'font-bold text-red-700' : 'text-gray-700')}>{giaTri === null || giaTri === undefined ? '—' : vietSo(giaTri)}</div>
                          : <input inputMode="numeric" value={nhap[d.k]} placeholder={d.tuyChon ? '' : '0'}
                              onChange={e => setNhap(n => ({ ...n, [d.k]: e.target.value }))}
                              onBlur={e => { const x = docSo(e.target.value); setNhap(n => ({ ...n, [d.k]: x === null ? '' : vietSo(x) })) }}
                              className={o} />}
                      </td>
                      <td className="border border-gray-100 px-1 py-0.5">
                        <input value={ghiChu[d.k] || ''} placeholder={gcTu} onChange={e => setGhiChu(g => ({ ...g, [d.k]: e.target.value }))}
                          className="w-full px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-[#D9B978] rounded text-[11px] focus:outline-none" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-1.5">Dòng tô xanh app tự tính. Dòng “tùy chọn” để trống thì không in lên ảnh. Ghi chú để trống thì app tự ghi (hạn nộp lấy từ lịch Tờ khai & Hạn nộp).</p>
          </div>

          {/* Xem trước + gửi */}
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={dangLuu} onClick={() => luu(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[#D9B978] text-[#8B1A1A] hover:bg-[#FBF5EA] disabled:opacity-50">💾 Lưu nháp số liệu</button>
              <button type="button" onClick={chepAnh} disabled={dangLuu} title="Chép ảnh để dán vào Zalo — tự lưu số liệu + ảnh vào tab Tài liệu" className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#8B1A1A] text-white hover:bg-[#6B1212] disabled:opacity-50">📷 Chép ảnh + lưu Tài liệu</button>
              <button type="button" onClick={taiAnh} disabled={dangLuu} title="Tải ảnh về máy — tự lưu số liệu + ảnh vào tab Tài liệu" className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:border-[#8B1A1A]">⬇ Tải ảnh</button>
              <button type="button" onClick={chepChu} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700">📋 Chép lời nhắn</button>
            </div>
            {bao && <p className="text-xs text-gray-700">{bao}</p>}
            <div className="overflow-hidden rounded-lg border border-gray-200" style={{ width: Math.round(RONG * 0.48), height: Math.round(cao * 0.48), maxWidth: '100%' }}>
              <div style={{ transform: 'scale(0.48)', transformOrigin: 'top left', width: RONG }}>
                <AnhBaoCaoKH client={client} ky={ky} soLieu={soLieu} ghiChu={ghiChu} han={han} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Lời nhắn sẽ chép:</p>
              <p className="text-sm text-gray-800 whitespace-pre-line bg-gray-50 rounded-lg px-3 py-2">{chu}</p>
            </div>
            <details>
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-[#8B1A1A]">✏️ Sửa mẫu lời nhắn (nhớ trên máy này)</summary>
              <textarea value={loiNhanMau} rows={7}
                onChange={e => { setLoiNhanMau(e.target.value); try { localStorage.setItem(KHOA_LOI_NHAN, e.target.value) } catch { /* bỏ qua */ } }}
                className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-gray-500 flex-1">Chữ tự thay: <code>{'{ky}'}</code> <code>{'{tuNgay}'}</code> <code>{'{denNgay}'}</code> <code>{'{gtgtMv}'}</code> <code>{'{gtgtBr}'}</code> <code>{'{ketQua}'}</code> <code>{'{dongThem}'}</code> (TNCN, TNDN nếu có). Dòng trống tự bỏ.</p>
                <button type="button" onClick={() => { setLoiNhanMau(MAU_LOI_NHAN); try { localStorage.removeItem(KHOA_LOI_NHAN) } catch { /* bỏ qua */ } }}
                  className="text-xs text-gray-500 hover:text-[#8B1A1A]">Về mẫu gốc</button>
              </div>
            </details>
          </div>
        </div>
      )}
      {/* Bản cỡ thật để chụp — ngoài màn hình */}
      <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden="true">
        <div ref={anh}><AnhBaoCaoKH client={client} ky={ky} soLieu={soLieu} ghiChu={ghiChu} han={han} /></div>
      </div>
    </div>
  )
}
