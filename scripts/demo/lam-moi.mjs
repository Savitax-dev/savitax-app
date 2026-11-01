// Làm mới dữ liệu bản demo NGAY (giống cron 2h sáng). Chỉ chạy được với .env.local của bản demo.
//   node --env-file=.env.local scripts/demo/lam-moi.mjs
import { createClient } from '@supabase/supabase-js'
import { datLaiDemo } from '../../lib/demo/datLai.js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const kq = await datLaiDemo({ admin, log: s => console.log('  ' + s) })
console.log('Xong sau', kq.giay, 'giây')
