import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { getHcnsTeam } from '@/lib/hcnsTeam'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/staff — người của phòng HCNS, để trưởng phòng chọn người phụ trách.
//
// "Người của phòng HCNS" xác định theo QUYỀN chứ không theo staff.room_id — xem lib/hcnsTeam.js
// để hiểu vì sao (một nhân viên chỉ có một vai trò và một phòng, nhưng thực tế có người vừa làm
// kế toán vừa là trưởng phòng HCNS).
export async function GET() {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { room, staff } = await getHcnsTeam(supabase)
  return Response.json({ data: staff, roomId: room?.id || null })
}
