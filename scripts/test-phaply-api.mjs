// Bộ kiểm API phân hệ Pháp lý trên DATABASE DEMO + máy chủ thử đang chạy (KHÔNG BAO GIỜ production):
//   node --env-file=.env.local scripts/test-phaply-api.mjs [http://localhost:3010]
// Đăng nhập bằng phiên cấp qua API quản trị của demo (không gõ mật khẩu), tài khoản Giám đốc demo (quản trị).
// Đi trọn một hồ sơ: tạo → checklist → phí + lịch thu mẫu → ghi thu (thu hộ trước) → chuyển bước (đợt 2 đến hạn) →
// báo cáo (bất biến dòng tiền) → đóng (chặn khi còn nợ) → xoá mềm. Người không có quyền Pháp lý phải bị 403.
// Dọn sạch hồ sơ thử ở cuối (xoá cứng — chỉ dữ liệu do bộ kiểm tạo, đánh dấu ghi chú "[TEST-API]").
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { xemDuoc, suaDuoc } from '../lib/phaply/phamVi.js'
import { homNayVN } from '../lib/phaply/hoSo.js'

const GOC = process.argv[2] || 'http://localhost:3010'
const REF_THAT = 'ykorxlkgsmzskdybebzg'
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
if (!url || url.includes(REF_THAT)) throw new Error('Không phải database demo — từ chối')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { error: khongDemo } = await admin.from('demo_la_ban_demo').select('id').limit(1)
if (khongDemo) throw new Error('Không phải database demo — từ chối')

let loi = 0, dem = 0
const kiem = (ten, dk, ct = '') => { dem++; if (!dk) { loi++; console.log('✗', ten, ct) } else console.log('✓', ten) }

// CHỈ cấp phiên cho tài khoản đăng nhập ĐÃ CÓ — generateLink với email chưa có sẽ TẠO tài khoản mới (đã dính 17/11/2026)
async function cookieCua(email) {
  const { data: ds0 } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (!ds0.users.some(u => u.email === email)) throw new Error('Không có tài khoản đăng nhập ' + email + ' — không tạo mới')
  const { data: l, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(error.message)
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ email, token: l.properties.email_otp, type: 'email' })
  if (e2) throw new Error(e2.message)
  let ds = []
  const sc = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: c => { ds = c } } })
  await sc.auth.setSession({ access_token: v.session.access_token, refresh_token: v.session.refresh_token })
  return ds.map(c => `${c.name}=${c.value}`).join('; ')
}
const goi = (cookie) => async (path, method = 'GET', body) => {
  const r = await fetch(GOC + path, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const ct = r.headers.get('content-type') || ''
  return { status: r.status, data: ct.includes('json') ? await r.json() : await r.text() }
}

// Tài khoản đăng nhập có sẵn của demo: Giám đốc (quản trị → đủ quyền Pháp lý) và Trưởng phòng HCNS (không có quyền Pháp lý)
const { data: tp } = await admin.from('staff').select('id, email').eq('email', 'giamdoc@demo.savitax.vn').single()
const { data: ngoai } = await admin.from('staff').select('id, email').eq('email', 'hcns@demo.savitax.vn').maybeSingle()
const L = goi(await cookieCua(tp.email))

// ─── người ngoài phòng ───
if (ngoai) {
  const N = goi(await cookieCua(ngoai.email))
  kiem('nhân viên HCNS không vào được Pháp lý (403)', (await N('/api/admin/phaply/ho-so')).status === 403)
}

// ─── phạm vi (hàm thuần): nhân viên thường ───
const nv = { caller: { staffId: 'A' }, q: { xem: true, sua: true, ca_phong: false } }
kiem('NV thấy hồ sơ mình', xemDuoc(nv, { assigned_to: 'A' }) && suaDuoc(nv, { assigned_to: 'A' }))
kiem('NV thấy + nhận được hồ sơ chưa giao', xemDuoc(nv, { assigned_to: null }) && suaDuoc(nv, { assigned_to: null }))
kiem('NV KHÔNG thấy hồ sơ người khác', !xemDuoc(nv, { assigned_to: 'B' }) && !suaDuoc(nv, { assigned_to: 'B' }))
kiem('hồ sơ đã xoá không ai thấy', !xemDuoc({ ...nv, q: { ...nv.q, ca_phong: true } }, { assigned_to: 'A', is_deleted: true }))

// ─── tạo hồ sơ ───
const mau = await L('/api/admin/phaply/mau')
kiem('đọc mẫu', mau.status === 200 && mau.data.thu_tuc.find(t => t.k === 'tlm').items.length > 0, JSON.stringify(mau.data).slice(0, 200))
const lich5050 = mau.data.lich_mau.find(p => p.items.length === 2 && p.items[1].due_stage === 7)
const tao = await L('/api/admin/phaply/ho-so', 'POST', {
  procedure_code: 'tlm', entity_type: 'cp', ten_phap_nhan: 'Công ty cổ phần thử nghiệm api', contact_name: 'Khách Thử', contact_phone: '0909 000 999',
  source: 'moi', note: '[TEST-API]', assigned_to: tp.id, phi: [{ kind: 'dich_vu', name: 'Phí dịch vụ', amount: 5_000_000 }, { kind: 'thu_ho', name: 'Lệ phí', amount: 600_000 }],
  lich_mau_id: lich5050?.id,
})
kiem('tạo hồ sơ', tao.status === 200 && /^PL-\d{4}-\d{2}$/.test(tao.data.code), JSON.stringify(tao.data))
const id = tao.data.id
try {
  let ct = await L('/api/admin/phaply/ho-so/' + id)
  kiem('tên viết hoa', ct.data.phap_nhan.name === 'CÔNG TY CỔ PHẦN THỬ NGHIỆM API')
  kiem('sinh checklist từ mẫu', ct.data.viec.length > 0)
  kiem('hạn nội bộ có', !!ct.data.ho_so.due_at)
  kiem('lịch 50/50: đợt 1 = 2,5tr DV + 600k thu hộ', ct.data.tien.dots[0].amount_dich_vu == 2_500_000 && ct.data.tien.dots[0].amount_thu_ho == 600_000, JSON.stringify(ct.data.tien.dots[0]))
  kiem('đợt 1 đến hạn ngay, đợt 2 chưa', ct.data.tien.dots[0].da_den_han && !ct.data.tien.dots[1].den_han_ngay)

  // ─── checklist ───
  const v1 = ct.data.viec[0]
  kiem('tích việc', (await L(`/api/admin/phaply/ho-so/${id}/viec`, 'POST', { task_id: v1.id, done: true })).status === 200)
  kiem('thêm việc riêng', (await L(`/api/admin/phaply/ho-so/${id}/viec`, 'POST', { them: { title: 'Gọi khách xác nhận tên', stage: 1 } })).status === 200)
  kiem('không xoá được việc theo mẫu', (await L(`/api/admin/phaply/ho-so/${id}/viec`, 'POST', { xoa: v1.id })).status === 409)

  // ─── ghi thu: 2tr cho đợt 1 → thu hộ 600k trước, dịch vụ 1,4tr ───
  const t1 = await L(`/api/admin/phaply/ho-so/${id}/tien`, 'POST', { installment_id: ct.data.tien.dots[0].id, so_tien: 2_000_000, paid_at: homNayVN(), method: 'chuyen_khoan' })
  kiem('ghi thu tách thu hộ trước', t1.status === 200 && t1.data.amount_thu_ho === 600_000 && t1.data.amount_dich_vu === 1_400_000, JSON.stringify(t1.data))
  kiem('chặn ngày trả tương lai', (await L(`/api/admin/phaply/ho-so/${id}/tien`, 'POST', { so_tien: 1, paid_at: '2099-01-01' })).status === 400)
  ct = await L('/api/admin/phaply/ho-so/' + id)
  kiem('nợ đến hạn = 1,1tr', ct.data.tien.no_den_han === 1_100_000, ct.data.tien.no_den_han)

  // ─── sửa phí sau khi đã thu: trưởng phòng được ───
  kiem('trưởng phòng sửa phí sau khi thu', (await L(`/api/admin/phaply/ho-so/${id}/tien`, 'PUT', { fees: ct.data.fees })).status === 200)

  // ─── chuyển bước tới Kết quả → đợt 2 đến hạn ───
  kiem('chuyển bước 7', (await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'buoc', stage: 7 })).status === 200)
  kiem('đặt chờ khách', (await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'cho', wait_state: 'khach' })).status === 200)
  ct = await L('/api/admin/phaply/ho-so/' + id)
  kiem('đợt 2 đến hạn hôm nay', ct.data.tien.dots[1].den_han_ngay === homNayVN() && ct.data.tien.no_den_han === 3_600_000, JSON.stringify(ct.data.tien.dots[1].den_han_ngay) + ' ' + ct.data.tien.no_den_han)
  kiem('nhật ký có tạo + chuyển bước + chờ', ['create', 'stage', 'wait'].every(k => ct.data.nhat_ky.some(l => l.kind === k)))

  // ─── ĐNTT đợt 2 ───
  const dn = await L(`/api/admin/phaply/ho-so/${id}/dntt?dot=${ct.data.tien.dots[1].id}`)
  kiem('ĐNTT: phí DV tách VAT, A = nợ đợt 1, C đúng', dn.status === 200 && dn.data.includes('2.314.815') && dn.data.includes('1.100.000') && dn.data.includes('3.600.000'), String(dn.data).slice(0, 120))

  // ─── báo cáo: bất biến ───
  const m = homNayVN().slice(0, 7)
  const bc = await L(`/api/admin/phaply/bao-cao?tu=${m}&toi=${m}`)
  kiem('báo cáo trả về', bc.status === 200, JSON.stringify(bc.data).slice(0, 200))
  const o = bc.data.phong.dong_tien[0]
  kiem('(1) cộng trừ thẻ khớp', o.tong.ton_dau + o.tong.phat_sinh - o.tong.da_thu === o.tong.chuyen)
  const tongNv = bc.data.nhan_vien.reduce((a, n) => a + n.dong_tien[0].tong.chuyen, 0)
  kiem('(3) tổng nhân viên = tổng phòng', tongNv === o.tong.chuyen, tongNv + ' vs ' + o.tong.chuyen)
  kiem('doanh số tháng gồm 1,4tr của hồ sơ thử', bc.data.phong.doanh_so[0].gom_vat >= 1_400_000)

  // ─── đóng ───
  const dong1 = await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'dong' })
  kiem('đóng còn nợ không lý do → 400', dong1.status === 400, JSON.stringify(dong1.data))
  kiem('trưởng phòng đóng còn nợ có lý do', (await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'dong', note: 'Thử đóng còn nợ' })).status === 200)
  kiem('hồ sơ đã đóng không sửa được', (await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'sua', fields: { note: 'x' } })).status === 409)
  kiem('mở lại có lý do', (await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'mo_lai', note: 'Thử mở lại' })).status === 200)
  const ds = await L('/api/admin/phaply/ho-so')
  kiem('danh sách có hồ sơ + thẻ số liệu', ds.data.ho_so.some(r => r.id === id) && ds.data.the.dang_lam >= 1)
  kiem('xoá mềm', (await L('/api/admin/phaply/ho-so/' + id, 'PATCH', { action: 'xoa', note: 'Dọn hồ sơ thử' })).status === 200)
  kiem('hồ sơ xoá không còn trong danh sách', !(await L('/api/admin/phaply/ho-so')).data.ho_so.some(r => r.id === id))
} finally {
  const { data: hs } = await admin.from('legal_cases').select('entity_id').eq('id', id).maybeSingle()
  await admin.from('legal_cases').delete().eq('id', id)
  if (hs?.entity_id) await admin.from('legal_entities').delete().eq('id', hs.entity_id)
  console.log('· đã dọn hồ sơ thử')
}
console.log(loi ? `✗ ${loi}/${dem} kiểm sai` : `✓ ${dem} kiểm đúng`)
process.exit(loi ? 1 : 0)
