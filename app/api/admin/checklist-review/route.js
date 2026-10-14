import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canReviewChecklist } from '@/lib/checklistScope'

// Dấu "TP đã kiểm tra" của một (công ty, năm, tháng) — anh chốt 14/10/2026.
//
// GET  ?clientId=&year=&month=  → dấu hiện tại (hoặc null), kèm cờ `changed`.
// POST { clientId, year, month, reviewed } → reviewed=true đóng dấu, false gỡ dấu.
//
// Dấu này KHÔNG đụng vào task_records: không tick, không bỏ tick, không ảnh hưởng KPI. Nó chỉ ghi
// "ai đã soát, lúc nào, lúc đó xong mấy việc".
//
// AI ĐƯỢC BẤM: chỉ trưởng phòng của đúng phòng chứa công ty, cộng quản trị — xem
// lib/checklistScope.js. Chặn ở đây là lớp THẬT, giao diện chỉ làm mờ nút.

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Số việc ĐANG xong của kỳ này. Đếm thẳng dòng task_records có is_done = true — KHÔNG lọc theo
// danh mục việc áp dụng cho công ty. Lý do: hàm này phải ra cùng một con số ở cả lúc đóng dấu lẫn
// lúc đọc lại, nếu không thì dấu vừa đóng xong đã tự báo "đã đổi". Danh mục việc áp dụng thì đổi
// theo loại báo cáo của công ty, còn dòng task_records thì không.
async function demViecXong(supabase, clientId, year, month) {
  const { data } = await supabase.from('task_records').select('id')
    .eq('client_id', clientId).eq('year', year).eq('month', month).eq('is_done', true)
  return (data || []).length
}

async function docDau(supabase, clientId, year, month) {
  const { data: row } = await supabase.from('checklist_reviews')
    .select('reviewed_by, reviewed_at, done_count')
    .eq('client_id', clientId).eq('year', year).eq('month', month).maybeSingle()
  if (!row) return null

  let tenNguoiKiem = null
  if (row.reviewed_by) {
    const { data: st } = await supabase.from('staff').select('name').eq('id', row.reviewed_by).maybeSingle()
    tenNguoiKiem = st?.name || null
  }
  const hienTai = await demViecXong(supabase, clientId, year, month)
  return {
    reviewedBy:   row.reviewed_by,
    reviewedName: tenNguoiKiem,
    reviewedAt:   row.reviewed_at,
    doneCount:    row.done_count,
    currentCount: hienTai,
    // Checklist đã động đậy sau khi trưởng phòng soát — dấu vẫn còn nhưng không còn nói đúng
    // những gì người đó đã nhìn thấy.
    changed:      hienTai !== row.done_count,
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const year     = Number(searchParams.get('year'))
  const month    = Number(searchParams.get('month'))
  if (!clientId || !year || !month) return Response.json({ error: 'Missing params' }, { status: 400 })

  const authCheck = await requireLogin()
  if (!authCheck.ok) return Response.json({ error: authCheck.error }, { status: authCheck.status })

  const supabase = getAdmin()
  // Ai đăng nhập cũng ĐỌC được dấu — quản trị cần thấy, nhân viên thấy phòng mình đã được soát
  // chưa cũng không hại gì. Chỉ việc ĐÓNG dấu mới cần quyền.
  return Response.json({ data: await docDau(supabase, clientId, year, month) })
}

export async function POST(request) {
  const { clientId, year, month, reviewed } = await request.json()
  if (!clientId || !year || !month) return Response.json({ error: 'Missing params' }, { status: 400 })

  const authCheck = await requireLogin()
  if (!authCheck.ok) return Response.json({ error: authCheck.error }, { status: authCheck.status })

  const supabase = getAdmin()
  if (!(await canReviewChecklist(supabase, authCheck.caller, clientId))) {
    return Response.json(
      { error: 'Chỉ trưởng phòng của phòng này (hoặc quản trị) mới đóng dấu đã kiểm tra được' },
      { status: 403 })
  }

  if (!reviewed) {
    const { error } = await supabase.from('checklist_reviews').delete()
      .eq('client_id', clientId).eq('year', Number(year)).eq('month', Number(month))
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data: null })
  }

  // Đóng dấu LẠI thì ghi đè số việc xong mới — trưởng phòng soát lần hai sau khi nhân viên bổ
  // sung, cờ "đã đổi" phải tắt đi.
  const { error } = await supabase.from('checklist_reviews').upsert({
    client_id:   clientId,
    year:        Number(year),
    month:       Number(month),
    reviewed_by: authCheck.caller.staffId,
    reviewed_at: new Date().toISOString(),
    done_count:  await demViecXong(supabase, clientId, Number(year), Number(month)),
  }, { onConflict: 'client_id,year,month' })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ data: await docDau(supabase, clientId, Number(year), Number(month)) })
}
