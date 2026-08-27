import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/staff — nhân viên thuộc phòng HCNS, để trưởng phòng chọn người phụ trách.
//
// Không dùng /api/admin/staff được: route đó chỉ mở rộng danh sách cho role 'admin' và 'leader',
// còn 'hcns_leader' rơi vào nhánh cuối nên chỉ thấy chính mình.
export async function GET() {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const { data: room } = await supabase.from('rooms').select('id').eq('type', 'hcns').maybeSingle()
  if (!room) return Response.json({ data: [] })

  const { data, error } = await supabase.from('staff')
    .select('id, full_name, role').eq('room_id', room.id).eq('is_active', true).order('full_name')
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data: data || [], roomId: room.id })
}
