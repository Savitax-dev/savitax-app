import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

// POST /api/zalo/incoming — Webhook của Zalo Bot (bot.zapps.me). BƯỚC THỬ (26/11/2026): chỉ GHI LẠI
// nguyên văn tin vào bảng zalo_tin_nhan (sql/62), CHƯA tick gì trong Checklist. Xem tin bằng
// `node --env-file=.env.local scripts/xem-tin-zalo.mjs`.
//
// Không dùng phiên đăng nhập: Zalo gửi kèm header `X-Bot-Api-Secret-Token` = Secret Token đặt ở
// Zalo Bot Creator → Thiết lập chung; app so với biến môi trường ZALO_BOT_SECRET (Vercel).
//
// Body theo tài liệu: { event_name, message: { message_id, date (ms), message_type, from: { id,
// display_name, is_bot }, chat: { id, chat_type: PRIVATE | GROUP }, text?, caption?, photo_url?,
// file_url?, file_name?, … } }. Nhóm (GROUP) Zalo ghi là Beta — chưa rõ nhận mọi tin hay chỉ tin @Bot,
// nên lưu nguyên body để xem.
//
// Xác thực đúng thì LUÔN trả 200, kể cả khi ghi hỏng (lỗi ghi vào log Vercel) — trả lỗi là Zalo có
// thể gửi lại mãi một tin.

function secretOk(request) {
  const secret = process.env.ZALO_BOT_SECRET || ''
  if (secret.length < 16) return false // chưa cấu hình (hoặc quá ngắn) -> đóng cổng
  const got = request.headers.get('x-bot-api-secret-token') || ''
  const a = Buffer.from(got), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

const chuoi = v => (v == null || v === '' ? null : String(v))

export async function POST(request) {
  if (!secretOk(request)) return Response.json({ message: 'Unauthorized' }, { status: 403 })

  let body
  try { body = await request.json() } catch { return Response.json({ ok: false, loi: 'invalid json' }) }

  // Phòng khi Zalo dồn nhiều sự kiện một lần (tài liệu chỉ tả một sự kiện / lần)
  const ds = (Array.isArray(body) ? body : Array.isArray(body?.result) ? body.result : [body]).filter(x => x && typeof x === 'object')
  const dong = ds.map(sk => {
    const m = sk.message || {}
    const ms = Number(m.date)
    return {
      event_name: chuoi(sk.event_name),
      message_id: chuoi(m.message_id),
      chat_id: chuoi(m.chat?.id),
      chat_type: chuoi(m.chat?.chat_type),
      nguoi_gui_id: chuoi(m.from?.id),
      nguoi_gui_ten: chuoi(m.from?.display_name),
      gui_luc: Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null,
      noi_dung: chuoi(m.text ?? m.caption ?? m.file_name ?? m.link_url),
      du_lieu: sk,
    }
  })
  if (!dong.length) return Response.json({ ok: true, ghi: 0 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const coMa = dong.filter(d => d.message_id), khongMa = dong.filter(d => !d.message_id)
  const loi = []
  if (coMa.length) {
    const { error } = await supabase.from('zalo_tin_nhan').upsert(coMa, { onConflict: 'message_id', ignoreDuplicates: true })
    if (error) loi.push(error.message)
  }
  if (khongMa.length) {
    const { error } = await supabase.from('zalo_tin_nhan').insert(khongMa)
    if (error) loi.push(error.message)
  }
  if (loi.length) console.error('zalo/incoming: không ghi được —', loi.join(' | '), '(đã chạy sql/62 chưa?)')
  return Response.json({ ok: !loi.length, ghi: loi.length ? 0 : dong.length })
}
