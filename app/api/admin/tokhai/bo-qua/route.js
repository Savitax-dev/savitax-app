// Phân hệ Tờ khai — "BỎ QUA" một ô tờ khai cho trường hợp đặc biệt (anh yêu cầu 03/11/2026, sql/49). CHỈ quản trị.
//
// POST { id, boQua: true,  lyDo }  → nghĩa vụ chuyển 'skipped' + lý do / người / lúc (không tính quá hạn, không nhắc hạn)
// POST { id, boQua: false }        → hủy bỏ qua: trả về 'not_filed', rồi tính lại theo hồ sơ thật đã gắn (nếu có)
// Hồ sơ thật lấy từ cổng về sau vẫn THẮNG: màn hình hiện theo hồ sơ, tinhLaiTrangThaiNghiaVu ghi đè 'skipped'.
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/serverAuth'
import { tinhLaiTrangThaiNghiaVu } from '@/lib/tokhaiTrangThai'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
const loi = (error, status = 400) => Response.json({ error }, { status })

export async function POST(request) {
  const auth = await requireAdmin()
  if (!auth.ok) return loi(auth.error, auth.status)
  let body
  try { body = await request.json() } catch { return loi('Thân yêu cầu không hợp lệ') }
  const id = String(body?.id || '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return loi('Ô tờ khai này chưa có trong lịch hạn nộp — không bỏ qua được')
  const supabase = getAdmin()

  const { data: o, error: e0 } = await supabase.from('tax_obligations').select('id, state, skip_reason').eq('id', id).maybeSingle()
  if (e0) return loi(/skip_reason/.test(e0.message) ? 'Chưa chạy sql/49_tokhai_bo_qua.sql' : e0.message, 500)
  if (!o) return loi('Không tìm thấy nghĩa vụ', 404)
  const nay = new Date().toISOString()

  if (body.boQua) {
    const lyDo = String(body.lyDo || '').trim()
    if (lyDo.length < 5) return loi('Ghi lý do bỏ qua (ít nhất 5 ký tự) — vd: khách tự nộp, không thuộc diện phải nộp kỳ này')
    if (['accepted', 'received'].includes(o.state)) return loi('Tờ khai này đã có hồ sơ nộp trên cổng — không cần bỏ qua')
    const { error } = await supabase.from('tax_obligations').update({
      state: 'skipped', skip_reason: lyDo.slice(0, 300), skipped_by: auth.caller.staffId, skipped_at: nay, state_changed_at: nay,
    }).eq('id', id)
    if (error) return loi(/check constraint/i.test(error.message) ? 'Chưa chạy sql/49_tokhai_bo_qua.sql' : error.message, 500)
    return Response.json({ ok: true })
  }

  if (o.state !== 'skipped') return loi('Ô này không ở trạng thái bỏ qua', 409)
  const { error } = await supabase.from('tax_obligations').update({
    state: 'not_filed', skip_reason: null, skipped_by: null, skipped_at: null, state_changed_at: nay,
  }).eq('id', id)
  if (error) return loi(error.message, 500)
  // Có hồ sơ thật đã gắn (vd bị từ chối) thì lấy lại trạng thái theo hồ sơ
  try { await tinhLaiTrangThaiNghiaVu(supabase, [id]) } catch { /* không chặn việc hủy bỏ qua */ }
  return Response.json({ ok: true })
}
