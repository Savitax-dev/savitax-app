'use client'
// BẢN THỬ (21/11/2026) — tải bảng kê hóa đơn từ hoadondientu.gdt.gov.vn bằng cách để tiện ích 1.4 BẤM HỘ NÚT CỦA TRANG CỔNG.
// Câu hỏi của bản thử: cổng có nhận lượt "Tìm kiếm" / "Xuất excel" do nút của chính trang gửi (khi tiện ích bấm) không.
// Nhân viên tự đăng nhập + tự gõ mã xác nhận ở tab cổng; tiện ích không gửi yêu cầu nào tới cổng. Cổng báo chặn → DỪNG.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const MA_TIEN_ICH = process.env.NEXT_PUBLIC_TOKHAI_EXT_ID || 'affcgkipcpdjoiednghajbahjanhlnnn'

function guiTin(tin) {
  return new Promise(xong => {
    try {
      if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) { xong({ ok: false, loi: 'Không phải Chrome / Edge, hoặc chưa cài tiện ích' }); return }
      chrome.runtime.sendMessage(MA_TIEN_ICH, tin, kq => {
        if (chrome.runtime.lastError || !kq) { xong({ ok: false, loi: chrome.runtime.lastError?.message || 'Tiện ích không phản hồi' }); return }
        xong(kq)
      })
    } catch (e) { xong({ ok: false, loi: String(e?.message || e) }) }
  })
}

const hai = n => String(n).padStart(2, '0')
function khoangThang(thang) { // 'yyyy-mm' → dd/mm/yyyy đầu & cuối tháng
  const [y, m] = thang.split('-').map(Number)
  const cuoi = new Date(y, m, 0).getDate()
  return { tuNgay: `01/${hai(m)}/${y}`, denNgay: `${hai(cuoi)}/${hai(m)}/${y}` }
}
function thangTruoc() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}`
}

export default function ThuHoaDonPage() {
  const router = useRouter()
  const [sanSang, setSanSang] = useState(false)
  const [tienIch, setTienIch] = useState(null)
  const [tab, setTab] = useState(null)
  const [loai, setLoai] = useState('mua')
  const [tabCon, setTabCon] = useState('')
  const [thang, setThang] = useState(thangTruoc())
  const [chiBam, setChiBam] = useState(false)
  const [dangChay, setDangChay] = useState(false)
  const [ketQua, setKetQua] = useState(null)
  const [doTrang, setDoTrang] = useState(null)
  const [file, setFile] = useState(null)
  const [daChan, setDaChan] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await createClient().auth.getSession()
      if (!data.session) { router.push('/login'); return }
      setSanSang(true)
      kiemTienIch()
    })()
  }, [router])

  async function kiemTienIch() {
    const kq = await guiTin({ viec: 'ping' })
    setTienIch(kq)
    if (kq.ok && kq.hddt) setTab(await guiTin({ viec: 'hddtTab' }))
  }

  async function chay() {
    if (daChan) return
    setDangChay(true); setKetQua(null); setFile(null)
    const batDau = Date.now()
    const kq = await guiTin({ viec: 'hddtChay', tuyChon: { loai, tabCon, chiBam, xuat: true, ...khoangThang(thang) } })
    setKetQua(kq)
    if (kq?.ketQua?.biChan) setDaChan(true)
    // chờ file về (tối đa ~20 giây)
    for (let i = 0; i < 10 && kq?.ketQua?.ok; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const t = await guiTin({ viec: 'hddtTai', tu: batDau - 2000 })
      if (t.ok && t.file?.length) { setFile(t.file); if (t.file.every(f => f.trangThai !== 'in_progress')) break }
    }
    setDangChay(false)
  }

  async function doLai() { setDoTrang(await guiTin({ viec: 'hddtDo' })) }

  if (!sanSang) return <AppShell><div className="p-8 text-sm text-gray-400">Đang tải...</div></AppShell>

  const coTienIch = tienIch?.ok && tienIch?.hddt
  const { tuNgay, denNgay } = khoangThang(thang)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5 max-w-4xl space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Thử tải bảng kê hóa đơn (hoadondientu)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bản thử: tiện ích bấm hộ <b>chính các nút của trang cổng</b> (Tìm kiếm, Xuất excel) trong tab anh đã tự đăng nhập.
            Tiện ích không tự gửi yêu cầu nào tới cổng. Cổng báo “hành vi không hợp lệ / bị chặn” là dừng hẳn.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-2 text-sm">
          <div className="font-semibold">1. Kiểm tra</div>
          <div>Tiện ích: {tienIch == null ? '…' : coTienIch
            ? <span className="text-green-700">✔ bản {tienIch.phienBan}</span>
            : <span className="text-red-600">✘ {tienIch.ok ? `bản ${tienIch.phienBan} — cần bản 1.4 (Tải lại tiện ích)` : tienIch.loi}</span>}</div>
          <div>Tab cổng: {!coTienIch ? '—' : tab == null ? '…' : tab.ok
            ? <span className="text-green-700">✔ {tab.tab?.tieuDe} — {tab.tab?.url}</span>
            : <span className="text-amber-700">{tab.loi}</span>}</div>
          <button onClick={kiemTienIch} className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50">↻ Kiểm lại</button>
          <ol className="list-decimal ml-5 text-gray-600 space-y-0.5">
            <li>Mở tab mới: <a className="text-blue-600 underline" href="https://hoadondientu.gdt.gov.vn" target="_blank" rel="noreferrer">hoadondientu.gdt.gov.vn</a>, anh tự đăng nhập (tự gõ mã xác nhận).</li>
            <li>Trên cổng vào <b>Tra cứu → Tra cứu hóa đơn</b> (màn có ô ngày + nút Tìm kiếm).</li>
            <li>Quay lại đây bấm ↻ Kiểm lại, rồi Chạy thử.</li>
          </ol>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3 text-sm">
          <div className="font-semibold">2. Chạy thử một tháng</div>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={loai} onChange={e => setLoai(e.target.value)} className="border rounded px-2 py-1.5">
              <option value="mua">Mua vào</option>
              <option value="ban">Bán ra</option>
            </select>
            <select value={tabCon} onChange={e => setTabCon(e.target.value)} className="border rounded px-2 py-1.5">
              <option value="">Hóa đơn điện tử</option>
              <option value="mtt">Có mã từ máy tính tiền</option>
            </select>
            <input type="month" value={thang} onChange={e => setThang(e.target.value)} className="border rounded px-2 py-1.5" />
            <span className="text-gray-500">{tuNgay} → {denNgay}</span>
          </div>
          <label className="flex items-center gap-2 text-gray-600">
            <input type="checkbox" checked={chiBam} onChange={e => setChiBam(e.target.checked)} />
            Anh tự điền ngày trên cổng, tiện ích chỉ bấm Tìm kiếm + Xuất excel (dùng khi ô ngày không nhận chữ điền hộ)
          </label>
          <div className="flex gap-2">
            <button disabled={!coTienIch || dangChay || daChan} onClick={chay}
              className="px-4 py-2 rounded bg-blue-600 text-white font-medium disabled:opacity-40">{dangChay ? 'Đang chạy…' : '▶ Chạy thử'}</button>
            <button disabled={!coTienIch || dangChay} onClick={doLai} className="px-4 py-2 rounded border disabled:opacity-40">🔍 Dò trang</button>
          </div>
          {daChan && <div className="p-3 rounded bg-red-50 text-red-700 font-medium">Cổng đã báo chặn — bản thử DỪNG. Đừng bấm lại; chụp màn hình nhật ký gửi em.</div>}
        </div>

        {ketQua && (
          <div className="rounded-lg border bg-white p-4 text-sm space-y-2">
            <div className="font-semibold">Nhật ký {ketQua.ketQua?.ok ? <span className="text-green-700">— xong</span> : <span className="text-red-600">— dừng</span>}</div>
            {!ketQua.ok && <div className="text-red-600">{ketQua.loi}</div>}
            <table className="w-full border-collapse">
              <tbody>
                {(ketQua.ketQua?.nhatKy || []).map((d, i) => (
                  <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                    <td className="border px-2 py-1 w-6">{d.ok ? '✔' : '✘'}</td>
                    <td className="border px-2 py-1 whitespace-nowrap font-medium">{d.buoc}</td>
                    <td className="border px-2 py-1 text-gray-600 break-all">{d.chiTiet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {file && (
              <div>
                <div className="font-semibold mt-2">File tải về từ cổng</div>
                {file.map((f, i) => <div key={i}>📄 {f.ten} · {(f.kichThuoc / 1024).toFixed(1)} KB · {f.trangThai}{f.loi ? ' · ' + f.loi : ''}</div>)}
              </div>
            )}
            {ketQua.ketQua?.ok && !file && !dangChay && <div className="text-amber-700">Chưa thấy file nào tải về từ cổng — anh xem thanh tải xuống của Chrome.</div>}
          </div>
        )}

        {doTrang && (
          <div className="rounded-lg border bg-white p-4 text-sm space-y-2">
            <div className="font-semibold">Kết quả dò trang <span className="font-normal text-gray-500">(gửi em đoạn này nếu bản thử không bấm đúng nút)</span></div>
            {!doTrang.ok && <div className="text-red-600">{doTrang.loi}</div>}
            <textarea readOnly className="w-full h-72 font-mono text-xs border rounded p-2" value={JSON.stringify(doTrang.ketQua, null, 1)} />
            <button className="px-3 py-1.5 rounded border" onClick={() => navigator.clipboard?.writeText(JSON.stringify(doTrang.ketQua))}>📋 Chép</button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
