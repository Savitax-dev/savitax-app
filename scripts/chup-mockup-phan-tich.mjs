// Chụp mockup Phân hệ Phân tích (docs/mockup-phan-tich/*.html) thành ảnh PNG bằng Edge chạy ngầm,
// rồi cắt khoảng trắng thừa ở chân trang (scripts/cat-anh-mockup.py, cần Python + Pillow).
// Chạy: node scripts/chup-mockup-phan-tich.mjs [tên-file.html ...]   (không truyền = chụp hết)
import { execFileSync } from 'node:child_process'
import { readdirSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const THU_MUC = resolve('docs/mockup-phan-tich')
const ANH = join(THU_MUC, 'anh')
const CAT = resolve('scripts/cat-anh-mockup.py')
mkdirSync(ANH, { recursive: true })

const ds = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(THU_MUC).filter(f => f.endsWith('.html'))

for (const f of ds) {
  const ra = join(ANH, f.replace(/\.html$/, '.png'))
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,4200',
    '--virtual-time-budget=8000', '--allow-file-access-from-files', `--screenshot=${ra}`,
    pathToFileURL(join(THU_MUC, f)).href], { stdio: 'ignore' })
  console.log(execFileSync('python', ['-I', CAT, ra], { encoding: 'utf8' }).trim())
}
