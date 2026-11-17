// Phân hệ Pháp lý — đổi Word → PDF qua dịch vụ trên VPS Savitax (vps/phaply-pdf, LibreOffice 7.3; anh chọn dùng chung VPS 17/11/2026).
// CHỈ chạy ở máy chủ. HTTPS chứng chỉ tự ký → GHIM đúng chứng chỉ (PHAPLY_PDF_CA), không tắt kiểm tra TLS. Khoá: PHAPLY_PDF_SECRET.
//   PHAPLY_PDF_URL   https://103.126.161.187:8443
// Đã đo 17/11 (VPS 1 nhân / 1 GB): 2–4 giây mỗi mẫu, RAM đỉnh ~210 MB; bản in giống Word (đường chấm, ô ☐☒, số trang).
// Phông: Times New Roman → Liberation Serif (cùng kích thước chữ), Segoe UI Symbol → DejaVu Sans.
import https from 'node:https'
import PizZip from 'pizzip'
import { PDFDocument } from 'pdf-lib'

export const coPdf = () => !!(process.env.PHAPLY_PDF_URL && process.env.PHAPLY_PDF_SECRET && process.env.PHAPLY_PDF_CA)

function guiGoi(buf) {
  const u = new URL('/doi', process.env.PHAPLY_PDF_URL)
  return new Promise((resolve, reject) => {
    const req = https.request(u, {
      method: 'POST', ca: String(process.env.PHAPLY_PDF_CA).replace(/\\n/g, '\n'), timeout: 55000,
      headers: { Authorization: 'Bearer ' + process.env.PHAPLY_PDF_SECRET, 'Content-Type': 'application/zip', 'Content-Length': buf.length },
    }, res => {
      const ds = []
      res.on('data', c => ds.push(c))
      res.on('end', () => {
        const body = Buffer.concat(ds)
        if (res.statusCode === 200) return resolve(body)
        let loi = ''
        try { loi = JSON.parse(body.toString()).loi } catch { loi = '' }
        reject(new Error(`Dịch vụ PDF báo lỗi ${res.statusCode}${loi ? ': ' + loi : ''}`))
      })
    })
    req.on('timeout', () => req.destroy(new Error('Dịch vụ PDF không trả lời (quá 55 giây)')))
    req.on('error', e => reject(new Error(/timeout|không trả lời/i.test(e.message) ? e.message : 'Không kết nối được dịch vụ PDF — Word vẫn tải được bình thường')))
    req.end(buf)
  })
}

// files: [{ ten: 'xx.docx', buf }] → [{ ten: 'xx.pdf', buf }] cùng thứ tự. MỘT lượt gửi cho cả bộ (dịch vụ chạy LibreOffice một lần).
export async function doiPdf(files) {
  if (!coPdf()) throw new Error('Chưa cấu hình dịch vụ PDF')
  const z = new PizZip()
  for (const f of files) z.file(f.ten, f.buf)
  const ra = new PizZip(await guiGoi(z.generate({ type: 'nodebuffer', compression: 'DEFLATE' })))
  return files.map(f => {
    const ten = f.ten.replace(/\.docx$/i, '.pdf')
    const tep = ra.file(ten)
    if (!tep) throw new Error('Dịch vụ PDF trả thiếu file ' + ten)
    return { ten, buf: tep.asNodeBuffer() }
  })
}

// Gộp nhiều PDF thành MỘT file theo thứ tự (bộ trình ký in một lần)
export async function gopPdf(bufs) {
  const out = await PDFDocument.create()
  for (const b of bufs) {
    const src = await PDFDocument.load(b)
    for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p)
  }
  return Buffer.from(await out.save())
}
