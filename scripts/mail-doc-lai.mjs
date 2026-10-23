// ĐỌC LẠI các mail báo cáo đang "chưa khớp" bằng bộ đọc hiện tại (lib/mailBaoCao.js) — dùng sau khi
// sửa bộ đọc, để những mail ĐÃ VỀ trước bản sửa cũng được tick (luồng /api/mail/incoming bỏ qua thư
// đã có trong mail_evidence nên không tự đọc lại).
//
//   node --env-file=.env.local scripts/mail-doc-lai.mjs           (CHẠY KHÔ — chỉ in)
//   node --env-file=.env.local scripts/mail-doc-lai.mjs --ghi     (tick + cập nhật bằng chứng)
//
// Theo ĐÚNG luật của /api/mail/incoming: chỉ tick, không bỏ tick; việc đã tick thì GIỮ NGUYÊN
// done_at cũ; done_at = giờ gửi mail; done_by = nhân viên gửi (tra theo email).
// Lần đầu dùng 22/10/2026: mail "…_BÁO CÁO THUẾ QUÝ 03.2026" bị đọc thành THÁNG 3.
import { createClient } from '@supabase/supabase-js'
import { docMail } from '../lib/mailBaoCao.js'

const ghi = process.argv.includes('--ghi')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [{ data: thu, error }, { data: tatCa }, { data: taskDefs }, { data: staff }] = await Promise.all([
  sb.from('mail_evidence').select('*').eq('matched', false).order('sent_at'),
  sb.from('clients').select('id, name, client_code, tax_code, report_type, status'),
  sb.from('task_definitions').select('id, name, month, report_type, is_active').eq('is_active', true),
  sb.from('staff').select('id, email'),
])
if (error) { console.log('Lỗi đọc mail_evidence:', error.message); process.exit(1) }
const clients = (tatCa || []).filter(c => (c.status || 'active') === 'active')
const theoEmail = new Map((staff || []).filter(s => s.email).map(s => [s.email.trim().toLowerCase(), s.id]))

console.log((ghi ? 'GHI THẬT' : 'CHẠY KHÔ') + ' — ' + thu.length + ' mail đang chưa khớp\n')
let soKhop = 0, soTick = 0
for (const m of thu) {
  if (!m.sent_at) continue
  const r = docMail({ tieuDe: m.subject, ngayGui: new Date(m.sent_at), dsCty: clients, taskDefs: taskDefs || [] })
  if (!r.ok) continue
  soKhop++
  const { data: rec } = await sb.from('task_records').select('id, is_done, done_at')
    .eq('client_id', r.client.id).eq('task_def_id', r.task.id).eq('year', r.dich.year).eq('month', r.dich.month).maybeSingle()
  const daTick = !!rec?.is_done
  console.log((daTick ? '  đã tick sẵn ' : '  SẼ TICK     ') + 'T' + r.dich.month + '/' + r.dich.year + ' | ' + r.client.name + ' | ' + r.task.name + ' | ' + m.subject)
  if (!ghi) continue

  let ticked = false
  if (!daTick) {
    const payload = {
      client_id: r.client.id, task_def_id: r.task.id, year: r.dich.year, month: r.dich.month,
      is_done: true, done_at: m.sent_at, done_by: (m.from_email && theoEmail.get(m.from_email)) || null,
    }
    const { error: e } = rec?.id
      ? await sb.from('task_records').update(payload).eq('id', rec.id)
      : await sb.from('task_records').upsert(payload, { onConflict: 'client_id,task_def_id,year,month' })
    if (e) { console.log('    LỖI tick:', e.message); continue }
    ticked = true; soTick++
  }
  const { error: e2 } = await sb.from('mail_evidence').update({
    client_id: r.client.id, task_def_id: r.task.id, year: r.dich.year, month: r.dich.month,
    matched: true, ticked, reason: null,
  }).eq('message_id', m.message_id)
  if (e2) console.log('    LỖI cập nhật bằng chứng:', e2.message)
}
console.log('\nKhớp được: ' + soKhop + '/' + thu.length + (ghi ? ' — đã tick ' + soTick : ' — chưa ghi gì, thêm --ghi để ghi thật'))
