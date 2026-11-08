// Theo dõi hợp đồng — ghi các lần khách trả tiền (đề xuất Phòng Kinh doanh 04/11/2026, "Sửa 3").
//
// SỐ CẦN THU KHÔNG LƯU Ở ĐÂY: route trả về bảng khoản phí của từng hợp đồng, giao diện gọi
// trackContract() dựng kỳ thu — hợp đồng có phí tháng tự sinh kỳ mới mỗi tháng, luôn khớp báo giá.
// Số chưa VAT (net) LUÔN tính lại ở server từ số tiền về tài khoản — không tin số trình duyệt gửi.
import { requireSales, canEditQuote, fetchAll, loadSalesStaff } from '@/lib/salesScope'
import { normalizePayment } from '@/lib/salesContract'
import { monthVN } from '@/lib/salesItems'

const PAY_COLS = 'id, quote_id, due_month, paid_month, gross, vat_rate, net, staff_id, note, created_at'
const ITEM_COLS = 'sort_order, service, billing, amount, months, start_month, to_savitax'

// Bảng mới (sql/54) chưa chạy thì trả danh sách rỗng kèm cờ — giao diện báo "chưa cài" chứ không văng lỗi.
// Lật trang và sắp theo id: PostgREST cắt im lặng ở 1000 dòng, sắp theo cột trùng nhau thì vừa
// lặp vừa sót (đã làm sai KPI toàn công ty tháng 8).
async function loadPayments(admin) {
  try {
    const { error } = await admin.from('sales_contract_payments').select('id').limit(1)
    if (error) return null
    return await fetchAll((a, b) => admin.from('sales_contract_payments').select(PAY_COLS).order('id').range(a, b))
  } catch (_) { return null }
}

async function loadQuote(admin, id) {
  const { data } = await admin.from('sales_quotes')
    .select('id, quote_no, company_name, author_id, lead_id, contract_status, is_deleted')
    .eq('id', id).maybeSingle()
  return data && !data.is_deleted ? data : null
}

// GET — danh sách hợp đồng ĐÃ CHỐT kèm khoản phí + các lần đã thu
export async function GET() {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin

  const quotes = await fetchAll((a, b) => admin.from('sales_quotes')
    .select('id, quote_no, quote_date, company_name, tax_code, author_id, author_name, lead_id, monthly_final, fee_monthly, fee_once, fee_year1')
    .eq('is_deleted', false).eq('contract_status', 'signed')
    .order('quote_date', { ascending: false }).order('seq', { ascending: false }).range(a, b))

  const ids = quotes.map(q => q.id)
  const [items, payments] = await Promise.all([
    ids.length
      ? fetchAll((a, b) => admin.from('sales_quote_items').select(ITEM_COLS + ', quote_id').in('quote_id', ids).order('quote_id').order('sort_order').range(a, b))
      : Promise.resolve([]),
    loadPayments(admin),
  ])
  const byQuote = new Map()
  for (const it of items) { if (!byQuote.has(it.quote_id)) byQuote.set(it.quote_id, []); byQuote.get(it.quote_id).push(it) }
  const payByQuote = new Map()
  for (const p of payments || []) { if (!payByQuote.has(p.quote_id)) payByQuote.set(p.quote_id, []); payByQuote.get(p.quote_id).push(p) }

  const leadIds = [...new Set(quotes.map(q => q.lead_id).filter(Boolean))]
  const [{ data: leads }, staff] = await Promise.all([
    leadIds.length ? admin.from('sales_leads').select('id, assigned_to').in('id', leadIds) : Promise.resolve({ data: [] }),
    loadSalesStaff(admin),
  ])
  const leadMap = new Map((leads || []).map(l => [l.id, l]))

  return Response.json({
    month: monthVN(),
    ready: payments !== null,
    perms: auth.perms,
    me: auth.caller.staffId,
    staff,
    contracts: quotes.map(q => ({
      ...q,
      items: byQuote.get(q.id) || [],
      payments: payByQuote.get(q.id) || [],
      canEdit: canEditQuote(auth, q, leadMap.get(q.lead_id) || null),
    })),
  })
}

// POST — ghi một lần thu
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))

  const quote = await loadQuote(admin, b.quote_id)
  if (!quote) return Response.json({ error: 'Không tìm thấy hợp đồng' }, { status: 404 })
  const { data: lead } = quote.lead_id
    ? await admin.from('sales_leads').select('id, assigned_to').eq('id', quote.lead_id).maybeSingle()
    : { data: null }
  if (!canEditQuote(auth, quote, lead)) return Response.json({ error: 'Chỉ người lập báo giá hoặc trưởng phòng mới ghi được lần thu' }, { status: 403 })
  if (quote.contract_status !== 'signed') return Response.json({ error: 'Hợp đồng chưa chốt — chuyển tình trạng khách sang "Chốt hợp đồng" trước' }, { status: 400 })

  const p = normalizePayment(b, monthVN())
  if (!p.gross) return Response.json({ error: 'Chưa nhập số tiền về tài khoản' }, { status: 400 })

  const { data, error } = await admin.from('sales_contract_payments').insert({
    ...p, quote_id: quote.id,
    staff_id: b.staff_id || quote.author_id || auth.caller.staffId,
    created_by: auth.caller.staffId,
  }).select(PAY_COLS).single()
  if (error) return Response.json({ error: 'Chưa ghi được lần thu: ' + error.message }, { status: 500 })
  return Response.json({ data })
}

// PATCH — sửa một lần thu
export async function PATCH(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))

  const { data: cur } = await admin.from('sales_contract_payments').select('id, quote_id').eq('id', b.id).maybeSingle()
  if (!cur) return Response.json({ error: 'Không tìm thấy lần thu' }, { status: 404 })
  const quote = await loadQuote(admin, cur.quote_id)
  const { data: lead } = quote?.lead_id
    ? await admin.from('sales_leads').select('id, assigned_to').eq('id', quote.lead_id).maybeSingle()
    : { data: null }
  if (!canEditQuote(auth, quote, lead)) return Response.json({ error: 'Không có quyền sửa lần thu này' }, { status: 403 })

  const p = normalizePayment(b, monthVN())
  const { data, error } = await admin.from('sales_contract_payments')
    .update({ ...p, ...(b.staff_id ? { staff_id: b.staff_id } : {}), updated_at: new Date().toISOString() })
    .eq('id', b.id).select(PAY_COLS).single()
  if (error) return Response.json({ error: 'Chưa sửa được: ' + error.message }, { status: 500 })
  return Response.json({ data })
}

// DELETE ?id= — xoá hẳn một lần thu (ghi nhầm số)
export async function DELETE(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const id = new URL(request.url).searchParams.get('id')

  const { data: cur } = await admin.from('sales_contract_payments').select('id, quote_id').eq('id', id).maybeSingle()
  if (!cur) return Response.json({ error: 'Không tìm thấy lần thu' }, { status: 404 })
  const quote = await loadQuote(admin, cur.quote_id)
  const { data: lead } = quote?.lead_id
    ? await admin.from('sales_leads').select('id, assigned_to').eq('id', quote.lead_id).maybeSingle()
    : { data: null }
  if (!canEditQuote(auth, quote, lead)) return Response.json({ error: 'Không có quyền xoá lần thu này' }, { status: 403 })

  const { error } = await admin.from('sales_contract_payments').delete().eq('id', id)
  if (error) return Response.json({ error: 'Chưa xoá được: ' + error.message }, { status: 500 })
  return Response.json({ ok: true })
}
