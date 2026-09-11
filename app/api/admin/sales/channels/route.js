import { requireSales } from '@/lib/salesScope'

// GET — danh mục kênh truyền thông (cả kênh đã ẩn, để khách cũ vẫn hiện đúng tên kênh)
export async function GET() {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.admin.from('sales_channels').select('*').order('sort_order').order('name')
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// POST { name } — thêm kênh. Chỉ trưởng phòng KD.
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (!auth.perms.all) return Response.json({ error: 'Chỉ trưởng phòng mới sửa danh mục kênh' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const name = String(b.name || '').trim()
  if (!name) return Response.json({ error: 'Nhập tên kênh' }, { status: 400 })
  const { data: all } = await auth.admin.from('sales_channels').select('sort_order')
  const max = Math.max(0, ...(all || []).map(c => Number(c.sort_order) || 0).filter(n => n < 99))
  const { data, error } = await auth.admin.from('sales_channels').insert({ name, sort_order: max + 1 }).select().single()
  if (error) return Response.json({ error: error.code === '23505' ? 'Kênh này đã có' : error.message }, { status: 400 })
  return Response.json({ data })
}

// PATCH { id, name?, is_active? } — đổi tên / ẩn kênh. KHÔNG xoá cứng: khách cũ đang trỏ tới kênh.
export async function PATCH(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (!auth.perms.all) return Response.json({ error: 'Chỉ trưởng phòng mới sửa danh mục kênh' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (!b.id) return Response.json({ error: 'Thiếu id' }, { status: 400 })
  const patch = {}
  if (b.name !== undefined) {
    patch.name = String(b.name || '').trim()
    if (!patch.name) return Response.json({ error: 'Tên kênh không được trống' }, { status: 400 })
  }
  if (b.is_active !== undefined) patch.is_active = b.is_active === true
  const { error } = await auth.admin.from('sales_channels').update(patch).eq('id', b.id)
  if (error) return Response.json({ error: error.code === '23505' ? 'Kênh này đã có' : error.message }, { status: 400 })
  return Response.json({ ok: true })
}
