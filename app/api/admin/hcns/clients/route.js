import { createClient } from '@supabase/supabase-js'
import { requireLogin, callerHasPermission } from '@/lib/serverAuth'
import { writeHcnsFeePlan, applyScheduledHcnsStops } from '@/lib/hcnsSync'
import { hcnsDueState } from '@/lib/hcnsDue'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/clients?category=thoi_ky|thoi_diem|vang_lai   (bỏ trống = lấy tất cả)
// Trả kèm nhân viên phụ trách + công ty kế toán gốc (với khách thời kỳ).
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const supabase = getAdmin()
  // Công ty đã HẸN ngừng mà nay đã tới tháng ngừng thì gỡ khỏi tag Thời kỳ ngay tại đây —
  // chạy lười mỗi lần tải danh sách, cùng kiểu ensureRollovers, khỏi cần cron.
  await applyScheduledHcnsStops(supabase)

  // Mặc định chỉ lấy công ty đang hoạt động. Trang Công ty phụ trách gọi kèm includeStopped=1
  // để dựng thẻ "Ngưng DV HCNS" — dữ liệu công ty đã ngừng KHÔNG bị xoá, chỉ đánh dấu ngừng.
  const includeStopped = searchParams.get('includeStopped') === '1'
  let q = supabase.from('hcns_clients').select('*').order('name')
  if (!includeStopped) q = q.eq('is_active', true)
  if (category) q = q.eq('category', category)
  const { data: rows, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const staffIds = [...new Set((rows || []).map(r => r.assigned_to).filter(Boolean))]
  const linkedIds = [...new Set((rows || []).map(r => r.linked_client_id).filter(Boolean))]

  const [{ data: staffList }, { data: linkedClients }] = await Promise.all([
    staffIds.length ? supabase.from('staff').select('id, full_name').in('id', staffIds) : { data: [] },
    linkedIds.length
      ? supabase.from('clients').select('id, name, client_code, tax_code, monthly_fee, fee_period, assigned_to').in('id', linkedIds)
      : { data: [] },
  ])
  const staffMap = new Map((staffList || []).map(s => [s.id, s]))
  const clientMap = new Map((linkedClients || []).map(c => [c.id, c]))

  // Tiến độ dịch vụ của hồ sơ Thời điểm/Vãng lai — để danh sách biết hồ sơ nào đã xong hết mà
  // chuyển sang thẻ "Hoàn thành". Không có phần này thì trạng thái chỉ biết được sau khi bấm mở
  // từng hồ sơ, không dựng được thẻ.
  // Gồm cả công ty Thời kỳ: dịch vụ gắn vào bản ghi Thời kỳ là "việc phát sinh" (không phí) —
  // trang Thời kỳ – Phát sinh đọc serviceCount/doneServiceCount của chúng.
  const caseIds = (rows || []).map(r => r.id)
  const { data: svcs } = caseIds.length
    ? await supabase.from('hcns_case_services').select('hcns_client_id, status, cost, due_at, completed_at').in('hcns_client_id', caseIds)
    : { data: [] }
  // Tiền của hồ sơ — để danh sách đánh dấu được hồ sơ đã xong việc mà chưa thu đủ. Thiếu bảng
  // (chưa chạy sql/07) thì coi như chưa thu đồng nào, không phải lỗi.
  const { data: pays } = caseIds.length
    ? await supabase.from('hcns_case_payments').select('hcns_client_id, amount').in('hcns_client_id', caseIds)
    : { data: [] }
  const paidBy = new Map()
  for (const p of pays || []) {
    paidBy.set(p.hcns_client_id, (paidBy.get(p.hcns_client_id) || 0) + (Number(p.amount) || 0))
  }
  const svcStat = new Map()
  for (const sv of svcs || []) {
    const a = svcStat.get(sv.hcns_client_id) || { total: 0, done: 0, cost: 0, late: 0 }
    a.total += 1
    // Đang làm mà đã quá hạn hoàn thành — nhãn "Trễ hạn" ở dòng công ty.
    if (hcnsDueState(sv).kind === 'late') a.late += 1
    a.cost += Number(sv.cost) || 0
    if (sv.status === 'hoan_thanh') a.done += 1
    svcStat.set(sv.hcns_client_id, a)
  }

  const data = (rows || []).map(r => ({
    ...r,
    hcns_fee: Number(r.hcns_fee) || 0,
    other_debt: Number(r.other_debt) || 0,
    serviceCount: svcStat.get(r.id)?.total || 0,
    doneServiceCount: svcStat.get(r.id)?.done || 0,
    lateServiceCount: svcStat.get(r.id)?.late || 0,
    // Hồ sơ CHƯA khai dịch vụ nào thì chưa gọi là xong — vẫn còn việc phải làm.
    allDone: (svcStat.get(r.id)?.total || 0) > 0
      && svcStat.get(r.id).done === svcStat.get(r.id).total,
    caseCost: svcStat.get(r.id)?.cost || 0,
    casePaid: paidBy.get(r.id) || 0,
    caseRemain: Math.max(0, (svcStat.get(r.id)?.cost || 0) - (paidBy.get(r.id) || 0)),
    staff: staffMap.get(r.assigned_to) || null,
    linkedClient: clientMap.get(r.linked_client_id) || null,
  }))
  return Response.json({ data })
}

// POST — tạo hồ sơ "Thời điểm" / "Vãng lai" (khách thời kỳ KHÔNG tạo ở đây; nó sinh tự động khi
// nhân viên kế toán tick "Có sử dụng DV HCNS" — xem lib/hcnsSync.js).
export async function POST(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { category, name, case_code, tax_code, address, representative, tax_status, phone, assigned_to, note } = body

  if (!name) return Response.json({ error: 'Thiếu tên công ty / khách hàng' }, { status: 400 })
  if (!['thoi_diem', 'vang_lai'].includes(category)) {
    return Response.json({ error: 'Loại khách phải là Thời điểm hoặc Vãng lai' }, { status: 400 })
  }
  if (!case_code) return Response.json({ error: 'Thiếu Mã hồ sơ' }, { status: 400 })
  if (!assigned_to) return Response.json({ error: 'Vui lòng chọn nhân viên phụ trách' }, { status: 400 })

  const supabase = getAdmin()
  const { data, error } = await supabase.from('hcns_clients').insert({
    category, name, case_code,
    tax_code: tax_code || null,
    address: address || null,
    representative: representative || null,
    tax_status: tax_status || null,
    phone: phone || null,
    assigned_to,
    note: note || null,
    is_active: true,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ data })
}

// PATCH — sửa thông tin / phí / người phụ trách. Đổi phí thì ghi thêm mốc fee_plan để sau này
// tra được phí ĐÚNG của tháng cũ (giống cơ chế bên kế toán).
export async function PATCH(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.caller) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, hcns_fee, fee_period, assigned_to, name, case_code, tax_code, address,
    representative, phone, note, status, is_active, updatedBy } = body
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: before } = await supabase.from('hcns_clients')
    .select('hcns_fee, category, linked_client_id').eq('id', id).maybeSingle()
  if (!before) return Response.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 })

  // Chỉ đổi PHÍ HCNS của công ty Thời kỳ: kế toán phụ trách công ty gốc được làm (điều chỉnh phí ở
  // "Danh sách công ty"), không cần quyền manage_hcns — cùng phạm vi được sửa phí kế toán.
  const sentKeys = Object.keys(body).filter(k => !['id', 'updatedBy'].includes(k))
  const feeOnly = sentKeys.length > 0 && sentKeys.every(k => k === 'hcns_fee')
  if (!auth.ok) {
    const allowed = feeOnly && before.category === 'thoi_ky' && before.linked_client_id &&
      await canEditLinkedFee(supabase, auth.caller, before.linked_client_id)
    if (!allowed) return Response.json({ error: auth.error || 'Không đủ quyền' }, { status: 403 })
  }

  // Sửa thông tin nhận diện hồ sơ (mã hồ sơ, tên, MST...) cần quyền riêng edit_hcns_case_info
  // (sql/17) — admin luôn có. Phân công / phí / trạng thái vẫn theo manage_hcns như cũ.
  const INFO_KEYS = ['name', 'case_code', 'tax_code', 'address', 'representative', 'phone', 'category']
  if (sentKeys.some(k => INFO_KEYS.includes(k))) {
    const infoPerm = await callerHasPermission('edit_hcns_case_info')
    if (!infoPerm.ok) return Response.json({ error: 'Không có quyền sửa thông tin hồ sơ' }, { status: 403 })
  }

  const patch = {}
  if (hcns_fee       !== undefined) patch.hcns_fee       = Number(hcns_fee) || 0
  if (fee_period     !== undefined) patch.fee_period     = fee_period
  if (assigned_to    !== undefined) patch.assigned_to    = assigned_to
  if (name           !== undefined) patch.name           = name
  if (case_code      !== undefined) patch.case_code      = case_code
  if (tax_code       !== undefined) patch.tax_code       = tax_code
  if (address        !== undefined) patch.address        = address
  if (representative !== undefined) patch.representative = representative
  if (phone          !== undefined) patch.phone          = phone
  if (note           !== undefined) patch.note           = note
  if (status         !== undefined) patch.status         = status
  if (is_active      !== undefined) patch.is_active      = is_active === true
  // Đổi loại chỉ giữa Thời điểm ↔ Vãng lai; Thời kỳ gắn với công ty kế toán, không đổi ở đây.
  if (body.category !== undefined && ['thoi_diem', 'vang_lai'].includes(body.category)) {
    const { data: cur } = await supabase.from('hcns_clients').select('category').eq('id', id).maybeSingle()
    if (cur && ['thoi_diem', 'vang_lai'].includes(cur.category)) patch.category = body.category
  }

  const { error } = await supabase.from('hcns_clients').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  if (hcns_fee !== undefined && before && Number(before.hcns_fee) !== (Number(hcns_fee) || 0)) {
    await writeHcnsFeePlan(supabase, id, Number(hcns_fee) || 0, updatedBy || auth.caller?.staffId || null)
  }

  return Response.json({ ok: true })
}

// DELETE /api/admin/hcns/clients?id=...   — CHỈ quản trị viên, để dọn hồ sơ nhân viên tạo trùng/nhầm.
// Chỉ hồ sơ Thời điểm/Vãng lai (Thời kỳ gắn công nợ kế toán, dùng "Ngưng DV HCNS").
// Đã có khoản thu thì từ chối — không xoá mất dấu tiền thật.
export async function DELETE(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const roles = auth.caller.roles?.length ? auth.caller.roles : [auth.caller.role]
  if (!roles.includes('admin')) {
    return Response.json({ error: 'Chỉ tài khoản Quản trị được xoá hồ sơ' }, { status: 403 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: row } = await supabase.from('hcns_clients').select('id, name, category').eq('id', id).maybeSingle()
  if (!row) return Response.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 })
  if (!['thoi_diem', 'vang_lai'].includes(row.category)) {
    return Response.json({ error: 'Chỉ xoá được hồ sơ Thời điểm/Vãng lai' }, { status: 400 })
  }

  const { count: payCount, error: payErr } = await supabase.from('hcns_case_payments')
    .select('id', { count: 'exact', head: true }).eq('hcns_client_id', id)
  if (payErr) return Response.json({ error: payErr.message }, { status: 400 })
  if (payCount > 0) {
    return Response.json({ error: 'Hồ sơ đã ghi nhận ' + payCount + ' khoản thu — xoá các khoản thu trước rồi mới xoá hồ sơ' }, { status: 409 })
  }

  // Dịch vụ, checklist, nhật ký trạng thái, ghi chú + lượt đã đọc đều khai "on delete cascade".
  const { error } = await supabase.from('hcns_clients').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}

// Ai được đổi phí HCNS của 1 công ty Thời kỳ khi KHÔNG có manage_hcns — khớp phạm vi sửa phí kế
// toán ở /api/admin/clients: có manage_clients, là NV phụ trách chính, hoặc trưởng phòng của
// phòng chứa công ty đó (xét cả vai trò/phòng kiêm nhiệm).
async function canEditLinkedFee(supabase, caller, linkedClientId) {
  if (!caller?.staffId) return false
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  if (roles.includes('admin')) return true
  const { data: c } = await supabase.from('clients')
    .select('assigned_to, room_id').eq('id', linkedClientId).maybeSingle()
  if (!c) return false
  if (c.assigned_to === caller.staffId) return true
  if (c.room_id && rooms.includes(c.room_id) && roles.includes('leader')) return true
  const mc = await callerHasPermission('manage_clients')
  return mc.ok
}
