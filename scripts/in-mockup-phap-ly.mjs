// In mockup Phân hệ Phòng Pháp lý (docs/mockup-phap-ly/*.html) ra MỘT file PDF trình bày.
// In thẳng HTML → PDF bằng Edge chạy ngầm (chữ là chữ thật, phóng to vẫn nét — không phải ảnh chụp),
// mỗi màn một trang đúng khổ màn hình (đặt ở cheDoIn() trong _khung.js khi mở với ?in=1), rồi ghép bằng pdf-lib.
// Chạy: node scripts/in-mockup-phap-ly.mjs   → docs/mockup-phap-ly/Mockup-Phan-he-Phap-ly.pdf
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const THU_MUC = resolve('docs/mockup-phap-ly')
const TAM = join(THU_MUC, '_in-tam')
const RA = join(THU_MUC, 'Mockup-Phan-he-Phap-ly.pdf')
mkdirSync(TAM, { recursive: true })

const manHinh = readdirSync(THU_MUC).filter(f => /^\d\d-.*\.html$/.test(f)).sort()
const thuTu = ['00-bia.html', 'index.html', ...manHinh.filter(f => f !== '00-bia.html')]

const tong = await PDFDocument.create()
tong.setTitle('Phân hệ Phòng Pháp lý — mockup giao diện')
tong.setAuthor('Savitax')
for (const f of thuTu) {
  const pdf = join(TAM, f.replace(/\.html$/, '.pdf'))
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf-no-header',
    '--virtual-time-budget=12000', '--allow-file-access-from-files', `--print-to-pdf=${pdf}`,
    pathToFileURL(join(THU_MUC, f)).href + '?in=1'], { stdio: 'ignore' })
  const doc = await PDFDocument.load(readFileSync(pdf))
  const trang = await tong.copyPages(doc, doc.getPageIndices())
  trang.forEach(p => tong.addPage(p))
  console.log(f.padEnd(34), doc.getPageCount(), 'trang')
}
writeFileSync(RA, await tong.save())
rmSync(TAM, { recursive: true, force: true })
console.log('→', RA, tong.getPageCount(), 'trang')
