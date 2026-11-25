// Bộ kiểm API dữ liệu pháp nhân (sql/57) trên DATABASE DEMO + máy chủ thử đang chạy (KHÔNG BAO GIỜ production):
//   node --env-file=.env.local scripts/test-phaply-phap-nhan-api.mjs [http://localhost:3010]
// Hồ sơ TNHH 2TV thử: địa chỉ trụ sở theo danh mục → gợi ý Phòng ĐKKD + Thuế cơ sở; thêm 3 người (một người 2 vai trò),
// ngành nghề; "Còn thiếu gì" hết mục chặn; xuất bộ Word (.zip đủ file, có tên công ty + tên thành viên); nhân viên khác
// không mở được hồ sơ người khác; trang Thông tin cá nhân chỉ đụng dòng của chính mình. Dọn sạch dữ liệu thử ở cuối.
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import PizZip from 'pizzip'
import { mauCuaBo } from '../lib/phaply/word/danhMuc.js'

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
const goiBin = (cookie) => async (path) => {
  const r = await fetch(GOC + path, { headers: { cookie } })
  return { status: r.status, cd: r.headers.get('content-disposition') || '', buf: Buffer.from(await r.arrayBuffer()) }
}

const { data: gd } = await admin.from('staff').select('id, email').eq('email', 'giamdoc@demo.savitax.vn').single()
const { data: nvPl } = await admin.from('staff').select('id, email').eq('email', 'nvphaply@demo.savitax.vn').maybeSingle()
const ckGd = await cookieCua(gd.email)
const L = goi(ckGd), B = goiBin(ckGd)

const { data: xa } = await admin.from('legal_places').select('ma, ten, ma_tinh').eq('cap', 'xa').eq('ma_tinh', '79').order('ma').limit(1).single()
const { data: tinh } = await admin.from('legal_places').select('ma, ten').eq('ma', '79').single()
const tao = await L('/api/admin/phaply/ho-so', 'POST', {
  procedure_code: 'tlm', entity_type: '2tv', ten_phap_nhan: 'Công ty TNHH thử pháp nhân', contact_name: 'Khách Thử', contact_phone: '0909000998',
  source: 'moi', note: '[TEST-API]', assigned_to: gd.id,
})
kiem('tạo hồ sơ 2TV', tao.status === 200, JSON.stringify(tao.data))
const id = tao.data.id, nguoiTao = []
let caNhanMoi = false
try {
  const P = '/api/admin/phaply/ho-so/' + id + '/phap-nhan'
  let pn = await L(P)
  kiem('đọc pháp nhân', pn.status === 200 && pn.data.entity?.name === 'CÔNG TY TNHH THỬ PHÁP NHÂN', JSON.stringify(pn.data).slice(0, 200))
  kiem('hồ sơ trống báo thiếu người đại diện + thành viên', pn.data.thieu.so.some(t => /đại diện/.test(t.muc)) && pn.data.thieu.so.some(t => /2 thành viên/.test(t.muc)))

  const cty = await L(P, 'PATCH', { action: 'cty', fields: {
    tru_so_so_nha: '1 Đường Thử', tru_so_ma_xa: xa.ma, tru_so_xa: xa.ten, tru_so_ma_tinh: '79', tru_so_tinh: tinh.ten,
    phone: '0280000000', von_dieu_le: '1.000.000.000', so_lao_dong: '5', ten_khong_cho_phep: 'x',
  } })
  kiem('lưu doanh nghiệp + gợi ý cơ quan theo địa chỉ', cty.status === 200 && /Đăng ký kinh doanh/.test(cty.data.goi_y?.phong_dkkd) && /^Thuế cơ sở/.test(cty.data.goi_y?.co_quan_thue), JSON.stringify(cty.data))
  const { data: ent } = await admin.from('legal_entities').select('*').eq('id', pn.data.entity.id).single()
  kiem('vốn điều lệ đổi số đúng (1.000.000.000)', Number(ent.von_dieu_le) === 1e9, ent.von_dieu_le)
  kiem('cột address ghép lại từ trụ sở', ent.address === `1 Đường Thử, ${xa.ten}, ${tinh.ten}`, ent.address)

  const dc = { so_nha: '9 Phố Thử', ma_xa: xa.ma, xa: xa.ten, ma_tinh: '79', tinh: tinh.ten }
  const ng = (ho_ten, gioi_tinh, so) => ({ ho_ten, gioi_tinh, ngay_sinh: '01/01/1990', dan_toc: 'Kinh', quoc_tich: 'Việt Nam', loai_giay_to: 'Căn cước công dân',
    so_giay_to: so, ngay_cap: '01/01/2022', noi_cap: 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội', thuong_tru: dc, lien_lac: {} })
  const a = await L(P, 'PATCH', { action: 'nguoi', nguoi: ng('Thử Văn Một', 'Nam', '079 090 000 901'), vai_tro: [
    { vai_tro: 'dai_dien', chuc_danh: 'Giám đốc' }, { vai_tro: 'thanh_vien', von_gop: 600000000, thoi_han_gop: '90 ngày', chu_tich: true }] })
  kiem('thêm người 2 vai trò', a.status === 200 && a.data.id, JSON.stringify(a.data)); nguoiTao.push(a.data.id)
  const b = await L(P, 'PATCH', { action: 'nguoi', nguoi: ng('Thử Thị Hai', 'Nữ', '079190000902'), vai_tro: [{ vai_tro: 'thanh_vien', von_gop: 400000000, chu_tich: true }] })
  nguoiTao.push(b.data.id)
  const c = await L(P, 'PATCH', { action: 'nguoi', nguoi: ng('Người Gỡ', 'Nam', '079090000903'), vai_tro: [{ vai_tro: 'ke_toan' }] })
  nguoiTao.push(c.data.id)
  kiem('không vai trò → 400', (await L(P, 'PATCH', { action: 'nguoi', nguoi: ng('X', 'Nam', '1'), vai_tro: [] })).status === 400)
  kiem('vai trò lạ bị bỏ → 400', (await L(P, 'PATCH', { action: 'nguoi', nguoi: ng('X', 'Nam', '1'), vai_tro: [{ vai_tro: 'admin' }] })).status === 400)
  pn = await L(P)
  const tv = pn.data.vai_tro.filter(v => v.vai_tro === 'thanh_vien')
  kiem('chỉ còn một Chủ tịch HĐTV (người sau thắng)', tv.filter(v => v.chu_tich).length === 1 && tv.find(v => v.chu_tich)?.nguoi.ho_ten === 'Thử Thị Hai')
  kiem('số giấy tờ bỏ khoảng trắng', pn.data.vai_tro.some(v => v.nguoi.so_giay_to === '079090000901'))
  kiem('gỡ người', (await L(P, 'PATCH', { action: 'bo_nguoi', person_id: c.data.id })).status === 200)
  const { data: conNguoi } = await admin.from('legal_people').select('id').eq('id', c.data.id)
  kiem('người không còn gắn đâu thì xoá hẳn', !conNguoi.length)

  kiem('lưu ngành nghề', (await L(P, 'PATCH', { action: 'nganh', nganh: [
    { ma: '7020', ten: 'Hoạt động tư vấn quản lý kinh doanh và hoạt động tư vấn quản lý khác', chinh: true },
    { ma: '7310', ten: 'Quảng cáo', chi_tiet: 'Trừ quảng cáo thuốc lá' }, { ma: '', ten: 'bỏ' }] })).status === 200)
  pn = await L(P)
  kiem('ngành giữ thứ tự, bỏ dòng thiếu mã', pn.data.nganh.length === 2 && pn.data.nganh[0].ma === '7020' && pn.data.nganh[1].chi_tiet === 'Trừ quảng cáo thuốc lá')
  const chanSo = pn.data.thieu.so.filter(t => t.chan).map(t => t.muc)
  kiem('đợt nộp sở chỉ còn thiếu người được ủy quyền (giám đốc demo chưa nhập thông tin cá nhân)', chanSo.every(m => /ủy quyền/.test(m)), chanSo.join(' | '))

  // Ảnh CCCD: chỉ nhận đường dẫn trong thư mục của CHÍNH hồ sơ; bản demo không nhận ảnh
  {
    const fd = new FormData()
    fd.append('truoc', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'gia.png')
    const r = await fetch(GOC + `/api/admin/phaply/ho-so/${id}/cccd`, { method: 'POST', headers: { cookie: ckGd }, body: fd })
    const j = await r.json().catch(() => ({}))
    if (r.status === 403) kiem('bản demo từ chối nhận ảnh CCCD', /demo/i.test(j.error || ''), JSON.stringify(j))
    else kiem('tải ảnh CCCD lưu vào thư mục hồ sơ', r.status === 200 && j.duong_dan?.truoc?.startsWith(id + '/'), JSON.stringify(j))
    const pid = a.data.id
    await L(P, 'PATCH', { action: 'nguoi', nguoi: { id: pid, ...ng('Thử Văn Một', 'Nam', '079090000901'), cccd_front_path: 'hoso-khac/x-truoc.jpg', cccd_back_path: `${id}/abc-sau.jpg` },
      vai_tro: [{ vai_tro: 'dai_dien', chuc_danh: 'Giám đốc' }, { vai_tro: 'thanh_vien', von_gop: 600000000, thoi_han_gop: '90 ngày' }] })
    const { data: pp } = await admin.from('legal_people').select('cccd_front_path, cccd_back_path').eq('id', pid).single()
    kiem('không gắn được ảnh của hồ sơ khác, gắn được ảnh của hồ sơ này', !pp.cccd_front_path && pp.cccd_back_path === `${id}/abc-sau.jpg`, JSON.stringify(pp))
    // demo: tài khoản không thuộc phòng pháp lý bị chặn xem ảnh trước (403, sửa 17/11/2026) — cả hai đều là KHÔNG xem được
    kiem('xem ảnh ngoài thư mục hồ sơ → 400 / 403', [400, 403].includes((await L(`/api/admin/phaply/ho-so/${id}/cccd?path=${encodeURIComponent('hoso-khac/x.jpg')}`)).status))
    // trả lại chủ tịch cho Thử Thị Hai (lần lưu trên bỏ dấu chủ tịch của người Một — đúng ý, kiểm phía dưới không phụ thuộc)
  }

  // Xuất Word
  const z = await B(`/api/admin/phaply/ho-so/${id}/word?dot=so`)
  kiem('xuất cả bộ .zip', z.status === 200 && /\.zip/.test(z.cd), z.status + ' ' + z.buf.toString().slice(0, 200))
  if (z.status === 200) {
    const zip = new PizZip(z.buf)
    const ten = Object.keys(zip.files)
    kiem('đủ file trong bộ + hướng dẫn in ký', ten.length === mauCuaBo('so', '2tv').filter(m => !m.dieuKien).length + 1,   // tờ có điều kiện (thành viên là tổ chức…) không có ở hồ sơ này
      ten.join(', '))
    const dl = zip.file(ten.find(t => /Điều lệ/.test(t)) || '')
    const xml = dl ? new PizZip(dl.asNodeBuffer()).file('word/document.xml').asText().replace(/<[^>]+>/g, '') : ''
    kiem('Điều lệ có tên công ty + thành viên + ngành', xml.includes('CÔNG TY TNHH THỬ PHÁP NHÂN') && xml.includes('THỬ THỊ HAI') && xml.includes('Trừ quảng cáo thuốc lá'))
  }
  const m1 = await B(`/api/admin/phaply/ho-so/${id}/word?dot=thue&ma=BBH_HDTV`)
  kiem('xuất một file .docx', m1.status === 200 && /\.docx/.test(m1.cd))
  kiem('mẫu không thuộc loại hình → 404', (await B(`/api/admin/phaply/ho-so/${id}/word?dot=so&ma=MAU4`)).status === 404)
  kiem('thiếu đợt → 400', (await B(`/api/admin/phaply/ho-so/${id}/word`)).status === 400)

  // Phạm vi: nhân viên pháp lý không phụ trách hồ sơ này
  if (nvPl) {
    const ckNv = await cookieCua(nvPl.email)
    const N = goi(ckNv)
    kiem('nhân viên khác không đọc được pháp nhân (404)', (await N(P)).status === 404)
    kiem('nhân viên khác không sửa được (404)', (await N(P, 'PATCH', { action: 'cty', fields: { phone: '1' } })).status === 404)
    kiem('nhân viên khác không xuất Word được (404)', (await goiBin(ckNv)(`/api/admin/phaply/ho-so/${id}/word?dot=so`)).status === 404)
    const { data: coSan } = await admin.from('legal_people').select('id').eq('staff_id', nvPl.id).maybeSingle()
    caNhanMoi = !coSan
    const t1 = await N('/api/admin/phaply/toi')
    kiem('thông tin cá nhân: chưa có thì gợi ý từ hồ sơ nhân viên', t1.status === 200 && (coSan ? !!t1.data.nguoi : !!t1.data.goi_y?.ho_ten))
    kiem('lưu thông tin cá nhân', (await N('/api/admin/phaply/toi', 'PUT', { ...ng('Đinh Ngọc Hân', 'Nữ', '079196000990'), staff_id: gd.id })).status === 200)
    const { data: cn } = await admin.from('legal_people').select('staff_id, so_giay_to').eq('staff_id', nvPl.id).single()
    kiem('dòng cá nhân gắn đúng người đăng nhập (không nhận staff_id gửi lên)', cn?.so_giay_to === '079196000990')
    const { data: cuaGd } = await admin.from('legal_people').select('id').eq('staff_id', gd.id)
    kiem('không ghi được thông tin cá nhân của người khác', !cuaGd.length)
  }
} finally {
  const { data: hs } = await admin.from('legal_cases').select('entity_id').eq('id', id).maybeSingle()
  await admin.from('legal_case_stage_log').delete().eq('case_id', id)
  await admin.from('legal_cases').delete().eq('id', id)
  if (hs?.entity_id) await admin.from('legal_entities').delete().eq('id', hs.entity_id)
  if (nguoiTao.length) await admin.from('legal_people').delete().in('id', nguoiTao.filter(Boolean)).is('staff_id', null)
  if (caNhanMoi && nvPl) await admin.from('legal_people').delete().eq('staff_id', nvPl.id)
  console.log('· đã dọn dữ liệu thử')
}
console.log(loi ? `✗ ${loi}/${dem} kiểm sai` : `✓ ${dem} kiểm đúng`)
process.exit(loi ? 1 : 0)
