// Đo bản PDF cổng thuế in: in từng cụm chữ (y từ mép trên, x đầu, x cuối, cỡ, phông, chữ) để chép mẫu vào lib/tokhaiPdf*.js
//   node scripts/do-pdf-cong.mjs <ban-cong.pdf> 1,2
import fs from 'node:fs'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const f = process.argv[2], trang = (process.argv[3] || '1').split(',').map(Number)
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)) }).promise
const meta = await doc.getMetadata()
console.log('trang', doc.numPages, JSON.stringify(meta.info).slice(0, 300))
for (const p of trang) {
  if (p > doc.numPages) continue
  const pg = await doc.getPage(p)
  const vp = pg.getViewport({ scale: 1 })
  console.log('--- trang', p, vp.width, vp.height)
  const it = (await pg.getTextContent()).items.filter(i => i.str.trim())
  const ds = []
  for (const i of it.map(i => ({ x: i.transform[4], y: vp.height - i.transform[5], s: i.str, w: i.width, h: i.transform[0], f: i.fontName })).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const l = ds[ds.length - 1]
    if (l && Math.abs(l.y - i.y) < 1.5 && i.x - (l.x + l.w) < 4 && i.x - (l.x + l.w) > -2) { l.s += (i.x - (l.x + l.w) > 1 ? ' ' : '') + i.s; l.w = i.x + i.w - l.x } else ds.push({ ...i })
  }
  for (const d of ds) console.log(d.y.toFixed(2).padStart(7), d.x.toFixed(2).padStart(7), (d.x + d.w).toFixed(2).padStart(7), d.h.toFixed(2), d.f.slice(-6), d.s.slice(0, 120))
}
