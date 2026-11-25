// Bộ kiểm mẫu Word phân hệ Pháp lý (offline, dữ liệu GIẢ):
//   node scripts/test-phaply-word.mjs [--ra <thư mục>] [--pdf] [MÃ …]
// 1. Dựng lại mọi mẫu từ lib/phaply/word/nguon/*.txt
// 2. Mỗi thẻ trong mẫu phải có trong từ điển trường (chuanBiDuLieu) — kể cả thẻ nằm trong vòng lặp
// 3. Điền dữ liệu giả cho từng loại hình áp dụng → không còn thẻ sót "{…}", không lỗi docxtemplater
// 4. --pdf: đổi bằng Microsoft Word (scripts/phaply-word-sang-pdf.ps1) — Word mở được, đếm số trang
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import PizZip from 'pizzip'
import { dongGoi } from '../lib/phaply/word/khung.js'
import { DANH_MUC } from '../lib/phaply/word/danhMuc.js'
import { chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { dienMau } from '../lib/phaply/word/xuat.js'
const THIEU = '⟦THIẾU⟧'
import { DU_LIEU_GIA } from './phaply-du-lieu-gia.mjs'

const thamSo = process.argv.slice(2)
const ra = resolve(thamSo.includes('--ra') ? thamSo[thamSo.indexOf('--ra') + 1] : join(tmpdir(), 'phaply-word-test'))
const chon = thamSo.filter((t, i) => /^[A-Z0-9_]+$/.test(t) && thamSo[i - 1] !== '--ra')
mkdirSync(ra, { recursive: true })

const chuTrongDocx = buf => new PizZip(buf).file('word/document.xml').asText()
  .replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

// Thẻ theo phạm vi: [{ten, pham_vi: ['thanh_vien', …]}]
function theVaPhamVi(text) {
  const ds = [], ngan = []
  for (const m of text.matchAll(/\{([#^/]?)([a-z0-9_]+)\}/g)) {
    const [, k, ten] = m
    if (k === '/') { if (ngan[ngan.length - 1] !== ten) return { loi: `đóng {/${ten}} không khớp mở {#${ngan[ngan.length - 1]}}` }; ngan.pop(); continue }
    ds.push({ ten, pham_vi: [...ngan] })
    if (k) ngan.push(ten)
  }
  if (ngan.length) return { loi: `chưa đóng {#${ngan.join('}, {#')}}` }
  return { ds }
}

function coTruong(duLieu, { ten, pham_vi }) {
  // docxtemplater tìm từ phạm vi trong cùng ra ngoài
  const tang = [duLieu]
  for (const s of pham_vi) { const v = tang[tang.length - 1]?.[s] ?? duLieu[s]; tang.push(Array.isArray(v) ? v[0] || {} : duLieu) }
  return tang.some(o => o && Object.prototype.hasOwnProperty.call(o, ten))
}

let loi = 0, soFile = 0
const dsMau = DANH_MUC.filter(m => !chon.length || chon.includes(m.ma))
for (const m of dsMau) {
  const nguon = `lib/phaply/word/nguon/${m.ma}.txt`
  if (!existsSync(nguon)) { console.log(`·  ${m.ma.padEnd(11)} chưa có văn bản nguồn`); continue }
  let buf
  try { buf = dongGoi(readFileSync(nguon, 'utf8'), { tieuDe: m.ten }) } catch (e) { console.log(`✗ ${m.ma} dựng lỗi: ${e.message}`); loi++; continue }
  writeFileSync(`templates/phaply/word/${m.ma}.docx`, buf)
  const pv = theVaPhamVi(chuTrongDocx(buf))
  if (pv.loi) { console.log(`✗ ${m.ma}: ${pv.loi}`); loi++; continue }
  const ghiChu = []
  // mỗi loại hình chạy MỌI bộ dữ liệu giả khai ở DANH_MUC.duLieuThu (VD 1TV: chủ sở hữu cá nhân + chủ sở hữu là tổ chức)
  for (const lh of m.loaiHinh.flatMap(l => [].concat(m.duLieuThu?.[l] || l)).filter(k => DU_LIEU_GIA[k])) {
    const duLieu = chuanBiDuLieu(DU_LIEU_GIA[lh])
    const thieu = [...new Set(pv.ds.filter(t => !coTruong(duLieu, t)).map(t => [...t.pham_vi, t.ten].join('.')))]
    if (thieu.length) { console.log(`✗ ${m.ma} [${lh}] thẻ không có trong từ điển: ${thieu.join(', ')}`); loi++; continue }
    let out
    try { out = dienMau(buf, duLieu, { choTrong: THIEU }) } catch (e) {
      const ct = e.properties?.errors?.map(x => x.properties?.explanation).join('; ') || e.message
      console.log(`✗ ${m.ma} [${lh}] docxtemplater: ${ct}`); loi++; continue
    }
    const chu = chuTrongDocx(out)
    const sot = chu.match(/\{[#^/]?[a-z0-9_]+\}/g)
    if (sot) { console.log(`✗ ${m.ma} [${lh}] còn thẻ: ${[...new Set(sot)].join(' ')}`); loi++; continue }
    const trong = chu.split(THIEU).length - 1
    if (trong) ghiChu.push(`${lh}: ${trong} ô thiếu dữ liệu`)
    writeFileSync(join(ra, `${m.ma}_${lh}.docx`), out); soFile++
  }
  console.log(`✓ ${m.ma.padEnd(11)} ${pv.ds.length} thẻ · ${m.loaiHinh.join('/')}${ghiChu.length ? ' · ' + ghiChu.join(', ') : ''}`)
}

if (thamSo.includes('--pdf') && soFile) {
  const kq = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/phaply-word-sang-pdf.ps1', ra], { encoding: 'utf8' })
  for (const d of kq.trim().split(/\r?\n/)) { console.log('  Word:', d); if (d.startsWith('LOI')) loi++ }
}
console.log(`\n${loi ? '✗ ' + loi + ' lỗi' : '✓ không lỗi'} — file điền thử ở ${ra}`)
process.exit(loi ? 1 : 0)
