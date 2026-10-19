import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { tinhKpiToanCty } from '@/lib/kpiTongQuan'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/kpi-overview?year=2026&month=6 — quy tắc tính và chú thích ở lib/kpiTongQuan.js.
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const year  = Number(searchParams.get('year')  || new Date().getFullYear())
  const month = Number(searchParams.get('month') || new Date().getMonth() + 1)

  const supabase = getAdmin()

  const { rooms: roomResults, staff: staffResults, company } = await tinhKpiToanCty(supabase, year, month)

  // Trang "Phòng nghiệp vụ" (/rooms) cũng dùng chung API này để hiện tổng quan TOÀN BỘ phòng cho
  // mọi role (không phải dữ liệu cần giấu ở mức tổng hợp %) — việc giới hạn trưởng phòng chỉ thấy
  // đúng phòng mình khi xem "Báo cáo KPI" được lọc riêng ở app/report/page.js (client-side), không
  // lọc ở đây để tránh phá trang /rooms.
  return Response.json({ rooms: roomResults, staff: staffResults, company })
}
