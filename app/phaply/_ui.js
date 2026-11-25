'use client'
// Thành phần giao diện dùng chung các trang phân hệ Pháp lý (/phaply, /phaply/ho-so/[id], /phaply/mau, /phaply/bao-cao).
// Chép cách làm của app/sales/_ui.js; màu + kiểu ở app/phaply/phaply.css (mọi selector dưới .pl-ui). File bắt đầu "_"
// nên Next không coi là route.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BUOC, buocLabel, choLabel, BUOC_DONG } from '@/lib/phaply/hoSo'
import { NHOM } from '@/lib/phaply/nhom'

export const BRAND = '#8E1F1F'
export const GOLD = '#C9A027'

export const fmt = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('vi-VN')
export const fmtMoney = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('vi-VN') + ' đ'
export const dmy = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m + '/' + y }
export const dmyTime = ts => ts ? new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
export const thangLabel = m => m ? m.slice(5, 7) + '/' + m.slice(0, 4) : '—'

// Màu trạng thái CỐ ĐỊNH toàn phân hệ (anh duyệt mockup 25/11/2026) — thẻ số liệu, nhãn bảng, đầu hồ sơ dùng chung:
// đang xử lý xanh dương · chờ khách cam · chờ Sở / Thuế tím · cần bổ sung đỏ · trễ hạn đỏ đậm · chưa giao xám · nợ vàng · xong xanh lá
export const TONE_CHO = { khach: 'amb', so: 'tim', thue: 'tim', bo_sung: 'red' }
export function Nhan({ tone = 'xam', children, title }) {
  return <span className={'p-nhan tone-' + tone} title={title}>{children}</span>
}
export function BuocChip({ stage, ngan = true }) {
  const n = Number(stage) || 1
  return <Nhan tone={n >= BUOC_DONG ? 'grn' : n === 1 ? 'xam' : 'blue'}>{n} · {buocLabel(n, ngan)}</Nhan>
}
export function ChoChip({ k }) {
  if (!k) return null
  return <Nhan tone={TONE_CHO[k] || 'xam'}>{choLabel(k)}</Nhan>
}
export { BUOC }

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
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2" style={{ borderColor: GOLD, background: '#F8E5E1' }}>
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
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}{hint && <span className="font-normal text-gray-400"> · {hint}</span>}
      </span>
      {children}
    </label>
  )
}
export const inputCls = 'p-input'
export const btnPrimary = 'p-btn p-btn-p'
export const btnGhost = 'p-btn'

// Ô số tiền có dấu chấm ngăn nghìn, gõ tới đâu tự chấm tới đó
export function NumInput({ value, onChange, disabled, className, placeholder }) {
  const show = Number(value) > 0 ? Number(value).toLocaleString('vi-VN') : ''
  return (
    <input type="text" inputMode="numeric" value={show} disabled={disabled} placeholder={placeholder}
      onChange={e => { const d = e.target.value.replace(/\D/g, ''); onChange(d ? Number(d) : 0) }}
      className={(className || inputCls) + ' num text-right'} />
  )
}

export function useToast() {
  const [t, setT] = useState(null)
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), t.bad ? 6000 : 3500); return () => clearTimeout(id) }, [t])
  const node = t ? (
    <div className={'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg text-sm max-w-[92vw] ' +
      (t.bad ? 'bg-red-700 text-white' : 'bg-gray-900 text-white')}>{t.msg}</div>
  ) : null
  return [node, (msg, bad) => setT({ msg, bad: !!bad, at: Date.now() })]
}

export function StatCard({ label, value, unit, foot, tone = 'wine', onClick, on }) {
  const C = onClick ? 'button' : 'div'
  return (
    <C onClick={onClick} className={'p-tile tone-' + tone + (on ? ' on' : '')}>
      <span className="k">{label}</span>
      <span className="v num">{value}{unit && <small>{unit}</small>}</span>
      {foot && <span className="f">{foot}</span>}
    </C>
  )
}

// Tiêu đề trang nhẹ như Soát xét / Rủi ro thuế: biểu tượng + tên + dòng phụ xám, không khung nền (anh chốt 25/11/2026)
export function PageHead({ icon, title, sub, children }) {
  return (
    <div className="p-head">
      <div className="t">
        {icon && <span className="ic">{icon}</span>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap items-center">{children}</div>}
    </div>
  )
}

// Gọi API JSON: { ok, status, data }
export async function api(url, opts = {}) {
  const init = { ...opts }
  if (opts.body && typeof opts.body !== 'string') {
    init.body = JSON.stringify(opts.body)
    init.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  }
  try {
    const r = await fetch(url, init)
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Mất kết nối — kiểm tra mạng rồi thử lại' } }
  }
}

// Thanh chuyển giữa các NHÓM thủ tục — chia đều một khung, có biểu tượng (như components/ThanhTab.js). Báo cáo / Mẫu / Thông tin
// cá nhân / Hướng dẫn nằm ở menu trái, không lặp lại ở đây (mockup anh duyệt 25/11/2026).
const NHAN_NGAN = { tam_ngung: 'Tạm ngừng / HĐ lại' }
export function ThanhPhapLy({ dang }) {
  const ds = [...Object.entries(NHOM).map(([k, n]) => [n.duong, n.bieuTuong, NHAN_NGAN[k] || n.ten]), ['/phaply', '🗂️', 'Tất cả hồ sơ']]
  return (
    <div className="p-tabs" style={{ '--so-tab': ds.length }}>
      {ds.map(([href, ic, lb]) => <Link key={href} href={href} className={'p-tab' + (dang === href ? ' on' : '')} title={lb}><span className="ic">{ic}</span><span className="tx">{lb}</span></Link>)}
    </div>
  )
}

// Thanh tab TRONG một trang (nút, không đổi đường dẫn) — cùng kiểu ThanhPhapLy. ds: [[khoá, biểu tượng, nhãn, đếm?]]
export function ThanhTabNut({ ds, dang, chon }) {
  return (
    <div className="p-tabs" style={{ '--so-tab': ds.length }}>
      {ds.map(([k, ic, lb, dem]) => (
        <button key={k} className={'p-tab' + (dang === k ? ' on' : '')} onClick={() => chon(k)} title={lb}>
          <span className="ic">{ic}</span><span className="tx">{lb}</span>{dem ? <span className="dem">{dem}</span> : null}
        </button>
      ))}
    </div>
  )
}
