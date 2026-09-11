// Nạp các báo giá đã lập trên BẢN CHẠY THỬ (state.json) vào module Phòng Kinh doanh.
//
//   node scripts/import-sales-quotes.mjs [state.json] --dry            -- chỉ xem trước, không ghi
//   node scripts/import-sales-quotes.mjs [state.json] --apply          -- nạp tất cả
//   node scripts/import-sales-quotes.mjs [state.json] --apply --only 300801,300802
//
// Mặc định đọc app.baogia/02. APP DANG CHAY/state.json. Cần chạy sql/13_sales_module.sql trước.
//
// Giữ NGUYÊN số báo giá + ngày lập cũ (khách đã cầm số đó), phí lấy đúng ảnh chụp `fees` đã lưu
// (không tính lại theo biểu phí). Mỗi công ty sinh 1 khách tiềm năng (gộp theo MST đã chuẩn hoá),
// kênh để trống = "Chưa rõ kênh". Chạy lại nhiều lần an toàn: báo giá trùng (ngày, số thứ tự) bỏ qua.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { normalizeSurvey } from '../lib/salesPricing.js'

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--') && !/^\d/.test(a)) || 'app.baogia/02. APP DANG CHAY/state.json'
const apply = args.includes('--apply')
const onlyIdx = args.indexOf('--only')
const only = onlyIdx >= 0 ? new Set(String(args[onlyIdx + 1] || '').split(',').map(x => x.trim()).filter(Boolean)) : null

const normTax = t => String(t || '').replace(/\D/g, '').replace(/^0+/, '') || null
const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (!d) return null; if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2); return d }

const { error: schemaErr } = await s.from('sales_quotes').select('id').limit(1)
if (schemaErr) { console.log('✗ Chưa có bảng sales_quotes — chạy sql/13_sales_module.sql trước.\n  (' + schemaErr.message + ')'); process.exit(1) }

const { quotes } = JSON.parse(readFileSync(file, 'utf8'))
const list = quotes.filter(q => !only || only.has(String(q.no)))
console.log((apply ? 'NẠP DỮ LIỆU' : 'XEM TRƯỚC (không ghi gì — thêm --apply để nạp)') + ' — ' + list.length + ' báo giá\n')

const { data: staff } = await s.from('staff').select('id, full_name')
const staffByName = new Map((staff || []).map(x => [x.full_name.trim().toLowerCase(), x.id]))

let made = 0, skipped = 0
for (const q of list) {
  const no = String(q.no)
  const date = q.dateISO
  const seq = parseInt(no.slice(4), 10)
  const sv = normalizeSurvey(q.survey)
  const tag = no + '  ' + date + '  ' + (sv.company || '—').slice(0, 45)

  const { data: exist } = await s.from('sales_quotes').select('id').eq('quote_date', date).eq('seq', seq).limit(1)
  if (exist?.length) { console.log('  = đã có   ' + tag); skipped++; continue }

  const authorId = q.author ? (staffByName.get(q.author.trim().toLowerCase()) || null) : null
  const contract = ['draft', 'sent', 'signed'].includes(q.contractStatus) ? q.contractStatus : 'draft'
  const price = q.status === 'pending' ? 'pending' : 'ok'
  const stage = contract === 'signed' ? 'chot' : contract === 'sent' ? 'gui_hd' : 'bao_gia'
  console.log('  + ' + (apply ? 'nạp     ' : 'sẽ nạp  ') + tag + '  | ' + Number(q.monthlyFinal).toLocaleString('vi-VN') + 'đ/th | ' +
    price + ' | ' + contract + ' | người lập: ' + (q.author || '—') + (q.author && !authorId ? ' (không khớp nhân viên nào)' : ''))
  if (!apply) continue

  // Khách tiềm năng: gộp theo MST
  const tn = normTax(sv.mst)
  let leadId = null
  if (tn) {
    const { data: l } = await s.from('sales_leads').select('id').eq('tax_norm', tn).eq('is_deleted', false).limit(1)
    leadId = l?.[0]?.id || null
  }
  if (!leadId) {
    const { data: l, error } = await s.from('sales_leads').insert({
      company_name: sv.company || null, contact_name: sv.contact || null, phone: sv.phone || null, email: sv.email || null,
      tax_code: sv.mst || null, address: sv.address || null, phone_norm: normPhone(sv.phone), tax_norm: tn,
      need: 'ke_toan', channel_id: null, source_note: 'Nạp từ bản chạy thử module báo giá',
      assigned_to: authorId, stage, created_by: authorId,
      created_at: date + 'T09:00:00+07:00', stage_changed_at: date + 'T09:00:00+07:00',
    }).select('id').single()
    if (error) { console.log('    ✗ lỗi tạo khách: ' + error.message); continue }
    leadId = l.id
    await s.from('sales_lead_activities').insert({ lead_id: leadId, kind: 'he_thong', created_by: null,
      content: 'Nạp từ bản chạy thử module báo giá (kênh chưa rõ)', created_at: date + 'T09:00:00+07:00' })
  }

  const { error } = await s.from('sales_quotes').insert({
    lead_id: leadId, quote_date: date, seq, quote_no: no, author_id: authorId, author_name: q.author || null,
    company_name: sv.company || null, tax_code: sv.mst || null, survey: sv, fees: q.fees,
    standard_monthly: Number(q.standardMonthly) || 0, monthly_final: Number(q.monthlyFinal) || 0,
    override_on: !!q.override?.on, override_amount: q.override?.on ? Number(q.override.amount) || 0 : null,
    override_reason: q.override?.on ? (q.override.reason || null) : null,
    price_status: price, contract_status: contract, contract_changed_at: contract !== 'draft' ? date + 'T09:00:00+07:00' : null,
    created_at: date + 'T09:00:00+07:00',
  })
  if (error) { console.log('    ✗ lỗi nạp báo giá: ' + error.message); continue }
  made++
}
console.log('\n' + (apply ? 'Đã nạp ' + made : 'Sẽ nạp ' + (list.length - skipped)) + ' báo giá, bỏ qua ' + skipped + ' báo giá đã có.')
