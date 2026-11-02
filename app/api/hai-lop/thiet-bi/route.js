// "Không hỏi lại trên máy này" — xác thực 2 lớp (lib/haiLopThietBi.js). Ngoài /api/admin vì phải chạy được khi phiên mới
// qua mật khẩu (aal1), lúc lib/serverAuth chưa cho vào.
//   GET    → { tinCay } máy này có giấy tin cậy hợp lệ cho tài khoản đang đăng nhập không
//   POST   → cấp giấy 30 ngày — CHỈ khi phiên vừa nhập đúng mã (aal2)
//   DELETE → bỏ tin cậy máy này
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { aalCuaToken } from '@/lib/haiLop'
import { taoGiayTinCay, kiemGiayTinCay, COOKIE_TIN_CAY, SO_NGAY_TIN_CAY, yeuToDaXacNhan } from '@/lib/haiLopThietBi'

async function phien() {
  const cs = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cs.getAll(), setAll: (ds) => { try { ds.forEach(({ name, value, options }) => cs.set(name, value, options)) } catch { /* bỏ qua */ } } },
  })
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  return { cs, user, aal: aalCuaToken(session?.access_token) }
}

export async function GET() {
  const { cs, user } = await phien()
  if (!user) return Response.json({ tinCay: false })
  return Response.json({ tinCay: kiemGiayTinCay(cs.get(COOKIE_TIN_CAY)?.value, user.id, yeuToDaXacNhan(user)) })
}

export async function POST() {
  const { cs, user, aal } = await phien()
  if (!user || aal !== 'aal2') return Response.json({ error: 'Nhập đúng mã 6 số trước' }, { status: 401 })
  const fid = yeuToDaXacNhan(user)[0]
  if (!fid) return Response.json({ error: 'Tài khoản chưa bật 2 lớp' }, { status: 400 })
  cs.set(COOKIE_TIN_CAY, taoGiayTinCay(user.id, fid), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SO_NGAY_TIN_CAY * 86400,
  })
  return Response.json({ ok: true })
}

export async function DELETE() {
  const cs = await cookies()
  cs.set(COOKIE_TIN_CAY, '', { httpOnly: true, path: '/', maxAge: 0 })
  return Response.json({ ok: true })
}
