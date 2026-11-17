// Dựng docs/huong-dan-phan-he-phap-ly.docx từ docs/huong-dan-phan-he-phap-ly.md (bản in / gửi cho phòng pháp lý).
//   node scripts/phaply-huong-dan-docx.mjs
// Markdown → HTML (bộ đổi gọn, đủ cho tài liệu này: tiêu đề, đoạn, danh sách, bảng, trích dẫn, đậm/nghiêng/mã/liên kết) → Microsoft
// Word trên máy mở HTML rồi lưu .docx. Mỗi "Phần" (##) sang TRANG MỚI (anh dặn 17/11/2026: chương mới qua trang mới).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const VAO = 'docs/huong-dan-phan-he-phap-ly.md', RA = resolve('docs/huong-dan-phan-he-phap-ly.docx')
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const dong = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  .replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1')                       // liên kết nội bộ: giữ chữ
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')

const md = readFileSync(VAO, 'utf8').replace(/\r/g, '').split('\n')
let html = '', i = 0, soH2 = 0
while (i < md.length) {
  const l = md[i]
  if (!l.trim() || /^---+$/.test(l.trim())) { i++; continue }
  let m
  if ((m = l.match(/^(#{1,4}) (.*)$/))) {
    const n = m[1].length
    const sang = n === 2 && soH2++ > 0 ? ' style="page-break-before:always"' : ''   // Phần mới → trang mới (trừ mục đầu)
    html += `<h${n}${sang}>${dong(m[2])}</h${n}>`; i++; continue
  }
  if (l.startsWith('|')) {
    const hang = []
    while (i < md.length && md[i].startsWith('|')) { hang.push(md[i]); i++ }
    const o = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
    html += '<table><tr>' + o(hang[0]).map(c => `<th>${dong(c)}</th>`).join('') + '</tr>' +
      hang.slice(2).map(r => '<tr>' + o(r).map(c => `<td>${dong(c)}</td>`).join('') + '</tr>').join('') + '</table>'
    continue
  }
  if (/^>/.test(l)) {
    const ds = []
    while (i < md.length && /^>/.test(md[i])) { ds.push(md[i].replace(/^>\s?/, '')); i++ }
    html += `<p class="luu-y">${dong(ds.join(' '))}</p>`; continue
  }
  if (/^\s*([-*]|\d+\.) /.test(l)) {
    const so = /^\s*\d+\./.test(l)
    let s = so ? '<ol>' : '<ul>'
    while (i < md.length && /^\s*([-*]|\d+\.) /.test(md[i])) {
      const sau = md[i].match(/^(\s*)/)[1].length >= 2
      let noi = md[i].replace(/^\s*([-*]|\d+\.) /, '')
      i++
      while (i < md.length && /^\s{2,}\S/.test(md[i]) && !/^\s*([-*]|\d+\.) /.test(md[i])) { noi += ' ' + md[i].trim(); i++ }
      s += `<li${sau ? ' class="cap2"' : ''}>${dong(noi)}</li>`
    }
    html += s + (so ? '</ol>' : '</ul>'); continue
  }
  const doan = [l.trim()]; i++
  while (i < md.length && md[i].trim() && !/^(#|\||>|---|\s*([-*]|\d+\.) )/.test(md[i])) { doan.push(md[i].trim()); i++ }
  html += `<p>${dong(doan.join(' '))}</p>`
}

const trang = `<html><head><meta charset="utf-8"><style>
body{font-family:'Times New Roman';font-size:12.5pt;line-height:1.35}
h1{font-size:18pt;text-align:center;color:#8E1F1F} h2{font-size:15pt;color:#8E1F1F;border-bottom:1.5pt solid #C9A027;padding-bottom:2pt}
h3{font-size:13pt;color:#333} table{border-collapse:collapse;width:100%;margin:6pt 0} th,td{border:.75pt solid #999;padding:3pt 5pt;vertical-align:top;font-size:11.5pt}
th{background:#F8E5E1} code{font-family:Consolas;font-size:11pt} .luu-y{background:#FFF7E6;border-left:3pt solid #C9A027;padding:4pt 8pt} li.cap2{margin-left:18pt}
</style></head><body>${html}</body></html>`
const tam = mkdtempSync(join(tmpdir(), 'hd-phaply-'))
const fHtml = join(tam, 'huong-dan.html')
writeFileSync(fHtml, trang)
const ps = `$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try { $d = $w.Documents.Open('${fHtml}'); $d.PageSetup.TopMargin = 56; $d.PageSetup.BottomMargin = 56; $d.PageSetup.LeftMargin = 64; $d.PageSetup.RightMargin = 56
$d.SaveAs2('${RA}', 16); $n = $d.ComputeStatistics(2); $d.Close([ref]0); Write-Output "OK $n trang" } finally { $w.Quit() }`
console.log(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { encoding: 'utf8' }).trim(), '→', RA)
