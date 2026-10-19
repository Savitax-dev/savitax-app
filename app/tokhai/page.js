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
import TabToKhai from '@/components/TabToKhai'
import { Chip, OTong } from '@/components/tokhaiUI'
import KyKhaiCongTy from '@/components/KyKhaiCongTy'

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
  // kyChon = kỳ NGƯỜI DÙNG tự chọn. Để trống thì server tự lấy kỳ sắp tới hạn gần nhất và trả
  // về trong dl.ky — nhờ vậy mở màn hình chỉ tốn MỘT lời gọi, không phải gọi lần hai để chọn kỳ.
  const [kyChon, setKyChon] = useState('')
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi]       = useState('')
  const [timKiem, setTimKiem] = useState('')
  // Công ty đang mở bảng chỉnh kỳ khai riêng (hướng A, 19/10/2026), và bộ đếm để tải lại bảng sau
  // khi lưu — lưu xong lịch đã đổi (xoá kỳ tháng, sinh kỳ quý) nên phải đọc lại.
  const [moKyKhai, setMoKyKhai] = useState(null)
  const [taiLai, setTaiLai] = useState(0)

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
    if (kyChon) q.set('ky', kyChon)
    fetch('/api/admin/tokhai/overview?' + q)
      .then(r => r.json())
      .then(j => {
        if (huy) return
        if (j.error) { setLoi(j.error); return }
        setDl(j)
      })
      .catch(e => !huy && setLoi(e.message))
      .finally(() => !huy && setDangTai(false))
    return () => { huy = true }
  }, [nam, kyChon, taiLai])

  // Ô chọn hiện kỳ người dùng chọn, hoặc kỳ server đã tự chốt.
  const kyDangXem = kyChon || dl?.ky || ''

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
        <TabToKhai />
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-lg font-bold text-gray-800">Tờ khai &amp; Hạn nộp</h1>
          <select value={kyDangXem} onChange={e => setKyChon(e.target.value)}
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
            <OTong mau="xanhDuong" so={dl.oTong.phaiNop}   nhan="Phải nộp trong kỳ" />
            <OTong mau="xanhLa"    so={dl.oTong.chapNhan}  nhan="Chấp nhận" />
            <OTong mau="hoPhach"   so={dl.oTong.choKetQua} nhan="Chờ kết quả" />
            <OTong mau="xam"       so={dl.oTong.chuaNop}   nhan="Chưa nộp" />
            <OTong mau="do"        so={dl.oTong.quaHan}    nhan="Quá hạn" />
            <OTong mau="tim"       so={dl.oTong.chuaNoiTaiKhoan} nhan="Chưa nối tài khoản" />
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
                {/* Phân lớp đậm nhạt xen kẽ: bảng dài và nhiều cột thì mắt dễ nhảy nhầm dòng —
                    với 294 công ty đây là thứ giữ cho bảng còn đọc được. */}
                {congTy.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 odd:bg-white even:bg-slate-50/60 hover:bg-red-50/40 transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-800 leading-tight">{c.ten}</p>
                      <p className="text-xs text-gray-400">{c.maKH || '— chưa có mã KH —'}</p>
                    </td>
                    {/* Bấm để xem / đổi kỳ khai riêng từng loại tờ khai. Có ghi đè thì máy chủ trả
                        nhãn kèm phần riêng, vd "Tháng · 05/KK-TNCN quý" — nhìn là biết công ty này khác. */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button type="button" onClick={() => setMoKyKhai(c)}
                        className="text-xs text-gray-600 hover:text-red-700 underline decoration-dotted underline-offset-2"
                        title="Xem / đổi kỳ khai riêng từng loại tờ khai">
                        {c.kyKhai}
                      </button>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {c.trangThaiTaiKhoan === 'not_connected'
                        ? <span className="text-xs text-purple-700">Chưa nối</span>
                        : <span className="text-xs text-green-700">Đã nối</span>}
                    </td>
                    {loai.map(t => {
                      const o = c.nghiaVu.find(x => x.loaiId === t.id)
                      if (!o) return <td key={t.id} className="px-2 py-2 text-xs text-gray-300">—</td>
                      return (
                        <td key={t.id} className="px-2 py-2 whitespace-nowrap">
                          <Chip trangThai={o.trangThai}
                            title={o.trangThaiCong ? 'Cổng thuế: ' + o.trangThaiCong : ''} />
                          <span className="block text-[11px] text-gray-400 mt-0.5">
                            {/* Ô của kỳ QUÝ hiện kèm khi xem theo tháng — công ty kê lẫn tháng và quý.
                                Ghi rõ "Q3" để khỏi tưởng tháng này phải nộp thêm một tờ khai nữa. */}
                            {o.baoTrum && (
                              <span className="text-indigo-600 font-semibold"
                                title="Công ty kê tờ khai này theo quý — hiện kèm vì quý bao trùm tháng đang xem">
                                kỳ {String(o.ky).split('.')[0]} ·{' '}
                              </span>
                            )}
                            {/* Ô sinh từ hồ sơ thật (kỳ chưa có trong lịch hạn nộp) thì không có hạn để so. */}
                            {o.khongCoNghiaVu
                              ? 'ngoài lịch hạn nộp'
                              : 'hạn ' + ngayVN(o.hanNop)}
                            {o.dungHan === true && ' · đúng hạn'}
                            {o.dungHan === false && ' · TRỄ HẠN'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {moKyKhai && (
          <KyKhaiCongTy congTy={moKyKhai} onDong={() => setMoKyKhai(null)} onDaLuu={() => setTaiLai(n => n + 1)} />
        )}
      </div>
    </AppShell>
  )
}
