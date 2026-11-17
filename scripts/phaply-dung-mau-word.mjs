// Phân hệ Pháp lý — dựng file Word mẫu từ văn bản nguồn:
//   lib/phaply/word/nguon/<MÃ>.txt  →  templates/phaply/word/<MÃ>.docx
//   node scripts/phaply-dung-mau-word.mjs [MÃ …]
// Cú pháp văn bản nguồn: đầu file lib/phaply/word/khung.js.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dongGoi } from '../lib/phaply/word/khung.js'
import { DANH_MUC } from '../lib/phaply/word/danhMuc.js'

const NGUON = 'lib/phaply/word/nguon', RA = 'templates/phaply/word'
mkdirSync(RA, { recursive: true })
const chon = process.argv.slice(2)
const ds = readdirSync(NGUON).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4)).filter(m => !chon.length || chon.includes(m))
for (const ma of ds) {
  const meta = DANH_MUC.find(d => d.ma === ma)
  if (!meta) { console.log('⚠ chưa khai ở danhMuc.js:', ma); continue }
  const buf = dongGoi(readFileSync(`${NGUON}/${ma}.txt`, 'utf8'), { tieuDe: meta.ten })
  writeFileSync(`${RA}/${ma}.docx`, buf)
  console.log('→', `${RA}/${ma}.docx`, (buf.length / 1024).toFixed(1) + ' KB')
}
