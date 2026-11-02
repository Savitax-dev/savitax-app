'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { trangThaiHaiLop, TAT_HAI_LOP, BAT_BUOC_HAI_LOP } from '@/lib/haiLop'
import { NhapMaHaiLop, CaiDatHaiLop } from '@/components/HaiLop'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [email,        setEmail]        = useState('')
  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [loading,      setLoading]      = useState(true)
  const [canMaDoiMk,   setCanMaDoiMk]   = useState(false)
  // Xác thực 2 lớp (lib/haiLop.js): null = đang đọc · { daBat } · 'cai' = đang quét QR
  const [haiLop,       setHaiLop]       = useState(null)
  const [moCai,        setMoCai]        = useState(false)
  const [tbHaiLop,     setTbHaiLop]     = useState('')

  const docHaiLop = async () => setHaiLop(await trangThaiHaiLop(createClient()))
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      setEmail(sd.session.user.email || '')
      setHaiLop(await trangThaiHaiLop(supabase))
      setLoading(false)
    }
    init()
  }, [router])

  const tatHaiLop = async () => {
    if (!confirm('Tắt xác thực 2 lớp? Tài khoản sẽ chỉ còn bảo vệ bằng mật khẩu.')) return
    const supabase = createClient()
    const { data } = await supabase.auth.mfa.listFactors()
    for (const f of data?.totp || []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (error) { setTbHaiLop('Không tắt được: ' + error.message); return }
    }
    await supabase.auth.refreshSession()
    setTbHaiLop('Đã tắt xác thực 2 lớp.'); docHaiLop()
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (newPass.length < 6) { setError('Mật khẩu mới phải có ít nhất 6 ký tự'); return }
    if (newPass !== confirmPass) { setError('Mật khẩu xác nhận không khớp'); return }

    setSaving(true)
    const supabase = createClient()

    // Xác thực lại mật khẩu hiện tại trước khi đổi (tránh đổi nhầm khi quên đăng xuất ở máy khác)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPass })
    if (signInErr) {
      setError('Mật khẩu hiện tại không đúng')
      setSaving(false)
      return
    }
    // Đăng nhập lại làm phiên tụt về "chỉ mật khẩu" — tài khoản đã bật 2 lớp phải nhập mã 6 số rồi mới đổi
    if ((await trangThaiHaiLop(supabase)).canMa) { setCanMaDoiMk(true); setSaving(false); return }
    await doiMatKhau()
  }

  const doiMatKhau = async () => {
    setCanMaDoiMk(false)
    const supabase = createClient()
    const { error: updErr } = await supabase.auth.updateUser({ password: newPass })
    if (updErr) {
      setError(updErr.message)
      setSaving(false)
      return
    }

    setSuccess('Đổi mật khẩu thành công!')
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
    setSaving(false)
  }

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Đang tải...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5 max-w-md">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Đổi mật khẩu</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tài khoản: {email}</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mật khẩu hiện tại</label>
            <input type="password" required value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#8B1A1A' }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mật khẩu mới</label>
            <input type="password" required value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#8B1A1A' }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Xác nhận mật khẩu mới</label>
            <input type="password" required value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#8B1A1A' }} />
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {success && <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">{success}</div>}

          <button type="submit" disabled={saving}
            className="w-full text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#8B1A1A' }}>
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </form>
        {canMaDoiMk && (
          <div className="mt-3 bg-white border border-amber-200 rounded-2xl p-4">
            <NhapMaHaiLop onXong={doiMatKhau} />
          </div>
        )}

        {/* Xác thực 2 lớp — tự bật / tắt (lib/haiLop.js, components/HaiLop.js). Bản demo không dùng (TAT_HAI_LOP). */}
        {!TAT_HAI_LOP && haiLop && (
          <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔐</span>
              <h2 className="font-semibold text-gray-900 flex-1">Xác thực 2 lớp</h2>
              {haiLop.daBat
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Đang bật</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">Chưa bật</span>}
            </div>
            <p className="text-sm text-gray-500 mb-3">Đăng nhập cần thêm mã 6 số trên ứng dụng Google Authenticator / Microsoft Authenticator — lộ mật khẩu kẻ gian cũng không vào được. Chỉ hỏi mã khi đăng nhập máy mới hoặc sau khi đăng xuất.</p>
            {tbHaiLop && <div className="mb-3 bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">{tbHaiLop}</div>}
            {moCai ? (
              <CaiDatHaiLop onXong={() => { setMoCai(false); setTbHaiLop('Đã bật xác thực 2 lớp. Lần đăng nhập sau app sẽ hỏi mã 6 số.'); docHaiLop() }} onBo={() => setMoCai(false)} />
            ) : haiLop.daBat ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {/* Bỏ giấy "không hỏi lại trên máy này" (lib/haiLopThietBi.js) — tắt-bật lại 2 lớp thì MỌI máy đều bị quên */}
                <button onClick={async () => { await fetch('/api/hai-lop/thiet-bi', { method: 'DELETE' }); setTbHaiLop('Đã quên máy này — lần đăng nhập sau sẽ hỏi mã 6 số.') }} className="text-sm text-gray-500 underline">Quên máy này</button>
                {!BAT_BUOC_HAI_LOP && <button onClick={tatHaiLop} className="text-sm text-gray-500 underline">Tắt 2 lớp (đổi điện thoại: tắt rồi bật lại)</button>}
              </div>
            ) : (
              <button onClick={() => { setTbHaiLop(''); setMoCai(true) }} className="w-full text-white py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#8B1A1A' }}>🛡️ Bật xác thực 2 lớp</button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
