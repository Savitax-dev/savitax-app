import { createClient } from '@supabase/supabase-js'
import { requireLogin, callerHasPermission } from '@/lib/serverAuth'
import { writeHcnsFeePlan, applyScheduledHcnsStops } from '@/lib/hcnsSync'

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
  const caseIds = (rows || []).filter(r => r.category !== 'thoi_ky').map(r => r.id)
  const { data: svcs } = caseIds.length
    ? await supabase.from('hcns_case_services').select('hcns_client_id, status, cost').in('hcns_client_id', caseIds)
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
    const a = svcStat.get(sv.hcns_client_id) || { total: 0, done: 0, cost: 0 }
    a.total += 1
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
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, hcns_fee, fee_period, assigned_to, name, case_code, tax_code, address,
    representative, phone, note, status, is_active, updatedBy } = body
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: before } = await supabase.from('hcns_clients').select('hcns_fee').eq('id', id).maybeSingle()

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

  const { error } = await supabase.from('hcns_clients').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  if (hcns_fee !== undefined && before && Number(before.hcns_fee) !== (Number(hcns_fee) || 0)) {
    await writeHcnsFeePlan(supabase, id, Number(hcns_fee) || 0, updatedBy || auth.caller?.staffId || null)
  }

  return Response.json({ ok: true })
}
