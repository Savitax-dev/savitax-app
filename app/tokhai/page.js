'use client'
// Màn hình "Tờ khai & Hạn nộp" — Phân hệ Tờ khai, GĐ 2.
//
// Ma trận công ty × loại tờ khai cho một kỳ, kèm 6 ô tổng hợp. Dữ liệu là lịch hạn nộp app tự
// sinh (tax_obligations); trạng thái thật từ cổng thuế sẽ đổ vào ở GĐ 3.
//
// Màu LUÔN đi kèm chữ — không bao giờ chỉ dùng màu để phân biệt trạng thái.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const TRANG_THAI = {
  accepted:    { nhan: 'Chấp nhận',   o: 'bg-green-50 text-green-700 border-green-200' },
  received:    { nhan: 'Đã tiếp nhận', o: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected:    { nhan: 'Không chấp nhận', o: 'bg-red-50 text-red-700 border-red-200' },
  overdue:     { nhan: 'Quá hạn',     o: 'bg-red-50 text-red-700 border-red-200' },
  not_filed:   { nhan: 'Chưa nộp',    o: 'bg-slate-50 text-slate-600 border-slate-200' },
  no_activity: { nhan: 'Không phát sinh', o: 'bg-slate-50 text-slate-500 border-slate-200' },
}

const O_TONG = [
  { khoa: 'phaiNop',        nhan: 'Phải nộp trong kỳ', mau: 'text-blue-700 bg-blue-50 border-blue-200' },
  { khoa: 'chapNhan',       nhan: 'Chấp nhận',         mau: 'text-green-700 bg-green-50 border-green-200' },
  { khoa: 'choKetQua',      nhan: 'Chờ kết quả',       mau: 'text-amber-700 bg-amber-50 border-amber-200' },
  { khoa: 'chuaNop',        nhan: 'Chưa nộp',          mau: 'text-slate-600 bg-slate-50 border-slate-200' },
  { khoa: 'quaHan',         nhan: 'Quá hạn',           mau: 'text-red-700 bg-red-50 border-red-200' },
  { khoa: 'chuaNoiTaiKhoan', nhan: 'Chưa nối tài khoản', mau: 'text-purple-700 bg-purple-50 border-purple-200' },
]

const ngayVN = s => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '')

export default function TrangToKhai() {
  const router = useRouter()
  const nam = new Date().getFullYear()

  const [dl, setDl]         = useState(null)
  const [ky, setKy]         = useState('')
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi]       = useState('')
  const [timKiem, setTimKiem] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
    })
  }, [router])

  useEffect(() => {
    let huy = false
    setDangTai(true)
    setLoi('')
    const q = new URLSearchParams({ nam: String(nam) })
    if (ky) q.set('ky', ky)
    fetch('/api/admin/tokhai/overview?' + q)
      .then(r => r.json())
      .then(j => {
        if (huy) return
        if (j.error) { setLoi(j.error); return }
        setDl(j)
        // Lần đầu chưa chọn kỳ: mặc định kỳ gần nhất có nghĩa vụ, để không mở ra màn hình trống.
        if (!ky && j.congTy?.length) {
          const cac = [...new Set(j.congTy.flatMap(c => c.nghiaVu.map(o => o.ky)))].sort()
          if (cac.length) setKy(cac[cac.length - 1])
        }
      })
      .catch(e => !huy && setLoi(e.message))
      .finally(() => !huy && setDangTai(false))
    return () => { huy = true }
  }, [nam, ky])

  const loai = dl?.loaiToKhai || []
  const congTy = (dl?.congTy || []).filter(c => {
    const t = timKiem.trim().toLowerCase()
    if (!t) return true
    return (c.ten || '').toLowerCase().includes(t)
      || (c.maKH || '').toLowerCase().includes(t)
      || (c.mst || '').includes(t)
  })

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-lg font-bold text-gray-800">Tờ khai &amp; Hạn nộp</h1>
          <select value={ky} onChange={e => setKy(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn kỳ —</option>
            {(dl?.cacKy || []).map(k => <option key={k.ma} value={k.ma}>{k.nhan}</option>)}
          </select>
          <input value={timKiem} onChange={e => setTimKiem(e.target.value)}
            placeholder="Tìm tên công ty, mã KH, MST…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[200px]" />
        </div>

        {loi && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>
        )}

        {dl?.oTong && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            {O_TONG.map(o => (
              <div key={o.khoa} className={'rounded-xl border px-3 py-2.5 ' + o.mau}>
                <p className="text-xl font-bold leading-tight">{dl.oTong[o.khoa] ?? 0}</p>
                <p className="text-xs mt-0.5">{o.nhan}</p>
              </div>
            ))}
          </div>
        )}

        {dangTai && <p className="text-sm text-gray-400 py-8 text-center">Đang tải…</p>}

        {!dangTai && !congTy.length && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-gray-500">Chưa có dữ liệu cho kỳ này.</p>
            <p className="text-xs text-gray-400 mt-1">
              Lịch hạn nộp được sinh bằng <code>scripts/seed-tax-obligations.mjs</code>.
            </p>
          </div>
        )}

        {!dangTai && congTy.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50">Công ty</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">Kỳ khai</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">Tài khoản</th>
                  {loai.map(t => (
                    <th key={t.id} className="text-left px-2 py-2 font-semibold text-gray-600 whitespace-nowrap"
                      title={t.name}>{t.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {congTy.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-3 py-2 sticky left-0 bg-white">
                      <p className="font-medium text-gray-800 leading-tight">{c.ten}</p>
                      <p className="text-xs text-gray-400">{c.maKH || '— chưa có mã KH —'}</p>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">{c.kyKhai}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {c.trangThaiTaiKhoan === 'not_connected'
                        ? <span className="text-xs text-purple-700">Chưa nối</span>
                        : <span className="text-xs text-green-700">Đã nối</span>}
                    </td>
                    {loai.map(t => {
                      const o = c.nghiaVu.find(x => x.loaiId === t.id)
                      if (!o) return <td key={t.id} className="px-2 py-2 text-xs text-gray-300">—</td>
                      const tt = TRANG_THAI[o.trangThai] || TRANG_THAI.not_filed
                      return (
                        <td key={t.id} className="px-2 py-2 whitespace-nowrap">
                          <span className={'inline-block rounded-md border px-1.5 py-0.5 text-xs ' + tt.o}>
                            {tt.nhan}
                          </span>
                          <span className="block text-[11px] text-gray-400 mt-0.5">hạn {ngayVN(o.hanNop)}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
