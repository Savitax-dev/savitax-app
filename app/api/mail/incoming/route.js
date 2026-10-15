import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { docMail } from '@/lib/mailBaoCao'

// POST /api/mail/incoming — VPS (/root/acb_zalo/mail_sync.py) đẩy tiêu đề mail "bộ báo cáo thuế"
// nhân viên gửi khách lên đây. App đối chiếu rồi TỰ TICK việc "Gửi mail bộ báo cáo thuế ..." trong
// Checklist công việc.
//
// Không dùng phiên đăng nhập: xác thực bằng `Authorization: Bearer <MAIL_WEBHOOK_SECRET>`, y hệt
// /api/bank/incoming.
//
// Body: { mails: [{ message_id, subject, from_email?, sent_at }] }  (gửi 1 thư trần cũng được)
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// BA LUẬT, chép lại từ đầu lib/mailBaoCao.js vì đây là nơi chúng được THI HÀNH:
//
// 1. CHỈ TICK, KHÔNG BAO GIỜ BỎ TICK. Và việc đã tick từ trước thì GIỮ NGUYÊN `done_at` cũ —
//    không ghi đè bằng giờ gửi mail. Ghi đè là đổi "đúng hạn" thành "trễ" (hoặc ngược lại) của
//    một việc người ta đã làm xong, mà KPI chấm theo đúng dấu đó.
// 2. MƠ HỒ THÌ KHÔNG TICK — vẫn lưu dòng bằng chứng kèm LÝ DO, để dựng danh sách "mail chưa khớp".
// 3. KHÔNG BAO GIỜ TRẢ LỖI VÌ MỘT THƯ HỎNG. Thư nào không đọc được thì ghi lý do rồi đi tiếp;
//    trả 500 là VPS gửi lại mãi một thư hỏng.
// ────────────────────────────────────────────────────────────────────────────────────────────

function secretOk(request) {
  const secret = process.env.MAIL_WEBHOOK_SECRET || ''
  if (secret.length < 24) return false // chưa cấu hình (hoặc quá ngắn) -> đóng cổng
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(got), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request) {
  if (!secretOk(request)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return Response.json({ error: 'invalid json' }, { status: 400 }) }
  const list = Array.isArray(body?.mails) ? body.mails : body?.message_id ? [body] : []
  if (!list.length) return Response.json({ error: 'empty' }, { status: 400 })
  if (list.length > 300) return Response.json({ error: 'too many' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Bỏ ngay những thư ĐÃ xử lý — khỏi tra cứu lại và khỏi tick lại.
  const ids = list.map(m => String(m?.message_id || '').trim()).filter(Boolean)
  const { data: daCo, error: loiBang } = await supabase.from('mail_evidence')
    .select('message_id').in('message_id', ids)

  // CHƯA CHẠY sql/30 -> DỪNG, không tick gì cả.
  //
  // Tick được mà không ghi được bằng chứng là tình huống tệ nhất: checklist tự nhiên có dấu, không
  // ai biết dựa vào đâu, và lần chạy sau lại xử lý lại từ đầu vì không có gì để chống trùng.
  // Trả 503 để VPS coi là lỗi tạm thời và thử lại, thay vì nuốt lặng.
  if (loiBang) {
    console.error('mail/incoming: chưa có bảng mail_evidence —', loiBang.message)
    return Response.json(
      { error: 'chưa chạy sql/30_mail_bao_cao.sql — không tick khi chưa ghi được bằng chứng' },
      { status: 503 })
  }
  const daXuLy = new Set((daCo || []).map(r => r.message_id))

  // CHỈ công ty ĐANG HOẠT ĐỘNG: công ty đã ngưng không còn checklist để tick, mà để lẫn vào thì
  // gây mơ hồ với công ty cùng tên (xem lib/mailBaoCao.js).
  const [{ data: clients }, { data: taskDefs }, { data: staffRows }] = await Promise.all([
    supabase.from('clients').select('id, name, client_code, tax_code, report_type').eq('status', 'active'),
    supabase.from('task_definitions').select('id, name, month, report_type, is_active').eq('is_active', true),
    supabase.from('staff').select('id, email'),
  ])
  const staffByEmail = new Map((staffRows || [])
    .filter(s => s.email).map(s => [String(s.email).trim().toLowerCase(), s.id]))

  const ghi = [], ketQua = { nhan: list.length, trungLap: 0, khop: 0, tick: 0, khongKhop: 0 }

  for (const m of list) {
    const messageId = String(m?.message_id || '').trim()
    if (!messageId || messageId.length > 500) { ketQua.khongKhop++; continue }
    if (daXuLy.has(messageId)) { ketQua.trungLap++; continue }

    const subject = String(m?.subject || '').slice(0, 500)
    const fromEmail = m?.from_email ? String(m.from_email).trim().toLowerCase().slice(0, 200) : null
    const sentAt = m?.sent_at ? new Date(m.sent_at) : null
    const sentOk = sentAt && !Number.isNaN(sentAt.getTime())

    const dong = {
      message_id: messageId, subject, from_email: fromEmail,
      sent_at: sentOk ? sentAt.toISOString() : null,
      client_id: null, task_def_id: null, year: null, month: null,
      matched: false, reason: null, ticked: false,
    }

    if (!sentOk) {
      dong.reason = 'thiếu hoặc sai giờ gửi'
      ghi.push(dong); ketQua.khongKhop++; continue
    }

    const r = docMail({ tieuDe: subject, ngayGui: sentAt, dsCty: clients || [], taskDefs: taskDefs || [] })
    if (!r.ok) {
      dong.client_id = r.client?.id || null
      dong.reason = r.lyDo || 'không khớp'
      ghi.push(dong); ketQua.khongKhop++; continue
    }

    dong.client_id = r.client.id
    dong.task_def_id = r.task.id
    dong.year = r.dich.year
    dong.month = r.dich.month
    dong.matched = true
    ketQua.khop++

    // Đã tick từ trước -> GIỮ NGUYÊN, chỉ lưu bằng chứng. Xem luật 1 ở đầu file.
    const { data: rec } = await supabase.from('task_records')
      .select('id, is_done').eq('client_id', r.client.id).eq('task_def_id', r.task.id)
      .eq('year', r.dich.year).eq('month', r.dich.month).maybeSingle()

    if (rec?.is_done) { ghi.push(dong); continue }

    // `done_at` = GIỜ GỬI MAIL, không phải giờ VPS đọc được. Đó mới là lúc việc thật sự xong, và
    // chênh lệch quyết định đúng hạn hay trễ.
    // `done_by` = nhân viên gửi thư, tra theo email. Không tra ra thì để trống — thà thiếu tên
    // còn hơn gán nhầm cho người khác.
    const payload = {
      client_id: r.client.id, task_def_id: r.task.id,
      year: r.dich.year, month: r.dich.month,
      is_done: true, done_at: sentAt.toISOString(),
      done_by: (fromEmail && staffByEmail.get(fromEmail)) || null,
    }
    const { error } = rec?.id
      ? await supabase.from('task_records').update(payload).eq('id', rec.id)
      : await supabase.from('task_records').upsert(payload, { onConflict: 'client_id,task_def_id,year,month' })

    if (error) {
      // Không tick được thì ĐỪNG lưu dòng bằng chứng -> lần chạy sau VPS gửi lại, thử lại được.
      console.error('mail/incoming: không tick được', messageId, error.message)
      ketQua.khop--; ketQua.khongKhop++
      continue
    }
    dong.ticked = true
    ketQua.tick++
    ghi.push(dong)
  }

  if (ghi.length) {
    const { error } = await supabase.from('mail_evidence')
      .upsert(ghi, { onConflict: 'message_id', ignoreDuplicates: true })
    // Lưu bằng chứng hỏng thì BÁO, nhưng việc đã tick rồi vẫn giữ — không hoàn tác dấu tick chỉ vì
    // không ghi được nhật ký.
    if (error) {
      console.error('mail/incoming: không lưu được bằng chứng', error.message)
      return Response.json({ ok: true, ...ketQua, warn: 'chưa lưu được bằng chứng: ' + error.message })
    }
  }

  return Response.json({ ok: true, ...ketQua })
}
