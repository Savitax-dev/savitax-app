// Cắt gọn phông TrueType chỉ còn các chữ một bản PDF dùng tới — để PDF tờ khai / thông báo nhẹ (~100 KB
// thay vì ~0,9 MB khi nhúng nguyên 3 phông Tinos).
//
// VÌ SAO TỰ VIẾT: `embedFont(…, { subset: true })` của pdf-lib 1.17 + @pdf-lib/fontkit 1.1.1 làm HỎNG phông
// Tinos (đọc lại báo "Trying to access beyond buffer length", trình xem PDF mất gần hết chữ có dấu —
// đo 31/10/2026). Cách ở đây an toàn hơn vì GIỮ NGUYÊN SỐ HIỆU từng nét chữ (glyph id): nét không dùng chỉ
// bị làm rỗng, không đánh số lại → chữ ghép dấu (glyph ghép từ nét chữ gốc + nét dấu) vẫn trỏ đúng chỗ,
// bảng bề rộng chữ (hmtx) giữ y nguyên nên bố cục không lệch một li. Bỏ các bảng PDF không cần (GSUB/GPOS/
// kern… — pdf-lib không dùng để vẽ), dựng lại bảng mã ký tự (cmap) chỉ cho ký tự cần.
//
// Thuần JavaScript (Uint8Array/DataView), chạy được cả trình duyệt lẫn Node.

const GIU = new Set(['head', 'hhea', 'maxp', 'hmtx', 'loca', 'glyf', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'prep', 'gasp'])

// Các nét chữ một nét ghép cần thêm (glyph ghép: chữ có dấu = nét chữ + nét dấu)
function thanhPhanGhep(glyf, a, b) {
  const ds = []
  if (b - a < 10) return ds
  const dv = new DataView(glyf.buffer, glyf.byteOffset + a, b - a)
  if (dv.getInt16(0) >= 0) return ds
  let p = 10
  for (;;) {
    const co = dv.getUint16(p), gid = dv.getUint16(p + 2)
    ds.push(gid)
    p += 4 + (co & 0x0001 ? 4 : 2)
    if (co & 0x0008) p += 2
    else if (co & 0x0040) p += 4
    else if (co & 0x0080) p += 8
    if (!(co & 0x0020)) break
  }
  return ds
}

// cmap định dạng 4 (bảng mã BMP) cho đúng các cặp (mã ký tự → glyph)
function dungCmap(cap) {
  const ds = [...cap].filter(([cp]) => cp < 0xFFFF).sort((x, y) => x[0] - y[0])
  // gộp các ký tự liền nhau có cùng hiệu (gid − mã) thành một đoạn
  const doan = []
  for (const [cp, gid] of ds) {
    const l = doan[doan.length - 1]
    if (l && cp === l.cuoi + 1 && gid - cp === l.delta) l.cuoi = cp
    else doan.push({ dau: cp, cuoi: cp, delta: gid - cp })
  }
  doan.push({ dau: 0xFFFF, cuoi: 0xFFFF, delta: 1 })
  const n = doan.length
  const dai4 = 16 + n * 8
  const buf = new Uint8Array(4 + 8 * 2 + dai4)
  const dv = new DataView(buf.buffer)
  dv.setUint16(0, 0); dv.setUint16(2, 2)                    // version, numTables
  dv.setUint16(4, 0); dv.setUint16(6, 3); dv.setUint32(8, 20) // Unicode BMP
  dv.setUint16(12, 3); dv.setUint16(14, 1); dv.setUint32(16, 20) // Windows Unicode BMP
  let p = 20
  const tim = Math.floor(Math.log2(n))
  dv.setUint16(p, 4); dv.setUint16(p + 2, dai4); dv.setUint16(p + 4, 0)
  dv.setUint16(p + 6, n * 2); dv.setUint16(p + 8, 2 * 2 ** tim); dv.setUint16(p + 10, tim); dv.setUint16(p + 12, n * 2 - 2 * 2 ** tim)
  p += 14
  doan.forEach((d, i) => dv.setUint16(p + i * 2, d.cuoi)); p += n * 2 + 2   // + reservedPad
  doan.forEach((d, i) => dv.setUint16(p + i * 2, d.dau)); p += n * 2
  doan.forEach((d, i) => dv.setUint16(p + i * 2, (d.delta + 0x10000) & 0xFFFF)); p += n * 2
  doan.forEach((d, i) => dv.setUint16(p + i * 2, 0))       // idRangeOffset = 0
  return buf
}

const tongKiem = b => {
  let s = 0
  for (let i = 0; i < b.length; i += 4) s = (s + (((b[i] << 24) | ((b[i + 1] || 0) << 16) | ((b[i + 2] || 0) << 8) | (b[i + 3] || 0)) >>> 0)) % 0x100000000
  return s
}

// ttf: Uint8Array phông gốc · cap: Map(mã ký tự → glyph id) của các ký tự cần (lấy bằng fontkit) → Uint8Array
export function catPhong(ttf, cap) {
  const goc = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength)
  const soBang = goc.getUint16(4)
  const bang = {}
  for (let i = 0; i < soBang; i++) {
    const r = 12 + i * 16
    const tag = String.fromCharCode(...ttf.subarray(r, r + 4))
    bang[tag] = ttf.subarray(goc.getUint32(r + 8), goc.getUint32(r + 8) + goc.getUint32(r + 12))
  }
  const u16 = (b, o) => (b[o] << 8) | b[o + 1]
  const soNet = u16(bang.maxp, 4)
  const locaDai = u16(bang.head, 50) === 1
  const loca = i => (locaDai ? new DataView(bang.loca.buffer, bang.loca.byteOffset).getUint32(i * 4) : u16(bang.loca, i * 2) * 2)

  // Nét cần giữ: .notdef + nét của các ký tự + thành phần nét ghép (đệ quy)
  const giu = new Set([0])
  const hang = [...new Set(cap.values())]
  while (hang.length) {
    const g = hang.pop()
    if (g == null || g >= soNet || giu.has(g)) continue
    giu.add(g)
    hang.push(...thanhPhanGhep(bang.glyf, loca(g), loca(g + 1)))
  }

  // glyf + loca mới: nét không giữ → độ dài 0 (rỗng), số hiệu giữ nguyên
  const manh = [], viTri = [0]
  let dai = 0
  for (let g = 0; g < soNet; g++) {
    if (giu.has(g)) {
      const d = bang.glyf.subarray(loca(g), loca(g + 1))
      const dem = (4 - (d.length % 4)) % 4
      manh.push(d); if (dem) manh.push(new Uint8Array(dem))
      dai += d.length + dem
    }
    viTri.push(dai)
  }
  const glyf = new Uint8Array(dai)
  let p = 0
  for (const m of manh) { glyf.set(m, p); p += m.length }
  const locaMoi = new Uint8Array((soNet + 1) * (locaDai ? 4 : 2))
  const dvL = new DataView(locaMoi.buffer)
  viTri.forEach((v, i) => (locaDai ? dvL.setUint32(i * 4, v) : dvL.setUint16(i * 2, v / 2)))

  // post bản 3.0: bỏ tên nét chữ (vô dụng trong PDF)
  const post = new Uint8Array(32)
  post.set(bang.post.subarray(0, 32))
  new DataView(post.buffer).setUint32(0, 0x00030000)
  const head = bang.head.slice()
  new DataView(head.buffer).setUint32(8, 0)                    // checkSumAdjustment tính lại ở dưới

  const moi = { ...Object.fromEntries(Object.entries(bang).filter(([t]) => GIU.has(t))), glyf, loca: locaMoi, post, head, cmap: dungCmap(cap) }
  const tags = Object.keys(moi).sort()
  const n = tags.length
  let off = 12 + n * 16
  const viTriBang = tags.map(t => { const o = off; off += (moi[t].length + 3) & ~3; return o })
  const ra = new Uint8Array(off)
  const dv = new DataView(ra.buffer)
  dv.setUint32(0, 0x00010000); dv.setUint16(4, n)
  const tim = Math.floor(Math.log2(n))
  dv.setUint16(6, 16 * 2 ** tim); dv.setUint16(8, tim); dv.setUint16(10, n * 16 - 16 * 2 ** tim)
  tags.forEach((t, i) => {
    const r = 12 + i * 16
    for (let k = 0; k < 4; k++) ra[r + k] = t.charCodeAt(k)
    dv.setUint32(r + 4, tongKiem(moi[t])); dv.setUint32(r + 8, viTriBang[i]); dv.setUint32(r + 12, moi[t].length)
    ra.set(moi[t], viTriBang[i])
  })
  const iHead = tags.indexOf('head')
  dv.setUint32(viTriBang[iHead] + 8, (0xB1B0AFBA - tongKiem(ra)) >>> 0)
  return ra
}
