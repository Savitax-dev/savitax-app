// Làm sạch một file Excel hồ sơ khách thật thành MẪU TRỐNG.
// Sửa thẳng trên XML (pizzip) — KHÔNG ghi lại bằng SheetJS (XLSX.write làm hỏng kiểu ô công thức, Excel báo Repair).
// Chạy: node scripts/phaply-lam-sach-mau.cjs <nguồn.xlsx> <đích.xlsx> --map=scripts/phaply-lam-sach-mau.bang-tro.json#<MỤC> [--them=<chữ thêm.json>]… [--thu]
//   --map : bảng trỏ lại công thức file ngoài, lập TAY theo nhãn từng file (scripts/phaply-lam-sach-mau.bang-tro.json, lấy
//           đúng mục của file đó). Ô trỏ ngoài không có trong bảng → để trống + liệt kê. ĐỪNG trỏ máy móc về cùng địa chỉ:
//           sheet chép từ hồ sơ khách khác lệch bố cục (01/11/2026: 12/12 ô của bản giải thể 1TV sẽ điền sai).
//   --them: chữ khách viết khác sheet nhập, phát hiện khi đọc tay (chứa tên khách thật → để NGOÀI repo,
//           D:\savitax-phaply\lam-sach-them\).  --thu: chỉ báo cáo, không ghi.
// Sau khi chạy: mở thử bằng Excel thật — scripts/phaply-thu-mau-excel.ps1 (SheetJS đọc được KHÔNG có nghĩa Excel mở được).
const XLSX = require('xlsx')
const PizZip = require('pizzip')
const fs = require('fs')

const [SRC, DST, ...co] = process.argv.slice(2)
const THU = co.includes('--thu')
const SHEET_NHAP = 'ThôngTin'
const CHO_TRONG = '…………'

const chuan = s => String(s).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
const boDau = s => chuan(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
const escXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Chữ chung giữ lại ở sheet nhập (tiêu đề bảng, chức danh, địa danh cấp tỉnh…)
const GIU = new Set(['stt', 'tên', 'vốn', 'tỷ lệ', 'phiếu biểu quyết', 'ngày cấp', 'gcngv', 'cccd số', 'tổng', 'họ và tên',
  'chức vụ', 'số nhà', 'xã phường', 'giám đốc', 'tổng giám đốc', 'chủ tịch hội đồng thành viên', 'chủ tịch hđtv',
  'chủ tịch hội đồng quản trị', 'bộ công an', 'cục cảnh sát quản lý hành chính về trật tự xã hội', 'việt nam',
  'tình hình kinh doanh không hiệu quả', 'thành phố hồ chí minh', 'tp. hcm', 'tp.hcm', 'tp hcm', 'hà nội', 'thành phố hà nội'].map(chuan))
// Nhãn KHÔNG phải thông tin cá nhân → giá trị vẫn xoá ở sheet nhập nhưng không đi thay chữ ở sheet khác (chỉ báo)
const NHAN_CHUNG = /nơi cấp|chức danh|liên hệ|lí do|lý do|ngành nghề|chi cục thuế|đội thuế/i

const z = new PizZip(fs.readFileSync(SRC))
const wbSJ = XLSX.read(fs.readFileSync(SRC), { cellFormula: true })
const txt = p => z.file(p).asText()

// ---- bản đồ sheet → file xml
const wbXml = txt('xl/workbook.xml'), rels = txt('xl/_rels/workbook.xml.rels')
const rid2t = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => [m[0].match(/Id="([^"]+)"/)[1], m[0].match(/Target="([^"]+)"/)[1]]))
const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => {
  const name = unXml(m[0].match(/name="([^"]*)"/)[1]); const rid = m[0].match(/r:id="([^"]+)"/)[1]
  let t = rid2t[rid]; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t
  return { name, path: t }
})
const tenSheet = new Set(sheets.map(s => s.name))
if (!tenSheet.has(SHEET_NHAP)) throw new Error('Không thấy sheet ' + SHEET_NHAP)

// ---- shared strings
const ssPath = 'xl/sharedStrings.xml'
const ssXml = z.file(ssPath) ? txt(ssPath) : ''
const ssItems = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')))

// ---- 1. thu thập giá trị khách ở sheet nhập (đọc bằng SheetJS)
const wsN = wbSJ.Sheets[SHEET_NHAP]
const nhanDong = {}
for (const k in wsN) { if (k[0] === '!') continue; const a = XLSX.utils.decode_cell(k); if (a.c === 0 && wsN[k].v != null) nhanDong[a.r] = String(wsN[k].v) }
const tokThay = new Set(), tokBao = new Set()
for (const k in wsN) {
  if (k[0] === '!') continue; const a = XLSX.utils.decode_cell(k); const c = wsN[k]
  if (a.c === 0 || c.f || c.v == null || c.v === '') continue
  const s = String(c.w ?? c.v).trim(); if (GIU.has(chuan(s))) continue
  const toks = [s]; if (c.t === 'n') toks.push(String(c.v))
  for (const t of toks) {
    if (t.length < 4 || /^\d{1,3}$/.test(t)) continue
    tokThay.add(t); if (NHAN_CHUNG.test(nhanDong[a.r] || '')) tokBao.add(t)
  }
}

// chữ khách phát hiện khi đọc tay (viết khác sheet nhập) — truyền --them=<file.json> (mảng chuỗi)
for (const a of co.filter(x => x.startsWith('--them='))) for (const t of JSON.parse(fs.readFileSync(a.slice(7), 'utf8'))) tokThay.add(t)

// ---- bảng trỏ lại công thức file ngoài (lập tay theo nhãn từng file): "n|Sheet!Ô" → "ThôngTin!Ô" ; "" = để trống
const MAP_ARG = co.find(x => x.startsWith('--map='))
// --map=file.json#GT_1TV → lấy mục GT_1TV trong bảng gộp
const [mapTep, mapMuc] = MAP_ARG ? MAP_ARG.slice(6).split('#') : []
const BANG_TRO = MAP_ARG ? (b => mapMuc ? (b[mapMuc] || (() => { throw new Error('Bảng trỏ không có mục ' + mapMuc) })()) : b)(JSON.parse(fs.readFileSync(mapTep, 'utf8'))) : {}
const NGOAI_DAY_DU = /'?\[(\d+)\]([^'!]+)'?!\$?([A-Z]+)\$?(\d+)/g
const troLai = f => { // trả về công thức mới, hoặc null nếu phải để trống
  if (/#REF!/.test(f)) return null
  let hong = false
  const g = f.replace(NGOAI_DAY_DU, (all, n, ten, col, row) => {
    const k = `${n}|${ten.trim()}!${col}${row}`
    const d = BANG_TRO[k]; if (!d) { hong = true; return all }
    const [sh, o] = d.split('!'); return (/^[A-Za-z0-9_À-ỹ]+$/.test(sh) ? sh : `'${sh}'`) + '!' + o
  })
  return hong || /\[\d+\]/.test(g) ? null : g
}
const deTrong = []

// ---- 2. kiểm công thức trỏ file ngoài: ô tham chiếu đơn có giá trị cũ khớp ô cùng địa chỉ trong file này không
const NGOAI = /'?\[(\d+)\]([^'!]+)'?!/g
const kiemNgoai = { khop: 0, lech: 0, phuc: 0, lechDs: [], khongSheet: new Set() }
for (const sn of wbSJ.SheetNames) {
  const ws = wbSJ.Sheets[sn]
  for (const k in ws) {
    if (k[0] === '!') continue; const c = ws[k]; if (!c.f || !/\[\d+\]/.test(c.f)) continue
    for (const m of c.f.matchAll(NGOAI)) { const ten = m[2].trim(); if (!tenSheet.has(ten) && ten.replace(/\s/g, '') !== SHEET_NHAP) kiemNgoai.khongSheet.add(ten) }
    const don = c.f.match(/^'?\[\d+\]([^'!]+)'?!\$?([A-Z]+)\$?(\d+)$/)
    if (!don) { kiemNgoai.phuc++; continue }
    const ten = tenSheet.has(don[1].trim()) ? don[1].trim() : SHEET_NHAP
    const goc = wbSJ.Sheets[ten][don[2] + don[3]]
    const a = c.v ?? '', b = goc ? (goc.v ?? '') : ''
    if (chuan(a) === chuan(b)) kiemNgoai.khop++; else { kiemNgoai.lech++; kiemNgoai.lechDs.push(`${sn}!${k} → ${ten}!${don[2]}${don[3]}`) }
  }
}

// ---- 3. sửa XML từng sheet
const thongKe = { ctTruoc: 0, ctSau: 0, oXoaNhap: 0, ngoaiSua: 0, soXoa: 0, ctBo: 0 }
const soKhach = new Set([...tokThay].filter(t => /^\d{5,}$/.test(t)))
for (const sh of sheets) {
  let x = txt(sh.path)
  thongKe.ctTruoc += (x.match(/<f[\s>/]/g) || []).length
  const laNhap = sh.name === SHEET_NHAP
  x = x.replace(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (all, attrs, _e, body) => {
    if (body === undefined) return all
    const r = (attrs.match(/\br="([A-Z]+)(\d+)"/) || [])[1]
    const fM = body.match(/<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>/)
    const boT = attrs.replace(/\s+t="[^"]*"/, '')
    if (fM) {
      // giữ công thức, bỏ kết quả cũ (kết quả cũ chứa dữ liệu khách); sửa trỏ file ngoài
      let f = fM[0]
      if (/\[\d+\]|#REF!/.test(f)) {
        const body2 = (f.match(/<f\b[^>]*>([\s\S]*?)<\/f>/) || [])[1]
        const moi = body2 == null ? null : troLai(unXml(body2))
        if (moi == null) {
          if (/\bt="shared"[^>]*\bref=/.test(f)) throw new Error(`${sh.name}!${r}: công thức gốc dùng chung bị hỏng — xử lý tay`)
          deTrong.push(`${sh.name}!${(attrs.match(/\br="([^"]+)"/) || [])[1]}`); thongKe.ctBo++
          return `<c${boT}/>`
        }
        thongKe.ngoaiSua++
        f = f.replace(/(<f\b[^>]*>)([\s\S]*?)(<\/f>)/, (a, o, b, c) => o + escXml(moi) + c)
      }
      return `<c${boT}>${f}</c>`
    }
    if (!laNhap) {
      // số khách gõ thẳng (vốn, MST dạng số…) ở sheet khác → xoá ô
      if (!/\bt="/.test(attrs) || /\bt="n"/.test(attrs)) { const v = (body.match(/<v>([^<]*)<\/v>/) || [])[1]; if (v && soKhach.has(v)) { thongKe.soXoa++; return `<c${boT}/>` } }
      return all
    }
    if (r === 'A') return all
    // sheet nhập, cột giá trị: giữ chữ chung, còn lại xoá
    if (/\bt="s"/.test(attrs)) { const i = +((body.match(/<v>(\d+)<\/v>/) || [])[1]); if (GIU.has(chuan(ssItems[i] ?? ''))) return all }
    if (/\bt="inlineStr"/.test(attrs)) { const s = unXml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join('')); if (GIU.has(chuan(s))) return all }
    thongKe.oXoaNhap++
    return `<c${boT}/>`
  })
  thongKe.ctSau += (x.match(/<f[\s>/]/g) || []).length
  z.file(sh.path, x)
}

// ---- 4. thay chữ khách còn sót ở mọi phần chữ (chuỗi dùng chung, comment, hình vẽ, thuộc tính)
const toksSapXep = [...new Set([...tokThay].map(t => t.normalize('NFC')))].sort((a, b) => b.length - a.length)
const thayDoan = (x, dem) => {
  x = x.normalize('NFC') // chữ tiếng Việt có thể lưu dạng dựng sẵn hoặc tổ hợp — đưa về một dạng mới so được
  for (const t of toksSapXep) {
    const re = new RegExp(escRe(escXml(t)), 'giu')
    x = x.replace(re, () => { dem[t] = (dem[t] || 0) + 1; return CHO_TRONG })
  }
  // số giấy tờ / điện thoại / email của bất kỳ ai (kể cả khách khác dán vào) → chỗ trống
  return x.replace(/(?<![\d.,])(\d{12}|0\d{9}|\d{10}(?:-\d{3})?)(?![\d.,])|[\w.+-]+@[\w-]+\.[\w.]+/g, () => { dem['#so'] = (dem['#so'] || 0) + 1; return CHO_TRONG })
}
// chỉ thay trong NỘI DUNG CHỮ giữa các thẻ, không đụng thuộc tính
const thayChu = (x, dem) => x.replace(/>([^<]+)</g, (m, t) => '>' + thayDoan(t, dem) + '<')
// sheet: chỉ trong <t> (chuỗi gõ thẳng), không đụng <v> số và <f>
const thaySheet = (x, dem) => x.replace(/(<t\b[^>]*>)([^<]*)(<\/t>)/g, (m, o, t, c) => o + thayDoan(t, dem) + c)
const demThay = {}
const phanChu = Object.keys(z.files).filter(p => !z.files[p].dir && /\.(xml|vml|rels)$/.test(p) && !/worksheets\/sheet\d+\.xml$/.test(p))
// tác giả comment → Savitax
const tacGia = new Set()
for (const p of phanChu.filter(p => /comments\d*\.xml$/.test(p))) for (const m of txt(p).matchAll(/<author>([^<]*)<\/author>/g)) if (m[1].trim()) tacGia.add(unXml(m[1]).trim())
// chuỗi dùng chung: dò trên CẢ CHUỖI ghép các đoạn định dạng (tên khách từng bị cắt giữa chữ "GIẢ|I PHÁP")
if (z.file(ssPath)) z.file(ssPath, txt(ssPath).replace(/<si>([\s\S]*?)<\/si>/g, (all, body) => {
  const b = body.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  const ghep = [...b.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join('')
  const moi = thayDoan(ghep, demThay)
  if (moi === ghep.normalize('NFC')) return all
  const rPr = (b.match(/<r>\s*(<rPr>[\s\S]*?<\/rPr>)/) || [])[1] || ''
  return rPr ? `<si><r>${rPr}<t xml:space="preserve">${moi}</t></r></si>` : `<si><t xml:space="preserve">${moi}</t></si>`
}))
for (const p of phanChu) {
  if (/externalLink/.test(p) || p === ssPath) continue
  let x = txt(p)
  // tác giả → "Savitax", "Savitax 2"… (Excel KHÔNG mở file có 2 tác giả trùng tên trong <authors>)
  if (/comments\d*\.xml$/.test(p)) { let n = 0; x = x.replace(/<author>[^<]*<\/author>/g, () => `<author>Savitax${n++ ? ' ' + n : ''}</author>`) }
  if (/comments\d*\.xml$|vmlDrawing/.test(p)) for (const a of tacGia) x = x.replace(new RegExp(escRe(escXml(a)), 'g'), 'Savitax')
  x = thayChu(x, demThay)
  z.file(p, x)
}
// sheet xml: chữ khách gõ thẳng dạng inlineStr
for (const sh of sheets) z.file(sh.path, thaySheet(txt(sh.path), demThay))

// ---- 5. bỏ liên kết file ngoài, calcChain, thuộc tính cá nhân
const boPhan = p => {
  z.remove(p)
  let ct = txt('[Content_Types].xml'); ct = ct.replace(new RegExp(`<Override[^>]*PartName="/${escRe(p)}"[^>]*/>`, 'g'), ''); z.file('[Content_Types].xml', ct)
}
let wx = txt('xl/workbook.xml'), wr = txt('xl/_rels/workbook.xml.rels')
for (const p of Object.keys(z.files).filter(p => /^xl\/externalLinks\//.test(p) && !z.files[p].dir)) boPhan(p)
wr = wr.replace(/<Relationship\b[^>]*Target="[^"]*externalLinks\/[^"]*"[^>]*\/>/g, '')
wx = wx.replace(/<externalReferences>[\s\S]*?<\/externalReferences>/, '')
// đường dẫn thư mục lúc lưu (G:\…\<tên khách>\…) nằm trong thuộc tính — lượt quét chữ không thấy
wx = wx.replace(/<mc:AlternateContent\b[^>]*>\s*<mc:Choice Requires="x15">\s*<x15ac:absPath\b[\s\S]*?<\/mc:AlternateContent>/, '')
wx = wx.replace(/<definedName\b[^>]*>[^<]*\[\d+\][^<]*<\/definedName>/g, '')
wx = wx.replace(/<definedNames>\s*<\/definedNames>/, '')
if (z.file('xl/calcChain.xml')) { boPhan('xl/calcChain.xml'); wr = wr.replace(/<Relationship\b[^>]*Target="calcChain\.xml"[^>]*\/>/g, '') }
if (/<calcPr\b/.test(wx)) wx = wx.replace(/<calcPr\b([^>]*?)\s*(\/?)>/, (a, at, sl) => `<calcPr${at.replace(/\s+fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${sl}>`)
else wx = wx.replace(/<\/workbook>/, '<calcPr fullCalcOnLoad="1"/></workbook>')
z.file('xl/workbook.xml', wx); z.file('xl/_rels/workbook.xml.rels', wr)
if (z.file('docProps/core.xml')) z.file('docProps/core.xml', txt('docProps/core.xml')
  .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, '<dc:creator>Savitax</dc:creator>')
  .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>Savitax</cp:lastModifiedBy>')
  .replace(/<(dc:title|dc:subject|dc:description|cp:keywords|cp:category)>[\s\S]*?<\/\1>/g, '<$1></$1>'))
if (z.file('docProps/app.xml')) z.file('docProps/app.xml', txt('docProps/app.xml').replace(/<(Company|Manager)>[\s\S]*?<\/\1>/g, '<$1></$1>'))
if (z.file('docProps/custom.xml')) {
  boPhan('docProps/custom.xml'); z.file('_rels/.rels', txt('_rels/.rels').replace(/<Relationship\b[^>]*Target="[^"]*custom\.xml"[^>]*\/>/g, ''))
}

// ---- 6. kiểm lại bản ra
const out = z.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
const z2 = new PizZip(out)
const loi = []
const tatCaChu = Object.keys(z2.files).filter(p => !z2.files[p].dir && /\.(xml|vml|rels)$/.test(p)).map(p => [p, z2.file(p).asText()])
for (const [p, x] of tatCaChu) {
  if (/<f\b[^>]*>[^<]*\[\d+\]/.test(x)) loi.push('còn trỏ file ngoài: ' + p)
  if (/absPath|[A-Z]:\\|\.shortcut-targets/.test(x)) loi.push('còn đường dẫn thư mục cũ ở ' + p)
  // thuộc tính chứa chữ khách (đường dẫn, tên sheet…) — so trên bản giữ nguyên thẻ
  const xa = boDau(unXml(x))
  for (const t of tokThay) if (!/^[\d.,/ -]+$/.test(t) && boDau(t).length >= 6 && xa.includes(boDau(t)) && !boDau(unXml(x.replace(/<[^>]+>/g, ''))).includes(boDau(t))) loi.push(`chữ khách nằm trong thuộc tính ở ${p}`)
  // chỉ phần chữ (bỏ thuộc tính: chiều cao dòng… từng báo nhầm); ghép liền các đoạn để bắt chữ bị cắt giữa chừng
  // (số thì so trên bản có dấu cách giữa các thẻ — ghép liền thì chỉ số ô <v> nối nhau thành số giả)
  const xb = boDau(unXml(x.replace(/<[^>]+>/g, ''))).replace(/\s+/g, '')
  const xs = ' ' + boDau(unXml(x.replace(/<[^>]+>/g, ' '))) + ' '
  for (const t of tokThay) {
    const k = boDau(t).replace(/\s+/g, ''); if (k.length < 4) continue
    const con = /^[\d.,/ -]+$/.test(t) ? new RegExp(`[^\\d]${escRe(boDau(t))}[^\\d]`).test(xs) : xb.includes(k)
    if (con) loi.push(`còn chữ khách (${t.length} ký tự) ở ${p}`)
  }
}
if (Object.keys(z2.files).some(p => /externalLinks\//.test(p) && !z2.files[p].dir)) loi.push('còn phần externalLinks')
if (thongKe.ctTruoc - thongKe.ctBo !== thongKe.ctSau) loi.push(`số công thức đổi ${thongKe.ctTruoc} − ${thongKe.ctBo} → ${thongKe.ctSau}`)
// chuỗi CHỮ IN HOA ≥ 2 từ còn lại (có thể là tên người / công ty của khách KHÁC dán vào) → em đọc tay
const CHUNG = /^(CỘNG HÒA|CỘNG HOÀ|XÃ HỘI|CHỦ NGHĨA|VIỆT NAM|ĐỘC LẬP|TỰ DO|HẠNH PHÚC)/
const inHoa = new Set()
const ss2 = z2.file(ssPath) ? z2.file(ssPath).asText() : ''
for (const m of ss2.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  const s = unXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')).replace(/\s+/g, ' ').trim()
  for (const h of s.matchAll(/(?:[A-ZÀ-Ỹ]{2,}[ .-]+){1,5}[A-ZÀ-Ỹ]{2,}/gu)) if (!CHUNG.test(h[0]) && h[0] === h[0].toUpperCase() && /[A-ZÀ-Ỹ]/u.test(h[0])) inHoa.add(h[0])
  if (/công ty|cty/i.test(s) && s.length < 120) inHoa.add('«' + s + '»')
}
// tên người viết thường: họ phổ biến + 1–3 chữ viết hoa đầu
const HO = 'Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Đinh|Trương|Lâm|Mai|Đoàn|Tạ|Lưu|Cao|Châu|Thái|Tô|Hà|Quách|Lương'
const tenNguoi = new Set()
for (const [p, x] of tatCaChu) {
  const s = unXml(x.replace(/<[^>]+>/g, ' ')).normalize('NFC')
  for (const m of s.matchAll(new RegExp(`(?<![\\p{L}])(?:${HO})(?:\\s+\\p{Lu}\\p{Ll}*){1,3}`, 'gu'))) tenNguoi.add(m[0])
  for (const a of tacGia) if (s.includes(a)) loi.push('còn tên tác giả comment ở ' + p)
}
// mẫu số nghi ngờ (CCCD 12 số, điện thoại, MST, email) còn trong chữ
const nghi = []
for (const [p, x] of tatCaChu) {
  const s = unXml(x.replace(/<[^>]+>/g, ' '))
  for (const m of s.matchAll(/(?<![\d.,])(\d{12}|0\d{9}|\d{10}(?:-\d{3})?)(?![\d.,])|[\w.+-]+@[\w-]+\.[\w.]+/g)) nghi.push(`${p}: …${s.slice(Math.max(0, m.index - 25), m.index).replace(/\s+/g, ' ')}[${m[0].length} ký tự]`)
}
try { XLSX.read(out) } catch (e) { loi.push('SheetJS không đọc được: ' + e.message) }

const baoCao = {
  nguon: SRC.split(/[\\/]/).pop(), sheet: sheets.length,
  congThuc: thongKe.ctSau, oXoaOSheetNhap: thongKe.oXoaNhap, oSoXoaSheetKhac: thongKe.soXoa,
  troNgoai: { daTroLai: thongKe.ngoaiSua, deTrong },
  chuKhachDaThay: Object.values(demThay).reduce((a, b) => a + b, 0), tuKhach: tokThay.size, tacGiaComment: tacGia.size,
  loi, nghiNgo: nghi, inHoa: [...inHoa], tenNguoi: [...tenNguoi],
}
console.log(JSON.stringify(baoCao, null, 1))
if (!THU) { fs.writeFileSync(DST, out); console.log('→ đã ghi', DST) }
