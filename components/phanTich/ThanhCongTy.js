'use client'
// Thanh chọn công ty / năm / thư mục + các thông báo trạng thái thư mục — dùng chung cho các màn Soát xét báo cáo.
// Nhận nguyên kết quả của useHoSoCty. `duongDan`: trang hiện tại (đổi công ty thì ở lại đúng màn).
import { useRouter } from 'next/navigation'
import { NAM_BAT_DAU } from '@/lib/phanTich/thuMuc'

export function Bao({ mau, children }) {
  const lop = mau === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
  return <div className={`mb-3 px-3 py-2 rounded-xl border text-sm ${lop}`}>{children}</div>
}

const NUT = 'px-2.5 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#8B1A1A] hover:text-[#8B1A1A] disabled:opacity-40 whitespace-nowrap flex-shrink-0'

//   anNamThuMuc: ẩn ô chọn năm theo thư mục (Rủi ro thuế chọn năm theo nội dung tờ khai, truyền ô riêng qua `oNam`).
export default function ThanhCongTy({ hs, duongDan, themTruoc, onDoiNam, chuChonCty = 'Chọn một công ty để xem hồ sơ dữ liệu.', anNamThuMuc = false, oNam = null, giuThamSo = '' }) {
  const router = useRouter()
  const { ctyId, dsCty, dsDaTai, cty, loi, hoTro, thuMuc, namCu, quet, nam, setNam, cacNam, qn, buoc, daChuyen, canCho } = hs
  const chonCty = id => router.replace(`${duongDan}${id ? '?cty=' + id + giuThamSo : ''}`)
  return (
    <>
      {/* MỘT DÒNG (anh chỉ 26/10/2026: nút bị rớt xuống dòng 2) — ô công ty co giãn, phần chữ phụ rút gọn, rê chuột xem đủ */}
      <div className="flex items-center gap-2 mb-4 rounded-2xl bg-white border border-gray-100 shadow-sm px-3 py-2.5 min-w-0">
        <select value={ctyId} onChange={e => chonCty(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white font-semibold flex-1 min-w-[200px] max-w-[400px]">
          <option value="">{dsDaTai ? '— Chọn công ty —' : 'Đang tải danh sách công ty…'}</option>
          {dsCty.map(c => <option key={c.id} value={c.id}>{c.ten}{c.maKH ? ` (${c.maKH})` : ''}</option>)}
        </select>
        {cty && (
          <span className="hidden 2xl:inline text-xs text-gray-500 tabular-nums whitespace-nowrap" title={`MST ${cty.mst || '—'} · hồ sơ công ty ghi khai ${cty.kyKhai === 'thang' ? 'tháng' : 'quý'}`}>
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
      </div>

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
