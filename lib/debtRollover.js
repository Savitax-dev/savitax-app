// Tự động chuyển phần phí kế toán thu thiếu của các tháng đã qua thành "nợ tồn"
// (clients.other_debt), ghi lại trong debt_rollovers để tránh tính trùng khi
// khách thanh toán lùi cho đúng tháng đó (xem app/api/admin/save-debt/route.js).
//
// Chạy lazy (idempotent) mỗi khi các trang công nợ tải dữ liệu của THÁNG HIỆN TẠI —
// không cần cron. Nếu app không được mở trong một tháng, phần rollover của tháng đó
// sẽ được bù khi mở lại vì hàm quét tối đa 24 tháng gần nhất.

import { isPastRolloverDeadline, isPastEditDeadline, resolveFeeForMonth, feePeriodAt } from './feeDue.js'
import { ensureHcnsRollovers } from './hcnsRollover.js'
import { docCtyDacThu } from './ctyDacThu.js'

const MONTHS_BACK = 24

// Supabase/PostgREST giới hạn TỐI ĐA 1000 dòng/query mặc định (im lặng cắt bớt, KHÔNG báo lỗi)
// — xem project_postgrest_1000row_limit trong memory. Hàm này được gọi với clientIds TOÀN CÔNG
// TY từ debt-overview/route.js, quét 24 tháng — hiện còn dư dả (~93 dòng) nhưng cùng rủi ro như
// kpi-overview/work-log đã dính lỗi thật, phân trang phòng ngừa.
async function fetchAllRows(buildQuery, pageSize = 1000) {
  let all = []
  let from = 0
  while (true) {
    // Sắp theo id để lật trang ổn định — không sắp thì trang sau lặp / bỏ sót dòng (đo thật 17/10/2026).
    const { data, error } = await buildQuery().order('id').range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

function pastMonths(currentYear, currentMonth, count) {
  const months = []
  let y = currentYear, m = currentMonth
  for (let i = 0; i < count; i++) {
    m--
    if (m === 0) { m = 12; y-- }
    months.push({ year: y, month: m })
  }
  return months
}

// Chỉ gọi khi đang xem đúng tháng hiện tại thực tế (gọi từ route, không gọi khi xem lại tháng cũ).
export async function ensureRollovers(supabase, clientIds, currentYear, currentMonth) {
  if (!clientIds || clientIds.length === 0) return

  const months = pastMonths(currentYear, currentMonth, MONTHS_BACK)
  if (months.length === 0) return
  const minYear = months[months.length - 1].year

  const [{ data: clients }, existingRollovers, feesKetoan, feePlanRows, changeLogRows] = await Promise.all([
    supabase.from('clients').select('id, monthly_fee, other_debt, created_at, fee_period, contract_start').in('id', clientIds),
    fetchAllRows(() => supabase.from('debt_rollovers').select('client_id, year, month')
      .in('client_id', clientIds).eq('source', 'ketoan').gte('year', minYear)),
    fetchAllRows(() => supabase.from('service_fees').select('client_id, year, month, amount')
      .in('client_id', clientIds).eq('type', 'ketoan').gte('year', minYear)),
    // Không giới hạn năm — cần cả dòng cũ hơn minYear để biết đúng phí của tháng đầu trong
    // khoảng quét (dòng fee_plan gần nhất <= tháng đang xét có thể nằm trước minYear).
    fetchAllRows(() => supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', clientIds).eq('type', 'fee_plan')),
    // Phí gốc trước lần đổi đầu tiên (cho tháng còn sớm hơn mọi dòng fee_plan) — xem resolveFeeForMonth.
    fetchAllRows(() => supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', clientIds).eq('entity', 'monthly_fee').eq('action', 'update')),
  ])

  // Tháng ngưng dịch vụ (clients.service_end, sql/25) — đọc riêng, cột chưa có thì bỏ qua.
  // Công ty ngưng từ T10 thì T10 trở đi KHÔNG được chốt nợ tồn, nhưng T9 chưa thu vẫn phải chốt.
  const ngungTu = {}
  try {
    const { data: se, error: seErr } = await supabase.from('clients').select('id, service_end').in('id', clientIds)
    if (!seErr) {
      for (const r of se || []) {
        if (!r.service_end) continue
        const [y, m] = String(r.service_end).slice(0, 10).split('-').map(Number)
        if (y && m) ngungTu[r.id] = y * 12 + (m - 1)
      }
    }
  } catch (_) { /* chưa chạy sql/25 */ }

  // Lịch sử đổi kỳ thu phí Quý <-> Tháng — để tính mỗi tháng cũ theo kỳ thu CÓ HIỆU LỰC LÚC ĐÓ
  // (feePeriodAt). Lỗi đọc thì coi như không có lần đổi nào (hành vi cũ), không làm hỏng rollover.
  const doiKyThu = {}
  try {
    const rows = await fetchAllRows(() => supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', clientIds).eq('field', 'fee_period'))
    for (const r of rows) (doiKyThu[r.client_id] = doiKyThu[r.client_id] || []).push(r)
  } catch (e) { console.error('ensureRollovers: không đọc được lịch sử đổi kỳ thu phí', e?.message || e) }

  // Công ty được admin gia hạn thu (lib/ctyDacThu.js): hạn chuyển nợ tồn lùi thêm N tháng.
  const dacThu = await docCtyDacThu(supabase)

  const rolledSet = new Set((existingRollovers || []).map(r => r.client_id + '_' + r.year + '_' + r.month))
  const feeCollected = {}
  for (const f of (feesKetoan || [])) feeCollected[f.client_id + '_' + f.year + '_' + f.month] = Number(f.amount) || 0

  const newRollovers = []
  const debtDeltaByClient = {}
  const now = new Date()

  for (const c of (clients || [])) {
    const fee = Number(c.monthly_fee) || 0
    if (fee <= 0) continue
    // Không rollover các tháng TRƯỚC khi công ty được thêm vào hệ thống — tránh tự bịa
    // ra "nợ tồn" cho thời gian công ty chưa tồn tại (vd công ty mới tạo tháng này).
    const created = c.created_at ? new Date(c.created_at) : null
    const createdYM = created ? created.getFullYear() * 12 + created.getMonth() : -Infinity
    // Thêm lớp chặn CHẶT HƠN theo ngày bắt đầu hợp đồng (lớp theo ngày tạo ở trên GIỮ NGUYÊN — nới
    // nó ra sẽ sinh ~6 tỷ nợ ảo). Công ty tạo trên app cuối tháng 9 nhưng hợp đồng từ 01/10 thì
    // tháng 9 chưa làm dịch vụ, không có phí để nợ — gặp thật: TRUETRUST, 1MIL PERFUME (T9), SEN TÍM
    // (T8), nhân viên phải tự xoá tay nợ ảo.
    const [hdY, hdM] = c.contract_start ? String(c.contract_start).slice(0, 10).split('-').map(Number) : []
    const contractYM = hdY && hdM ? hdY * 12 + (hdM - 1) : -Infinity
    const startYM = Math.max(createdYM, contractYM)
    for (const { year, month } of months) {
      if (year * 12 + (month - 1) < startYM) continue
      if (ngungTu[c.id] !== undefined && year * 12 + (month - 1) >= ngungTu[c.id]) continue
      // Công ty thu phí theo quý (fee_period='quarterly', monthly_fee = tiền cả quý): tháng
      // không phải cuối quý không tính là "đến hạn". Cả công ty tháng lẫn quý đều được khoan
      // 10 ngày sang kỳ sau trước khi tự ghi "nợ tồn" (isPastRolloverDeadline) — khác hẳn
      // %-KPI/doanh thu real-time ở các trang khác (vẫn dùng feeCountsForMonth, không đổi).
      // Kỳ thu phí lấy theo LÚC ĐÓ, không theo hiện tại — xem feePeriodAt (lib/feeDue.js).
      const kyThu = feePeriodAt(c.fee_period, doiKyThu[c.id], year, month)
      if (!isPastRolloverDeadline(kyThu, year, month, now, dacThu.giaHan.get(c.id) || 0)) continue
      const key = c.id + '_' + year + '_' + month
      if (rolledSet.has(key)) continue
      const collected = feeCollected[key] || 0
      // Phí ĐÚNG của tháng này (không phải monthly_fee sống nếu công ty đã đổi phí sau đó).
      const feeForThisMonth = resolveFeeForMonth(feePlanRows || [], c.id, year, month, fee, changeLogRows || [])
      const shortfall = feeForThisMonth - collected
      if (shortfall <= 0) continue
      newRollovers.push({ client_id: c.id, year, month, rolled_amount: shortfall, remaining_amount: shortfall })
      debtDeltaByClient[c.id] = (debtDeltaByClient[c.id] || 0) + shortfall
    }
  }

  if (newRollovers.length > 0) {
    const { error: insertError } = await supabase.from('debt_rollovers')
      .insert(newRollovers.map(r => ({ ...r, source: 'ketoan' })))
    if (insertError) {
      console.error('ensureRollovers insert error:', insertError)
      return
    }

    const clientById = {}
    for (const c of (clients || [])) clientById[c.id] = c

    await Promise.all(Object.entries(debtDeltaByClient).map(([clientId, delta]) => {
      const current = Number(clientById[clientId]?.other_debt) || 0
      return supabase.from('clients').update({ other_debt: current + delta }).eq('id', clientId)
    }))
  }

  // Phí HCNS thu thiếu cũng chuyển thành nợ tồn, dồn về cùng clients.other_debt vì nhân viên kế
  // toán thu cả hai khoản. Chạy SAU để đọc được other_debt vừa cộng ở trên.
  // Bọc try/catch: bản clone không có bảng hcns_* — hỏng ở đây không được kéo đổ phần kế toán.
  try {
    await ensureHcnsRollovers(supabase, clientIds, currentYear, currentMonth)
  } catch (e) {
    console.error('ensureHcnsRollovers skipped:', e?.message || e)
  }
}

// Tính lại các dòng "nợ tồn tự động" đã ghi cho các tháng TỪ (fromYear, fromMonth) TRỞ ĐI.
//
// Vì sao cần: ensureRollovers ghi 1 dòng nợ tồn rồi KHÔNG bao giờ xét lại tháng đó nữa
// (`if (rolledSet.has(key)) continue`). Nếu sau đó phí của tháng đó bị sửa — điển hình là giảm
// giá áp lùi — dòng nợ tồn vẫn giữ số tính theo phí CŨ, và clients.other_debt treo một khoản nợ
// không có thật. Ca thật: KING DƯỢC ghi nợ tồn T7/2026 là 8.640.000đ theo phí cũ, trong khi phí
// đã giảm còn 3.240.000đ và đã thu 3.000.000đ — đúng ra chỉ còn thiếu 240.000đ.
//
// Gọi ngay sau khi ghi một mốc phí mới (service_fees type='fee_plan') ở app/api/admin/clients.
// Trả về danh sách thay đổi để route ghi log / trả cho giao diện.
export async function recomputeRolloversFrom(supabase, clientId, fromYear, fromMonth) {
  const from = Number(fromYear) * 12 + Number(fromMonth)

  const [{ data: client }, { data: rolls }, { data: plans }, { data: paid }, { data: chg }] = await Promise.all([
    supabase.from('clients').select('id, monthly_fee, other_debt').eq('id', clientId).maybeSingle(),
    supabase.from('debt_rollovers').select('id, year, month, rolled_amount, remaining_amount')
      .eq('client_id', clientId).eq('source', 'ketoan'),
    supabase.from('service_fees').select('client_id, year, month, amount').eq('client_id', clientId).eq('type', 'fee_plan'),
    supabase.from('service_fees').select('year, month, amount').eq('client_id', clientId).eq('type', 'ketoan'),
    supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .eq('client_id', clientId).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])
  if (!client) return []

  const paidMap = new Map((paid || []).map(p => [p.year * 12 + p.month, Number(p.amount) || 0]))
  const changes = []
  let debtDelta = 0

  for (const r of (rolls || [])) {
    if (r.year * 12 + r.month < from) continue
    const feeNow = resolveFeeForMonth(plans || [], clientId, r.year, r.month, client.monthly_fee, chg || [])
    const collected = paidMap.get(r.year * 12 + r.month) || 0
    const shouldRemain = Math.max(0, feeNow - collected)
    const remain = Number(r.remaining_amount) || 0

    // CHỈ hạ xuống khi đang ghi nợ NHIỀU HƠN thực tế. Không tự nâng lên: ghi ít hơn thường là do
    // khoản nợ tồn đó đã được thu qua tab "Nợ tồn cũ" (tạo dòng type='no_ton', không tạo dòng
    // 'ketoan' cho tháng gốc) — nâng lại sẽ dựng dậy khoản nợ khách đã trả.
    if (remain - shouldRemain <= 1) continue

    await supabase.from('debt_rollovers')
      .update({ rolled_amount: shouldRemain, remaining_amount: shouldRemain }).eq('id', r.id)
    debtDelta += (shouldRemain - remain)
    changes.push({ year: r.year, month: r.month, from: remain, to: shouldRemain })
  }

  if (debtDelta !== 0) {
    const current = Number(client.other_debt) || 0
    await supabase.from('clients')
      .update({ other_debt: Math.max(0, current + debtDelta) }).eq('id', clientId)
  }
  return changes
}

// Phân bổ một khoản THU NỢ TỒN vào các dòng debt_rollovers đang còn dư, CŨ NHẤT TRƯỚC.
//
// Vì sao cần: save-old-debt chỉ trừ clients.other_debt mà KHÔNG trừ remaining_amount của tháng
// gốc, nên hai con số lệch dần sau mỗi lần thu. Bình thường không lộ ra, nhưng khi phí của tháng
// đó bị sửa (đổi phí lùi) thì recomputeRolloversFrom đọc phải remaining đã lỗi thời -> tính sai.
// Ca thật KING DƯỢC: other_debt về 0 trong khi dòng nợ tồn T7/2026 vẫn treo 5.640.000đ.
//
// Phần dư sau khi đã trừ hết các dòng rollover là BÌNH THƯỜNG, không phải lỗi: clients.other_debt
// còn gồm khoản "Thu khác — Tồn đọng" nhập tay lúc tạo công ty, vốn không có dòng rollover nào.
export async function applyOldDebtPayment(supabase, clientId, amount) {
  let left = Number(amount) || 0
  if (left <= 0) return { applied: [], leftover: 0 }

  const { data: rolls } = await supabase.from('debt_rollovers')
    .select('id, year, month, remaining_amount')
    .eq('client_id', clientId).gt('remaining_amount', 0)
    .order('year', { ascending: true }).order('month', { ascending: true })

  const applied = []
  for (const r of (rolls || [])) {
    if (left <= 0) break
    const remain = Number(r.remaining_amount) || 0
    const take = Math.min(left, remain)
    if (take <= 0) continue
    const { error } = await supabase.from('debt_rollovers')
      .update({ remaining_amount: remain - take }).eq('id', r.id)
    if (error) continue
    applied.push({ year: r.year, month: r.month, from: remain, to: remain - take })
    left -= take
  }
  return { applied, leftover: left }
}

// ═══════════ KỲ ĐÃ CHUYỂN NỢ TỒN NHƯNG CÒN TRONG HẠN GHI VÀO KỲ (anh chốt 05/11/2026) ═══════════
//
// Hết tháng là phần chưa thu chuyển sang nợ tồn (isPastRolloverDeadline), nhưng tới hết ngày 10 tháng
// sau (+ N tháng gia hạn — chỉ phí kế toán) vẫn GHI THU VÀO KỲ được, để %-công nợ của kỳ vẫn tính đủ.
// Một khoản tiền trong khoảng đó nằm ở HAI nơi (ô của kỳ + dòng chốt nợ tồn), nên mọi chỗ ghi thu PHẢI
// trừ dòng chốt cùng lúc:
//   · ghi vào ô của kỳ (save-debt, hcns/save-debt, Đối soát NH) → dieuChinhNoTonKy
//   · thu ở tab "Nợ tồn cũ" (save-old-debt, Đối soát NH dòng nợ tồn) → phanBoThuNoTon: trả KỲ CŨ NHẤT
//     trước — dòng chốt đã quá hạn, rồi nợ cũ nhập tay, CUỐI CÙNG mới tới kỳ còn trong hạn; phần rơi
//     vào kỳ còn trong hạn được GHI VÀO KỲ ĐÓ (ghiVaoKyTrongHan), không ghi 'no_ton'.
// Trừ dòng chốt của kỳ trong hạn thì trừ CẢ rolled_amount lẫn remaining_amount: dòng tiền
// (lib/dongTienPhong.js) suy điểm xuất phát = other_debt − Σ rolled + Σ thu nợ tồn — chỉ trừ remaining
// là khoản đó bị trừ hai lần (một lần ở điểm xuất phát, một lần ở ô đã thu của kỳ).

export const kyTrongHan = (year, month, now = new Date(), giaHanThang = 0) =>
  !isPastEditDeadline(Number(year), Number(month), now, 10, giaHanThang)

async function giaHanCua(supabase, clientId) {
  try {
    const { data, error } = await supabase.from('clients').select('gia_han_thu_thang').eq('id', clientId).maybeSingle()
    return error ? 0 : Number(data?.gia_han_thu_thang) || 0
  } catch { return 0 }
}
const giaHanNguon = (source, n) => ((source || 'ketoan') === 'hcns' ? 0 : n)   // gia hạn chỉ áp phí kế toán

// Số đã thu của ô kỳ thay đổi `delta` (thu thêm > 0, sửa bớt < 0) → điều chỉnh dòng chốt nợ tồn của kỳ
// đó (nếu có) và clients.other_debt cho khớp. source: 'ketoan' | 'hcns'. Trả số đã điều chỉnh.
export async function dieuChinhNoTonKy(supabase, clientId, year, month, source, delta) {
  const d0 = Math.round(Number(delta) || 0)
  if (!d0 || !clientId) return 0
  let q = supabase.from('debt_rollovers').select('id, rolled_amount, remaining_amount')
    .eq('client_id', clientId).eq('year', Number(year)).eq('month', Number(month))
  q = source === 'hcns' ? q.eq('source', 'hcns') : q.or('source.is.null,source.eq.ketoan')
  const { data: row } = await q.maybeSingle()
  if (!row) return 0
  const remain = Number(row.remaining_amount) || 0, rolled = Number(row.rolled_amount) || 0
  // Thu thêm: trừ tối đa phần còn treo. Sửa bớt: khoản đó lại thành chưa thu → cộng lại.
  const d = d0 > 0 ? Math.min(d0, remain) : d0
  if (!d) return 0
  const { data: c } = await supabase.from('clients').select('other_debt').eq('id', clientId).single()
  const [a, b] = await Promise.all([
    supabase.from('debt_rollovers').update({ rolled_amount: Math.max(0, rolled - d), remaining_amount: Math.max(0, remain - d) }).eq('id', row.id),
    supabase.from('clients').update({ other_debt: Math.max(0, (Number(c?.other_debt) || 0) - d) }).eq('id', clientId),
  ])
  if (a.error || b.error) throw new Error('Điều chỉnh nợ tồn T' + month + ': ' + (a.error || b.error).message)
  return d
}

// Dòng chốt nợ tồn của kỳ CÒN TRONG HẠN (còn treo tiền) — phần này chưa phải nợ tồn "thật".
export async function noTonTrongHan(supabase, clientId, now = new Date()) {
  const [{ data: rows }, n] = await Promise.all([
    supabase.from('debt_rollovers').select('id, year, month, source, rolled_amount, remaining_amount')
      .eq('client_id', clientId).gt('remaining_amount', 0),
    giaHanCua(supabase, clientId),
  ])
  return (rows || []).filter(r => kyTrongHan(r.year, r.month, now, giaHanNguon(r.source, n)))
}
// Nợ tồn THẬT = other_debt trừ phần của kỳ còn trong hạn. Dùng cho các luật "công ty còn nợ tồn thì…"
// (trả gộp nhiều kỳ, gợi ý trả gộp) — không thì 10 ngày đầu tháng công ty nào cũng "còn nợ tồn".
export async function noTonThat(supabase, clientId, otherDebt, now = new Date()) {
  const rows = await noTonTrongHan(supabase, clientId, now)
  return Math.max(0, (Number(otherDebt) || 0) - rows.reduce((a, r) => a + (Number(r.remaining_amount) || 0), 0))
}

// Phân bổ một khoản THU NỢ TỒN `amount`. GỌI TRƯỚC KHI trừ clients.other_debt (đọc other_debt để biết
// phần nợ cũ nhập tay); người gọi tự trừ other_debt đúng `amount`.
//   1. dòng chốt ĐÃ QUÁ HẠN, cũ nhất trước — trừ remaining (rolled giữ nguyên: đây là tiền thu nợ tồn)
//   2. nợ cũ nhập tay (other_debt − Σ remaining mọi dòng) — không có dòng chốt
//   3. dòng chốt CÒN TRONG HẠN, cũ nhất trước — trừ CẢ rolled lẫn remaining, trả trong `trongHan` để
//      người gọi GHI VÀO KỲ ĐÓ (ghiVaoKyTrongHan) thay vì 'no_ton'.
// Trả { applied, trongHan: [{year, month, source, amount}], noTon } — noTon = phần ghi dòng 'no_ton'.
export async function phanBoThuNoTon(supabase, clientId, amount, now = new Date()) {
  let left = Math.round(Number(amount) || 0)
  const out = { applied: [], trongHan: [], noTon: 0 }
  if (left <= 0) return out
  const [{ data: rows }, { data: c }, n] = await Promise.all([
    supabase.from('debt_rollovers').select('id, year, month, source, rolled_amount, remaining_amount')
      .eq('client_id', clientId).gt('remaining_amount', 0).order('year').order('month').order('id'),
    supabase.from('clients').select('other_debt').eq('id', clientId).single(),
    giaHanCua(supabase, clientId),
  ])
  // Cũ nhất trước; cùng kỳ thì phí KẾ TOÁN trước rồi mới tới HCNS (không theo id ngẫu nhiên).
  const tatCa = (rows || []).slice().sort((x, y) => (x.year * 12 + x.month) - (y.year * 12 + y.month)
    || ((x.source || 'ketoan') === 'hcns') - ((y.source || 'ketoan') === 'hcns'))
  const quaHan = tatCa.filter(r => !kyTrongHan(r.year, r.month, now, giaHanNguon(r.source, n)))
  const conHan = tatCa.filter(r => kyTrongHan(r.year, r.month, now, giaHanNguon(r.source, n)))
  const nhapTay = Math.max(0, (Number(c?.other_debt) || 0) - tatCa.reduce((a, r) => a + (Number(r.remaining_amount) || 0), 0))

  for (const r of quaHan) {
    if (left <= 0) break
    const remain = Number(r.remaining_amount) || 0
    const take = Math.min(left, remain)
    const { error } = await supabase.from('debt_rollovers').update({ remaining_amount: remain - take }).eq('id', r.id)
    if (error) continue
    out.applied.push({ year: r.year, month: r.month, source: r.source || 'ketoan', from: remain, to: remain - take })
    out.noTon += take; left -= take
  }
  const tay = Math.min(left, nhapTay)
  out.noTon += tay; left -= tay
  for (const r of conHan) {
    if (left <= 0) break
    const remain = Number(r.remaining_amount) || 0, rolled = Number(r.rolled_amount) || 0
    const take = Math.min(left, remain)
    const { error } = await supabase.from('debt_rollovers')
      .update({ rolled_amount: Math.max(0, rolled - take), remaining_amount: remain - take }).eq('id', r.id)
    if (error) continue
    out.applied.push({ year: r.year, month: r.month, source: r.source || 'ketoan', from: remain, to: remain - take, vaoKy: true })
    out.trongHan.push({ year: r.year, month: r.month, source: r.source || 'ketoan', amount: take })
    left -= take
  }
  out.noTon += left   // còn dư (dữ liệu lệch) → vẫn là tiền thu nợ tồn như trước
  return out
}

// Ghi phần thu rơi vào kỳ còn trong hạn VÀO KỲ ĐÓ (cộng thêm vào số đã thu của kỳ).
export async function ghiVaoKyTrongHan(supabase, clientId, ds, note, staffId) {
  for (const x of ds || []) {
    const ghiChu = (prev) => [prev?.note, note].filter(Boolean).join(' · ') || null
    if (x.source === 'hcns') {
      const { data: hc } = await supabase.from('hcns_clients').select('id')
        .eq('linked_client_id', clientId).eq('category', 'thoi_ky').maybeSingle()
      if (!hc) throw new Error('Không thấy hồ sơ HCNS để ghi kỳ T' + x.month)
      const { data: prev } = await supabase.from('hcns_service_fees').select('amount, note')
        .eq('hcns_client_id', hc.id).eq('year', x.year).eq('month', x.month).eq('type', 'hcns').maybeSingle()
      const { error } = await supabase.from('hcns_service_fees').upsert({
        hcns_client_id: hc.id, year: x.year, month: x.month, type: 'hcns', amount: (Number(prev?.amount) || 0) + x.amount,
        note: ghiChu(prev), created_by: staffId || null, created_at: new Date().toISOString(),
      }, { onConflict: 'hcns_client_id,year,month,type' })
      if (error) throw new Error('Ghi phí HCNS T' + x.month + ': ' + error.message)
    } else {
      const { data: prev } = await supabase.from('service_fees').select('amount, note')
        .eq('client_id', clientId).eq('year', x.year).eq('month', x.month).eq('type', 'ketoan').maybeSingle()
      const { error } = await supabase.from('service_fees').upsert({
        client_id: clientId, year: x.year, month: x.month, type: 'ketoan', amount: (Number(prev?.amount) || 0) + x.amount,
        note: ghiChu(prev), created_by: staffId || null, created_at: new Date().toISOString(),
      }, { onConflict: 'client_id,year,month,type' })
      if (error) throw new Error('Ghi phí kế toán T' + x.month + ': ' + error.message)
    }
  }
}
