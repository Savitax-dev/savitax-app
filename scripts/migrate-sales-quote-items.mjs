// Tách dòng phí cho các báo giá lập TRƯỚC khi có bảng khoản phí (sql/53, 2026-11-07).
//
//   node --env-file=.env.local scripts/migrate-sales-quote-items.mjs            -- xem trước
//   node --env-file=.env.local scripts/migrate-sales-quote-items.mjs --apply    -- ghi
//   node --env-file=.env.local scripts/migrate-sales-quote-items.mjs --quote 031103 [--apply]
//
// Lấy ảnh chụp phí đã lưu (`fees`) của từng báo giá dựng thành dòng: phí tháng → Hằng tháng,
// BCTC/quyết toán năm → Mỗi năm. KHÔNG lấy dịch vụ tùy chọn (khoản chào thêm, khách chưa đồng ý).
// Tổng phí tháng luôn khớp mức đã báo khách (monthly_final) — chênh dồn vào dòng kế toán trọn gói.
// Tháng thu = tháng lập báo giá. Báo giá ĐÃ có dòng phí thì BỎ QUA (không ghi đè việc nhân viên sửa).
//
// ⚠ Máy tự đoán theo biểu phí nên KHÔNG thay được người bán: ba ca RESINVA / Minh Trang / Gau Gau
// khách trả khác hẳn biểu phí, anh Lộc phải mở từng cái sửa lại cách thu cho đúng thực tế.
import { createClient } from '@supabase/supabase-js'
import { itemsFromFees, totalsFromItems, describeItem } from '../lib/salesItems.js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
const qi = process.argv.indexOf('--quote')
const oneNo = qi >= 0 ? process.argv[qi + 1] : null

let q = s.from('sales_quotes').select('id, quote_no, quote_date, company_name, monthly_final, fees')
  .eq('is_deleted', false).order('quote_date')
if (oneNo) q = q.eq('quote_no', oneNo)
const { data: quotes, error } = await q
if (error) { console.log('Lỗi đọc báo giá: ' + error.message); process.exit(1) }

const { data: had, error: e2 } = await s.from('sales_quote_items').select('quote_id')
if (e2) { console.log('Chưa có bảng sales_quote_items — chạy sql/53_sales_quote_items.sql trước.\n  (' + e2.message + ')'); process.exit(1) }
const daCo = new Set((had || []).map(r => r.quote_id))

console.log((apply ? 'GHI' : 'XEM TRƯỚC (thêm --apply để ghi)') + ' — ' + quotes.length + ' báo giá\n')
let lam = 0, boQua = 0
for (const qt of quotes) {
  if (daCo.has(qt.id)) { boQua++; continue }
  const items = itemsFromFees(qt.fees, { month: String(qt.quote_date).slice(0, 7), monthlyFinal: qt.monthly_final })
  const tt = totalsFromItems(items)
  const lech = tt.monthly !== (Number(qt.monthly_final) || 0)
  console.log('  ' + qt.quote_no + '  ' + qt.quote_date + '  ' + (qt.company_name || '').slice(0, 38))
  for (const it of items) console.log('      · ' + describeItem(it))
  console.log('      => tháng ' + tt.monthly.toLocaleString('vi-VN') + 'đ · một lần ' + tt.once.toLocaleString('vi-VN') +
    'đ · 12 tháng đầu ' + tt.year1.toLocaleString('vi-VN') + 'đ' +
    (lech ? '   ⚠ khác monthly_final đang lưu (' + Number(qt.monthly_final).toLocaleString('vi-VN') + 'đ) — báo giá có đề xuất giá riêng, kiểm lại' : ''))
  if (!apply) { lam++; continue }
  const { error: ei } = await s.from('sales_quote_items').insert(items.map(it => ({ ...it, quote_id: qt.id })))
  if (ei) { console.log('      ✗ lỗi ghi: ' + ei.message); continue }
  await s.from('sales_quotes').update({ fee_monthly: tt.monthly, fee_once: tt.once, fee_year1: tt.year1 }).eq('id', qt.id)
  lam++
}
console.log('\n' + (apply ? 'Đã tách dòng cho ' : 'Sẽ tách dòng cho ') + lam + ' báo giá; bỏ qua ' + boQua + ' báo giá đã có dòng phí.')
if (!apply) console.log('Nhớ: RESINVA, chị Minh Trang, Gau Gau phải sửa tay cho đúng tiền khách trả thật.')
