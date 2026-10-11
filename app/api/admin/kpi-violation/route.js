import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { isSharedRoom } from '@/lib/specialRooms'

// Đánh dấu / gỡ VI PHẠM cho một nhân viên ở một tháng (xem lib/viPham.js).
//   POST   { staffId, year, month, reason }  -> đánh dấu (đã có thì cập nhật lý do)
//   DELETE { staffId, year, month }          -> gỡ
// Ai được làm: Quản trị, hoặc Trưởng phòng / Quản lý của CHÍNH phòng nhân viên đó. Không ai tự đánh
// dấu hay tự gỡ cho chính mình (trừ Quản trị).

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function kiemQuyen(supabase, caller, staffId) {
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const { data: nv } = await supabase.from('staff').select('id, full_name, room_id').eq('id', staffId).maybeSingle()
  if (!nv) return { ok: false, status: 404, error: 'Không tìm thấy nhân viên' }
  if (roles.includes('admin')) return { ok: true, nv }
  if (!roles.includes('leader') && !roles.includes('manager')) return { ok: false, status: 403, error: 'Chỉ Trưởng phòng hoặc Quản trị được đánh dấu vi phạm' }
  if (staffId === caller.staffId) return { ok: false, status: 403, error: 'Không tự đánh dấu / gỡ vi phạm cho chính mình' }
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  if (nv.room_id && (rooms.includes(nv.room_id) || (roles.includes('leader') && isSharedRoom(nv.room_id)))) return { ok: true, nv }
  return { ok: false, status: 403, error: 'Nhân viên này không thuộc phòng của bạn' }
}

async function xuLy(request, xoa) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 }) }
  const staffId = body?.staffId, year = Number(body?.year), month = Number(body?.month)
  if (!staffId || !year || !(month >= 1 && month <= 12)) return Response.json({ error: 'Thiếu nhân viên / tháng' }, { status: 400 })
  const supabase = getAdmin()
  const q = await kiemQuyen(supabase, auth.caller, staffId)
  if (!q.ok) return Response.json({ error: q.error }, { status: q.status })

  if (xoa) {
    const { error } = await supabase.from('kpi_violations').delete().eq('staff_id', staffId).eq('year', year).eq('month', month)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }
  const reason = String(body?.reason || '').trim()
  if (reason.length < 5) return Response.json({ error: 'Phải ghi rõ vi phạm gì (ít nhất 5 ký tự)' }, { status: 400 })
  const { error } = await supabase.from('kpi_violations').upsert({
    staff_id: staffId, year, month, reason, created_by: auth.caller.staffId, created_at: new Date().toISOString(),
  }, { onConflict: 'staff_id,year,month' })
  if (error) return Response.json({ error: 'Chưa ghi được (đã chạy sql/26 chưa?): ' + error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function POST(request) { return xuLy(request, false) }
export async function DELETE(request) { return xuLy(request, true) }
