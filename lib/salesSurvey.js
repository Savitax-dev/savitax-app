// Đọc phiếu khảo sát SVT.MB01 (.docx) → điền phiếu khảo sát của báo giá.
// Chép logic từ bản chạy thử (applySurveyRows), nhưng đọc XML bằng regex thay cho DOMParser để
// cùng một hàm chạy được cả trên trình duyệt lẫn Node (script kiểm thử với phiếu thật). Phiếu mẫu
// không có bảng lồng nhau nên regex theo w:tr → w:tc → w:t là đủ.
import PizZip from 'pizzip'
import { syncDocs } from './salesPricing.js'

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

function cellText(tcXml) {
  let out = ''
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g
  let m
  while ((m = re.exec(tcXml)) !== null) out += m[1]
  return decodeXml(out).replace(/\s+/g, ' ').trim()
}

// Mỗi dòng bảng có từ 2 ô trở lên → một mảng chuỗi. Ô đầu là nhãn, các ô sau là giá trị.
export function parseSurveyXml(xml) {
  const rows = []
  const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g
  let tr
  while ((tr = trRe.exec(xml)) !== null) {
    const cells = []
    const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g
    let tc
    while ((tc = tcRe.exec(tr[0])) !== null) cells.push(cellText(tc[0]))
    if (cells.length >= 2) rows.push(cells)
  }
  return rows
}

export function readSurveyDocx(bytes) {
  let zip
  try { zip = new PizZip(bytes) } catch (_) { throw new Error('File không phải định dạng .docx hợp lệ.') }
  const f = zip.file('word/document.xml')
  if (!f) throw new Error('Không tìm thấy nội dung văn bản trong file.')
  return parseSurveyXml(f.asText())
}

function pick(rows, ...keys) {
  for (const r of rows) {
    const label = (r[0] || '').toLowerCase()
    for (const k of keys) {
      if (label.includes(k.toLowerCase())) {
        for (let i = 1; i < r.length; i++) { if (r[i]) return r[i] }
      }
    }
  }
  return ''
}

// prefix=true: nhãn phải BẮT ĐẦU bằng key. BẮT BUỘC cho "Doanh thu" — nhãn "Ngành nghề KD chính
// (tạo ra doanh thu chủ yếu)" cũng chứa chữ "doanh thu"; dò kiểu "chứa" sẽ vớ nhầm dòng đó (bỏ
// trống) và ra doanh thu 0. Đã làm sai một báo giá thật.
function pickRow(rows, key, prefix) {
  const k = key.toLowerCase()
  if (prefix) {
    for (const r of rows) { if ((r[0] || '').trim().toLowerCase().startsWith(k)) return r }
  }
  for (const r of rows) { if ((r[0] || '').toLowerCase().includes(k)) return r }
  return null
}

function toNum(str) {
  if (!str) return 0
  // Bỏ cả dấu chấm VÀ dấu phẩy ngăn nghìn: "1,200" là 1200 chứ không phải 1 và 200.
  const nums = String(str).replace(/[.,\s]/g, '').match(/\d+/g)
  if (!nums) return 0
  return Math.max.apply(null, nums.map(Number))
}

// Đọc số tiền khách ghi tay trong phiếu khảo sát. Mẫu 2026 gặp đủ kiểu: "4,000,000,000",
// "4.000.000.000", "3 TỶ", "3,5 tỷ", "500 triệu", "NA". Trả 0 nếu không có số.
export function moneyVN(str) {
  const raw = String(str || '').toLowerCase().trim()
  if (!raw) return 0
  const mult = /(tỷ|tỉ|\bty\b)/.test(raw) ? 1e9
    : /(triệu|tr\.?đ|\btr\b)/.test(raw) ? 1e6
    : /(nghìn|ngàn|\bk\b)/.test(raw) ? 1e3 : 1
  const token = (raw.match(/[\d.,]+/g) || [])[0]
  if (!token) return 0
  let n
  if (mult > 1) {
    // Có chữ "tỷ/triệu" thì dấu phẩy/chấm là phần thập phân: "3,5 tỷ" = 3,5 × 1 tỷ.
    const parts = token.replace(/,/g, '.').split('.')
    n = parts.length === 2 && parts[1].length <= 2 ? Number(parts[0] + '.' + parts[1]) : Number(parts.join(''))
  } else {
    n = Number(token.replace(/[.,]/g, ''))
  }
  return Number.isFinite(n) ? Math.round(n * mult) : 0
}

// Ô giá trị đầu tiên có số của một dòng (bỏ qua ô nhãn và các ô để trống).
function firstNum(row, parse) {
  if (!row) return 0
  for (let i = 1; i < row.length; i++) {
    const v = (parse || toNum)(row[i])
    if (v) return v
  }
  return 0
}

function rangeText(str) {
  const nums = String(str || '').replace(/[.\s]/g, '').match(/\d+/g)
  return (nums && nums.length > 1) ? nums.join(' – ') : ''
}

function guessSector(text) {
  const t = (text || '').toLowerCase()
  if (/(sản xuất|gia công|xây dựng|thi công|nội thất|lắp đặt|may|chế biến)/.test(t)) return 'sx'
  if (/(nhà hàng|cafe|café|karaoke|quảng cáo|sự kiện|tư vấn|dịch vụ|du lịch|vận chuyển|giáo dục|spa|salon)/.test(t)) return 'dv'
  return 'tm'
}

// Ghi đè các trường tìm thấy vào s (phiếu khảo sát của báo giá), trả danh sách tên trường đã điền.
export function applySurveyRows(rows, s) {
  const got = []
  const set = (label, key, val) => { if (val != null && val !== '' && val !== 0) { s[key] = val; got.push(label) } }
  set('tên công ty', 'company', pick(rows, 'Tên doanh nghiệp', 'Tên công ty'))
  set('mã số thuế', 'mst', pick(rows, 'Mã số thuế'))
  set('địa chỉ', 'address', pick(rows, 'Địa chỉ'))
  set('người liên hệ', 'contact', pick(rows, 'Người liên hệ'))
  set('điện thoại', 'phone', pick(rows, 'Số điện thoại'))
  set('email', 'email', pick(rows, 'Email'))
  set('phần mềm', 'software', pick(rows, 'Phần mềm kế toán'))
  set('hóa đơn điện tử', 'einvoice', pick(rows, 'Nhà cung cấp'))
  set('quyết toán thuế', 'settled', pick(rows, 'Đã quyết toán thuế'))

  const industry = pick(rows, 'Ngành nghề KD chính', 'Ngành nghề')
  if (industry) { s.sector = guessSector(industry); got.push('nhóm ngành') }

  const mix = []
  ;[['0%', 'Mặt hàng chịu thuế 0%'], ['5%', 'Mặt hàng chịu thuế 5%'], ['8%', 'Mặt hàng chịu thuế 8%'], ['10%', 'Mặt hàng chịu thuế 10%']]
    .forEach(([rate, label]) => { const v = pick(rows, label); if (v) mix.push(v + ' (' + rate + ')') })
  if (mix.length) { s.taxMix = mix.join('; '); got.push('cơ cấu thuế suất') }

  const bh = toNum(pick(rows, 'nhân sự tham gia BH'))
  if (bh) { s.laborBh = bh; s.hcnsHeads = s.hcnsHeads || bh; got.push('lao động BHXH') }
  const nbh = toNum(pick(rows, 'không tham gia BH'))
  if (nbh) { s.laborNoBh = nbh; got.push('lao động không BHXH') }
  const ia = toNum(pick(rows, 'kế toán nội bộ'))
  if (ia) { s.internalAcc = ia; got.push('kế toán nội bộ') }

  // Doanh thu — mẫu SVT.MB01 2026 có 2 dòng riêng ("Doanh thu cả năm", "Doanh thu bình quân / tháng")
  // và một dòng TIÊU ĐỀ "Doanh thu | Số tiền (đồng)". Dò kiểu cũ vớ trúng dòng tiêu đề (không có số)
  // rồi dừng nên doanh thu luôn ra 0 — ca thật 11/09/2026, nhân viên phải nhập tay.
  // Thứ tự ưu tiên: cả năm → bình quân tháng × 12 → mẫu cũ (3 cột Tháng | Quý | Năm).
  {
    const yearRow = pickRow(rows, 'doanh thu cả năm', true) || pickRow(rows, 'doanh thu năm', true)
    const monthRow = pickRow(rows, 'doanh thu bình quân', true) || pickRow(rows, 'doanh thu bq', true)
    let year = firstNum(yearRow, moneyVN)
    if (!year) year = firstNum(monthRow, moneyVN) * 12
    if (!year) {
      const rowRev = pickRow(rows, 'Doanh thu', true)
      if (rowRev) {
        const m = moneyVN(rowRev[1]), q = moneyVN(rowRev[2]), y = moneyVN(rowRev[3])
        year = y || (q ? q * 4 : 0) || (m ? m * 12 : 0)
      }
    }
    if (year) { s.revenueYear = year; got.push('doanh thu') }
  }
  const rIn = pickRow(rows, 'hóa đơn mua vào'), rOut = pickRow(rows, 'hóa đơn bán ra'), rBank = pickRow(rows, 'sao kê ngân hàng')
  const perMonth = r => {
    if (!r) return 0
    const m = toNum(r[1]), q = toNum(r[2]), y = toNum(r[3])
    return m || (q ? Math.round(q / 3) : 0) || (y ? Math.round(y / 12) : 0)
  }
  const nIn = perMonth(rIn), nOut = perMonth(rOut), nBank = perMonth(rBank)
  if (nIn) { s.invIn = nIn; got.push('HĐ mua vào') }
  if (nOut) { s.invOut = nOut; got.push('HĐ bán ra') }
  if (nBank) { s.bankStmt = nBank; got.push('sao kê ngân hàng') }
  if (nIn || nOut || nBank) {
    syncDocs(s)
    const parts = [rIn, rOut].map(r => rangeText(r && r[1])).filter(Boolean)
    s.docsRange = parts.join(', ')
  }
  const cus = pickRow(rows, 'tờ khai hải quan nhập khẩu') || pickRow(rows, 'tờ khai hải quan xuất khẩu')
  if (cus && toNum(cus[1] || cus[2] || cus[3])) {
    s.customs = true; s.customsCount = (cus[1] || cus[2] || cus[3]).trim() + ' tờ khai/tháng'; got.push('tờ khai hải quan')
  }

  // Các ô đánh dấu X trong mẫu SVT.MB01 (bản 2026): ô trái có [x], đọc chữ ở ô phải.
  const ticked = c => /\[[^\]]*[xX][^\]]*\]/.test(String(c || ''))
  const findTick = re => rows.find(r => ticked(r[0]) && re.test((r[1] || '').toLowerCase()))

  const secRow = findTick(/thương mại|sản xuất|dịch vụ/)
  if (secRow) {
    const t = secRow[1].toLowerCase()
    s.sector = /sản xuất|xây dựng/.test(t) ? 'sx' : (/dịch vụ|ăn uống/.test(t) ? 'dv' : 'tm')
    got.push('nhóm ngành')
  }
  const areaRow = findTick(/trung tâm|thủ đức|nhà bè|bình chánh|hóc môn|củ chi/)
  if (areaRow) {
    const t = areaRow[1].toLowerCase()
    s.area = /thủ đức|quận 2|quận 7|quận 9/.test(t) ? 'a'
      : (/nhà bè|bình chánh|hóc môn|củ chi/.test(t) ? 'b' : 'none')
    got.push('địa bàn')
  }
  // Kỳ kê khai: 2 ô cùng dòng — dấu X gần chữ "Theo tháng" hay "Theo quý" hơn thì chọn bên đó.
  const filing = pickRow(rows, 'Kỳ kê khai thuế')
  if (filing && filing[1]) {
    const t = filing[1]
    const iM = t.search(/theo tháng/i), iQ = t.search(/theo quý/i)
    const mark = /\[[^\]]*[xX][^\]]*\]/g
    let m; const marks = []
    while ((m = mark.exec(t)) !== null) marks.push(m.index)
    if (marks.length) {
      const near = idx => marks.reduce((a, p) => Math.abs(p - idx) < Math.abs(a - idx) ? p : a, marks[0])
      if (iM >= 0 && iQ >= 0) { s.monthlyFiling = Math.abs(near(iM) - iM) < Math.abs(near(iQ) - iQ) }
      else if (iM >= 0) { s.monthlyFiling = true }
      got.push('kỳ kê khai')
    }
  }
  if (!Array.isArray(s.extras)) s.extras = []
  const svc = [
    [/hành chính nhân sự/, () => { s.wantHcns = true; if (!s.hcnsHeads) s.hcnsHeads = s.laborBh || 0 }],
    [/hoàn thiện, rà soát sổ sách|rà soát sổ sách/, () => { s.wantReview = true }],
    [/thuế nhà thầu/, () => { if (!s.extras.includes('nhathau_kk')) s.extras.push('nhathau_kk') }],
    [/giải thể doanh nghiệp/, () => { if (!s.extras.includes('giaithe_dn')) s.extras.push('giaithe_dn') }],
    [/đọc báo cáo tài chính|đào tạo/, () => { if (!s.extras.includes('dao_tao')) s.extras.push('dao_tao') }],
  ]
  let svcHit = false
  rows.forEach(r => {
    if (!ticked(r[0])) return
    const t = (r[1] || '').toLowerCase()
    svc.forEach(([re, fn]) => { if (re.test(t)) { fn(); svcHit = true } })
  })
  if (svcHit) got.push('dịch vụ quan tâm')

  return got
}
