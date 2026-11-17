// Phân hệ Pháp lý — bộ dựng file Word mẫu từ "văn bản nguồn" dạng chữ có đánh dấu.
//
// Mỗi giấy tờ (Mẫu 2, Điều lệ, Giấy ủy quyền…) viết thành MỘT file .txt trong lib/phaply/word/nguon/ — dễ đọc, dễ
// sửa câu chữ, cùng một kiểu trình bày. Bộ dựng đổi thành OOXML, giữ nguyên thẻ docxtemplater {ten_truong} trong
// MỘT run (thẻ bị cắt giữa 2 run là docxtemplater không nhận). File .docx sinh ra nằm ở templates/phaply/word/.
//
// ─── CÚ PHÁP ────────────────────────────────────────────────────────────────────────────────────────────────
// Dòng chỉ thị (đầu file):  @ngang (trang khổ ngang) · @co 13 (cỡ chữ mặc định, pt — mặc định 12) · @so-trang (số trang ở chân)
//                           @gian 60 (khoảng cách sau mỗi đoạn, twip — mặc định 100)
//                           @le 20/20/30/20 (lề trên/dưới/trái/phải, mm — mặc định 15/15/25/15)
// Đoạn:   "# chữ"    giữa, đậm, cỡ +1        "#c" giữa   "#cb" giữa đậm   "#ci" giữa nghiêng
//         "#r" phải  "#ri" phải nghiêng      "#b" trái đậm               "#l" trái (không canh đều)
//         "#k" giữ cùng trang với đoạn sau (canh đều; ghép được "#bk", "#ck"…)
//         dòng thường = canh đều hai bên.  "#t" = thụt dòng đầu 1 cm.  Ghép được: "#bt", "#ci12" (cỡ 12)…
//         "~" một mình = đoạn trống.  "@ngat-trang" = sang trang.  Dòng bắt đầu "//" = ghi chú, bỏ qua.
// Trong dòng: **đậm**  *nghiêng*  __gạch chân__  {the} thẻ dữ liệu (giữ nguyên)   \* = dấu sao thật (VD "\* Doanh nghiệp:")
//         [...]    tab có dấu chấm tới lề phải (chỗ để viết tay)     [..60] tab chấm tới 60% bề ngang
//         [>]      tab canh phải không chấm                         [>60] tab thường tới 60%
//         [ ] ô vuông trống   [X] ô vuông đã đánh dấu   [x:the] ô đánh dấu khi dữ liệu `the` đúng
// Khối bảng:
//   ::bang <vien|khong-vien> <cột>[ <cột>…] [co=11] [dong-dau=N]
//      cột = độ rộng % kèm canh lề: "8^" (8%, giữa) "30<" (trái) "12>" (phải) "20=" (đều)
//   mỗi dòng bảng: các ô cách nhau " | ". Trong ô: " // " = xuống đoạn; ô "<<" = gộp vào ô bên trái;
//   ô "^^" = gộp với ô phía trên. Ô bắt đầu bằng "#" dùng mã đoạn như trên (VD "#cb TÊN").
//   Dòng lặp: đặt {#ds} ở ô đầu, {/ds} ở ô cuối → docxtemplater nhân dòng theo danh sách.
//   "---" sau các dòng tiêu đề = những dòng đó lặp lại đầu mỗi trang.   Kết thúc khối bằng "::".
//   ::cot 50/50   … nội dung cột trái …   ||   … cột phải …   ::     (2 cột không viền: đầu trang, chữ ký)
import PizZip from 'pizzip'

const FONT = 'Times New Roman'
const KY_HIEU = 'Segoe UI Symbol' // ô vuông ☐ ☒ — Times New Roman không có nét này
const O_TRONG = '☐', O_DANH = '☒'

export const xmlEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ─── run & đoạn ─────────────────────────────────────────────────────────────────────────────────────────────
function rPr({ b, i, u, sz, font } = {}) {
  let s = ''
  if (font) s += `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`
  if (b) s += '<w:b/><w:bCs/>'
  if (i) s += '<w:i/><w:iCs/>'
  if (sz) s += `<w:sz w:val="${Math.round(sz * 2)}"/><w:szCs w:val="${Math.round(sz * 2)}"/>`
  if (u) s += '<w:u w:val="single"/>'
  return s ? `<w:rPr>${s}</w:rPr>` : ''
}
const runChu = (t, f) => t ? `<w:r>${rPr(f)}<w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>` : ''
const runTab = f => `<w:r>${rPr(f)}<w:tab/></w:r>`

// Tách một dòng thành run. Trả { xml, tabs } — tabs là các điểm dừng tab cần khai ở pPr.
export function dongThanhRun(dong, macDinh = {}, beRong) {
  const tabs = []
  let xml = ''
  const f = { ...macDinh }
  const re = /(\\\*|\*\*|__|\*|\[\.\.\.\]|\[\.\.(\d{1,3})\]|\[>(\d{1,3})?\]|\[x:([a-z0-9_.]+)\]|\[ \]|\[X\]|\{[^{}]*\})/g
  let i = 0, m
  while ((m = re.exec(dong))) {
    xml += runChu(dong.slice(i, m.index), f)
    i = m.index + m[0].length
    const t = m[0]
    if (t === '\\*') xml += runChu('*', f)
    else if (t === '**') f.b = !f.b
    else if (t === '*') f.i = !f.i
    else if (t === '__') f.u = !f.u
    else if (t === '[...]') { tabs.push({ pos: beRong, leader: 'dot', align: 'right' }); xml += runTab(f) }
    else if (m[2]) { tabs.push({ pos: Math.round(beRong * m[2] / 100), leader: 'dot', align: 'left' }); xml += runTab(f) }
    else if (t.startsWith('[>')) {
      tabs.push(m[3] ? { pos: Math.round(beRong * m[3] / 100), align: 'left' } : { pos: beRong, align: 'right' }); xml += runTab(f)
    } else if (m[4]) {
      // ô đánh dấu theo dữ liệu: docxtemplater giữ một trong hai run
      const k = { ...f, font: KY_HIEU }
      xml += runChu(`{#${m[4]}}`, f) + runChu(O_DANH, k) + runChu(`{/${m[4]}}{^${m[4]}}`, f) + runChu(O_TRONG, k) + runChu(`{/${m[4]}}`, f)
    } else if (t === '[ ]') xml += runChu(O_TRONG, { ...f, font: KY_HIEU })
    else if (t === '[X]') xml += runChu(O_DANH, { ...f, font: KY_HIEU })
    else xml += runChu(t, f) // thẻ {…}: nguyên một run
  }
  xml += runChu(dong.slice(i), f)
  return { xml, tabs }
}

function pPr({ jc, tabs = [], ind, truoc, sau, giuCung, giuDong } = {}) {
  let s = ''
  if (giuCung) s += '<w:keepNext/>'
  if (giuDong) s += '<w:keepLines/>'
  if (tabs.length) {
    const ds = [...new Map(tabs.map(t => [t.pos + t.align, t])).values()].sort((a, b) => a.pos - b.pos)
    s += '<w:tabs>' + ds.map(t => `<w:tab w:val="${t.align}"${t.leader ? ` w:leader="${t.leader}"` : ''} w:pos="${t.pos}"/>`).join('') + '</w:tabs>'
  }
  if (truoc != null || sau != null) s += `<w:spacing${truoc != null ? ` w:before="${truoc}"` : ''}${sau != null ? ` w:after="${sau}"` : ''}/>`
  if (ind) s += `<w:ind w:firstLine="${ind}"/>`
  if (jc) s += `<w:jc w:val="${jc}"/>`
  return s ? `<w:pPr>${s}</w:pPr>` : ''
}

// Mã đoạn "#cb12t" → kiểu
function maDoan(dong) {
  const m = dong.match(/^#([a-z]*)(\d{1,2})?(?:\s|$)/)
  if (!m) return { jc: 'both', chu: dong }
  const ma = m[1] || 'h', st = { chu: dong.slice(m[0].length) }
  if (ma === 'h') Object.assign(st, { jc: 'center', b: true, sz: 1 }) // "# " tiêu đề
  for (const c of ma === 'h' ? '' : ma) {
    if (c === 'c') st.jc = 'center'; else if (c === 'r') st.jc = 'right'; else if (c === 'l') st.jc = 'left'
    else if (c === 'b') st.b = true; else if (c === 'i') st.i = true; else if (c === 't') st.ind = 567
    else if (c === 'k') st.giuCung = true
  }
  if (!st.jc) st.jc = st.ind || /^k+$/.test(ma) ? 'both' : 'left' // "#k" = canh đều + giữ với đoạn sau
  if (m[2]) st.coRieng = +m[2]
  return st
}

export function doan(dong, ctx) {
  if (dong === '~') return '<w:p/>'
  const st = maDoan(dong)
  const sz = st.coRieng || (st.sz ? ctx.co + 1 : undefined)
  const { xml, tabs } = dongThanhRun(st.chu, { b: st.b, i: st.i, sz }, ctx.beRong)
  return `<w:p>${pPr({ jc: st.jc, tabs, ind: st.ind, giuCung: st.giuCung || ctx.giuCung })}${xml}</w:p>`
}

// ─── bảng ───────────────────────────────────────────────────────────────────────────────────────────────────
const VIEN = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
  .map(k => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('') + '</w:tblBorders>'
const KHONG_VIEN = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
  .map(k => `<w:${k} w:val="nil"/>`).join('') + '</w:tblBorders>'

function oBang(noiDung, rong, canh, ctx, { gop = 1, vMerge, coBang } = {}) {
  const ds = noiDung.split(' // ')
  const ps = ds.map(d => {
    const coMa = /^#/.test(d)
    const st = coMa ? maDoan(d) : { jc: canh, chu: d }
    const sz = st.coRieng || coBang
    const { xml, tabs } = dongThanhRun(st.chu, { b: st.b, i: st.i, sz }, rong - 216)
    return `<w:p>${pPr({ jc: st.jc || canh, tabs, truoc: 20, sau: 20 })}${xml}</w:p>`
  }).join('')
  const tcPr = `<w:tcPr><w:tcW w:w="${rong}" w:type="dxa"/>${gop > 1 ? `<w:gridSpan w:val="${gop}"/>` : ''}${vMerge ? `<w:vMerge${vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}<w:vAlign w:val="center"/></w:tcPr>`
  return `<w:tc>${tcPr}${ps || '<w:p/>'}</w:tc>`
}

function bang(dauKhoi, dongs, ctx) {
  const thamSo = dauKhoi.split(/\s+/).slice(1)
  const coVien = thamSo[0] !== 'khong-vien'
  const cot = thamSo.slice(1).filter(t => /^\d+(\.\d+)?[\^<>=]?$/.test(t)).map(t => ({ pt: parseFloat(t), canh: { '^': 'center', '<': 'left', '>': 'right', '=': 'both' }[t.slice(-1)] || 'left' }))
  const co = +(thamSo.find(t => t.startsWith('co=')) || 'co=0').slice(3) || undefined
  const tong = cot.reduce((a, c) => a + c.pt, 0)
  const rong = cot.map(c => Math.floor(ctx.beRong * c.pt / tong))
  let soDau = 0
  const hang = []
  for (const d of dongs) {
    if (d === '---') { soDau = hang.length; continue }
    hang.push(d.split(/ \|(?: |$)/).map(s => s.trim())) // "a | b |" = ô cuối rỗng
  }
  // vMerge: ô "^^" nối với ô cùng cột ở hàng trên → đánh dấu restart ở ô gốc
  const batDau = hang.map(h => h.map(() => false))
  hang.forEach((h, r) => h.forEach((o, c) => { if (o === '^^') { let k = r - 1; while (k >= 0 && hang[k][c] === '^^') k--; if (k >= 0) batDau[k][c] = true } }))
  const tr = hang.map((h, r) => {
    let cells = '', c = 0
    while (c < h.length) {
      let gop = 1
      while (h[c + gop] === '<<') gop++
      const w = rong.slice(c, c + gop).reduce((a, b) => a + b, 0)
      const canh = cot[c]?.canh || 'left'
      const laTieuDe = r < soDau
      if (h[c] === '^^') cells += oBang('', w, canh, ctx, { gop, vMerge: 'continue', coBang: co })
      else cells += oBang(laTieuDe && !/^#/.test(h[c]) ? '#cb ' + h[c] : h[c], w, canh, ctx, { gop, vMerge: batDau[r][c] ? 'restart' : null, coBang: co })
      c += gop
    }
    const trPr = r < soDau ? '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'
    return `<w:tr>${trPr}${cells}</w:tr>`
  }).join('')
  const grid = '<w:tblGrid>' + rong.map(w => `<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>'
  const tblPr = `<w:tblPr><w:tblW w:w="${rong.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>${coVien ? VIEN : KHONG_VIEN}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="${coVien ? 85 : 0}" w:type="dxa"/><w:right w:w="${coVien ? 85 : 0}" w:type="dxa"/></w:tblCellMar></w:tblPr>`
  // Sau bảng phải có một đoạn (Word bắt buộc khi bảng nằm cuối ô / cuối thân văn bản)
  return `<w:tbl>${tblPr}${grid}${tr}</w:tbl>`
}

// Khối 2 cột không viền: nội dung mỗi cột là các dòng đoạn bình thường
function cot2(dauKhoi, dongs, ctx) {
  const pt = (dauKhoi.split(/\s+/)[1] || '50/50').split('/').map(Number)
  const tong = pt.reduce((a, b) => a + b, 0)
  const rong = pt.map(p => Math.floor(ctx.beRong * p / tong))
  const ds = [[]]
  for (const d of dongs) d === '||' ? ds.push([]) : ds[ds.length - 1].push(d)
  const cells = ds.map((dd, k) => {
    const c2 = { ...ctx, beRong: rong[k] }
    const ps = dd.map(d => doan(d, c2)).join('') || '<w:p/>'
    return `<w:tc><w:tcPr><w:tcW w:w="${rong[k]}" w:type="dxa"/></w:tcPr>${ps}</w:tc>`
  }).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="${ctx.beRong}" w:type="dxa"/><w:jc w:val="center"/>${KHONG_VIEN}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${rong.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr></w:tbl>`
}

// ─── cả văn bản ─────────────────────────────────────────────────────────────────────────────────────────────
const MM = 56.6929 // twip / mm

export function dungThan(nguon) {
  const dongs = nguon.replace(/\r/g, '').split('\n')
  const cfg = { ngang: false, co: 12, soTrang: false, le: [15, 15, 25, 15], gian: 100 }
  for (const d of dongs) {
    if (d === '@ngang') cfg.ngang = true
    else if (d.startsWith('@co ')) cfg.co = +d.slice(4)
    else if (d === '@so-trang') cfg.soTrang = true
    else if (d.startsWith('@le ')) cfg.le = d.slice(4).split('/').map(Number)
    else if (d.startsWith('@gian ')) cfg.gian = +d.slice(6)
  }
  const [rongTrang, caoTrang] = cfg.ngang ? [16838, 11906] : [11906, 16838]
  const [leTren, leDuoi, leTrai, lePhai] = cfg.le.map(v => Math.round(v * MM))
  const ctx = { co: cfg.co, beRong: rongTrang - leTrai - lePhai }

  let than = '', i = 0, truocLaBang = false
  while (i < dongs.length) {
    const d = dongs[i].replace(/\s+$/, '')
    i++
    if (!d || d.startsWith('//') || (d.startsWith('@') && d !== '@ngat-trang')) continue
    if (d === '@ngat-trang') { than += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; truocLaBang = false; continue }
    if (d.startsWith('::bang') || d.startsWith('::cot')) {
      const khoi = []
      while (i < dongs.length && dongs[i].trim() !== '::') { const k = dongs[i].replace(/\s+$/, ''); if (k && !k.startsWith('//')) khoi.push(k); i++ }
      i++
      if (truocLaBang) than += '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>'
      than += d.startsWith('::bang') ? bang(d, khoi, ctx) : cot2(d, khoi, ctx)
      truocLaBang = true
      continue
    }
    than += doan(d, ctx)
    truocLaBang = false
  }
  if (than.endsWith('</w:tbl>')) than += '<w:p/>' // Word đòi đoạn sau bảng cuối văn bản
  const chan = cfg.soTrang ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : ''
  const sect = `<w:sectPr>${chan}<w:pgSz w:w="${rongTrang}" w:h="${caoTrang}"${cfg.ngang ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${leTren}" w:right="${lePhai}" w:bottom="${leDuoi}" w:left="${leTrai}" w:header="567" w:footer="454" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>`
  return { than: than + sect, cfg }
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function styles(co, gian = 100) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="${co * 2}"/><w:szCs w:val="${co * 2}"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="${gian}" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`
}

const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`

// Đóng gói thành .docx (Buffer). meta: { tieuDe }
export function dongGoi(nguon, meta = {}) {
  const { than, cfg } = dungThan(nguon)
  // Ngày cố định trong file nén: nội dung không đổi thì .docx giống hệt từng byte (git không báo đổi mỗi lần chạy kiểm)
  const z = new PizZip()
  const goc = z.file.bind(z), NGAY = new Date(Date.UTC(2026, 0, 1))
  z.file = (ten, nd) => goc(ten, nd, { date: NGAY })
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${cfg.soTrang ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`)
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`)
  z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${cfg.soTrang ? '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}</Relationships>`)
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${than}</w:body></w:document>`)
  z.file('word/styles.xml', styles(cfg.co, cfg.gian))
  z.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${NS}><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`)
  if (cfg.soTrang) z.file('word/footer1.xml', FOOTER)
  z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(meta.tieuDe || '')}</dc:title><dc:creator>Savitax</dc:creator><cp:lastModifiedBy>Savitax</cp:lastModifiedBy></cp:coreProperties>`)
  return z.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}
