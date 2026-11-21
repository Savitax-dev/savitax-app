// Tài khoản cổng hoadondientu.gdt.gov.vn của MỘT công ty — dùng để tiện ích điền vào ô đăng nhập CỦA TRANG CỔNG.
//
// POST /api/admin/hoadon/tai-khoan  { clientId }  →  { tenDangNhap, matKhau } | { coTaiKhoan: false }
//
// Lấy ở thông tin đăng nhập công ty, mục "Hóa đơn điện tử" (client_credentials.category = 'hoadon', mật khẩu mã hoá
// password_enc). Phạm vi như mọi chỗ đụng mật khẩu khách: lib/credentialScope.js (nhân viên chính / phụ của công ty, trưởng
// phòng của phòng đó, quản trị). Không đòi quyền "xem chuỗi mật khẩu" (reveal_credentials) — giống Tờ khai: nhân viên phụ
// trách dùng được tài khoản để đăng nhập cổng, màn hình KHÔNG hiện chuỗi mật khẩu. Mỗi lần lấy ghi tax_access_logs.
// POST (không GET) để mật khẩu không nằm trong lịch sử / bộ đệm trình duyệt.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { decrypt } from '@/lib/taxCrypto'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { clientId } = await request.json().catch(() => ({}))
  if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
    return Response.json({ error: 'Không có quyền dùng tài khoản hóa đơn của công ty này' }, { status: 403 })
  }

  const { data, error } = await supabase.from('client_credentials')
    .select('*')      // '*' chứ không kể tên cột: cột password chữ rõ sẽ bị xoá hẳn (AGENTS.md), kể tên là hỏng truy vấn ngày đó
    .eq('client_id', clientId).eq('category', 'hoadon')
    .order('sort_order').order('id')
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const docMk = r => { if (r.password_enc) { try { return decrypt(r.password_enc) } catch { return null } } return r.password || null }
  const dong = (data || []).map(r => ({ tenDangNhap: String(r.username || '').trim(), matKhau: docMk(r) })).find(r => r.tenDangNhap && r.matKhau)
  if (!dong) return Response.json({ coTaiKhoan: false })

  try {
    await supabase.from('tax_access_logs').insert({
      staff_id: auth.caller.staffId || null, client_id: clientId, action: 'hddt_dang_nhap', detail: { cong: 'hoadondientu' },
    })
  } catch (_) { /* thiếu bảng thì thôi */ }

  return Response.json({ coTaiKhoan: true, ...dong }, { headers: { 'Cache-Control': 'no-store' } })
}
