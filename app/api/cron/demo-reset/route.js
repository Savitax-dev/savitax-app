// Cron 2h sáng giờ VN (vercel.json nhánh demo): làm mới toàn bộ dữ liệu bản demo — lib/demo/datLai.js.
// Chỉ chạy ở bản demo (chốt trong datLaiDemo), và chỉ với CRON_SECRET (Vercel cron tự gửi header này).
import { createClient } from '@supabase/supabase-js'
import { datLaiDemo } from '@/lib/demo/datLai'
import { xoaBoNhoQuyen } from '@/lib/quyenCache'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== '1') return Response.json({ error: 'Không phải bản demo' }, { status: 403 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const nhatKy = []
  try {
    const kq = await datLaiDemo({ admin, log: s => nhatKy.push(s) })
    xoaBoNhoQuyen()   // quyền nhớ tạm trên máy chủ — dữ liệu vừa thay hết
    return Response.json({ ...kq, nhatKy })
  } catch (e) {
    return Response.json({ error: e?.message || String(e), nhatKy }, { status: 500 })
  }
}
