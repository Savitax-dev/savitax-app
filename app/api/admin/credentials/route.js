import { createClient } from '@supabase/supabase-js'
import { requireLogin, callerHasPermission } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { encrypt, decrypt } from '@/lib/taxCrypto'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const FIELD_LABEL = { label: 'Nhãn', username: 'Tên đăng nhập/Email', password: 'Mật khẩu/PIN', extra: 'Thông tin thêm', note: 'Ghi chú' }

// Mật khẩu nằm ở password_enc (đã mã hóa). Cột password chữ rõ chỉ còn là đường lùi cho những
// dòng chưa ai sửa kể từ lần chuyển đổi — sẽ xóa hẳn ở một lần chạy SQL sau.
function docMatKhau(row) {
  if (row.password_enc) {
    try { return decrypt(row.password_enc) } catch { return null }
  }
  return row.password || null
}

// Nhật ký truy cập tài khoản — khách có quyền hỏi ai đã dùng thông tin đăng nhập của họ.
// Bảng chưa tồn tại (bản clone chưa chạy sql/15) thì bỏ qua, không làm hỏng thao tác chính.
async function ghiNhatKy(supabase, { clientId, staffId, action, detail }) {
  try {
    await supabase.from('tax_access_logs').insert({
      staff_id: staffId || null, client_id: clientId || null, action, detail: detail || null,
    })
  } catch (_) { /* không có bảng thì thôi */ }
}

async function logChange(supabase, { clientId, entityLabel, field, oldValue, newValue, action, changedBy }) {
  await supabase.from('client_change_log').insert({
    client_id: clientId,
    entity: 'credential',
    entity_label: entityLabel,
    field,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    action,
    changed_by: changedBy || null,
  })
}

// GET /api/admin/credentials?clientId=xxx
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()

  // Chặn xem chéo: chỉ người phụ trách công ty (chính/phụ), trưởng phòng của phòng đó, hoặc
  // quản trị viên mới được đọc thông tin đăng nhập.
  if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
    return Response.json({ error: 'Không có quyền xem thông tin đăng nhập của công ty này' }, { status: 403 })
  }

  // Quyền xem CHUỖI mật khẩu là quyền riêng, áp cho mọi loại (thuế, hóa đơn, CKS, ngân hàng…).
  const xemDuocChuoi = (await callerHasPermission('reveal_credentials')).ok

  const { data, error } = await supabase
    .from('client_credentials')
    .select('*')
    .eq('client_id', clientId)
    .order('category')
    .order('sort_order')

  if (error) return Response.json({ error: error.message }, { status: 400 })

  const creds = (data || []).map(row => {
    const matKhau = docMatKhau(row)
    const { password: _bo, password_enc: _bo2, ...con } = row
    return {
      ...con,
      // Không có quyền thì KHÔNG gửi chuỗi về trình duyệt — ẩn ở giao diện thôi là vô nghĩa,
      // mở tab Network là đọc được.
      password: xemDuocChuoi ? matKhau : null,
      hasPassword: !!matKhau,
    }
  })

  if (xemDuocChuoi && creds.some(c => c.hasPassword)) {
    await ghiNhatKy(supabase, {
      clientId, staffId: auth.caller.staffId, action: 'reveal_password',
      detail: { so_dong: creds.filter(c => c.hasPassword).length },
    })
  }

  return Response.json({ creds, canReveal: xemDuocChuoi })
}

// POST /api/admin/credentials — create or update
export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, clientId, category, label, username, password, extra, note, updatedBy } = body

  if (!clientId || !category) return Response.json({ error: 'Missing clientId or category' }, { status: 400 })

  const supabase = getAdmin()

  if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
    return Response.json({ error: 'Không có quyền sửa thông tin đăng nhập của công ty này' }, { status: 403 })
  }

  const payload = {
    client_id:  clientId,
    category,
    label:      label    || null,
    username:   username || null,
    extra:      extra    || null,
    note:       note     || null,
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  }

  // Mật khẩu xử lý riêng, KHÔNG gộp vào payload như các trường khác:
  // người không có quyền xem chuỗi sẽ nhận password = null khi tải dòng về, nên nếu cứ ghi đè
  // theo giá trị gửi lên thì họ chỉ sửa cái nhãn thôi cũng xóa mất mật khẩu của khách.
  //   - có chuỗi mới        → mã hóa rồi ghi đè, xóa luôn chữ rõ còn sót của dòng cũ
  //   - gửi xoaMatKhau=true → cố ý xóa mật khẩu
  //   - không gửi gì        → giữ nguyên mật khẩu đang có
  const coMatKhauMoi = typeof password === 'string' && password !== ''
  if (coMatKhauMoi) {
    payload.password_enc = encrypt(password)
    payload.password = null
  } else if (body.xoaMatKhau === true) {
    payload.password_enc = null
    payload.password = null
  }

  let error
  const entityLabel = (label || category)

  if (id) {
    // Update existing — diff fields against the previous row to log only what changed
    const { data: before } = await supabase.from('client_credentials').select('*').eq('id', id).single()
    const res = await supabase.from('client_credentials').update(payload).eq('id', id)
    error = res.error
    if (!error && before) {
      for (const f of ['label', 'username', 'extra', 'note']) {
        const oldVal = before[f] || null
        const newVal = payload[f] || null
        if (oldVal !== newVal) {
          await logChange(supabase, {
            clientId, entityLabel, field: FIELD_LABEL[f] || f,
            oldValue: oldVal, newValue: newVal, action: 'update', changedBy: updatedBy,
          })
        }
      }
      // Mật khẩu: chỉ ghi nhận LÀ CÓ ĐỔI, tuyệt đối không ghi giá trị cũ/mới vào nhật ký —
      // trước đây làm vậy nên client_change_log trở thành kho mật khẩu thứ hai, còn nguy hiểm
      // hơn vì giữ cả lịch sử.
      const doiMatKhau = (coMatKhauMoi && decrypt(payload.password_enc) !== docMatKhau(before))
        || (body.xoaMatKhau === true && !!docMatKhau(before))
      if (doiMatKhau) {
        await logChange(supabase, {
          clientId, entityLabel, field: FIELD_LABEL.password,
          oldValue: '(đã ẩn)', newValue: body.xoaMatKhau === true ? '(đã xóa)' : '(đã đổi)',
          action: 'update', changedBy: updatedBy,
        })
        await ghiNhatKy(supabase, {
          clientId, staffId: auth.caller.staffId, action: 'save_password',
          detail: { loai: category, nhan: entityLabel },
        })
      }
    }
  } else {
    // Insert new
    const res = await supabase.from('client_credentials').insert(payload)
    error = res.error
    if (!error) {
      await logChange(supabase, {
        clientId, entityLabel, field: 'Tạo mới',
        oldValue: null, newValue: entityLabel, action: 'create', changedBy: updatedBy,
      })
      if (coMatKhauMoi) {
        await ghiNhatKy(supabase, {
          clientId, staffId: auth.caller.staffId, action: 'save_password',
          detail: { loai: category, nhan: entityLabel },
        })
      }
    }
  }

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}

// DELETE /api/admin/credentials?id=xxx&updatedBy=xxx
export async function DELETE(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const updatedBy = searchParams.get('updatedBy')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: before } = await supabase.from('client_credentials').select('*').eq('id', id).single()
  if (!before) return Response.json({ error: 'Không tìm thấy thông tin cần xóa' }, { status: 404 })

  if (!(await canAccessCredentials(supabase, auth.caller, before.client_id))) {
    return Response.json({ error: 'Không có quyền xóa thông tin đăng nhập của công ty này' }, { status: 403 })
  }

  const { error } = await supabase.from('client_credentials').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  if (before) {
    await logChange(supabase, {
      clientId: before.client_id, entityLabel: before.label || before.category, field: 'Xóa thông tin',
      oldValue: before.label || before.category, newValue: null, action: 'delete', changedBy: updatedBy,
    })
  }
  return Response.json({ ok: true })
}
