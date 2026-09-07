// Tra phí HCNS ĐÚNG của một tháng.
//
// Vì sao không dùng thẳng resolveFeeForMonth: hàm đó rơi về "phí sống" khi không tìm được mốc nào
// tại/trước tháng đang xét. Bên kế toán còn có client_change_log đỡ, bên HCNS thì KHÔNG có gì —
// nên mọi tháng trước khi công ty bật dịch vụ đều nhận nhầm mức phí hiện tại.
//
// Lỗi thật (2026-09-07): 7 công ty của phòng Aoraki tách phí HCNS áp dụng từ T9/2026. Mở Công nợ
// phòng xem T8/2026 thì 6 công ty hiện "Phí HCNS 540.000đ · Chưa thu", và thẻ "Còn phải thu tháng
// này" của T8 cộng thêm 3.780.000đ nợ không có thật.
//
// Luật: tháng nào SỚM HƠN lúc công ty bắt đầu dùng DV HCNS thì phí = 0. Mốc bắt đầu lấy theo mốc
// phí HCNS sớm nhất; chưa có mốc nào thì lấy tháng bật dịch vụ (hcns_clients.created_at).

import { resolveFeeForMonth } from './feeDue.js'

// Đổi (năm, tháng) thành một số để so sánh trước/sau cho gọn.
const ym = (y, m) => Number(y) * 12 + Number(m)

// planRows: mảng mốc phí HCNS, mỗi dòng có { client_id | hcns_client_id, year, month }.
export function hcnsStartMonth(planRows, hcnsId, createdAt) {
  let earliest = Infinity
  for (const r of planRows || []) {
    const id = r.client_id ?? r.hcns_client_id
    if (id !== hcnsId) continue
    earliest = Math.min(earliest, ym(r.year, r.month))
  }
  if (earliest !== Infinity) return earliest
  if (createdAt) {
    const d = new Date(createdAt)
    if (!Number.isNaN(d.getTime())) return ym(d.getFullYear(), d.getMonth() + 1)
  }
  // Không biết bắt đầu từ bao giờ -> không chặn, giữ nguyên hành vi cũ.
  return -Infinity
}

// Trả 0 cho các tháng trước khi bật dịch vụ, còn lại tra như bình thường.
export function resolveHcnsFeeForMonth(planRows, hcnsId, year, month, liveFee, createdAt) {
  if (ym(year, month) < hcnsStartMonth(planRows, hcnsId, createdAt)) return 0
  return resolveFeeForMonth(planRows || [], hcnsId, year, month, liveFee, [])
}
