import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Ghi chú nội bộ trên 1 dịch vụ của hồ sơ HCNS (nhân viên ↔ trưởng phòng ↔ quản lý) kèm dấu
// "đã đọc" của từng người — để người nhận việc sau không bỏ sót dặn dò của người trước.
// Bảng ở sql/10_hcns_case_notes.sql. Chưa chạy file đó (hoặc bản clone) thì trả rỗng kèm
// notInstalled, KHÔNG trả lỗi — phần còn lại của trang vẫn chạy bình thường.

// GET ?caseServiceIds=id1,id2                  -> ghi chú theo dịch vụ (hồ sơ Thời điểm)
//     ?hcnsClientId=..&year=..&month=..         -> ghi chú của công ty Thời kỳ trong tháng đó
//     ?hcnsClientId=..&all=1                    -> tất cả các tháng của công ty đó
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('caseServiceIds') || '').split(',').map(s => s.trim()).filter(Boolean)
  const hcnsClientId = searchParams.get('hcnsClientId')
  const all = searchParams.get('all') === '1'
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!ids.length && !hcnsClientId) return Response.json({ data: {} })

  const supabase = getAdmin()
  let q = supabase.from('hcns_case_notes').select('*').order('created_at', { ascending: false })
  if (hcnsClientId) {
    q = q.eq('hcns_client_id', hcnsClientId)
    if (!all && year && month) q = q.eq('year', year).eq('month', month)
  } else {
    q = q.in('case_service_id', ids)
  }
  const { data: notes, error } = await q
  // Chưa chạy sql/21 (thiếu cột hcns_client_id) cũng rơi vào đây -> trả rỗng, trang vẫn chạy.
  if (error) return Response.json({ data: {}, notInstalled: true })

  const noteIds = (notes || []).map(n => n.id)
  const [{ data: reads }, { data: staff }] = await Promise.all([
    noteIds.length
      ? supabase.from('hcns_case_note_reads').select('note_id, staff_id, read_at').in('note_id', noteIds)
      : Promise.resolve({ data: [] }),
    supabase.from('staff').select('id, full_name'),
  ])
  const nameOf = (id) => (staff || []).find(s => s.id === id)?.full_name || null

  const me = auth.caller?.staffId || null
  // Chỉ quản trị mới xoá được ghi chú -> giao diện dựa vào cờ này để ẩn/hiện nút Xoá.
  const callerRoles = auth.caller?.roles?.length ? auth.caller.roles : [auth.caller?.role]
  const canDelete = callerRoles.includes('admin')
  const byService = {}
  for (const n of notes || []) {
    const rs = (reads || []).filter(r => r.note_id === n.id)
    // Ghi chú công ty Thời kỳ gom theo id công ty; ghi chú hồ sơ gom theo id dịch vụ.
    ;(byService[n.case_service_id || n.hcns_client_id] ||= []).push({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      year: n.year || null, month: n.month || null,
      createdByName: nameOf(n.created_by),
      // Người viết mặc định là đã đọc — không bắt họ tự xác nhận lời nhắn của chính mình.
      readByMe: n.created_by === me || rs.some(r => r.staff_id === me),
      isMine: n.created_by === me,
      readers: rs.map(r => ({ name: nameOf(r.staff_id), read_at: r.read_at }))
        .sort((a, b) => new Date(a.read_at) - new Date(b.read_at)),
    })
  }
  return Response.json({ data: byService, canDelete })
}

// POST — viết 1 lời nhắn, hoặc xác nhận đã đọc.
// Body: { caseServiceId, content }   -> thêm lời nhắn
//       { noteId, read: true }       -> xác nhận đã đọc
export async function POST(request) {
  // Xác nhận đã đọc chỉ cần quyền xem — trưởng phòng/quản lý chỉ có view_hcns vẫn phải tick được.
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const supabase = getAdmin()
  const me = auth.caller?.staffId || null

  if (body.read) {
    if (!body.noteId) return Response.json({ error: 'Thiếu noteId' }, { status: 400 })
    if (!me) return Response.json({ error: 'Không xác định được người dùng' }, { status: 400 })
    // upsert theo unique (note_id, staff_id): bấm lại nhiều lần vẫn chỉ 1 dòng, giữ mốc đọc đầu tiên.
    const { error } = await supabase.from('hcns_case_note_reads')
      .upsert({ note_id: body.noteId, staff_id: me }, { onConflict: 'note_id,staff_id', ignoreDuplicates: true })
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  }

  const content = (body.content || '').trim()
  if (!body.caseServiceId && !body.hcnsClientId) return Response.json({ error: 'Thiếu dịch vụ hoặc công ty' }, { status: 400 })
  if (!content) return Response.json({ error: 'Nội dung ghi chú đang trống' }, { status: 400 })

  // Viết ghi chú cần quyền thao tác; xác nhận đã đọc thì chỉ cần quyền xem (đã xử lý ở trên).
  const canWrite = await callerHasPermission('manage_hcns')
  if (!canWrite.ok) return Response.json({ error: 'Không đủ quyền ghi chú' }, { status: 403 })

  const { data, error } = await supabase.from('hcns_case_notes').insert(
    body.caseServiceId
      ? { case_service_id: body.caseServiceId, content, created_by: me }
      : {
        hcns_client_id: body.hcnsClientId, content, created_by: me,
        year: Number(body.year) || null, month: Number(body.month) || null,
      }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// DELETE ?id=... — CHỈ quản trị. Ghi chú là dấu vết dặn dò giữa nhân viên và quản lý: người viết
// tự xoá được thì mất bằng chứng đã dặn, nên khoá lại (đổi 2026-09-23).
export async function DELETE(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const roles = auth.caller?.roles?.length ? auth.caller.roles : [auth.caller?.role]
  if (!roles.includes('admin')) {
    return Response.json({ error: 'Chỉ tài khoản Quản trị được xoá ghi chú' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: note } = await supabase.from('hcns_case_notes').select('created_by').eq('id', id).single()
  if (!note) return Response.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })

  const { error } = await supabase.from('hcns_case_notes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
