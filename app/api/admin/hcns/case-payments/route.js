import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

// Công nợ hồ sơ Thời điểm / Vãng lai — sổ ghi nối tiếp, mỗi lần thu là 1 dòng (khách trả nhiều
// lần trong cùng tháng, có thể mỗi lần cho một dịch vụ khác nhau).

// GET ?hcnsClientId=... -> tổng phải thu / đã thu / còn lại, chi tiết theo từng dịch vụ, và nhật ký thu.
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const hcnsClientId = searchParams.get('hcnsClientId')
  if (!hcnsClientId) return Response.json({ error: 'Thiếu hcnsClientId' }, { status: 400 })

  const supabase = getAdmin()
  const [{ data: services }, { data: payments, error }, { data: staff }, { data: templates }] = await Promise.all([
    supabase.from('hcns_case_services').select('id, template_id, cost, received_at, created_at').eq('hcns_client_id', hcnsClientId),
    supabase.from('hcns_case_payments').select('*').eq('hcns_client_id', hcnsClientId)
      .order('created_at', { ascending: false }),
    supabase.from('staff').select('id, full_name'),
    supabase.from('hcns_service_templates').select('id, name'),
  ])
  // Chưa chạy sql/07_hcns_case_payments.sql (hoặc bản clone) — trả rỗng, không phải lỗi.
  if (error) return Response.json({ data: [], totals: null, notInstalled: true })

  const staffById = new Map((staff || []).map(s => [s.id, s]))
  const tplById = new Map((templates || []).map(t => [t.id, t]))
  const svcName = (id) => {
    const s = (services || []).find(x => x.id === id)
    return s ? (tplById.get(s.template_id)?.name || 'Dịch vụ') : null
  }

  const totalCost = (services || []).reduce((a, s) => a + (Number(s.cost) || 0), 0)
  const totalPaid = (payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0)

  const alloc = allocatePayments(services, payments)
  const perService = (services || []).map(s => {
    const a = alloc.get(s.id)
    return {
      id: s.id, name: tplById.get(s.template_id)?.name || 'Dịch vụ',
      cost: a.cost, paidDirect: a.direct, paidShared: a.shared,
      paid: a.direct + a.shared, remain: a.remain,
    }
  })
  // Khoản thu chung (không gắn dịch vụ nào) — đã được trừ lần lượt vào dịch vụ ở trên.
  const unassigned = (payments || []).filter(p => !p.case_service_id)
    .reduce((a, p) => a + (Number(p.amount) || 0), 0)

  return Response.json({
    totals: {
      totalCost, totalPaid, remain: Math.max(0, totalCost - totalPaid),
      unassigned,
      percent: totalCost > 0 ? Math.round(totalPaid / totalCost * 100) : null,
    },
    perService,
    data: (payments || []).map(p => ({
      ...p,
      amount: Number(p.amount) || 0,
      serviceName: p.case_service_id ? svcName(p.case_service_id) : null,
      createdByName: staffById.get(p.created_by)?.full_name || null,
    })),
  })
}

// POST — ghi 1 lần thu.
// Body: { hcnsClientId, caseServiceId?, amount, note?, force? }
//   caseServiceId bỏ trống = thu chung cho cả hồ sơ.
export async function POST(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { hcnsClientId, caseServiceId, amount, note, force, paid_at } = await request.json()
  if (!hcnsClientId) return Response.json({ error: 'Thiếu hồ sơ' }, { status: 400 })
  // Ngày khách trả thật (sql/20). Không cho ghi ngày trong tương lai.
  const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  if (paid_at && (!/^\d{4}-\d{2}-\d{2}$/.test(paid_at) || paid_at > todayVN)) {
    return Response.json({ error: 'Ngày thu không hợp lệ (không được sau hôm nay).' }, { status: 400 })
  }
  const amt = Number(amount) || 0
  if (amt <= 0) return Response.json({ error: 'Số tiền phải lớn hơn 0' }, { status: 400 })

  const supabase = getAdmin()
  const [{ data: services }, { data: payments }] = await Promise.all([
    supabase.from('hcns_case_services').select('id, cost, received_at, created_at').eq('hcns_client_id', hcnsClientId),
    supabase.from('hcns_case_payments').select('amount, case_service_id').eq('hcns_client_id', hcnsClientId),
  ])

  // Chặn thu vượt — cùng tinh thần với công nợ kế toán: không cho ghi quá số phải thu, nêu rõ
  // còn lại bao nhiêu để nhân viên sửa cho đúng thay vì đoán.
  if (!force) {
    if (caseServiceId) {
      const svc = (services || []).find(s => s.id === caseServiceId)
      if (svc) {
        // Còn phải thu của dịch vụ = phí − thu riêng − phần thu chung đã trừ vào nó.
        const remain = allocatePayments(services, payments).get(caseServiceId)?.remain ?? 0
        if (amt > remain) {
          return Response.json({
            error: 'Dịch vụ này chỉ còn phải thu ' + fmt(remain) + 'đ. Nhập lại đúng số, hoặc chọn "Thu chung cho cả hồ sơ" nếu khách trả gộp nhiều dịch vụ.',
            remain,
          }, { status: 409 })
        }
      }
    } else {
      const totalCost = (services || []).reduce((a, s) => a + (Number(s.cost) || 0), 0)
      const totalPaid = (payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0)
      const remain = totalCost - totalPaid
      if (amt > remain) {
        return Response.json({
          error: 'Hồ sơ này chỉ còn phải thu ' + fmt(remain) + 'đ (tổng chi phí ' + fmt(totalCost) + 'đ, đã thu ' + fmt(totalPaid) + 'đ).',
          remain,
        }, { status: 409 })
      }
    }
  }

  const { data, error } = await supabase.from('hcns_case_payments').insert({
    hcns_client_id: hcnsClientId,
    case_service_id: caseServiceId || null,
    amount: amt,
    note: note || null,
    paid_at: paid_at || todayVN,
    created_by: auth.caller?.staffId || null,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// PATCH { id, paid_at } — sửa NGÀY THU của khoản đã ghi (ghi muộn, chọn nhầm ngày). Không đổi số tiền.
export async function PATCH(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { id, paid_at } = await request.json()
  const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(String(paid_at || '')) || paid_at > todayVN) {
    return Response.json({ error: 'Ngày thu không hợp lệ (không được sau hôm nay).' }, { status: 400 })
  }
  const { error } = await getAdmin().from('hcns_case_payments').update({ paid_at }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}

// DELETE ?id=... — xoá 1 lần thu ghi nhầm. Sổ thu là dữ liệu tiền nên chỉ quản trị viên và người
// có manage_hcns được xoá; nhật ký các dòng còn lại giữ nguyên.
export async function DELETE(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from('hcns_case_payments').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}

// Chia tiền cho từng dịch vụ: tiền thu RIÊNG của dịch vụ trước, rồi tiền "thu chung cho cả hồ sơ"
// trừ lần lượt vào các dịch vụ còn nợ — dịch vụ nhận trước trừ trước. Không có bước này thì khách
// đã trả đủ bằng 1 khoản thu chung mà từng dòng dịch vụ vẫn báo "còn" (ca DT. GROUP).
function allocatePayments(services, payments) {
  const out = new Map()
  const list = [...(services || [])].sort((a, b) =>
    String(a.received_at || a.created_at || '').localeCompare(String(b.received_at || b.created_at || '')))
  for (const s of list) {
    const direct = (payments || []).filter(p => p.case_service_id === s.id)
      .reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const cost = Number(s.cost) || 0
    out.set(s.id, { cost, direct, shared: 0, remain: Math.max(0, cost - direct) })
  }
  let pool = (payments || []).filter(p => !p.case_service_id).reduce((a, p) => a + (Number(p.amount) || 0), 0)
  for (const s of list) {
    if (pool <= 0) break
    const a = out.get(s.id)
    const take = Math.min(pool, a.remain)
    a.shared += take; a.remain -= take; pool -= take
  }
  return out
}
