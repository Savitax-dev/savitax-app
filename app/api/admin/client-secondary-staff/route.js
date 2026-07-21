import { createClient } from '@supabase/supabase-js'
import { callerHasPermission, requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/client-secondary-staff?clientId=xxx
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('client_secondary_staff')
    .select('id, staff_id, created_at, staff:staff_id(id, full_name, room_id, rooms(name))')
    .eq('client_id', clientId)
    .order('created_at')

  if (error) {
    if (error.message && error.message.includes('client_secondary_staff')) return Response.json({ list: [] })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ list: data || [] })
}

// POST /api/admin/client-secondary-staff — gán nhân viên phụ
export async function POST(request) {
  const auth = await callerHasPermission('manage_clients')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { clientId, staffId, addedBy } = body
  if (!clientId || !staffId) return Response.json({ error: 'Thiếu clientId hoặc staffId' }, { status: 400 })

  const supabase = getAdmin()

  // Không cho gán nhân viên phụ trùng với nhân viên chính
  const { data: client } = await supabase.from('clients').select('assigned_to').eq('id', clientId).single()
  if (client && client.assigned_to === staffId) {
    return Response.json({ error: 'Nhân viên này đã là nhân viên chính của công ty' }, { status: 400 })
  }

  const { error } = await supabase.from('client_secondary_staff')
    .insert({ client_id: clientId, staff_id: staffId, added_by: addedBy || null })

  if (error) {
    if (error.code === '23505') return Response.json({ error: 'Nhân viên này đã được gán làm phụ trách phụ' }, { status: 400 })
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json({ ok: true })
}

// DELETE /api/admin/client-secondary-staff?id=xxx
export async function DELETE(request) {
  const auth = await callerHasPermission('manage_clients')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('client_secondary_staff').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
