import { requireSales, canEditLead, fetchAll, loadSalesStaff, normPhone, normTax, STAGE_LABEL } from '@/lib/salesScope'

const NEEDS = ['ke_toan', 'hcns', 'thanh_lap', 'dich_vu_le', 'khac']
const STAGES = Object.keys(STAGE_LABEL)
const LEAD_COLS = 'id, company_name, contact_name, phone, email, tax_code, address, need, channel_id, source_note, ' +
  'assigned_to, stage, lost_reason, next_follow_up, note, created_by, created_at, updated_at, stage_changed_at'

const clean = v => (v == null ? null : (String(v).trim() || null))
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))

// Khách tiềm năng + báo giá khác trùng SĐT/MST, và công ty ĐANG PHỤC VỤ trùng MST.
async function findDuplicates(admin, { phone, tax, excludeId }) {
  const pn = normPhone(phone), tn = normTax(tax)
  const out = { leads: [], clients: [] }
  if (!pn && !tn) return out
  const ors = []
  if (pn) ors.push('phone_norm.eq.' + pn)
  if (tn) ors.push('tax_norm.eq.' + tn)
  let q = admin.from('sales_leads').select('id, company_name, contact_name, phone, tax_code, stage, assigned_to, created_at')
    .eq('is_deleted', false).or(ors.join(',')).limit(10)
  if (excludeId) q = q.neq('id', excludeId)
  const { data: leads } = await q
  out.leads = leads || []
  if (tn && tn.length >= 8) {
    // Lọc thô bằng 9 chữ số đầu (MST chi nhánh có gạch "-001" nên không so nguyên chuỗi được), rồi
    // so chính xác sau khi chuẩn hoá cả hai phía.
    const { data: cl } = await admin.from('clients').select('id, name, tax_code, client_code, is_active, assigned_to')
      .ilike('tax_code', '%' + tn.slice(0, 9) + '%').limit(20)
    out.clients = (cl || []).filter(c => normTax(c.tax_code) === tn)
  }
  return out
}

// GET /api/admin/sales/leads
//   (không tham số)          → toàn bộ khách tiềm năng + danh mục kênh + nhân viên KD + quyền của tôi
//   ?id=<uuid>               → 1 khách kèm nhật ký chăm sóc + báo giá
//   ?check=1&phone=&tax=&id= → dò trùng trước khi lưu
export async function GET(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const sp = new URL(request.url).searchParams

  if (sp.get('check')) {
    const dup = await findDuplicates(admin, { phone: sp.get('phone'), tax: sp.get('tax'), excludeId: sp.get('id') })
    return Response.json(dup)
  }

  const id = sp.get('id')
  if (id) {
    const { data: lead } = await admin.from('sales_leads').select(LEAD_COLS).eq('id', id).eq('is_deleted', false).maybeSingle()
    if (!lead) return Response.json({ error: 'Không tìm thấy khách' }, { status: 404 })
    const [{ data: acts }, { data: quotes }] = await Promise.all([
      admin.from('sales_lead_activities').select('id, kind, content, next_follow_up, created_by, created_at')
        .eq('lead_id', id).order('created_at', { ascending: false }).limit(200),
      admin.from('sales_quotes').select('id, quote_no, quote_date, monthly_final, price_status, contract_status, author_name')
        .eq('lead_id', id).eq('is_deleted', false).order('quote_date', { ascending: false }),
    ])
    const who = [...new Set((acts || []).map(a => a.created_by).filter(Boolean))]
    const { data: names } = who.length ? await admin.from('staff').select('id, full_name').in('id', who) : { data: [] }
    const nm = new Map((names || []).map(s => [s.id, s.full_name]))
    const dup = await findDuplicates(admin, { phone: lead.phone, tax: lead.tax_code, excludeId: lead.id })
    return Response.json({
      lead,
      canEdit: canEditLead(auth, lead),
      activities: (acts || []).map(a => ({ ...a, staffName: nm.get(a.created_by) || null })),
      quotes: quotes || [],
      duplicates: dup,
    })
  }

  const [leads, { data: channels }, staff, quoteRows, lastActs] = await Promise.all([
    fetchAll((a, b) => admin.from('sales_leads').select(LEAD_COLS).eq('is_deleted', false)
      .order('created_at', { ascending: false }).order('id').range(a, b)),
    admin.from('sales_channels').select('id, name, sort_order, is_active').order('sort_order').order('name'),
    loadSalesStaff(admin),
    fetchAll((a, b) => admin.from('sales_quotes').select('id, lead_id, quote_no, quote_date, monthly_final, price_status, contract_status')
      .eq('is_deleted', false).not('lead_id', 'is', null).order('quote_date', { ascending: false }).order('id').range(a, b)),
    fetchAll((a, b) => admin.from('sales_lead_activities').select('lead_id, created_at').neq('kind', 'he_thong')
      .order('created_at', { ascending: false }).order('id').range(a, b)),
  ])

  const qBy = new Map()
  for (const q of quoteRows) { if (!qBy.has(q.lead_id)) qBy.set(q.lead_id, []); qBy.get(q.lead_id).push(q) }
  const lastBy = new Map()
  for (const a of lastActs) if (!lastBy.has(a.lead_id)) lastBy.set(a.lead_id, a.created_at)

  // Tên người phụ trách có thể là người đã rời phòng KD (không còn trong loadSalesStaff) — tra riêng.
  const known = new Set(staff.map(s => s.id))
  const extraIds = [...new Set(leads.map(l => l.assigned_to).filter(x => x && !known.has(x)))]
  const { data: extra } = extraIds.length ? await admin.from('staff').select('id, full_name').in('id', extraIds) : { data: [] }

  return Response.json({
    leads: leads.map(l => ({
      ...l,
      canEdit: canEditLead(auth, l),
      quotes: qBy.get(l.id) || [],
      lastContactAt: lastBy.get(l.id) || null,
    })),
    channels: channels || [],
    staff,
    otherStaff: extra || [],
    perms: auth.perms,
    me: auth.caller.staffId,
  })
}

// POST — tiếp nhận khách mới
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (!auth.perms.view) return Response.json({ error: 'Không đủ quyền tiếp nhận khách' }, { status: 403 })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))

  const company_name = clean(b.company_name), contact_name = clean(b.contact_name)
  const phone = clean(b.phone), email = clean(b.email), tax_code = clean(b.tax_code)
  if (!company_name && !contact_name) return Response.json({ error: 'Nhập tên công ty hoặc tên người liên hệ' }, { status: 400 })
  if (!phone && !email) return Response.json({ error: 'Cần ít nhất số điện thoại hoặc email để chăm sóc khách' }, { status: 400 })
  if (!b.channel_id) return Response.json({ error: 'Chọn kênh khách đến — cần để báo cáo hiệu quả từng kênh' }, { status: 400 })
  if (b.need && !NEEDS.includes(b.need)) return Response.json({ error: 'Nhu cầu không hợp lệ' }, { status: 400 })
  if (b.next_follow_up && !isDate(b.next_follow_up)) return Response.json({ error: 'Ngày hẹn không hợp lệ' }, { status: 400 })

  // Nhân viên thường luôn tự nhận khách mình tiếp nhận; trưởng phòng được giao cho người khác.
  const assigned_to = auth.perms.all ? (b.assigned_to || auth.caller.staffId) : auth.caller.staffId

  const { data: lead, error } = await admin.from('sales_leads').insert({
    company_name, contact_name, phone, email, tax_code,
    phone_norm: normPhone(phone), tax_norm: normTax(tax_code),
    address: clean(b.address), need: b.need || null, channel_id: b.channel_id,
    source_note: clean(b.source_note), assigned_to, stage: 'moi',
    next_follow_up: b.next_follow_up || null, note: clean(b.note),
    created_by: auth.caller.staffId,
  }).select(LEAD_COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const { data: ch } = await admin.from('sales_channels').select('name').eq('id', b.channel_id).maybeSingle()
  await admin.from('sales_lead_activities').insert({
    lead_id: lead.id, kind: 'he_thong', created_by: auth.caller.staffId,
    content: 'Tiếp nhận khách từ kênh ' + (ch?.name || '—') + (b.source_note ? ' · ' + String(b.source_note).trim() : ''),
  })
  return Response.json({ data: lead })
}

// PATCH — sửa thông tin / đổi giai đoạn / nhận khách / giao khách
export async function PATCH(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))
  if (!b.id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const { data: lead } = await admin.from('sales_leads').select(LEAD_COLS).eq('id', b.id).eq('is_deleted', false).maybeSingle()
  if (!lead) return Response.json({ error: 'Không tìm thấy khách' }, { status: 404 })
  if (!canEditLead(auth, lead)) return Response.json({ error: 'Khách này do người khác phụ trách — chỉ trưởng phòng mới sửa được' }, { status: 403 })

  const now = new Date().toISOString()
  const patch = { updated_at: now }
  const logs = []
  const txt = ['company_name', 'contact_name', 'phone', 'email', 'tax_code', 'address', 'source_note', 'note']
  for (const k of txt) if (b[k] !== undefined) patch[k] = clean(b[k])
  if (patch.phone !== undefined) patch.phone_norm = normPhone(patch.phone)
  if (patch.tax_code !== undefined) patch.tax_norm = normTax(patch.tax_code)
  if (b.need !== undefined) {
    if (b.need && !NEEDS.includes(b.need)) return Response.json({ error: 'Nhu cầu không hợp lệ' }, { status: 400 })
    patch.need = b.need || null
  }
  if (b.channel_id !== undefined) {
    if (!b.channel_id) return Response.json({ error: 'Không được bỏ trống kênh khách đến' }, { status: 400 })
    patch.channel_id = b.channel_id
  }
  if (b.next_follow_up !== undefined) {
    if (b.next_follow_up && !isDate(b.next_follow_up)) return Response.json({ error: 'Ngày hẹn không hợp lệ' }, { status: 400 })
    patch.next_follow_up = b.next_follow_up || null
  }
  const nameAfter = (patch.company_name !== undefined ? patch.company_name : lead.company_name)
  const contactAfter = (patch.contact_name !== undefined ? patch.contact_name : lead.contact_name)
  if (!nameAfter && !contactAfter) return Response.json({ error: 'Nhập tên công ty hoặc tên người liên hệ' }, { status: 400 })

  if (b.assigned_to !== undefined && b.assigned_to !== lead.assigned_to) {
    // Nhân viên thường chỉ được NHẬN khách chưa ai phụ trách về cho mình.
    const selfClaim = !lead.assigned_to && b.assigned_to === auth.caller.staffId
    if (!auth.perms.all && !selfClaim) return Response.json({ error: 'Chỉ trưởng phòng mới giao khách cho người khác' }, { status: 403 })
    patch.assigned_to = b.assigned_to || null
    const ids = [lead.assigned_to, b.assigned_to].filter(Boolean)
    const { data: ns } = ids.length ? await admin.from('staff').select('id, full_name').in('id', ids) : { data: [] }
    const nm = new Map((ns || []).map(s => [s.id, s.full_name]))
    logs.push(selfClaim ? 'Nhận chăm sóc khách'
      : 'Giao khách: ' + (nm.get(lead.assigned_to) || 'chưa ai') + ' → ' + (nm.get(b.assigned_to) || 'chưa ai'))
  }

  if (b.stage !== undefined && b.stage !== lead.stage) {
    if (!STAGES.includes(b.stage)) return Response.json({ error: 'Giai đoạn không hợp lệ' }, { status: 400 })
    if (b.stage === 'that_bai') {
      const reason = clean(b.lost_reason)
      if (!reason) return Response.json({ error: 'Ghi lý do không thành — cần để báo cáo lý do mất khách' }, { status: 400 })
      patch.lost_reason = reason
    } else {
      patch.lost_reason = null
    }
    // Chốt HĐ phải đi qua báo giá đã chốt — không cho bấm tay để phễu báo cáo khớp với tiền.
    if (b.stage === 'chot') {
      const { data: signed } = await admin.from('sales_quotes').select('id').eq('lead_id', lead.id)
        .eq('contract_status', 'signed').eq('is_deleted', false).limit(1)
      if (!signed?.length) return Response.json({ error: 'Muốn chuyển "Chốt HĐ", đổi trạng thái báo giá của khách sang "Chốt HĐ" ở trang Báo giá' }, { status: 400 })
    }
    patch.stage = b.stage
    patch.stage_changed_at = now
    logs.push('Giai đoạn: ' + STAGE_LABEL[lead.stage] + ' → ' + STAGE_LABEL[b.stage] +
      (b.stage === 'that_bai' ? ' — lý do: ' + patch.lost_reason : ''))
  }

  const { data: updated, error } = await admin.from('sales_leads').update(patch).eq('id', lead.id).select(LEAD_COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  if (logs.length) {
    await admin.from('sales_lead_activities').insert(logs.map(content => ({
      lead_id: lead.id, kind: 'he_thong', content, created_by: auth.caller.staffId,
    })))
  }
  return Response.json({ data: updated })
}

// DELETE ?id= — xoá mềm. Trưởng phòng, hoặc chính người tiếp nhận khi khách CHƯA có báo giá (nhập
// trùng/nhầm). Khách đã có báo giá thì giữ lại để số liệu báo giá không mất gốc.
export async function DELETE(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })
  const { data: lead } = await admin.from('sales_leads').select('id, created_by').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!lead) return Response.json({ error: 'Không tìm thấy khách' }, { status: 404 })
  const { data: qs } = await admin.from('sales_quotes').select('id').eq('lead_id', id).eq('is_deleted', false).limit(1)
  if (qs?.length) return Response.json({ error: 'Khách đã có báo giá — không xoá được. Chuyển giai đoạn "Không thành" nếu khách không ký.' }, { status: 400 })
  if (!auth.perms.all && lead.created_by !== auth.caller.staffId) {
    return Response.json({ error: 'Chỉ người tiếp nhận hoặc trưởng phòng mới xoá được' }, { status: 403 })
  }
  const { error } = await admin.from('sales_leads').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
