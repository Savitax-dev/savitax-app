'use client'
// Thanh chọn công ty / năm / thư mục + các thông báo trạng thái thư mục — dùng chung cho các màn Soát xét báo cáo.
// Nhận nguyên kết quả của useHoSoCty. `duongDan`: trang hiện tại (đổi công ty thì ở lại đúng màn).
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NAM_BAT_DAU } from '@/lib/phanTich/thuMuc'

export function Bao({ mau, children }) {
  const lop = mau === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
  return <div className={`mb-3 px-3 py-2 rounded-xl border text-sm ${lop}`}>{children}</div>
}

// Bỏ dấu để tìm "hoang tien" ra "HOÀNG TIẾN"
const khongDau = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
// Bộ lọc danh sách công ty nhớ trên máy này (chuyển màn / tải lại không mất); trình duyệt chặn bộ nhớ thì thôi
const KHOA_LOC = 'phanTich.locCty'
const docLoc = () => { try { return JSON.parse(localStorage.getItem(KHOA_LOC) || '{}') } catch { return {} } }
const ghiLoc = o => { try { localStorage.setItem(KHOA_LOC, JSON.stringify(o)) } catch { /* bỏ qua */ } }

const NUT = 'px-2.5 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#8B1A1A] hover:text-[#8B1A1A] disabled:opacity-40 whitespace-nowrap flex-shrink-0'

//   anNamThuMuc: ẩn ô chọn năm theo thư mục (Rủi ro thuế chọn năm theo nội dung tờ khai, truyền ô riêng qua `oNam`).
export default function ThanhCongTy({ hs, duongDan, themTruoc, onDoiNam, chuChonCty = 'Chọn một công ty để xem hồ sơ dữ liệu.', anNamThuMuc = false, oNam = null, giuThamSo = '' }) {
  const router = useRouter()
  const { ctyId, dsCty, dsDaTai, cty, loi, hoTro, thuMuc, namCu, quet, nam, setNam, cacNam, qn, buoc, daChuyen, canCho } = hs
  const chonCty = id => router.replace(`${duongDan}${id ? '?cty=' + id + giuThamSo : ''}`)

  // Lọc danh sách công ty: tìm theo tên / mã KH / MST, lọc phòng, nhân viên phụ trách (chính hoặc phụ) — anh yêu cầu 28/10/2026
  const [tim, setTim] = useState('')
  const [locPhong, setLocPhong] = useState('')
  const [locNV, setLocNV] = useState('')
  useEffect(() => { const o = docLoc(); setTim(o.tim || ''); setLocPhong(o.phong || ''); setLocNV(o.nv || '') }, [])
  useEffect(() => { ghiLoc({ tim, phong: locPhong, nv: locNV }) }, [tim, locPhong, locNV])
  const dsPhong = useMemo(() => [...new Set(dsCty.map(c => c.phong).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [dsCty])
  const dsNV = useMemo(() => [...new Set(dsCty.filter(c => !locPhong || c.phong === locPhong).flatMap(c => [c.nhanVien, ...(c.nhanVienPhu || [])]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [dsCty, locPhong])
  const dsLoc = useMemo(() => {
    const q = khongDau(tim).trim()
    const ra = dsCty.filter(c => (!locPhong || c.phong === locPhong) && (!locNV || c.nhanVien === locNV || (c.nhanVienPhu || []).includes(locNV))
      && (!q || khongDau(`${c.ten} ${c.maKH} ${c.mst}`).includes(q) || String(c.mst || '').replace(/^0+/, '').includes(q.replace(/^0+/, ''))))
    return ra
  }, [dsCty, tim, locPhong, locNV])
  const dangLoc = !!(tim || locPhong || locNV)
  // Danh sách xổ xuống của ô tìm: tối đa 100 dòng (gõ thêm để thu hẹp), mũi tên lên/xuống + Enter
  const [mo, setMo] = useState(false)
  const [tro, setTro] = useState(0)
  const dsHien = dsLoc.slice(0, 100)
  const moCty = id => { setMo(false); chonCty(id) }
  return (
    <>
      {/* Dòng lọc RIÊNG, y hệt màn "Công ty của tôi" (anh chỉ 28/10/2026): phòng → nhân viên → ô tìm dài hết dòng */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {dsPhong.length > 1 && (
          <select value={locPhong} onChange={e => { setLocPhong(e.target.value); setLocNV('') }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Tất cả phòng</option>
            {dsPhong.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {dsNV.length > 1 && (
          <select value={locNV} onChange={e => setLocNV(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Tất cả nhân viên</option>
            {dsNV.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {/* Ô tìm = chọn công ty luôn (anh chỉ 28/10/2026): gõ / bấm vào là xổ danh sách, bấm một dòng là mở công ty đó */}
        <div className="relative flex-1 min-w-[220px]">
          <input value={tim} onChange={e => { setTim(e.target.value); setMo(true); setTro(0) }} onFocus={() => setMo(true)} onBlur={() => setTimeout(() => setMo(false), 150)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setMo(true); setTro(i => Math.min(i + 1, dsHien.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setTro(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter' && mo && dsHien[tro]) { e.preventDefault(); moCty(dsHien[tro].id) }
              else if (e.key === 'Escape') setMo(false)
            }}
            placeholder={dsDaTai ? 'Tìm và chọn công ty — tên, mã KH, MST…' : 'Đang tải danh sách công ty…'} title="Gõ không dấu cũng được · mũi tên lên/xuống + Enter để chọn"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full bg-white" />
          {mo && dsDaTai && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-auto">
              <p className="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100 sticky top-0 bg-white">
                {dsLoc.length}/{dsCty.length} công ty{dsLoc.length > dsHien.length ? ` · hiện ${dsHien.length} đầu tiên, gõ thêm để thu hẹp` : ''}
              </p>
              {!dsHien.length && <p className="px-3 py-3 text-sm text-gray-500">Không có công ty nào khớp.</p>}
              {dsHien.map((c, i) => (
                <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); moCty(c.id) }} onMouseEnter={() => setTro(i)}
                  className={`w-full text-left px-3 py-1.5 border-b border-gray-50 ${i === tro ? 'bg-[#8B1A1A]/5' : ''} ${String(c.id) === String(ctyId) ? 'font-semibold' : ''}`}>
                  <span className="block text-sm text-gray-800 truncate">{c.ten}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{[c.maKH, c.mst && 'MST ' + c.mst, c.nhanVien, c.phong].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {dangLoc && <button type="button" onClick={() => { setTim(''); setLocPhong(''); setLocNV('') }} className="text-xs text-gray-500 hover:text-[#8B1A1A] whitespace-nowrap" title="Bỏ mọi bộ lọc">Bỏ lọc</button>}
      </div>
      {/* MỘT DÒNG (anh chỉ 26/10/2026: nút bị rớt xuống dòng 2) — chỉ hiện khi đã chọn công ty */}
      {ctyId && <div className="flex items-center gap-2 mb-4 rounded-2xl bg-white border border-gray-100 shadow-sm px-3 py-2.5 min-w-0">
        <span className="text-sm font-bold text-gray-800 truncate min-w-0" title={cty?.ten}>{cty ? `${cty.ten}${cty.maKH ? ` (${cty.maKH})` : ''}` : 'Đang tải…'}</span>
        {cty && (
          <span className="hidden xl:inline text-xs text-gray-500 tabular-nums whitespace-nowrap" title={`MST ${cty.mst || '—'} · hồ sơ công ty ghi khai ${cty.kyKhai === 'thang' ? 'tháng' : 'quý'}`}>
            MST {cty.mst || '—'} · khai {cty.kyKhai === 'thang' ? 'tháng' : 'quý'}{cty.laHkd ? ' · HKD' : ''}
          </span>
        )}
        {oNam}
        {!anNamThuMuc && cacNam.length > 0 && (
          <select value={nam ?? ''} onChange={e => { setNam(Number(e.target.value)); onDoiNam?.() }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white font-semibold flex-shrink-0">
            {cacNam.map(n => <option key={n} value={n}>Năm {n}{n < NAM_BAT_DAU ? ' (năm cũ)' : ''}</option>)}
          </select>
        )}
        {(qn?.tuNamCu || thuMuc?.ten) && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-mono min-w-0 max-w-[220px] truncate" title={`Thư mục đang đọc: ${qn?.tuNamCu || thuMuc?.ten}`}>
            📁 {qn?.tuNamCu || thuMuc?.ten}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {themTruoc}
          {cty && hoTro && (
            <button type="button" onClick={hs.themNamCu} className={NUT} title="Thêm dữ liệu năm cũ: trỏ vào một thư mục năm ≤ 2025 đã tải về máy">＋ Năm cũ</button>
          )}
          {cty && hoTro && (thuMuc?.trangThai === 'san_sang' || namCu.length > 0) && (
            <button type="button" onClick={hs.troThuMuc} className={NUT} title="Trỏ lại vào thư mục CÔNG TY (dùng chung với Tờ khai)">{thuMuc?.trangThai === 'san_sang' ? 'Trỏ lại' : '📁 Trỏ thư mục'}</button>
          )}
          {quet && <button type="button" onClick={hs.docLai} disabled={!!buoc} className={NUT}>↻ Đọc lại</button>}
        </div>
      </div>}

      {!hoTro && <Bao mau="amber">Trình duyệt này không mở được thư mục trên máy. Dùng Chrome hoặc Edge trên máy tính.</Bao>}
      {loi && <Bao mau="red">{loi}</Bao>}
      {(quet?.nhac || []).map((c, i) => <Bao key={'nhac' + i} mau="amber">⚠ {c}</Bao>)}
      {daChuyen && (
        <Bao mau="amber">Thư mục “{daChuyen}” là thư mục NĂM, không phải thư mục công ty — app đã chuyển nó sang “Thư mục năm trỏ riêng” và gỡ khỏi chỗ dùng chung với Tờ khai (để Tờ khai không tạo nhầm thư mục lồng bên trong). Tờ khai của công ty này cần trỏ lại vào thư mục CÔNG TY.</Bao>
      )}
      {!ctyId && <p className="text-sm text-gray-500 py-10 text-center">{chuChonCty}</p>}
      {ctyId && !cty && !dsDaTai && <p className="text-sm text-gray-500 py-3">Đang tải danh sách công ty… (chạy trên máy thì chậm hơn bản thật)</p>}
      {ctyId && !cty && dsDaTai && !loi && <Bao mau="amber">Công ty này không nằm trong phạm vi của anh/chị (hoặc đã ngưng dịch vụ).</Bao>}

      {cty && thuMuc?.trangThai === 'chua_chon' && !namCu.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-700 font-semibold">Chưa trỏ thư mục của công ty này trên máy.</p>
          <p className="text-xs text-gray-500 mt-1">Trỏ vào thư mục CÔNG TY (bên trong có “2. HỒ SƠ KẾ TOÁN”). App chỉ xin quyền đọc; Tờ khai dùng chung thư mục này.</p>
          <button type="button" onClick={hs.troThuMuc} disabled={!hoTro}
            className="mt-4 px-4 py-2 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212] disabled:opacity-40">📁 Trỏ thư mục công ty</button>
        </div>
      )}
      {cty && canCho && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800 flex-1">Trình duyệt cần anh/chị cho phép đọc lại thư mục (thường gặp sau khi mở lại Chrome).</p>
          <button type="button" onClick={hs.choPhepLai} className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold bg-amber-600 hover:bg-amber-700">Cho phép đọc</button>
        </div>
      )}
      {buoc && <p className="text-sm text-gray-500 py-3 flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border-2 border-[#8B1A1A] border-t-transparent animate-spin" />{buoc}</p>}

      {quet && !cacNam.length && !buoc && (
        <Bao mau="amber">
          Không thấy thư mục năm {NAM_BAT_DAU} trở đi trong thư mục đã trỏ
          {quet.namBoQua.length ? ` (có năm ${quet.namBoQua.join(', ')} — năm cũ thì bấm “Thêm dữ liệu năm cũ” và trỏ thẳng vào thư mục năm đó)` : ''}.
        </Bao>
      )}
    </>
  )
}
