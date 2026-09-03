import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { feeCountsForMonth, resolveFeeForMonth } from '@/lib/feeDue'
import { HCNS_STATUSES as STATUSES, HCNS_STATUS_LABEL as STATUS_LABEL } from '@/lib/hcnsStatus'
import { getHcnsTeam } from '@/lib/hcnsTeam'

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
  if (!seeAll && auth.caller?.role !== 'admin') {
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
      supabase.from('hcns_service_template_tasks').select('id').eq('template_id', tpl.id).eq('is_active', true),
      supabase.from('hcns_recurring_tasks').select('hcns_client_id, template_task_id, year, month, done')
        .in('hcns_client_id', tkIds).eq('year', year),
    ])
    tplTaskIds = (tplTasks || []).map(t => t.id)
    for (const r of (recs || [])) {
      if (!r.done) continue
      const k = r.hcns_client_id + '_' + r.year + '_' + r.month
      recDone.set(k, (recDone.get(k) || 0) + 1)
    }
  }
  const taskTotal = tplTaskIds.length

  const perClient = thoiKy.map(c => {
    let dueFee = 0, collected = 0
    for (const m of months) {
      if (!feeCountsForMonth(c.fee_period, year, m, now)) continue
      dueFee += resolveFeeForMonth(planRows, c.id, year, m, c.hcns_fee, [])
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
      byStaff[c.assigned_to].cost += (svcByClient.get(c.id) || []).reduce((a, s) => a + (Number(s.cost) || 0), 0)
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
    return {
      caseCount: list.filter(c => (svcByClient.get(c.id) || []).length > 0 || !svcInPeriod.length).length || list.length,
      serviceCount: svcs.length,
      totalCost: svcs.reduce((a, s) => a + (Number(s.cost) || 0), 0),
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

async function hasPerm(supabase, caller, permKey) {
  if (!caller?.staffId) return false
  if (caller.role === 'admin') return true
  const { data: roleRow } = await supabase.from('roles').select('is_system').eq('id', caller.role).maybeSingle()
  if (roleRow?.is_system) return true
  const { data } = await supabase.from('role_permissions').select('permission_key')
    .eq('role_id', caller.role).eq('permission_key', permKey).maybeSingle()
  return !!data
}
