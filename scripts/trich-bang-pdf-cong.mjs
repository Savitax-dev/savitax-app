// Trích các hàng bảng của bản cổng in: theo đường kẻ ngang + mép cột → [{ p, cao, o: [{ chu, k }] }]
// k = kiểu chữ đoán theo bề rộng (Tinos thường / đậm / nghiêng / đậm nghiêng) — tên phông trong file chỉ là "CIDFont+Fn"
import fs from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const pd = await PDFDocument.create(); pd.registerFontkit(fontkit)
const PH = {}
for (const [k, t] of [['thuong', 'Regular'], ['dam', 'Bold'], ['nghieng', 'Italic']]) PH[k] = await pd.embedFont(fs.readFileSync('public/fonts/Tinos-' + t + '.ttf'))
const kieuCua = (s, w, co) => {
  let best = 'thuong', d = 1e9
  for (const [k, f] of Object.entries(PH)) { let e; try { e = Math.abs(f.widthOfTextAtSize(s, co) - w) } catch { continue } if (e < d) { d = e; best = k } }
  return best
}
const DIEU_KHIEN = /[\u0000-\u001f]/g
const [f, cotStr, ra] = process.argv.slice(2)
const cot = cotStr.split(',').map(Number)
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)) }).promise
const out = []
for (let p = 1; p <= doc.numPages; p++) {
  const pg = await doc.getPage(p), H = pg.getViewport({ scale: 1 }).height
  const ops = await pg.getOperatorList(), O = pdfjs.OPS
  let ctm = [1, 0, 0, 1, 0, 0]; const st = []; const ys = new Set()
  const nhan = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]]
  const td = (x, y) => [ctm[0]*x+ctm[2]*y+ctm[4], H-(ctm[1]*x+ctm[3]*y+ctm[5])]
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i]
    if (fn === O.save) st.push(ctm); else if (fn === O.restore) ctm = st.pop() || ctm
    else if (fn === O.transform) ctm = nhan(ctm, a)
    else if (fn === O.constructPath) {
      const d = a[1][0]; let k = 0, cur = null; const n = Object.keys(d).length
      while (k < n) {
        const c = d[k++]
        if (c === 0) { cur = td(d[k], d[k+1]); k += 2 }
        else if (c === 1) { const m = td(d[k], d[k+1]); k += 2; if (Math.abs(m[1]-cur[1]) < 0.3 && Math.abs(m[0]-cur[0]) > 20 && Math.min(m[0], cur[0]) < cot[1]) ys.add(+m[1].toFixed(1)); cur = m }
        else if (c === 2) k += 6; else if (c === 3) k += 4; else if (c === 4) {} else break
      }
    }
  }
  const dong = [...ys].sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > 3)
  const tc = await pg.getTextContent()
  const it = tc.items.filter(i => i.str.length).map(i => {
    const s = i.str.replace(DIEU_KHIEN, ' ')
    return { x: i.transform[4], y: H - i.transform[5], s, w: i.width, f: i.fontName, k: (s.match(/\p{L}/gu) || []).length >= 3 ? kieuCua(s.normalize('NFC'), i.width, Math.abs(i.transform[0])) : null }
  })
  // bỏ phiếu: mỗi phông một kiểu (theo mảnh có ≥ 3 chữ cái), rồi áp cho mọi mảnh dùng phông đó (cả chữ số)
  const phieu = {}
  for (const i of it) if (i.k) { phieu[i.f] ??= {}; phieu[i.f][i.k] = (phieu[i.f][i.k] || 0) + 1 }
  const kieuPhong = Object.fromEntries(Object.entries(phieu).map(([f2, v]) => [f2, Object.entries(v).sort((x, y) => y[1] - x[1])[0][0]]))
  for (const i of it) i.k = kieuPhong[i.f] || i.k
  for (let r = 0; r < dong.length - 1; r++) {
    const a = dong[r], b = dong[r + 1]
    const trong = it.filter(i => i.y > a && i.y < b + 1).sort((p2, q) => p2.y - q.y || p2.x - q.x)
    if (!trong.some(i => i.s.trim())) continue
    const o = []
    for (let c = 0; c < cot.length - 1; c++) {
      const cc = trong.filter(i => i.x >= cot[c] - 1 && i.x < cot[c + 1] - 1)
      let chu = '', yTr = null
      for (const i of cc) { if (yTr != null && Math.abs(i.y - yTr) > 1.5 && !chu.endsWith(' ')) chu += ' '; chu += i.s; yTr = i.y }
      const dem = {}
      for (const i of cc) if (i.k) dem[i.k] = (dem[i.k] || 0) + i.s.trim().length
      const k = Object.entries(dem).sort((p2, q) => q[1] - p2[1])[0]?.[0] || 'thuong'
      o.push({ chu: chu.replace(/\s+/g, ' ').trim(), k })
    }
    out.push({ p, cao: +(b - a).toFixed(2), o })
  }
}
fs.writeFileSync(ra, JSON.stringify(out).replace(/\},\{"p"/g, '},\n{"p"'))
console.log('so hang', out.length)
