// Bộ kiểm LƯU DRIVE phân hệ Pháp lý — DB DEMO + máy chủ thử + Shared drive phòng pháp lý THẬT (thư mục PHAPLY_DRIVE_TLM):
//   node --env-file=.env.local scripts/test-phaply-drive.mjs [http://localhost:3010]
// Hồ sơ GIẢ ("[THỬ]…", dữ liệu bịa, ảnh CCCD giả 1 điểm ảnh) → lưu Drive → kiểm 8 thư mục con, đủ file Word, ảnh CCCD → lưu lần 2
// không sinh file trùng → BỎ VÀO THÙNG RÁC thư mục thử + xoá sạch dữ liệu thử trong DB / kho ảnh.
import { createSign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { trashFile } from '../lib/googleDrive.js'
import { THU_MUC } from '../lib/phaply/drive.js'
import { mauCuaBo } from '../lib/phaply/word/danhMuc.js'

const GOC = process.argv[2] || 'http://localhost:3010'
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
if (!url || url.includes('ykorxlkgsmzskdybebzg')) throw new Error('Không phải database demo — từ chối')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('Không phải database demo — từ chối')
if (!process.env.PHAPLY_DRIVE_TLM) throw new Error('Thiếu PHAPLY_DRIVE_TLM')

let loi = 0, dem = 0
const kiem = (ten, dk, ct = '') => { dem++; if (!dk) { loi++; console.log('✗', ten, ct) } else console.log('✓', ten) }

async function cookieCua(email) {
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
const goi = async (path, method = 'GET', body) => {
  const r = await fetch(GOC + path, { method, headers: { cookie: ck, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}
// đọc Drive (chỉ đọc) bằng tài khoản dịch vụ
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
async function token() {
  const now = Math.floor(Date.now() / 1000)
  const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const c = b64url(JSON.stringify({ iss: process.env.GOOGLE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 }))
  const s = createSign('RSA-SHA256'); s.update(h + '.' + c)
  const jwt = h + '.' + c + '.' + b64url(s.sign(String(process.env.GOOGLE_SA_PRIVATE_KEY).replace(/\\n/g, '\n')))
  return (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt })).json()).access_token
}
const TK = await token()
const con = async id => {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&pageSize=200&fields=files(id,name,mimeType)&q=${encodeURIComponent(`'${id}' in parents and trashed = false`)}`, { headers: { Authorization: 'Bearer ' + TK } })
  return (await r.json()).files || []
}

const { data: gd } = await admin.from('staff').select('id').eq('email', 'giamdoc@demo.savitax.vn').single()
const tao = await goi('/api/admin/phaply/ho-so', 'POST', { procedure_code: 'tlm', entity_type: '1tv', ten_phap_nhan: 'Công ty TNHH [THỬ] lưu Drive', contact_name: 'Khách Thử', contact_phone: '0909000997', source: 'moi', note: '[TEST-API]', assigned_to: gd.id })
kiem('tạo hồ sơ thử 1TV', tao.status === 200, JSON.stringify(tao.data))
const id = tao.data.id
let folderId = null, pid = null
const anh = `${id}/00000000-gia-truoc.png`
try {
  const P = `/api/admin/phaply/ho-so/${id}/phap-nhan`
  await goi(P, 'PATCH', { action: 'cty', fields: { von_dieu_le: 1e9, phone: '0280000000' } })
  await admin.storage.from('phaply-cccd').upload(anh, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), { contentType: 'image/png', upsert: true })
  const n = await goi(P, 'PATCH', { action: 'nguoi', nguoi: { ho_ten: 'Thử Văn Drive', gioi_tinh: 'Nam', so_giay_to: '079090000909', cccd_front_path: anh },
    vai_tro: [{ vai_tro: 'dai_dien', chuc_danh: 'Giám đốc' }, { vai_tro: 'chu_so_huu' }] })
  pid = n.data.id

  const l1 = await goi(`/api/admin/phaply/ho-so/${id}/drive`, 'POST', {})
  kiem('lưu Drive lần 1', l1.status === 200 && l1.data.url, JSON.stringify(l1.data))
  const { data: hs } = await admin.from('legal_cases').select('drive_folder_id, drive_saved_at, code').eq('id', id).single()
  folderId = hs.drive_folder_id
  kiem('ghi id thư mục + giờ lưu vào hồ sơ', !!folderId && !!hs.drive_saved_at)
  if (folderId) {
    const tang1 = await con(folderId)
    kiem('đủ 8 thư mục con đúng tên', Object.values(THU_MUC).every(t => tang1.some(f => f.name === t)) && tang1.length === 8, tang1.map(f => f.name).join(', '))
    const soan = tang1.find(f => f.name === THU_MUC.soan)
    const bo = soan ? await con(soan.id) : []
    let soDocx = 0
    for (const b of bo) soDocx += (await con(b.id)).length
    const canCo = mauCuaBo('so', '1tv').length + mauCuaBo('thue', '1tv').length + 2
    kiem(`4. SOẠN HỒ SƠ có 2 bộ, ${canCo} file Word (gồm 2 tờ hướng dẫn in ký)`, bo.length === 2 && soDocx === canCo, `${bo.length} bộ, ${soDocx} file`)
    const tt = tang1.find(f => f.name === THU_MUC.thu_thap)
    const cccd = (await con(tt.id)).find(f => f.name === 'CCCD')
    const fCccd = cccd ? await con(cccd.id) : []
    kiem('ảnh CCCD vào 2. THU THẬP THÔNG TIN/CCCD đặt tên theo người', fCccd.length === 1 && fCccd[0].name === 'CCCD - Thử Văn Drive - mặt trước.png', fCccd.map(f => f.name).join(', '))
    const l2 = await goi(`/api/admin/phaply/ho-so/${id}/drive`, 'POST', {})
    const tang1b = await con(folderId)
    let soDocx2 = 0
    for (const b of await con(tang1b.find(f => f.name === THU_MUC.soan).id)) soDocx2 += (await con(b.id)).length
    kiem('lưu lần 2 ghi đè, không sinh thư mục / file trùng', l2.status === 200 && tang1b.length === 8 && soDocx2 === soDocx, `${tang1b.length} thư mục, ${soDocx2} file`)

    // Tệp scan (GĐ 4): tải PDF giả vào 5. TRÌNH KÝ → có trên Drive + chỉ mục → xoá → vào thùng rác
    const fd = new FormData()
    fd.append('file', new Blob([Buffer.from('%PDF-1.4\n% tep gia de thu\n')], { type: 'application/pdf' }), 'Ban ky thu.pdf')
    fd.append('thu_muc', 'trinh_ky')
    const t = await fetch(GOC + `/api/admin/phaply/ho-so/${id}/tep`, { method: 'POST', headers: { cookie: ck }, body: fd })
    kiem('tải tệp scan lên Drive', t.status === 200, String(t.status) + ' ' + (await t.text()).slice(0, 200))
    const tk = tang1b.find(f => f.name === THU_MUC.trinh_ky)
    kiem('tệp nằm trong 5. TRÌNH KÝ', (await con(tk.id)).some(f => f.name === 'Ban ky thu.pdf'))
    const { data: tep } = await admin.from('legal_case_files').select('id').eq('case_id', id)
    kiem('ghi chỉ mục tệp', tep?.length === 1)
    const x = await goi(`/api/admin/phaply/ho-so/${id}/tep?id=${tep?.[0]?.id}`, 'DELETE')
    kiem('xoá tệp → bỏ thùng rác Drive + xoá chỉ mục', x.status === 200 && !(await con(tk.id)).length && !(await admin.from('legal_case_files').select('id').eq('case_id', id)).data.length)
  }
} finally {
  if (folderId) { await trashFile(folderId); console.log('· đã bỏ thư mục thử trên Drive vào thùng rác') }
  await admin.storage.from('phaply-cccd').remove([anh])
  const { data: hs } = await admin.from('legal_cases').select('entity_id').eq('id', id).maybeSingle()
  await admin.from('legal_case_stage_log').delete().eq('case_id', id)
  await admin.from('legal_cases').delete().eq('id', id)
  if (hs?.entity_id) await admin.from('legal_entities').delete().eq('id', hs.entity_id)
  if (pid) await admin.from('legal_people').delete().eq('id', pid).is('staff_id', null)
  console.log('· đã dọn dữ liệu thử')
}
console.log(loi ? `✗ ${loi}/${dem} kiểm sai` : `✓ ${dem} kiểm đúng`)
process.exit(loi ? 1 : 0)
