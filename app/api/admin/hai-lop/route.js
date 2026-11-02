// Xác thực 2 lớp — phía quản trị (lib/haiLop.js).
//   GET                 → { daBat: [staffId đã bật 2 lớp] }   (manage_staff — để trang Quản lý nhân viên hiện trạng thái)
//   POST { staffId }    → ĐẶT LẠI 2 lớp: xoá mọi yếu tố 2 lớp của tài khoản (mất / đổi điện thoại) — CHỈ quản trị.
//                         Lần đăng nhập sau người đó vào bằng mật khẩu rồi tự bật lại (bắt buộc thì phải quét QR ngay).
import { createClient } from '@supabase/supabase-js'
import { callerHasPermission, requireAdmin } from '@/lib/serverAuth'

const getAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

export async function GET() {
  const auth = await callerHasPermission('manage_staff')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = getAdmin()
  const daBat = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    for (const u of data.users) if ((u.factors || []).some(f => f.status === 'verified')) daBat.push(u.id)
    if (data.users.length < 1000) break
  }
  return Response.json({ daBat })
}

export async function POST(request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 }) }
  if (!body?.staffId) return Response.json({ error: 'Thiếu nhân viên' }, { status: 400 })
  const admin = getAdmin()
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: body.staffId })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  let xoa = 0
  for (const f of data?.factors || []) {
    const { error: e } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: body.staffId })
    if (e) return Response.json({ error: 'Không xoá được yếu tố 2 lớp: ' + e.message }, { status: 500 })
    xoa++
  }
  return Response.json({ ok: true, xoa })
}
