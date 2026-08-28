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
      .in('linked_client_id', clientIds.slice(from, from + PAGE)).eq('is_active', true)
    if (error) return out
    for (const r of (data || [])) out.set(r.linked_client_id, r)
  }
  return out
}

// Bật/tắt DV HCNS cho 1 công ty kế toán.
//   bật  -> tạo bản ghi hcns_clients category='thoi_ky' nếu chưa có; đã có thì bật lại is_active
//   tắt  -> is_active=false (KHÔNG xoá, giữ nguyên lịch sử thu cũ)
// Trả { ok, skipped, reason } — `skipped:true` nghĩa là module chưa cài, phía gọi cứ bỏ qua.
export async function syncHcnsForClient(supabase, { clientId, usesHcns, hcnsFee, createdBy }) {
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
    const patch = { is_active: true }
    if (fee !== undefined) patch.hcns_fee = fee
    const { error } = await supabase.from('hcns_clients').update(patch).eq('id', existing.id)
    if (error) return { ok: false, skipped: isMissingSchema(error), reason: error.message }
    if (fee !== undefined && Number(existing.hcns_fee) !== fee) {
      await writeHcnsFeePlan(supabase, existing.id, fee, createdBy)
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

  if (fee) await writeHcnsFeePlan(supabase, created.id, fee, createdBy)
  return { ok: true, skipped: false, hcnsClientId: created.id, created: true }
}

// Ghi mốc "từ tháng này trở đi phí HCNS = X" — soi chiếu đúng cơ chế fee_plan bên kế toán, để
// sau này tra được phí ĐÚNG của một tháng quá khứ thay vì lấy phí sống hiện tại.
export async function writeHcnsFeePlan(supabase, hcnsClientId, fee, createdBy, at) {
  const now = at ? new Date(at) : new Date()
  const year = now.getFullYear(), month = now.getMonth() + 1
  const { error } = await supabase.from('hcns_service_fees').upsert({
    hcns_client_id: hcnsClientId,
    year, month, type: 'fee_plan',
    amount: Number(fee) || 0,
    note: 'Áp dụng từ T' + month + '/' + year,
    created_by: createdBy || null,
  }, { onConflict: 'hcns_client_id,year,month,type' })
  return !error
}
