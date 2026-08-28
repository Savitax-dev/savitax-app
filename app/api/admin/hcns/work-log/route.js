import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { HCNS_STATUS_LABEL } from '@/lib/hcnsStatus'
import { getHcnsTeam } from '@/lib/hcnsTeam'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

// GET /api/admin/hcns/work-log?year=&month=&staffId=&type=
//
// Nhật ký hoạt động phòng HCNS. KHÔNG có bảng log riêng — tổng hợp từ chính các bảng nghiệp vụ,
// vì mỗi bảng đã lưu sẵn "ai làm, lúc nào":
//   hcns_recurring_tasks         done_by/done_at     -> tích công việc định kỳ (khách thời kỳ)
//   hcns_case_service_tasks      done_by/done_at     -> tích công việc trong hồ sơ
//   hcns_case_service_status_log changed_by/changed_at -> đổi trạng thái dịch vụ
//   hcns_service_fees            created_by/created_at -> thu phí HCNS thời kỳ
//   hcns_case_payments           created_by/created_at -> thu tiền hồ sơ
// Cách này không phải nhớ ghi log ở từng chỗ nên không bao giờ sót, và sửa dữ liệu là nhật ký
// khớp theo ngay.
export async function GET(request) {
  const auth = await callerHasPermission('view_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = Number(searchParams.get('year')) || now.getFullYear()
  const month = Number(searchParams.get('month')) || (now.getMonth() + 1)
  const fStaff = searchParams.get('staffId') || ''
  const fType = searchParams.get('type') || ''

  const supabase = getAdmin()
  const from = new Date(year, month - 1, 1).toISOString()
  const to = new Date(year, month, 1).toISOString()

  // Ai không có view_hcns_all_staff thì chỉ xem được hoạt động của chính mình.
  const seeAll = await hasPerm(supabase, auth.caller, 'view_hcns_all_staff')
  const onlyMe = !seeAll && auth.caller?.role !== 'admin' ? auth.caller.staffId : null

  const [{ data: recTasks }, { data: caseTasks }, { data: statusLog }, { data: fees }, { data: pays },
         { data: tplTasks }, { data: hcnsClients }, { data: caseServices }, { data: templates }, team] = await Promise.all([
    supabase.from('hcns_recurring_tasks').select('hcns_client_id, template_task_id, year, month, done, done_by, done_at')
      .eq('done', true).gte('done_at', from).lt('done_at', to),
    supabase.from('hcns_case_service_tasks').select('case_service_id, template_task_id, done_by, done_at')
      .eq('done', true).gte('done_at', from).lt('done_at', to),
    supabase.from('hcns_case_service_status_log').select('case_service_id, status, changed_by, changed_at')
      .gte('changed_at', from).lt('changed_at', to),
    supabase.from('hcns_service_fees').select('hcns_client_id, year, month, amount, type, note, created_by, created_at')
      .gte('created_at', from).lt('created_at', to),
    supabase.from('hcns_case_payments').select('hcns_client_id, case_service_id, amount, note, created_by, created_at')
      .gte('created_at', from).lt('created_at', to),
    supabase.from('hcns_service_template_tasks').select('id, name'),
    supabase.from('hcns_clients').select('id, name, case_code, client_code, category'),
    supabase.from('hcns_case_services').select('id, hcns_client_id, template_id'),
    supabase.from('hcns_service_templates').select('id, name'),
    getHcnsTeam(supabase),
  ])

  const taskName = new Map((tplTasks || []).map(t => [t.id, t.name]))
  const clientById = new Map((hcnsClients || []).map(c => [c.id, c]))
  const svcById = new Map((caseServices || []).map(s => [s.id, s]))
  const tplName = new Map((templates || []).map(t => [t.id, t.name]))
  const staffName = new Map((team.staff || []).map(s => [s.id, s.full_name]))

  const label = (c) => c ? (c.name + (c.case_code ? ' (' + c.case_code + ')' : '')) : '—'
  const svcLabel = (id) => {
    const s = svcById.get(id)
    if (!s) return { client: '—', service: '—' }
    return { client: label(clientById.get(s.hcns_client_id)), service: tplName.get(s.template_id) || 'Dịch vụ' }
  }

  const rows = []

  for (const r of (recTasks || [])) {
    rows.push({
      at: r.done_at, staffId: r.done_by, type: 'task',
      client: label(clientById.get(r.hcns_client_id)),
      detail: 'Hoàn thành "' + (taskName.get(r.template_task_id) || 'công việc') + '" — kỳ T' + r.month + '/' + r.year,
    })
  }
  for (const r of (caseTasks || [])) {
    const s = svcLabel(r.case_service_id)
    rows.push({
      at: r.done_at, staffId: r.done_by, type: 'task', client: s.client,
      detail: 'Hoàn thành "' + (taskName.get(r.template_task_id) || 'công việc') + '" — ' + s.service,
    })
  }
  for (const r of (statusLog || [])) {
    const s = svcLabel(r.case_service_id)
    rows.push({
      at: r.changed_at, staffId: r.changed_by, type: 'status', client: s.client,
      detail: 'Chuyển "' + s.service + '" sang trạng thái ' + (HCNS_STATUS_LABEL[r.status] || r.status),
    })
  }
  for (const r of (fees || [])) {
    rows.push({
      at: r.created_at, staffId: r.created_by,
      type: r.type === 'fee_plan' ? 'fee' : 'debt',
      client: label(clientById.get(r.hcns_client_id)),
      detail: (r.type === 'fee_plan' ? 'Cập nhật mức phí HCNS ' : 'Ghi nhận thu phí HCNS ')
        + fmt(r.amount) + 'đ — kỳ T' + r.month + '/' + r.year + (r.note ? ' · ' + r.note : ''),
    })
  }
  for (const r of (pays || [])) {
    const s = r.case_service_id ? svcLabel(r.case_service_id) : null
    rows.push({
      at: r.created_at, staffId: r.created_by, type: 'debt',
      client: label(clientById.get(r.hcns_client_id)),
      detail: 'Thu ' + fmt(r.amount) + 'đ — ' + (s ? s.service : 'thu chung cả hồ sơ')
        + (r.note ? ' · ' + r.note : ''),
    })
  }

  let data = rows
    .filter(r => r.at)
    .filter(r => !onlyMe || r.staffId === onlyMe)
    .filter(r => !fStaff || r.staffId === fStaff)
    .filter(r => !fType || r.type === fType)
    .map(r => ({ ...r, staffName: staffName.get(r.staffId) || null }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))

  const counts = {
    task: data.filter(r => r.type === 'task').length,
    status: data.filter(r => r.type === 'status').length,
    debt: data.filter(r => r.type === 'debt').length,
    fee: data.filter(r => r.type === 'fee').length,
  }

  return Response.json({
    data, counts,
    scope: onlyMe ? 'own' : 'all',
    staff: (team.staff || []).map(s => ({ id: s.id, full_name: s.full_name })),
  })
}

async function hasPerm(supabase, caller, permKey) {
  if (!caller?.staffId) return false
  const roles = caller.roles?.length ? caller.roles : [caller.role]
  if (roles.includes('admin')) return true
  const { data: roleRows } = await supabase.from('roles').select('is_system').in('id', roles)
  if ((roleRows || []).some(r => r.is_system)) return true
  const { data } = await supabase.from('role_permissions').select('permission_key')
    .in('role_id', roles).eq('permission_key', permKey).limit(1)
  return !!(data && data.length)
}
