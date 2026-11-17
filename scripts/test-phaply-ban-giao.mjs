// Bộ kiểm bàn giao + điều kiện đóng hồ sơ (lib/phaply/banGiao.js, route nop / word?dot=ban_giao / PATCH dong).
//   node scripts/test-phaply-ban-giao.mjs                                   (offline)
//   node --env-file=.env.local scripts/test-phaply-ban-giao.mjs --that [URL] (DB DEMO + máy chủ thử, hồ sơ GIẢ, dọn sạch)
import PizZip from 'pizzip'
import { dieuKienDong, thieuDieuKien, locMuc, mucMacDinh } from '../lib/phaply/banGiao.js'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }

const du = { conPhaiThu: 0, coKetQua: true, banGiaoNgay: '2026-11-20', coDrive: true, coScanBanGiao: true }
ok(thieuDieuKien(dieuKienDong(du)).length === 0, 'đủ 4 điều kiện → đóng được')
ok(thieuDieuKien(dieuKienDong({ ...du, conPhaiThu: 500000 }))[0]?.muc.includes('500.000'), 'còn nợ → nêu số tiền')
ok(thieuDieuKien(dieuKienDong({ ...du, coKetQua: false, banGiaoNgay: null })).length === 2, 'thiếu kết quả + bàn giao')
ok(dieuKienDong({ ...du, coDrive: false, coScanBanGiao: false }).length === 3, 'không có Drive → không đòi bản scan')
ok(locMuc([{ ten: '  A ' }, { ten: '' }, null, { ten: 'B', so_luong: '02' }]).map(m => m.ten).join() === 'A,B', 'lọc mục trống')
ok(mucMacDinh('tlm').length === 5 && mucMacDinh('giai_the').length === 2, 'danh mục gợi ý theo thủ tục')

if (process.argv.includes('--that')) {
  const i = process.argv.indexOf('--that')
  const GOC = process.argv[i + 1]?.startsWith('http') ? process.argv[i + 1] : 'http://localhost:3010'
  const { createClient } = await import('@supabase/supabase-js')
  const { createServerClient } = await import('@supabase/ssr')
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (!url || url.includes('ykorxlkgsmzskdybebzg')) throw new Error('Không phải database demo — từ chối')
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
  if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('Không phải database demo — từ chối')
  const cookieCua = async email => {
    const { data: ds0 } = await admin.auth.admin.listUsers({ perPage: 200 })
    if (!ds0.users.some(u => u.email === email)) throw new Error('Không có tài khoản ' + email)
    const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: v } = await anon.auth.verifyOtp({ email, token: l.properties.email_otp, type: 'email' })
    let ds = []
    const sc = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: c => { ds = c } } })
    await sc.auth.setSession({ access_token: v.session.access_token, refresh_token: v.session.refresh_token })
    return ds.map(c => `${c.name}=${c.value}`).join('; ')
  }
  const goi = ck => async (path, method = 'GET', body) => {
    const r = await fetch(GOC + path, { method, headers: { cookie: ck, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    const ct = r.headers.get('content-type') || ''
    return { status: r.status, data: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }
  }
  const { data: nv } = await admin.from('staff').select('id').eq('email', 'nvphaply@demo.savitax.vn').single()
  const TP = goi(await cookieCua('giamdoc@demo.savitax.vn')), NV = goi(await cookieCua('nvphaply@demo.savitax.vn'))
  const tao = await TP('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'tlm', entity_type: '1tv', ten_phap_nhan: 'Công ty TNHH [THỬ] bàn giao', contact_name: 'Khách Thử', contact_phone: '0909000995', source: 'moi', note: '[TEST-API]', assigned_to: nv.id })
  ok(tao.status === 200, 'tạo hồ sơ thử giao nhân viên', JSON.stringify(tao.data))
  const id = tao.data.id, H = `/api/admin/phaply/ho-so/${id}`
  try {
    let g = await NV(H + '/nop')
    ok(g.data.dieu_kien_dong?.length === 3 && thieuDieuKien(g.data.dieu_kien_dong).length === 2, 'mới tạo: thiếu kết quả + bàn giao (demo không có Drive)', JSON.stringify(g.data.dieu_kien_dong))
    ok((await NV(H, 'PATCH', { action: 'dong' })).status === 409, 'nhân viên đóng khi thiếu điều kiện → 409')
    ok((await NV(H + '/nop', 'PATCH', { action: 'ban_giao', ngay: '2026-11-20', muc: [] })).status === 400, 'ghi ngày bàn giao mà không có mục → 400')
    ok((await NV(H + '/nop', 'PATCH', { action: 'ban_giao', ngay: '2026-11-20', nguoi_nhan: 'Người Nhận Thử', ghi_chu: 'Ghi chú thử',
      muc: [...g.data.ban_giao.muc_mac_dinh, { ten: 'Mục thử riêng', so_luong: '02', ghi_chu: 'bản sao' }] })).status === 200, 'lưu bàn giao')
    const w = await NV(H + '/word?dot=ban_giao&ma=BBBG')
    const xml = w.status === 200 ? new PizZip(w.data).file('word/document.xml').asText().replace(/<[^>]+>/g, '') : ''
    ok(xml.includes('Mục thử riêng') && xml.includes('NGƯỜI NHẬN THỬ') && xml.includes('ngày 20 tháng 11 năm 2026') && xml.includes('SAVITAX'), 'xuất Biên bản bàn giao có đủ dữ liệu', w.status)
    await NV(H + '/nop', 'PATCH', { action: 'nop_luu', fields: { co_quan: 'so', ngay_nop: '2026-11-15', ket_qua: 'dat', ngay_ket_qua: '2026-11-18' } })
    g = await NV(H + '/nop')
    ok(thieuDieuKien(g.data.dieu_kien_dong).length === 0, 'đủ điều kiện sau khi có kết quả + bàn giao', JSON.stringify(g.data.dieu_kien_dong))
    ok((await NV(H, 'PATCH', { action: 'dong' })).status === 200, 'nhân viên đóng được khi đủ điều kiện')
    ok((await TP(H, 'PATCH', { action: 'mo_lai', note: 'Mở lại để thử' })).status === 200, 'trưởng phòng mở lại')
    await NV(H + '/nop', 'PATCH', { action: 'ban_giao', ngay: '', muc: [] })
    ok((await TP(H, 'PATCH', { action: 'dong' })).status === 400, 'trưởng phòng đóng khi thiếu mà không ghi lý do → 400')
    ok((await TP(H, 'PATCH', { action: 'dong', note: 'Khách nhận giấy tờ tại Sở' })).status === 200, 'trưởng phòng đóng khi thiếu, có lý do')
  } finally {
    const { data: hs } = await admin.from('legal_cases').select('entity_id').eq('id', id).maybeSingle()
    await admin.from('legal_case_stage_log').delete().eq('case_id', id)
    await admin.from('legal_cases').delete().eq('id', id)
    if (hs?.entity_id) await admin.from('legal_entities').delete().eq('id', hs.entity_id)
    console.log('· đã dọn dữ liệu thử')
  }
}
console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
