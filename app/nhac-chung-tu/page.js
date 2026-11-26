'use client'
// Mẫu nhắc khách gửi chứng từ (26/11/2026). Thay cho việc nhân viên tự làm mẫu ngoài Excel: chọn tháng chứng từ → app dựng
// sẵn ẢNH thông báo (bản khai quý / khai tháng) + LỜI NHẮN → nhân viên chép, dán vào nhóm Zalo của khách. Nhân viên vẫn TỰ
// TICK việc "Gửi thông báo cung cấp chứng từ" ở Checklist như cũ (anh chốt: không cần app tick).
// Không gọi máy chủ, không lưu gì (lời nhắn sửa tay nhớ trong trình duyệt). Ảnh dựng bằng HTML rồi chụp bằng html2canvas.
// Bản bot tự đăng vào nhóm khách: nhánh local `thu/zalo-bot-gui-nhom` (gói Zalo Bot miễn phí chỉ cho 3 nhóm).
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { kyMacDinh, dienLoiNhan, thangChecklist, MAU_LOI_NHAN } from '@/lib/nhacChungTu'
import AnhThongBao, { RONG, CAO } from '@/components/AnhThongBaoChungTu'

const KHOA_LOI_NHAN = 'nhacChungTu.loiNhan'

export default function NhacChungTu() {
  const router = useRouter()
  const [san, setSan] = useState(false)
  const [ky, setKy] = useState(kyMacDinh)
  const [loiNhan, setLoiNhan] = useState(MAU_LOI_NHAN)
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login'); else setSan(true) })
    try { const o = JSON.parse(localStorage.getItem(KHOA_LOI_NHAN) || 'null'); if (o?.quy && o?.thang) setLoiNhan(o) } catch { /* bỏ qua */ }
    // Mở từ nút "📣 Mẫu" trong Checklist: ?nam=2026&thang=10 = tháng chứng từ của việc đó
    const q = new URLSearchParams(window.location.search), n = Number(q.get('nam')), t = Number(q.get('thang'))
    if (n >= 2024 && n <= 2100 && t >= 1 && t <= 12) setKy({ nam: n, thang: t })
  }, [router])
  const doiLoiNhan = (k, v) => setLoiNhan(l => { const m = { ...l, [k]: v }; try { localStorage.setItem(KHOA_LOI_NHAN, JSON.stringify(m)) } catch { /* bỏ qua */ } return m })

  const ds = []
  { const d = new Date(); let y = d.getFullYear(), m = d.getMonth() + 1
    for (let i = 0; i < 13; i++) { ds.push({ y, m }); m--; if (!m) { m = 12; y-- } } }
  const ck = thangChecklist(ky.nam, ky.thang)

  return (
    <AppShell>
      <div className="p-4 md:p-6 w-full">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-2xl">📣</span>
          <h1 className="text-xl font-bold text-gray-800">Mẫu nhắc khách gửi chứng từ</h1>
          <select value={ky.nam + '-' + ky.thang} onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setKy({ nam: y, thang: m }) }}
            className="ml-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white font-semibold">
            {ds.map(o => <option key={o.y + '-' + o.m} value={o.y + '-' + o.m}>Chứng từ tháng {o.m}/{o.y}</option>)}
          </select>
        </div>
        <div className="mb-4 px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sm text-sky-800">
          ① <b>📷 Chép ảnh</b> → mở nhóm Zalo của khách → <b>Ctrl+V</b> · ② <b>📋 Chép lời nhắn</b> → Ctrl+V → Gửi · ③ tự tick việc
          “Gửi thông báo cung cấp chứng từ tháng {ky.thang}” ở Checklist <b>tháng {ck.thang}/{ck.nam}</b> (hạn ngày 5). Gửi bằng điện thoại thì bấm <b>⬇ Tải ảnh</b>.
        </div>
        {san && (
          <div className="grid xl:grid-cols-2 gap-5">
            {[['quy', 'Công ty khai QUÝ'], ['thang', 'Công ty khai THÁNG']].map(([k, nhan]) => (
              <MotMau key={k + ky.nam + ky.thang} kyKhai={k} nhan={nhan} ky={ky} loiNhan={loiNhan[k]} doiLoiNhan={v => doiLoiNhan(k, v)}
                veMacDinh={() => doiLoiNhan(k, MAU_LOI_NHAN[k])} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function MotMau({ kyKhai, nhan, ky, loiNhan, doiLoiNhan, veMacDinh }) {
  const anh = useRef(null)
  const [bao, setBao] = useState('')
  const chu = dienLoiNhan(loiNhan, { kyNam: ky.nam, kyThang: ky.thang, kyKhai })
  const baoNhanh = s => { setBao(s); setTimeout(() => setBao(b => (b === s ? '' : b)), 3000) }
  const tenFile = `thong-bao-chung-tu-${ky.nam}-${String(ky.thang).padStart(2, '0')}-${kyKhai === 'quy' ? 'khai-quy' : 'khai-thang'}.png`

  // Chụp khung ảnh cỡ thật (đặt ngoài màn hình) thành PNG
  async function chup() {
    await document.fonts.ready
    const { default: html2canvas } = await import('html2canvas')
    const cv = await html2canvas(anh.current, { scale: 1, width: RONG, height: CAO, backgroundColor: '#f7f1e7', logging: false })
    return new Promise((ok, loi) => cv.toBlob(b => (b ? ok(b) : loi(new Error('Không dựng được ảnh'))), 'image/png'))
  }
  async function chepAnh() {
    try {
      // Truyền Promise vào ClipboardItem để Chrome vẫn coi là trong cú bấm (chụp mất ~1 giây)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': chup() })])
      baoNhanh('✓ Đã chép ảnh — mở nhóm Zalo, bấm Ctrl+V')
    } catch (e) { baoNhanh('Không chép được ảnh: ' + (e?.message || e) + ' — bấm ⬇ Tải ảnh') }
  }
  async function taiAnh() {
    try {
      const b = await chup()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = tenFile
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e) { baoNhanh('Không tải được: ' + (e?.message || e)) }
  }
  async function chepChu() {
    try { await navigator.clipboard.writeText(chu); baoNhanh('✓ Đã chép lời nhắn') } catch (e) { baoNhanh('Không chép được: ' + (e?.message || e)) }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <p className="px-4 py-2.5 text-sm font-bold text-gray-800 bg-gray-50">{nhan}</p>
      <div className="p-4 grid md:grid-cols-[minmax(0,360px)_1fr] gap-4">
        {/* Xem trước: thu nhỏ 1/3 */}
        <div className="relative w-full max-w-[360px] aspect-[4/5] overflow-hidden rounded-lg border border-gray-200">
          <div style={{ transform: 'scale(0.3333)', transformOrigin: 'top left', width: RONG, height: CAO }}>
            <AnhThongBao ky={ky} kyKhai={kyKhai} />
          </div>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={chepAnh} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#8B1A1A] text-white hover:bg-[#6B1212]">📷 Chép ảnh</button>
            <button type="button" onClick={taiAnh} className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:border-[#8B1A1A]">⬇ Tải ảnh</button>
            <button type="button" onClick={chepChu} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700">📋 Chép lời nhắn</button>
          </div>
          {bao && <p className="text-xs text-gray-700">{bao}</p>}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Lời nhắn sẽ chép:</p>
            <p className="text-sm text-gray-800 whitespace-pre-line bg-gray-50 rounded-lg px-3 py-2">{chu}</p>
          </div>
          <details>
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-[#8B1A1A]">✏️ Sửa lời nhắn (nhớ trên máy này)</summary>
            <textarea value={loiNhan} onChange={e => doiLoiNhan(e.target.value)} rows={5} className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-gray-500 flex-1">Chữ tự thay: <code>{'{thang}'}</code> <code>{'{nam}'}</code> <code>{'{han}'}</code> <code>{'{kyBaoCao}'}</code>. Dòng trống tự bỏ (Zalo giãn mỗi lần xuống dòng).</p>
              <button type="button" onClick={veMacDinh} className="text-xs text-gray-500 hover:text-[#8B1A1A]">Về mẫu gốc</button>
            </div>
          </details>
        </div>
      </div>
      {/* Bản cỡ thật để chụp — nằm ngoài màn hình */}
      <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden="true">
        <div ref={anh}><AnhThongBao ky={ky} kyKhai={kyKhai} /></div>
      </div>
    </div>
  )
}
