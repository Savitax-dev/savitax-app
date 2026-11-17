// Bản rời — khung chung thay components/AppShell của app: menu trái (cùng kiểu Sidebar app), ô "Công ty đang làm",
// dòng bản quyền. Mã màn hình của app (Soát xét, Rủi ro thuế) gọi <AppShell> như trong app và được bọc bằng khung này.
import { useState } from 'react'
import { usePathname, useSearchParams, diToi } from '../shim/dieuHuong'
import { useKho, datCaiDat } from '../kho'
import LOGO_SAVITAX from '../../public/logo-savitax.png'

/* global __PHIEN_BAN__ */
export const PHIEN_BAN = typeof __PHIEN_BAN__ !== 'undefined' ? __PHIEN_BAN__ : 'dev'

const laSoat = p => p.startsWith('/soatbaocao')
const laRuiRo = p => p.startsWith('/ruirothue')

// Đường tới một phân hệ, mở thẳng công ty đang làm nếu có
export function duongPhanHe(ma, cty) {
  if (ma === 'soat') return cty ? `/soatbaocao/ho-so?cty=${cty}` : '/soatbaocao'
  if (ma === 'ruiro') return cty ? `/ruirothue/phan-tich?cty=${cty}&xem=bang` : '/ruirothue'
  return '/'
}

function MucMenu({ href, icon, nhan, dangMo, khoa, onClick }) {
  if (khoa) return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed" title={khoa}>
      <span className="text-lg opacity-60">{icon}</span>{nhan}<span className="ml-auto text-[10px] font-semibold text-gray-400 border border-gray-200 rounded px-1">sắp có</span>
    </div>
  )
  return (
    <a href={'#' + href} onClick={onClick}
      className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ' +
        (dangMo ? 'bg-[#8B1A1A] text-white shadow-sm' : 'text-gray-600 hover:bg-red-50 hover:text-[#8B1A1A]')}>
      <span className="text-lg">{icon}</span>{nhan}
    </a>
  )
}

function NhanKhu({ children }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-3">
      <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #C9A84C60, transparent)' }} />
      <p className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#C9A84C' }}>{children}</p>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, #C9A84C60, transparent)' }} />
    </div>
  )
}

function Menu({ dong }) {
  const p = usePathname()
  const ts = useSearchParams()
  const { congTy, caiDat, khoLoi } = useKho()
  const ctyUrl = ts.get('cty') || ''
  const ctyDangLam = (laSoat(p) || laRuiRo(p)) && ctyUrl ? ctyUrl : caiDat.ctyDangLam
  const tenDonVi = caiDat.tenDonVi || 'SAVITAX'

  // Đổi công ty đang làm: đang ở màn công ty của Soát xét / Rủi ro thì mở đúng màn đó cho công ty mới
  const doiCty = id => {
    datCaiDat({ ctyDangLam: id })
    if (!id) return
    if ((laSoat(p) || laRuiRo(p)) && p !== '/soatbaocao' && p !== '/ruirothue') {
      const moi = new URLSearchParams(ts); moi.set('cty', id)
      diToi(`${p}?${moi}`)
    } else if (p === '/soatbaocao') diToi(duongPhanHe('soat', id))
    else if (p === '/ruirothue') diToi(duongPhanHe('ruiro', id))
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      <div className="flex-shrink-0 border-b border-gray-100">
        <div className="bg-gradient-to-r from-[#8B1A1A] to-[#6B1212] px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center flex-shrink-0 shadow-md p-0.5">
            <img src={caiDat.logo || LOGO_SAVITAX} alt="Logo" className="object-contain w-full h-full" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-wide uppercase truncate" title={tenDonVi}>{tenDonVi}</p>
            <p className="text-xs text-red-200">Soát xét · Rủi ro thuế</p>
          </div>
        </div>
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
          <label className="block text-[11px] text-gray-500 mb-1" htmlFor="ctyDangLam">Công ty đang làm</label>
          <select id="ctyDangLam" value={congTy.some(c => c.id === ctyDangLam) ? ctyDangLam : ''} onChange={e => doiCty(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-semibold text-gray-800">
            <option value="">{congTy.length ? '— Chọn công ty —' : '— Chưa có công ty —'}</option>
            {congTy.map(c => <option key={c.id} value={c.id}>{c.maKH} · {c.ten.replace(/^(CÔNG TY (TNHH|CP|CỔ PHẦN) |HỘ KINH DOANH )/i, '')}</option>)}
          </select>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" onClick={dong}>
        <MucMenu href="/" icon="🏠" nhan="Tổng quan" dangMo={p === '/'} />
        <MucMenu href="/cong-ty" icon="🏢" nhan="Danh sách công ty" dangMo={p === '/cong-ty'} />
        <NhanKhu>Soát xét & Rủi ro</NhanKhu>
        <MucMenu href={duongPhanHe('soat', caiDat.ctyDangLam)} icon="🔎" nhan="Soát xét báo cáo" dangMo={laSoat(p)} />
        <MucMenu href={duongPhanHe('ruiro', caiDat.ctyDangLam)} icon="⚖️" nhan="Rủi ro thuế" dangMo={laRuiRo(p)} />
        <NhanKhu>Chứng từ</NhanKhu>
        <MucMenu icon="📑" nhan="Hồ sơ chứng từ" khoa="Giai đoạn 4 — đang làm" />
        <NhanKhu>Hệ thống</NhanKhu>
        <MucMenu href="/cai-dat" icon="⚙️" nhan="Cài đặt" dangMo={p === '/cai-dat'} />
      </nav>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 text-[11px] leading-relaxed text-gray-400">
        {khoLoi && <p className="mb-1 rounded bg-red-50 px-2 py-1 text-red-700">{khoLoi}</p>}
        Bản quyền © <b className="text-[#8B1A1A]">Savitax</b> · v{PHIEN_BAN}<br />
        Chạy trên máy · dữ liệu ở trình duyệt này
      </div>
    </div>
  )
}

export default function AppShell({ children }) {
  const [mo, setMo] = useState(false)
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0"><Menu /></aside>
      {mo && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMo(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 max-w-[80vw] shadow-xl"><Menu dong={() => setMo(false)} /></aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => setMo(true)} className="p-1 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Mở menu">☰</button>
          <span className="font-bold text-[#8B1A1A]">Savitax</span>
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
