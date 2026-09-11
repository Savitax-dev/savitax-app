// Dựng file báo giá Word theo mẫu SVT.MB03 — chép NGUYÊN bố cục + bảng màu từ bản chạy thử đã được
// Giám đốc duyệt (app-src.html, buildDocumentXml). Dựng OOXML từ khung rỗng rồi nén bằng PizZip →
// file chỉ 7–9 KB (dựng bằng cách sao chép file mẫu từng phình 2,4 MB vì mang theo ảnh thừa).
//
// Hai bẫy đã làm hỏng file thật (Word báo "file hỏng", 2 bản gửi Giám đốc không mở được):
//   1. Mỗi ô bảng BẮT BUỘC có ít nhất một <w:p> — cellPara luôn sinh ít nhất 1 đoạn.
//   2. Thứ tự thẻ con trong <w:pPr>: pBdr → tabs → spacing → ind → jc. Sai thứ tự là file hỏng.
//
// Báo giá KHÔNG có ô ký tên/đóng dấu — yêu cầu rõ của Giám đốc (việc ký nằm ở bước hợp đồng).
//
// Cập nhật 2026-09-11 theo mẫu sửa của Giám đốc (SVT.MB03.BAO GIA_MẪU.docx): bỏ ngắt trang, thêm mục
// 1.4 phạm vi BHXH – HCNS, bảng báo giá chỉ in dòng phí tháng (bỏ diễn giải trong ngoặc, dòng BCTC
// năm và đoạn "Căn cứ xác định phí"), đổi khung ghi chú. Engine vẫn tính đủ BCTC/căn cứ để nhân viên
// xem trên app — chỉ file gửi khách là không in.
import PizZip from 'pizzip'
import { SECTORS, MISA_YEAR, vnd, money } from './salesPricing.js'

const FNT = 'Arial', SZB = 21, SZP = 22
const C = {
  navy: '2A6CA8', bar: '4A8FC4', bar2: '6FAAD8', h2: '2E77B5', h3: '4A93C9',
  gold: 'C9A027', goldsoft: 'FFD98A', wash: 'F2F8FD', line: 'CFE2F0',
  ink: '1A1A2E', mute: '555555', boxbg: 'FFF8E1',
}

function x(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function run(t, sz, col, b, i) {
  let r = '<w:r><w:rPr><w:rFonts w:ascii="' + FNT + '" w:hAnsi="' + FNT + '" w:cs="' + FNT + '"/>'
  if (b) r += '<w:b/><w:bCs/>'
  if (i) r += '<w:i/><w:iCs/>'
  if (col) r += '<w:color w:val="' + col + '"/>'
  r += '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + x(t) + '</w:t></w:r>'
  return r
}
// **đậm** trong chuỗi
function runs(s, sz, col, b0, i0) {
  const chunks = String(s == null ? '' : s).split('**')
  let out = '', bold = !!b0
  chunks.forEach((c, idx) => { if (c.length) out += run(c, sz, col, bold, i0); if (idx < chunks.length - 1) bold = !bold })
  return out || run('', sz, col, b0, i0)
}
function para(txt, sz, col, b, i, al, ind, spb, spa, bdr) {
  let p = '<w:p><w:pPr>'
  if (bdr) p += '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="3" w:color="' + bdr + '"/></w:pBdr>'
  p += '<w:spacing w:before="' + spb + '" w:after="' + spa + '" w:line="252" w:lineRule="auto"/>'
  if (ind) p += '<w:ind w:left="' + ind + '" w:hanging="227"/>'
  if (al) p += '<w:jc w:val="' + al + '"/>'
  p += '</w:pPr>' + runs(txt, sz, col, b, i) + '</w:p>'
  return p
}
function cellPara(txt, sz, col, b, al, i) {
  const lines = String(txt == null ? '' : txt).split('<br>')
  if (!lines.length) lines.push('')
  return lines.map(l =>
    '<w:p><w:pPr><w:spacing w:before="30" w:after="30" w:line="240" w:lineRule="auto"/>' +
    (al ? '<w:jc w:val="' + al + '"/>' : '') + '</w:pPr>' + runs(l, sz, col, b, i) + '</w:p>'
  ).join('')
}
function tblOpen(widths) {
  let o = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'
  ;['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(s => {
    o += '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="' + C.line + '"/>'
  })
  o += '</w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/>' +
    '<w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'
  widths.forEach(w => { o += '<w:gridCol w:w="' + w + '"/>' })
  return o + '</w:tblGrid>'
}
function tblRow(widths, cells, opt) {
  opt = opt || {}
  let o = '<w:tr><w:trPr>' + (opt.header ? '<w:tblHeader/>' : '') + '</w:trPr>'
  cells.forEach((c, k) => {
    let al = ''
    if (k > 0 && /^[0-9.,%\-\s đ/]+$/.test(String(c))) al = 'center'
    if (opt.header) al = (k === 0 ? '' : 'center')
    o += '<w:tc><w:tcPr><w:tcW w:w="' + widths[k] + '" w:type="dxa"/>' +
      (opt.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opt.fill + '"/>' : '') +
      '<w:vAlign w:val="center"/></w:tcPr>' +
      cellPara(c, SZB, opt.color || C.ink, !!opt.bold, al, false) + '</w:tc>'
  })
  return o + '</w:tr>'
}
function tblClose() { return '</w:tbl><w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="auto"/></w:pPr></w:p>' }
function oneCell(txt, fill, color, sz, bold, al, border) {
  let o = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'
  ;['top', 'left', 'bottom', 'right'].forEach(s => {
    o += border ? '<w:' + s + ' w:val="single" w:sz="8" w:space="0" w:color="' + border + '"/>'
      : '<w:' + s + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
  })
  o += '</w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>' +
    '<w:bottom w:w="90" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9360" w:type="dxa"/>' +
    '<w:shd w:val="clear" w:color="auto" w:fill="' + fill + '"/></w:tcPr>' +
    cellPara(txt, sz, color, bold, al, false) + '</w:tc></w:tr></w:tbl>' +
    '<w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="auto"/></w:pPr></w:p>'
  return o
}
function banner(a, b) {
  let o = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
    '<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
    '<w:bottom w:val="single" w:sz="18" w:space="0" w:color="' + C.gold + '"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
    '</w:tblBorders><w:tblCellMar><w:top w:w="180" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>' +
    '<w:bottom w:w="180" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9360" w:type="dxa"/>' +
    '<w:shd w:val="clear" w:color="auto" w:fill="' + C.navy + '"/></w:tcPr>'
  o += '<w:p><w:pPr><w:spacing w:before="0" w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + runs(a, 26, 'FFFFFF', 1, 0) + '</w:p>'
  o += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + runs(b, 22, C.goldsoft, 0, 1) + '</w:p>'
  return o + '</w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="auto"/></w:pPr></w:p>'
}
function stepsRow(items) {
  const w = Math.floor(9360 / items.length), widths = items.map(() => w)
  let o = tblOpen(widths) + '<w:tr>'
  items.forEach((it, k) => {
    o += '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="' + ((k % 2 === 0) ? C.bar : C.bar2) + '"/><w:vAlign w:val="center"/></w:tcPr>'
    o += '<w:p><w:pPr><w:spacing w:before="40" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + runs(it[0], 24, C.goldsoft, 1, 0) + '</w:p>'
    o += '<w:p><w:pPr><w:spacing w:before="0" w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + runs(it[1], 19, 'FFFFFF', 1, 0) + '</w:p>'
    o += '</w:tc>'
  })
  return o + '</w:tr>' + tblClose()
}
function contactRow(items) {
  const w = Math.floor(9360 / items.length), widths = items.map(() => w)
  let o = tblOpen(widths) + '<w:tr>'
  items.forEach(it => {
    o += '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="' + C.navy + '"/><w:vAlign w:val="center"/></w:tcPr>'
    o += '<w:p><w:pPr><w:spacing w:before="60" w:after="10" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + runs(it[0], 19, C.goldsoft, 1, 0) + '</w:p>'
    o += '<w:p><w:pPr><w:spacing w:before="0" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + runs(it[1], 21, 'FFFFFF', 1, 0) + '</w:p>'
    o += '</w:tc>'
  })
  return o + '</w:tr>' + tblClose()
}

const HEADER_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:hdr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="' + C.h2 + '"/></w:pBdr>' +
  '<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>' +
  '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="' + C.mute + '"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>' +
  '<w:t xml:space="preserve">CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</w:t></w:r>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="' + C.mute + '"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>' +
  '<w:tab/><w:t xml:space="preserve">SVT.MB03 – BÁO GIÁ DỊCH VỤ</w:t></w:r></w:p></w:hdr>'

function footerRun(inner, italic) {
  return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' + (italic ? '<w:i/>' : '') +
    '<w:color w:val="' + C.mute + '"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>' + inner + '</w:r>'
}
const FOOTER_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:ftr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="6" w:space="2" w:color="' + C.line + '"/></w:pBdr>' +
  '<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>' +
  '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' +
  footerRun('<w:t xml:space="preserve">“Nâng Giá Trị – Đón Thành Công”  |  ĐT: 0989.666.253 (Ms. Huyền) – 0916.084.266 (Ms. Trang)</w:t>', true) +
  footerRun('<w:tab/><w:t xml:space="preserve">Trang </w:t>') +
  footerRun('<w:fldChar w:fldCharType="begin"/>') +
  footerRun('<w:instrText xml:space="preserve"> PAGE </w:instrText>') +
  footerRun('<w:fldChar w:fldCharType="separate"/>') +
  footerRun('<w:t>1</w:t>') +
  footerRun('<w:fldChar w:fldCharType="end"/>') +
  '</w:p></w:ftr>'

const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/>' +
  '<w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>' +
  '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>'

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
  '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'

const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

const DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'

// Khổ Letter, lề trái/phải 2,54cm. Giữ đúng số twip của bản chạy thử đã được duyệt.
const SECTPR = '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/>' +
  '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:right="1440" w:bottom="1000" w:left="1440" w:header="560" w:footer="500" w:gutter="0"/>' +
  '<w:cols w:space="720"/></w:sectPr>'

const SCOPE_BLOCKS = [
  ['Công việc Kế toán – Khai thuế', [
    'Khai thuế môn bài hàng năm.',
    'Lập và nộp tờ khai thuế giá trị gia tăng định kỳ theo quy định.',
    'Lập và nộp tờ khai thuế thu nhập cá nhân định kỳ.',
    'Lập báo cáo quyết toán thuế TNDN và TNCN năm.',
    'Thông báo cho doanh nghiệp số tiền thuế phải nộp khi có phát sinh.',
  ]],
  ['Công việc làm Sổ sách Kế toán', [
    'Kiểm tra chứng từ đầu vào, đầu ra cho phù hợp với quy định của pháp luật.',
    'Phân loại, sắp xếp, đóng chứng từ kế toán.',
    'Định khoản, hạch toán và ghi sổ kế toán; theo dõi công nợ, hàng tồn kho và giá vốn.',
    'Lập và in các loại sổ sách kế toán, Báo cáo tài chính năm theo quy định.',
  ]],
  ['Công việc Tư vấn – Giải trình Thuế', [
    'Tư vấn kế toán, thuế và hóa đơn chứng từ trong phạm vi công việc thực hiện.',
    'Cảnh báo rủi ro thuế và cập nhật kịp thời các thông tư, nghị định mới.',
    'Hỗ trợ tư vấn về lao động, bảo hiểm xã hội, bảo hiểm y tế.',
    'Làm việc với cơ quan thuế khi có yêu cầu và phối hợp với công ty kiểm toán.',
    'Đại diện giải trình với cơ quan thuế trong phạm vi số liệu do Savitax thực hiện.',
  ]],
  ['Giao nhận Chứng từ – Nộp Báo cáo', [
    'Nhận chứng từ từ khách hàng qua Drive / Zalo / trực tiếp.',
    'Nộp báo cáo thuế điện tử cho cơ quan thuế đúng thời hạn quy định.',
    'Gửi báo cáo tạm tính và xác nhận với khách hàng hàng tháng / quý.',
  ]],
]
// Mục 1.4 — phạm vi dịch vụ BHXH – HCNS (nguyên văn mẫu Giám đốc sửa 2026-09-11)
const BHXH_SCOPE = [
  ['Báo tăng lao động', 'Tiếp nhận thông tin nhân sự mới, kiểm tra hồ sơ và mức đóng; thực hiện hồ sơ báo tăng tham gia BHXH, BHYT, BHTN; theo dõi và thông báo kết quả'],
  ['Báo giảm lao động', 'Tiếp nhận thông tin người lao động nghỉ việc, kiểm tra thời điểm báo giảm; thực hiện hồ sơ báo giảm và theo dõi kết quả xử lý'],
  ['Điều chỉnh BHXH', 'Điều chỉnh mức đóng, chức danh và các thông tin của người lao động khi có thay đổi hoặc sai lệch; theo dõi kết quả điều chỉnh'],
  ['Theo dõi đóng BHXH hàng tháng', 'Kiểm tra số phải đóng, tình trạng đóng, các khoản truy đóng, điều chỉnh và phát sinh; thông báo cho Quý Công ty các khoản cần thực hiện'],
  ['Hồ sơ chế độ BHXH', 'Thực hiện hồ sơ ốm đau, thai sản, dưỡng sức và các chế độ phát sinh; kiểm tra hồ sơ, nộp hồ sơ, theo dõi và thông báo kết quả'],
  ['Giải trình với cơ quan BHXH', 'Rà soát hồ sơ khi có yêu cầu; chuẩn bị nội dung và tài liệu giải trình; làm việc với cơ quan BHXH theo phạm vi ủy quyền; bổ sung hồ sơ và theo dõi kết quả'],
  ['Theo dõi và xử lý hồ sơ', 'Theo dõi hồ sơ đã nộp, tiếp nhận yêu cầu bổ sung hoặc điều chỉnh, phối hợp xử lý và cập nhật tình trạng hồ sơ cho Quý Công ty'],
  ['Tư vấn BHXH', 'Hướng dẫn, giải đáp các vấn đề liên quan đến BHXH, BHYT, BHTN và các trường hợp phát sinh trong quá trình tham gia'],
  ['Lưu trữ hồ sơ', 'Quản lý và lưu trữ hồ sơ, chứng từ và kết quả thực hiện để phục vụ việc tra cứu, đối chiếu khi cần'],
]
const BHXH_DUTIES = [
  'Cung cấp đầy đủ, chính xác hồ sơ và thông tin của người lao động.',
  'Thông báo kịp thời các trường hợp tăng, giảm lao động, thay đổi mức đóng và phát sinh chế độ.',
  'Phối hợp ký, xác nhận hoặc bổ sung hồ sơ khi cần thiết.',
]
const CERTS = ['Chứng chỉ Kế toán trưởng', 'Chứng chỉ Hành nghề Đại lý thuế',
  'Chứng chỉ Hành nghề Kế toán (APC)', 'Bằng Thạc sĩ và Chứng chỉ Nghiệp vụ Sư phạm']
const STEP_ITEMS = [['01', 'Khảo sát nhu cầu'], ['02', 'Ký hợp đồng DV'], ['03', 'Tiếp nhận chứng từ'],
  ['04', 'Xử lý & Báo cáo'], ['05', 'Bàn giao & Lưu trữ']]

export function surveyRows(s) {
  const rows = []
  rows.push(['Tên công ty – Mã số thuế', (s.company || '—') + (s.mst ? '  –  ' + s.mst : '')])
  if (s.address) rows.push(['Địa chỉ', s.address])
  const contact = [s.contact, s.phone, s.email].filter(Boolean).join('  –  ')
  if (contact) rows.push(['Người liên hệ', contact])
  rows.push(['Ngành nghề kinh doanh', (SECTORS[s.sector] || SECTORS.tm).label + (s.customs ? ', có hoạt động xuất nhập khẩu' : '')])
  if (s.taxMix) rows.push(['Cơ cấu mặt hàng theo thuế suất', s.taxMix])
  rows.push(['Doanh thu', s.revenueYear ? vnd(s.revenueYear) + ' đồng/năm' : 'Chưa phát sinh'])
  const parts = []
  if (s.invIn) parts.push(vnd(s.invIn) + ' hóa đơn mua vào')
  if (s.invOut) parts.push(vnd(s.invOut) + ' hóa đơn bán ra')
  if (s.bankStmt) parts.push(vnd(s.bankStmt) + ' tờ sao kê ngân hàng')
  rows.push(['Số chứng từ bình quân/tháng',
    (s.docs > 0 ? vnd(s.docs) : 'Chưa phát sinh') + (parts.length ? '  (' + parts.join(' + ') + ')' : '')])
  if (s.customs && s.customsCount) rows.push(['Tờ khai hải quan', s.customsCount])
  const labor = []
  if (s.laborBh) labor.push(s.laborBh + ' lao động tham gia BHXH')
  if (s.laborNoBh) labor.push(s.laborNoBh + ' lao động không tham gia BHXH')
  if (s.internalAcc) labor.push(s.internalAcc + ' kế toán nội bộ')
  if (labor.length) rows.push(['Nhân sự', labor.join('  –  ')])
  const tech = [s.software && ('Phần mềm kế toán: ' + s.software), s.einvoice && ('Hóa đơn điện tử: ' + s.einvoice)].filter(Boolean).join('  –  ')
  if (tech) rows.push(['Phần mềm – Hóa đơn', tech])
  rows.push(['Kỳ kê khai thuế', s.monthlyFiling ? 'Theo tháng' : 'Theo quý'])
  if (s.settled) rows.push(['Tình trạng quyết toán thuế', s.settled])
  return rows
}

// Các ghi chú in trong khung xanh cuối báo giá (nguyên văn mẫu Giám đốc sửa 2026-09-11).
export function noteLines(s) {
  const gc = []
  gc.push('Giá trên chưa bao gồm thuế GTGT và các khoản thuế, tiền phạt doanh nghiệp phải nộp cho Nhà nước.')
  gc.push('Phí áp dụng cho doanh nghiệp FDI phí cộng thêm 20%. Phí chưa bao gồm các báo cáo gửi cho Sở Tài chính với các báo cáo đầu tư. Phí dịch vụ báo cáo đầu tư hoặc báo cáo Ngân hàng Nhà nước là 2.000.000 đ/báo cáo.')
  gc.push('Phí phần mềm kế toán MISA ASP: ' + money(MISA_YEAR) + '/năm; chữ ký số, hóa đơn điện tử theo báo giá nhà cung cấp.')
  if (!s.wantHcns) gc.push('Phí tăng/giảm lao động từng lần: 500.000 đ/lần (áp dụng do Quý Công ty chưa sử dụng dịch vụ hành chính nhân sự của Savitax).')
  gc.push('Phí được cố định trong 01 năm tài chính, điều chỉnh nếu khối lượng thực tế thay đổi đáng kể so với khảo sát. Thanh toán theo thỏa thuận trong hợp đồng dịch vụ.')
  return gc
}

// Các dòng phí THÁNG in trong bảng báo giá gửi khách. Có đề xuất mức phí khác (Giám đốc duyệt) thì
// phần chênh dồn vào dòng "Dịch vụ kế toán – thuế trọn gói" để cộng các dòng ra ĐÚNG dòng TỔNG — khách
// không thấy bảng cộng lệch (chốt 2026-09-11; bản chạy thử cũ in dòng theo biểu phí mà tổng theo đề xuất).
// Chênh lớn tới mức dòng kế toán âm thì giữ nguyên dòng theo biểu phí, không in số âm.
export function printedMonthlyLines(fees, monthlyFinal) {
  const lines = (fees?.lines || []).filter(l => !l.yearly)
  const sum = lines.reduce((a, l) => a + (Number(l.fee) || 0), 0)
  const diff = Math.round(Number(monthlyFinal) || 0) - sum
  if (!diff) return lines
  return lines.map(l => {
    if (l.key !== 'base') return l
    const fee = (Number(l.fee) || 0) + diff
    return fee >= 0 ? { ...l, fee } : l
  })
}

// "2026-08-30" → "30 tháng 08 năm 2026" (in trên file Word)
export function dateText(iso) {
  const [y, m, d] = String(iso || '').split('-')
  return d && m && y ? d + ' tháng ' + m + ' năm ' + y : ''
}

// q: { quoteNo, quoteDate(ISO), survey, fees, monthlyFinal }
export function buildDocumentXml(q) {
  const s = q.survey, f = q.fees
  let b = ''
  b += banner('CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX', '“Nâng Giá Trị – Đón Thành Công”')
  b += para('ĐỀ XUẤT DỊCH VỤ VÀ BÁO GIÁ', 30, C.gold, 1, 0, 'center', 0, 160, 120, '')
  b += para('Số: ' + q.quoteNo + '   |   Ngày ' + dateText(q.quoteDate) + '   |   Hiệu lực: 30 ngày', 22, C.h2, 1, 1, 'center', 0, 0, 140, '')
  b += para('Kính gửi: ' + (s.company || 'QUÝ KHÁCH HÀNG') + (s.mst ? '  –  MST ' + s.mst : ''), 22, C.h3, 1, 0, '', 0, 180, 70, '')
  b += para('Trước tiên, SAVITAX xin gửi lời cảm ơn chân thành nhất đến sự quan tâm của Quý khách hàng đối với các dịch vụ của chúng tôi. Được đồng hành cùng Quý doanh nghiệp là niềm vinh dự lớn nhất của đội ngũ SAVITAX.', SZP, C.ink, 0, 0, 'both', 0, 50, 50, '')
  b += para('Với tiêu chí **“Nâng Giá Trị – Đón Thành Công”**, chúng tôi luôn cố gắng hết mình vì sự thành công và phát triển của Quý doanh nghiệp. Căn cứ Phiếu khảo sát Quý Công ty đã cung cấp, SAVITAX xin trân trọng gửi đến Quý khách hàng đề xuất dịch vụ và báo giá chi tiết như sau:', SZP, C.ink, 0, 0, 'both', 0, 50, 50, '')

  b += para('PHẦN I.  GIỚI THIỆU VÀ QUY TRÌNH LÀM VIỆC CỦA SAVITAX', 24, C.h2, 1, 0, '', 0, 260, 120, C.gold)
  b += para('1.1   Giới thiệu về Savitax', 22, C.h3, 1, 0, '', 0, 180, 70, '')
  b += para('Công ty Cổ phần Tư vấn Thuế Savitax được thành lập từ năm 2016 với đội ngũ nhân sự là một tập thể tinh hoa, giàu chuyên môn và nhiệt huyết. Các thành viên trong đội ngũ không chỉ sở hữu nền tảng học vấn vững chắc, mà còn có trong tay những chứng chỉ chuyên môn uy tín:', SZP, C.ink, 0, 0, 'both', 0, 50, 50, '')
  CERTS.forEach(c => { b += para('•  ' + c, SZP, C.ink, 0, 0, 'both', 284, 30, 30, '') })
  b += para('Với hơn 15 năm kinh nghiệm trong ngành, SAVITAX đã đồng hành cùng hơn 5.000 doanh nghiệp trong và ngoài nước, đảm nhận các dự án quan trọng như hoàn thuế, soát xét sổ sách, quyết toán thuế và tư vấn pháp lý doanh nghiệp. Hệ thống gồm trụ sở chính tại TP.HCM và 5 chi nhánh tại Bitexco, Đồng Nai, Lâm Đồng, Hà Nội, Bắc Ninh; đạt chứng nhận ISO 9001:2015.', SZP, C.ink, 0, 0, 'both', 0, 50, 50, '')
  b += oneCell('Cam kết: Chính xác  –  Kịp thời  –  Bảo mật  –  Tận tâm', C.boxbg, C.navy, 22, true, 'center', C.gold)
  b += para('1.2   Quy trình làm việc của Savitax với Khách hàng', 22, C.h3, 1, 0, '', 0, 180, 70, '')
  b += stepsRow(STEP_ITEMS)

  b += para('1.3   Phạm vi công việc thực hiện', 22, C.h3, 1, 0, '', 0, 180, 70, '')
  SCOPE_BLOCKS.forEach(([title, items]) => {
    b += oneCell(title, C.bar, 'FFFFFF', 22, true, '', '')
    items.forEach(t => { b += para('•  ' + t, SZP, C.ink, 0, 0, 'both', 284, 30, 30, '') })
  })

  b += para('1.4   Phạm vi công việc dịch vụ bảo hiểm xã hội – hành chính nhân sự', 22, C.h3, 1, 0, '', 0, 180, 70, '')
  b += para('SAVITAX thực hiện các công việc liên quan đến bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp cho doanh nghiệp trên cơ sở hồ sơ, thông tin và chứng từ do Quý Công ty cung cấp:', SZP, C.ink, 0, 0, 'both', 0, 50, 50, '')
  const WB = [600, 2560, 6200]
  b += tblOpen(WB)
  b += tblRow(WB, ['STT', 'Hạng mục', 'Nội dung Savitax thực hiện'], { header: true, fill: C.bar, color: 'FFFFFF', bold: true })
  BHXH_SCOPE.forEach(([name, desc], i) => { b += tblRow(WB, [String(i + 1), name, desc], { fill: i % 2 === 0 ? C.wash : '' }) })
  b += tblClose()
  b += oneCell('Trách nhiệm phối hợp của Quý Công ty', C.bar, 'FFFFFF', 22, true, '', '')
  BHXH_DUTIES.forEach(t => { b += para('•  ' + t, SZP, C.ink, 0, 0, 'both', 284, 30, 30, '') })
  b += para('SAVITAX thực hiện dịch vụ trên cơ sở hồ sơ và thông tin do Quý Công ty cung cấp. Thời gian hoàn tất hồ sơ phụ thuộc vào thời điểm nhận đủ hồ sơ và thời gian xử lý thực tế của cơ quan bảo hiểm xã hội.', 20, C.mute, 0, 1, 'both', 0, 40, 40, '')

  b += para('PHẦN II.  KHẢO SÁT VÀ BÁO GIÁ CỤ THỂ', 24, C.h2, 1, 0, '', 0, 260, 120, C.gold)
  b += para('2.1   Thông tin ghi nhận từ khảo sát', 22, C.h3, 1, 0, '', 0, 180, 70, '')
  const W2 = [3300, 6060]
  b += tblOpen(W2)
  surveyRows(s).forEach((r, i) => { b += tblRow(W2, r, { fill: i % 2 === 0 ? C.wash : '' }) })
  b += tblClose()

  const notes = (s.notes || '').split('\n').map(t => t.trim()).filter(Boolean)
  if (notes.length) {
    b += para('2.2   Lưu ý của Savitax dành cho Quý Công ty', 22, C.h3, 1, 0, '', 0, 180, 70, '')
    notes.forEach(t => { b += para('•  ' + t, SZP, C.ink, 0, 0, 'both', 284, 30, 30, '') })
  }

  b += para((notes.length ? '2.3' : '2.2') + '   Báo giá dịch vụ', 22, C.h3, 1, 0, '', 0, 180, 70, '')
  const W3 = [600, 5560, 3200]
  b += tblOpen(W3)
  b += tblRow(W3, ['STT', 'Nội dung dịch vụ', 'Phí dịch vụ (VNĐ)'], { header: true, fill: C.bar, color: 'FFFFFF', bold: true })
  let i = 0
  printedMonthlyLines(f, q.monthlyFinal).forEach(l => {
    i++
    b += tblRow(W3, [String(i), l.label, money(l.fee) + '/tháng'], {})
  })
  b += tblRow(W3, ['', 'TỔNG PHÍ HÀNG THÁNG', money(q.monthlyFinal) + '/tháng'], { fill: C.boxbg, color: C.gold, bold: true })
  b += tblClose()

  if (f.optional && f.optional.length) {
    b += para((notes.length ? '2.4' : '2.3') + '   Dịch vụ tùy chọn theo nhu cầu', 22, C.h3, 1, 0, '', 0, 180, 70, '')
    b += tblOpen(W3)
    b += tblRow(W3, ['STT', 'Nội dung dịch vụ', 'Phí dịch vụ (VNĐ)'], { header: true, fill: C.bar, color: 'FFFFFF', bold: true })
    f.optional.forEach((o, k) => {
      b += tblRow(W3, [String(k + 1), o.label + (o.note ? ' (' + o.note + ')' : ''), money(o.fee) + '/' + o.unit], {})
    })
    b += tblClose()
  }

  b += oneCell('**Ghi chú:**<br>' + noteLines(s).map(t => '•  ' + t).join('<br>'), C.navy, 'FFFFFF', 21, false, '', '')

  b += para('CẢM ƠN QUÝ KHÁCH ĐÃ CHO PHÉP SAVITAX LÀ NGƯỜI BẠN ĐỒNG HÀNH VÌ SỰ PHÁT TRIỂN CỦA QUÝ DOANH NGHIỆP', 24, C.gold, 1, 0, 'center', 0, 140, 60, '')
  b += contactRow([['Hotline', '0989.666.253 – 0916.084.266'], ['Email', 'ketoan@savitax.vn'], ['Website', 'www.savitax.vn']])

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + b + SECTPR + '</w:body></w:document>'
}

// Trả Uint8Array của file .docx
export function buildQuoteDocx(q) {
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', ROOT_RELS)
  zip.file('word/document.xml', buildDocumentXml(q))
  zip.file('word/_rels/document.xml.rels', DOC_RELS)
  zip.file('word/styles.xml', STYLES_XML)
  zip.file('word/header1.xml', HEADER_XML)
  zip.file('word/footer1.xml', FOOTER_XML)
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}

// ── Quy ước tên file/thư mục Drive (tài liệu bàn giao mục 9) ─────────────────
export function safeName(s) { return String(s || 'KHACH HANG').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() }
function dmyParts(iso) { const [y, m, d] = String(iso || '').split('-'); return { y, m, d } }
// DD-MM-YY_Tên Công ty
export function folderName(quoteDate, company) {
  const { y, m, d } = dmyParts(quoteDate)
  return d + '-' + m + '-' + String(y).slice(2) + '_' + safeName(company)
}
// SVT.MB03.BÁO GIÁ_Tên_DD.MM.YYYY.docx
export function quoteFileName(quoteDate, company) {
  const { y, m, d } = dmyParts(quoteDate)
  return 'SVT.MB03.BÁO GIÁ_' + safeName(company).slice(0, 80) + '_' + d + '.' + m + '.' + y + '.docx'
}
// SVT.MB01.KHẢO SÁT_Tên_DD.MM.YYYY.docx
export function surveyFileName(quoteDate, company) {
  const { y, m, d } = dmyParts(quoteDate)
  return 'SVT.MB01.KHẢO SÁT_' + safeName(company).slice(0, 80) + '_' + d + '.' + m + '.' + y + '.docx'
}
