// Tài khoản cổng thuế của công ty — Phân hệ Tờ khai.
//
// GET    /api/admin/tokhai/account?clientId=…   → thông tin tài khoản (KHÔNG trả mật khẩu)
// POST   /api/admin/tokhai/account              → lưu / cập nhật
// DELETE /api/admin/tokhai/account?clientId=…&portal=dvc
//
// Mật khẩu chỉ ghi dạng mã hóa và KHÔNG BAO GIỜ trả về trình duyệt qua route này — kể cả người
// có quyền xem, vì tài khoản cổng thuế nộp được tờ khai thay khách, nhạy cảm hơn hẳn các loại
// mật khẩu khác. Muốn đổi thì nhập mật khẩu mới.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { encrypt } from '@/lib/taxCrypto'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function ghiNhatKy(supabase, { clientId, staffId, action, detail }) {
  await supabase.from('tax_access_logs').insert({
    staff_id: staffId || null, client_id: clientId || null, action, detail: detail || null,
  })
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
    return Response.json({ error: 'Không có quyền xem tài khoản cổng thuế của công ty này' }, { status: 403 })
  }

  const { data, error } = await supabase.from('tax_accounts')
    .select('id, portal, username, status, last_success_at, last_error_code, updated_at')
    .eq('client_id', clientId)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ taiKhoan: data || [] })
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { clientId, portal = 'dvc', username, matKhau } = await request.json()
  if (!clientId || !username) return Response.json({ error: 'Thiếu công ty hoặc tên đăng nhập' }, { status: 400 })
  if (!['dvc', 'etax'].includes(portal)) return Response.json({ error: 'Cổng không hợp lệ' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
    return Response.json({ error: 'Không có quyền sửa tài khoản cổng thuế của công ty này' }, { status: 403 })
  }

  const { data: dangCo } = await supabase.from('tax_accounts')
    .select('id').eq('client_id', clientId).eq('portal', portal).maybeSingle()

  // Không nhập mật khẩu mới khi sửa → giữ nguyên mật khẩu cũ (giống màn hình Thông tin đăng nhập).
  if (!dangCo && !matKhau) {
    return Response.json({ error: 'Thêm tài khoản mới thì phải nhập mật khẩu' }, { status: 400 })
  }

  const payload = {
    client_id: clientId,
    portal,
    username: username.trim(),
    updated_at: new Date().toISOString(),
    updated_by: auth.caller.staffId,
  }
  if (matKhau) {
    payload.password_enc = encrypt(matKhau)
    // Đổi mật khẩu thì trạng thái cũ (vd sai mật khẩu) không còn đúng nữa.
    payload.status = 'not_connected'
    payload.last_error_code = null
  }
  // Ủy quyền nằm trong hợp đồng dịch vụ; màn hình không hỏi lại, app ghi ngầm để có dấu vết.
  if (!dangCo) {
    payload.consent_by = auth.caller.staffId
    payload.consent_at = new Date().toISOString()
    payload.status = 'not_connected'
  }

  const res = dangCo
    ? await supabase.from('tax_accounts').update(payload).eq('id', dangCo.id)
    : await supabase.from('tax_accounts').insert(payload)
  if (res.error) return Response.json({ error: res.error.message }, { status: 400 })

  await ghiNhatKy(supabase, {
    clientId, staffId: auth.caller.staffId, action: 'save_password',
    detail: { cong: portal, ten_dang_nhap: username, doi_mat_khau: !!matKhau },
  })

  return Response.json({ ok: true })
}

export async function DELETE(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const portal = searchParams.get('portal') || 'dvc'
  if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
    return Response.json({ error: 'Không có quyền xóa tài khoản cổng thuế của công ty này' }, { status: 403 })
  }

  const { error } = await supabase.from('tax_accounts')
    .delete().eq('client_id', clientId).eq('portal', portal)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  await ghiNhatKy(supabase, {
    clientId, staffId: auth.caller.staffId, action: 'delete_account', detail: { cong: portal },
  })
  return Response.json({ ok: true })
}
