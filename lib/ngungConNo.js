// Khối "⏸ Đã ngưng dịch vụ — còn phải thu" (trang Phòng + Quản lý công nợ) — anh chốt 16/11/2026.
//
// Khối này để NHẮC ĐÒI tiền, nên lấy số dư TỚI HÔM NAY (kỳ hiện tại giờ VN), KHÔNG theo tháng đang xem.
// Trước đây lấy "chuyển kỳ sau" của tháng đang xem → xem lại T10 thì công ty đã trả đủ ngày 12/11 vẫn hiện
// "còn phải thu" (ca HKD KARAOKE STAR). 5 thẻ dòng tiền KHÔNG đổi — vẫn là số lịch sử của kỳ đang xem.
import { tinhDongTienPhong } from './dongTienPhong.js'

export function kyHienTaiVN(now = new Date()) {
  const d = new Date(now.getTime() + 7 * 3600 * 1000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

// clients: các công ty (nhân viên chính) — tự lọc lấy công ty đã ngưng. Trả đúng khuôn `ngungConNo` của
// tinhDongTienPhong: [{ clientId, name, total, ketoan, hcns, dvk, client, … }].
export async function ngungConNoHienTai(supabase, clients) {
  const st = (clients || []).filter(c => (c.status || 'active') !== 'active')
  if (!st.length) return []
  const ids = st.map(c => c.id)
  const [{ data: plans }, { data: logs }] = await Promise.all([
    supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', ids).eq('type', 'fee_plan'),
    supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', ids).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])
  const { year, month } = kyHienTaiVN()
  const dt = await tinhDongTienPhong(supabase, {
    clients: st, year, month, feePlanRows: plans || [], changeLogRows: logs || [],
    // 4 kỳ gần nhất: phí chưa thu mà chưa kịp chốt sổ chỉ có thể nằm ở 1–2 kỳ cuối trước khi ngưng.
    lichSuTu: year * 12 + month - 4,
  })
  return dt.ngungConNo || []
}
