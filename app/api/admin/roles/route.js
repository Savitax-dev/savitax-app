import { createClient } from '@supabase/supabase-js'
import { callerHasPermission, requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/roles — danh sách vai trò. Chỉ cần đăng nhập (không cần manage_roles) vì
// lib/permissions.js gọi route này cho MỌI user để tự kiểm tra quyền của chính họ.
export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('roles').select('*').order('created_at')
  if (error) {
    if (error.message && error.message.includes('roles')) return Response.json({ data: [] })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ data: data || [] })
}

// Chuyển tiếng Việt có dấu thành slug ASCII an toàn (VD: "Nhân viên NB" -> "nhan_vien_nb")
function slugify(str) {
  return String(str)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // bỏ dấu (combining diacritical marks)
    .replace(/đ/gi, 'd')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// POST /api/admin/roles — tạo vai trò mới (mã vai trò tự sinh từ tên hiển thị)
export async function POST(request) {
  const auth = await callerHasPermission('manage_roles')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, label } = body
  if (!label) return Response.json({ error: 'Thiếu tên hiển thị' }, { status: 400 })

  const slug = slugify(id || label)
  if (!slug) return Response.json({ error: 'Không tạo được mã vai trò hợp lệ, vui lòng đổi tên khác' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('roles').insert({ id: slug, label, is_system: false })
  if (error) {
    if (error.code === '23505') return Response.json({ error: 'Mã vai trò này đã tồn tại' }, { status: 400 })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ ok: true, id: slug })
}

// DELETE /api/admin/roles?id=xxx
export async function DELETE(request) {
  const auth = await callerHasPermission('manage_roles')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: role } = await supabase.from('roles').select('is_system').eq('id', id).single()
  if (role?.is_system) return Response.json({ error: 'Không thể xóa vai trò hệ thống' }, { status: 400 })

  const { count } = await supabase.from('staff').select('id', { count: 'exact', head: true }).eq('role', id)
  if (count && count > 0) return Response.json({ error: `Còn ${count} nhân viên đang dùng vai trò này, không thể xóa` }, { status: 400 })

  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
