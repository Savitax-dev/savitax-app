import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

// POST /api/bank/incoming — VPS (/root/acb_zalo/app_sync.py) đẩy giao dịch TIỀN VÀO lên đây.
//
// Không dùng phiên đăng nhập: xác thực bằng header `Authorization: Bearer <BANK_WEBHOOK_SECRET>`.
// Chỉ LƯU giao dịch, KHÔNG ghi gì vào công nợ — người có quyền bấm "Ghi" ở /bank mới ghi.
//
// Body: { transactions: [{ source: 'acb'|'tcb', ext_id, tx_time, amount, memo, account? }] }
//   (gửi 1 giao dịch trần không bọc mảng cũng được)
// Gửi lại cùng ext_id bao nhiêu lần cũng chỉ lưu 1 dòng — VPS cứ thử lại khi mạng lỗi.
//
// BANK_SYNC_FROM (tuỳ chọn, ISO): bỏ qua giao dịch cũ hơn mốc này — lớp chặn thứ hai cho cam kết
// "không gửi lại giao dịch cũ", phòng khi file chống trùng trên VPS bị mất.

function secretOk(request) {
  const secret = process.env.BANK_WEBHOOK_SECRET || ''
  if (secret.length < 24) return false // chưa cấu hình (hoặc quá ngắn) -> đóng cổng
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(got), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// "+1,620,000.00" / "1.620.000" / 1620000 -> 1620000. Tiền VND không có số lẻ; đuôi 2 chữ số sau
// dấu chấm/phẩy cuối là phần thập phân.
function parseAmount(v) {
  if (typeof v === 'number') return v
  let s = String(v || '').trim().replace(/^[+]/, '')
  if (s.startsWith('-')) return -1
  s = s.replace(/[.,]\d{1,2}$/, '')
  const n = Number(s.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export async function POST(request) {
  if (!secretOk(request)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return Response.json({ error: 'invalid json' }, { status: 400 }) }
  const list = Array.isArray(body?.transactions) ? body.transactions : body ? [body] : []
  if (!list.length) return Response.json({ error: 'empty' }, { status: 400 })
  if (list.length > 500) return Response.json({ error: 'too many' }, { status: 400 })

  const since = process.env.BANK_SYNC_FROM ? new Date(process.env.BANK_SYNC_FROM) : null
  const rows = [], rejected = []
  for (const t of list) {
    const source = String(t?.source || '').toLowerCase()
    const extId = String(t?.ext_id || '').trim()
    const amount = parseAmount(t?.amount)
    const time = t?.tx_time ? new Date(t.tx_time) : null
    if (!['acb', 'tcb'].includes(source) || !extId || extId.length > 300) { rejected.push({ ext_id: extId, why: 'source/ext_id' }); continue }
    if (!(amount > 0)) { rejected.push({ ext_id: extId, why: 'amount' }); continue }
    if (!time || Number.isNaN(time.getTime())) { rejected.push({ ext_id: extId, why: 'tx_time' }); continue }
    if (since && time < since) { rejected.push({ ext_id: extId, why: 'before BANK_SYNC_FROM' }); continue }
    rows.push({
      source, ext_id: source + ':' + extId.replace(/^(acb|tcb):/i, ''),
      tx_time: time.toISOString(), amount,
      memo: String(t?.memo || '').slice(0, 1000),
      account: t?.account ? String(t.account).slice(0, 50) : null,
    })
  }

  let inserted = 0
  if (rows.length) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase.from('bank_transactions')
      .upsert(rows, { onConflict: 'ext_id', ignoreDuplicates: true }).select('id')
    if (error) {
      console.error('bank/incoming insert error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
    inserted = data?.length || 0
  }
  // Giao dịch bị từ chối vì dữ liệu hỏng vẫn trả 200 — VPS không nên gửi lại mãi một dòng hỏng.
  return Response.json({ ok: true, received: list.length, inserted, duplicates: rows.length - inserted, rejected })
}
