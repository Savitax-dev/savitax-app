import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST /api/admin/hcns/task-toggle
// Tích / bỏ tích một công việc HCNS. Hai loại checklist dùng chung route này:
//   kind='case'      -> công việc của 1 dịch vụ trong hồ sơ Thời điểm/Vãng lai
//                       Body: { kind, taskId, done, staffId }
//   kind='recurring' -> công việc định kỳ hàng tháng của khách Thời kỳ
//                       Body: { kind, hcnsClientId, templateTaskId, year, month, done, staffId }
export async function POST(request) {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { kind, done, staffId } = body
    const supabase = getAdmin()
    const who = staffId || auth.caller?.staffId || null
    const stamp = done ? { done: true, done_by: who, done_at: new Date().toISOString() }
      : { done: false, done_by: null, done_at: null }

    if (kind === 'case') {
      if (!body.taskId) return Response.json({ error: 'Thiếu taskId' }, { status: 400 })
      const { error } = await supabase.from('hcns_case_service_tasks').update(stamp).eq('id', body.taskId)
      if (error) return Response.json({ error: error.message }, { status: 400 })
      return Response.json({ ok: true })
    }

    if (kind === 'recurring') {
      const { hcnsClientId, templateTaskId, year, month } = body
      if (!hcnsClientId || !templateTaskId || !year || !month) {
        return Response.json({ error: 'Thiếu thông tin công việc định kỳ' }, { status: 400 })
      }
      // Việc "Cập nhật số lượng nhân sự" (requires_headcount) KHÔNG tick suông được: phải kèm số
      // người (headcount) hoặc unchanged=true (giữ số gần nhất trước đó). Bỏ tích -> xoá số tháng đó.
      // select('*') để bản chưa chạy sql/19 (thiếu cột) vẫn tick bình thường như cũ.
      const { data: tt } = await supabase.from('hcns_service_template_tasks').select('*').eq('id', templateTaskId).maybeSingle()
      if (tt?.requires_headcount) {
        const y = Number(year), m = Number(month)
        if (done) {
          let count = null, unchanged = false
          if (body.unchanged === true) {
            const { data: prev } = await supabase.from('hcns_headcount').select('headcount, year, month')
              .eq('hcns_client_id', hcnsClientId)
              .or('year.lt.' + y + ',and(year.eq.' + y + ',month.lt.' + m + ')')
              .order('year', { ascending: false }).order('month', { ascending: false }).limit(1).maybeSingle()
            if (!prev) return Response.json({ error: 'Chưa có số nhân sự tháng trước — vui lòng nhập số người.' }, { status: 400 })
            count = prev.headcount; unchanged = true
          } else {
            const n = Number(body.headcount)
            if (body.headcount === undefined || body.headcount === null || body.headcount === '' || !Number.isInteger(n) || n < 0 || n > 100000) {
              return Response.json({ error: 'Việc này bắt buộc nhập số lượng nhân sự (hoặc chọn "Không thay đổi").' }, { status: 400 })
            }
            count = n
          }
          const { error: he } = await supabase.from('hcns_headcount').upsert({
            hcns_client_id: hcnsClientId, year: y, month: m, headcount: count, unchanged,
            entered_by: who, entered_at: new Date().toISOString(),
          }, { onConflict: 'hcns_client_id,year,month' })
          if (he) return Response.json({ error: he.message }, { status: 400 })
        } else {
          await supabase.from('hcns_headcount').delete().eq('hcns_client_id', hcnsClientId).eq('year', y).eq('month', m)
        }
      }

      // Dòng chỉ được tạo khi tích lần đầu (giống task_records bên kế toán) — không pre-insert
      // sẵn cho mọi công ty × mọi tháng, vừa tốn vừa khó dọn khi mẫu đổi.
      const { error } = await supabase.from('hcns_recurring_tasks').upsert({
        hcns_client_id: hcnsClientId,
        template_task_id: templateTaskId,
        year: Number(year), month: Number(month),
        ...stamp,
      }, { onConflict: 'hcns_client_id,template_task_id,year,month' })
      if (error) return Response.json({ error: error.message }, { status: 400 })
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'kind phải là "case" hoặc "recurring"' }, { status: 400 })
  } catch (e) {
    console.error('hcns/task-toggle exception:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
