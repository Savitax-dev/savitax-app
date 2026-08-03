import { createClient } from '@supabase/supabase-js'
import { requireLogin, requireAdmin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST { clientId, taskDefId, year, month, isDone, userId }
// isDone = trạng thái HIỆN TẠI trước khi toggle — isDone=true nghĩa là request này đang xin BỎ
// TICK (chuyển đã làm -> chưa làm), chỉ admin thật được phép (nhân viên chỉ được tick MỚI, chưa
// từng được bỏ tick lại — xem ClientChecklist.js `toggleTask`). Chặn cả ở đây để không bị qua mặt
// bằng cách gọi thẳng API nếu lỡ có lỗi UI.
export async function POST(request) {
  const { clientId, taskDefId, year, month, isDone, userId, recordId } = await request.json()
  if (!clientId || !taskDefId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const authCheck = isDone ? await requireAdmin() : await requireLogin()
  if (!authCheck.ok) return Response.json({ error: authCheck.error }, { status: authCheck.status })

  const supabase = getAdmin()
  const now = new Date().toISOString()

  if (recordId) {
    // Update existing record
    const { data, error } = await supabase
      .from('task_records')
      .update({
        is_done: !isDone,
        done_by: !isDone ? userId : null,
        done_at: !isDone ? now : null,
      })
      .eq('id', recordId)
      .select().single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data })
  } else {
    // Upsert new record
    const { data, error } = await supabase
      .from('task_records')
      .upsert({
        client_id:   clientId,
        task_def_id: taskDefId,
        year:        Number(year),
        month:       Number(month),
        is_done:     true,
        done_by:     userId,
        done_at:     now,
      }, { onConflict: 'client_id,task_def_id,year,month' })
      .select().single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data })
  }
}
