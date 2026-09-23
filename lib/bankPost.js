// Ghi công nợ từ 1 giao dịch ngân hàng đã được người dùng bấm "Ghi" ở trang Đối soát ngân hàng.
//
// Cùng luật với các route ghi tay (save-debt, hcns/save-debt, save-old-debt), chỉ khác một điểm:
// tiền ngân hàng là khoản CỘNG THÊM vào số đã thu của kỳ (ghi tay thì người dùng nhập tổng mới).
// Đề xuất (plan) luôn do server tính lại ngay trước khi ghi — xem app/api/admin/bank-transactions.

import { applyOldDebtPayment } from './debtRollover.js'

// Tháng hiện tại theo giờ VN — Vercel chạy UTC, 6h sáng VN ngày 1 vẫn là tháng trước.
function nowVN() {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

const joinNote = (old, add) => (old ? String(old) + ' · ' : '') + add

async function addKetoan(supabase, clientId, line, note, staffId) {
  const { data: prev } = await supabase.from('service_fees').select('amount, note')
    .eq('client_id', clientId).eq('year', line.year).eq('month', line.month).eq('type', 'ketoan').maybeSingle()
  const before = Number(prev?.amount) || 0
  const { error } = await supabase.from('service_fees').upsert({
    client_id: clientId, year: line.year, month: line.month, type: 'ketoan',
    amount: before + line.amount, note: joinNote(prev?.note, note),
    created_by: staffId, created_at: new Date().toISOString(),
  }, { onConflict: 'client_id,year,month,type' })
  if (error) throw new Error('Ghi phí kế toán T' + line.month + ': ' + error.message)

  // Giống save-debt: tháng từng bị chuyển nợ tồn thì phần thu thêm trừ luôn vào nợ tồn. Đề xuất đã
  // loại các tháng này (tiền đi thẳng vào nợ tồn), giữ lại cho chắc khi dữ liệu đổi giữa chừng.
  const { data: roll } = await supabase.from('debt_rollovers').select('id, remaining_amount')
    .eq('client_id', clientId).eq('year', line.year).eq('month', line.month).eq('source', 'ketoan').maybeSingle()
  if (roll && Number(roll.remaining_amount) > 0) {
    const reduce = Math.min(line.amount, Number(roll.remaining_amount))
    const { data: c } = await supabase.from('clients').select('other_debt').eq('id', clientId).single()
    await Promise.all([
      supabase.from('debt_rollovers').update({ remaining_amount: Number(roll.remaining_amount) - reduce }).eq('id', roll.id),
      supabase.from('clients').update({ other_debt: Math.max(0, (Number(c?.other_debt) || 0) - reduce) }).eq('id', clientId),
    ])
  }
  return { kind: 'ketoan', year: line.year, month: line.month, amount: line.amount, before, after: before + line.amount }
}

async function addHcns(supabase, clientId, line, note, staffId) {
  const { data: hc } = await supabase.from('hcns_clients').select('id')
    .eq('linked_client_id', clientId).eq('is_active', true).maybeSingle()
  if (!hc) throw new Error('Công ty chưa bật dịch vụ HCNS')
  const { data: prev } = await supabase.from('hcns_service_fees').select('amount, note')
    .eq('hcns_client_id', hc.id).eq('year', line.year).eq('month', line.month).eq('type', 'hcns').maybeSingle()
  const before = Number(prev?.amount) || 0
  const { error } = await supabase.from('hcns_service_fees').upsert({
    hcns_client_id: hc.id, year: line.year, month: line.month, type: 'hcns',
    amount: before + line.amount, note: joinNote(prev?.note, note),
    created_by: staffId, created_at: new Date().toISOString(),
  }, { onConflict: 'hcns_client_id,year,month,type' })
  if (error) throw new Error('Ghi phí HCNS T' + line.month + ': ' + error.message)
  return { kind: 'hcns', year: line.year, month: line.month, amount: line.amount, before, after: before + line.amount }
}

// Giống save-old-debt: trừ clients.other_debt + các dòng debt_rollovers cũ nhất trước, ghi dòng
// 'no_ton' ở THÁNG THU (không quay lại tháng gốc).
async function addNoTon(supabase, clientId, line, note, staffId) {
  const { data: c } = await supabase.from('clients').select('other_debt').eq('id', clientId).single()
  const debt = Number(c?.other_debt) || 0
  const paid = Math.min(line.amount, debt)
  if (paid <= 0) throw new Error('Công ty không còn nợ tồn để trừ')
  const { error: uErr } = await supabase.from('clients').update({ other_debt: debt - paid }).eq('id', clientId)
  if (uErr) throw new Error('Trừ nợ tồn: ' + uErr.message)
  const alloc = await applyOldDebtPayment(supabase, clientId, paid)

  const { year, month } = nowVN()
  const { data: prev } = await supabase.from('service_fees').select('amount, note')
    .eq('client_id', clientId).eq('year', year).eq('month', month).eq('type', 'no_ton').maybeSingle()
  const before = Number(prev?.amount) || 0
  const { error } = await supabase.from('service_fees').upsert({
    client_id: clientId, year, month, type: 'no_ton',
    amount: before + paid, note: joinNote(prev?.note, note),
    created_by: staffId, created_at: new Date().toISOString(),
  }, { onConflict: 'client_id,year,month,type' })
  if (error) throw new Error('Ghi thu nợ tồn: ' + error.message)
  return { kind: 'no_ton', year, month, amount: paid, debtBefore: debt, debtAfter: debt - paid, rollovers: alloc.applied }
}

// Thực hiện từng dòng của đề xuất. Lỗi giữa chừng KHÔNG quay lại các dòng đã ghi (không có
// transaction qua REST) — trả về đủ chi tiết để lưu vào post_detail và báo người dùng kiểm tay.
export async function executePlan(supabase, clientId, plan, note, staffId) {
  const done = []
  for (const line of plan) {
    try {
      if (line.kind === 'ketoan') done.push(await addKetoan(supabase, clientId, line, note, staffId))
      else if (line.kind === 'hcns') done.push(await addHcns(supabase, clientId, line, note, staffId))
      else if (line.kind === 'no_ton') done.push(await addNoTon(supabase, clientId, line, note, staffId))
    } catch (e) {
      return { ok: false, done, error: e.message }
    }
  }
  return { ok: true, done }
}
