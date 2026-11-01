// POST /api/admin/clients/dac-thu — đặt "công ty đặc thù về công nợ" (anh chốt 01/11/2026, sql/45, lib/ctyDacThu.js)
//   body: { id, khong_vat?: boolean, gia_han_thu_thang?: 0..12, ly_do?: string }
//   - khong_vat: thu phí KHÔNG VAT → lương / hoa hồng / thưởng DVK không chia 1,08; phiếu ĐNTT không có dòng VAT
//   - gia_han_thu_thang: admin cho khách trả chậm N tháng (phí kế toán) → lùi hạn sửa công nợ + hạn chuyển nợ tồn,
//     kỳ đang gia hạn mà chưa thu đủ tạm không tính %-công nợ. Bật (N > 0) bắt buộc lý do.
// Quyền `cong_no_dac_thu` (sql/45 — gán sẵn Nhân viên NB, anh chốt 01/11/2026; Quản trị luôn có) — đây là chỗ đổi
// thẳng số lương và %-KPI nên KHÔNG gán cho nhân viên / trưởng phòng. Mọi lần đổi ghi client_change_log.
import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

const loi = (error, status = 400) => Response.json({ error }, { status })

export async function POST(request) {
  const auth = await callerHasPermission('cong_no_dac_thu')
  if (!auth.ok) return loi(auth.error, auth.status)
  let body
  try { body = await request.json() } catch { return loi('Thân yêu cầu không hợp lệ') }
  const id = body?.id
  if (!id) return loi('Thiếu công ty')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: cu, error: e0 } = await supabase.from('clients')
    .select('id, name, khong_vat, gia_han_thu_thang, gia_han_thu_ly_do').eq('id', id).maybeSingle()
  if (e0) return loi(/khong_vat|gia_han/.test(e0.message) ? 'Chưa chạy sql/45_cty_khong_vat_gia_han_thu.sql' : e0.message, 500)
  if (!cu) return loi('Không tìm thấy công ty', 404)

  const moi = {}
  if (body.khong_vat !== undefined) moi.khong_vat = body.khong_vat === true
  if (body.gia_han_thu_thang !== undefined) {
    const g = Number(body.gia_han_thu_thang)
    if (!Number.isInteger(g) || g < 0 || g > 12) return loi('Số tháng gia hạn phải từ 0 đến 12')
    moi.gia_han_thu_thang = g
    const lyDo = String(body.ly_do ?? '').trim()
    if (g > 0 && lyDo.length < 5) return loi('Ghi lý do cho phép thu chậm (ít nhất 5 ký tự)')
    moi.gia_han_thu_ly_do = g > 0 ? lyDo.slice(0, 300) : null
  }
  if (!Object.keys(moi).length) return loi('Không có gì để đổi')

  const { error } = await supabase.from('clients').update(moi).eq('id', id)
  if (error) return loi(error.message, 500)

  // Nhật ký: chỉ ghi trường thật sự đổi
  const NHAN = { khong_vat: 'Thu phí không VAT (không xuất hóa đơn)', gia_han_thu_thang: 'Gia hạn thu công nợ (tháng)' }
  const hienThi = (k, v) => k === 'khong_vat' ? (v ? 'Có' : 'Không') : String(v ?? 0) + ' tháng'
  const dong = Object.keys(NHAN).filter(k => moi[k] !== undefined && moi[k] !== (k === 'khong_vat' ? cu.khong_vat === true : Number(cu.gia_han_thu_thang) || 0))
    .map(k => ({
      client_id: id, entity: 'client_info', entity_label: NHAN[k], field: k, action: 'update',
      old_value: hienThi(k, k === 'khong_vat' ? cu.khong_vat === true : Number(cu.gia_han_thu_thang) || 0),
      new_value: hienThi(k, moi[k]) + (k === 'gia_han_thu_thang' && moi.gia_han_thu_ly_do ? ' — ' + moi.gia_han_thu_ly_do : ''),
      changed_by: auth.caller.staffId,
    }))
  if (dong.length) {
    const { error: el } = await supabase.from('client_change_log').insert(dong)
    if (el) console.error('dac-thu: không ghi được nhật ký', el.message)
  }
  return Response.json({ ok: true, ...moi })
}
