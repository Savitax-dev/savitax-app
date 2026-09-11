import { requireSales, canEditLead, canEditQuote, fetchAll, normPhone, normTax, todayVN, advanceLeadStage, recomputeLeadStage, careOf } from '@/lib/salesScope'
import { priceQuote, canExportPrice, money, CONTRACT_STATES } from '@/lib/salesPricing'
import { fileOnSave } from '@/lib/salesFiling'
import { driveConfigured } from '@/lib/googleDrive'

const LIST_COLS = 'id, lead_id, quote_no, quote_date, seq, author_id, author_name, company_name, tax_code, ' +
  'standard_monthly, monthly_final, override_on, override_amount, override_reason, price_status, reviewed_by, ' +
  'reviewed_at, review_note, contract_status, contract_changed_at, drive_folder_url, survey_file_name, created_at, updated_at, ' +
  'contact:survey->>contact, phone:survey->>phone'
const MAX_SURVEY_BYTES = 4 * 1024 * 1024 // giới hạn body của Vercel ~4,5MB

const pad2 = n => String(n).padStart(2, '0')
const contractLabel = k => (CONTRACT_STATES.find(c => c[0] === k) || [])[1] || k

// Nhận JSON thường hoặc multipart (payload JSON + file khảo sát .docx)
async function readBody(request) {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData()
    let payload = {}
    try { payload = JSON.parse(String(form.get('payload') || '{}')) } catch (_) { payload = {} }
    const f = form.get('surveyFile')
    let file = null
    if (f && typeof f === 'object' && f.size > 0) {
      if (f.size > MAX_SURVEY_BYTES) throw new Error('File khảo sát quá lớn (tối đa 4MB)')
      file = { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }
    }
    return { payload, file }
  }
  return { payload: await request.json().catch(() => ({})), file: null }
}

async function staffName(admin, id) {
  if (!id) return null
  const { data } = await admin.from('staff').select('full_name').eq('id', id).maybeSingle()
  return data?.full_name || null
}

async function logLead(admin, leadId, content, by) {
  if (!leadId) return
  await admin.from('sales_lead_activities').insert({ lead_id: leadId, kind: 'he_thong', content, created_by: by || null })
}

// Số báo giá DDMMNN, NN = thứ tự trong ngày (tính cả báo giá đã xoá mềm — số đã phát không dùng
// lại). Sinh ở SERVER lúc lưu; 2 người lưu cùng lúc thì một người đụng khoá (quote_date, seq) →
// thử lại với số kế tiếp.
async function insertWithNumber(admin, row) {
  const date = todayVN()
  const [, mm, dd] = date.split('-')
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: last } = await admin.from('sales_quotes').select('seq').eq('quote_date', date)
      .order('seq', { ascending: false }).limit(1)
    const seq = (last?.[0]?.seq || 0) + 1
    const { data, error } = await admin.from('sales_quotes')
      .insert({ ...row, quote_date: date, seq, quote_no: dd + mm + pad2(seq) }).select('*').single()
    if (!error) return data
    if (error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('Nhiều người đang lưu báo giá cùng lúc — bấm lưu lại giúp em')
}

// GET — danh sách báo giá (?id= → 1 báo giá đầy đủ survey + fees)
export async function GET(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const id = new URL(request.url).searchParams.get('id')

  if (id) {
    const { data: q } = await admin.from('sales_quotes').select('*').eq('id', id).eq('is_deleted', false).maybeSingle()
    if (!q) return Response.json({ error: 'Không tìm thấy báo giá' }, { status: 404 })
    const { data: lead } = q.lead_id
      ? await admin.from('sales_leads').select('id, company_name, contact_name, channel_id, assigned_to, stage').eq('id', q.lead_id).maybeSingle()
      : { data: null }
    return Response.json({
      data: { ...q, reviewerName: await staffName(admin, q.reviewed_by) },
      lead, canEdit: canEditQuote(auth, q, lead), perms: auth.perms, driveReady: driveConfigured(),
      driveRootUrl: process.env.SALES_DRIVE_FOLDER_ID ? 'https://drive.google.com/drive/folders/' + process.env.SALES_DRIVE_FOLDER_ID : null,
    })
  }

  const [quotes, leads] = await Promise.all([
    fetchAll((a, b) => admin.from('sales_quotes').select(LIST_COLS).eq('is_deleted', false)
      .order('quote_date', { ascending: false }).order('seq', { ascending: false }).range(a, b)),
    fetchAll((a, b) => admin.from('sales_leads').select('id, channel_id, assigned_to, stage, lost_reason').eq('is_deleted', false).order('id').range(a, b)),
  ])
  const leadMap = new Map(leads.map(l => [l.id, l]))
  const reviewerIds = [...new Set(quotes.map(q => q.reviewed_by).filter(Boolean))]
  const { data: rs } = reviewerIds.length ? await admin.from('staff').select('id, full_name').in('id', reviewerIds) : { data: [] }
  const rn = new Map((rs || []).map(s => [s.id, s.full_name]))
  const { data: channels } = await admin.from('sales_channels').select('id, name, is_active').order('sort_order').order('name')

  return Response.json({
    quotes: quotes.map(q => {
      const lead = leadMap.get(q.lead_id) || null
      return {
        ...q,
        channel_id: lead?.channel_id || null,
        lead_assigned_to: lead?.assigned_to || null,
        lead_stage: lead?.stage || null,
        lost_reason: lead?.lost_reason || null,
        care: careOf(lead?.stage),
        reviewerName: rn.get(q.reviewed_by) || null,
        canEdit: canEditQuote(auth, q, lead),
      }
    }),
    channels: channels || [],
    perms: auth.perms,
    me: auth.caller.staffId,
    driveReady: driveConfigured(),
    driveRootUrl: process.env.SALES_DRIVE_FOLDER_ID ? 'https://drive.google.com/drive/folders/' + process.env.SALES_DRIVE_FOLDER_ID : null,
  })
}

// POST — lưu báo giá mới. Body (JSON hoặc multipart payload):
//   { lead_id? | channel_id + source_note (tạo khách mới), survey, override:{on,amount,reason} }
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (!auth.perms.view) return Response.json({ error: 'Không đủ quyền lập báo giá' }, { status: 403 })
  const admin = auth.admin
  let body
  try { body = await readBody(request) } catch (e) { return Response.json({ error: e.message }, { status: 400 }) }
  const { payload: b, file } = body

  const p = priceQuote(b.survey, b.override)
  const s = p.survey
  if (!s.company.trim()) return Response.json({ error: 'Nhập tên công ty khách hàng trước đã' }, { status: 400 })
  const reason = String(b.override?.reason || '').trim()
  if (p.overrideOn && !reason) return Response.json({ error: 'Ghi lý do đề xuất mức phí khác' }, { status: 400 })
  if (p.overrideOn && !(p.overrideAmount > 0)) return Response.json({ error: 'Nhập mức phí đề xuất' }, { status: 400 })

  const me = auth.caller.staffId
  let lead = null
  if (b.lead_id) {
    const { data } = await admin.from('sales_leads').select('id, assigned_to, stage').eq('id', b.lead_id).eq('is_deleted', false).maybeSingle()
    if (!data) return Response.json({ error: 'Không tìm thấy khách tiềm năng đã chọn' }, { status: 404 })
    if (!canEditLead(auth, data)) return Response.json({ error: 'Khách này do người khác phụ trách — nhờ họ hoặc trưởng phòng lập báo giá' }, { status: 403 })
    lead = data
  } else {
    if (!b.channel_id) return Response.json({ error: 'Chọn kênh khách đến (hoặc chọn khách tiềm năng đã có)' }, { status: 400 })
    // Cùng MST với khách đã có → không tự sinh khách trùng, trả về để giao diện hỏi gắn vào khách đó.
    const tn = normTax(s.mst)
    if (tn) {
      const { data: dup } = await admin.from('sales_leads').select('id, company_name, assigned_to, stage')
        .eq('tax_norm', tn).eq('is_deleted', false).limit(1)
      if (dup?.length) {
        return Response.json({ error: 'MST này đã có trong Khách tiềm năng', duplicateLead: dup[0] }, { status: 409 })
      }
    }
    const { data: created, error: le } = await admin.from('sales_leads').insert({
      company_name: s.company.trim(), contact_name: s.contact || null, phone: s.phone || null, email: s.email || null,
      tax_code: s.mst || null, address: s.address || null, phone_norm: normPhone(s.phone), tax_norm: tn,
      need: 'ke_toan', channel_id: b.channel_id, source_note: String(b.source_note || '').trim() || null,
      assigned_to: me, stage: 'moi', created_by: me,
    }).select('id, assigned_to, stage').single()
    if (le) return Response.json({ error: le.message }, { status: 400 })
    const { data: ch } = await admin.from('sales_channels').select('name').eq('id', b.channel_id).maybeSingle()
    await logLead(admin, created.id, 'Tiếp nhận khách từ kênh ' + (ch?.name || '—') + ' (lập báo giá trực tiếp)', me)
    lead = created
  }

  let quote
  try {
    quote = await insertWithNumber(admin, {
      lead_id: lead.id, author_id: me, author_name: await staffName(admin, me),
      company_name: s.company.trim(), tax_code: s.mst || null,
      survey: s, fees: p.fees, standard_monthly: p.standardMonthly, monthly_final: p.monthlyFinal,
      override_on: p.overrideOn, override_amount: p.overrideAmount, override_reason: p.overrideOn ? reason : null,
      price_status: p.overrideOn ? 'pending' : 'ok', contract_status: 'draft',
      survey_file_name: file?.name || null,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

  await advanceLeadStage(admin, lead.id, 'bao_gia', me, 'lập báo giá ' + quote.quote_no)
  await logLead(admin, lead.id, 'Lập báo giá số ' + quote.quote_no + ' — ' + money(quote.monthly_final) + '/tháng' +
    (p.overrideOn ? ' (đề xuất khác biểu phí ' + money(p.standardMonthly) + ', chờ Giám đốc duyệt)' : ''), me)

  // Nộp Drive ngay khi lưu: phiếu khảo sát (nếu có) + file báo giá (nếu đúng biểu phí).
  const drive = await fileOnSave(admin, quote, file?.bytes)
  return Response.json({ data: { ...quote, drive_folder_url: drive.folderUrl || quote.drive_folder_url }, drive })
}

// PATCH — { id, action: 'update' | 'contract' | 'review', ... }
export async function PATCH(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  let body
  try { body = await readBody(request) } catch (e) { return Response.json({ error: e.message }, { status: 400 }) }
  const { payload: b, file } = body
  if (!b.id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const { data: q } = await admin.from('sales_quotes').select('*').eq('id', b.id).eq('is_deleted', false).maybeSingle()
  if (!q) return Response.json({ error: 'Không tìm thấy báo giá' }, { status: 404 })
  const { data: lead } = q.lead_id
    ? await admin.from('sales_leads').select('id, assigned_to, stage').eq('id', q.lead_id).maybeSingle()
    : { data: null }
  const me = auth.caller.staffId
  const now = new Date().toISOString()

  // ── Giám đốc duyệt / từ chối mức phí đề xuất ──
  if (b.action === 'review') {
    if (!auth.perms.approve) return Response.json({ error: 'Chỉ Giám đốc mới duyệt được mức phí' }, { status: 403 })
    if (q.price_status !== 'pending') return Response.json({ error: 'Báo giá này không ở trạng thái chờ duyệt' }, { status: 400 })
    const note = String(b.note || '').trim()
    if (b.decision !== 'approve' && b.decision !== 'reject') return Response.json({ error: 'Chọn duyệt hoặc từ chối' }, { status: 400 })
    if (b.decision === 'reject' && !note) return Response.json({ error: 'Ghi lý do từ chối để nhân viên biết sửa gì' }, { status: 400 })
    const status = b.decision === 'approve' ? 'approved' : 'rejected'
    const { error } = await admin.from('sales_quotes').update({
      price_status: status, reviewed_by: me, reviewed_at: now, review_note: note || null, updated_at: now,
    }).eq('id', q.id)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    await logLead(admin, q.lead_id, 'Giám đốc ' + (status === 'approved' ? 'DUYỆT' : 'TỪ CHỐI') + ' mức phí ' +
      money(q.monthly_final) + '/tháng của báo giá ' + q.quote_no + (note ? ' — ' + note : ''), me)
    // Duyệt xong là báo giá gửi khách được → nộp luôn file báo giá vào Drive.
    const drive = status === 'approved' ? await fileOnSave(admin, { ...q, price_status: status }, null) : null
    return Response.json({ ok: true, price_status: status, drive })
  }

  if (!canEditQuote(auth, q, lead)) return Response.json({ error: 'Báo giá do người khác lập — chỉ trưởng phòng mới sửa được' }, { status: 403 })

  // ── Vòng đời hợp đồng: Chưa gửi → Đã gửi HĐ → Chốt HĐ ──
  if (b.action === 'contract') {
    const st = b.contract_status
    if (!['draft', 'sent', 'signed'].includes(st)) return Response.json({ error: 'Trạng thái không hợp lệ' }, { status: 400 })
    if (st === q.contract_status) return Response.json({ ok: true })
    if (st !== 'draft' && !canExportPrice(q.price_status)) {
      return Response.json({ error: 'Mức phí chưa được Giám đốc duyệt — chưa gửi hợp đồng được' }, { status: 400 })
    }
    const { error } = await admin.from('sales_quotes').update({ contract_status: st, contract_changed_at: now, updated_at: now }).eq('id', q.id)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    await logLead(admin, q.lead_id, 'Báo giá ' + q.quote_no + ': ' + contractLabel(q.contract_status) + ' → ' + contractLabel(st), me)
    if (q.contract_status === 'signed') await recomputeLeadStage(admin, q.lead_id, me, 'báo giá ' + q.quote_no + ' bỏ Chốt HĐ')
    if (st === 'sent') await advanceLeadStage(admin, q.lead_id, 'gui_hd', me, 'gửi HĐ báo giá ' + q.quote_no)
    if (st === 'signed') await advanceLeadStage(admin, q.lead_id, 'chot', me, 'chốt HĐ báo giá ' + q.quote_no)
    return Response.json({ ok: true })
  }

  // ── Tình trạng chăm sóc: Đang chăm sóc / Ký hợp đồng / Thất bại ──
  // Là giai đoạn của KHÁCH (đo số lượng ở Báo cáo), đổi từ dòng báo giá cho tiện. Giữ khớp với cột
  // Trạng thái HĐ: "Ký hợp đồng" = báo giá này Chốt HĐ; rời "Ký hợp đồng" thì báo giá về "Đã gửi HĐ".
  if (b.action === 'care') {
    const care = b.care
    if (!['cham_soc', 'ky_hd', 'that_bai'].includes(care)) return Response.json({ error: 'Tình trạng không hợp lệ' }, { status: 400 })
    if (!q.lead_id) return Response.json({ error: 'Báo giá chưa gắn khách tiềm năng' }, { status: 400 })
    const cur = careOf(lead?.stage)
    if (care === cur) return Response.json({ ok: true })
    const setContractTo = async (st, why) => {
      if (q.contract_status === st) return
      await admin.from('sales_quotes').update({ contract_status: st, contract_changed_at: now, updated_at: now }).eq('id', q.id)
      await logLead(admin, q.lead_id, 'Báo giá ' + q.quote_no + ': ' + contractLabel(q.contract_status) + ' → ' + contractLabel(st) + ' (' + why + ')', me)
    }

    if (care === 'ky_hd') {
      if (!canExportPrice(q.price_status)) return Response.json({ error: 'Mức phí chưa được Giám đốc duyệt — chưa ký hợp đồng được' }, { status: 400 })
      await setContractTo('signed', 'ký hợp đồng')
      await advanceLeadStage(admin, q.lead_id, 'chot', me, 'ký hợp đồng báo giá ' + q.quote_no)
      return Response.json({ ok: true })
    }

    if (care === 'that_bai') {
      const reason = String(b.lost_reason || '').trim()
      if (!reason) return Response.json({ error: 'Ghi lý do thất bại — cần để báo cáo lý do mất khách' }, { status: 400 })
      if (q.contract_status === 'signed') await setContractTo('sent', 'khách không ký')
      const { error } = await admin.from('sales_leads').update({ stage: 'that_bai', lost_reason: reason, stage_changed_at: now, updated_at: now }).eq('id', q.lead_id)
      if (error) return Response.json({ error: error.message }, { status: 400 })
      await logLead(admin, q.lead_id, 'Giai đoạn → Không thành — lý do: ' + reason + ' (từ báo giá ' + q.quote_no + ')', me)
      return Response.json({ ok: true })
    }

    // care === 'cham_soc': kéo khách về đang chăm sóc
    if (q.contract_status === 'signed') await setContractTo('sent', 'chưa ký')
    await recomputeLeadStage(admin, q.lead_id, me, 'chăm sóc lại từ báo giá ' + q.quote_no)
    return Response.json({ ok: true })
  }

  // ── Sửa nội dung báo giá (tính lại phí ở server) ──
  if (b.action === 'update') {
    if (q.contract_status === 'signed') return Response.json({ error: 'Báo giá đã chốt HĐ — không sửa được nữa' }, { status: 400 })
    const p = priceQuote(b.survey, b.override)
    const s = p.survey
    if (!s.company.trim()) return Response.json({ error: 'Nhập tên công ty khách hàng trước đã' }, { status: 400 })
    const reason = String(b.override?.reason || '').trim()
    if (p.overrideOn && !reason) return Response.json({ error: 'Ghi lý do đề xuất mức phí khác' }, { status: 400 })
    if (p.overrideOn && !(p.overrideAmount > 0)) return Response.json({ error: 'Nhập mức phí đề xuất' }, { status: 400 })

    // Đề xuất giá: giữ kết quả duyệt CHỈ KHI mức phí + lý do không đổi. Đổi bất cứ gì → duyệt lại.
    let price_status = 'ok', review = { reviewed_by: null, reviewed_at: null, review_note: null }
    if (p.overrideOn) {
      const same = q.override_on && Number(q.override_amount) === p.overrideAmount && (q.override_reason || '') === reason
      if (same && (q.price_status === 'approved' || q.price_status === 'rejected')) { price_status = q.price_status; review = {} }
      else price_status = 'pending'
    }
    const { data: updated, error } = await admin.from('sales_quotes').update({
      company_name: s.company.trim(), tax_code: s.mst || null,
      survey: s, fees: p.fees, standard_monthly: p.standardMonthly, monthly_final: p.monthlyFinal,
      override_on: p.overrideOn, override_amount: p.overrideAmount, override_reason: p.overrideOn ? reason : null,
      price_status, ...review, updated_at: now,
      ...(file ? { survey_file_name: file.name } : {}),
    }).eq('id', q.id).select('*').single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    if (Number(q.monthly_final) !== p.monthlyFinal || q.price_status !== price_status) {
      await logLead(admin, q.lead_id, 'Sửa báo giá ' + q.quote_no + ': ' + money(q.monthly_final) + ' → ' + money(p.monthlyFinal) + '/tháng' +
        (price_status === 'pending' ? ' (chờ Giám đốc duyệt)' : ''), me)
    }
    const drive = await fileOnSave(admin, updated, file?.bytes)
    return Response.json({ data: { ...updated, drive_folder_url: drive.folderUrl || updated.drive_folder_url }, drive })
  }

  return Response.json({ error: 'Thao tác không hợp lệ' }, { status: 400 })
}

// DELETE ?id= — xoá mềm (số báo giá đã phát không dùng lại). Không xoá báo giá đã chốt HĐ.
export async function DELETE(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const id = new URL(request.url).searchParams.get('id')
  const { data: q } = await admin.from('sales_quotes').select('*').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!q) return Response.json({ error: 'Không tìm thấy báo giá' }, { status: 404 })
  const { data: lead } = q.lead_id ? await admin.from('sales_leads').select('id, assigned_to').eq('id', q.lead_id).maybeSingle() : { data: null }
  if (!canEditQuote(auth, q, lead)) return Response.json({ error: 'Báo giá do người khác lập' }, { status: 403 })
  if (q.contract_status === 'signed') return Response.json({ error: 'Báo giá đã chốt HĐ — không xoá được' }, { status: 400 })
  const { error } = await admin.from('sales_quotes').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  await logLead(admin, q.lead_id, 'Xoá báo giá ' + q.quote_no, auth.caller.staffId)
  return Response.json({ ok: true })
}
