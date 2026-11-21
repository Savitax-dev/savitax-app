// Đo đường kẻ của bản PDF cổng thuế in: các x của đường dọc + y của đường ngang (mép cột / hàng bảng)
//   node scripts/do-net-pdf-cong.mjs <ban-cong.pdf> <trang>
import fs from 'node:fs'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const [f, p] = [process.argv[2], Number(process.argv[3] || 1)]
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)) }).promise
const pg = await doc.getPage(p), H = pg.getViewport({ scale: 1 }).height
const ops = await pg.getOperatorList(), O = pdfjs.OPS
const ds = []
let ctm = [1, 0, 0, 1, 0, 0]; const st = []
const nhan = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]]
const td = (x, y) => [ctm[0]*x+ctm[2]*y+ctm[4], H-(ctm[1]*x+ctm[3]*y+ctm[5])]
for (let i = 0; i < ops.fnArray.length; i++) {
  const fn = ops.fnArray[i], a = ops.argsArray[i]
  if (fn === O.save) st.push(ctm); else if (fn === O.restore) ctm = st.pop() || ctm
  else if (fn === O.transform) ctm = nhan(ctm, a)
  else if (fn === O.constructPath) {
    const d = a[1][0]; let k = 0, cur = null, dau = null
    const n = Object.keys(d).length
    while (k < n) {
      const c = d[k++]
      if (c === 0) { cur = dau = td(d[k], d[k+1]); k += 2 }
      else if (c === 1) { const m = td(d[k], d[k+1]); k += 2; ds.push([...cur, ...m].map(v => +v.toFixed(2))); cur = m }
      else if (c === 2) k += 6; else if (c === 3) k += 4
      else if (c === 4) { if (cur && dau) ds.push([...cur, ...dau].map(v => +v.toFixed(2))); cur = dau }
      else break
    }
  }
}
const xs = new Map(), ys = new Map()
for (const d of ds) { if (Math.abs(d[0]-d[2])<0.3 && Math.abs(d[1]-d[3]) > 3) xs.set(d[0], (xs.get(d[0])||0)+1); if (Math.abs(d[1]-d[3])<0.3 && Math.abs(d[0]-d[2]) > 3) ys.set(d[1],(ys.get(d[1])||0)+1) }
console.log('X doc:', [...xs].sort((a,b)=>a[0]-b[0]).map(([x,n])=>x+'×'+n).join('  '))
console.log('Y ngang:', [...ys].sort((a,b)=>a[0]-b[0]).map(([x,n])=>x+'×'+n).join('  '))
