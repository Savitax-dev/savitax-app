import { feeCountsForMonth } from './feeDue.js'
import { resolveHcnsFeeForMonth } from './hcnsFee.js'

// Tách khỏi app/api/admin/room/route.js để trang Quản lý công nợ (my-room) dùng chung khi dựng
// khối dòng tiền — hai trang phải đọc phí HCNS bằng CÙNG một hàm thì số mới khớp nhau.
// Phí HCNS + tiền đã thu của tháng đang xem, khoá theo id công ty KẾ TOÁN.
//
// ⚠ RÀNG BUỘC CLONE-APP: bản clone không có bảng hcns_*. Thiếu bảng -> trả {} và trang Công nợ
// phòng chạy y như trước, không thẻ HCNS, không lỗi.
export async function loadHcnsFees(supabase, clientIds, year, month) {
  const out = {}
  if (!clientIds?.length) return { installed: false, byClient: out }

  const { data: links, error } = await supabase.from('hcns_clients')
    .select('id, linked_client_id, hcns_fee, fee_period, created_at')
    .in('linked_client_id', clientIds).eq('category', 'thoi_ky').eq('is_active', true)
  // Lỗi = thiếu bảng (bản clone). Không lỗi mà rỗng = có module, chỉ là chưa ai bật DV HCNS.
  if (error) return { installed: false, byClient: out }
  if (!links?.length) return { installed: true, byClient: out, links: [], plans: [], paid: [] }

  const { data: fees } = await supabase.from('hcns_service_fees')
    .select('hcns_client_id, year, month, amount, type').in('hcns_client_id', links.map(l => l.id))

  const paid = new Map()
  const plans = []
  for (const f of fees || []) {
    if (f.type === 'hcns') paid.set(f.hcns_client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)
    // resolveFeeForMonth lọc theo trường client_id — đổi tên khoá cho khớp.
    else if (f.type === 'fee_plan') plans.push({ ...f, client_id: f.hcns_client_id })
  }

  for (const l of links) {
    // Công ty HCNS thu theo quý: tháng không phải cuối quý chưa tới hạn, phí tính 0 cho tháng đó
    // — cùng luật với phí kế toán, tránh nhân sai x3.
    const due = feeCountsForMonth(l.fee_period, year, month)
    out[l.linked_client_id] = {
      due,
      // Tháng trước khi công ty bật DV HCNS phải là 0 — xem lib/hcnsFee.js.
      fee: due ? resolveHcnsFeeForMonth(plans, l.id, year, month, Number(l.hcns_fee) || 0, l.created_at) : 0,
      collected: paid.get(l.id + '_' + year + '_' + month) || 0,
    }
  }
  // Trả kèm LỊCH SỬ phí/tiền thu HCNS (mọi tháng, không chỉ tháng đang xem) để tính được
  // "tồn đầu kỳ" phần HCNS — phí HCNS tách riêng từ T9/2026, phần chưa thu của các kỳ trước
  // phải chuyển sang kỳ này.
  return {
    installed: true, byClient: out, links, plans,
    paid: [...paid.entries()].map(([k, v]) => [k, v]),
  }
}
