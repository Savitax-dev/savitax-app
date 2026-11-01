// Chụp DANH MỤC CẤU HÌNH từ production → lib/demo/cauHinh.js (bản demo nạp lại mỗi đêm).
// CHỈ các bảng cấu hình sản phẩm (vai trò, quyền, checklist mẫu, mẫu dịch vụ HCNS, kênh bán hàng, danh mục tờ khai,
// ngày lễ, bậc hoa hồng) — KHÔNG một bảng nào chứa khách hàng / nhân viên / tiền.
//   node --env-file=<.env.local của app THẬT> scripts/demo/chup-cau-hinh.mjs
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const BANG = {
  roles: { select: 'id, label, is_system', order: 'id' },
  permissions: { select: '*', order: 'key' },
  role_permissions: { select: '*', order: 'role_id' },
  task_definitions: { select: 'id, name, description, deadline_day, sort_order, applies_to, report_type, is_active, month', order: 'id', loc: q => q.eq('is_active', true) },
  hcns_service_templates: { select: 'id, name, is_recurring, is_active, sort_order, group_name, note, sla_days', order: 'id', loc: q => q.eq('is_active', true) },
  hcns_service_template_tasks: { select: 'id, template_id, name, sort_order, is_active, deadline_day, requires_headcount', order: 'id', loc: q => q.eq('is_active', true) },
  sales_channels: { select: 'id, name, sort_order, is_active', order: 'id' },
  tax_filing_types: { select: 'id, code, name, tax_kind, period_kind, ma_tkhai_portal, sort_order, is_active', order: 'id' },
  tax_holidays: { select: 'id, day, note', order: 'id' },
  luong_ngay_le: { select: 'ngay, ten', order: 'ngay' },
  luong_hoa_hong_bac: { select: 'tu_so_cty, ty_le, tu_doanh_so', order: 'tu_so_cty' },
}
const out = {}
for (const [t, c] of Object.entries(BANG)) {
  const rows = []
  for (let tu = 0; ; tu += 1000) {
    let q = s.from(t).select(c.select).order(c.order)
    if (c.loc) q = c.loc(q)
    const { data, error } = await q.range(tu, tu + 999)
    if (error) throw new Error(t + ': ' + error.message)
    rows.push(...data)
    if (data.length < 1000) break
  }
  out[t] = rows
  console.log(t.padEnd(30), rows.length)
}
// mẫu HCNS: chỉ giữ việc của mẫu còn dùng
const tpl = new Set(out.hcns_service_templates.map(r => r.id))
out.hcns_service_template_tasks = out.hcns_service_template_tasks.filter(r => tpl.has(r.template_id))
fs.writeFileSync(process.argv[2] || 'lib/demo/cauHinh.js', '// DANH MỤC CẤU HÌNH chụp từ production bằng scripts/demo/chup-cau-hinh.mjs — không có dữ liệu khách hàng / nhân viên / tiền. Đừng sửa tay.' + String.fromCharCode(10) + 'const cauHinh = ' + JSON.stringify(out) + String.fromCharCode(10) + 'export default cauHinh' + String.fromCharCode(10))
