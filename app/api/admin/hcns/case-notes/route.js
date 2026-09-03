import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Ghi chú nội bộ trên 1 dịch vụ của hồ sơ HCNS (nhân viên ↔ trưởng phòng ↔ quản lý) kèm dấu
// "đã đọc" của từng người — để người nhận việc sau không bỏ sót dặn dò của người trước.
// Bảng ở sql/10_hcns_case_notes.sql. Chưa chạy file đó (hoặc bản clone) thì trả rỗng kèm
// notInstalled, KHÔNG trả lỗi — phần còn lại của trang vẫn chạy bình thường.

// GET ?caseServiceIds=id1,id2 -> { data: { [caseServiceId]: [note...] }, notInstalled? }
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('caseServiceIds') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) return Response.json({ data: {} })

  const supabase = getAdmin()
  const { data: notes, error } = await supabase.from('hcns_case_notes')
    .select('*').in('case_service_id', ids).order('created_at', { ascending: false })
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
  const byService = {}
  for (const n of notes || []) {
    const rs = (reads || []).filter(r => r.note_id === n.id)
    ;(byService[n.case_service_id] ||= []).push({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      createdByName: nameOf(n.created_by),
      // Người viết mặc định là đã đọc — không bắt họ tự xác nhận lời nhắn của chính mình.
      readByMe: n.created_by === me || rs.some(r => r.staff_id === me),
      isMine: n.created_by === me,
      readers: rs.map(r => ({ name: nameOf(r.staff_id), read_at: r.read_at }))
        .sort((a, b) => new Date(a.read_at) - new Date(b.read_at)),
    })
  }
  return Response.json({ data: byService })
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
  if (!body.caseServiceId) return Response.json({ error: 'Thiếu dịch vụ' }, { status: 400 })
  if (!content) return Response.json({ error: 'Nội dung ghi chú đang trống' }, { status: 400 })

  const { data, error } = await supabase.from('hcns_case_notes').insert({
    case_service_id: body.caseServiceId, content, created_by: me,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// DELETE ?id=... — xoá lời nhắn ghi nhầm. Người viết tự xoá được; ngoài ra cần manage_hcns.
export async function DELETE(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Thiếu id' }, { status: 400 })

  const supabase = getAdmin()
  const { data: note } = await supabase.from('hcns_case_notes').select('created_by').eq('id', id).single()
  if (!note) return Response.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })

  if (note.created_by !== (auth.caller?.staffId || null)) {
    const can = await callerHasPermission('manage_hcns')
    if (!can.ok) return Response.json({ error: 'Chỉ người viết ghi chú mới xoá được.' }, { status: 403 })
  }

  const { error } = await supabase.from('hcns_case_notes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
