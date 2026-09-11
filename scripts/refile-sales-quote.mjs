// Nộp lại hồ sơ của MỘT báo giá lên Drive (file báo giá Word; thư mục tự tạo nếu chưa có).
// Dùng cho báo giá lưu TRƯỚC khi app tự nộp file báo giá lúc bấm Lưu (2026-09-11).
//
//   node --env-file=.env.local scripts/refile-sales-quote.mjs <số báo giá>   VD: 110903
//
// Chỉ nộp khi mức phí được phép gửi khách (đúng biểu phí hoặc Giám đốc đã duyệt).
import { createClient } from '@supabase/supabase-js'
import { fileOnSave } from '../lib/salesFiling.js'

const no = process.argv[2]
if (!no) { console.log('Thiếu số báo giá'); process.exit(1) }
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: rows } = await s.from('sales_quotes').select('*').eq('quote_no', no).eq('is_deleted', false)
  .order('quote_date', { ascending: false }).limit(1)
const q = rows?.[0]
if (!q) { console.log('Không tìm thấy báo giá ' + no); process.exit(1) }
console.log('Báo giá ' + q.quote_no + ' · ' + q.quote_date + ' · ' + q.company_name + ' · ' + q.price_status)
const r = await fileOnSave(s, q, null)
console.log(r.filed.length ? 'Đã nộp: ' + r.filed.join(', ') : 'Không nộp gì' + (r.warning ? ' — ' + r.warning : ' (mức phí chưa được duyệt)'))
if (r.folderUrl) console.log('Thư mục: ' + r.folderUrl)
