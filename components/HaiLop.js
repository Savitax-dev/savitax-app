'use client'
// Xác thực 2 lớp (lib/haiLop.js) — hai khối dùng chung cho trang đăng nhập và trang Bảo mật tài khoản:
//   <NhapMaHaiLop>  nhập mã 6 số trên ứng dụng Authenticator (tài khoản đã bật)
//   <CaiDatHaiLop>  quét mã QR bằng Google Authenticator / Microsoft Authenticator rồi nhập mã đầu tiên để bật
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

const O_MA = 'w-full text-center tracking-[0.5em] text-2xl font-semibold px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/40 focus:border-[#8B1A1A]'
const NUT = 'w-full bg-[#8B1A1A] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6B1212] disabled:opacity-40'
const chiSo = v => String(v || '').replace(/\D/g, '').slice(0, 6)

function loiDe(e) {
  const m = String(e?.message || e || '')
  if (/invalid|incorrect|mismatch/i.test(m)) return 'Mã không đúng hoặc đã hết hạn — xem mã mới trên điện thoại rồi nhập lại.'
  if (/rate|too many/i.test(m)) return 'Nhập sai quá nhiều lần — chờ 1 phút rồi thử lại.'
  return m || 'Có lỗi, thử lại.'
}

export function NhapMaHaiLop({ onXong, onDoiTaiKhoan }) {
  const [ma, setMa] = useState('')
  const [loi, setLoi] = useState('')
  const [dang, setDang] = useState(false)
  const o = useRef(null)
  useEffect(() => { o.current?.focus() }, [])
  const gui = async (e) => {
    e?.preventDefault()
    if (ma.length !== 6) return
    setDang(true); setLoi('')
    const supabase = createClient()
    const { data: ds, error: e1 } = await supabase.auth.mfa.listFactors()
    const yeuTo = (ds?.totp || []).find(f => f.status === 'verified')
    if (e1 || !yeuTo) { setLoi(e1 ? loiDe(e1) : 'Không tìm thấy thiết bị 2 lớp — nhờ quản trị đặt lại.'); setDang(false); return }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: yeuTo.id, code: ma })
    if (error) { setLoi(loiDe(error)); setMa(''); setDang(false); o.current?.focus(); return }
    onXong?.()
  }
  return (
    <form onSubmit={gui} className="space-y-4">
      <div className="text-center">
        <div className="text-3xl mb-1">🔐</div>
        <div className="font-semibold text-gray-900">Xác thực 2 lớp</div>
        <p className="text-sm text-gray-500 mt-1">Mở ứng dụng <b>Google Authenticator</b> (hoặc Microsoft Authenticator) trên điện thoại, nhập mã 6 số của <b>Savitax</b>.</p>
      </div>
      <input ref={o} inputMode="numeric" autoComplete="one-time-code" value={ma} onChange={e => setMa(chiSo(e.target.value))} placeholder="••••••" className={O_MA} />
      {loi && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{loi}</div>}
      <button type="submit" disabled={dang || ma.length !== 6} className={NUT}>{dang ? 'Đang kiểm…' : 'Xác nhận'}</button>
      <p className="text-xs text-gray-400 text-center">Mất hoặc đổi điện thoại? Nhờ quản trị bấm &ldquo;Đặt lại 2 lớp&rdquo; cho tài khoản của mình.</p>
      {onDoiTaiKhoan && <button type="button" onClick={onDoiTaiKhoan} className="w-full text-xs text-gray-500 underline">Đăng nhập tài khoản khác</button>}
    </form>
  )
}

export function CaiDatHaiLop({ onXong, onBo, batBuoc = false }) {
  const [qr, setQr] = useState(null)       // { id, qr_code (svg data url), secret }
  const [ma, setMa] = useState('')
  const [loi, setLoi] = useState('')
  const [dang, setDang] = useState(false)
  const daTao = useRef(false)

  useEffect(() => {
    if (daTao.current) return
    daTao.current = true
    ;(async () => {
      const supabase = createClient()
      // Lần cài dở trước (quét QR mà chưa nhập mã) để lại yếu tố CHƯA xác nhận — gỡ đi rồi tạo mới
      const { data: ds } = await supabase.auth.mfa.listFactors()
      for (const f of (ds?.all || []).filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Savitax ' + new Date().toISOString().slice(0, 16) })
      if (error) { setLoi(loiDe(error)); return }
      setQr({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    })()
  }, [])

  const xacNhan = async (e) => {
    e?.preventDefault()
    if (!qr || ma.length !== 6) return
    setDang(true); setLoi('')
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: qr.id, code: ma })
    if (error) { setLoi(loiDe(error)); setMa(''); setDang(false); return }
    onXong?.()
  }

  return (
    <form onSubmit={xacNhan} className="space-y-4">
      <div className="text-center">
        <div className="text-3xl mb-1">🛡️</div>
        <div className="font-semibold text-gray-900">Bật xác thực 2 lớp</div>
        {batBuoc && <p className="text-xs text-amber-700 mt-1">Công ty yêu cầu mọi tài khoản bật 2 lớp trước khi vào app.</p>}
      </div>
      <ol className="text-sm text-gray-600 space-y-1.5 list-decimal pl-5">
        <li>Cài ứng dụng <b>Google Authenticator</b> (hoặc Microsoft Authenticator) trên điện thoại — App Store / CH Play.</li>
        <li>Trong ứng dụng bấm <b>＋</b> → <b>Quét mã QR</b>, quét mã bên dưới.</li>
        <li>Nhập mã 6 số ứng dụng hiện cho <b>Savitax</b>.</li>
      </ol>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- mã QR là ảnh SVG dạng data URL do Supabase trả về */}
        {qr ? <img src={qr.qr} alt="Mã QR xác thực 2 lớp" className="w-48 h-48 rounded-xl border border-gray-200 bg-white p-2" />
          : <div className="w-48 h-48 rounded-xl border border-gray-200 flex items-center justify-center text-sm text-gray-400">{loi ? '—' : 'Đang tạo mã…'}</div>}
      </div>
      {qr && <p className="text-[11px] text-gray-500 text-center break-all">Không quét được? Nhập tay khoá: <span className="font-mono text-gray-800">{qr.secret}</span></p>}
      <input inputMode="numeric" autoComplete="one-time-code" value={ma} onChange={e => setMa(chiSo(e.target.value))} placeholder="••••••" className={O_MA} />
      {loi && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{loi}</div>}
      <button type="submit" disabled={dang || !qr || ma.length !== 6} className={NUT}>{dang ? 'Đang kiểm…' : 'Bật 2 lớp'}</button>
      {onBo && <button type="button" onClick={onBo} className="w-full text-xs text-gray-500 underline">{batBuoc ? 'Đăng xuất' : 'Để sau'}</button>}
    </form>
  )
}
