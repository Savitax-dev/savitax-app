// Xem các tin Zalo Bot đã ghi (bảng zalo_tin_nhan, sql/62) — bước thử đọc tin nhóm Zalo, CHỈ ĐỌC.
//   node --env-file=.env.local scripts/xem-tin-zalo.mjs            # 30 tin mới nhất
//   node --env-file=.env.local scripts/xem-tin-zalo.mjs 100 --tho  # 100 tin, in cả body gốc
import { createClient } from '@supabase/supabase-js'

const soTin = Number(process.argv.find(a => /^\d+$/.test(a)) || 30)
const tho = process.argv.includes('--tho')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await sb.from('zalo_tin_nhan').select('*').order('id', { ascending: false }).limit(soTin)
if (error) { console.error('Lỗi:', error.message, '— đã chạy sql/62_zalo_tin_nhan.sql chưa?'); process.exit(1) }
if (!data.length) { console.log('Chưa có tin nào.'); process.exit(0) }

const gio = t => (t ? new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—')
const nhom = new Map()
for (const d of data.reverse()) {
  console.log(`[${gio(d.gui_luc)}] ${d.chat_type || '?'} ${d.chat_id || ''} · ${d.nguoi_gui_ten || d.nguoi_gui_id || '?'} · ${d.event_name || ''}`)
  console.log('   ' + (d.noi_dung || '(không có chữ)').replace(/\n/g, '\n   '))
  if (tho) console.log('   ' + JSON.stringify(d.du_lieu))
  nhom.set(d.chat_id, (nhom.get(d.chat_id) || 0) + 1)
}
console.log(`\n${data.length} tin · ${nhom.size} cuộc trò chuyện:`, [...nhom].map(([k, n]) => `${k}=${n}`).join(', '))
