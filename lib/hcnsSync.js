// Cầu nối giữa nghiệp vụ kế toán và module HCNS.
//
// ⚠ RÀNG BUỘC CLONE-APP: bản clone (ABS, NYD, Linh Phong...) KHÔNG chạy sql/06_hcns_module.sql,
// nên ở đó KHÔNG có bảng hcns_* lẫn cột clients.uses_hcns. Mọi hàm trong file này vì thế phải
// **thất bại trong im lặng**: thiếu bảng/cột thì bỏ qua, tuyệt đối không ném lỗi làm hỏng luồng
// kế toán đang chạy. Đây là lý do file này tách riêng thay vì viết thẳng vào clients/route.js.

// Postgres/PostgREST báo thiếu bảng bằng PGRST205, thiếu cột bằng 42703 hoặc "schema cache".
function isMissingSchema(error) {
  if (!error) return false
  const code = error.code || ''
  const msg = (error.message || '').toLowerCase()
  return code === 'PGRST205' || code === '42P01' || code === '42703'
    || msg.includes('schema cache') || msg.includes('does not exist')
}

// Công ty kế toán có đang bật DV HCNS không — trả false nếu cột chưa tồn tại (bản clone).
export async function readUsesHcns(supabase, clientId) {
  const { data, error } = await supabase.from('clients').select('uses_hcns').eq('id', clientId).maybeSingle()
  if (error || !data) return false
  return data.uses_hcns === true
}

// Lấy bản ghi HCNS "thời kỳ" gắn với 1 công ty kế toán. Trả null nếu module chưa cài.
export async function getLinkedHcnsClient(supabase, clientId) {
  const { data, error } = await supabase.from('hcns_clients').select('*')
    .eq('linked_client_id', clientId).maybeSingle()
  if (error) return null
  return data || null
}

// Lấy map { linked_client_id -> hcns_clients row } cho nhiều công ty một lúc (dùng ở trang
// Danh sách công ty). Trả Map rỗng nếu module chưa cài — trang vẫn hiển thị bình thường.
export async function getLinkedHcnsMap(supabase, clientIds = []) {
  const out = new Map()
  if (!clientIds.length) return out
  const PAGE = 1000
  for (let from = 0; from < clientIds.length; from += PAGE) {
    const { data, error } = await supabase.from('hcns_clients').select('*')
      .in('linked_client_id', clientIds.slice(from, from + PAGE))
    if (error) return out
    for (const r of (data || [])) out.set(r.linked_client_id, r)
  }
  return out
}

// Bật/tắt DV HCNS cho 1 công ty kế toán.
//   bật  -> tạo bản ghi hcns_clients category='thoi_ky' nếu chưa có; đã có thì bật lại is_active
//   tắt  -> is_active=false (KHÔNG xoá, giữ nguyên lịch sử thu cũ)
// Trả { ok, skipped, reason } — `skipped:true` nghĩa là module chưa cài, phía gọi cứ bỏ qua.
// feeAt = { year, month } — tháng mà mức phí HCNS bắt đầu áp dụng. Bỏ trống = tháng hiện tại.
export async function syncHcnsForClient(supabase, { clientId, usesHcns, hcnsFee, createdBy, feeAt }) {
  const { data: client, error: cErr } = await supabase.from('clients')
    .select('id, name, client_code, tax_code, address, representative, fee_period').eq('id', clientId).maybeSingle()
  if (cErr || !client) return { ok: false, skipped: true, reason: 'không đọc được công ty' }

  const { data: existing, error: exErr } = await supabase.from('hcns_clients')
    .select('id, is_active, hcns_fee').eq('linked_client_id', clientId).maybeSingle()
  if (exErr && isMissingSchema(exErr)) return { ok: false, skipped: true, reason: 'chưa cài module HCNS' }

  if (!usesHcns) {
    if (existing) await supabase.from('hcns_clients').update({ is_active: false }).eq('id', existing.id)
    return { ok: true, skipped: false, deactivated: true }
  }

  const fee = hcnsFee === undefined || hcnsFee === null ? undefined : Number(hcnsFee) || 0

  if (existing) {
    // Kỳ thu phí phải BÁM THEO công ty kế toán mỗi lần đồng bộ, không chỉ lúc tạo. Công ty đổi từ
    // thu tháng sang thu quý mà bên HCNS vẫn là "tháng" thì phí HCNS bị tính 3 lần một quý và nợ
    // tồn cũng sinh sai.
    const patch = { is_active: true, fee_period: client.fee_period || 'monthly' }
    if (fee !== undefined) patch.hcns_fee = fee
    const { error } = await supabase.from('hcns_clients').update(patch).eq('id', existing.id)
    if (error) return { ok: false, skipped: isMissingSchema(error), reason: error.message }
    if (fee !== undefined && Number(existing.hcns_fee) !== fee) {
      await writeHcnsFeePlan(supabase, existing.id, fee, createdBy, feeAt)
    }
    return { ok: true, skipped: false, hcnsClientId: existing.id }
  }

  const { data: created, error } = await supabase.from('hcns_clients').insert({
    category: 'thoi_ky',
    name: client.name,
    linked_client_id: client.id,
    client_code: client.client_code || null,
    tax_code: client.tax_code || null,
    address: client.address || null,
    representative: client.representative || null,
    fee_period: client.fee_period || 'monthly',
    hcns_fee: fee || 0,
    is_active: true,
  }).select('id').single()
  if (error) return { ok: false, skipped: isMissingSchema(error), reason: error.message }

  if (fee) await writeHcnsFeePlan(supabase, created.id, fee, createdBy, feeAt)
  return { ok: true, skipped: false, hcnsClientId: created.id, created: true }
}

// Ghi mốc "từ tháng này trở đi phí HCNS = X" — soi chiếu đúng cơ chế fee_plan bên kế toán, để
// sau này tra được phí ĐÚNG của một tháng quá khứ thay vì lấy phí sống hiện tại.
// `at` nhận { year, month } (hoặc một Date). Trước đây chỉ nhận Date và không chỗ nào truyền
// vào, nên mọi mốc phí HCNS đều rơi vào tháng hiện tại — không áp phí cho tháng khác được.
export async function writeHcnsFeePlan(supabase, hcnsClientId, fee, createdBy, at) {
  let year, month
  if (at && at.year && at.month) { year = Number(at.year); month = Number(at.month) }
  else { const d = at ? new Date(at) : new Date(); year = d.getFullYear(); month = d.getMonth() + 1 }
  const { error } = await supabase.from('hcns_service_fees').upsert({
    hcns_client_id: hcnsClientId,
    year, month, type: 'fee_plan',
    amount: Number(fee) || 0,
    note: 'Áp dụng từ T' + month + '/' + year,
    created_by: createdBy || null,
  }, { onConflict: 'hcns_client_id,year,month,type' })
  return !error
}

// Ngừng dùng DV HCNS KỂ TỪ một tháng cụ thể.
//
// Hai việc, không được thiếu việc nào:
//   1. Ghi mốc phí HCNS = 0 tại tháng ngừng. Thiếu mốc này thì tra phí các tháng sau vẫn ra mức
//      cũ — công nợ, nợ tồn và dòng B2 trên ĐNTT đều tưởng công ty còn phải trả.
//   2. Gỡ công ty khỏi tag "Thời kỳ" của Phòng HCNS (chỉ khi tháng ngừng đã tới).
//
// Các tháng TRƯỚC tháng ngừng giữ nguyên mức phí cũ — lịch sử thu và công nợ cũ không đổi.
// Dùng lại dịch vụ thì tick lại "Có sử dụng DV HCNS" và nhập mức phí mới.
export async function stopHcnsForClient(supabase, { clientId, stopAt, createdBy }) {
  const { data: existing, error } = await supabase.from('hcns_clients')
    .select('id').eq('linked_client_id', clientId).maybeSingle()
  if (error && isMissingSchema(error)) return { ok: false, skipped: true, reason: 'chưa cài module HCNS' }
  if (!existing) return { ok: false, skipped: true, reason: 'công ty này chưa có hồ sơ HCNS' }

  const now = new Date()
  const y = Number(stopAt?.year) || now.getFullYear()
  const m = Number(stopAt?.month) || (now.getMonth() + 1)
  await writeHcnsFeePlan(supabase, existing.id, 0, createdBy, { year: y, month: m })

  // Chọn tháng sau = hẹn trước: công ty vẫn ở tag Thời kỳ cho tới khi tháng đó tới, lúc đó
  // applyScheduledHcnsStops gỡ giúp. Gỡ ngay bây giờ là sai — tháng này khách vẫn đang dùng.
  const scheduled = (y * 12 + m) > (now.getFullYear() * 12 + now.getMonth() + 1)
  if (!scheduled) {
    await supabase.from('hcns_clients').update({ is_active: false, hcns_fee: 0 }).eq('id', existing.id)
    await supabase.from('clients').update({ uses_hcns: false }).eq('id', clientId)
  }
  return { ok: true, scheduled, stopYear: y, stopMonth: m }
}

// Gỡ những công ty đã HẸN ngừng mà nay đã tới tháng ngừng. Chạy lười mỗi lần tải danh sách
// Phòng HCNS — cùng kiểu với ensureRollovers, khỏi cần cron.
export async function applyScheduledHcnsStops(supabase) {
  const { data: rows, error } = await supabase.from('hcns_clients')
    .select('id, linked_client_id').eq('category', 'thoi_ky').eq('is_active', true)
  if (error || !rows?.length) return 0

  const { data: plans } = await supabase.from('hcns_service_fees')
    .select('hcns_client_id, year, month, amount').in('hcns_client_id', rows.map(r => r.id))
    .eq('type', 'fee_plan')
  if (!plans?.length) return 0

  const now = new Date()
  const cur = now.getFullYear() * 12 + now.getMonth() + 1
  let stopped = 0
  for (const r of rows) {
    // Mốc phí mới nhất tính tới THÁNG NÀY. Mốc hẹn ở tháng sau chưa được tính đến.
    let best = null, bestKey = -Infinity
    for (const p of plans) {
      if (p.hcns_client_id !== r.id) continue
      const k = p.year * 12 + p.month
      if (k <= cur && k > bestKey) { bestKey = k; best = p }
    }
    if (!best || Number(best.amount) !== 0) continue
    await supabase.from('hcns_clients').update({ is_active: false, hcns_fee: 0 }).eq('id', r.id)
    if (r.linked_client_id) {
      await supabase.from('clients').update({ uses_hcns: false }).eq('id', r.linked_client_id)
    }
    stopped++
  }
  return stopped
}
