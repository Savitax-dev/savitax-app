import { createClient } from '@supabase/supabase-js'
import { effectiveDeadlineDate } from '@/lib/deadline'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/today-reminders
// Trả về danh sách công việc checklist mẫu có hạn RƠI ĐÚNG HÔM NAY (đã áp quy tắc dời sang
// thứ 2 nếu hạn gốc rơi Chủ nhật) — dùng cho chuông nhắc nhở ở góc phải, không phụ thuộc
// công ty cụ thể (đây là nhắc theo checklist mẫu áp dụng chung).
export async function GET() {
  const supabase = getAdmin()
  const now = new Date()
  const year = now.getFullYear(), month = now.getMonth() + 1, today = now.getDate()

  const { data: defs } = await supabase
    .from('task_definitions')
    .select('id, name, report_type, deadline_day, month')
    .eq('is_active', true)
    .or('month.eq.' + month + ',month.is.null')

  const reminders = (defs || []).filter(t => {
    const eff = effectiveDeadlineDate(year, month, t.deadline_day)
    return eff.getFullYear() === year && eff.getMonth() === month - 1 && eff.getDate() === today
  }).map(t => ({ id: t.id, name: t.name, report_type: t.report_type || 'monthly' }))

  return Response.json({ date: now.toISOString(), year, month, day: today, reminders })
}
