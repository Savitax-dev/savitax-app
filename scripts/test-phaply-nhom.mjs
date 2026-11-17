// Bộ kiểm nhóm thủ tục + tạm ngừng (lib/phaply/nhom.js, route ho-so ?nhom=, doanh-nghiep, PATCH tam_ngung / nhac_khach).
//   node scripts/test-phaply-nhom.mjs                                  offline
//   node --env-file=.env.local scripts/test-phaply-nhom.mjs --that [URL] DB DEMO + máy chủ thử: chuỗi hồ sơ GIẢ trên cùng một công ty
//     (thành lập → tạm ngừng → nhắc khách → hoạt động lại), dọn sạch ở cuối.
import { nhomCuaThuTuc, kiemTamNgung, denToiDa, hanThongBao, luiNgayLamViec, trangThaiTamNgung, locNoiDung, congNgay } from '../lib/phaply/nhom.js'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }

ok(nhomCuaThuTuc('tlm') === 'thanh_lap' && nhomCuaThuTuc('hoat_dong_lai') === 'tam_ngung' && nhomCuaThuTuc('rut_ho_so') === 'khac' && nhomCuaThuTuc('xyz') === 'khac', 'nhóm của thủ tục')
ok(denToiDa('2026-12-01') === '2027-11-30' && denToiDa('2028-02-29') === '2029-02-28', 'tối đa 1 năm (cả năm nhuận)', denToiDa('2028-02-29'))
ok(kiemTamNgung('2026-12-01', '2027-11-30') === null, 'đúng 1 năm hợp lệ')
ok(/tối đa 1 năm/.test(kiemTamNgung('2026-12-01', '2027-12-01') || ''), 'quá 1 năm → lỗi')
ok(/sau ngày bắt đầu/.test(kiemTamNgung('2026-12-01', '2026-11-30') || ''), 'kết thúc trước bắt đầu → lỗi')
ok(luiNgayLamViec('2026-11-23', 3) === '2026-11-18', '3 ngày làm việc trước thứ Hai 23/11 = thứ Tư 18/11 (bỏ T7, CN)', luiNgayLamViec('2026-11-23', 3))
ok(hanThongBao('2026-11-20') === '2026-11-17', '3 ngày làm việc trước thứ Sáu 20/11 = thứ Ba 17/11')
const tt = (den, extra = {}) => trangThaiTamNgung({ tu: '2026-01-01', den, ...extra }, '2026-11-17')
ok(tt('2027-03-01').muc === 'dang', 'còn > 30 ngày → đang tạm ngừng')
ok(tt('2026-12-17').muc === 'sap' && tt('2026-12-17').con_ngay === 30, 'còn 30 ngày → sắp hết (nhắc khách)')
ok(tt('2026-11-24').muc === 'gap', 'còn 7 ngày → gấp')
ok(tt('2026-11-10').muc === 'qua_han' && tt('2026-11-10').con_ngay === -7, 'đã hết 7 ngày → quá hạn')
ok(tt('2026-11-10', { daCoTiepTheo: true }).muc === 'da_xu_ly', 'có hồ sơ tiếp theo → đã xử lý')
ok(trangThaiTamNgung({ tu: '2026-12-01', den: '2027-11-30' }, '2026-11-17').muc === 'chua_bat_dau', 'chưa tới ngày → chưa bắt đầu')
ok(tt('2026-12-17').han_thong_bao_tiep === hanThongBao('2026-12-18'), 'hạn thông báo gia hạn / hoạt động lại = 3 ngày làm việc trước ngày sau kết thúc')
ok(JSON.stringify(locNoiDung(['ten', 'ten', 'xyz', 'tang_von'])) === '["ten","tang_von"]', 'lọc nội dung thay đổi')

if (process.argv.includes('--that')) {
  const i = process.argv.indexOf('--that')
  const GOC = process.argv[i + 1]?.startsWith('http') ? process.argv[i + 1] : 'http://localhost:3010'
  const { createClient } = await import('@supabase/supabase-js')
  const { createServerClient } = await import('@supabase/ssr')
  const { homNayVN } = await import('../lib/phaply/hoSo.js')
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (!url || url.includes('ykorxlkgsmzskdybebzg')) throw new Error('Không phải database demo — từ chối')
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
  if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('Không phải database demo — từ chối')
  const cookieCua = async email => {
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
    return { status: r.status, data: await r.json().catch(() => ({})) }
  }
  const { data: nv } = await admin.from('staff').select('id').eq('email', 'nvphaply@demo.savitax.vn').single()
  const NV = goi(await cookieCua('nvphaply@demo.savitax.vn')), TP = goi(await cookieCua('phaply@demo.savitax.vn'))
  const hn = homNayVN(), ids = []
  try {
    const t1 = await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'tlm', entity_type: '2tv', ten_phap_nhan: 'Công ty TNHH [THỬ] nhóm thủ tục', contact_name: 'Khách Thử', contact_phone: '0909000994', note: '[TEST-API]' })
    ok(t1.status === 200, 'tạo hồ sơ thành lập', JSON.stringify(t1.data)); ids.push(t1.data.id)
    const { data: hs1 } = await admin.from('legal_cases').select('entity_id').eq('id', t1.data.id).single()
    const s = await NV('/api/admin/phaply/doanh-nghiep?q=' + encodeURIComponent('[THỬ] nhóm'))
    ok(s.data.phap_ly?.some(e => e.id === hs1.entity_id && e.lien_he?.sdt === '0909000994'), 'tìm thấy công ty đã có + người liên hệ cũ', JSON.stringify(s.data).slice(0, 200))
    ok((await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'tam_ngung', entity_id: hs1.entity_id, contact_phone: '0909000994', tam_ngung_tu: '2026-01-01', tam_ngung_den: '2027-06-01' })).status === 400, 'tạm ngừng quá 1 năm → 400')
    const tu = congNgay(hn, -300), den = congNgay(hn, 20)            // còn 20 ngày → "sắp hết"
    const t2 = await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'tam_ngung', entity_id: hs1.entity_id, case_goc_id: t1.data.id, contact_name: 'Khách Thử', contact_phone: '0909000994', tam_ngung_tu: tu, tam_ngung_den: den, note: '[TEST-API]' })
    ok(t2.status === 200, 'tạo tạm ngừng trên CÙNG công ty', JSON.stringify(t2.data)); ids.push(t2.data.id)
    const { data: hs2 } = await admin.from('legal_cases').select('entity_id, tam_ngung_den').eq('id', t2.data.id).single()
    ok(hs2.entity_id === hs1.entity_id && hs2.tam_ngung_den === den, 'dùng lại pháp nhân, lưu thời hạn')
    const ct = await NV('/api/admin/phaply/ho-so/' + t2.data.id)
    ok(ct.data.lich_su?.some(c => c.id === t1.data.id && c.la_goc) && ct.data.tam_ngung?.muc === 'sap', 'chi tiết: lịch sử công ty + trạng thái sắp hết', JSON.stringify({ ls: ct.data.lich_su, tn: ct.data.tam_ngung }))
    let l = await NV('/api/admin/phaply/ho-so?nhom=tam_ngung')
    let td = l.data.theo_doi_tam_ngung?.find(c => c.id === t2.data.id)
    ok(td?.muc === 'sap' && td.con_ngay === 20 && l.data.the.tam_ngung_can_nhac >= 1, 'trang Tạm ngừng: theo dõi + thẻ cần nhắc', JSON.stringify(td))
    ok(l.data.ho_so.every(r => ['tam_ngung', 'hoat_dong_lai'].includes(r.procedure_code)), 'trang nhóm chỉ có thủ tục của nhóm')
    const tl = await NV('/api/admin/phaply/ho-so?nhom=thanh_lap')
    ok(tl.data.ho_so.some(r => r.id === t1.data.id) && !tl.data.ho_so.some(r => r.id === t2.data.id) && tl.data.the.tam_ngung_can_nhac >= 1, 'trang Thành lập: không lẫn tạm ngừng, vẫn báo cần nhắc')
    // đóng hồ sơ tạm ngừng (trưởng phòng, kèm lý do) → vẫn theo dõi + vẫn nhắc khách được
    ok((await TP('/api/admin/phaply/ho-so/' + t2.data.id, 'PATCH', { action: 'dong', note: 'Thử: đã có thông báo tạm ngừng' })).status === 200, 'đóng hồ sơ tạm ngừng')
    ok((await NV('/api/admin/phaply/ho-so/' + t2.data.id, 'PATCH', { action: 'nhac_khach', note: 'Khách muốn hoạt động lại' })).status === 200, 'nhắc khách được cả khi hồ sơ đã đóng')
    l = await NV('/api/admin/phaply/ho-so?nhom=tam_ngung')
    td = l.data.theo_doi_tam_ngung?.find(c => c.id === t2.data.id)
    ok(td?.nhac_khach_luc && td.nhac_khach_ghi_chu === 'Khách muốn hoạt động lại' && td.muc === 'sap', 'hồ sơ đã đóng vẫn trong danh sách theo dõi, có ghi nhắc')
    const t3 = await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'hoat_dong_lai', entity_id: hs1.entity_id, case_goc_id: t2.data.id, contact_phone: '0909000994', hoat_dong_lai_tu: congNgay(den, 1), note: '[TEST-API]' })
    ok(t3.status === 200, 'tạo hoạt động lại tiếp theo'); ids.push(t3.data.id)
    l = await NV('/api/admin/phaply/ho-so?nhom=tam_ngung')
    td = l.data.theo_doi_tam_ngung?.find(c => c.id === t2.data.id)
    ok(td?.muc === 'da_xu_ly' && td.tiep_theo?.id === t3.data.id, 'có hồ sơ hoạt động lại → đã xử lý, hết cảnh báo', JSON.stringify(td))
    const t4 = await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'thay_doi', entity_id: hs1.entity_id, contact_phone: '0909000994', noi_dung_thay_doi: ['tang_von', 'dia_chi', 'la'], note: '[TEST-API]' })
    ids.push(t4.data.id)
    const { data: hs4 } = await admin.from('legal_cases').select('noi_dung_thay_doi').eq('id', t4.data.id).single()
    ok(JSON.stringify(hs4.noi_dung_thay_doi) === '["tang_von","dia_chi"]', 'thay đổi: lưu nội dung, bỏ mã lạ', JSON.stringify(hs4))
    ok((await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'thay_doi', contact_phone: '0909000994', entity_type: '1tv' })).status === 400, 'thay đổi không chọn / không nhập công ty → 400')
    // phạm vi: công ty của hồ sơ người khác không dùng lại được
    const { data: lạ } = await admin.from('legal_cases').select('entity_id').eq('is_deleted', false).neq('assigned_to', nv.id).not('assigned_to', 'is', null).not('entity_id', 'is', null).limit(1).maybeSingle()
    if (lạ) ok((await NV('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'thay_doi', entity_id: lạ.entity_id, contact_phone: '0909000994' })).status === 403, 'nhân viên không dùng được công ty của hồ sơ người khác')
  } finally {
    const { data: hs } = await admin.from('legal_cases').select('entity_id').in('id', ids)
    await admin.from('legal_case_stage_log').delete().in('case_id', ids)
    await admin.from('legal_cases').update({ case_goc_id: null }).in('id', ids)
    await admin.from('legal_cases').delete().in('id', ids)
    const ents = [...new Set((hs || []).map(h => h.entity_id).filter(Boolean))]
    if (ents.length) await admin.from('legal_entities').delete().in('id', ents)
    console.log('· đã dọn dữ liệu thử')
  }
}
console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
