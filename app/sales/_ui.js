'use client'
// Thành phần giao diện + nhãn dùng chung cho 3 trang Phòng Kinh doanh (/sales, /sales/quotes,
// /sales/report). File bắt đầu bằng "_" nên Next không coi là route.
import { useEffect, useState } from 'react'

// Phương án B "Xanh báo giá" (chốt 2026-09-11) — màu + kiểu dáng ở app/sales/sales.css (.sales-ui ...)
export const BRAND = '#2A6CA8'
export const GOLD = '#C9A027'

export const STAGES = [
  { k: 'moi',      label: 'Mới',          cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  { k: 'tu_van',   label: 'Đang tư vấn',  cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { k: 'bao_gia',  label: 'Đã báo giá',   cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  { k: 'gui_hd',   label: 'Đã gửi HĐ',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  { k: 'chot',     label: 'Chốt HĐ',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { k: 'that_bai', label: 'Không thành',  cls: 'bg-gray-100 text-gray-500 border-gray-200' },
]
export const stageOf = k => STAGES.find(s => s.k === k) || STAGES[0]

export const NEEDS = [
  { k: 'ke_toan',    label: 'Kế toán trọn gói' },
  { k: 'hcns',       label: 'HCNS – BHXH' },
  { k: 'thanh_lap',  label: 'Thành lập doanh nghiệp' },
  { k: 'dich_vu_le', label: 'Dịch vụ lẻ' },
  { k: 'khac',       label: 'Khác' },
]
export const needLabel = k => NEEDS.find(n => n.k === k)?.label || '—'

export const ACT_KINDS = [
  { k: 'goi',   label: '📞 Gọi điện' },
  { k: 'zalo',  label: '💬 Zalo/nhắn tin' },
  { k: 'gap',   label: '🤝 Gặp trực tiếp' },
  { k: 'email', label: '✉️ Email' },
  { k: 'khac',  label: '📝 Khác' },
]
export const actLabel = k => k === 'he_thong' ? '⚙️ Hệ thống' : (ACT_KINDS.find(a => a.k === k)?.label || k)

export const fmt = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('vi-VN')
export const fmtMoney = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('vi-VN') + ' đ'

// "Hôm nay" theo giờ Việt Nam (máy nhân viên đặt sai múi giờ vẫn ra đúng ngày).
export function todayVN(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
export const isoVN = ts => ts ? todayVN(new Date(ts)) : ''
export const dmy = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m + '/' + y }
export const dmyTime = ts => ts ? new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

// Bộ lọc kỳ Ngày · Tháng · Năm · Tất cả (mặc định tháng hiện tại) — dùng chung báo giá + báo cáo.
export function defaultPeriod() {
  const t = todayVN()
  return { mode: 'month', day: t, month: t.slice(0, 7), year: Number(t.slice(0, 4)) }
}
export function inPeriod(iso, p) {
  const d = String(iso || '').slice(0, 10)
  if (!d) return false
  if (p.mode === 'day') return d === p.day
  if (p.mode === 'month') return d.slice(0, 7) === p.month
  if (p.mode === 'year') return d.slice(0, 4) === String(p.year)
  return true
}
export function periodLabel(p) {
  if (p.mode === 'day') return 'ngày ' + dmy(p.day)
  if (p.mode === 'month') { const [y, m] = p.month.split('-'); return 'tháng ' + m + '/' + y }
  if (p.mode === 'year') return 'năm ' + p.year
  return 'tất cả'
}
export function PeriodFilter({ value, onChange }) {
  const chip = (k, lb) => (
    <button key={k} onClick={() => onChange({ ...value, mode: k })} className={'s-chip' + (value.mode === k ? ' on' : '')}>
      {lb}
    </button>
  )
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chip('day', 'Ngày')}{chip('month', 'Tháng')}{chip('year', 'Năm')}{chip('all', 'Tất cả')}
      {value.mode === 'day' && <input type="date" value={value.day} onChange={e => onChange({ ...value, day: e.target.value })} className="s-input !w-auto !py-1.5" />}
      {value.mode === 'month' && <input type="month" value={value.month} onChange={e => onChange({ ...value, month: e.target.value })} className="s-input !w-auto !py-1.5" />}
      {value.mode === 'year' && <input type="number" min="2020" max="2100" value={value.year} onChange={e => onChange({ ...value, year: Number(e.target.value) || value.year })} className="s-input num !w-24 !py-1.5" />}
    </div>
  )
}

export function StageChip({ stage }) {
  const s = stageOf(stage)
  return <span className={'inline-block text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ' + s.cls}>{s.label}</span>
}

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={'relative bg-white w-full md:rounded-2xl shadow-xl flex flex-col max-h-screen md:max-h-[90vh] ' + (wide ? 'md:max-w-4xl' : 'md:max-w-lg')}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2" style={{ borderColor: GOLD, background: '#E2EEF8' }}>
          <h2 className="text-base font-bold" style={{ color: BRAND }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1" aria-label="Đóng">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 flex-wrap">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={'block ' + (className || '')}>
      <span className="block text-xs font-medium text-gray-600 mb-1 truncate" title={hint ? label + ' · ' + hint : label}>
        {label}{hint && <span className="font-normal text-gray-400"> · {hint}</span>}
      </span>
      {children}
    </label>
  )
}
export const inputCls = 's-input'
export const btnPrimary = 's-btn s-btn-p'
export const btnGhost = 's-btn'

// Ô số có dấu chấm ngăn nghìn, gõ tới đâu tự chấm tới đó.
export function NumInput({ value, onChange, disabled, className }) {
  const show = Number(value) > 0 ? Number(value).toLocaleString('vi-VN') : ''
  return (
    <input type="text" inputMode="numeric" value={show} disabled={disabled}
      onChange={e => { const d = e.target.value.replace(/\D/g, ''); onChange(d ? Number(d) : 0) }}
      className={(className || inputCls) + ' num'} />
  )
}

// Thông báo nổi góc dưới — useToast() trả [node, show(msg, bad)]
export function useToast() {
  const [t, setT] = useState(null)
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), t.bad ? 6000 : 3500); return () => clearTimeout(id) }, [t])
  const node = t ? (
    <div className={'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg text-sm max-w-[92vw] ' +
      (t.bad ? 'bg-red-700 text-white' : 'bg-gray-900 text-white')}>{t.msg}</div>
  ) : null
  return [node, (msg, bad) => setT({ msg, bad: !!bad, at: Date.now() })]
}

// Ô số liệu tô màu nhạt theo ý nghĩa: red (cần chú ý), amb (đang dở), grn (đã chốt), blue, gold (tiền), sky.
export function StatCard({ label, value, unit, foot, tone = 'blue' }) {
  return (
    <div className={'s-tile tone-' + tone}>
      <span className="k">{label}</span>
      <span className="v num">{value}{unit && <small>{unit}</small>}</span>
      {foot && <span className="f">{foot}</span>}
    </div>
  )
}

// Dải tiêu đề trang: nền xanh viền vàng như banner của file báo giá SVT.MB03.
export function PageHead({ title, sub, children }) {
  return (
    <div className="s-head">
      <div className="min-w-0">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap items-center">{children}</div>}
    </div>
  )
}

// Gọi API JSON: trả { ok, data } — data là JSON trả về (kể cả khi lỗi, để đọc data.error).
export async function api(url, opts = {}) {
  const init = { ...opts }
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    init.body = JSON.stringify(opts.body)
    init.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  }
  try {
    const r = await fetch(url, init)
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: { error: 'Mất kết nối — kiểm tra mạng rồi thử lại' } }
  }
}
