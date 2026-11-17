// Phân hệ Pháp lý — điền dữ liệu hồ sơ vào file Word mẫu (templates/phaply/word/<MÃ>.docx) bằng docxtemplater.
// Ô thiếu dữ liệu in thành chỗ chấm "…………" để nhân viên viết tay / thấy ngay chỗ thiếu; việc CHẶN xuất khi thiếu
// trường bắt buộc nằm ở bước kiểm "đủ dữ liệu" (thieuTruong), không ở đây.
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export const CHO_TRONG = '…………………'

// choTrong: chữ in vào ô thiếu dữ liệu (bộ kiểm truyền một dấu riêng để không lẫn với dòng chấm viết tay của mẫu)
export function dienMau(buf, duLieu, { choTrong = CHO_TRONG } = {}) {
  const doc = new Docxtemplater(new PizZip(buf), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: part => (part.module ? '' : choTrong),
  })
  doc.render(duLieu)
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// Liệt kê thẻ trong một file mẫu: [{ten, loai: 'the'|'lap'|'dieu_kien', cha}]
export function theTrongMau(buf) {
  const xml = new PizZip(buf).file('word/document.xml').asText().replace(/<[^>]+>/g, '')
  const ra = new Map()
  for (const m of xml.matchAll(/\{([#^/]?)([a-z0-9_]+)\}/g)) {
    if (m[1] === '/') continue
    const k = m[2]
    if (!ra.has(k)) ra.set(k, m[1] ? 'khoi' : 'the')
  }
  return ra
}
