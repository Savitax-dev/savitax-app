// Phân quyền + tiện ích dùng chung cho các route /api/admin/sales/**.
//
// Luật (chốt 2026-09-11): nhân viên KD THẤY toàn bộ danh sách khách/báo giá (dùng chung, tránh 2
// người cùng tư vấn một khách) nhưng CHỈ SỬA được khách mình phụ trách / báo giá mình lập. Trưởng
// phòng (manage_sales_all) sửa tất cả. Duyệt giá chỉ người có approve_sales_quote (Giám đốc).
//
// Xét ĐỦ vai trò kiêm nhiệm (caller.roles) — so riêng caller.role từng làm trưởng phòng HCNS kiêm
// nhiệm bị coi như nhân viên thường (xem lib/debtScope.js).
import { createClient } from '@supabase/supabase-js'
import { getCallerRole } from './serverAuth'

export function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const SALES_PERMS = ['view_sales', 'manage_sales_all', 'approve_sales_quote']

// Trả { ok, status, error, caller, perms: { view, all, approve } } — ok khi có ít nhất view_sales.
export async function requireSales() {
  const caller = await getCallerRole()
  if (!caller.staffId) return { ok: false, status: 401, error: 'Chưa đăng nhập [' + caller.debug + ']' }
  const roles = caller.roles?.length ? caller.roles : [caller.role]
  const admin = getAdmin()

  let keys = new Set()
  if (roles.includes('admin')) keys = new Set(SALES_PERMS)
  else {
    const { data: roleRows } = await admin.from('roles').select('id, is_system').in('id', roles)
    if ((roleRows || []).some(r => r.is_system)) keys = new Set(SALES_PERMS)
    else {
      const { data: rp } = await admin.from('role_permissions').select('permission_key')
        .in('role_id', roles).in('permission_key', SALES_PERMS)
      keys = new Set((rp || []).map(r => r.permission_key))
    }
  }
  const perms = { view: keys.has('view_sales'), all: keys.has('manage_sales_all'), approve: keys.has('approve_sales_quote') }
  // Giám đốc duyệt giá thì phải xem được báo giá, kể cả khi chưa được cấp view_sales riêng.
  if (!perms.view && !perms.approve) return { ok: false, status: 403, error: 'Không có quyền vào Phòng Kinh doanh' }
  return { ok: true, caller, perms, admin }
}

// Người gọi được sửa khách tiềm năng này không (chưa ai phụ trách thì ai trong phòng cũng nhận được).
export function canEditLead(auth, lead) {
  if (!lead) return false
  if (auth.perms.all) return true
  if (!auth.perms.view) return false
  return !lead.assigned_to || lead.assigned_to === auth.caller.staffId
}

// Báo giá: người lập, người phụ trách khách của báo giá, hoặc trưởng phòng.
export function canEditQuote(auth, quote, lead) {
  if (!quote) return false
  if (auth.perms.all) return true
  if (!auth.perms.view) return false
  if (quote.author_id === auth.caller.staffId) return true
  return !!(lead && lead.assigned_to === auth.caller.staffId)
}

// Đọc HẾT các dòng — PostgREST cắt lặng lẽ ở 1000 dòng/lần (đã từng làm sai KPI toàn công ty).
// build(from, to) phải trả một query builder đã .range(from, to) và có .order() ổn định.
export async function fetchAll(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

// Nhân viên có thể nhận khách: đang làm việc VÀ (vai trò chính hoặc kiêm nhiệm có view_sales,
// hoặc thuộc phòng type='kinhdoanh'). Không kéo admin vào — Giám đốc không trực tiếp chăm sóc khách.
export async function loadSalesStaff(admin) {
  const [{ data: rp }, { data: rooms }] = await Promise.all([
    admin.from('role_permissions').select('role_id').eq('permission_key', 'view_sales'),
    admin.from('rooms').select('id').eq('type', 'kinhdoanh'),
  ])
  const roleIds = [...new Set((rp || []).map(r => r.role_id))]
  const roomIds = (rooms || []).map(r => r.id)
  let extraIds = []
  try {
    const { data: ex } = await admin.from('staff_extra_roles').select('staff_id, role, room_id')
    extraIds = (ex || []).filter(e => roleIds.includes(e.role) || roomIds.includes(e.room_id)).map(e => e.staff_id)
  } catch (_) { extraIds = [] }
  const { data: staff } = await admin.from('staff').select('id, full_name, role, room_id, is_active').eq('is_active', true).order('full_name')
  return (staff || [])
    .filter(s => roleIds.includes(s.role) || roomIds.includes(s.room_id) || extraIds.includes(s.id))
    .map(s => ({ id: s.id, full_name: s.full_name }))
}

// ── Chuẩn hoá để dò trùng ────────────────────────────────────────────────────
export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2)
  return d
}
// MST: chỉ giữ chữ số, BỎ SỐ 0 ĐẦU. File xuất hay thừa một số 0 ở MST hộ kinh doanh 12 số
// ("079202030307" vs "0079202030307") — so thẳng thì bỏ sót lặng lẽ, không báo lỗi gì.
export function normTax(t) {
  const d = String(t || '').replace(/\D/g, '').replace(/^0+/, '')
  return d || null
}

// ── Ngày giờ Việt Nam ───────────────────────────────────────────────────────
// Server Vercel chạy giờ UTC: báo giá lập lúc 6h sáng ở VN là 23h hôm trước theo UTC → nếu lấy
// ngày UTC thì số báo giá mang NGÀY HÔM QUA. Mọi "hôm nay" trong module lấy theo Asia/Ho_Chi_Minh.
export function todayVN(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Thứ tự giai đoạn — tự đẩy chỉ đi TIẾN. 'that_bai' đứng ngoài chuỗi.
export const STAGE_ORDER = ['moi', 'tu_van', 'bao_gia', 'gui_hd', 'chot']
export const STAGE_LABEL = {
  moi: 'Mới', tu_van: 'Đang tư vấn', bao_gia: 'Đã báo giá', gui_hd: 'Đã gửi HĐ', chot: 'Chốt HĐ', that_bai: 'Không thành',
}

// Tính lại giai đoạn khách theo trạng thái HĐ các báo giá còn lại — dùng khi một báo giá RỜI "Chốt HĐ"
// hoặc khách được kéo lại từ "Không thành" về "Đang chăm sóc". Đây là chỗ DUY NHẤT được hạ giai đoạn,
// và chỉ hạ khi chính người dùng vừa bấm đổi (không bao giờ tự hạ ngầm).
export async function recomputeLeadStage(admin, leadId, byStaffId, reason) {
  if (!leadId) return
  const [{ data: lead }, { data: qs }] = await Promise.all([
    admin.from('sales_leads').select('id, stage').eq('id', leadId).maybeSingle(),
    admin.from('sales_quotes').select('contract_status').eq('lead_id', leadId).eq('is_deleted', false),
  ])
  if (!lead) return
  const list = qs || []
  const target = list.some(q => q.contract_status === 'signed') ? 'chot'
    : list.some(q => q.contract_status === 'sent') ? 'gui_hd'
    : list.length ? 'bao_gia' : 'tu_van'
  if (target === lead.stage) return
  const now = new Date().toISOString()
  await admin.from('sales_leads').update({ stage: target, stage_changed_at: now, updated_at: now, lost_reason: null }).eq('id', leadId)
  await admin.from('sales_lead_activities').insert({
    lead_id: leadId, kind: 'he_thong', created_by: byStaffId || null,
    content: 'Giai đoạn: ' + STAGE_LABEL[lead.stage] + ' → ' + STAGE_LABEL[target] + (reason ? ' (' + reason + ')' : ''),
  })
}

// "Tình trạng chăm sóc" hiển thị ở danh sách báo giá — suy ra từ giai đoạn của khách, không lưu riêng.
export function careOf(stage) {
  if (stage === 'chot') return 'ky_hd'
  if (stage === 'that_bai') return 'that_bai'
  return 'cham_soc'
}

// Đẩy giai đoạn khách lên `target` nếu đang thấp hơn (khách "Không thành" mà ký HĐ thì cũng lên chốt).
// Ghi 1 dòng nhật ký hệ thống để biết vì sao giai đoạn đổi. Không bao giờ tự lùi.
export async function advanceLeadStage(admin, leadId, target, byStaffId, reason) {
  if (!leadId) return
  const { data: lead } = await admin.from('sales_leads').select('id, stage').eq('id', leadId).maybeSingle()
  if (!lead) return
  const cur = STAGE_ORDER.indexOf(lead.stage)
  const tgt = STAGE_ORDER.indexOf(target)
  const lost = lead.stage === 'that_bai'
  if (tgt < 0) return
  if (!lost && cur >= tgt) return
  if (lost && target !== 'chot') return
  const now = new Date().toISOString()
  await admin.from('sales_leads').update({
    stage: target, stage_changed_at: now, updated_at: now, ...(target === 'chot' ? { lost_reason: null } : {}),
  }).eq('id', leadId)
  await admin.from('sales_lead_activities').insert({
    lead_id: leadId, kind: 'he_thong', created_by: byStaffId || null,
    content: 'Giai đoạn: ' + STAGE_LABEL[lead.stage] + ' → ' + STAGE_LABEL[target] + (reason ? ' (' + reason + ')' : ''),
  })
}
