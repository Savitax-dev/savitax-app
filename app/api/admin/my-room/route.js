import { createClient } from '@supabase/supabase-js'
import { ensureRollovers } from '@/lib/debtRollover'
import { effectiveDeadlineDate } from '@/lib/deadline'
import { getPeriodMonths } from '@/lib/period'
import { countsForMonth } from '@/lib/contractDates'
import { dueFeeMonthsCount, resolveFeeForMonth } from '@/lib/feeDue'
import { requireLogin } from '@/lib/serverAuth'
import { tinhDongTienPhong } from '@/lib/dongTienPhong'
import { loadHcnsFees } from '@/lib/hcnsPhiCongTy'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/admin/my-room?userId=xxx&year=2026&month=6
// GET /api/admin/my-room?userId=xxx&year=2026&period=quarter&quarter=2 (chỉ tổng hợp công nợ, không có tasks)
// GET /api/admin/my-room?userId=xxx&year=2026&period=year
// Trả về room + clients + tasks của nhân viên đó.
// Bao gồm cả công ty mà nhân viên này là "phụ trách phụ" (client_secondary_staff) —
// chỉ để theo dõi/cập nhật công việc & công nợ, KHÔNG cộng doanh thu vào KPI cá nhân
// (doanh thu/công nợ vẫn tính cho nhân viên chính + phòng của nhân viên chính).
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId  = searchParams.get('userId')
  const year    = Number(searchParams.get('year')  || new Date().getFullYear())
  const period  = searchParams.get('period') || 'month'
  const month   = Number(searchParams.get('month')   || new Date().getMonth() + 1)
  const quarter = Number(searchParams.get('quarter')  || 1)
  const months  = getPeriodMonths(period, { month, quarter })

  if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 })

  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  // userId trong query PHẢI khớp người gọi thật (trừ admin) — tránh 1 nhân viên tự truyền
  // userId của người khác để xem trộm công việc/công nợ cá nhân của họ.
  if (auth.caller.role !== 'admin' && userId !== auth.caller.staffId) {
    return Response.json({ error: 'Không có quyền xem dữ liệu của nhân viên khác' }, { status: 403 })
  }

  const supabase = getAdmin()

  // Tìm staff record theo id HOẶC email (fallback) — đã embed sẵn thông tin phòng,
  // không cần truy vấn `rooms` riêng nữa (giảm 1 round-trip).
  let { data: staffRecord } = await supabase
    .from('staff').select('*, rooms(id, name, type)').eq('id', userId).single()

  if (!staffRecord || !staffRecord.room_id) {
    return Response.json({ error: 'Staff not found or no room assigned' }, { status: 404 })
  }

  const room = staffRecord.rooms || null

  // Công ty ĐÃ NGƯNG dịch vụ mà còn nợ: ra khỏi checklist + %-KPI nhưng nhân viên vẫn phải có chỗ
  // ghi thu (anh chốt 05/10/2026). Trả riêng `stoppedClients`, KHÔNG trộn vào `clients` để mọi con
  // số KPI bên dưới giữ nguyên. Lỗi ở đây không được làm hỏng trang.
  const loadStopped = async () => {
    try {
      const { data: st } = await supabase.from('clients')
        .select('id, name, tax_code, assigned_to, monthly_fee, other_debt, report_type, fee_period, status, client_code, contract_start, created_at')
        .eq('assigned_to', staffRecord.id).eq('status', 'inactive')
      if (!st?.length) return []
      const ids = st.map(c => c.id)
      // Chỉ chốt nợ tồn cho công ty ĐÃ BIẾT tháng ngưng — không biết mà chốt thì sinh nợ cho mọi
      // tháng từ lúc ngưng tới giờ.
      const now = new Date()
      if (period === 'month' && year === now.getFullYear() && month === now.getMonth() + 1) {
        try {
          const { data: se } = await supabase.from('clients').select('id, service_end').in('id', ids)
          const coMoc = (se || []).filter(r => r.service_end).map(r => r.id)
          if (coMoc.length) {
            await ensureRollovers(supabase, coMoc, year, month)
            const { data: rf } = await supabase.from('clients').select('id, other_debt').in('id', coMoc)
            for (const r of rf || []) { const c = st.find(x => x.id === r.id); if (c) c.other_debt = r.other_debt }
          }
        } catch (_) { /* chưa chạy sql/25 */ }
      }
      const [{ data: plans }, { data: logs }] = await Promise.all([
        supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', ids).eq('type', 'fee_plan'),
        supabase.from('client_change_log').select('client_id, old_value, changed_at')
          .in('client_id', ids).eq('entity', 'monthly_fee').eq('action', 'update'),
      ])
      const dt = await tinhDongTienPhong(supabase, {
        clients: st, year, month: months[months.length - 1], feePlanRows: plans || [], changeLogRows: logs || [],
        // 4 kỳ gần nhất: phí chưa thu mà chưa kịp chốt sổ chỉ có thể nằm ở 1–2 kỳ cuối trước khi ngưng.
        lichSuTu: year * 12 + months[months.length - 1] - 4,
      })
      const no = new Map(dt.chuyenKySau.theoCty.map(x => [x.clientId, x]))
      return st.filter(c => no.has(c.id)).map(c => ({
        ...c, ngungDv: true, conNo: no.get(c.id).total, conNoKetoan: no.get(c.id).ketoan, conNoDvk: no.get(c.id).dvk,
        tasks: [], taskTotal: 0, taskDone: 0,
      }))
    } catch (e) {
      console.error('stoppedClients:', e?.message || e)
      return []
    }
  }
  const stoppedClients = await loadStopped()

  // KHỐI DÒNG TIỀN của riêng nhân viên này — cùng hàm, cùng cách hiển thị với trang Phòng (anh yêu
  // cầu 06/10/2026). Chỉ dựng khi xem theo THÁNG. Tính trên mọi công ty mình là nhân viên CHÍNH,
  // kể cả đã ngưng dịch vụ, y như trang Phòng — để cộng các nhân viên lại ra đúng số của phòng.
  const loadDongTien = async () => {
    // Tháng CHƯA TỚI không tính: xem "Năm 2026" vào tháng 10 thì T11, T12 chưa phát sinh phí.
    const vnNow = new Date(Date.now() + 7 * 3600 * 1000)
    const mocNay = vnNow.getUTCFullYear() * 12 + vnNow.getUTCMonth() + 1
    const dsThang = months.filter(m => year * 12 + m <= mocNay)
    if (!dsThang.length) return null
    const thangCuoi = dsThang[dsThang.length - 1]
    try {
      const { data: mine } = await supabase.from('clients')
        .select('id, name, tax_code, assigned_to, monthly_fee, other_debt, report_type, fee_period, status, client_code, contract_start, created_at')
        .eq('assigned_to', staffRecord.id)
      if (!mine?.length) return null
      const ids = mine.map(c => c.id)
      const active = mine.filter(c => (c.status || 'active') === 'active').map(c => c.id)
      // Mốc bắt đầu chạy số dư phải GIỐNG trang Phòng (kỳ chốt sổ sớm nhất của CẢ PHÒNG), không thì
      // cùng một công ty mà hai trang ra hai số.
      let lichSuTu = null
      const { data: nvPhong } = await supabase.from('staff').select('id').eq('room_id', staffRecord.room_id)
      const { data: ctyPhong } = await supabase.from('clients').select('id').in('assigned_to', (nvPhong || []).map(s => s.id))
      const idPhong = (ctyPhong || []).map(c => c.id)
      for (let i = 0; i < idPhong.length; i += 150) {
        const { data: r } = await supabase.from('debt_rollovers').select('year, month, source')
          .in('client_id', idPhong.slice(i, i + 150)).or('source.is.null,source.eq.ketoan')
          .order('year').order('month').limit(1)
        if (r?.[0]) lichSuTu = Math.min(lichSuTu ?? Infinity, r[0].year * 12 + r[0].month)
      }
      const [{ data: plans }, { data: logs }, hcns] = await Promise.all([
        active.length ? supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', active).eq('type', 'fee_plan') : { data: [] },
        active.length ? supabase.from('client_change_log').select('client_id, old_value, changed_at')
          .in('client_id', active).eq('entity', 'monthly_fee').eq('action', 'update') : { data: [] },
        loadHcnsFees(supabase, active, year, thangCuoi),
      ])
      const dt = await tinhDongTienPhong(supabase, {
        clients: mine, year, month: thangCuoi, months: dsThang, feePlanRows: plans || [], changeLogRows: logs || [],
        hcnsByClient: hcns.byClient || {},
        hcnsLichSu: { links: hcns.links || [], plans: hcns.plans || [], paid: hcns.paid || [] },
        lichSuTu,
      })
      return { ...dt, hcnsInstalled: !!hcns.installed, tuThang: dsThang[0], denThang: thangCuoi, thieuThang: dsThang.length < months.length }
    } catch (e) {
      console.error('my-room dongTien:', e?.message || e)
      return null
    }
  }
  const dongTien = await loadDongTien()

  // Chạy song song mọi truy vấn không phụ thuộc lẫn nhau trong CÙNG 1 lượt
  // (giảm round-trip tới Supabase — mỗi lượt chờ tốn ~300-800ms do khác vùng với Vercel)
  const [{ data: taskDefs }, { data: secondaryRows }, { data: primaryClients }] = await Promise.all([
    supabase.from('task_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('client_secondary_staff').select('client_id').eq('staff_id', staffRecord.id),
    supabase.from('clients')
      .select('id, name, tax_code, monthly_fee, other_debt, report_type, fee_period, status, client_code, contract_start, created_at')
      .eq('assigned_to', staffRecord.id).eq('status', 'active'),
  ])

  const secondaryClientIds = (secondaryRows || []).map(r => r.client_id)
  const { data: secondaryClients } = secondaryClientIds.length > 0
    ? await supabase.from('clients')
        .select('id, name, tax_code, monthly_fee, other_debt, report_type, fee_period, status, client_code, contract_start, created_at')
        .in('id', secondaryClientIds).eq('status', 'active')
    : { data: [] }

  const clients = [
    ...(primaryClients || []).map(c => ({ ...c, isSecondary: false })),
    ...(secondaryClients || []).map(c => ({ ...c, isSecondary: true })),
  ]

  const clientIds = clients.map(c => c.id)

  if (clientIds.length === 0) {
    return Response.json({
      staff: staffRecord,
      room,
      clients: [],
      stoppedClients,
      dongTien,
      taskPct: 100,
      debtPct: 0,
    })
  }

  // Tự động chuyển nợ thiếu của các tháng trước thành nợ tồn — chỉ khi đang xem đúng tháng hiện tại.
  const nowDt = new Date()
  if (period === 'month' && year === nowDt.getFullYear() && month === nowDt.getMonth() + 1) {
    await ensureRollovers(supabase, clientIds, year, month)
    const { data: refreshedDebt } = await supabase.from('clients').select('id, other_debt').in('id', clientIds)
    const refreshedMap = {}
    for (const r of (refreshedDebt || [])) refreshedMap[r.id] = r.other_debt
    for (const c of clients) if (refreshedMap[c.id] !== undefined) c.other_debt = refreshedMap[c.id]
  }

  const isMonthOnly = period === 'month'

  const [{ data: taskRecords }, { data: feeKetoan }, { data: feeKhach }, { data: feePlanRows }, { data: changeLogRows }] = await Promise.all([
    isMonthOnly
      ? supabase.from('task_records').select('id, client_id, task_def_id, is_done, done_at, note')
          .in('client_id', clientIds).eq('year', year).eq('month', month)
      : Promise.resolve({ data: [] }),
    supabase.from('service_fees').select('client_id, amount')
      .in('client_id', clientIds).eq('year', year).in('month', months).eq('type', 'ketoan'),
    supabase.from('service_fees').select('client_id, amount')
      .in('client_id', clientIds).eq('year', year).in('month', months).eq('type', 'khach'),
    // Lịch sử đổi phí — tra đúng phí tại kỳ đang xem thay vì monthly_fee sống (xem resolveFeeForMonth).
    supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', clientIds).eq('type', 'fee_plan'),
    supabase.from('client_change_log').select('client_id, old_value, changed_at')
      .in('client_id', clientIds).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])

  const taskRecMap = {}
  for (const r of (taskRecords || [])) taskRecMap[r.client_id + '_' + r.task_def_id] = r

  // Gộp (sum) vì kỳ quý/năm có thể có nhiều dòng (nhiều tháng) cho cùng 1 công ty
  const feeMap = {}
  for (const f of (feeKetoan || [])) feeMap[f.client_id] = (feeMap[f.client_id] || 0) + (Number(f.amount) || 0)
  const feeKhachMap = {}
  for (const f of (feeKhach || [])) feeKhachMap[f.client_id] = (feeKhachMap[f.client_id] || 0) + (Number(f.amount) || 0)

  // Tiền thu của HỒ SƠ "Dịch vụ khác" (sql/24) tính chung vào "đã thu khác" của kỳ. Bảng chưa tạo
  // thì bỏ qua im lặng để trang vẫn chạy.
  try {
    const { data: dvk } = await supabase.from('other_service_payments')
      .select('client_id, amount, month').in('client_id', clientIds).eq('year', year).in('month', months)
    for (const p of dvk || []) feeKhachMap[p.client_id] = (feeKhachMap[p.client_id] || 0) + (Number(p.amount) || 0)
  } catch (_) { /* chưa có bảng dịch vụ khác */ }

  // Giới hạn ngày hạn không vượt quá số ngày thực có của tháng + dời sang thứ 2 nếu rơi Chủ nhật
  const deadlineDate = (d) => effectiveDeadlineDate(year, month, d)
  const taskStatus = (rec, deadlineDay) => {
    if (!rec || !rec.is_done) {
      // Chỉ tính "Quá hạn" khi đã qua HẾT ngày hạn (từ 0h ngày kế tiếp)
      const deadlineEnd = new Date(deadlineDate(deadlineDay).getTime() + 86400000)
      return new Date() >= deadlineEnd ? 'overdue' : 'pending'
    }
    const late = Math.floor((new Date(rec.done_at) - deadlineDate(deadlineDay)) / 86400000)
    if (late <= 0) return 'done_ontime'
    if (late <= 2) return 'done_late1'
    return 'done_late3'
  }

  const getApplicableTasks = (client) => (taskDefs || []).filter(t => {
    if (t.is_active === false) return false
    if (t.month && Number(t.month) !== month) return false
    const taskType   = t.report_type || 'monthly'
    const clientType = client.report_type || 'monthly'
    return taskType === clientType
  })

  // Số tháng trong kỳ mà công ty đã bắt đầu hợp đồng (gate theo contract_start).
  // Công ty chưa tới mốc bắt đầu trong kỳ đang xem sẽ bị loại khỏi danh sách (không tính).
  const monthsActive = (c) => months.filter(m => countsForMonth(c, year, m)).length

  const clientsWithTasks = clients.filter(c => monthsActive(c) > 0).map(c => {
    const appTasks = isMonthOnly ? getApplicableTasks(c) : []
    const tasks = appTasks.map(t => {
      const rec    = taskRecMap[c.id + '_' + t.id] || null
      const status = taskStatus(rec, t.deadline_day)
      return { ...t, rec, status }
    })
    // Phí ĐÚNG tại kỳ đang xem (tháng cuối trong `months`) — không phải monthly_fee sống, tránh
    // đổi phí hôm nay làm sai lại công nợ của các tháng/kỳ quá khứ đang xem.
    const feeAtPeriod = resolveFeeForMonth(feePlanRows || [], c.id, year, months[months.length - 1], c.monthly_fee, changeLogRows || [])
    return {
      ...c,
      monthly_fee: feeAtPeriod,
      tasks,
      taskTotal:      tasks.length,
      taskDone:       tasks.filter(t => t.status.startsWith('done')).length,
      // Công ty quý: chỉ tính phí vào các kỳ (tháng cuối quý) đã đến hạn VÀ đã qua hạn khoan —
      // không nhân theo số tháng thô như công ty tháng (tránh nhân sai x3/x12 theo quý/năm).
      periodFee:      feeAtPeriod * dueFeeMonthsCount(c, year, months),
      // Kỳ này công ty có ĐẾN HẠN thu không. Phải chặn CẢ tử số lẫn mẫu số bằng cờ này: trước đây
      // mẫu số bỏ công ty quý chưa tới hạn nhưng tử số vẫn cộng tiền họ đã trả nên %-công nợ vọt
      // lên trên 100% (ca thật 01/10/2026: Nguyễn Thị Trung Anh T9/2026 ra 104%). Trang Phòng
      // (app/api/admin/room) chặn cả hai từ đầu — giữ hai nơi cùng một luật.
      feeCounted:     dueFeeMonthsCount(c, year, months) > 0,
      collected:      feeMap[c.id] || 0,
      collectedKhach: feeKhachMap[c.id] || 0,
    }
  })

  // KPI doanh thu/công nợ cá nhân: chỉ tính các công ty mình là nhân viên CHÍNH
  const ownedClients = clientsWithTasks.filter(c => !c.isSecondary)
  const totalTasks = clientsWithTasks.reduce((a, c) => a + c.tasks.length, 0)
  const doneTasks  = clientsWithTasks.reduce((a, c) => a + c.tasks.filter(t => t.status === 'done_ontime').length, 0)
  const dueClients = ownedClients.filter(c => c.feeCounted)
  const totalFee   = dueClients.reduce((a, c) => a + c.periodFee, 0)
  const totalCol   = dueClients.reduce((a, c) => a + c.collected, 0)

  return Response.json({
    staff:   staffRecord,
    room,
    clients: clientsWithTasks,
    stoppedClients,
    dongTien,
    // Không phụ trách công ty nào thì % công việc = 0%, không phải 100%.
    taskPct: isMonthOnly ? (clientsWithTasks.length === 0 ? 0 : (totalTasks === 0 ? 100 : Math.round(doneTasks / totalTasks * 100))) : null,
    debtPct: totalFee   === 0 ? (ownedClients.length > 0 ? 100 : 0) : Math.round(totalCol  / totalFee  * 100),
    totalTasks, doneTasks, totalFee, totalCol,
  })
}
