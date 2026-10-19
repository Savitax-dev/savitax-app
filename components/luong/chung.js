'use client'
// Phân hệ Tiền lương — tiện ích dùng chung cho các tab (gọi API, màu, hộp thông báo).

export const pad = n => String(n).padStart(2, '0')
export const soNhap = s => { const v = String(s ?? '').replace(/[^\d]/g, ''); return v === '' ? null : Number(v) }
export const thuVN = d => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(d + 'T00:00:00Z').getUTCDay()]
export const searchKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export async function goi(url, body) {
  try {
    const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
    const j = await res.json().catch(() => ({ error: 'Máy chủ trả phản hồi không đọc được' }))
    if (!res.ok && !j.error) j.error = 'Lỗi máy chủ (' + res.status + ')'
    return j
  } catch (e) { return { error: 'Không kết nối được máy chủ: ' + (e.message || e) } }
}

// Bảng màu dùng chung cho cả trang — mỗi loại ngày một màu, giữ nguyên ở thẻ, thanh tiến độ và bảng.
export const MAU = {
  chuan: { the: 'bg-blue-50 border-blue-200', chu: 'text-blue-700', dam: 'text-blue-900', thanh: 'bg-blue-500' },
  lam:   { the: 'bg-emerald-50 border-emerald-200', chu: 'text-emerald-700', dam: 'text-emerald-900', thanh: 'bg-emerald-500' },
  phep:  { the: 'bg-amber-50 border-amber-200', chu: 'text-amber-700', dam: 'text-amber-900', thanh: 'bg-amber-400' },
  kl:    { the: 'bg-rose-50 border-rose-200', chu: 'text-rose-700', dam: 'text-rose-900', thanh: 'bg-rose-400' },
}
export const TRANG_THAI = {
  xn:   { nhan: 'Đã xác nhận', lop: 'bg-emerald-100 text-emerald-800 border-emerald-200', cham: 'bg-emerald-500' },
  nhap: { nhan: 'Đang nháp', lop: 'bg-amber-100 text-amber-800 border-amber-200', cham: 'bg-amber-500' },
  chua: { nhan: 'Chưa khai', lop: 'bg-rose-100 text-rose-800 border-rose-200', cham: 'bg-rose-500' },
}
export const trangThaiCua = c => !c ? 'chua' : c.trang_thai === 'da_xac_nhan' ? 'xn' : 'nhap'

export function HopThongBao({ msg }) {
  if (!msg) return null
  return <div className={'rounded-xl border px-4 py-2.5 text-sm ' + (msg.loai === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800')}>{msg.text}</div>
}

