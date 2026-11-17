// Bộ kiểm xuất PDF phân hệ Pháp lý (lib/phaply/pdf.js + dịch vụ vps/phaply-pdf + route ho-so/[id]/pdf). Dữ liệu GIẢ.
//   node --env-file=.env.local scripts/test-phaply-pdf.mjs                 gọi thẳng dịch vụ VPS (bộ 2TV giả của bộ kiểm Word)
//   node --env-file=.env.local scripts/test-phaply-pdf.mjs --that [URL]    + qua API máy chủ thử (hồ sơ mẫu HOA SEN XANH trên DB demo)
import PizZip from 'pizzip'
import { PDFDocument } from 'pdf-lib'
import { coPdf, doiPdf, gopPdf } from '../lib/phaply/pdf.js'
import { chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { dienMau } from '../lib/phaply/word/xuat.js'
import { mauCuaBo } from '../lib/phaply/word/danhMuc.js'
import { readFileSync } from 'node:fs'
import { DU_LIEU_GIA } from './phaply-du-lieu-gia.mjs'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }
const soTrang = async b => (await PDFDocument.load(b)).getPageCount()
const chuPdf = async b => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(b), verbosity: 0 }).promise
  let s = ''
  for (let i = 1; i <= doc.numPages; i++) s += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(' ') + ' '
  return s
}

ok(coPdf(), 'đã cấu hình PHAPLY_PDF_URL / SECRET / CA')
const duLieu = chuanBiDuLieu(DU_LIEU_GIA['2tv'])
const bo = mauCuaBo('so', '2tv')
const files = bo.map(m => ({ ten: `${m.thuTu}. ${m.ten}.docx`, buf: dienMau(readFileSync(`templates/phaply/word/${m.ma}.docx`), duLieu) }))
const t0 = Date.now()
const pdfs = await doiPdf(files)
console.log(`  đổi ${files.length} file trong ${((Date.now() - t0) / 1000).toFixed(1)} giây`)
ok(pdfs.length === files.length && pdfs.every((p, i) => p.ten === files[i].ten.replace(/\.docx$/, '.pdf') && p.buf.subarray(0, 4).toString() === '%PDF'), 'đủ PDF, đúng tên, đúng thứ tự (tên tiếng Việt có dấu)')
const tong = (await Promise.all(pdfs.map(p => soTrang(p.buf)))).reduce((a, b) => a + b, 0)
const gop = await gopPdf(pdfs.map(p => p.buf))
ok(await soTrang(gop) === tong, `file gộp đủ ${tong} trang`)
const chu = await chuPdf(pdfs.find(p => /Điều lệ/.test(p.ten)).buf)
ok(chu.includes('CÔNG TY TNHH CÔNG NGHỆ BÌNH MINH') && chu.includes('LÊ THỊ BÌNH'), 'chữ tiếng Việt trong PDF đúng (tên công ty, thành viên)')
// khoá sai → bị từ chối, không lộ gì
const giu = process.env.PHAPLY_PDF_SECRET
process.env.PHAPLY_PDF_SECRET = 'sai'.repeat(20)
try { await doiPdf(files.slice(0, 1)); ok(false, 'khoá sai phải bị từ chối') } catch (e) { ok(/401/.test(e.message), 'khoá sai → 401', e.message) }
process.env.PHAPLY_PDF_SECRET = giu

if (process.argv.includes('--that')) {
  const i = process.argv.indexOf('--that')
  const GOC = process.argv[i + 1]?.startsWith('http') ? process.argv[i + 1] : 'http://localhost:3010'
  const { createClient } = await import('@supabase/supabase-js')
  const { createServerClient } = await import('@supabase/ssr')
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (!url || url.includes('ykorxlkgsmzskdybebzg')) throw new Error('Không phải database demo — từ chối')
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
  if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('Không phải database demo — từ chối')
  const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'giamdoc@demo.savitax.vn' })
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: v } = await anon.auth.verifyOtp({ email: 'giamdoc@demo.savitax.vn', token: l.properties.email_otp, type: 'email' })
  let ds = []
  const sc = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: c => { ds = c } } })
  await sc.auth.setSession({ access_token: v.session.access_token, refresh_token: v.session.refresh_token })
  const ck = ds.map(c => `${c.name}=${c.value}`).join('; ')
  const { data: hs } = await admin.from('legal_cases').select('id').eq('title', 'CÔNG TY TNHH THƯƠNG MẠI HOA SEN XANH').maybeSingle()
  if (!hs) console.log('· demo không có hồ sơ HOA SEN XANH — bỏ qua phần API')
  else {
    const lay = async q => { const r = await fetch(`${GOC}/api/admin/phaply/ho-so/${hs.id}/pdf?${q}`, { headers: { cookie: ck } }); return { st: r.status, cd: r.headers.get('content-disposition') || '', buf: Buffer.from(await r.arrayBuffer()) } }
    const z = await lay('dot=so')
    ok(z.st === 200 && /PDF\)\.zip/.test(decodeURIComponent(z.cd)), 'API: cả bộ PDF (.zip)', z.st + ' ' + z.buf.toString().slice(0, 150))
    if (z.st === 200) {
      const zip = new PizZip(z.buf), ten = Object.keys(zip.files)
      ok(ten.length === mauCuaBo('so', '1tv').length + 1 && ten.includes('00. Bo trinh ky (gop).pdf'), 'đủ PDF từng mẫu + file gộp', ten.join(' | '))
      const chuGop = await chuPdf(zip.file('00. Bo trinh ky (gop).pdf').asNodeBuffer())
      ok(chuGop.includes('HOA SEN XANH'), 'file gộp có tên công ty mẫu')
    }
    const mot = await lay('dot=so&ma=MAU2')
    ok(mot.st === 200 && mot.buf.subarray(0, 4).toString() === '%PDF', 'API: một mẫu .pdf')
    ok((await lay('dot=so&ma=MAU4')).st === 404, 'mẫu không thuộc loại hình → 404')
  }
}
console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
