// Điền một mẫu Word phân hệ Pháp lý bằng một file hồ sơ JSON (dạng đầu vào của chuanBiDuLieu) — để đối chiếu với
// bản PDF thật của phòng. File JSON có dữ liệu khách thật thì ĐỂ NGOÀI REPO.
//   node scripts/phaply-dien-thu.mjs <MÃ> <ho-so.json> <ra.docx>
import { readFileSync, writeFileSync } from 'node:fs'
import { dongGoi } from '../lib/phaply/word/khung.js'
import { chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { dienMau } from '../lib/phaply/word/xuat.js'

const [ma, json, ra] = process.argv.slice(2)
const buf = dongGoi(readFileSync(`lib/phaply/word/nguon/${ma}.txt`, 'utf8'))
writeFileSync(ra, dienMau(buf, chuanBiDuLieu(JSON.parse(readFileSync(json, 'utf8')))))
console.log('→', ra)
