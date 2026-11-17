// Bộ kiểm GĐ 4 phân hệ Pháp lý: trình ký / nộp & theo dõi / kết quả GCN (lib/phaply/nop.js + route ho-so/[id]/nop).
//   node scripts/test-phaply-nop.mjs                                   (offline)
//   node --env-file=.env.local scripts/test-phaply-nop.mjs --that [URL] (DB DEMO + máy chủ thử, hồ sơ GIẢ, dọn sạch)
import { choTheoNop, soNgayToiHan, hanTheoDoi, lanKeTiep, maSoHopLe } from '../lib/phaply/nop.js'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }

ok(choTheoNop([]) === undefined, 'chưa nộp → không đụng trạng thái')
ok(choTheoNop([{ co_quan: 'so', ngay_nop: '2026-11-01', ket_qua: 'cho' }]) === 'so', 'nộp sở chờ → Chờ Sở')
ok(choTheoNop([{ co_quan: 'so', ngay_nop: '2026-11-01', ket_qua: 'bo_sung' }]) === 'bo_sung', 'yêu cầu bổ sung → Cần bổ sung')
ok(choTheoNop([{ co_quan: 'so', ngay_nop: '2026-11-01', ket_qua: 'bo_sung' }, { co_quan: 'so', ngay_nop: '2026-11-05', ket_qua: 'cho' }]) === 'so', 'nộp lại sau bổ sung → lấy lần mới nhất')
ok(choTheoNop([{ co_quan: 'so', ngay_nop: '2026-11-01', ket_qua: 'dat' }]) === null, 'đạt → bỏ chờ')
ok(choTheoNop([{ co_quan: 'so', ngay_nop: '2026-11-01', ket_qua: 'dat' }, { co_quan: 'thue', ngay_nop: '2026-11-10', ket_qua: 'cho' }]) === 'thue', 'sang nộp thuế → Chờ Thuế')
ok(choTheoNop([{ co_quan: 'khac', ngay_nop: '2026-11-01', ket_qua: 'cho' }]) === null, 'cơ quan khác → không tự đặt')
ok(soNgayToiHan('2026-11-20', '2026-11-17') === 3 && soNgayToiHan('2026-11-17', '2026-11-17') === 0 && soNgayToiHan('2026-11-15', '2026-11-17') === -2, 'đếm ngày tới hạn')
ok(soNgayToiHan('2027-01-02', '2026-12-30') === 3, 'đếm ngày qua năm')
ok(hanTheoDoi({ ket_qua: 'cho', ngay_hen_tra: '2026-11-20', han_bo_sung: '2026-12-01' }) === '2026-11-20' && hanTheoDoi({ ket_qua: 'bo_sung', ngay_hen_tra: '2026-11-20', han_bo_sung: '2026-12-01' }) === '2026-12-01' && hanTheoDoi({ ket_qua: 'dat', ngay_hen_tra: '2026-11-20' }) === null, 'hạn theo dõi theo kết quả')
ok(lanKeTiep([{ co_quan: 'so', lan: 1 }, { co_quan: 'so', lan: 2 }, { co_quan: 'thue', lan: 1 }], 'so') === 3 && lanKeTiep([], 'thue') === 1, 'đánh số lần nộp theo cơ quan')
ok(maSoHopLe('0319000001') && maSoHopLe('0319000001-001') && !maSoHopLe('031900000') && !maSoHopLe('0319000001-1'), 'mã số doanh nghiệp')

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
  const ck = await cookieCua('giamdoc@demo.savitax.vn')
  const L = async (path, method = 'GET', body) => {
    const r = await fetch(GOC + path, { method, headers: { cookie: ck, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, data: await r.json().catch(() => ({})) }
  }
  const { data: gd } = await admin.from('staff').select('id').eq('email', 'giamdoc@demo.savitax.vn').single()
  const tao = await L('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'tlm', entity_type: '2tv', ten_phap_nhan: 'Công ty TNHH [THỬ] nộp hồ sơ', contact_name: 'Khách Thử', contact_phone: '0909000996', source: 'moi', note: '[TEST-API]', assigned_to: gd.id })
  ok(tao.status === 200, 'tạo hồ sơ thử', JSON.stringify(tao.data))
  const id = tao.data.id, N = `/api/admin/phaply/ho-so/${id}/nop`
  const cho = async () => (await admin.from('legal_cases').select('wait_state').eq('id', id).single()).data.wait_state
  try {
    ok((await L(N, 'PATCH', { action: 'ky', dot: 'so', ma: 'DL_2TV', da_ky: true })).status === 200, 'đánh dấu đã ký')
    ok((await L(N, 'PATCH', { action: 'ky', dot: 'so', ma: 'MAU4', da_ky: true })).status === 400, 'tờ không thuộc loại hình → 400')
    let g = await L(N)
    ok(g.data.ky.length === 1 && g.data.ky[0].ma === 'DL_2TV', 'đọc lại trình ký')
    ok((await L(N, 'PATCH', { action: 'ky', dot: 'so', ma: 'DL_2TV', da_ky: false })).status === 200 && !(await L(N)).data.ky.length, 'bỏ dấu đã ký')

    ok((await L(N, 'PATCH', { action: 'nop_luu', fields: { co_quan: 'so', ngay_nop: '' } })).status === 400, 'thiếu ngày nộp → 400')
    ok((await L(N, 'PATCH', { action: 'nop_luu', fields: { co_quan: 'so', ngay_nop: '2026-11-10', ket_qua: 'bo_sung' } })).status === 400, 'bổ sung không ghi nội dung → 400')
    await L(N, 'PATCH', { action: 'nop_luu', fields: { co_quan: 'so', ngay_nop: '2026-11-10', ma_bien_nhan: 'MA-THU-1', ngay_hen_tra: '2026-11-13' } })
    ok(await cho() === 'so', 'nộp sở → hồ sơ tự Chờ Sở')
    g = await L(N)
    const lan1 = g.data.nop[0]
    await L(N, 'PATCH', { action: 'nop_luu', id: lan1.id, fields: { ...lan1, ket_qua: 'bo_sung', noi_dung_bo_sung: 'Bổ sung giả để thử', han_bo_sung: '2026-11-20' } })
    ok(await cho() === 'bo_sung', 'yêu cầu bổ sung → Cần bổ sung')
    await L(N, 'PATCH', { action: 'nop_luu', fields: { co_quan: 'so', ngay_nop: '2026-11-15', ket_qua: 'dat', ngay_ket_qua: '2026-11-18' } })
    g = await L(N)
    ok(g.data.nop.length === 2 && g.data.nop[1].lan === 2, 'lần nộp lại đánh số 2', JSON.stringify(g.data.nop.map(s => s.lan)))
    ok(await cho() === null, 'đạt → bỏ trạng thái chờ')
    ok((await L(N, 'PATCH', { action: 'nop_xoa', id: g.data.nop[1].id })).status === 200 && await cho() === 'bo_sung', 'xoá lần nộp mới nhất → trạng thái theo lần còn lại')

    ok((await L(N, 'PATCH', { action: 'gcn', ma_so: '123' })).status === 400, 'mã số sai → 400')
    ok((await L(N, 'PATCH', { action: 'gcn', ma_so: '0319 999 999', ngay_cap: '18/11/2026', noi_cap: '' })).status === 200, 'lưu kết quả GCN')
    const { data: hs } = await admin.from('legal_cases').select('entity_id').eq('id', id).single()
    const { data: ent } = await admin.from('legal_entities').select('tax_code, ngay_cap_gcn').eq('id', hs.entity_id).single()
    ok(ent.tax_code === '0319999999' && ent.ngay_cap_gcn === '18/11/2026', 'mã số vào pháp nhân (bỏ khoảng trắng)', JSON.stringify(ent))
    const { data: nk } = await admin.from('legal_case_stage_log').select('kind, note').eq('case_id', id)
    ok(nk.some(n => n.kind === 'wait') && nk.some(n => /Kết quả GCN/.test(n.note || '')), 'ghi nhật ký')
    const tep = await fetch(GOC + `/api/admin/phaply/ho-so/${id}/tep`, { method: 'POST', headers: { cookie: ck }, body: new FormData() })
    ok(tep.status === 400, 'tải tệp khi chưa cấu hình Drive (demo) → 400 báo rõ', String(tep.status))
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
