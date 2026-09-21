'use client'
// Kết nối tài khoản cổng thuế — Phân hệ Tờ khai, nhịp A.
//
// Trang riêng, KHÔNG đụng vào các màn hình đang chạy, để hỏng gì cũng không ảnh hưởng nghiệp vụ
// kế toán hằng ngày.
//
// ⚠ Nút "Kiểm tra kết nối" chỉ chạy khi mở app ở máy tại Việt Nam (localhost): cổng Dịch vụ công
//   chặn IP nước ngoài nên trên app.savitax.vn (Vercel đặt ở Singapore) sẽ báo lỗi mạng.
//   Nhịp B sẽ làm tiện ích Chrome để production dùng được.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

export default function TrangKetNoi() {
  const router = useRouter()
  const [dsCty, setDsCty]   = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi]       = useState('')
  const [timKiem, setTimKiem] = useState('')
  const [mo, setMo]         = useState(null)   // công ty đang mở ô nhập

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
  }, [router])

  const taiDs = () => {
    setDangTai(true)
    fetch('/api/admin/tokhai/overview')
      .then(r => r.json())
      .then(j => { if (j.error) setLoi(j.error); else setDsCty(j.congTy || []) })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }
  useEffect(taiDs, [])

  const loc = dsCty.filter(c => {
    const t = timKiem.trim().toLowerCase()
    if (!t) return true
    return (c.ten || '').toLowerCase().includes(t)
      || (c.maKH || '').toLowerCase().includes(t)
      || (c.mst || '').includes(t)
  })

  const daNoi = dsCty.filter(c => c.trangThaiTaiKhoan === 'active').length

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-lg font-bold text-gray-800">Kết nối cổng thuế</h1>
          <span className="text-sm text-gray-500">{daNoi}/{dsCty.length} công ty đã kết nối</span>
          <input value={timKiem} onChange={e => setTimKiem(e.target.value)}
            placeholder="Tìm tên công ty, mã KH, MST…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[220px]" />
        </div>

        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Nút <b>Kiểm tra kết nối</b> chỉ chạy khi mở app bằng <b>localhost trên máy tại Việt Nam</b>.
          Cổng Dịch vụ công chặn máy chủ nước ngoài nên trên app.savitax.vn sẽ báo lỗi mạng — phần
          này sẽ dùng được cho mọi nhân viên sau khi có tiện ích Chrome.
        </div>

        {loi && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}
        {dangTai && <p className="text-sm text-gray-400 py-8 text-center">Đang tải…</p>}

        <div className="space-y-2">
          {!dangTai && loc.slice(0, 60).map(c => (
            <DongCongTy key={c.id} cty={c} dangMo={mo === c.id}
              onMo={() => setMo(mo === c.id ? null : c.id)} onXong={taiDs} />
          ))}
          {!dangTai && loc.length > 60 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Còn {loc.length - 60} công ty nữa — gõ vào ô tìm kiếm để thu hẹp.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function DongCongTy({ cty, dangMo, onMo, onXong }) {
  const [tenDN, setTenDN]     = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [dangLuu, setDangLuu] = useState(false)
  const [thongBao, setThongBao] = useState(null)   // { loai: 'ok'|'loi'|'cho', chu }
  const [captcha, setCaptcha] = useState({ maPhien: null, anh: null, ma: '' })
  const [daCo, setDaCo]       = useState(null)

  useEffect(() => {
    if (!dangMo) return
    fetch('/api/admin/tokhai/account?clientId=' + cty.id)
      .then(r => r.json())
      .then(j => {
        const dvc = (j.taiKhoan || []).find(t => t.portal === 'dvc')
        setDaCo(dvc || null)
        // Gợi ý sẵn tên đăng nhập theo MST — 100% tài khoản doanh nghiệp có dạng <MST>-QL.
        setTenDN(dvc?.username || (cty.mst ? cty.mst + '-QL' : ''))
      })
      .catch(() => {})
  }, [dangMo, cty.id, cty.mst])

  async function luu() {
    setDangLuu(true); setThongBao(null)
    try {
      const r = await fetch('/api/admin/tokhai/account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: cty.id, portal: 'dvc', username: tenDN, matKhau: matKhau || undefined }),
      })
      const j = await r.json()
      if (j.error) setThongBao({ loai: 'loi', chu: j.error })
      else { setThongBao({ loai: 'ok', chu: 'Đã lưu tài khoản' }); setMatKhau(''); onXong() }
    } catch (e) { setThongBao({ loai: 'loi', chu: e.message }) }
    setDangLuu(false)
  }

  async function batDauKiem() {
    setThongBao({ loai: 'cho', chu: 'Đang mở phiên với cổng thuế…' })
    setCaptcha({ maPhien: null, anh: null, ma: '' })
    try {
      const r = await fetch('/api/admin/tokhai/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: cty.id }),
      })
      const j = await r.json()
      if (j.error) { setThongBao({ loai: 'loi', chu: j.error }); return }
      setCaptcha({ maPhien: j.maPhien, anh: j.anhCaptcha, ma: '' })
      setThongBao({ loai: 'cho', chu: 'Nhìn ảnh, gõ mã rồi bấm Xác nhận. Phiên sống 3 phút.' })
    } catch (e) { setThongBao({ loai: 'loi', chu: e.message }) }
  }

  async function guiCaptcha() {
    if (!captcha.ma.trim()) return
    setThongBao({ loai: 'cho', chu: 'Đang đăng nhập cổng…' })
    try {
      const r = await fetch('/api/admin/tokhai/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maPhien: captcha.maPhien, captcha: captcha.ma }),
      })
      const j = await r.json()
      if (j.error) { setThongBao({ loai: 'loi', chu: j.error }); setCaptcha({ maPhien: null, anh: null, ma: '' }); return }

      if (j.ket_qua === 'sai_captcha') {
        // Gõ sai mã KHÔNG tính là sai mật khẩu — cổng kiểm captcha trước. Cho gõ lại ngay.
        setCaptcha({ maPhien: j.maPhien, anh: j.anhCaptcha, ma: '' })
        setThongBao({ loai: 'loi', chu: 'Mã captcha chưa đúng — ảnh mới đã hiện, gõ lại giúp em. Dễ nhầm số 0 với chữ o.' })
        return
      }
      setCaptcha({ maPhien: null, anh: null, ma: '' })
      if (j.ket_qua === 'ok') { setThongBao({ loai: 'ok', chu: '✓ ' + j.moTa }); onXong() }
      else setThongBao({ loai: 'loi', chu: 'Sai mật khẩu: ' + (j.moTa || '') + ' — đã dừng, KHÔNG thử lại để tránh khóa tài khoản của khách.' })
    } catch (e) { setThongBao({ loai: 'loi', chu: e.message }) }
  }

  const mauTrangThai = cty.trangThaiTaiKhoan === 'active' ? 'text-green-700 bg-green-50 border-green-200'
    : cty.trangThaiTaiKhoan === 'wrong_password' ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-slate-600 bg-slate-50 border-slate-200'
  const chuTrangThai = cty.trangThaiTaiKhoan === 'active' ? 'Đã kết nối'
    : cty.trangThaiTaiKhoan === 'wrong_password' ? 'Sai mật khẩu' : 'Chưa kết nối'

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button onClick={onMo} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50/60">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 text-sm leading-tight">{cty.ten}</p>
          <p className="text-xs text-gray-400">{cty.maKH || '— chưa có mã KH —'} · MST {cty.mst || '—'}</p>
        </div>
        <span className={'text-xs rounded-md border px-2 py-0.5 ' + mauTrangThai}>{chuTrangThai}</span>
        <span className="text-gray-300 text-xs">{dangMo ? '▲' : '▼'}</span>
      </button>

      {dangMo && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Tên đăng nhập cổng Dịch vụ công</label>
              <input value={tenDN} onChange={e => setTenDN(e.target.value)} placeholder="0312180502-QL"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">
                Mật khẩu {daCo && <span className="text-gray-400">(để trống = giữ nguyên)</span>}
              </label>
              <input type="password" value={matKhau} onChange={e => setMatKhau(e.target.value)}
                placeholder={daCo ? '••••••' : 'Mật khẩu cổng thuế'}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={luu} disabled={dangLuu || !tenDN}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs disabled:opacity-40">
              {dangLuu ? 'Đang lưu…' : 'Lưu tài khoản'}
            </button>
            <button onClick={batDauKiem} disabled={!daCo}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs disabled:opacity-40"
              title={daCo ? '' : 'Lưu tài khoản trước đã'}>
              Kiểm tra kết nối
            </button>
            {daCo?.last_success_at && (
              <span className="text-xs text-gray-400">
                Kết nối gần nhất: {new Date(daCo.last_success_at).toLocaleString('vi-VN')}
              </span>
            )}
          </div>

          {captcha.anh && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 flex flex-wrap items-center gap-3">
              {/* Ảnh gốc ~120x40 quá bé, số 0 và chữ o gần như giống hệt — phải phóng to. */}
              <img src={captcha.anh} alt="Mã captcha" className="bg-white rounded border border-blue-200"
                style={{ height: 88, imageRendering: 'auto' }} />
              <div className="flex-1 min-w-[180px]">
                <input value={captcha.ma} autoFocus
                  onChange={e => setCaptcha(p => ({ ...p, ma: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && guiCaptcha()}
                  placeholder="Gõ mã trong ảnh rồi Enter"
                  className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm font-mono" />
                <p className="text-[11px] text-gray-500 mt-1">Dễ nhầm: số 0 ↔ chữ o, số 1 ↔ chữ l</p>
              </div>
              <button onClick={guiCaptcha} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs">
                Xác nhận
              </button>
            </div>
          )}

          {thongBao && (
            <p className={'text-xs px-2 py-1.5 rounded-lg ' + (
              thongBao.loai === 'ok'  ? 'bg-green-50 text-green-700'
              : thongBao.loai === 'loi' ? 'bg-red-50 text-red-700'
              : 'bg-gray-50 text-gray-600')}>{thongBao.chu}</p>
          )}
        </div>
      )}
    </div>
  )
}
