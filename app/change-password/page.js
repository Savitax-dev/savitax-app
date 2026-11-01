'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

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

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      setEmail(sd.session.user.email || '')
      setLoading(false)
    }
    init()
  }, [router])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (newPass.length < 6) { setError('Mật khẩu mới phải có ít nhất 6 ký tự'); return }
    if (newPass !== confirmPass) { setError('Mật khẩu xác nhận không khớp'); return }

    if (process.env.NEXT_PUBLIC_DEMO_MODE === '1' && String(email || '').toLowerCase().endsWith('@demo.savitax.vn')) {
      setError('Bản demo: tài khoản demo dùng chung nên không đổi mật khẩu được.'); return
    }
    setSaving(true)
    const supabase = createClient()

    // Xác thực lại mật khẩu hiện tại trước khi đổi (tránh đổi nhầm khi quên đăng xuất ở máy khác)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPass })
    if (signInErr) {
      setError('Mật khẩu hiện tại không đúng')
      setSaving(false)
      return
    }

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
      </div>
    </AppShell>
  )
}
