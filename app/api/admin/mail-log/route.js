import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { roomsWithRole } from '@/lib/roleUnion'

// GET /api/admin/mail-log?nam=2026&thang=10&loc=all|khop|chua
//
// Nhật ký mail "bộ báo cáo thuế": mỗi lá mail VPS đọc được là một dòng, kèm kết quả đối chiếu.
//
// Dòng "chưa khớp" mới là phần quan trọng nhất của trang này — đó là mail đã gửi khách mà app
// không tự tick được. Không có chỗ xem thì mỗi tháng lại phải đi lục hộp thư bằng tay, và sẽ không
// ai biết tính năng này đang bỏ sót bao nhiêu.
//
// PHẠM VI: quản trị và trưởng phòng xem tất cả; nhân viên chỉ xem mail CỦA MÌNH — mail mình gửi
// (theo email) hoặc mail khớp vào công ty mình phụ trách. Tiêu đề thư có tên khách hàng, không nên
// để người ngoài phạm vi đọc hết.

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(request) {
  const authCheck = await requireLogin()
  if (!authCheck.ok) return Response.json({ error: authCheck.error }, { status: authCheck.status })
  const caller = authCheck.caller

  const { searchParams } = new URL(request.url)
  const nam = Number(searchParams.get('nam')) || new Date().getFullYear()
  const thang = Number(searchParams.get('thang')) || (new Date().getMonth() + 1)
  const loc = searchParams.get('loc') || 'all'

  const supabase = getAdmin()

  // Lọc theo GIỜ GỬI chứ không theo giờ ghi nhận: mail gửi cuối tháng 9 mà VPS đọc được đầu tháng
  // 10 vẫn thuộc về tháng 9 dưới góc nhìn người dùng.
  const dau = new Date(Date.UTC(nam, thang - 1, 1)).toISOString()
  const cuoi = new Date(Date.UTC(thang === 12 ? nam + 1 : nam, thang === 12 ? 0 : thang, 1)).toISOString()

  let q = supabase.from('mail_evidence')
    .select('id, message_id, subject, from_email, sent_at, client_id, task_def_id, year, month, matched, reason, ticked')
    .gte('sent_at', dau).lt('sent_at', cuoi)
    .order('sent_at', { ascending: false })
  if (loc === 'khop') q = q.eq('matched', true)
  if (loc === 'chua') q = q.eq('matched', false)

  const { data: rows, error } = await q
  // Chưa chạy sql/30 -> trả danh sách rỗng kèm cờ, giao diện tự nói "chưa cài", không vỡ trang.
  if (error) return Response.json({ data: [], chuaCaiDat: true, loi: error.message })

  const clientIds = [...new Set((rows || []).map(r => r.client_id).filter(Boolean))]
  const taskIds = [...new Set((rows || []).map(r => r.task_def_id).filter(Boolean))]

  const [{ data: clients }, { data: tasks }, { data: me }] = await Promise.all([
    clientIds.length
      ? supabase.from('clients').select('id, name, client_code, assigned_to').in('id', clientIds)
      : { data: [] },
    taskIds.length
      ? supabase.from('task_definitions').select('id, name').in('id', taskIds)
      : { data: [] },
    supabase.from('staff').select('id, email').eq('id', caller.staffId).maybeSingle(),
  ])
  const tenCty = new Map((clients || []).map(c => [c.id, c]))
  const tenViec = new Map((tasks || []).map(t => [t.id, t.name]))

  // Nhân viên thường: lọc còn mail của mình.
  const laQuanLy = caller.role === 'admin' || roomsWithRole(caller, ['leader', 'manager']).length > 0
  let ds = rows || []
  if (!laQuanLy) {
    const emailToi = String(me?.email || '').trim().toLowerCase()
    ds = ds.filter(r =>
      (emailToi && r.from_email === emailToi) ||
      (r.client_id && tenCty.get(r.client_id)?.assigned_to === caller.staffId))
  }

  return Response.json({
    data: ds.map(r => ({
      id: r.id,
      subject: r.subject,
      fromEmail: r.from_email,
      sentAt: r.sent_at,
      matched: r.matched,
      ticked: r.ticked,
      reason: r.reason,
      clientName: r.client_id ? (tenCty.get(r.client_id)?.name || null) : null,
      clientCode: r.client_id ? (tenCty.get(r.client_id)?.client_code || null) : null,
      taskName: r.task_def_id ? (tenViec.get(r.task_def_id) || null) : null,
      ky: r.year && r.month ? ('T' + r.month + '/' + r.year) : null,
    })),
    tong: {
      tatCa: ds.length,
      khop: ds.filter(r => r.matched).length,
      tick: ds.filter(r => r.ticked).length,
      chua: ds.filter(r => !r.matched).length,
    },
    laQuanLy,
  })
}
