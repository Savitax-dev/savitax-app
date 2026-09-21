// Chuyển các báo giá lập TRƯỚC quy định "mọi báo giá phải quản trị duyệt" (2026-09-21) sang Đã duyệt —
// người dùng chốt: báo giá cũ coi như đã duyệt, quy định mới chỉ áp cho báo giá lập từ đó.
//
//   node --env-file=.env.local scripts/approve-existing-sales-quotes.mjs           -- xem trước
//   node --env-file=.env.local scripts/approve-existing-sales-quotes.mjs --apply   -- ghi
//
// CHẠY TRƯỚC KHI DEPLOY code mới: code cũ coi 'ok' và 'approved' đều xuất được nên đổi trước không ảnh
// hưởng ai; deploy trước thì trong vài phút các báo giá cũ bị khoá xuất file. Chỉ đụng price_status='ok'
// (đúng biểu phí). Báo giá 'pending' (đề xuất giá chưa duyệt) giữ nguyên chờ duyệt.
import { createClient } from '@supabase/supabase-js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
const NOTE = 'Duyệt tự động: lập trước quy định mọi báo giá phải quản trị duyệt (21/09/2026)'

const { data: qs, error } = await s.from('sales_quotes')
  .select('id, quote_no, quote_date, company_name, monthly_final, price_status')
  .eq('is_deleted', false).eq('price_status', 'ok').order('quote_date')
if (error) { console.log('Lỗi đọc báo giá: ' + error.message); process.exit(1) }

console.log((apply ? 'GHI' : 'XEM TRƯỚC (thêm --apply để ghi)') + ' — ' + qs.length + ' báo giá đúng biểu phí sẽ chuyển sang Đã duyệt')
for (const q of qs) console.log('  ' + q.quote_no + '  ' + q.quote_date + '  ' + Number(q.monthly_final).toLocaleString('vi-VN') + 'đ  ' + (q.company_name || '').slice(0, 50))
// Không gọi process.exit() khi còn kết nối mở — Node trên Windows báo lỗi UV_HANDLE_CLOSING lúc thoát.
if (apply && qs.length) {

  const now = new Date().toISOString()
  const { error: e2 } = await s.from('sales_quotes')
    .update({ price_status: 'approved', reviewed_at: now, review_note: NOTE })
    .in('id', qs.map(q => q.id)).eq('price_status', 'ok')
  if (e2) { console.log('Lỗi ghi: ' + e2.message); process.exitCode = 1 }
  const { count } = await s.from('sales_quotes').select('id', { count: 'exact' }).eq('is_deleted', false).eq('price_status', 'ok').limit(1)
  console.log('Đã chuyển. Còn lại báo giá chờ duyệt (đúng biểu phí): ' + count)
}
