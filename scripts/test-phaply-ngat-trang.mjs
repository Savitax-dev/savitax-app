// Bộ kiểm NGẮT TRANG mẫu Word phân hệ Pháp lý — dựng mọi mẫu, điền dữ liệu GIẢ, đổi PDF qua ĐÚNG dịch vụ VPS (LibreOffice, bản phòng
// pháp lý tải về) rồi đo từng trang: trang KHÔNG phải trang cuối mà phần chữ kết thúc quá cao (bỏ trống phía dưới > NGUONG) là lỗi
// "ngắt trang bất thường" — nguyên nhân thường gặp: ép sang trang, chuỗi giữ-cùng-trang (#…k) quá dài, hàng bảng quá cao không tách.
// Pháp lý nhắc nhiều lần (18/11, 25/11/2026: "nhất là hiện tượng ngắt trang") → mẫu mới nào cũng phải qua bộ này.
//   node --env-file=.env.local scripts/test-phaply-ngat-trang.mjs [MÃ …] [--giu <thư mục>]
// Cần PHAPLY_PDF_URL / _SECRET / _CA trong .env.local (dịch vụ đổi PDF ở VPS).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { dongGoi } from '../lib/phaply/word/khung.js'
import { DANH_MUC } from '../lib/phaply/word/danhMuc.js'
import { chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { dienMau } from '../lib/phaply/word/xuat.js'
import { doiPdf } from '../lib/phaply/pdf.js'
import { DU_LIEU_GIA } from './phaply-du-lieu-gia.mjs'

const KY = /ngày.{0,12}tháng|NGƯỜI (ĐẠI DIỆN|TRỰC TIẾP|NỘP)|CHỦ SỞ HỮU|CHỦ TỊCH|THÀNH VIÊN|Thành viên|\(Ký/i
const NGUONG = 0.22          // trống phía dưới quá 22% chiều cao trang (trừ trang cuối) = ngắt trang bất thường
const thamSo = process.argv.slice(2)
const giu = thamSo.includes('--giu') ? thamSo[thamSo.indexOf('--giu') + 1] : null
const chon = thamSo.filter((t, i) => /^[A-Z0-9_]+$/.test(t) && thamSo[i - 1] !== '--giu')

// dựng + điền
const ds = []
for (const m of DANH_MUC.filter(m => !chon.length || chon.includes(m.ma))) {
  let goc
  try { goc = dongGoi(readFileSync(`lib/phaply/word/nguon/${m.ma}.txt`, 'utf8'), { tieuDe: m.ten }) } catch { continue }
  for (const lh of m.loaiHinh.flatMap(l => [].concat(m.duLieuThu?.[l] || l)).filter(k => DU_LIEU_GIA[k])) {
    ds.push({ ten: `${m.ma}_${lh}.docx`, buf: dienMau(goc, chuanBiDuLieu(DU_LIEU_GIA[lh])) })
  }
}
if (giu) mkdirSync(giu, { recursive: true })

// đổi PDF theo lô (dịch vụ nhận tối đa 40 file / lượt)
const pdfs = []
for (let i = 0; i < ds.length; i += 30) pdfs.push(...await doiPdf(ds.slice(i, i + 30)))

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
let loi = 0
for (const p of pdfs) {
  if (giu) writeFileSync(join(giu, p.ten), p.buf)
  const doc = await pdfjs.getDocument({ data: new Uint8Array(p.buf), useSystemFonts: false, isEvalSupported: false }).promise
  const xau = [], nhac = []
  for (let n = 1; n <= doc.numPages; n++) {
    const tr = await doc.getPage(n)
    const [, , , cao] = tr.view
    const nd = await tr.getTextContent()
    const ys = nd.items.filter(it => String(it.str || '').trim()).map(it => it.transform[5])
    if (!ys.length) { xau.push(`trang ${n} TRẮNG`); continue }
    if (n === doc.numPages) continue
    const trong = Math.min(...ys) / cao          // tọa độ PDF tính từ đáy trang
    if (trong <= NGUONG) continue
    // cả KHỐI CHỮ KÝ không đủ chỗ nên sang trang sau là ĐÚNG (không được tách đôi chữ ký) → chỉ nhắc, không tính lỗi
    const sau = await (await doc.getPage(n + 1)).getTextContent()
    const dau = sau.items.filter(it => String(it.str || '').trim()).sort((a, b) => b.transform[5] - a.transform[5]).slice(0, 3).map(it => it.str).join(' ')
    if (KY.test(dau)) nhac.push(`trang ${n} trống ${Math.round(trong * 100)}% (khối chữ ký sang trang ${n + 1})`)
    else xau.push(`trang ${n} trống ${Math.round(trong * 100)}% phía dưới`)
  }
  if (xau.length) { loi++; console.log(`✗ ${p.ten.replace(/\.pdf$/, '').padEnd(20)} ${doc.numPages} trang · ${xau.join(' · ')}`) }
  else console.log(`${nhac.length ? '⚠' : '✓'} ${p.ten.replace(/\.pdf$/, '').padEnd(20)} ${doc.numPages} trang${nhac.length ? ' · ' + nhac.join(' · ') : ''}`)
}
console.log(`\n${loi ? '✗ ' + loi + ' file ngắt trang bất thường' : '✓ không file nào ngắt trang bất thường'} (${pdfs.length} file, ngưỡng trống ${NGUONG * 100}%)${giu ? ' — PDF ở ' + giu : ''}`)
process.exit(loi ? 1 : 0)
