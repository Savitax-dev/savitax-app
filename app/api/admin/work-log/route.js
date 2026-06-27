import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

// Nhãn loại cập nhật công nợ (service_fees.type)
const DEBT_TYPE_LABEL = {
  ketoan:   'Thu phí dịch vụ kế toán',
  khach:    'Thu phí dịch vụ khác',
  no_ton:   'Thu nợ tồn cũ',
  fee_plan: 'Cập nhật mức phí',
}

// GET /api/admin/work-log?userId=xxx&year=2026&month=6&staffId=&clientId=&roomId=&type=
// Nhật ký làm việc — tổng hợp tự động 3 nguồn (task_records, service_fees,
// client_change_log), scope theo vai trò người xem. Chỉ đọc, không ghi.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId   = searchParams.get('userId')
  const year     = Number(searchParams.get('year')  || new Date().getFullYear())
  const month    = Number(searchParams.get('month') || new Date().getMonth() + 1)
  const fStaff   = searchParams.get('staffId')  || ''
  const fClient  = searchParams.get('clientId') || ''
  const fRoom    = searchParams.get('roomId')   || ''
  const fType    = searchParams.get('type')     || ''

  if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 })

  const supabase = getAdmin()

  // 1. Vai trò + phòng của người xem (tự tra, không tin client)
  const { data: viewer } = await supabase
    .from('staff').select('id, role, room_id').eq('id', userId).single()
  if (!viewer) return Response.json({ error: 'Viewer not found' }, { status: 404 })
  const role = viewer.role || 'staff'

  // 2. Toàn bộ staff (để map tên + tính scope)
  const { data: allStaff } = await supabase.from('staff').select('id, full_name, room_id')
  const staffById = {}
  for (const s of (allStaff || [])) staffById[s.id] = s

  // Tập chủ thể được phép xem
  let scopeStaffIds
  if (role === 'admin') {
    scopeStaffIds = (allStaff || []).map(s => s.id)
  } else if (role === 'leader' || role === 'manager') {
    scopeStaffIds = (allStaff || []).filter(s => s.room_id === viewer.room_id).map(s => s.id)
    if (!scopeStaffIds.includes(viewer.id)) scopeStaffIds.push(viewer.id)
  } else {
    scopeStaffIds = [viewer.id]
  }

  // 3. Khoảng thời gian của tháng đang chọn
  const start = new Date(year, month - 1, 1).toISOString()
  const end   = new Date(year, month, 1).toISOString()

  if (scopeStaffIds.length === 0) {
    return Response.json({ entries: [], staffOptions: [], clientOptions: [], roomOptions: [], role })
  }

  // 4. Truy vấn 3 nguồn song song (lọc actor ∈ scope + thời gian trong tháng)
  const [{ data: tasks }, { data: fees }, { data: changes }, { data: rooms }, { data: clients }, { data: taskDefs }] = await Promise.all([
    supabase.from('task_records')
      .select('id, client_id, task_def_id, done_by, done_at, note')
      .eq('is_done', true).gte('done_at', start).lt('done_at', end).in('done_by', scopeStaffIds),
    supabase.from('service_fees')
      .select('id, client_id, type, amount, note, created_by, created_at')
      .gte('created_at', start).lt('created_at', end).in('created_by', scopeStaffIds),
    supabase.from('client_change_log')
      .select('id, client_id, entity_label, field, old_value, new_value, action, changed_by, changed_at')
      .gte('changed_at', start).lt('changed_at', end).in('changed_by', scopeStaffIds),
    supabase.from('rooms').select('id, name'),
    supabase.from('clients').select('id, name, client_code'),
    supabase.from('task_definitions').select('id, name'),
  ])

  const roomById = {}
  for (const r of (rooms || [])) roomById[r.id] = r.name
  const clientById = {}
  for (const c of (clients || [])) clientById[c.id] = c
  const taskNameById = {}
  for (const t of (taskDefs || [])) taskNameById[t.id] = t.name

  const actorMeta = (id) => {
    const s = staffById[id]
    return {
      actorId:   id,
      actorName: s ? s.full_name : '(không rõ)',
      roomId:    s && s.room_id ? s.room_id : '',
      roomName:  s && s.room_id ? (roomById[s.room_id] || '') : '',
    }
  }
  const clientMeta = (id) => {
    const c = clientById[id]
    return { clientId: id, clientName: c ? c.name : '(không rõ)' }
  }

  // 5. Chuẩn hóa thành dòng nhật ký thống nhất
  const entries = []

  for (const t of (tasks || [])) {
    entries.push({
      id: 'task_' + t.id,
      type: 'task_done',
      happenedAt: t.done_at,
      ...actorMeta(t.done_by),
      ...clientMeta(t.client_id),
      title: 'Hoàn thành: ' + (taskNameById[t.task_def_id] || 'công việc'),
      detail: t.note || '',
    })
  }

  for (const f of (fees || [])) {
    entries.push({
      id: 'fee_' + f.id,
      type: 'debt_update',
      happenedAt: f.created_at,
      ...actorMeta(f.created_by),
      ...clientMeta(f.client_id),
      title: DEBT_TYPE_LABEL[f.type] || 'Cập nhật công nợ',
      detail: fmt(f.amount) + 'đ' + (f.note ? ' · ' + f.note : ''),
    })
  }

  for (const ch of (changes || [])) {
    const actionLabel = ch.action === 'create' ? 'Thêm' : ch.action === 'delete' ? 'Xóa' : 'Sửa'
    const what = [ch.entity_label, ch.field].filter(Boolean).join(' — ')
    let detail = ''
    if (ch.action === 'update') detail = (ch.old_value || '(trống)') + ' → ' + (ch.new_value || '(trống)')
    else if (ch.action === 'create') detail = ch.new_value || ''
    else if (ch.action === 'delete') detail = ch.old_value || ''
    entries.push({
      id: 'chg_' + ch.id,
      type: 'info_change',
      happenedAt: ch.changed_at,
      ...actorMeta(ch.changed_by),
      ...clientMeta(ch.client_id),
      title: actionLabel + ' thông tin: ' + (what || 'khách hàng'),
      detail,
    })
  }

  // 6. Áp filter tùy chọn
  let filtered = entries
  if (fStaff)  filtered = filtered.filter(e => e.actorId === fStaff)
  if (fClient) filtered = filtered.filter(e => e.clientId === fClient)
  if (fType)   filtered = filtered.filter(e => e.type === fType)
  if (fRoom) {
    filtered = filtered.filter(e => {
      const s = staffById[e.actorId]
      return s && s.room_id === fRoom
    })
  }

  // 7. Sort mới nhất trước
  filtered.sort((a, b) => new Date(b.happenedAt) - new Date(a.happenedAt))

  // 8. Option cho dropdown — scope theo vai trò
  const scopeSet = new Set(scopeStaffIds)
  const staffOptions = (allStaff || [])
    .filter(s => scopeSet.has(s.id))
    .map(s => ({ id: s.id, name: s.full_name, roomId: s.room_id || '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  const clientOptions = (clients || [])
    .map(c => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  const roomOptions = role === 'admin'
    ? (rooms || []).map(r => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    : []

  return Response.json({ entries: filtered, staffOptions, clientOptions, roomOptions, role })
}
