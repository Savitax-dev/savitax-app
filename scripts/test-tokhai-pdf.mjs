// Dựng thử PDF từ file XML thật rồi xem kết quả — Phân hệ Tờ khai, GĐ 6.
//
//   node scripts/test-tokhai-pdf.mjs
//   node scripts/test-tokhai-pdf.mjs --thumuc "D:\\...\\BAOCAOTHUE_Q1_2026_THINHPHAT" --ra "C:\\...\\ra"
//
// PHÔNG CHỮ: mặc định Tinos trong public/fonts — đúng phông của bản chạy thật (giấy phép SIL OFL,
// phát hành kèm app được, cùng bề rộng chữ với Times New Roman). Thêm --times để dựng bằng Times
// New Roman của Windows mà so sánh bố cục.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { dungPdfThongBao, dungPdfToKhai } from '../lib/tokhaiPdf.js'
import { docThongBaoXml, docToKhaiXml } from '../lib/tokhaiXml.js'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d }

const THU_MUC = arg('thumuc', 'C:\\Users\\win\\Downloads\\BAOCAOTHUE_Q1_2026_THINHPHAT')
const RA = arg('ra', join(process.cwd(), 'tmp-pdf-thu'))

const dungTimes = process.argv.includes('--times')
const W = 'C:\\Windows\\Fonts'
const T = join(process.cwd(), 'public', 'fonts')
const fonts = dungTimes
  ? {
    thuong: readFileSync(join(W, 'times.ttf')),
    dam: readFileSync(join(W, 'timesbd.ttf')),
    nghieng: readFileSync(join(W, 'timesi.ttf')),
  }
  : {
    thuong: readFileSync(join(T, 'Tinos-Regular.ttf')),
    dam: readFileSync(join(T, 'Tinos-Bold.ttf')),
    nghieng: readFileSync(join(T, 'Tinos-Italic.ttf')),
  }

// pdf-lib gặp chữ mà phông không có glyph thì in ra Ô TRỐNG và KHÔNG báo lỗi. Kiểu lỗi đó chỉ phát
// hiện được bằng mắt, nên chặn ngay từ đây: soát mọi ký tự sẽ đem in.
function kiemPhuDau(tenPhong, duLieu, chuCoDinh) {
  const f = fontkit.create(duLieu)
  const chu = new Set()
  for (const s of chuCoDinh) for (const kt of String(s || '')) chu.add(kt)
  const thieu = [...chu].filter(kt => {
    const cp = kt.codePointAt(0)
    if (cp < 32) return false
    return !f.hasGlyphForCodePoint(cp)
  })
  if (thieu.length) {
    console.error(`  THIẾU GLYPH ở phông ${tenPhong}: ${thieu.map(k => `${k} (U+${k.codePointAt(0).toString(16).toUpperCase()})`).join(', ')}`)
    return false
  }
  console.log(`  ${tenPhong}: đủ dấu cho ${chu.size} ký tự khác nhau`)
  return true
}

// Quét đệ quy tìm mọi file .xml — thư mục thật hay có một lớp lồng do giải nén .rar.
function timXml(goc) {
  const ra = []
  const di = d => {
    for (const ten of readdirSync(d)) {
      const p = join(d, ten)
      if (statSync(p).isDirectory()) di(p)
      else if (/\.xml$/i.test(ten)) ra.push(p)
    }
  }
  di(goc)
  return ra.sort()
}

mkdirSync(RA, { recursive: true })

const ds = timXml(THU_MUC)
if (!ds.length) {
  console.error('Không thấy file .xml nào trong: ' + THU_MUC)
  process.exit(1)
}

console.log(`Phông:         ${dungTimes ? 'Times New Roman (Windows)' : 'Tinos (public/fonts)'}`)
console.log(`Thư mục nguồn: ${THU_MUC}`)
console.log(`Thư mục ra:    ${RA}`)
console.log(`Tìm thấy ${ds.length} file XML.`)

// Toàn bộ chữ cái tiếng Việt có dấu, cộng dấu câu và ký hiệu mà bản in dùng tới. Kiểm cả bộ này
// thay vì chỉ kiểm chữ có trong 4 file mẫu — công ty khác, kỳ khác sẽ có chữ khác.
const CHU_VIET = 'aàáâãăạảấầẩẫậắằẳẵặbcdđeèéêẹẻẽếềểễệfghiìíĩỉịjklmnoòóôõơọỏốồổỗộớờởỡợpqrstuùúũưụủứừửữựvwxyỳýỹỷỵz'
const KY_HIEU = '0123456789 .,;:!?()[]{}/\\-–—_+=*&%#@\'"…°'
const CHU_CAN_CO = CHU_VIET + CHU_VIET.toUpperCase() + KY_HIEU + 'Ð'   // Ð U+00D0: cổng dùng trong 'TB-TÐT'

console.log('\nKiểm phủ dấu:')
const noiDung = new Map(ds.map(p => [p, readFileSync(p, 'utf8')]))
const duDau = [
  kiemPhuDau('thường', fonts.thuong, [CHU_CAN_CO, ...noiDung.values()]),
  kiemPhuDau('đậm', fonts.dam, [CHU_CAN_CO]),
  kiemPhuDau('nghiêng', fonts.nghieng, [CHU_CAN_CO]),
].every(Boolean)
if (!duDau) {
  console.error('\nDỪNG: phông thiếu glyph, in ra sẽ có ô trống mà không báo lỗi.')
  process.exit(1)
}
console.log('')

let hong = 0
for (const p of ds) {
  const ten = basename(p)
  const xml = noiDung.get(p)
  try {
    let pdfBytes, mo
    if (/<TBaoThueDTu/.test(xml)) {
      const tb = docThongBaoXml(xml)
      pdfBytes = await dungPdfThongBao(tb, fonts)
      mo = `thông báo · mã ${tb.maTBao} · ${tb.soTBao} · ${tb.hoSo.length} hồ sơ`
        + ` · trạng thái ${tb.trangThai}`
    } else if (/<HSoThueDTu/.test(xml)) {
      const tk = docToKhaiXml(xml)
      const coSo = tk.chiTieu.filter(c => c.gia && !/^0+$/.test(c.gia)).length
      pdfBytes = await dungPdfToKhai(tk, fonts)
      mo = `tờ khai · mã ${tk.maTKhai} · ${tk.kieuKy}${tk.kyKKhai}`
        + ` · ${tk.chiTieu.length} chỉ tiêu (${coSo} khác 0)`
    } else {
      console.log(`  BỎ QUA  ${ten} — không phải tờ khai hay thông báo`)
      continue
    }
    const raTen = ten.replace(/\.xml$/i, '.pdf')
    writeFileSync(join(RA, raTen), pdfBytes)
    console.log(`  OK      ${raTen}  (${(pdfBytes.length / 1024).toFixed(0)} KB)`)
    console.log(`          ${mo}`)
  } catch (e) {
    hong++
    console.log(`  HỎNG    ${ten} — ${e.message}`)
  }
}

console.log(hong === 0 ? '\nDựng xong, không lỗi.' : `\nCÓ ${hong} FILE HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
