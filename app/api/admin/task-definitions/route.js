import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET: all task definitions
export async function GET() {
  const auth = await callerHasPermission('manage_checklist_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  // Try full select first
  let { data, error } = await supabase
    .from('task_definitions')
    .select('id, name, deadline_day, sort_order, applies_to, report_type, is_active, description, month')
    .eq('is_active', true)
    .order('sort_order')

  // Fallback: try without new optional columns
  if (error && error.message && error.message.includes('schema cache')) {
    const res2 = await supabase
      .from('task_definitions')
      .select('id, name, deadline_day, sort_order')
      .eq('is_active', true)
      .order('sort_order')
    data = res2.data; error = res2.error
  }

  if (error) return Response.json({ error: error.message }, { status: 400 })
  // Normalize missing fields
  const normalized = (data || []).map(t => ({
    ...t,
    report_type: t.report_type || 'monthly',
    is_active:   t.is_active !== false,
    month:       t.month || null,
  }))
  return Response.json({ data: normalized })
}

// POST: create new task
export async function POST(request) {
  const auth = await callerHasPermission('manage_checklist_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { name, deadline_day, applies_to, report_type, description, month } = body
  if (!name || !deadline_day) return Response.json({ error: 'Thiếu tên hoặc ngày hạn' }, { status: 400 })

  const supabase = getAdmin()

  // Get max sort_order for this report_type + month
  const q = supabase.from('task_definitions').select('sort_order').eq('report_type', report_type || 'monthly').order('sort_order', { ascending: false }).limit(1)
  const { data: existing } = await q
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 1

  // Start with minimal guaranteed columns
  const insertData = {
    name,
    deadline_day: Number(deadline_day),
    sort_order: nextOrder,
  }

  // Add optional columns progressively
  const optionalCols = { applies_to: applies_to || 'monthly', report_type: report_type || 'monthly', is_active: true }
  if (description) optionalCols.description = description
  if (month) optionalCols.month = Number(month)

  let attempt = { ...insertData, ...optionalCols }
  let { data, error } = await supabase.from('task_definitions').insert(attempt).select().single()

  // If schema cache error, retry stripping optional columns (keep month + name + deadline_day)
  if (error && error.message && error.message.includes('schema cache')) {
    const stripOrder = ['description', 'is_active', 'report_type', 'applies_to', 'month']
    for (const col of stripOrder) {
      if (!error || !error.message.includes('schema cache')) break
      delete attempt[col]
      const res = await supabase.from('task_definitions').insert(attempt).select().single()
      data = res.data; error = res.error
    }
  }

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// PATCH: update task
export async function PATCH(request) {
  const auth = await callerHasPermission('manage_checklist_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, name, deadline_day, applies_to, report_type, description, sort_order, is_active, month } = body
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  const update = {}
  if (name        !== undefined) update.name         = name
  if (deadline_day!== undefined) update.deadline_day = Number(deadline_day)
  if (applies_to  !== undefined) update.applies_to   = applies_to
  if (report_type !== undefined) update.report_type  = report_type
  if (description !== undefined) update.description  = description
  if (sort_order  !== undefined) update.sort_order   = Number(sort_order)
  if (is_active   !== undefined) update.is_active    = is_active
  if (month       !== undefined) update.month        = month ? Number(month) : null

  const { error } = await supabase.from('task_definitions').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}

// DELETE: remove task
export async function DELETE(request) {
  const auth = await callerHasPermission('manage_checklist_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('task_definitions').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}
