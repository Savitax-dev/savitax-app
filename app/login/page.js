'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { xoaDauNhacNho } from '@/components/NotificationBell'
import { xoaKhoiDong } from '@/lib/khoiDong'
import { trangThaiHaiLop } from '@/lib/haiLop'
import { NhapMaHaiLop, CaiDatHaiLop } from '@/components/HaiLop'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [logoError, setLogoError] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    xoaKhoiDong()   // người đăng nhập mới không dùng lại quyền đã nhớ của phiên trước

    if (error) {
      setError('Email hoặc mật khẩu không đúng')
      setLoading(false)
    } else {
      // Mỗi lần đăng nhập là một lần "mới vào app": bảng nhắc nhở checklist ở Trang chủ phải tự mở
      // lại. Xoá ở đây (không chỉ lúc đăng xuất) để bắt cả ca phiên hết hạn bị đẩy về trang này.
      xoaDauNhacNho()
      // Xác thực 2 lớp (lib/haiLop.js): đã bật → hỏi mã 6 số; bắt buộc mà chưa bật → quét QR cài đặt
      const tt = await trangThaiHaiLop(supabase)
      setLoading(false)
      if (tt.canMa) setBuoc('ma')
      else if (tt.canCaiDat) setBuoc('cai')
      else vaoApp()
    }
  }

  // Bước 2 lớp: 'ma' = nhập mã · 'cai' = bắt buộc cài đặt · null = form mật khẩu
  const [buoc, setBuoc] = useState(null)
  const vaoApp = () => { xoaKhoiDong(); router.push('/dashboard') }
  const dangXuat = async () => { await createClient().auth.signOut(); xoaKhoiDong(); setBuoc(null); setPassword('') }
  // Bị đẩy về đây khi đang có phiên mà chưa đủ 2 lớp (AppShell / máy chủ chặn) → mở thẳng bước còn thiếu
  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!data?.session) return
      const tt = await trangThaiHaiLop(supabase)
      if (tt.canMa) setBuoc('ma'); else if (tt.canCaiDat) setBuoc('cai')
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo & Title */}
        <div className="text-center mb-8">
          {!logoError ? (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 overflow-hidden bg-white shadow-sm border border-gray-100 p-1.5">
              <Image
                src="/logo-savitax.png"
                alt="Savitax"
                width={56}
                height={56}
                className="object-contain w-full h-full"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg,#8B1A1A,#6B1212)' }}>
              <span className="text-white text-xl font-bold">S</span>
            </div>
          )}
          <h1 className="text-2xl font-semibold text-gray-900">Savitax</h1>
          <p className="text-gray-500 text-sm mt-1">Hệ thống nội bộ</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {buoc === 'ma' && <NhapMaHaiLop onXong={vaoApp} onDoiTaiKhoan={dangXuat} />}
          {buoc === 'cai' && <CaiDatHaiLop batBuoc onXong={vaoApp} onBo={dangXuat} />}
          {!buoc && <form onSubmit={handleLogin} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ten@savitax.vn"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium
                         hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

          </form>}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Liên hệ admin để được cấp tài khoản
        </p>

      </div>
    </div>
  )
}