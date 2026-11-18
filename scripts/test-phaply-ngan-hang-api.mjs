// Bộ kiểm đầu-cuối Pháp lý ↔ Đối soát ngân hàng trên DATABASE DEMO + máy chủ thử (KHÔNG BAO GIỜ production). Tạo giao dịch NH giả có
// nội dung ĐNTT pháp lý → tự nhận → ghi vào công nợ → kiểm → DỌN SẠCH.  node --env-file=.env.local scripts/test-phaply-ngan-hang-api.mjs [http://localhost:3010]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
const { createServerClient } = require('@supabase/ssr')
const GOC = process.argv[2] || 'http://localhost:3010'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (url.includes('ykorxlkgsmzskdybebzg')) throw new Error('prod')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('không phải demo')
let dat = 0, hong = 0
const ok = (dk, ten, ct = '') => { if (dk) { dat++; console.log('✓', ten) } else { hong++; console.log('✗', ten, ct) } }

const email = 'giamdoc@demo.savitax.vn'   // quản trị demo — có quyền bank_reconcile
const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: v } = await anon.auth.verifyOtp({ email, token: l.properties.email_otp, type: 'email' })
let ds = []
const sc = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: c => { ds = c } } })
await sc.auth.setSession({ access_token: v.session.access_token, refresh_token: v.session.refresh_token })
const ck = ds.map(c => `${c.name}=${c.value}`).join('; ')
const goi = async (p, body) => {
  const r = await fetch(GOC + p, { method: body ? 'POST' : 'GET', headers: { cookie: ck, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { st: r.status, d: await r.json().catch(() => ({})) }
}

const { data: hs } = await admin.from('legal_cases').select('id, code').eq('title', 'CÔNG TY TNHH DỊCH VỤ AN NHIÊN').single()
const ma = hs.code.replace(/-/g, '')
const truocThu = (await admin.from('legal_case_payments').select('id').eq('case_id', hs.id).is('deleted_at', null)).data.map(x => x.id)
const homNay = new Date().toISOString()
const taoGd = async (memo, amount, ext) => (await admin.from('bank_transactions').insert({ source: 'acb', ext_id: 'THU-PL-' + ext + '-' + Date.now(), tx_time: homNay, amount, memo, state: 'open' }).select('id').single()).data.id
const gd1 = await taoGd(`MBVCB.999.${ma} ThanhToan Phidichvu 11 2026`, 1550000, 'A')
const gd2 = await taoGd('CK THU NGHIEM KHONG CO MA', 500000, 'B')
const taoRa = [gd1, gd2]
try {
  const ngay = homNay.slice(0, 10)
  const ls = await goi(`/api/admin/bank-transactions?from=${ngay}&to=${ngay}`)
  const r1 = ls.d.data?.find(x => x.id === gd1), r2 = ls.d.data?.find(x => x.id === gd2)
  ok(r1?.phapLy?.id === hs.id && r1.phapLy.con > 0, `tự nhận ${hs.code} từ nội dung "${ma} ThanhToan…"`, JSON.stringify(r1?.phapLy || r1?.phapLyMa))
  ok(r2 && !r2.phapLy && !r2.phapLyMa, 'giao dịch không có mã → không gắn pháp lý')
  ok(r1?.state === 'open', 'không tự ghi (chờ người bấm)')
  const conTruoc = r1.phapLy.con
  const dsHs = await goi('/api/admin/bank-transactions?phapLyCases=1')
  ok(dsHs.d.data?.some(x => x.id === hs.id), 'danh sách ghép tay có hồ sơ còn nợ')

  const vuot = await goi('/api/admin/bank-transactions', { action: 'postPhapLy', id: gd1, caseId: hs.id, amount: 99000000 })
  ok(vuot.st === 400, 'chặn ghi vượt phần chưa ghi của giao dịch', JSON.stringify(vuot))
  const g = await goi('/api/admin/bank-transactions', { action: 'postPhapLy', id: gd1, caseId: hs.id, amount: 1550000 })
  ok(g.st === 200 && g.d.conLai === 0, 'ghi 1.550.000 vào công nợ pháp lý', JSON.stringify(g))
  const lai = await goi('/api/admin/bank-transactions', { action: 'postPhapLy', id: gd1, caseId: hs.id, amount: 1550000 })
  ok(lai.st === 409, 'bấm lần 2 bị chặn (giao dịch đã ghi)', JSON.stringify(lai))
  const { data: moi } = await admin.from('legal_case_payments').select('*').eq('case_id', hs.id).is('deleted_at', null).not('id', 'in', `(${truocThu.join(',') || '00000000-0000-0000-0000-000000000000'})`)
  ok(moi.length >= 1 && moi.reduce((a, p) => a + Number(p.amount_dich_vu) + Number(p.amount_thu_ho), 0) === 1550000 && moi.every(p => p.method === 'chuyen_khoan' && /Đối soát NH ACB/.test(p.note)), 'khoản thu pháp lý đúng tiền, ghi chú Đối soát NH', JSON.stringify(moi))
  ok(moi.every(p => p.paid_at === new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)), 'ngày trả = ngày tiền về (giờ VN)')
  const ct = await goi(`/api/admin/phaply/ho-so/${hs.id}`)
  ok(ct.d.tien?.con_phai_thu === conTruoc - 1550000, 'công nợ hồ sơ giảm đúng số', `${conTruoc} → ${ct.d.tien?.con_phai_thu}`)
  const { data: gdSau } = await admin.from('bank_transactions').select('state, post_detail').eq('id', gd1).single()
  ok(gdSau.state === 'posted' && gdSau.post_detail?.parts?.[0]?.kind === 'phap_ly', 'giao dịch đóng, phần ghi kind phap_ly')
  const ls2 = await goi(`/api/admin/bank-transactions?from=${ngay}&to=${ngay}`)
  ok(/Pháp lý/.test(ls2.d.data?.find(x => x.id === gd1)?.parts?.[0]?.moTa || ''), 'thẻ giao dịch mô tả "Pháp lý PL-…"', ls2.d.data?.find(x => x.id === gd1)?.parts?.[0]?.moTa)
} finally {
  // dọn: xoá khoản thu thử + giao dịch thử + nhật ký
  const { data: moi } = await admin.from('legal_case_payments').select('id').eq('case_id', hs.id)
  const xoa = (moi || []).map(x => x.id).filter(id => !truocThu.includes(id))
  if (xoa.length) await admin.from('legal_case_payments').delete().in('id', xoa)
  await admin.from('bank_action_logs').delete().in('tx_id', taoRa)
  await admin.from('bank_transactions').delete().in('id', taoRa)
  console.log(`· đã dọn ${xoa.length} khoản thu thử + ${taoRa.length} giao dịch thử`)
}
console.log(`${dat} đạt, ${hong} hỏng`)
