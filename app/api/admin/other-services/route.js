import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canWriteAccountingDebt } from '@/lib/debtScope'
import { phongCuaMotCongTy } from '@/lib/clientRoom'

// Hồ sơ "Dịch vụ khác" của một công ty (sql/24_dich_vu_khac.sql).
//
// Trước đây phí thu khác chỉ là một dòng service_fees type='khach' mỗi tháng: chỉ có số đã thu,
// không biết phải thu bao nhiêu, và 2 dịch vụ cùng tháng bị cộng dồn. Nay mỗi dịch vụ là một hồ
// sơ: phải thu — các lần thu — còn lại tự chuyển kỳ sau — thu đủ thì đóng.
//
// GET  ?clientId=...                                  -> danh sách hồ sơ + các lần thu
// POST { action:'open',  clientId, name, amount, year, month, note }
// POST { action:'pay',   id, amount, year, month, note }
// POST { action:'close', id, reason? }    -> thu đủ: ai ghi được công nợ cũng đóng được.
//                                            CHƯA thu đủ: chỉ Trưởng phòng của phòng đó / Quản trị.
// POST { action:'reopen', id }            -> mở lại hồ sơ đã đóng (cùng quyền với đóng sớm)
// POST { action:'delete', id }            -> chỉ xoá được hồ sơ CHƯA có lần thu nào
// POST { action:'delPay', id }            -> xoá một lần thu ghi nhầm

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const num = (v) => Math.round(Number(v) || 0)

// Đóng hồ sơ khi CHƯA thu đủ = xoá một khoản phải thu -> chỉ Trưởng phòng của phòng công ty đó
// hoặc Quản trị (người dùng chốt 05/10/2026, phương án B).
async function canCloseEarly(supabase, caller, client) {
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  if (roles.includes('admin')) return true
  if (!roles.includes('leader') && !roles.includes('manager')) return false
  const phong = await phongCuaMotCongTy(supabase, client)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  return !!phong && rooms.includes(phong)
}

async function loadServices(supabase, clientId) {
  const [{ data: svc }, { data: pays }] = await Promise.all([
    supabase.from('other_services').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('other_service_payments').select('*').eq('client_id', clientId).order('created_at'),
  ])
  const byId = new Map()
  for (const p of pays || []) {
    if (!byId.has(p.service_id)) byId.set(p.service_id, [])
    byId.get(p.service_id).push(p)
  }
  const staffIds = [...new Set([...(svc || []).flatMap(s => [s.created_by, s.closed_by]), ...(pays || []).map(p => p.created_by)].filter(Boolean))]
  const names = new Map()
  if (staffIds.length) {
    const { data } = await supabase.from('staff').select('id, full_name').in('id', staffIds)
    for (const s of data || []) names.set(s.id, s.full_name)
  }
  return (svc || []).map(s => {
    const list = (byId.get(s.id) || []).map(p => ({ ...p, by: names.get(p.created_by) || '—' }))
    const paid = list.reduce((a, p) => a + Number(p.amount || 0), 0)
    return {
      ...s,
      amount: Number(s.amount) || 0,
      paid,
      remain: Math.max(0, (Number(s.amount) || 0) - paid),
      payments: list,
      created_by_name: names.get(s.created_by) || '—',
      closed_by_name: s.closed_by ? (names.get(s.closed_by) || '—') : null,
    }
  })
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Thiếu công ty' }, { status: 400 })

  const supabase = getAdmin()
  try {
    return Response.json({ data: await loadServices(supabase, clientId) })
  } catch (e) {
    // Chưa chạy sql/24 -> trả rỗng, giao diện vẫn mở được như cũ.
    return Response.json({ data: [], missing: true, error: e?.message })
  }
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const staffId = auth.caller.staffId
  const supabase = getAdmin()

  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 }) }
  const { action } = body || {}

  // Lấy hồ sơ trước (trừ 'open' thì lấy theo clientId truyền lên) để biết công ty nào -> kiểm quyền.
  let svc = null, clientId = body.clientId || null
  if (action !== 'open') {
    const table = action === 'delPay' ? 'other_service_payments' : 'other_services'
    const { data } = await supabase.from(table).select('*').eq('id', body.id).maybeSingle()
    if (!data) return Response.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 })
    clientId = data.client_id
    svc = action === 'delPay' ? null : data
  }
  if (!clientId) return Response.json({ error: 'Thiếu công ty' }, { status: 400 })

  const { data: client } = await supabase.from('clients').select('id, name, assigned_to, room_id').eq('id', clientId).maybeSingle()
  if (!client) return Response.json({ error: 'Không tìm thấy công ty' }, { status: 404 })
  if (!await canWriteAccountingDebt(supabase, auth.caller, clientId)) {
    return Response.json({ error: 'Không đủ quyền thao tác dịch vụ khác của công ty này' }, { status: 403 })
  }

  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 3600 * 1000)

  if (action === 'open') {
    const name = String(body.name || '').trim()
    const amount = num(body.amount)
    if (!name) return Response.json({ error: 'Chưa nhập nội dung dịch vụ' }, { status: 400 })
    if (amount <= 0) return Response.json({ error: 'Số tiền phải thu phải lớn hơn 0' }, { status: 400 })
    const year = Number(body.year) || vn.getUTCFullYear()
    const month = Number(body.month) || vn.getUTCMonth() + 1
    const { data, error } = await supabase.from('other_services').insert({
      client_id: clientId, name, amount, year, month, note: body.note || null, created_by: staffId,
    }).select('id').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, id: data.id })
  }

  if (action === 'pay') {
    const amount = num(body.amount)
    if (amount <= 0) return Response.json({ error: 'Số tiền thu phải lớn hơn 0' }, { status: 400 })
    if (svc.status === 'done') return Response.json({ error: 'Hồ sơ đã đóng — mở lại trước khi ghi thu' }, { status: 400 })
    const { data: pays } = await supabase.from('other_service_payments').select('amount').eq('service_id', svc.id)
    const daThu = (pays || []).reduce((a, p) => a + Number(p.amount || 0), 0)
    const conLai = Math.max(0, Number(svc.amount) - daThu)
    if (amount > conLai) {
      return Response.json({
        error: 'Số tiền thu (' + amount.toLocaleString('vi-VN') + 'đ) lớn hơn phần còn lại của hồ sơ ('
          + conLai.toLocaleString('vi-VN') + 'đ). Sửa lại số tiền, hoặc sửa số phải thu của hồ sơ.',
      }, { status: 400 })
    }
    const { error } = await supabase.from('other_service_payments').insert({
      service_id: svc.id, client_id: clientId, amount,
      year: Number(body.year) || vn.getUTCFullYear(),
      month: Number(body.month) || vn.getUTCMonth() + 1,
      note: body.note || null, created_by: staffId,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    // Thu đủ thì tự đóng luôn — khỏi bắt bấm thêm một nút nữa.
    const tuDong = amount === conLai
    if (tuDong) {
      await supabase.from('other_services')
        .update({ status: 'done', closed_at: new Date().toISOString(), closed_by: staffId })
        .eq('id', svc.id)
    }
    return Response.json({ ok: true, closed: tuDong })
  }

  if (action === 'close' || action === 'reopen') {
    if (action === 'reopen') {
      if (!await canCloseEarly(supabase, auth.caller, client)) {
        return Response.json({ error: 'Chỉ Trưởng phòng hoặc Quản trị mở lại được hồ sơ đã đóng' }, { status: 403 })
      }
      const { error } = await supabase.from('other_services')
        .update({ status: 'open', closed_at: null, closed_by: null, close_reason: null }).eq('id', svc.id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }
    const { data: pays } = await supabase.from('other_service_payments').select('amount').eq('service_id', svc.id)
    const daThu = (pays || []).reduce((a, p) => a + Number(p.amount || 0), 0)
    const conLai = Math.max(0, Number(svc.amount) - daThu)
    if (conLai > 0) {
      if (!await canCloseEarly(supabase, auth.caller, client)) {
        return Response.json({
          error: 'Hồ sơ còn thiếu ' + conLai.toLocaleString('vi-VN') + 'đ. Đóng khi chưa thu đủ là xoá một khoản phải thu '
            + '— chỉ Trưởng phòng hoặc Quản trị làm được.',
        }, { status: 403 })
      }
      if (!String(body.reason || '').trim()) {
        return Response.json({ error: 'Nhập lý do đóng khi hồ sơ còn thiếu tiền' }, { status: 400 })
      }
    }
    const { error } = await supabase.from('other_services').update({
      status: 'done', closed_at: new Date().toISOString(), closed_by: staffId,
      close_reason: conLai > 0 ? String(body.reason).trim() : null,
    }).eq('id', svc.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'delete') {
    const { data: pays } = await supabase.from('other_service_payments').select('id').eq('service_id', svc.id).limit(1)
    if (pays?.length) return Response.json({ error: 'Hồ sơ đã có khoản thu — xoá từng khoản thu trước, hoặc đóng hồ sơ' }, { status: 400 })
    const { error } = await supabase.from('other_services').delete().eq('id', svc.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'delPay') {
    const { error } = await supabase.from('other_service_payments').delete().eq('id', body.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Thao tác không hợp lệ' }, { status: 400 })
}
