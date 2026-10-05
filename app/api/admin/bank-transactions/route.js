import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { classifyTransactions } from '@/lib/bankData'
import { planSignature, ST_READY, ST_REVIEW } from '@/lib/bankMatch'
import { executePlan } from '@/lib/bankPost'

// Trang Đối soát ngân hàng (/bank) — quyền riêng `bank_reconcile` (sql/21_bank_transactions.sql).
//
// GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD  -> giao dịch trong khoảng + phân loại
// GET  ?clients=1                      -> danh sách công ty để chọn tay
// POST { action: 'post',   id, signature }       -> ghi công nợ theo đề xuất (server tính lại)
//      { action: 'ignore', id, note? }           -> bỏ qua (không phải phí dịch vụ)
//      { action: 'reopen', id }                  -> mở lại giao dịch đã bỏ qua
//      { action: 'assign', id, clientId, year?, month? } -> chọn tay công ty / kỳ
//      { action: 'postOther',    id, serviceId, amount }                     -> ghi vào hồ sơ Dịch vụ khác
//      { action: 'postHcnsCase', id, hcnsClientId, caseServiceId?, amount }  -> ghi vào hồ sơ HCNS Thời điểm
// GET  ?hcnsCases=1                    -> danh sách hồ sơ HCNS Thời điểm + phần còn phải thu

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const PERM = 'bank_reconcile'
const fmtDay = (iso) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

// Ngày của giao dịch theo giờ VN — dùng cho kỳ ghi (year/month) và `paid_at` của HCNS.
const vnParts = (iso) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate()
  return { y, m, d: day, ymd: y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0') }
}

// Mốc đầu/cuối ngày theo giờ VN, trả ISO UTC.
const vnDayStart = (s) => new Date(s + 'T00:00:00+07:00').toISOString()
const vnDayEnd = (s) => new Date(s + 'T23:59:59.999+07:00').toISOString()

// Ghi nhật ký TỪNG thao tác (sql/22_bank_action_log.sql). bank_transactions chỉ giữ trạng thái
// cuối nên không trả lời được "ai đã làm gì với giao dịch này". Lỗi ghi log KHÔNG được làm hỏng
// thao tác — bảng chưa tạo (chưa chạy SQL) thì bỏ qua trong im lặng.
async function logAction(supabase, { txId, clientId, action, detail, note, staffId }) {
  try {
    await supabase.from('bank_action_logs').insert({
      tx_id: txId, client_id: clientId || null, action,
      detail: detail || null, note: note || null, staff_id: staffId || null,
    })
  } catch (e) { console.error('logAction:', e?.message || e) }
}

export async function GET(request) {
  const auth = await callerHasPermission(PERM)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const supabase = getAdmin()
  const url = new URL(request.url)

  // Danh sách hồ sơ HCNS "Thời điểm" để ghi thẳng tiền vào hồ sơ ngay tại trang đối soát. Nhóm này
  // KHÔNG gắn với công ty kế toán (linked_client_id trống) nên không tra được qua ô chọn công ty.
  if (url.searchParams.get('hcnsCases')) {
    try {
      const { data: hc } = await supabase.from('hcns_clients')
        .select('id, name, tax_code, case_code').eq('category', 'thoi_diem').eq('is_active', true).order('name')
      const ids = (hc || []).map(h => h.id)
      const [{ data: svc }, { data: pay }] = await Promise.all([
        supabase.from('hcns_case_services').select('hcns_client_id, cost').in('hcns_client_id', ids),
        supabase.from('hcns_case_payments').select('hcns_client_id, amount').in('hcns_client_id', ids),
      ])
      const phi = new Map(), thu = new Map()
      for (const s of svc || []) phi.set(s.hcns_client_id, (phi.get(s.hcns_client_id) || 0) + (Number(s.cost) || 0))
      for (const p of pay || []) thu.set(p.hcns_client_id, (thu.get(p.hcns_client_id) || 0) + (Number(p.amount) || 0))
      return Response.json({
        data: (hc || []).map(h => ({
          id: h.id, name: h.name, tax_code: h.tax_code, case_code: h.case_code,
          fee: phi.get(h.id) || 0, paid: thu.get(h.id) || 0,
          remain: Math.max(0, (phi.get(h.id) || 0) - (thu.get(h.id) || 0)),
        })),
      })
    } catch (e) { return Response.json({ data: [], error: e?.message }) }
  }

  if (url.searchParams.get('clients')) {
    const all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('clients')
        .select('id, name, client_code, tax_code').order('name').range(from, from + 999)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      all.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    return Response.json({ data: all })
  }

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  let q = supabase.from('bank_transactions').select('*').order('tx_time', { ascending: false }).limit(1000)
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte('tx_time', vnDayStart(from))
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) q = q.lte('tx_time', vnDayEnd(to))
  const { data: txs, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Chỉ phân loại giao dịch còn mở; đã ghi / bỏ qua thì hiện đúng những gì đã làm.
  const open = (txs || []).filter(t => t.state === 'open')
  let cls = []
  try { cls = await classifyTransactions(supabase, open) } catch (e) {
    return Response.json({ error: 'Lỗi phân loại: ' + e.message }, { status: 500 })
  }
  const clsById = new Map(open.map((t, i) => [t.id, cls[i]]))

  // Tên công ty cho giao dịch đã ghi.
  const postedIds = [...new Set((txs || []).filter(t => t.state !== 'open' && t.client_id).map(t => t.client_id))]
  const names = new Map()
  if (postedIds.length) {
    const { data } = await supabase.from('clients').select('id, name').in('id', postedIds)
    for (const c of data || []) names.set(c.id, c.name)
  }
  // Nhật ký từng thao tác (sql/22_bank_action_log.sql). Chưa chạy SQL thì coi như chưa có nhật ký.
  let logs = []
  if (txs?.length) {
    try {
      const { data, error } = await supabase.from('bank_action_logs')
        .select('id, tx_id, action, detail, note, staff_id, created_at')
        .in('tx_id', txs.map(t => t.id)).order('created_at', { ascending: false })
      if (!error) logs = data || []
    } catch (_) { logs = [] }
  }
  const logsByTx = new Map()
  for (const l of logs) {
    if (!logsByTx.has(l.tx_id)) logsByTx.set(l.tx_id, [])
    logsByTx.get(l.tx_id).push(l)
  }

  const staffIds = [...new Set([...(txs || []).map(t => t.posted_by), ...logs.map(l => l.staff_id)].filter(Boolean))]
  const staffNames = new Map()
  if (staffIds.length) {
    const { data } = await supabase.from('staff').select('id, full_name').in('id', staffIds)
    for (const s of data || []) staffNames.set(s.id, s.full_name)
  }

  const rows = (txs || []).map(t => {
    const base = {
      id: t.id, source: t.source, tx_time: t.tx_time, amount: Number(t.amount) || 0, memo: t.memo || '',
      account: t.account, state: t.state, note: t.note,
      posted_at: t.posted_at, posted_by_name: staffNames.get(t.posted_by) || null, post_detail: t.post_detail,
      logs: (logsByTx.get(t.id) || []).map(l => ({
        id: l.id, action: l.action, detail: l.detail, note: l.note,
        at: l.created_at, by: staffNames.get(l.staff_id) || '—',
      })),
    }
    if (t.state !== 'open') {
      return { ...base, status: t.state, client: t.client_id ? { id: t.client_id, name: names.get(t.client_id) || '' } : null }
    }
    const c = clsById.get(t.id)
    return {
      ...base, ...c,
      manualClient: !!t.client_id, manualPeriod: !!(t.period_year && t.period_month),
      signature: c.plan ? planSignature(c.client?.id, c.plan) : null,
    }
  })
  return Response.json({ data: rows })
}

export async function POST(request) {
  const auth = await callerHasPermission(PERM)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const staffId = auth.caller.staffId
  const supabase = getAdmin()
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 }) }
  const { action, id } = body || {}
  if (!id) return Response.json({ error: 'Thiếu giao dịch' }, { status: 400 })

  const { data: tx } = await supabase.from('bank_transactions').select('*').eq('id', id).maybeSingle()
  if (!tx) return Response.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 })

  if (action === 'ignore') {
    // Lưu lại công ty + kỳ đã nhận ra TRƯỚC khi đóng giao dịch. Không lưu thì sau đó dòng này chỉ
    // còn nội dung chuyển khoản, hiện "Không nhận ra công ty" — mất luôn dấu vết tiền của ai
    // (giao dịch đã đóng không được phân loại lại, xem GET).
    let keep = {}
    if (!tx.client_id) {
      try {
        const [c] = await classifyTransactions(supabase, [tx])
        if (c?.client?.id) {
          keep = { client_id: c.client.id }
          if (c.period?.year && c.period?.month) keep = { ...keep, period_year: c.period.year, period_month: c.period.month }
        }
      } catch (e) { console.error('ignore/classify:', e?.message || e) }
    }
    const { data, error } = await supabase.from('bank_transactions')
      .update({ ...keep, state: 'ignored', posted_at: new Date().toISOString(), posted_by: staffId, note: body.note || null })
      .eq('id', id).eq('state', 'open').select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data?.length) return Response.json({ error: 'Giao dịch đã được xử lý bởi người khác — tải lại trang' }, { status: 409 })
    await logAction(supabase, {
      txId: id, clientId: keep.client_id || tx.client_id, action: 'ignore',
      detail: body.note || 'Đóng giao dịch', note: body.userNote, staffId,
    })
    return Response.json({ ok: true })
  }

  if (action === 'reopen') {
    // Chỉ mở lại giao dịch BỎ QUA. Giao dịch đã ghi công nợ không tự gỡ được — sửa tay ở công nợ.
    // Xoá luôn công ty/kỳ đã lưu lúc đóng để giao dịch được đọc lại từ nội dung chuyển khoản
    // như ban đầu (người dùng vẫn chọn tay lại được).
    const { data, error } = await supabase.from('bank_transactions')
      .update({ state: 'open', posted_at: null, posted_by: null, note: null, client_id: null, period_year: null, period_month: null })
      .eq('id', id).eq('state', 'ignored').select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data?.length) return Response.json({ error: 'Chỉ mở lại được giao dịch đã bỏ qua' }, { status: 409 })
    await logAction(supabase, { txId: id, clientId: tx.client_id, action: 'reopen', detail: 'Mở lại giao dịch', note: body.userNote, staffId })
    return Response.json({ ok: true })
  }

  // Chỉ thêm ghi chú, không đổi trạng thái — để nhân viên giải thích một giao dịch lạ cho người
  // xem sau (hiện ngay trong thẻ giao dịch và ở Nhật ký làm việc).
  if (action === 'note') {
    const note = String(body.note || '').trim()
    if (!note) return Response.json({ error: 'Chưa nhập ghi chú' }, { status: 400 })
    await logAction(supabase, { txId: id, clientId: tx.client_id, action: 'note', detail: 'Ghi chú', note, staffId })
    return Response.json({ ok: true })
  }

  if (action === 'assign') {
    if (tx.state !== 'open') return Response.json({ error: 'Giao dịch đã xử lý' }, { status: 409 })
    const y = Number(body.year) || null, m = Number(body.month) || null
    if (m && (m < 1 || m > 12)) return Response.json({ error: 'Tháng không hợp lệ' }, { status: 400 })
    const { error } = await supabase.from('bank_transactions').update({
      client_id: body.clientId || null,
      period_year: y && m ? y : null, period_month: y && m ? m : null,
    }).eq('id', id).eq('state', 'open')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await logAction(supabase, {
      txId: id, clientId: body.clientId || null, action: 'assign',
      detail: body.clientId ? ('Chọn tay công ty' + (y && m ? ' · kỳ T' + m + '/' + y : '')) : 'Bỏ chọn tay, đọc lại từ nội dung',
      note: body.userNote, staffId,
    })
    return Response.json({ ok: true })
  }

  if (action === 'post') {
    if (tx.state !== 'open') return Response.json({ error: 'Giao dịch đã được xử lý — tải lại trang' }, { status: 409 })
    // Tính lại đề xuất ngay lúc ghi — không tin số trình duyệt gửi.
    const [c] = await classifyTransactions(supabase, [tx])
    if (!c.client || !c.plan || !c.plan.length || ![ST_READY, ST_REVIEW].includes(c.status)) {
      return Response.json({ error: 'Giao dịch này không có đề xuất ghi — ' + (c.reason || 'xử lý tay') }, { status: 400 })
    }
    const sig = planSignature(c.client.id, c.plan)
    if (sig !== body.signature) {
      return Response.json({ error: 'Công nợ của công ty vừa thay đổi (có thể nhân viên mới ghi tay). Tải lại trang để xem đề xuất mới.' }, { status: 409 })
    }
    // Giữ chỗ trước khi ghi: 2 người bấm cùng lúc thì chỉ 1 người qua được bước này.
    const { data: claimed, error: cErr } = await supabase.from('bank_transactions')
      .update({ state: 'posted', posted_at: new Date().toISOString(), posted_by: staffId, client_id: c.client.id })
      .eq('id', id).eq('state', 'open').select('id')
    if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
    if (!claimed?.length) return Response.json({ error: 'Giao dịch đã được xử lý bởi người khác — tải lại trang' }, { status: 409 })

    const note = 'Đối soát NH ' + String(tx.source || '').toUpperCase() + ' ' + fmtDay(tx.tx_time)
    const res = await executePlan(supabase, c.client.id, c.plan, note, staffId)
    const detail = { plan: c.plan, done: res.done, reason: c.reason, error: res.error || null }
    if (!res.ok && !res.done.length) {
      // Chưa ghi được gì -> trả giao dịch về trạng thái mở để thử lại.
      await supabase.from('bank_transactions').update({ state: 'open', posted_at: null, posted_by: null, post_detail: detail }).eq('id', id)
      return Response.json({ error: 'Chưa ghi được: ' + res.error }, { status: 500 })
    }
    await supabase.from('bank_transactions').update({
      post_detail: detail, note: res.ok ? null : 'LỖI GHI MỘT PHẦN — kiểm tra tay: ' + res.error,
    }).eq('id', id)
    const KIND_LABEL = { ketoan: 'Kế toán', hcns: 'HCNS', no_ton: 'Nợ tồn' }
    await logAction(supabase, {
      txId: id, clientId: c.client.id, action: 'post',
      detail: (res.ok ? 'Ghi công nợ: ' : 'Ghi được một phần: ')
        + res.done.map(l => (KIND_LABEL[l.kind] || l.kind) + (l.month ? ' T' + l.month + '/' + l.year : '')
          + ' ' + Number(l.amount).toLocaleString('vi-VN') + 'đ').join(' + ')
        + (res.ok ? '' : ' · LỖI: ' + res.error),
      note: body.userNote, staffId,
    })
    if (!res.ok) return Response.json({ error: 'Mới ghi được một phần, phần còn lại lỗi: ' + res.error + '. Kiểm tra tay công nợ công ty này.' }, { status: 500 })
    return Response.json({ ok: true, done: res.done })
  }

  // Ghi tiền vào HỒ SƠ "Dịch vụ khác" (sql/24) thay vì phí kế toán hàng tháng. Nhân viên đã tự
  // ghép công ty rồi mới chọn hồ sơ, nên KHÔNG tính lại đề xuất / so planSignature như action
  // 'post' — ở đây cái cần chặn là ghi quá phần còn lại của hồ sơ.
  if (action === 'postOther') {
    if (tx.state !== 'open') return Response.json({ error: 'Giao dịch đã được xử lý — tải lại trang' }, { status: 409 })
    const amount = Math.round(Number(body.amount) || 0)
    if (amount <= 0) return Response.json({ error: 'Số tiền ghi phải lớn hơn 0' }, { status: 400 })
    const { data: svc } = await supabase.from('other_services').select('*').eq('id', body.serviceId).maybeSingle()
    if (!svc) return Response.json({ error: 'Không tìm thấy hồ sơ dịch vụ khác' }, { status: 404 })
    if (svc.status === 'done') return Response.json({ error: 'Hồ sơ đã đóng — mở lại ở trang công ty trước khi ghi' }, { status: 400 })
    const { data: pays } = await supabase.from('other_service_payments').select('amount').eq('service_id', svc.id)
    const daThu = (pays || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
    const conLai = Math.max(0, (Number(svc.amount) || 0) - daThu)
    if (amount > conLai) {
      return Response.json({
        error: 'Số tiền ghi (' + amount.toLocaleString('vi-VN') + 'đ) lớn hơn phần còn lại của hồ sơ ('
          + conLai.toLocaleString('vi-VN') + 'đ). Ghi số nhỏ hơn, hoặc sửa số phải thu của hồ sơ ở trang công ty.',
      }, { status: 400 })
    }
    // Giữ chỗ trước khi ghi — 2 người bấm cùng lúc thì chỉ 1 người qua.
    const { data: claimed, error: cErr } = await supabase.from('bank_transactions')
      .update({ state: 'posted', posted_at: new Date().toISOString(), posted_by: staffId, client_id: svc.client_id })
      .eq('id', id).eq('state', 'open').select('id')
    if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
    if (!claimed?.length) return Response.json({ error: 'Giao dịch đã được xử lý bởi người khác — tải lại trang' }, { status: 409 })

    const d = vnParts(tx.tx_time)
    const { error } = await supabase.from('other_service_payments').insert({
      service_id: svc.id, client_id: svc.client_id, amount,
      // Kỳ ghi = THÁNG TIỀN VÀO theo giờ VN, không phải tháng đang xem trên giao diện.
      year: d.y, month: d.m,
      note: 'Đối soát NH ' + String(tx.source || '').toUpperCase() + ' ' + fmtDay(tx.tx_time), created_by: staffId,
    })
    if (error) {
      await supabase.from('bank_transactions').update({ state: 'open', posted_at: null, posted_by: null }).eq('id', id)
      return Response.json({ error: 'Chưa ghi được: ' + error.message }, { status: 500 })
    }
    const tuDong = amount === conLai
    if (tuDong) {
      await supabase.from('other_services')
        .update({ status: 'done', closed_at: new Date().toISOString(), closed_by: staffId }).eq('id', svc.id)
    }
    const detail = { kind: 'other_service', serviceId: svc.id, name: svc.name, amount, closed: tuDong }
    await supabase.from('bank_transactions').update({ post_detail: detail }).eq('id', id)
    await logAction(supabase, {
      txId: id, clientId: svc.client_id, action: 'post',
      detail: 'Dịch vụ khác "' + svc.name + '" ' + amount.toLocaleString('vi-VN') + 'đ'
        + (tuDong ? ' · hồ sơ đã thu đủ, tự đóng' : ' · còn lại ' + (conLai - amount).toLocaleString('vi-VN') + 'đ'),
      note: body.userNote, staffId,
    })
    return Response.json({ ok: true, closed: tuDong })
  }

  // Ghi tiền vào HỒ SƠ HCNS "Thời điểm". Nhóm này không gắn công ty kế toán (linked_client_id
  // trống) nên giao dịch chỉ lưu được hồ sơ ở post_detail, client_id vẫn để nguyên.
  // paid_at = NGÀY TIỀN VÀO NGÂN HÀNG (không phải ngày bấm) — ghi muộn mà lấy ngày ghi sẽ thổi
  // phồng "Tồn đầu kỳ" của Phòng HCNS.
  if (action === 'postHcnsCase') {
    if (tx.state !== 'open') return Response.json({ error: 'Giao dịch đã được xử lý — tải lại trang' }, { status: 409 })
    const amount = Math.round(Number(body.amount) || 0)
    if (amount <= 0) return Response.json({ error: 'Số tiền ghi phải lớn hơn 0' }, { status: 400 })
    const { data: hc } = await supabase.from('hcns_clients').select('id, name, category').eq('id', body.hcnsClientId).maybeSingle()
    if (!hc) return Response.json({ error: 'Không tìm thấy hồ sơ HCNS' }, { status: 404 })
    if (hc.category !== 'thoi_diem') return Response.json({ error: 'Chỉ ghi được vào hồ sơ HCNS Thời điểm' }, { status: 400 })
    const [{ data: svcs }, { data: pays }] = await Promise.all([
      supabase.from('hcns_case_services').select('id, cost').eq('hcns_client_id', hc.id),
      supabase.from('hcns_case_payments').select('amount').eq('hcns_client_id', hc.id),
    ])
    const phi = (svcs || []).reduce((a, x) => a + (Number(x.cost) || 0), 0)
    const daThu = (pays || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
    const conLai = Math.max(0, phi - daThu)
    if (amount > conLai) {
      return Response.json({
        error: 'Số tiền ghi (' + amount.toLocaleString('vi-VN') + 'đ) lớn hơn phần còn phải thu của hồ sơ ('
          + conLai.toLocaleString('vi-VN') + 'đ). Ghi số nhỏ hơn, hoặc kiểm lại phí dịch vụ trong hồ sơ.',
      }, { status: 400 })
    }
    const caseServiceId = body.caseServiceId || null
    if (caseServiceId && !(svcs || []).some(x => x.id === caseServiceId)) {
      return Response.json({ error: 'Dịch vụ không thuộc hồ sơ này' }, { status: 400 })
    }
    const { data: claimed, error: cErr } = await supabase.from('bank_transactions')
      .update({ state: 'posted', posted_at: new Date().toISOString(), posted_by: staffId })
      .eq('id', id).eq('state', 'open').select('id')
    if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
    if (!claimed?.length) return Response.json({ error: 'Giao dịch đã được xử lý bởi người khác — tải lại trang' }, { status: 409 })

    const d = vnParts(tx.tx_time)
    const { error } = await supabase.from('hcns_case_payments').insert({
      hcns_client_id: hc.id, case_service_id: caseServiceId, amount,
      note: 'Đối soát NH ' + String(tx.source || '').toUpperCase() + ' ' + fmtDay(tx.tx_time),
      created_by: staffId, paid_at: d.ymd,
    })
    if (error) {
      await supabase.from('bank_transactions').update({ state: 'open', posted_at: null, posted_by: null }).eq('id', id)
      return Response.json({ error: 'Chưa ghi được: ' + error.message }, { status: 500 })
    }
    const detail = { kind: 'hcns_case', hcnsClientId: hc.id, name: hc.name, caseServiceId, amount, paid_at: d.ymd }
    await supabase.from('bank_transactions').update({ post_detail: detail }).eq('id', id)
    await logAction(supabase, {
      txId: id, clientId: tx.client_id, action: 'post',
      detail: 'Hồ sơ HCNS Thời điểm "' + hc.name + '" ' + amount.toLocaleString('vi-VN') + 'đ'
        + ' · ngày trả ' + d.ymd + (conLai - amount > 0 ? ' · còn lại ' + (conLai - amount).toLocaleString('vi-VN') + 'đ' : ' · đã thu đủ'),
      note: body.userNote, staffId,
    })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Thao tác không hợp lệ' }, { status: 400 })
}
