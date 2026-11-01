'use client'
// Phân hệ Tiền lương — bảng BẬC HOA HỒNG GIỚI THIỆU (sql/39, anh chốt 22–23/10/2026): từ N công ty đang dùng dịch
// vụ trở lên → x% trên TOÀN BỘ tiền khách trả (chưa VAT) của các công ty người đó giới thiệu.
// sql/46 (01/11/2026, chính sách "Lợi ích hợp tác"): mỗi bậc thêm mốc DOANH SỐ (tổng phí hằng tháng chưa VAT của các
// công ty đang dùng dịch vụ) — điều kiện nào đến trước, lấy % cao hơn.
// Người giới thiệu ghi ở trang Quản lý khách hàng (cột "Giới thiệu").
import { useEffect, useState } from 'react'
import { goi } from './chung'

export default function HoaHongBac() {
  const [ds, setDs] = useState(null)
  const [msg, setMsg] = useState(null)
  const [thieuSql, setThieuSql] = useState(false)
  const [coDoanhSo, setCoDoanhSo] = useState(false)
  const soTien = v => { const n = String(v ?? '').replace(/[^0-9]/g, ''); return n ? Number(n).toLocaleString('vi-VN') : '' }

  const tai = async () => {
    const j = await goi('/api/admin/luong?viec=hoa_hong_bac')
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); setDs([]); return }
    setThieuSql(!!j.chuaChaySql)
    setCoDoanhSo(!!j.coDoanhSo)
    setDs((j.data || []).map(r => ({ tu_so_cty: String(r.tu_so_cty), ty_le: String(r.ty_le), tu_doanh_so: soTien(r.tu_doanh_so) })))
  }
  useEffect(() => { tai() }, [])

  const luu = async () => {
    setMsg(null)
    const j = await goi('/api/admin/luong', { viec: 'luu_hoa_hong_bac', coDoanhSo, ds: ds.filter(r => r.tu_so_cty !== '' || r.ty_le !== '') })
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
          <div className="text-xs text-gray-500">Từ N công ty đang dùng dịch vụ <b>hoặc</b> doanh số (tổng phí hằng tháng chưa VAT của các công ty đó) từ mức đặt ra — điều kiện nào đến trước, lấy % cao hơn — tính trên tiền khách THỰC TRẢ (chưa VAT) tại từng lần thu. Người giới thiệu ghi ở trang Quản lý khách hàng.</div>
        </div>
        <button onClick={() => setDs(a => [...(a || []), { tu_so_cty: '', ty_le: '', tu_doanh_so: '' }])} disabled={!ds || thieuSql} className="text-sm px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-800 bg-white disabled:opacity-40">+ Thêm bậc</button>
        <button onClick={luu} disabled={!ds || thieuSql} className="text-sm px-4 py-1.5 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-40">Lưu bậc</button>
      </div>
      <div className="p-4 space-y-3">
        {!thieuSql && ds && !coDoanhSo && <div className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">Chưa chạy <b>sql/46_hoa_hong_bac_doanh_so.sql</b> — bậc đang chỉ xét theo số công ty.</div>}
        {thieuSql && <div className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">Chưa chạy <b>sql/39_hoa_hong_gioi_thieu.sql</b> — chạy trong Supabase rồi tải lại trang.</div>}
        {ds && !ds.length && !thieuSql && <div className="text-sm text-gray-500">Chưa có bậc nào — bấm "+ Thêm bậc" (chính sách hiện hành: từ 1 công ty hoặc 1tr → 10%, từ 21 công ty hoặc 31tr → 15%, từ 31 công ty hoặc 51tr → 20%).</div>}
        {ds?.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Từ</span>
            <input type="number" min={1} value={r.tu_so_cty} onChange={e => doi(i, 'tu_so_cty', e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-right" />
            <span className="text-gray-500">công ty</span>
            {coDoanhSo && <>
              <span className="text-gray-500">hoặc doanh số từ</span>
              <input type="text" inputMode="numeric" value={r.tu_doanh_so || ''} onChange={e => doi(i, 'tu_doanh_so', soTien(e.target.value))} placeholder="(không xét)" className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-right" />
              <span className="text-gray-500">đ</span>
            </>}
            <span className="text-gray-500">trở lên →</span>
            <input type="number" min={0} max={100} step="0.5" value={r.ty_le} onChange={e => doi(i, 'ty_le', e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-right" />
            <span className="text-gray-500">%</span>
            <button onClick={() => setDs(a => a.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-600 ml-1" title="Bỏ bậc này">✕</button>
          </div>
        ))}
        {sap.length > 0 && (
          <div className="text-xs text-emerald-900 bg-emerald-50 rounded-xl px-3 py-2">
            {sap.map((r, i) => {
              const den = sap[i + 1] ? Number(sap[i + 1].tu_so_cty) - 1 : null
              return <span key={i} className="mr-3">{r.tu_so_cty}{den ? (den > Number(r.tu_so_cty) ? '–' + den : '') : '+'} công ty{coDoanhSo && r.tu_doanh_so ? ' hoặc ≥ ' + r.tu_doanh_so + 'đ' : ''}: <b>{r.ty_le}%</b></span>
            })}
          </div>
        )}
        {msg && <div className={'text-sm rounded-xl border px-3 py-2 ' + (msg.loai === 'loi' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{msg.text}</div>}
      </div>
    </div>
  )
}
