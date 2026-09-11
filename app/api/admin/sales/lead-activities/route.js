import { requireSales, canEditLead, advanceLeadStage } from '@/lib/salesScope'

const KINDS = ['goi', 'zalo', 'gap', 'email', 'khac']

// POST — ghi 1 lần chăm sóc khách { lead_id, kind, content, next_follow_up }
// Ngày hẹn mới (kể cả để trống = không hẹn nữa) thay cho ngày hẹn cũ của khách. Lần liên hệ đầu
// tiên tự chuyển khách "Mới" → "Đang tư vấn".
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))
  const content = String(b.content || '').trim()
  if (!b.lead_id) return Response.json({ error: 'Thiếu khách' }, { status: 400 })
  if (!KINDS.includes(b.kind)) return Response.json({ error: 'Hình thức liên hệ không hợp lệ' }, { status: 400 })
  if (!content) return Response.json({ error: 'Ghi nội dung trao đổi với khách' }, { status: 400 })
  if (b.next_follow_up && !/^\d{4}-\d{2}-\d{2}$/.test(b.next_follow_up)) return Response.json({ error: 'Ngày hẹn không hợp lệ' }, { status: 400 })

  const { data: lead } = await admin.from('sales_leads').select('id, assigned_to, stage').eq('id', b.lead_id).eq('is_deleted', false).maybeSingle()
  if (!lead) return Response.json({ error: 'Không tìm thấy khách' }, { status: 404 })
  if (!canEditLead(auth, lead)) return Response.json({ error: 'Khách này do người khác phụ trách' }, { status: 403 })

  const { data, error } = await admin.from('sales_lead_activities').insert({
    lead_id: lead.id, kind: b.kind, content, next_follow_up: b.next_follow_up || null, created_by: auth.caller.staffId,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Khách chưa ai phụ trách: ai chăm sóc trước thì nhận luôn, khỏi bị bỏ rơi trong danh sách chung.
  const patch = { next_follow_up: b.next_follow_up || null, updated_at: new Date().toISOString() }
  if (!lead.assigned_to) patch.assigned_to = auth.caller.staffId
  await admin.from('sales_leads').update(patch).eq('id', lead.id)
  if (lead.stage === 'moi') await advanceLeadStage(admin, lead.id, 'tu_van', auth.caller.staffId, 'đã liên hệ lần đầu')

  return Response.json({ data })
}
