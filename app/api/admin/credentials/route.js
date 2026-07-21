import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const FIELD_LABEL = { label: 'Nhãn', username: 'Tên đăng nhập/Email', password: 'Mật khẩu/PIN', extra: 'Thông tin thêm', note: 'Ghi chú' }

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
  const { data, error } = await supabase
    .from('client_credentials')
    .select('*')
    .eq('client_id', clientId)
    .order('category')
    .order('sort_order')

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ creds: data || [] })
}

// POST /api/admin/credentials — create or update
export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, clientId, category, label, username, password, extra, note, updatedBy } = body

  if (!clientId || !category) return Response.json({ error: 'Missing clientId or category' }, { status: 400 })

  const supabase = getAdmin()
  const payload = {
    client_id:  clientId,
    category,
    label:      label    || null,
    username:   username || null,
    password:   password || null,
    extra:      extra    || null,
    note:       note     || null,
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  }

  let error
  const entityLabel = (label || category)

  if (id) {
    // Update existing — diff fields against the previous row to log only what changed
    const { data: before } = await supabase.from('client_credentials').select('*').eq('id', id).single()
    const res = await supabase.from('client_credentials').update(payload).eq('id', id)
    error = res.error
    if (!error && before) {
      const fields = ['label', 'username', 'password', 'extra', 'note']
      for (const f of fields) {
        const oldVal = before[f] || null
        const newVal = payload[f] || null
        if (oldVal !== newVal) {
          await logChange(supabase, {
            clientId, entityLabel, field: FIELD_LABEL[f] || f,
            oldValue: oldVal, newValue: newVal, action: 'update', changedBy: updatedBy,
          })
        }
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
