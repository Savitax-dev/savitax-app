// Bộ kiểm thương hiệu: repo không còn tên / mã của đơn vị cũ ở bất cứ đâu (kế hoạch mục 4).
//   node scripts/test-phantich-thuong-hieu.mjs [file từ khóa]
// Danh sách từ khóa CỐ Ý để NGOÀI repo (mặc định C:\Users\<máy>\.savitax-keys\tu-khoa-thuong-hieu-cu.txt hoặc biến môi
// trường THUONG_HIEU_TU_KHOA), để chính repo không chứa các tên đó. Quét mọi file git theo dõi + file mới chưa bị
// .gitignore, kể cả bên trong .docx / .xlsx (giải nén đọc XML). Có thư mục .next thì quét thêm bản build tĩnh.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import PizZip from 'pizzip'

const fileTuKhoa = process.argv[2] || process.env.THUONG_HIEU_TU_KHOA || path.join(os.homedir(), '.savitax-keys', 'tu-khoa-thuong-hieu-cu.txt')
if (!fs.existsSync(fileTuKhoa)) { console.log(`Không thấy file từ khóa: ${fileTuKhoa}\n(để ngoài repo — mỗi dòng một từ khóa)`); process.exit(1) }

const boDau = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const tuKhoa = fs.readFileSync(fileTuKhoa, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
if (!tuKhoa.length) { console.log('File từ khóa rỗng'); process.exit(1) }
const mau = tuKhoa.map(t => {
  const k = boDau(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  // Chỉ bắt khi đứng riêng (không dính chữ cái hai bên) — sau khi bỏ dấu, từ khóa có thể nằm giữa một cụm khác nghĩa
  // (vd tên công ty mẫu "Tư vấn …" trong bộ máy bị bắt nhầm, soát 27/10/2026)
  return { goc: t, re: new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, 'i') }
})

const BO_QUA = [/^_kiem-xml\//, /^chrome-extension\.rar$/, /^node_modules\//]
const NHI_PHAN = new Set(['png', 'jpg', 'jpeg', 'gif', 'ico', 'ttf', 'woff', 'woff2', 'pdf', 'rar', 'zip', '7z', 'xls'])
const NEN_XML = new Set(['docx', 'xlsx', 'pptx'])

const ds = execSync('git ls-files -co --exclude-standard -z', { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean).filter(f => !BO_QUA.some(re => re.test(f)))
function tep(dir) { const ra = []; for (const d of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, d.name); if (d.isDirectory()) ra.push(...tep(p)); else ra.push(p) } return ra }
if (fs.existsSync('.next/static')) ds.push(...tep('.next/static').filter(f => /\.(js|css|html)$/.test(f)))

const trung = []
let soTep = 0
function soat(ten, noiDung) {
  const t = boDau(noiDung)
  for (const m of mau) {
    const k = t.search(m.re)
    if (k >= 0) { trung.push({ ten, tu: m.goc, doan: noiDung.slice(Math.max(0, k - 25), k + 35).replace(/\s+/g, ' ') }); return }
  }
}
for (const f of ds) {
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue
  const duoi = f.split('.').pop().toLowerCase()
  soat(f + ' (tên file)', f)
  if (NHI_PHAN.has(duoi)) continue
  soTep++
  if (NEN_XML.has(duoi)) {
    try { const zip = new PizZip(fs.readFileSync(f)); for (const [n, e] of Object.entries(zip.files)) if (!e.dir && /\.(xml|rels)$/.test(n)) soat(`${f} › ${n}`, e.asText().replace(/<[^>]+>/g, ' ')) } catch { /* không phải zip */ }
    continue
  }
  soat(f, fs.readFileSync(f, 'utf8'))
}

console.log(`Quét ${soTep} file (${tuKhoa.length} từ khóa, file từ khóa ngoài repo)`)
for (const x of trung) console.log(`  ✗ ${x.ten} — "${x.tu}": …${x.doan}…`)
console.log(trung.length ? `\n✗ ${trung.length} chỗ còn tên đơn vị cũ` : '\n✓ Không còn tên đơn vị cũ')
process.exit(trung.length ? 1 : 0)
