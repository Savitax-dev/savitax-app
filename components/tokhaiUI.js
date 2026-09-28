'use client'
// Bộ phần tử giao diện dùng chung cho Phân hệ Tờ khai.
//
// Gom về một chỗ để 4 màn hình nói cùng một ngôn ngữ màu: cùng một trạng thái thì ở đâu cũng
// một màu, một chữ. Trước đây mỗi trang tự định nghĩa nên nhìn rời rạc.
//
// Nguyên tắc: MÀU LUÔN ĐI KÈM CHỮ — không bao giờ chỉ dùng màu để phân biệt trạng thái, vì
// người phân biệt màu kém sẽ không đọc được bảng.

// ── Màu theo ý nghĩa (lấy đúng bảng màu trong tài liệu bàn giao) ──────────────
export const MAU = {
  xanhDuong: { chu: 'text-blue-700',   nen: 'bg-blue-50',   vien: 'border-blue-200',   dam: 'bg-blue-500' },
  xanhLa:    { chu: 'text-green-700',  nen: 'bg-green-50',  vien: 'border-green-200',  dam: 'bg-green-500' },
  hoPhach:   { chu: 'text-amber-700',  nen: 'bg-amber-50',  vien: 'border-amber-200',  dam: 'bg-amber-500' },
  xam:       { chu: 'text-slate-600',  nen: 'bg-slate-50',  vien: 'border-slate-200',  dam: 'bg-slate-400' },
  do:        { chu: 'text-red-700',    nen: 'bg-red-50',    vien: 'border-red-200',    dam: 'bg-red-500' },
  tim:       { chu: 'text-purple-700', nen: 'bg-purple-50', vien: 'border-purple-200', dam: 'bg-purple-500' },
}

// Trạng thái tờ khai — dùng chung cho mọi bảng và mọi chip trong phân hệ.
export const TRANG_THAI = {
  accepted:    { nhan: 'Chấp nhận',       mau: 'xanhLa' },
  received:    { nhan: 'Đã tiếp nhận',    mau: 'hoPhach' },
  rejected:    { nhan: 'Không chấp nhận', mau: 'do' },
  overdue:     { nhan: 'Quá hạn',         mau: 'do' },
  not_filed:   { nhan: 'Chưa nộp',        mau: 'xam' },
  no_activity: { nhan: 'Không phát sinh', mau: 'xam' },
}

export function Chip({ trangThai, ghiChu, title }) {
  const tt = TRANG_THAI[trangThai] || TRANG_THAI.not_filed
  const m = MAU[tt.mau]
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-medium ${m.nen} ${m.chu} ${m.vien}`}
      title={title || ''}>
      <span className={'w-1.5 h-1.5 rounded-full ' + m.dam} />
      {ghiChu || tt.nhan}
    </span>
  )
}

// Ô tổng hợp đầu trang.
export function OTong({ mau = 'xam', so, nhan, phu }) {
  const m = MAU[mau] || MAU.xam
  return (
    <div className={`rounded-2xl border ${m.vien} ${m.nen} px-3 py-2.5 shadow-sm`}>
      <p className={`text-2xl font-bold leading-none tabular-nums ${m.chu}`}>{so}</p>
      <p className={`text-xs mt-1.5 font-medium ${m.chu} opacity-80`}>{nhan}</p>
      {phu && <p className="text-[11px] text-gray-400 mt-0.5">{phu}</p>}
    </div>
  )
}

// Thanh phần trăm + số. chiSo = chỉ hiện số, không hiện thanh (dùng cho cột hẹp).
export function ThanhPhanTram({ v, chiSo }) {
  const mau = v === null || v === undefined ? 'text-gray-300'
    : v >= 90 ? 'text-green-700' : v >= 70 ? 'text-amber-700' : 'text-red-700'
  const thanh = v === null || v === undefined ? 'bg-gray-200'
    : v >= 90 ? 'bg-green-500' : v >= 70 ? 'bg-amber-400' : 'bg-red-400'
  const chu = v === null || v === undefined ? '—' : v + '%'

  if (chiSo) return <span className={'text-xs font-semibold tabular-nums ' + mau}>{chu}</span>
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-16 flex-shrink-0">
        <div className={'h-full rounded-full transition-all ' + thanh}
          style={{ width: Math.min(100, v || 0) + '%' }} />
      </div>
      <span className={'text-xs font-semibold tabular-nums ' + mau}>{chu}</span>
    </div>
  )
}

// Số 0 hiện thành gạch ngang mờ — mắt lướt qua bảng chỉ dừng ở chỗ có số.
export const soHoacGach = n => (n ? n : <span className="text-gray-300">—</span>)

export const ngayVN = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—')
export const ngayDayDu = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
export const gioVN = s => s
  ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : <span className="text-gray-300">chưa đồng bộ</span>
