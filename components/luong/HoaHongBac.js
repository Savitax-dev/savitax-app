'use client'
// Phân hệ Tiền lương — bảng BẬC HOA HỒNG GIỚI THIỆU (sql/39, anh chốt 22–23/10/2026): từ N công ty đang dùng dịch
// vụ trở lên → x% trên TOÀN BỘ tiền khách trả (chưa VAT) của các công ty người đó giới thiệu.
// Người giới thiệu ghi ở trang Quản lý khách hàng (cột "Giới thiệu").
import { useEffect, useState } from 'react'
import { goi } from './chung'

export default function HoaHongBac() {
  const [ds, setDs] = useState(null)
  const [msg, setMsg] = useState(null)
  const [thieuSql, setThieuSql] = useState(false)

  const tai = async () => {
    const j = await goi('/api/admin/luong?viec=hoa_hong_bac')
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); setDs([]); return }
    setThieuSql(!!j.chuaChaySql)
    setDs((j.data || []).map(r => ({ tu_so_cty: String(r.tu_so_cty), ty_le: String(r.ty_le) })))
  }
  useEffect(() => { tai() }, [])

  const luu = async () => {
    setMsg(null)
    const j = await goi('/api/admin/luong', { viec: 'luu_hoa_hong_bac', ds: ds.filter(r => r.tu_so_cty !== '' || r.ty_le !== '') })
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setMsg({ loai: 'ok', text: 'Đã lưu bảng bậc hoa hồng.' }); tai()
  }
  const doi = (i, k, v) => setDs(a => a.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const sap = [...(ds || [])].filter(r => Number(r.tu_so_cty) >= 1 && Number(r.ty_le) > 0).sort((a, b) => Number(a.tu_so_cty) - Number(b.tu_so_cty))

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-emerald-100 flex flex-wrap items-center gap-3 bg-gradient-to-r from-emerald-50 to-white">
        <div className="mr-auto">
          <div className="font-semibold text-emerald-900">🤝 Bậc hoa hồng giới thiệu</div>
          <div className="text-xs text-gray-500">Từ N công ty đang dùng dịch vụ trở lên → % trên toàn bộ tiền khách trả (chưa VAT) của các công ty người đó giới thiệu. Người giới thiệu ghi ở trang Quản lý khách hàng.</div>
        </div>
        <button onClick={() => setDs(a => [...(a || []), { tu_so_cty: '', ty_le: '' }])} disabled={!ds || thieuSql} className="text-sm px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-800 bg-white disabled:opacity-40">+ Thêm bậc</button>
        <button onClick={luu} disabled={!ds || thieuSql} className="text-sm px-4 py-1.5 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-40">Lưu bậc</button>
      </div>
      <div className="p-4 space-y-3">
        {thieuSql && <div className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">Chưa chạy <b>sql/39_hoa_hong_gioi_thieu.sql</b> — chạy trong Supabase rồi tải lại trang.</div>}
        {ds && !ds.length && !thieuSql && <div className="text-sm text-gray-500">Chưa có bậc nào — bấm "+ Thêm bậc" (vd: từ 1 công ty 10%, từ 5 công ty 15%, từ 10 công ty 20%).</div>}
        {ds?.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Từ</span>
            <input type="number" min={1} value={r.tu_so_cty} onChange={e => doi(i, 'tu_so_cty', e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-right" />
            <span className="text-gray-500">công ty trở lên →</span>
            <input type="number" min={0} max={100} step="0.5" value={r.ty_le} onChange={e => doi(i, 'ty_le', e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-right" />
            <span className="text-gray-500">%</span>
            <button onClick={() => setDs(a => a.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-600 ml-1" title="Bỏ bậc này">✕</button>
          </div>
        ))}
        {sap.length > 0 && (
          <div className="text-xs text-emerald-900 bg-emerald-50 rounded-xl px-3 py-2">
            {sap.map((r, i) => {
              const den = sap[i + 1] ? Number(sap[i + 1].tu_so_cty) - 1 : null
              return <span key={i} className="mr-3">{r.tu_so_cty}{den ? (den > Number(r.tu_so_cty) ? '–' + den : '') : '+'} công ty: <b>{r.ty_le}%</b></span>
            })}
          </div>
        )}
        {msg && <div className={'text-sm rounded-xl border px-3 py-2 ' + (msg.loai === 'loi' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{msg.text}</div>}
      </div>
    </div>
  )
}
