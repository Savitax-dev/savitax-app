import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { feeCountsForMonth, resolveFeeForMonth } from '@/lib/feeDue'
import { resolveHcnsFeeForMonth } from '@/lib/hcnsFee'
import { HCNS_STATUSES as STATUSES, HCNS_STATUS_LABEL as STATUS_LABEL } from '@/lib/hcnsStatus'
import { getHcnsTeam } from '@/lib/hcnsTeam'
import { effectiveDeadlineDate } from '@/lib/deadline'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/room?year=2026&month=8&mode=month|quarter|year
//
// Số liệu cho tag "Báo cáo phòng HCNS".
//
// CÔNG THỨC — bám đúng quy ước KPI của phòng nghiệp vụ (xem AGENTS.md), ĐỪNG đơn giản hoá:
//   %-công nợ  của 1 nhân viên = TỔNG đã thu / TỔNG phí phải thu, gộp HẾT công ty của họ
//                                (công ty phí lớn ảnh hưởng đúng theo tỉ trọng tiền)
//   %-công nợ  của phòng       = TRUNG BÌNH CỘNG % của từng nhân viên
//                                -> KHÁC với tổng thu/tổng phí toàn phòng, đừng nhầm
//   %-công việc của 1 nhân viên = trung bình cộng % của từng công ty
//   %-công việc của phòng      = trung bình cộng % của từng nhân viên
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = Number(searchParams.get('year')) || now.getFullYear()
  const month = Number(searchParams.get('month')) || (now.getMonth() + 1)
  const mode = searchParams.get('mode') || 'month'

  const months = mode === 'year' ? [1,2,3,4,5,6,7,8,9,10,11,12]
    : mode === 'quarter' ? [0,1,2].map(i => (Math.ceil(month / 3) - 1) * 3 + 1 + i)
    : [month]

  const supabase = getAdmin()

  // Người của phòng HCNS xác định theo QUYỀN, không theo staff.room_id — xem lib/hcnsTeam.js
  // (có người vừa là nhân viên kế toán vừa là trưởng phòng HCNS, room_id không diễn tả được).
  // Ai có view_hcns_all_staff thì thấy hết, còn lại chỉ thấy phần mình phụ trách.
  const seeAll = await hasPerm(supabase, auth.caller, 'view_hcns_all_staff')

  const [{ data: allClients }, team] = await Promise.all([
    supabase.from('hcns_clients').select('*').eq('is_active', true),
    getHcnsTeam(supabase),
  ])
  const hcnsRoom = team.room

  let clients = allClients || []
  let staff = team.staff
  const isAdmin = (auth.caller?.roles || [auth.caller?.role]).includes('admin')
  if (!seeAll && !isAdmin) {
    clients = clients.filter(c => c.assigned_to === auth.caller.staffId)
    staff = staff.filter(s => s.id === auth.caller.staffId)
  }

  const thoiKy = clients.filter(c => c.category === 'thoi_ky')
  const cases = clients.filter(c => c.category === 'thoi_diem' || c.category === 'vang_lai')

  // ── Khối "Thời kỳ": công nợ + checklist định kỳ ────────────────────────────
  const tkIds = thoiKy.map(c => c.id)
  const [{ data: fees }, { data: tpl }] = await Promise.all([
    tkIds.length
      ? supabase.from('hcns_service_fees').select('hcns_client_id, year, month, amount, type').in('hcns_client_id', tkIds)
      : Promise.resolve({ data: [] }),
    supabase.from('hcns_service_templates').select('id').eq('is_recurring', true).eq('is_active', true).maybeSingle(),
  ])
  const feeRows = fees || []
  const planRows = feeRows.filter(f => f.type === 'fee_plan').map(f => ({ ...f, client_id: f.hcns_client_id }))
  const paidMap = new Map()
  for (const f of feeRows) {
    if (f.type !== 'hcns') continue
    paidMap.set(f.hcns_client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)
  }

  let tplTaskIds = []
  let recDone = new Map()
  if (tpl?.id && tkIds.length) {
    const [{ data: tplTasks }, { data: recs }] = await Promise.all([
      supabase.from('hcns_service_template_tasks').select('id, deadline_day').eq('template_id', tpl.id).eq('is_active', true),
      supabase.from('hcns_recurring_tasks').select('hcns_client_id, template_task_id, year, month, done, done_at')
        .in('hcns_client_id', tkIds).eq('year', year),
    ])
    tplTaskIds = (tplTasks || []).map(t => t.id)
    const dayOf = new Map((tplTasks || []).map(t => [t.id, t.deadline_day || null]))
    // Chỉ đếm việc làm ĐÚNG HẠN — cùng công thức %-công việc của phòng kế toán (AGENTS.md).
    // Việc tích muộn vẫn giữ dấu tích trong hồ sơ nhưng không cộng vào KPI.
    for (const r of (recs || [])) {
      if (!r.done) continue
      const day = dayOf.get(r.template_task_id)
      if (day) {
        const deadline = effectiveDeadlineDate(r.year, r.month, day)
        if (r.done_at && new Date(r.done_at) > deadline) continue
      }
      const k = r.hcns_client_id + '_' + r.year + '_' + r.month
      recDone.set(k, (recDone.get(k) || 0) + 1)
    }
  }
  const taskTotal = tplTaskIds.length

  // ── Nợ tồn có nguồn HCNS ───────────────────────────────────────────────────
  // ĐỌC TỪ debt_rollovers source='hcns', KHÔNG đọc clients.other_debt: cột đó gộp chung nợ tồn
  // kế toán và HCNS (hiện có ~181 triệu nợ tồn kế toán), lấy nhầm là báo cáo HCNS hiện luôn nợ
  // của phòng kế toán. Xem lib/hcnsRollover.js.
  const linkedIds = thoiKy.map(c => c.linked_client_id).filter(Boolean)
  let hcnsOldDebt = 0
  let hcnsOldDebtClients = 0
  if (linkedIds.length) {
    const { data: rolls } = await supabase.from('debt_rollovers')
      .select('client_id, remaining_amount').in('client_id', linkedIds)
      .eq('source', 'hcns').gt('remaining_amount', 0)
    const perClientDebt = new Map()
    for (const r of rolls || []) {
      const v = Number(r.remaining_amount) || 0
      hcnsOldDebt += v
      perClientDebt.set(r.client_id, (perClientDebt.get(r.client_id) || 0) + v)
    }
    hcnsOldDebtClients = perClientDebt.size
  }

  const perClient = thoiKy.map(c => {
    let dueFee = 0, collected = 0
    for (const m of months) {
      if (!feeCountsForMonth(c.fee_period, year, m, now)) continue
      dueFee += resolveHcnsFeeForMonth(planRows, c.id, year, m, c.hcns_fee, c.created_at)
      collected += paidMap.get(c.id + '_' + year + '_' + m) || 0
    }
    // %-công việc lấy theo tháng đang xem (checklist là việc của từng tháng, không cộng dồn kỳ).
    const doneThisMonth = recDone.get(c.id + '_' + year + '_' + months[months.length - 1]) || 0
    return {
      id: c.id, name: c.name, client_code: c.client_code,
      assigned_to: c.assigned_to,
      fee_period: c.fee_period,
      dueFee, collected,
      remain: Math.max(0, dueFee - collected),
      debtPercent: dueFee > 0 ? Math.round(collected / dueFee * 100) : null,
      taskDone: doneThisMonth, taskTotal,
      taskPercent: taskTotal > 0 ? Math.round(doneThisMonth / taskTotal * 100) : null,
    }
  })

  // ── Khối "Thời điểm" / "Vãng lai" ──────────────────────────────────────────
  const caseIds = cases.map(c => c.id)
  const { data: services } = caseIds.length
    ? await supabase.from('hcns_case_services').select('*').in('hcns_client_id', caseIds)
    : { data: [] }

  const inPeriod = (s) => {
    if (!s.received_at) return true
    const d = new Date(s.received_at)
    return d.getFullYear() === year && months.includes(d.getMonth() + 1)
  }
  const svcInPeriod = (services || []).filter(inPeriod)
  const svcByClient = new Map()
  for (const s of svcInPeriod) {
    if (!svcByClient.has(s.hcns_client_id)) svcByClient.set(s.hcns_client_id, [])
    svcByClient.get(s.hcns_client_id).push(s)
  }

  // Checklist của hồ sơ Thời điểm/Vãng lai. Thiếu phần này thì nhân viên tích việc trên hồ sơ mà
  // báo cáo phòng không nhúc nhích — đúng lỗi đã gặp: chỉ %-công việc của Thời kỳ được tính.
  const svcIds = svcInPeriod.map(s => s.id)
  const caseTasks = svcIds.length
    ? await fetchAllRows(() => supabase.from('hcns_case_service_tasks')
        .select('case_service_id, done').in('case_service_id', svcIds).order('id'))
    : []
  const taskBySvc = new Map()
  for (const t of caseTasks) {
    const a = taskBySvc.get(t.case_service_id) || { done: 0, total: 0 }
    a.total += 1
    if (t.done) a.done += 1
    taskBySvc.set(t.case_service_id, a)
  }
  // % của 1 hồ sơ = gộp công việc của MỌI dịch vụ trong hồ sơ đó.
  const casePct = (c) => {
    let done = 0, total = 0
    for (const s of svcByClient.get(c.id) || []) {
      const a = taskBySvc.get(s.id)
      if (!a) continue
      done += a.done; total += a.total
    }
    return { done, total, percent: total > 0 ? Math.round(done / total * 100) : null }
  }

  // ── Tiền của hồ sơ Thời điểm / Vãng lai ────────────────────────────────────
  // Tính trên TOÀN BỘ dịch vụ của hồ sơ, KHÔNG lọc theo tháng đang chọn: tiền chưa thu không hết
  // hạn theo tháng. Lọc theo kỳ thì mở T8 sẽ không thấy khoản nợ của hồ sơ nhận trong T9 — đúng
  // thứ đang muốn tránh (hồ sơ xong việc rồi rơi vào vùng không ai nhìn).
  const { data: pays } = caseIds.length
    ? await supabase.from('hcns_case_payments').select('hcns_client_id, amount').in('hcns_client_id', caseIds)
    : { data: [] }
  const costAll = new Map()
  for (const sv of services || []) {
    costAll.set(sv.hcns_client_id, (costAll.get(sv.hcns_client_id) || 0) + (Number(sv.cost) || 0))
  }
  const paidAll = new Map()
  for (const p of pays || []) {
    paidAll.set(p.hcns_client_id, (paidAll.get(p.hcns_client_id) || 0) + (Number(p.amount) || 0))
  }
  // Hồ sơ xong HẾT dịch vụ — xét trên toàn bộ dịch vụ, khớp với cách chia thẻ ở hcns/clients.
  const allDoneOf = (c) => {
    const mine = (services || []).filter(sv => sv.hcns_client_id === c.id)
    return mine.length > 0 && mine.every(sv => sv.status === 'hoan_thanh')
  }
  const moneyOf = (c) => {
    const cost = costAll.get(c.id) || 0
    const paid = paidAll.get(c.id) || 0
    return { cost, paid, remain: Math.max(0, cost - paid) }
  }

  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const caseBlock = (cat) => {
    const list = cases.filter(c => c.category === cat)
    const svcs = list.flatMap(c => svcByClient.get(c.id) || [])
    const byStatus = STATUSES.map(st => ({
      status: st, label: STATUS_LABEL[st],
      count: svcs.filter(s => s.status === st).length,
    }))
    const byStaff = {}
    for (const c of list) {
      const n = (svcByClient.get(c.id) || []).length
      if (!byStaff[c.assigned_to]) {
        byStaff[c.assigned_to] = { staffId: c.assigned_to, cases: 0, services: 0, cost: 0, pcts: [] }
      }
      byStaff[c.assigned_to].cases += 1
      byStaff[c.assigned_to].services += n
      byStaff[c.assigned_to].cost += moneyOf(c).cost
      byStaff[c.assigned_to].remain = (byStaff[c.assigned_to].remain || 0) + moneyOf(c).remain
      const p = casePct(c).percent
      if (p !== null) byStaff[c.assigned_to].pcts.push(p)
    }
    // Đúng quy ước AGENTS.md: %-công việc = TB cộng % từng hồ sơ -> theo nhân viên -> theo phòng.
    const perStaffRows = Object.values(byStaff).map(({ pcts, ...x }) => ({
      ...x, staffName: staffName(staff, x.staffId), taskPercent: avg(pcts),
    }))
    const totals = list.reduce((a, c) => {
      const p = casePct(c)
      return { done: a.done + p.done, total: a.total + p.total }
    }, { done: 0, total: 0 })
    // Tiền: cộng phần CÒN LẠI của từng hồ sơ chứ không lấy (tổng chi phí - tổng đã thu). Một hồ sơ
    // thu dư sẽ che mất khoản nợ của hồ sơ khác nếu trừ gộp.
    const money = list.reduce((a, c) => {
      const m = moneyOf(c)
      return { cost: a.cost + m.cost, paid: a.paid + m.paid, remain: a.remain + m.remain }
    }, { cost: 0, paid: 0, remain: 0 })
    const unpaidCases = list.filter(c => moneyOf(c).remain > 0)
    // Hồ sơ xong việc mà chưa thu đủ — nhóm dễ bị bỏ quên nhất, vì xong việc là rời khỏi thẻ
    // Thời điểm/Vãng lai sang thẻ Hoàn thành, nơi trước đây không nói gì về tiền.
    const doneUnpaid = unpaidCases.filter(allDoneOf)

    return {
      caseCount: list.filter(c => (svcByClient.get(c.id) || []).length > 0 || !svcInPeriod.length).length || list.length,
      serviceCount: svcs.length,
      totalCost: money.cost,
      totalPaid: money.paid,
      remain: money.remain,
      paidPercent: money.cost > 0 ? Math.round(money.paid / money.cost * 100) : null,
      unpaidCount: unpaidCases.length,
      doneUnpaidCount: doneUnpaid.length,
      doneUnpaidRemain: doneUnpaid.reduce((a, c) => a + moneyOf(c).remain, 0),
      taskDone: totals.done, taskTotal: totals.total,
      taskPercent: avg(perStaffRows.map(r => r.taskPercent).filter(p => p !== null)),
      byStatus,
      byStaff: perStaffRows,
    }
  }

  // ── Gộp theo nhân viên + lên mức phòng ─────────────────────────────────────
  const staffIds = [...new Set([...thoiKy, ...cases].map(c => c.assigned_to).filter(Boolean))]
  const staffAll = staff.length ? staff : await fallbackStaff(supabase, staffIds)

  const perStaff = staffAll.map(s => {
    const mine = perClient.filter(c => c.assigned_to === s.id)
    const totalFee = mine.reduce((a, c) => a + c.dueFee, 0)
    const totalCollected = mine.reduce((a, c) => a + c.collected, 0)
    const taskPcts = mine.map(c => c.taskPercent).filter(p => p !== null)
    return {
      staffId: s.id, staffName: s.full_name,
      clientCount: mine.length,
      totalFee, totalCollected,
      // Gộp HẾT công ty rồi mới chia — không phải trung bình cộng % từng công ty.
      debtPercent: totalFee > 0 ? Math.round(totalCollected / totalFee * 100) : null,
      taskPercent: taskPcts.length ? Math.round(taskPcts.reduce((a, b) => a + b, 0) / taskPcts.length) : null,
    }
  })

  const roomDebtPercent = avg(perStaff.map(s => s.debtPercent).filter(p => p !== null))
  const roomTaskPercent = avg(perStaff.map(s => s.taskPercent).filter(p => p !== null))

  return Response.json({
    period: { year, month, mode, months },
    room: hcnsRoom || null,
    scope: seeAll || auth.caller?.role === 'admin' ? 'all' : 'own',
    thoiKy: {
      clientCount: thoiKy.length,
      totalFee: perClient.reduce((a, c) => a + c.dueFee, 0),
      totalCollected: perClient.reduce((a, c) => a + c.collected, 0),
      debtPercent: roomDebtPercent,
      taskPercent: roomTaskPercent,
      oldDebt: hcnsOldDebt,
      oldDebtClients: hcnsOldDebtClients,
      perStaff,
      perClient,
    },
    thoiDiem: caseBlock('thoi_diem'),
    vangLai: caseBlock('vang_lai'),
  })
}

// PostgREST cắt im lặng ở 1000 dòng — checklist hồ sơ sẽ vượt mốc này khi phòng chạy nhiều hồ sơ.
// Xem project_postgrest_1000row_limit: đúng lỗi đã làm hỏng số liệu KPI toàn công ty trước đây.
async function fetchAllRows(buildQuery, pageSize = 1000) {
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

function staffName(staff, id) {
  return staff.find(s => s.id === id)?.full_name || null
}

async function fallbackStaff(supabase, ids) {
  if (!ids.length) return []
  const { data } = await supabase.from('staff').select('id, full_name').in('id', ids)
  return data || []
}

// Xét TẤT CẢ vai trò (chính + kiêm nhiệm), không chỉ staff.role.
//
// Ca thật: chị Diệu là nhân viên kế toán phòng Himalaya (vai trò CHÍNH) kiêm trưởng phòng HCNS
// (vai trò KIÊM NHIỆM). Chỉ xét vai trò chính thì view_hcns_all_staff không tìm thấy -> báo cáo
// thu hẹp về "chỉ mình tôi", chị không thấy Minh và các bạn khác trong phòng.
async function hasPerm(supabase, caller, permKey) {
  if (!caller?.staffId) return false
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  if (roles.includes('admin')) return true
  const { data: roleRows } = await supabase.from('roles').select('is_system').in('id', roles)
  if ((roleRows || []).some(r => r.is_system)) return true
  const { data } = await supabase.from('role_permissions').select('permission_key')
    .in('role_id', roles).eq('permission_key', permKey).limit(1)
  return !!(data && data.length)
}
