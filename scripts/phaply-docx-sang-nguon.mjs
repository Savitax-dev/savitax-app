// Chuyển MỘT file .docx mẫu của phòng pháp lý thành văn bản nguồn theo cú pháp lib/phaply/word/khung.js (bản nháp để soạn mẫu mới):
//   node scripts/phaply-docx-sang-nguon.mjs <mau.docx> [> ra.txt]
// Giữ: canh lề (#c / #r / #l / đều), đậm / nghiêng cả đoạn hoặc từng cụm (**…** / *…*), SỐ TỰ ĐỘNG của Word ("Điều 1.", "a)",
// "1.2" — đọc numbering.xml, mất cái này là mất số điều), bảng (::bang, độ rộng cột theo tblGrid, ô gộp ngang << / dọc ^^),
// đoạn trống (~). KHÔNG giữ: số trang, ngắt trang (pháp lý chốt 25/11/2026 không dùng), ảnh, chú thích cuối trang.
// Sau khi chuyển: thay chỗ chấm / "[…]" bằng thẻ {…} của từ điển duLieu.js, rồi chạy test-phaply-word + test-phaply-ngat-trang.
import { readFileSync } from 'node:fs'
import PizZip from 'pizzip'

const z = new PizZip(readFileSync(process.argv[2]))
const xml = z.file('word/document.xml').asText()
const numXml = z.file('word/numbering.xml')?.asText() || ''
const styXml = z.file('word/styles.xml')?.asText() || ''

const giaiMa = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const thuocTinh = (tag, ten) => (tag.match(new RegExp(`w:${ten}="([^"]*)"`)) || [])[1]

// ── numbering: numId → abstractNumId → mức → { fmt, text, start } ──
const absMap = {}
for (const m of numXml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
  const lv = {}
  for (const l of m[2].matchAll(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
    lv[l[1]] = { start: +(l[2].match(/<w:start w:val="(\d+)"/) || [, 1])[1], fmt: (l[2].match(/<w:numFmt w:val="([^"]+)"/) || [, 'decimal'])[1],
      text: giaiMa((l[2].match(/<w:lvlText w:val="([^"]*)"/) || [, ''])[1]) }
  }
  absMap[m[1]] = lv
}
const numMap = {}
for (const m of numXml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) numMap[m[1]] = (m[2].match(/<w:abstractNumId w:val="(\d+)"/) || [])[1]
// kiểu đoạn có gắn số (heading "Điều %1.")
const kieuSo = {}
for (const m of styXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
  const n = m[2].match(/<w:numId w:val="(\d+)"/); if (n) kieuSo[m[1]] = { numId: n[1], ilvl: (m[2].match(/<w:ilvl w:val="(\d+)"/) || [, '0'])[1] }
}
const demSo = {}   // abstractNumId → [đếm mức 0..8]
const chuCai = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26) } return s }
const laMa = n => [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]].reduce((s, [k, v]) => { while (n >= v) { s += k; n -= v } return s }, '')
const dinhDang = (fmt, n) => fmt === 'lowerLetter' ? chuCai(n) : fmt === 'upperLetter' ? chuCai(n).toUpperCase() : fmt === 'lowerRoman' ? laMa(n).toLowerCase() : fmt === 'upperRoman' ? laMa(n) : fmt === 'bullet' ? '' : fmt === 'none' ? '' : String(n)
function nhanSo(numId, ilvl) {
  const abs = numMap[numId]; const lv = abs && absMap[abs]; if (!lv || !lv[ilvl] || numId === '0') return ''
  const d = (demSo[abs] ||= Array(9).fill(0))
  const i = +ilvl
  d[i] = d[i] ? d[i] + 1 : lv[ilvl].start
  for (let k = i + 1; k < 9; k++) d[k] = 0
  if (lv[ilvl].fmt === 'bullet') return lv[ilvl].text.trim() ? '- ' : ''
  return lv[ilvl].text.replace(/%(\d)/g, (_, j) => dinhDang(lv[j - 1]?.fmt || 'decimal', d[j - 1] || lv[j - 1]?.start || 1)) + ' '
}

// ── một đoạn → dòng nguồn ──
function doan(p, trongO = false) {
  const pPr = (p.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/) || [, ''])[1]
  const jc = thuocTinh((pPr.match(/<w:jc [^>]*>/) || [''])[0], 'val')
  let numId = thuocTinh((pPr.match(/<w:numId [^>]*>/) || [''])[0], 'val'), ilvl = thuocTinh((pPr.match(/<w:ilvl [^>]*>/) || [''])[0], 'val') || '0'
  const sty = thuocTinh((pPr.match(/<w:pStyle [^>]*>/) || [''])[0], 'val')
  if (!numId && sty && kieuSo[sty]) ({ numId, ilvl } = kieuSo[sty])
  const runs = [...p.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)].map(r => {
    const rPr = (r[1].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [, ''])[1]
    const b = /<w:b\/>|<w:b w:val="(1|true)"/.test(rPr), i = /<w:i\/>|<w:i w:val="(1|true)"/.test(rPr)
    let t = ''
    for (const x of r[1].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) t += x[1] !== undefined ? giaiMa(x[1]) : x[0] === '<w:tab/>' ? '[>]' : ' '
    return { t, b, i }
  }).filter(r => r.t)
  const nhan = numId ? nhanSo(numId, ilvl) : ''
  const chu = runs.map(r => r.t).join('')
  if (!chu.trim() && !nhan) return '~'
  const coChu = runs.filter(r => r.t.trim())
  const datB = coChu.length && coChu.every(r => r.b), datI = coChu.length && coChu.every(r => r.i)
  let than = datB && datI ? runs.map(r => r.t).join('') : runs.map(r => {
    let t = r.t.replace(/\*/g, '\\*')
    if (!datI && r.i && t.trim()) t = '*' + t + '*'
    if (!datB && r.b && t.trim()) t = '**' + t + '**'
    return t
  }).join('').replace(/\*\*\*\*/g, '').replace(/(?<!\\)\*\*(?=\*)/g, '**')
  if (datI && !datB) than = runs.map(r => r.t).join('')
  than = (nhan + than).replace(/\s+$/, '')
  let ma = { center: 'c', right: 'r', left: 'l', start: 'l', end: 'r', both: '', distribute: '' }[jc] ?? (trongO ? '' : '')
  if (datB) ma += 'b'
  if (datI) ma += 'i'
  if (trongO) return ma ? `#${ma} ${than}` : than
  if (!ma) return than.startsWith('#') || than === '~' ? '\\' + than : than
  return `#${ma} ${than}`
}

// ── bảng ──
function bang(tbl) {
  const grid = [...tbl.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => +m[1])
  const tong = grid.reduce((a, b) => a + b, 0) || 1
  const vien = !/<w:tblBorders>[\s\S]*?w:val="(nil|none)"[\s\S]*?<\/w:tblBorders>/.test(tbl) || /w:val="single"/.test(tbl)
  const ra = [`::bang ${vien ? 'vien' : 'khong-vien'} ` + grid.map(w => Math.max(1, Math.round(100 * w / tong)) + '<').join(' ')]
  for (const tr of tbl.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)) {
    const o = []
    for (const tc of tr[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)) {
      const tcPr = (tc[1].match(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/) || [, ''])[1]
      const span = +thuocTinh((tcPr.match(/<w:gridSpan [^>]*>/) || [''])[0], 'val') || 1
      const vm = tcPr.match(/<w:vMerge(?: w:val="(\w+)")?\/>/)
      if (vm && vm[1] !== 'restart') o.push('^^')
      else o.push([...tc[1].matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\/>/g)].map(p => doan(p[0], true)).filter(x => x !== '~').join(' // ') || '')
      for (let k = 1; k < span; k++) o.push('<<')
    }
    ra.push(o.join(' | '))
  }
  ra.push('::')
  return ra.join('\n')
}

// ── duyệt thân văn bản theo thứ tự (đoạn và bảng xen nhau; bảng lồng bảng: lấy bảng ngoài) ──
const than = xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>'))
const ra = []
let i = 0
while (i < than.length) {
  const mp = /<w:p[ >\/]/g; mp.lastIndex = i
  const mm = mp.exec(than), p = mm ? mm.index : -1, t = than.indexOf('<w:tbl>', i)   // chỉ thẻ đoạn <w:p>, không lẫn <w:pgSz>…
  if (p < 0 && t < 0) break
  if (t >= 0 && (p < 0 || t < p)) {
    let sau = t + 7, sauDong = 1
    while (sauDong) { const mo = than.indexOf('<w:tbl>', sau), dong = than.indexOf('</w:tbl>', sau); if (dong < 0) { sau = than.length; break } if (mo >= 0 && mo < dong) { sauDong++; sau = mo + 7 } else { sauDong--; sau = dong + 8 } }
    ra.push(bang(than.slice(t, sau))); i = sau; continue
  }
  const tuDong = than.startsWith('<w:p/>', p)
  const dong = than.indexOf('</w:p>', p)
  if (!tuDong && dong < 0) break
  const ket = tuDong ? p + 6 : dong + 6
  ra.push(tuDong ? '~' : doan(than.slice(p, ket)))
  i = ket
}
console.log(ra.join('\n').replace(/\n(~\n){2,}/g, '\n~\n~\n'))
