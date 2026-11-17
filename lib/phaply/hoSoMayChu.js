// Phân hệ Pháp lý — đọc / ghi dùng chung cho các route app/api/admin/phaply/** (chỉ chạy ở máy chủ, service_role).
import { docHet } from './quyen.js'
import { hanNoiBo, homNayVN, maKeTiep, tienToMa } from './hoSo.js'
import { tongHopHoSo } from './tien.js'

export const COT_HO_SO = 'id, code, procedure_code, entity_type, entity_id, title, contact_name, contact_phone, contact_email, source, ' +
  'from_sales_quote_id, stage, wait_state, assigned_to, received_by, received_at, due_at, closed_at, closed_by, close_note, note, ' +
  'is_deleted, created_by, created_at, updated_at'

export async function ghiNhatKy(admin, caseId, kind, fromValue, toValue, by, note = null) {
  await admin.from('legal_case_stage_log').insert({
    case_id: caseId, kind, from_value: fromValue == null ? null : String(fromValue),
    to_value: toValue == null ? null : String(toValue), note, created_by: by,
  })
}

// Tên nhân viên theo id (một lượt đọc)
export async function tenNhanVien(admin) {
  const { data } = await admin.from('staff').select('id, full_name, role, room_id, is_active').order('full_name')
  return new Map((data || []).map(s => [s.id, s]))
}

// Nhân viên giao được hồ sơ: người thuộc phòng Pháp lý (chính hoặc kiêm nhiệm) + vai trò pháp lý, còn làm
export async function nhanVienPhapLy(admin) {
  const [{ data: phong }, { data: staff }, ex] = await Promise.all([
    admin.from('rooms').select('id').eq('type', 'phaply'),
    admin.from('staff').select('id, full_name, role, room_id, is_active').eq('is_active', true).order('full_name'),
    Promise.resolve(admin.from('staff_extra_roles').select('staff_id, room_id, role')).catch(() => ({ data: [] })),
  ])
  const ids = new Set((phong || []).map(r => r.id))
  const them = new Set((ex?.data || []).filter(e => ids.has(e.room_id) || /^phaply/.test(e.role || '')).map(e => e.staff_id))
  return (staff || []).filter(s => ids.has(s.room_id) || /^phaply/.test(s.role || '') || them.has(s.id))
    .map(s => ({ id: s.id, ten: s.full_name, truong_phong: s.role === 'phaply_leader' }))
}

// Sinh mã PL-YYMM-NN chưa dùng (thử lại khi hai người tạo cùng lúc đụng khoá duy nhất)
export async function maMoi(admin, homNay = homNayVN()) {
  const { data } = await admin.from('legal_cases').select('code').like('code', tienToMa(homNay) + '%')
  return maKeTiep((data || []).map(r => r.code), homNay)
}

// Mẫu việc + số ngày hạn của một thủ tục
export async function mauCuaThuTuc(admin, procedureCode) {
  const { data: tpl } = await admin.from('legal_task_templates').select('id, sla_days').eq('procedure_code', procedureCode).maybeSingle()
  if (!tpl) return { sla_days: null, items: [] }
  const { data: items } = await admin.from('legal_task_template_items').select('id, stage, title, sort')
    .eq('template_id', tpl.id).eq('is_active', true).order('stage').order('sort').order('id')
  return { sla_days: tpl.sla_days, items: items || [] }
}

export async function taoViecTuMau(admin, caseId, items) {
  if (!items.length) return
  await admin.from('legal_case_tasks').insert(items.map(it => ({
    case_id: caseId, template_item_id: it.id, stage: it.stage, title: it.title, sort: it.sort,
  })))
}

export const hanTuMau = (receivedAt, slaDays) => (slaDays ? hanNoiBo(receivedAt, slaDays) : null)

// Toàn bộ một hồ sơ để hiện trang chi tiết
export async function docHoSoDayDu(admin, id) {
  const { data: hs, error } = await admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!hs) return null
  const [ent, viec, ghiChu, nhatKy, phi, dot, thu] = await Promise.all([
    hs.entity_id ? admin.from('legal_entities').select('*').eq('id', hs.entity_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('legal_case_tasks').select('*').eq('case_id', id).order('stage').order('sort').order('id'),
    admin.from('legal_case_notes').select('*').eq('case_id', id).order('created_at', { ascending: false }).order('id'),
    admin.from('legal_case_stage_log').select('*').eq('case_id', id).order('created_at').order('id'),
    admin.from('legal_case_fees').select('*').eq('case_id', id).order('sort').order('id'),
    admin.from('legal_case_installments').select('*').eq('case_id', id).order('seq').order('id'),
    admin.from('legal_case_payments').select('*').eq('case_id', id).order('paid_at').order('id'),
  ])
  const payments = thu.data || []
  return {
    ho_so: hs, phap_nhan: ent.data || null, viec: viec.data || [], ghi_chu: ghiChu.data || [], nhat_ky: nhatKy.data || [],
    fees: phi.data || [], installments: dot.data || [], payments,
    tien: tongHopHoSo({ hoSo: hs, fees: phi.data || [], dots: dot.data || [], payments, nhatKy: nhatKy.data || [] }),
  }
}

// Tiền + việc của NHIỀU hồ sơ cho danh sách / báo cáo — đọc theo lô id, lật trang đủ
export async function docTienNhieuHoSo(admin, ids) {
  const ra = new Map(ids.map(id => [id, { fees: [], dots: [], payments: [], nhatKy: [], viec: [] }]))
  if (!ids.length) return ra
  for (let i = 0; i < ids.length; i += 200) {
    const lo = ids.slice(i, i + 200)
    const [phi, dot, thu, nk, viec] = await Promise.all([
      docHet((a, b) => admin.from('legal_case_fees').select('case_id, kind, amount').in('case_id', lo).order('id').range(a, b)),
      docHet((a, b) => admin.from('legal_case_installments').select('*').in('case_id', lo).order('id').range(a, b)),
      docHet((a, b) => admin.from('legal_case_payments').select('*').in('case_id', lo).is('deleted_at', null).order('id').range(a, b)),
      docHet((a, b) => admin.from('legal_case_stage_log').select('case_id, kind, to_value, created_at').in('case_id', lo).in('kind', ['stage', 'close']).order('id').range(a, b)),
      docHet((a, b) => admin.from('legal_case_tasks').select('case_id, stage, done_at').in('case_id', lo).order('id').range(a, b)),
    ])
    for (const r of phi) ra.get(r.case_id).fees.push(r)
    for (const r of dot) ra.get(r.case_id).dots.push(r)
    for (const r of thu) ra.get(r.case_id).payments.push(r)
    for (const r of nk) ra.get(r.case_id).nhatKy.push(r)
    for (const r of viec) ra.get(r.case_id).viec.push(r)
  }
  return ra
}
