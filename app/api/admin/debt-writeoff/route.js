import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/serverAuth'
import { tinhDongTienPhong } from '@/lib/dongTienPhong'
import { countsForMonth } from '@/lib/contractDates'
import { feeCountsForMonth, resolveFeeForMonth } from '@/lib/feeDue'

// XOÁ NỢ không đòi được của công ty ĐÃ NGƯNG dịch vụ (anh chốt 05/10/2026) — chỉ Quản trị.
//
// POST { clientId, reason }            -> xoá toàn bộ phần phí kế toán còn phải thu của công ty
// POST { clientId, reason, dryRun:1 }  -> chỉ trả về số sẽ xoá, không ghi gì
//
// Không sửa thầm `clients.other_debt` rồi thôi: mỗi lần xoá để lại 1 dòng `debt_writeoffs`
// (sql/25) để báo cáo dòng tiền vẫn cộng trừ khớp và tra lại được ai xoá, bao nhiêu, vì sao.
// Số nợ gồm 2 phần, phải dọn CẢ HAI thì công nợ mới đồng bộ:
//   1. Nợ tồn đã chốt sổ (`clients.other_debt` + `debt_rollovers.remaining_amount`) -> về 0.
//   2. Phí các kỳ trước tháng ngưng chưa thu mà CHƯA kịp chốt sổ -> ghi luôn dòng chốt với
//      remaining_amount = 0. Không ghi thì sau ngày 10 `ensureRollovers` sẽ tự chốt và khoản vừa
//      xoá mọc lại trong "Nợ tồn cũ".

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
const num = (v) => Math.round(Number(v) || 0)

export async function POST(request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 }) }
  const clientId = body?.clientId
  const reason = String(body?.reason || '').trim()
  const dryRun = !!body?.dryRun
  if (!clientId) return Response.json({ error: 'Thiếu công ty' }, { status: 400 })
  if (!dryRun && reason.length < 5) return Response.json({ error: 'Phải ghi lý do xoá nợ (ít nhất 5 ký tự)' }, { status: 400 })

  const supabase = getAdmin()
  const { data: client } = await supabase.from('clients')
    .select('id, name, assigned_to, monthly_fee, other_debt, fee_period, status, contract_start, created_at')
    .eq('id', clientId).maybeSingle()
  if (!client) return Response.json({ error: 'Không tìm thấy công ty' }, { status: 404 })
  if (client.status !== 'inactive') {
    return Response.json({ error: 'Chỉ xoá nợ được cho công ty đã Ngưng dịch vụ' }, { status: 400 })
  }

  const vn = new Date(Date.now() + 7 * 3600 * 1000)
  const year = vn.getUTCFullYear(), month = vn.getUTCMonth() + 1
  const mocNay = year * 12 + month

  const [{ data: plans }, { data: logs }, { data: rollovers }, { data: thuKt }] = await Promise.all([
    supabase.from('service_fees').select('client_id, year, month, amount').eq('client_id', clientId).eq('type', 'fee_plan'),
    supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .eq('client_id', clientId).eq('entity', 'monthly_fee').eq('action', 'update'),
    supabase.from('debt_rollovers').select('id, year, month, rolled_amount, remaining_amount, source').eq('client_id', clientId),
    supabase.from('service_fees').select('year, month, amount').eq('client_id', clientId).eq('type', 'ketoan'),
  ])

  // Số phải xoá lấy từ CHÍNH hàm tính dòng tiền — xoá theo một con số tính riêng thì xoá xong thẻ
  // "còn phải thu" vẫn lệch vài đồng.
  const dt = await tinhDongTienPhong(supabase, {
    clients: [client], year, month, feePlanRows: plans || [], changeLogRows: logs || [], lichSuTu: mocNay - 4,
  })
  const conNo = num(dt.chuyenKySau.theoCty.find(x => x.clientId === clientId)?.ketoan)
  if (conNo <= 0) return Response.json({ error: 'Công ty này không còn nợ phí kế toán để xoá' }, { status: 400 })

  // Tách phần chưa chốt sổ theo từng kỳ.
  let mocNgung = null
  try {
    const { data: se, error } = await supabase.from('clients').select('service_end').eq('id', clientId).maybeSingle()
    if (!error && se?.service_end) {
      const [y, m] = String(se.service_end).slice(0, 10).split('-').map(Number)
      if (y && m) mocNgung = y * 12 + m
    }
  } catch (_) { /* chưa chạy sql/25 */ }
  if (mocNgung == null) {
    const { data: st } = await supabase.from('client_change_log').select('new_value, changed_at')
      .eq('client_id', clientId).eq('entity', 'client_info').eq('field', 'status').order('changed_at')
    for (const l of st || []) {
      if (!/ng[ưu]ng/i.test(String(l.new_value || ''))) continue
      const d = new Date(new Date(l.changed_at).getTime() + 7 * 3600 * 1000)
      mocNgung = d.getUTCFullYear() * 12 + d.getUTCMonth() + 1
    }
  }
  const daChot = new Set((rollovers || []).filter(r => (r.source || 'ketoan') !== 'hcns').map(r => r.year * 12 + r.month))
  const thuKy = new Map()
  for (const f of thuKt || []) thuKy.set(f.year * 12 + f.month, (thuKy.get(f.year * 12 + f.month) || 0) + num(f.amount))
  const kyChuaChot = []
  if (mocNgung != null) {
    // Cùng mốc bắt đầu với lib/dongTienPhong.js: kỳ chốt sổ sớm nhất của công ty, hoặc 4 kỳ gần nhất.
    const mocDau = Math.min(mocNay - 4, ...(daChot.size ? [...daChot] : [mocNay - 4]))
    for (let k = mocDau; k < Math.min(mocNgung, mocNay + 1); k++) {
      if (daChot.has(k)) continue
      const y = Math.floor((k - 1) / 12), m = k - y * 12
      if (!countsForMonth(client, y, m) || !feeCountsForMonth(client.fee_period, y, m)) continue
      const thieu = num(resolveFeeForMonth(plans || [], clientId, y, m, client.monthly_fee, logs || [])) - (thuKy.get(k) || 0)
      if (thieu > 0) kyChuaChot.push({ year: y, month: m, amount: thieu })
    }
  }
  // `other_debt` dồn cả nợ tồn HCNS đã chốt. Chức năng này chỉ xoá phí KẾ TOÁN, nên phần HCNS
  // phải ở lại — đưa cả other_debt về 0 là xoá lố sang khoản không được phép xoá.
  const hcnsConLai = (rollovers || []).filter(r => r.source === 'hcns').reduce((a, r) => a + num(r.remaining_amount), 0)
  const noTon = Math.max(0, num(client.other_debt) - hcnsConLai)
  const chuaChot = kyChuaChot.reduce((a, x) => a + x.amount, 0)
  // Hai cách tính phải ra cùng một số. Lệch nghĩa là sổ sách công ty này có chỗ không khớp —
  // dừng lại cho người xem, đừng xoá bừa.
  if (noTon + chuaChot !== conNo) {
    return Response.json({
      error: 'Số nợ của công ty này không khớp giữa hai cách tính (nợ tồn ' + noTon.toLocaleString('vi-VN')
        + 'đ + phí chưa chốt ' + chuaChot.toLocaleString('vi-VN') + 'đ ≠ còn phải thu ' + conNo.toLocaleString('vi-VN')
        + 'đ). Cần soát sổ công ty này trước khi xoá nợ.',
    }, { status: 409 })
  }

  const detail = { noTon, kyChuaChot, otherDebtTruoc: num(client.other_debt), hcnsGiuLai: hcnsConLai }
  if (dryRun) return Response.json({ ok: true, dryRun: true, amount: conNo, detail, name: client.name })

  // 1) ghi dòng xoá nợ TRƯỚC — bảng chưa có (chưa chạy sql/25) thì dừng, chưa đụng gì vào công nợ.
  const { data: wo, error: woErr } = await supabase.from('debt_writeoffs').insert({
    client_id: clientId, year, month, amount: conNo, reason, detail, created_by: auth.caller.staffId,
  }).select('id').single()
  if (woErr) {
    return Response.json({ error: 'Chưa ghi được dòng xoá nợ (đã chạy sql/25 chưa?): ' + woErr.message }, { status: 500 })
  }
  const hoanTac = async (msg) => {
    await supabase.from('debt_writeoffs').delete().eq('id', wo.id)
    return Response.json({ error: msg }, { status: 500 })
  }

  // 2) kỳ chưa chốt sổ: ghi dòng chốt với phần còn lại = 0
  if (kyChuaChot.length) {
    const { error } = await supabase.from('debt_rollovers').insert(kyChuaChot.map(x => ({
      client_id: clientId, year: x.year, month: x.month, rolled_amount: x.amount, remaining_amount: 0, source: 'ketoan',
    })))
    if (error) return hoanTac('Chưa ghi được dòng chốt sổ: ' + error.message)
  }
  // 3) nợ tồn đã chốt về 0
  // Lọc theo id chứ không dùng .neq('source','hcns'): PostgREST bỏ luôn dòng có source NULL khi
  // so sánh khác, mà dòng cũ có thể chưa có source.
  const idKeToan = (rollovers || []).filter(r => (r.source || 'ketoan') !== 'hcns' && num(r.remaining_amount) > 0).map(r => r.id)
  const { error: e1 } = idKeToan.length
    ? await supabase.from('debt_rollovers').update({ remaining_amount: 0 }).in('id', idKeToan)
    : { error: null }
  const { error: e2 } = await supabase.from('clients').update({ other_debt: hcnsConLai }).eq('id', clientId)
  if (e1 || e2) {
    return Response.json({
      error: 'Đã ghi dòng xoá nợ nhưng chưa đưa hết nợ tồn về 0: ' + (e1?.message || e2?.message) + '. Báo quản trị kiểm tra tay công ty này.',
    }, { status: 500 })
  }

  try {
    await supabase.from('client_change_log').insert({
      client_id: clientId, entity: 'client_info', entity_label: 'Xoá nợ', field: 'other_debt', action: 'update',
      old_value: conNo.toLocaleString('vi-VN') + 'đ còn phải thu', new_value: 'Đã xoá nợ — ' + reason,
      changed_by: auth.caller.staffId,
    })
  } catch (_) { /* nhật ký không được làm hỏng thao tác */ }

  return Response.json({ ok: true, amount: conNo, detail })
}
