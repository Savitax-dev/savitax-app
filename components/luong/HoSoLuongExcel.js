'use client'
// Phân hệ Tiền lương — BƯỚC 1 — tải file mẫu "Hồ sơ lương nhân viên" (điền sẵn danh sách) và nhập lại.
// File & cột: lib/luong/fileHoSoLuong.js. Máy chủ (viec nhap_ho_so) kiểm từng dòng, xem trước rồi mới ghi.
import { useState } from 'react'
import { goi } from './chung'
import { taiFileMauHoSo, docFileHoSo } from '@/lib/luong/fileHoSoLuong'

const NHAN = {
  doi: ['Sẽ cập nhật', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
  giu: ['Không đổi', 'bg-gray-100 text-gray-600 border-gray-200'],
  loi: ['Lỗi — không ghi', 'bg-red-100 text-red-800 border-red-300'],
  khong_thay: ['Không có trên app', 'bg-gray-100 text-gray-600 border-gray-200'],
  remote: ['Phòng remote — bỏ qua', 'bg-sky-50 text-sky-700 border-sky-200'],
}
const giaTri = v => v == null ? '' : v instanceof Date ? v : typeof v === 'object'
  ? (v.richText ? v.richText.map(t => t.text).join('') : (v.result ?? v.text ?? ''))
  : v

export default function HoSoLuongExcel({ onXong }) {
  const [ban, setBan] = useState(false)
  const [msg, setMsg] = useState(null)
  const [xem, setXem] = useState(null)   // { ten, dong (đọc từ file), kq (máy chủ) }

  const taiMau = async () => {
    setBan(true); setMsg(null)
    const j = await goi('/api/admin/luong?viec=ho_so_mau')
    if (j.error) { setBan(false); setMsg({ loai: 'loi', text: j.error }); return }
    await taiFileMauHoSo(j)
    setBan(false)
    setMsg({ loai: 'ok', text: 'Đã tải file mẫu ' + j.nhanVien.length + ' nhân viên (trừ phòng remote). Điền ô vàng rồi bấm "Nhập file hồ sơ".' })
  }

  const chonFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBan(true); setMsg(null); setXem(null)
    try {
      const mod = await import('exceljs')
      const ExcelJS = mod.default || mod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await f.arrayBuffer())
      const ws = wb.getWorksheet('Nhap thong tin') || wb.worksheets.find(w => w.name !== 'Cap bac' && w.name !== 'Huong dan') || wb.worksheets[0]
      const doc = docFileHoSo((r, c) => giaTri(ws.getRow(r).getCell(c).value), ws.rowCount, ws.columnCount)
      if (doc.loi) { setMsg({ loai: 'loi', text: doc.loi }); return }
      const j = await goi('/api/admin/luong', { viec: 'nhap_ho_so', dong: doc.dong, ghi: false })
      if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
      setXem({ ten: f.name, dong: doc.dong, kq: j.dong })
    } catch (err) {
      setMsg({ loai: 'loi', text: 'Không đọc được file: ' + (err.message || err) })
    } finally { setBan(false) }
  }

  const dem = {}
  for (const r of xem?.kq || []) dem[r.tt] = (dem[r.tt] || 0) + 1
  const ghi = async () => {
    if (!dem.doi || !confirm('Cập nhật hồ sơ lương cho ' + dem.doi + ' nhân viên?')) return
    setBan(true)
    const j = await goi('/api/admin/luong', { viec: 'nhap_ho_so', dong: xem.dong, ghi: true })
    setBan(false)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setXem(null)
    setMsg({ loai: j.loiGhi?.length ? 'loi' : 'ok', text: 'Đã cập nhật ' + j.soGhi + ' nhân viên.' + (j.loiGhi?.length ? ' Lỗi: ' + j.loiGhi.join('; ') : '') })
    onXong && onXong()
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white shadow-sm">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="font-semibold text-teal-900">📄 Hồ sơ lương nhân viên bằng Excel</div>
          <div className="text-xs text-gray-500">Mã NV, ngày vào làm, chấm công bằng máy, cấp bậc, lương, người phụ thuộc, tài khoản ngân hàng — điền một lần cho cả công ty.</div>
        </div>
        <button onClick={taiMau} disabled={ban} className="text-sm px-4 py-2 rounded-xl border border-teal-300 bg-white text-teal-800 font-medium disabled:opacity-50">⬇ Tải file mẫu</button>
        <label className={'text-sm px-4 py-2 rounded-xl font-semibold shadow-sm cursor-pointer ' + (ban ? 'bg-gray-200 text-gray-500' : 'bg-teal-700 text-white hover:bg-teal-800')}>
          📥 Nhập file hồ sơ
          <input type="file" accept=".xlsx" className="hidden" onChange={chonFile} disabled={ban} />
        </label>
      </div>
      {msg && <div className={'mx-4 mb-3 rounded-xl border px-3 py-2 text-sm ' + (msg.loai === 'loi' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{msg.text}</div>}
      {xem && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-gray-600">{xem.ten}:</span>
            {Object.entries(NHAN).filter(([k]) => dem[k]).map(([k, [nhan, lop]]) => <span key={k} className={'rounded-full border px-2.5 py-0.5 font-medium ' + lop}>{nhan}: {dem[k]}</span>)}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0"><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2">Dòng</th><th className="px-3 py-2">Nhân viên</th><th className="px-3 py-2">Thay đổi / lỗi</th><th className="px-3 py-2">Trạng thái</th>
              </tr></thead>
              <tbody>
                {xem.kq.filter(r => r.tt !== 'giu').map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 text-gray-400">{r.hang}</td>
                    <td className="px-3 py-2">{r.ten || r.email}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.doi?.map((t, k) => <div key={k} className="text-emerald-800">• {t}</div>)}
                      {r.loi?.map((t, k) => <div key={k} className="text-red-700">⚠ {t}</div>)}
                    </td>
                    <td className="px-3 py-2"><span className={'text-xs rounded-full border px-2 py-0.5 font-medium whitespace-nowrap ' + (NHAN[r.tt]?.[1] || '')}>{NHAN[r.tt]?.[0]}</span></td>
                  </tr>
                ))}
                {!xem.kq.some(r => r.tt !== 'giu') && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">File không có gì thay đổi so với app.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setXem(null)} className="text-sm px-4 py-2 rounded-xl border border-gray-300 bg-white">Hủy</button>
            <button onClick={ghi} disabled={ban || !dem.doi} className="text-sm px-5 py-2 rounded-xl bg-[#8B1A1A] text-white font-semibold disabled:opacity-40">✓ Cập nhật {dem.doi || 0} nhân viên</button>
          </div>
        </div>
      )}
    </div>
  )
}
