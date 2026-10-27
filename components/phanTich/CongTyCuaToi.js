'use client'
// Màn "Công ty của tôi" dùng chung cho Soát xét báo cáo + Rủi ro thuế.
//
// Danh sách công ty trong phạm vi người xem (máy chủ lọc: nhân viên → công ty mình phụ trách chính/phụ;
// trưởng phòng → phòng mình; quản trị → tất cả) kèm tình trạng thư mục đã trỏ trên MÁY NÀY.
// Thư mục dùng chung với Phân hệ Tờ khai: đã trỏ ở Tờ khai thì ở đây thấy luôn. App chỉ xin quyền ĐỌC.
//   tieuDe / bieuTuong: tên phân hệ · tab: thanh chuyển màn của phân hệ · nutMo(c) → { href, nhan }
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { OTongSinhDong, ChipMau, KieuBang } from '@/components/phanTich/phanTichUI'
import { coHoTro, chonThuMucChinh, layThuMucChinh, dsThuMucNamCu } from '@/lib/phanTich/khoMay'

const VAI_TRO = { chinh: 'Phụ trách chính', phu: 'Phụ trách phụ', phong: 'Trong phòng', quan_tri: 'Quản trị' }
const THU_MUC = {
  san_sang: { nhan: 'Đã trỏ', mau: 'xanhLa' },
  can_xin_lai: { nhan: 'Cần cho phép lại', mau: 'hoPhach' },
  bi_tu_choi: { nhan: 'Bị từ chối', mau: 'do' },
  nam_rieng: { nhan: 'Đã trỏ thư mục năm', mau: 'xanhDuong' },
  chua_chon: { nhan: 'Chưa trỏ', mau: 'xam' },
}

export default function CongTyCuaToi({ tieuDe, bieuTuong, tab, nutMo }) {
  const router = useRouter()
  const [ds, setDs] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [hoTro, setHoTro] = useState(true)
  const [thuMuc, setThuMuc] = useState({})        // clientId → { trangThai, ten }
  const [timKiem, setTimKiem] = useState('')
  const [phong, setPhong] = useState('')
  const [nhanVien, setNhanVien] = useState('')

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
    setHoTro(coHoTro())
    fetch('/api/admin/phantich/cong-ty').then(r => r.json())
      .then(j => { if (j.error) setLoi(j.error); else setDs(j.congTy || []) })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }, [router])

  // Đọc thư mục đã nhớ — chỉ IndexedDB trên máy, không mở hộp thoại, không gọi mạng.
  const idCty = ds.map(c => c.id).join(',')
  useEffect(() => {
    if (!hoTro || !idCty) return
    let huy = false
    ;(async () => {
      const ra = {}
      for (const id of idCty.split(',')) {
        if (huy) return
        const kq = await layThuMucChinh(id)
        if (kq.trangThai === 'chua_chon') {
          // Chỉ trỏ thư mục năm (lưu riêng, không dùng chung với Tờ khai)
          const nam = await dsThuMucNamCu(id)
          if (nam.length) { ra[id] = { trangThai: 'nam_rieng', ten: nam.map(t => t.name).join(' · ') }; continue }
        }
        ra[id] = { trangThai: kq.trangThai, ten: kq.ten || '' }
      }
      if (!huy) setThuMuc(ra)
    })()
    return () => { huy = true }
  }, [idCty, hoTro])

  async function troThuMuc(c) {
    try {
      const { tay, laNam } = await chonThuMucChinh(c.id)
      setThuMuc(p => ({ ...p, [c.id]: { trangThai: laNam ? 'nam_rieng' : 'san_sang', ten: tay.name } }))
    } catch (e) {
      if (e?.name !== 'AbortError') setLoi(e.message)
    }
  }

  const cacPhong = [...new Map(ds.filter(c => c.roomId).map(c => [c.roomId, c.phong])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'))
  const cacNV = [...new Set(ds.filter(c => !phong || c.roomId === phong).map(c => c.nhanVien).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  const t = timKiem.trim().toLowerCase()
  const dsHien = ds.filter(c => (!phong || c.roomId === phong) && (!nhanVien || c.nhanVien === nhanVien)
    && (!t || (c.ten || '').toLowerCase().includes(t) || (c.maKH || '').toLowerCase().includes(t) || (c.mst || '').includes(t)))
  const daTro = dsHien.filter(c => thuMuc[c.id]?.trangThai && thuMuc[c.id].trangThai !== 'chua_chon').length

  return (
    <AppShell>
      <KieuBang />
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{bieuTuong}</span>
          <h1 className="text-xl font-bold text-gray-800">{tieuDe}</h1>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">🔒 Chỉ đọc thư mục — không ghi gì vào Drive</span>
        </div>
        {tab}

        {!hoTro && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Trình duyệt này không mở được thư mục trên máy. Dùng Chrome hoặc Edge trên máy tính.
          </div>
        )}
        {loi && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <OTongSinhDong so={dsHien.length} nhan="Công ty trong phạm vi" mau="xanhDuong" phu="Theo công ty phụ trách / phòng" />
          <OTongSinhDong so={daTro} nhan="Đã trỏ thư mục trên máy này" mau="xanhLa" phu="Dùng chung với Tờ khai" />
          <OTongSinhDong so={dsHien.length - daTro} nhan="Chưa trỏ thư mục" mau="xam" phu="Bấm “Trỏ thư mục” ở từng dòng" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          {cacPhong.length > 1 && (
            <select value={phong} onChange={e => { setPhong(e.target.value); setNhanVien('') }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Tất cả phòng</option>
              {cacPhong.map(([id, ten]) => <option key={id} value={id}>{ten}</option>)}
            </select>
          )}
          {cacNV.length > 1 && (
            <select value={nhanVien} onChange={e => setNhanVien(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Tất cả nhân viên</option>
              {cacNV.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <input value={timKiem} onChange={e => setTimKiem(e.target.value)} placeholder="Tìm tên công ty, mã KH, MST…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[220px] bg-white" />
        </div>

        {dangTai && <p className="text-sm text-gray-400 py-8 text-center">Đang tải…</p>}
        {!dangTai && !dsHien.length && !loi && (
          <p className="text-sm text-gray-500 py-8 text-center">Không có công ty nào trong phạm vi của anh/chị.</p>
        )}

        {!dangTai && dsHien.length > 0 && (
          <div className="pt-bang overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>Công ty</th><th>Kỳ khai</th><th>Phụ trách</th><th>Thư mục trên máy này</th><th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dsHien.map(c => {
                  const tm = thuMuc[c.id]
                  const tt = THU_MUC[tm?.trangThai] || THU_MUC.chua_chon
                  const mo = nutMo(c)
                  return (
                    <tr key={c.id}>
                      <td>
                        <p className="font-semibold text-gray-800 leading-tight">{c.ten}</p>
                        <p className="text-xs text-gray-400 tabular-nums">{c.maKH || '— chưa có mã KH —'} · MST {c.mst || '—'}{c.laHkd ? ' · Hộ kinh doanh' : ''}</p>
                      </td>
                      <td className="whitespace-nowrap"><ChipMau nhan={c.kyKhai === 'thang' ? 'Tháng' : 'Quý'} mau={c.kyKhai === 'thang' ? 'tim' : 'xanhDuong'} /></td>
                      <td className="text-xs text-gray-600">
                        <p>{c.nhanVien || '—'}{c.phong ? <span className="text-gray-400"> · {c.phong}</span> : null}</p>
                        <p className="text-gray-400">{VAI_TRO[c.vaiTro]}</p>
                      </td>
                      <td>
                        <ChipMau nhan={tt.nhan} mau={tt.mau} />
                        {tm?.ten && <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate max-w-[260px]" title={tm.ten}>📁 {tm.ten}</p>}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button type="button" onClick={() => troThuMuc(c)} disabled={!hoTro}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-[#8B1A1A] hover:text-[#8B1A1A] disabled:opacity-40 mr-1.5">
                          {tm?.trangThai && tm.trangThai !== 'chua_chon' ? 'Trỏ lại' : 'Trỏ thư mục'}
                        </button>
                        <Link href={mo.href} className="px-2.5 py-1 rounded-lg text-xs text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212]">{mo.nhan}</Link>
                      </td>
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
