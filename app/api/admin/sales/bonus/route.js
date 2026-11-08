// Báo cáo doanh số và thưởng cuối tháng của Phòng Kinh doanh (đề xuất 04/11/2026, "Sửa 4").
//
// Doanh số = tiền THỰC THU trong tháng (paid_month), CHƯA gồm VAT, chỉ khoản về Savitax.
// Thưởng = (doanh số − mốc) × tỷ lệ; chưa đạt mốc thì 0 đồng.
// Số luôn TÍNH LẠI ở server từ bảng lần thu — dòng đã lưu trong sales_bonus_reports chỉ là ảnh chụp
// lúc trình duyệt, dùng để biết sếp đã duyệt chưa và số có bị đổi sau khi duyệt không.
import { requireSales, loadSalesStaff, fetchAll } from '@/lib/salesScope'
import { revenueByStaff } from '@/lib/salesContract'
import { buildBonusReport, defaultSettings, nguongCua, tinhThuong, mucOf } from '@/lib/salesBonus'
import { monthVN } from '@/lib/salesItems'

const isMonth = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''))

// Ba bảng của sql/55 — chưa chạy thì chạy bằng giá trị mặc định, KHÔNG văng lỗi.
async function loadSettings(admin) {
  try {
    const { data, error } = await admin.from('sales_bonus_settings').select('*').eq('id', 1).maybeSingle()
    if (error) return null
    return data || defaultSettings()
  } catch (_) { return null }
}
async function loadLevels(admin) {
  try {
    const { data, error } = await admin.from('sales_staff_bonus').select('staff_id, level, nguong, note')
    if (error) return []
    return data || []
  } catch (_) { return [] }
}
async function loadSaved(admin, period) {
  try {
    const { data, error } = await admin.from('sales_bonus_reports').select('*').eq('period', period)
    if (error) return []
    return data || []
  } catch (_) { return [] }
}
async function loadPaid(admin, period) {
  try {
    const { error } = await admin.from('sales_contract_payments').select('id').limit(1)
    if (error) return []
    return await fetchAll((a, b) => admin.from('sales_contract_payments')
      .select('id, quote_id, due_month, paid_month, gross, vat_rate, net, staff_id')
      .eq('paid_month', period).order('id').range(a, b))
  } catch (_) { return [] }
}

async function duyetNames(admin, rows) {
  const ids = [...new Set(rows.map(r => r.nguoi_duyet).filter(Boolean))]
  if (!ids.length) return new Map()
  const { data } = await admin.from('staff').select('id, full_name').in('id', ids)
  return new Map((data || []).map(s => [s.id, s.full_name]))
}

// GET ?period=YYYY-MM — bảng doanh số + thưởng của tháng
export async function GET(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const p = new URL(request.url).searchParams.get('period')
  const period = isMonth(p) ? p : monthVN()

  const [settings, levels, saved, paid, staff] = await Promise.all([
    loadSettings(admin), loadLevels(admin), loadSaved(admin, period), loadPaid(admin, period), loadSalesStaff(admin),
  ])
  const ten = await duyetNames(admin, saved)

  const rep = buildBonusReport({
    period, staff,
    doanhSo: revenueByStaff(paid, period),
    levels: new Map(levels.map(l => [l.staff_id, l])),
    settings: settings || defaultSettings(),
    saved: new Map(saved.map(r => [r.staff_id, r])),
  })
  return Response.json({
    ...rep,
    ready: settings !== null,
    perms: auth.perms,
    levels,
    rows: rep.rows.map(r => ({ ...r, nguoi_duyet_ten: ten.get(r.nguoi_duyet) || null })),
    soLanThu: paid.length,
  })
}

// POST — "Làm báo cáo tháng": chụp lại số hiện tại và trình sếp duyệt
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (!auth.perms.all && !auth.perms.approve) return Response.json({ error: 'Chỉ trưởng phòng hoặc quản trị mới làm được báo cáo tháng' }, { status: 403 })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))
  const period = isMonth(b.period) ? b.period : monthVN()

  const [settings, levels, paid, staff] = await Promise.all([
    loadSettings(admin), loadLevels(admin), loadPaid(admin, period), loadSalesStaff(admin),
  ])
  if (settings === null) return Response.json({ error: 'Chưa cài bảng thưởng — chạy sql/55_sales_bonus.sql trước' }, { status: 400 })

  const s = { ...defaultSettings(), ...settings }
  const ds = revenueByStaff(paid, period)
  const lvMap = new Map(levels.map(l => [l.staff_id, l]))
  const now = new Date().toISOString()

  // Chỉ ghi người CÓ doanh số — người 0 đồng không có gì để duyệt, bảng vẫn hiện đủ phòng.
  const rows = staff.filter(nv => (ds.get(nv.id) || 0) > 0).map(nv => {
    const level = lvMap.get(nv.id) || { level: 'chinh_thuc', nguong: null }
    const doanhSo = ds.get(nv.id) || 0
    const nguong = nguongCua(level, s)
    const { vuot, thuong } = tinhThuong(doanhSo, nguong, s.ty_le)
    return {
      period, staff_id: nv.id, doanh_so: doanhSo, nguong, ty_le: Number(s.ty_le) || 0, vuot, thuong,
      level: mucOf(level.level).k, trang_thai: 'cho_duyet', nguoi_duyet: null, luc_duyet: null,
      chi_tiet: paid.filter(x => x.staff_id === nv.id).map(x => ({ quote_id: x.quote_id, due_month: x.due_month, gross: x.gross, vat_rate: x.vat_rate, net: x.net })),
      created_by: auth.caller.staffId, updated_at: now,
    }
  })
  if (!rows.length) return Response.json({ error: 'Tháng này chưa ghi lần thu nào — vào tab "Theo dõi hợp đồng" ghi tiền khách trả trước' }, { status: 400 })

  const { error } = await admin.from('sales_bonus_reports').upsert(rows, { onConflict: 'period,staff_id' })
  if (error) return Response.json({ error: 'Chưa lưu được báo cáo: ' + error.message }, { status: 500 })
  return Response.json({ ok: true, count: rows.length })
}

// PATCH — duyệt / trả lại / sửa cài đặt thưởng / đặt cấp nhân viên
export async function PATCH(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))
  const now = new Date().toISOString()

  if (b.action === 'settings' || b.action === 'level') {
    if (!auth.perms.approve) return Response.json({ error: 'Chỉ quản trị mới sửa được cài đặt thưởng' }, { status: 403 })
    if (b.action === 'settings') {
      const so = (v, mac) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : mac }
      const d = defaultSettings()
      const { error } = await admin.from('sales_bonus_settings').upsert({
        id: 1,
        nguong_thu_viec: so(b.nguong_thu_viec, d.nguong_thu_viec),
        nguong_chinh_thuc: so(b.nguong_chinh_thuc, d.nguong_chinh_thuc),
        ty_le: so(b.ty_le, d.ty_le),
        vat_rate: so(b.vat_rate, d.vat_rate),
        updated_by: auth.caller.staffId, updated_at: now,
      })
      if (error) return Response.json({ error: 'Chưa lưu được cài đặt: ' + error.message }, { status: 500 })
      return Response.json({ ok: true })
    }
    const level = b.level === 'thu_viec' ? 'thu_viec' : 'chinh_thuc'
    const nguong = b.nguong === '' || b.nguong == null ? null : Math.max(0, Math.round(Number(b.nguong) || 0))
    const { error } = await admin.from('sales_staff_bonus').upsert({
      staff_id: b.staff_id, level, nguong, note: String(b.note || '').trim() || null,
      updated_by: auth.caller.staffId, updated_at: now,
    })
    if (error) return Response.json({ error: 'Chưa lưu được cấp nhân viên: ' + error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (b.action === 'duyet' || b.action === 'tra_lai') {
    if (!auth.perms.approve) return Response.json({ error: 'Chỉ quản trị mới duyệt được báo cáo thưởng' }, { status: 403 })
    const period = isMonth(b.period) ? b.period : null
    if (!period) return Response.json({ error: 'Thiếu tháng báo cáo' }, { status: 400 })
    let q = admin.from('sales_bonus_reports').update({
      trang_thai: b.action === 'duyet' ? 'da_duyet' : 'tu_choi',
      nguoi_duyet: auth.caller.staffId, luc_duyet: now,
      ghi_chu: String(b.ghi_chu || '').trim() || null, updated_at: now,
    }).eq('period', period)
    if (b.staff_id) q = q.eq('staff_id', b.staff_id)
    const { error } = await q
    if (error) return Response.json({ error: 'Chưa đổi được trạng thái: ' + error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Thao tác không hợp lệ' }, { status: 400 })
}
