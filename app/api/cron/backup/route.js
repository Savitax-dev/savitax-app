import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const maxDuration = 60

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const BUCKET = 'db-backups'
const RETENTION_WEEKS = 8
// Lưu ý: 'fee_collections' được code (app/clients/page.js) tham chiếu nhưng KHÔNG tồn tại thật
// trong database (bảng chưa từng được migrate) — đã loại khỏi danh sách backup để tránh lỗi.
const TABLES = [
  'clients', 'staff', 'rooms', 'roles', 'permissions', 'role_permissions',
  'service_fees', 'task_definitions', 'task_records',
  'client_secondary_staff', 'client_change_log', 'client_credentials', 'debt_rollovers',
]

const pad2 = (n) => String(n).padStart(2, '0')
const dateStr = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())

const PAGE_SIZE = 1000

// PostgREST mặc định giới hạn tối đa 1000 dòng/truy vấn (db.max_rows) — .select('*') đơn lẻ sẽ
// âm thầm cắt bớt dữ liệu với bảng lớn hơn (vd task_definitions ~1250 dòng). Phải phân trang để
// lấy đủ toàn bộ, không phụ thuộc số dòng hiện tại của bảng.
async function fetchAllRows(supabase, table) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) return { table, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { table, data: rows, error: null }
}

// GET /api/cron/backup — chạy hàng tuần qua Vercel Cron (xem vercel.json), có thể gọi tay để
// test (kèm header Authorization: Bearer $CRON_SECRET). Đọc toàn bộ bảng nghiệp vụ, gộp thành
// 1 file JSON, lưu vào Supabase Storage (bucket "db-backups"), xoá bản backup quá 8 tuần, và
// gửi email tóm tắt qua Resend — để phục hồi thủ công nếu có sự cố (chưa có restore tự động).
export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (auth !== 'Bearer ' + process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdmin()
  const now = new Date()

  // 1. Đọc toàn bộ bảng song song (phân trang từng bảng để không bị cắt bớt dữ liệu)
  const results = await Promise.all(TABLES.map(t => fetchAllRows(supabase, t)))
  const failed = results.filter(r => r.error)
  if (failed.length > 0) {
    return Response.json({
      error: 'Đọc dữ liệu thất bại',
      details: failed.map(f => ({ table: f.table, message: f.error.message })),
    }, { status: 500 })
  }

  const tables = {}
  const rowCounts = {}
  for (const r of results) {
    tables[r.table] = r.data || []
    rowCounts[r.table] = (r.data || []).length
  }
  const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0)

  const backupPayload = { generated_at: now.toISOString(), tables }
  const jsonBuffer = Buffer.from(JSON.stringify(backupPayload), 'utf8')
  const fileName = 'backup-' + dateStr(now) + '.json'

  // 2. Upload lên Supabase Storage
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, jsonBuffer, {
    contentType: 'application/json',
    upsert: true,
  })
  if (uploadError) {
    return Response.json({ error: 'Upload backup thất bại: ' + uploadError.message }, { status: 500 })
  }

  // 3. Dọn backup cũ hơn RETENTION_WEEKS — lỗi ở bước này không coi là thất bại toàn bộ
  let deletedFiles = []
  let cleanupError = null
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
    const cutoff = new Date(now.getTime() - RETENTION_WEEKS * 7 * 86400000)
    const stale = (files || [])
      .filter(f => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
      .filter(f => new Date(f.name.slice(7, 17)) < cutoff)
      .map(f => f.name)
    if (stale.length > 0) {
      const { error } = await supabase.storage.from(BUCKET).remove(stale)
      if (error) cleanupError = error.message
      else deletedFiles = stale
    }
  } catch (e) {
    cleanupError = e.message
  }

  // 4. Gửi email tóm tắt qua Resend — lỗi ở bước này không coi là thất bại toàn bộ (file backup
  // đã lưu an toàn ở Storage dù email gửi thất bại)
  let emailError = null
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const rowsHtml = TABLES.map(t => '<li>' + t + ': ' + rowCounts[t] + ' dòng</li>').join('')
      await resend.emails.send({
        from: 'Savitax Backup <onboarding@resend.dev>',
        to: 'nghgan@gmail.com',
        subject: 'Backup Savitax — ' + dateStr(now) + ' (' + totalRows + ' dòng)',
        html: '<p>Backup tự động hàng tuần đã hoàn tất.</p><ul>' + rowsHtml + '</ul>' +
          '<p>File: ' + fileName + ' — lưu tại Supabase Storage (bucket "' + BUCKET + '").</p>',
        attachments: [{ filename: fileName, content: jsonBuffer }],
      })
    } catch (e) {
      emailError = e.message
    }
  } else {
    emailError = 'Chưa cấu hình RESEND_API_KEY — bỏ qua gửi email.'
  }

  return Response.json({
    ok: true,
    fileName,
    totalRows,
    rowCounts,
    deletedFiles,
    cleanupError,
    emailError,
  })
}
