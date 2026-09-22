'use client'
// Hồ sơ tờ khai đã lấy về từ cổng — Phân hệ Tờ khai.
//
// Khác màn hình /tokhai: ở đó là LỊCH HẠN NỘP do app tự sinh (app nghĩ công ty phải nộp gì),
// còn ở đây là HỒ SƠ THẬT cổng thuế trả về (công ty đã nộp gì thật). Hai thứ khớp nhau được thì
// cột "Gắn hạn nộp" hiện ✓.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const TRANG_THAI = {
  accepted:  { nhan: 'Chấp nhận',        o: 'bg-green-50 text-green-700 border-green-200' },
  received:  { nhan: 'Đã tiếp nhận',     o: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected:  { nhan: 'Không chấp nhận',  o: 'bg-red-50 text-red-700 border-red-200' },
  not_filed: { nhan: 'Chưa nộp',         o: 'bg-slate-50 text-slate-600 border-slate-200' },
  overdue:   { nhan: 'Quá hạn',          o: 'bg-red-50 text-red-700 border-red-200' },
}

const ngayGio = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—'

export default function TrangHoSo() {
  const router = useRouter()
  const [dl, setDl] = useState(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [ky, setKy] = useState('')
  const [tim, setTim] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
  }, [router])

  useEffect(() => {
    setDangTai(true)
    fetch('/api/admin/tokhai/filings' + (ky ? '?ky=' + encodeURIComponent(ky) : ''))
      .then(r => r.json())
      .then(j => { if (j.error) setLoi(j.error); else { setDl(j); setLoi('') } })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }, [ky])

  const ds = (dl?.hoSo || []).filter(h => {
    const t = tim.trim().toLowerCase()
    if (!t) return true
    return (h.congTy || '').toLowerCase().includes(t)
      || (h.maKH || '').toLowerCase().includes(t)
      || (h.mst || '').includes(t)
      || (h.maHoSo || '').toLowerCase().includes(t)
  })

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-lg font-bold text-gray-800">Hồ sơ đã nộp</h1>
          <span className="text-sm text-gray-500">{ds.length} hồ sơ lấy về từ cổng thuế</span>
          <select value={ky} onChange={e => setKy(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">— Tất cả các kỳ —</option>
            {(dl?.cacKy || []).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={tim} onChange={e => setTim(e.target.value)}
            placeholder="Tìm công ty, mã KH, MST, mã hồ sơ…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[220px]" />
        </div>

        {loi && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}
        {dangTai && <p className="text-sm text-gray-400 py-8 text-center">Đang tải…</p>}

        {!dangTai && !ds.length && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-gray-500">Chưa có hồ sơ nào.</p>
            <p className="text-xs text-gray-400 mt-1">
              Hồ sơ xuất hiện ở đây sau khi bấm <b>Đồng bộ tờ khai</b> ở trang Kết nối cổng thuế.
            </p>
          </div>
        )}

        {!dangTai && ds.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <th className="text-left px-3 py-2 font-semibold">Công ty</th>
                  <th className="text-left px-2 py-2 font-semibold">Tờ khai</th>
                  <th className="text-left px-2 py-2 font-semibold">Kỳ</th>
                  <th className="text-left px-2 py-2 font-semibold">Hình thức</th>
                  <th className="text-left px-2 py-2 font-semibold">Ngày nộp</th>
                  <th className="text-left px-2 py-2 font-semibold">Trạng thái</th>
                  <th className="text-left px-2 py-2 font-semibold">Gắn hạn nộp</th>
                  <th className="text-left px-2 py-2 font-semibold">Mã hồ sơ</th>
                </tr>
              </thead>
              <tbody>
                {ds.map(h => {
                  const tt = TRANG_THAI[h.trangThai] || TRANG_THAI.received
                  return (
                    <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800 leading-tight">{h.congTy}</p>
                        <p className="text-xs text-gray-400">{h.maKH || '—'}</p>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap" title={h.tenLoai || ''}>
                        {h.loai || <span className="text-amber-700">chưa khớp danh mục</span>}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{h.ky}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                        {h.hinhThuc}{h.boSung > 0 ? ` (BS lần ${h.boSung})` : ''}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{ngayGio(h.ngayNop)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={'inline-block rounded-md border px-1.5 py-0.5 text-xs ' + tt.o}>{tt.nhan}</span>
                        {h.trangThaiCong && h.trangThaiCong !== tt.nhan && (
                          <span className="block text-[11px] text-gray-400 mt-0.5">cổng: {h.trangThaiCong}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {h.daGanNghiaVu
                          ? <span className="text-green-600">✓</span>
                          : <span className="text-gray-300" title="Kỳ này chưa có trong lịch hạn nộp">—</span>}
                      </td>
                      <td className="px-2 py-2 font-mono text-[11px] text-gray-500">{h.maHoSo}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
