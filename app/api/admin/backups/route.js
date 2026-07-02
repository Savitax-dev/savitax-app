import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const BUCKET = 'db-backups'

// GET /api/admin/backups — liệt kê các bản backup đã lưu trong Supabase Storage
// (xem app/api/cron/backup/route.js), kèm link tải về (signed URL, hết hạn sau 10 phút).
export async function GET() {
  const supabase = getAdmin()
  const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
    sortBy: { column: 'name', order: 'desc' },
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const data = await Promise.all((files || []).map(async f => {
    // download: true -> Supabase gắn header Content-Disposition: attachment, buộc trình duyệt
    // tải file thay vì hiển thị JSON thô trên tab mới.
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(f.name, 600, { download: true })
    return {
      name: f.name,
      size: f.metadata?.size || 0,
      created_at: f.created_at,
      downloadUrl: signed?.signedUrl || null,
    }
  }))

  return Response.json({ data })
}
