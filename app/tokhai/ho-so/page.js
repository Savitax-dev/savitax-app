'use client'
// Hồ sơ đã nộp — Phân hệ Tờ khai.
//
// GOM THEO CÔNG TY: một công ty một kỳ đã 3–5 hồ sơ, nhân với 294 công ty là hơn nghìn dòng.
// Mặc định mỗi công ty một dòng tóm tắt; bấm mới bung ra từng hồ sơ. Kèm bộ lọc và phân trang.
//
// Khác màn hình "Lịch hạn nộp": ở đó là thứ app NGHĨ phải nộp, ở đây là hồ sơ THẬT cổng trả về.
import { useEffect, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import NhacHanNop from '@/components/NhacHanNop'
import TabToKhai from '@/components/TabToKhai'
import { Chip, OTong, ngayDayDu } from '@/components/tokhaiUI'

const LOC_TRANG_THAI = [
  { ma: '', nhan: '— Mọi trạng thái —' },
  { ma: 'accepted', nhan: 'Chấp nhận' },
  { ma: 'received', nhan: 'Đã tiếp nhận' },
  { ma: 'rejected', nhan: 'Không chấp nhận' },
]

export default function TrangHoSo() {
  const router = useRouter()
  const [dl, setDl] = useState(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [loc, setLoc] = useState({ ky: '', roomId: '', trangThai: '', tim: '', trang: 0 })
  const [bung, setBung] = useState({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
  }, [router])

  useEffect(() => {
    setDangTai(true); setLoi('')
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(loc)) if (v !== '' && v !== 0) q.set(k, String(v))
    fetch('/api/admin/tokhai/filings?' + q)
      .then(r => r.json())
      .then(j => { if (j.error) setLoi(j.error); else setDl(j) })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }, [loc])

  // Đổi bộ lọc thì về trang 1, nếu không dễ rơi vào trang trống.
  const doiLoc = (k, v) => setLoc(p => ({ ...p, [k]: v, trang: 0 }))

  const cty = dl?.congTy || []
  const tomTat = cty.reduce((t, c) => ({
    chapNhan: t.chapNhan + c.chapNhan,
    tiepNhan: t.tiepNhan + c.tiepNhan,
    khongChapNhan: t.khongChapNhan + c.khongChapNhan,
    treHan: t.treHan + c.treHan,
  }), { chapNhan: 0, tiepNhan: 0, khongChapNhan: 0, treHan: 0 })

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <TabToKhai />
        <NhacHanNop />

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 mr-1">Hồ sơ đã nộp</h1>

          <select value={loc.ky} onChange={e => doiLoc('ky', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm">
            <option value="">— Tất cả các kỳ —</option>
            {(dl?.cacKy || []).map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <select value={loc.roomId} onChange={e => doiLoc('roomId', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm">
            <option value="">— Mọi phòng —</option>
            {(dl?.phong || []).map(p => <option key={p.id} value={p.id}>{p.ten}</option>)}
          </select>

          <select value={loc.trangThai} onChange={e => doiLoc('trangThai', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm">
            {LOC_TRANG_THAI.map(t => <option key={t.ma} value={t.ma}>{t.nhan}</option>)}
          </select>

          <input value={loc.tim} onChange={e => doiLoc('tim', e.target.value)}
            placeholder="Tìm công ty, mã KH, MST, mã hồ sơ…"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm flex-1 min-w-[200px] shadow-sm" />
        </div>

        {loi && <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}
        {dangTai && <p className="text-sm text-gray-400 py-10 text-center">Đang tải…</p>}

        {!dangTai && dl && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <OTong mau="xanhDuong" so={dl.tongSoCty} nhan="Công ty có hồ sơ" phu={`${dl.tongSoHoSo} hồ sơ`} />
              <OTong mau="xanhLa"  so={tomTat.chapNhan} nhan="Chấp nhận" phu="trong trang này" />
              <OTong mau="hoPhach" so={tomTat.tiepNhan} nhan="Đã tiếp nhận" phu="trong trang này" />
              <OTong mau="do"      so={tomTat.khongChapNhan} nhan="Không chấp nhận" phu="cần xử lý" />
              <OTong mau="do"      so={tomTat.treHan} nhan="Nộp trễ hạn" phu="theo ngày tiếp nhận" />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200 text-gray-500">
                    <th className="text-left px-3 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Công ty</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Phòng · Nhân viên</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Hồ sơ</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Tình hình</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Nộp gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {cty.map(c => {
                    const mo = !!bung[c.id]
                    return (
                      <Fragment key={c.id}>
                        <tr onClick={() => setBung(p => ({ ...p, [c.id]: !p[c.id] }))}
                          className="border-b border-gray-100 hover:bg-red-50/30 cursor-pointer transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className={'text-[10px] text-gray-400 transition-transform ' + (mo ? 'rotate-90' : '')}>▶</span>
                              <div>
                                <p className="font-medium text-gray-900 leading-tight">{c.ten}</p>
                                <p className="text-xs text-gray-400">{c.maKH || '—'} · MST {c.mst || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-xs text-gray-500">{c.phong} · {c.nhanVien}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums font-medium text-gray-700">{c.soHoSo}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {c.chapNhan > 0 && <Chip trangThai="accepted" ghiChu={`${c.chapNhan} chấp nhận`} />}
                              {c.tiepNhan > 0 && <Chip trangThai="received" ghiChu={`${c.tiepNhan} chờ kết quả`} />}
                              {c.khongChapNhan > 0 && <Chip trangThai="rejected" ghiChu={`${c.khongChapNhan} không chấp nhận`} />}
                              {c.treHan > 0 && <Chip trangThai="overdue" ghiChu={`${c.treHan} trễ hạn`} />}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-xs text-gray-500">{ngayDayDu(c.nopGanNhat)}</td>
                        </tr>

                        {mo && c.hoSo.map(h => (
                          <tr key={h.id} className="bg-slate-50/70 border-b border-gray-100 text-xs">
                            <td className="px-3 py-2 pl-10">
                              <span className="font-medium text-gray-800">{h.loai || 'chưa khớp danh mục'}</span>
                              <span className="text-gray-400"> · {h.ky}</span>
                              {h.boSung > 0 && <span className="text-amber-700"> · BS lần {h.boSung}</span>}
                            </td>
                            <td className="px-2 py-2 font-mono text-[11px] text-gray-400">{h.maHoSo}</td>
                            <td className="px-2 py-2 text-right text-gray-500">{ngayDayDu(h.ngayNop)}</td>
                            <td className="px-2 py-2">
                              <Chip trangThai={h.trangThai} title={h.trangThaiCong ? 'Cổng: ' + h.trangThaiCong : ''} />
                              {h.dungHan === true && <span className="ml-2 text-green-700">đúng hạn</span>}
                              {h.dungHan === false && <span className="ml-2 text-red-700 font-semibold">TRỄ HẠN</span>}
                              {!h.daGanNghiaVu && <span className="ml-2 text-gray-400">ngoài lịch hạn nộp</span>}
                            </td>
                            <td className="px-2 py-2 text-gray-500">
                              {h.ngayTiepNhan ? 'tiếp nhận ' + ngayDayDu(h.ngayTiepNhan) : ''}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>

              {!cty.length && (
                <p className="px-4 py-10 text-center text-sm text-gray-500">
                  Không có hồ sơ nào khớp bộ lọc.
                  <span className="block text-xs text-gray-400 mt-1">
                    Hồ sơ xuất hiện sau khi bấm <b>Đồng bộ tờ khai</b> ở trang Kết nối cổng.
                  </span>
                </p>
              )}
            </div>

            {dl.soTrang > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button disabled={loc.trang === 0}
                  onClick={() => setLoc(p => ({ ...p, trang: p.trang - 1 }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">
                  ← Trước
                </button>
                <span className="text-sm text-gray-500">Trang {loc.trang + 1}/{dl.soTrang} · {dl.tongSoCty} công ty</span>
                <button disabled={loc.trang >= dl.soTrang - 1}
                  onClick={() => setLoc(p => ({ ...p, trang: p.trang + 1 }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">
                  Sau →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
