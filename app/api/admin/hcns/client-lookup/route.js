import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET /api/admin/hcns/client-lookup
// Danh sách công ty kế toán (chỉ thông tin nhận diện) để form "Thêm công ty" của Phòng HCNS chọn
// nhanh thay vì gõ lại. Trả hết rồi lọc ở trình duyệt — tìm không dấu ("thang long") thì ilike ở
// Postgres không khớp được tên có dấu.
export async function GET() {
  const auth = await callerHasPermission('manage_hcns')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('clients')
      .select('id, name, tax_code, client_code, address, representative, status')
      .neq('status', 'inactive').order('name').range(from, from + 999)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return Response.json({ data: out })
}
