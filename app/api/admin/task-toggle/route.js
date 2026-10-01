import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canUncheckTask } from '@/lib/checklistScope'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST { clientId, taskDefId, year, month, isDone, userId }
//
// isDone = trạng thái HIỆN TẠI trước khi toggle — isDone=true nghĩa là request này đang xin BỎ
// TICK (chuyển đã làm -> chưa làm).
//
// TICK MỚI: mọi nhân viên đăng nhập đều được.
// BỎ TICK: phải có quyền `uncheck_task` VÀ công ty phải trong phạm vi của người đó
// (lib/checklistScope.js). Trước 01/10/2026 chỗ này là `requireAdmin()` cứng; anh chốt mở cho
// trưởng phòng nhưng "không đụng lẫn nhau" nên quyền thôi chưa đủ, còn phải đúng phạm vi.
// Chặn ở đây là lớp THẬT — giao diện chỉ làm mờ nút, gọi thẳng API vẫn phải qua cửa này.
export async function POST(request) {
  const { clientId, taskDefId, year, month, isDone, userId, recordId } = await request.json()
  if (!clientId || !taskDefId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const authCheck = await requireLogin()
  if (!authCheck.ok) return Response.json({ error: authCheck.error }, { status: authCheck.status })

  const supabase = getAdmin()

  if (isDone && !(await canUncheckTask(supabase, authCheck.caller, clientId))) {
    return Response.json(
      { error: 'Không có quyền bỏ tick việc đã hoàn thành của công ty này' }, { status: 403 })
  }
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
