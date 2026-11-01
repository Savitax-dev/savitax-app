'use client'
// Khung "Công nợ đặc thù" trong thẻ công ty (Danh sách công ty) — CHỈ quản trị viên thấy (anh chốt 01/11/2026).
// Lưu qua /api/admin/clients/dac-thu. Quy tắc tính: lib/ctyDacThu.js.
import { useState } from 'react'

export default function CongNoDacThu({ client, onSaved }) {
  const [mo, setMo] = useState(false)
  const [f, setF] = useState({ khong_vat: client.khong_vat === true, gia_han_thu_thang: Number(client.gia_han_thu_thang) || 0, ly_do: client.gia_han_thu_ly_do || '' })
  const [ban, setBan] = useState(false)
  const [msg, setMsg] = useState(null)

  const luu = async () => {
    setBan(true); setMsg(null)
    try {
      const r = await fetch('/api/admin/clients/dac-thu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, khong_vat: f.khong_vat, gia_han_thu_thang: Number(f.gia_han_thu_thang) || 0, ly_do: f.ly_do }),
      })
      const j = await r.json()
      if (j.error) { setMsg({ loi: true, text: j.error }); return }
      setMsg({ text: 'Đã lưu.' }); setMo(false); onSaved?.()
    } catch (e) { setMsg({ loi: true, text: e.message }) } finally { setBan(false) }
  }

  if (!mo) return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => { setMo(true); setMsg(null) }} className="text-xs text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 px-3 py-1.5 rounded-lg font-medium">
        ⚙️ Công nợ đặc thù
      </button>
      {msg && <span className={'text-xs ' + (msg.loi ? 'text-rose-600' : 'text-emerald-700')}>{msg.text}</span>}
    </div>
  )
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-3 space-y-2.5 text-sm">
      <div className="font-semibold text-violet-900">⚙️ Công nợ đặc thù <span className="font-normal text-xs text-violet-700">— chỉ quản trị viên</span></div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={f.khong_vat} onChange={e => setF(v => ({ ...v, khong_vat: e.target.checked }))} />
        <span><b>Thu phí không VAT</b> (không xuất hóa đơn)<span className="block text-xs text-gray-500">Doanh thu tính lương, hoa hồng giới thiệu, thưởng dịch vụ khác KHÔNG chia 1,08; phiếu ĐNTT không có dòng VAT 8%.</span></span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span><b>Gia hạn thu</b> phí kế toán:</span>
        <select value={f.gia_han_thu_thang} onChange={e => setF(v => ({ ...v, gia_han_thu_thang: Number(e.target.value) }))}
          className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-sm">
          <option value={0}>Không (bình thường)</option>
          {[1, 2, 3, 4, 5, 6, 9, 12].map(n => <option key={n} value={n}>{n} tháng</option>)}
        </select>
      </div>
      {f.gia_han_thu_thang > 0 && <>
        <input value={f.ly_do} onChange={e => setF(v => ({ ...v, ly_do: e.target.value }))} placeholder="Lý do cho phép thu chậm (bắt buộc)"
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm" />
        <p className="text-xs text-gray-500">Mỗi kỳ, hạn ghi thu / chuyển nợ tồn lùi từ ngày 10 tháng sau thêm {f.gia_han_thu_thang} tháng (vd kỳ T9 hạn 10/{10 + Number(f.gia_han_thu_thang) > 12 ? 10 + Number(f.gia_han_thu_thang) - 12 : 10 + Number(f.gia_han_thu_thang)}). Trong thời gian đó kỳ chưa thu đủ <b>tạm không tính</b> %-công nợ của nhân viên, phòng; thu đủ thì tính bình thường.</p>
      </>}
      {msg?.loi && <p className="text-xs text-rose-600">{msg.text}</p>}
      <div className="flex gap-2">
        <button onClick={luu} disabled={ban} className="text-xs px-3 py-1.5 rounded-lg bg-violet-700 text-white font-semibold disabled:opacity-50">{ban ? 'Đang lưu…' : 'Lưu'}</button>
        <button onClick={() => setMo(false)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white">Đóng</button>
      </div>
    </div>
  )
}

// Nhãn cạnh tên công ty ở các danh sách công nợ / công việc: "Không VAT", "Gia hạn thu N th" (+ "tạm không tính %")
export function NhanDacThu({ c }) {
  if (!c) return null
  const g = Number(c.gia_han_thu_thang) || 0
  return <>
    {c.khong_vat && <span className="text-xs px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 flex-shrink-0" title="Thu phí không VAT — lương, hoa hồng không chia 1,08; ĐNTT không có dòng VAT">Không VAT</span>}
    {g > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 flex-shrink-0"
      title={'Admin cho thu chậm ' + g + ' tháng' + (c.tamBoQuaNo ? ' — kỳ này chưa thu đủ, đang trong hạn nên TẠM KHÔNG TÍNH %-công nợ' : '')}>
      Gia hạn thu {g} th{c.tamBoQuaNo ? ' · tạm không tính %' : ''}
    </span>}
  </>
}
