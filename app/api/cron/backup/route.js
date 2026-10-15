import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const maxDuration = 60

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const BUCKET = 'db-backups'
const FILES_BUCKET = 'client-files'   // file đính kèm hồ sơ công ty — mất là không tạo lại được
const RETENTION_WEEKS = 8
// Lưu ý: 'fee_collections' được code (app/clients/page.js) tham chiếu nhưng KHÔNG tồn tại thật
// trong database (bảng chưa từng được migrate) — đã loại khỏi danh sách backup để tránh lỗi.
// KHÔNG liệt kê `client_change_log_readable` / `client_credentials_readable`: đó là VIEW đọc từ
// chính 2 bảng gốc bên dưới (xem sql/client_*_view.sql) — backup thêm chỉ nhân đôi dữ liệu.
const TABLES = [
  // Kế toán (lõi) — có ở MỌI bản, kể cả các bản clone
  'clients', 'staff', 'rooms', 'roles', 'permissions', 'role_permissions',
  'service_fees', 'task_definitions', 'task_records',
  'client_secondary_staff', 'client_change_log', 'client_credentials', 'debt_rollovers',
  'staff_extra_roles',   // kiêm nhiệm nhiều vai trò — thiếu là sai phân quyền khi khôi phục
  'room_kpi', 'staff_kpi', 'debt_records',   // bảng cũ, giữ lại cho đủ dữ liệu
  // HCNS — chỉ có ở bản Savitax (bản clone không cài, sẽ tự bỏ qua, xem MISSING_TABLE_CODES)
  'hcns_clients', 'hcns_service_fees', 'hcns_service_templates', 'hcns_service_template_tasks',
  'hcns_case_services', 'hcns_case_service_tasks', 'hcns_case_service_status_log',
  'hcns_case_payments', 'hcns_case_notes', 'hcns_case_note_reads', 'hcns_recurring_tasks',
  // Phòng Kinh doanh — cũng chỉ có ở bản Savitax
  'sales_leads', 'sales_quotes', 'sales_lead_activities', 'sales_channels',
  // Đối soát ngân hàng — giao dịch VPS đẩy lên + dấu vết đã ghi công nợ (post_detail)
  'bank_transactions', 'bank_action_logs',
  // Thêm 13/10/2026 — soát lại lúc chụp toàn bộ dữ liệu thì thấy các bảng dựng từ 05/10 trở đi và cả
  // phân hệ Tờ khai CHƯA có trong bản backup hằng tuần. Bảng nào thiếu (bản clone) sẽ tự bỏ qua.
  'other_services', 'other_service_payments', 'debt_writeoffs', 'kpi_violations', 'hcns_headcount',
  'tax_accounts', 'tax_filing_types', 'tax_filings', 'tax_notices', 'tax_obligations', 'tax_holidays',
  'tax_client_filings', 'tax_sync_jobs', 'tax_access_logs',
  // Thêm 15/10/2026 — dấu "TP đã kiểm tra" (sql/27) và bằng chứng mail báo cáo tự tick (sql/30).
  'checklist_reviews', 'mail_evidence',
  // Phân hệ Hóa đơn điện tử — anh gác lại 13/10/2026, bảng đã tạo nhưng chưa có dữ liệu. Liệt kê
  // sẵn để lúc mở lại khỏi quên; bản clone không có thì tự bỏ qua.
  'hoadon_tai_khoan', 'hoadon_dau_vao',
]

// VIEW, không phải bảng — đọc lại từ chính bảng gốc đã có ở trên, backup thêm chỉ nhân đôi dữ
// liệu. Phải liệt kê ở đây để bước TỰ KIỂM bên dưới không tưởng là bảng bị bỏ sót.
const VIEWS = ['client_change_log_readable', 'client_credentials_readable']

// TỰ KIỂM DANH SÁCH BẢNG — thêm 15/10/2026.
//
// Danh sách TABLES ở trên viết tay, nên tạo bảng mới mà quên thêm vào là backup IM LẶNG bỏ sót.
// Chuyện này đã xảy ra BA LẦN: 13/10 (cả loạt bảng từ 05/10 và toàn bộ phân hệ Tờ khai), rồi
// tax_access_logs, rồi 15/10 (checklist_reviews, mail_evidence). Lần nào cũng chỉ phát hiện nhờ
// có người ngồi soát tay.
//
// Nay mỗi lần chạy, hỏi thẳng PostgREST xem đang phục vụ những bảng nào. Bảng nào CHƯA có trong
// TABLES thì VẪN BACKUP LUÔN cho đủ, đồng thời CẢNH BÁO trong email để có người thêm vào danh sách
// một cách có chủ đích. Thà backup thừa một bảng còn hơn thiếu dữ liệu đúng lúc cần khôi phục.
// Hỏi không được thì chạy với TABLES như cũ và cũng cảnh báo — không vì bước này mà mất backup.
async function bangChuaLietKe() {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    })
    if (!res.ok) return { ds: [], loi: 'HTTP ' + res.status }
    const spec = await res.json()
    const tatCa = Object.keys(spec?.definitions || {})
    return { ds: tatCa.filter(t => !TABLES.includes(t) && !VIEWS.includes(t)).sort(), loi: null }
  } catch (e) {
    return { ds: [], loi: e.message }
  }
}

// Bảng không tồn tại (bản clone thiếu module HCNS/Kinh doanh) KHÔNG được làm hỏng cả bản backup
// — trước đây chỉ 1 bảng lỗi là route trả 500 và không lưu gì cả. Các mã này = "bảng/quan hệ
// không có trong schema" của PostgREST.
const MISSING_TABLE_CODES = ['42P01', 'PGRST205', 'PGRST202']
const isMissingTable = (err) =>
  MISSING_TABLE_CODES.includes(err?.code) ||
  /does not exist|could not find the table/i.test(err?.message || '')

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

  // 0. Tự kiểm: bảng nào có trong cơ sở dữ liệu mà chưa liệt kê -> backup luôn, và cảnh báo.
  const { ds: bangThem, loi: loiTuKiem } = await bangChuaLietKe()
  const canBackup = [...TABLES, ...bangThem]

  // 1. Đọc toàn bộ bảng song song (phân trang từng bảng để không bị cắt bớt dữ liệu)
  const results = await Promise.all(canBackup.map(t => fetchAllRows(supabase, t)))
  // Bảng KHÔNG TỒN TẠI -> bỏ qua và ghi vào tóm tắt (bản clone không cài HCNS/Kinh doanh).
  // Lỗi THẬT (mất quyền, sập DB...) vẫn phải dừng, không được lặng lẽ backup thiếu dữ liệu.
  const skippedTables = results.filter(r => r.error && isMissingTable(r.error)).map(r => r.table)
  const failed = results.filter(r => r.error && !isMissingTable(r.error))
  if (failed.length > 0) {
    return Response.json({
      error: 'Đọc dữ liệu thất bại',
      details: failed.map(f => ({ table: f.table, message: f.error.message })),
    }, { status: 500 })
  }

  const tables = {}
  const rowCounts = {}
  for (const r of results) {
    if (r.error) continue
    tables[r.table] = r.data || []
    rowCounts[r.table] = (r.data || []).length
  }
  const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0)

  // 1b. Danh sách tài khoản đăng nhập (Supabase Auth) — KHÔNG có mật khẩu (Supabase mã hoá một
  // chiều, không API nào xuất được). Khôi phục vẫn phải cho nhân viên đặt lại mật khẩu, nhưng ít
  // nhất biết ai từng có tài khoản và email nào để mời lại.
  let authUsers = []
  let authError = null
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (error) { authError = error.message; break }
      const batch = data?.users || []
      authUsers.push(...batch.map(u => ({
        id: u.id, email: u.email, phone: u.phone || null,
        created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null,
        email_confirmed_at: u.email_confirmed_at || null,
      })))
      if (batch.length < 200) break
    }
  } catch (e) {
    authError = e.message
  }

  // 1c. Danh sách file đính kèm của công ty (bucket client-files) — bản thân FILE được sao chép
  // ở bước 2b; đây là mục lục để đối chiếu đủ/thiếu khi khôi phục.
  const storageFiles = []
  let storageError = null
  try {
    const { data: folders, error } = await supabase.storage.from(FILES_BUCKET).list('', { limit: 1000 })
    if (error) throw error
    for (const f of (folders || [])) {
      if (f.id) { storageFiles.push({ path: f.name, size: f.metadata?.size || 0 }); continue }
      const { data: inner } = await supabase.storage.from(FILES_BUCKET).list(f.name, { limit: 1000 })
      for (const g of (inner || [])) {
        if (g.id) storageFiles.push({ path: f.name + '/' + g.name, size: g.metadata?.size || 0 })
      }
    }
  } catch (e) {
    storageError = e.message
  }

  const backupPayload = {
    generated_at: now.toISOString(),
    tables,
    auth_users: authUsers,
    client_files: storageFiles,
    skipped_tables: skippedTables,
    // Bảng tự bổ sung nhờ bước tự kiểm — có mặt trong `tables` ở trên nhưng chưa có trong danh
    // sách viết tay. Ghi lại để lúc khôi phục biết tuần đó danh sách đang lệch.
    tu_bo_sung: bangThem,
  }
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

  // 2b. SAO CHÉP file đính kèm sang thư mục backup của tuần này (files/<ngày>/...). Chỉ ghi mục
  // lục thôi thì mất file là mất luôn hồ sơ khách gửi, không tạo lại được. Lỗi ở bước này không
  // làm hỏng bản backup dữ liệu đã lưu ở trên — chỉ ghi vào tóm tắt để biết mà xử lý.
  let copiedFiles = 0
  let copyError = null
  const filePrefix = 'files/' + dateStr(now) + '/'
  try {
    for (const f of storageFiles) {
      const { data: blob, error: dlErr } = await supabase.storage.from(FILES_BUCKET).download(f.path)
      if (dlErr) { copyError = f.path + ': ' + dlErr.message; break }
      const buf = Buffer.from(await blob.arrayBuffer())
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(filePrefix + f.path, buf, { upsert: true })
      if (upErr) { copyError = f.path + ': ' + upErr.message; break }
      copiedFiles++
    }
  } catch (e) {
    copyError = e.message
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

    // Dọn luôn các thư mục file đính kèm quá hạn (files/<ngày>/...) — không dọn thì mỗi tuần
    // cộng thêm một bản sao toàn bộ file, dung lượng phình vô hạn.
    const { data: dateDirs } = await supabase.storage.from(BUCKET).list('files', { limit: 1000 })
    for (const d of (dateDirs || [])) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.name) || new Date(d.name) >= cutoff) continue
      const { data: subs } = await supabase.storage.from(BUCKET).list('files/' + d.name, { limit: 1000 })
      for (const s of (subs || [])) {
        if (s.id) { stale.push('files/' + d.name + '/' + s.name); continue }
        const { data: inner } = await supabase.storage.from(BUCKET).list('files/' + d.name + '/' + s.name, { limit: 1000 })
        for (const g of (inner || [])) stale.push('files/' + d.name + '/' + s.name + '/' + g.name)
      }
    }

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
      const rowsHtml = canBackup
        .filter(t => rowCounts[t] !== undefined)
        .map(t => '<li>' + t + ': ' + rowCounts[t] + ' dòng</li>').join('')
      const canhBao = []
      // Đặt ĐẦU TIÊN: đây là cảnh báo duy nhất trong danh sách cần người SỬA MÃ NGUỒN.
      if (bangThem.length) canhBao.push('Có ' + bangThem.length + ' bảng CHƯA được liệt kê trong danh sách backup — '
        + 'tuần này đã tự backup giúp, nhưng cần thêm vào TABLES trong app/api/cron/backup/route.js: '
        + bangThem.join(', '))
      if (loiTuKiem) canhBao.push('Không tự kiểm được danh sách bảng (' + loiTuKiem + ') — tuần này chỉ backup theo danh sách viết tay')
      if (skippedTables.length) canhBao.push('Bỏ qua ' + skippedTables.length + ' bảng không có trong database: ' + skippedTables.join(', '))
      if (copyError)    canhBao.push('Sao chép file đính kèm lỗi: ' + copyError)
      if (authError)    canhBao.push('Xuất danh sách tài khoản lỗi: ' + authError)
      if (storageError) canhBao.push('Đọc danh sách file lỗi: ' + storageError)
      await resend.emails.send({
        from: 'Savitax Backup <onboarding@resend.dev>',
        to: 'nghgan@gmail.com',
        subject: 'Backup Savitax — ' + dateStr(now) + ' (' + totalRows + ' dòng)',
        html: '<p>Backup tự động hàng tuần đã hoàn tất.</p>' +
          '<p><b>' + Object.keys(rowCounts).length + ' bảng · ' + totalRows + ' dòng</b> · ' +
          authUsers.length + ' tài khoản đăng nhập · ' +
          copiedFiles + '/' + storageFiles.length + ' file đính kèm đã sao chép</p>' +
          '<ul>' + rowsHtml + '</ul>' +
          (canhBao.length ? '<p style="color:#b45309"><b>Lưu ý:</b><br>' + canhBao.join('<br>') + '</p>' : '') +
          '<p>File: ' + fileName + ' — lưu tại Supabase Storage (bucket "' + BUCKET + '"), ' +
          'file đính kèm ở thư mục ' + filePrefix + '</p>',
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
    tableCount: Object.keys(rowCounts).length,
    totalRows,
    rowCounts,
    skippedTables,
    bangChuaLietKe: bangThem,
    loiTuKiem,
    authUserCount: authUsers.length,
    authError,
    clientFileCount: storageFiles.length,
    copiedFiles,
    copyError,
    storageError,
    deletedFiles,
    cleanupError,
    emailError,
  })
}
