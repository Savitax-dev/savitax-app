// Lấy chữ từ PDF (pdfjs-dist), gom thành DÒNG theo toạ độ — chạy trên máy nhân viên, chỉ đọc.
//
// Trình duyệt: nạp 'pdfjs-dist' khi cần (không làm nặng trang lúc mở) + worker riêng.
// Node (bộ kiểm): truyền sẵn thư viện bản legacy qua `pdfjs` — xem scripts/test-phantich-pdf.mjs.
//
// Chỉ đọc vài trang đầu: tờ khai nằm ở 1–3 trang đầu, phía sau là bảng kê kèm theo (file thật dài 30+ trang).

let napSan = null
async function napPdfjs() {
  if (!napSan) {
    napSan = import('pdfjs-dist').then(lib => {
      if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions.workerPort) {
        lib.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
      }
      return lib
    })
  }
  return napSan
}

// Các mẩu chữ của một trang → dòng (trên xuống, trái sang phải). Hai mẩu lệch nhau ≤ 2 điểm theo chiều dọc
// coi là cùng dòng (chữ in đậm / cỡ khác nhau hay lệch 1 điểm).
export function gomDong(items) {
  const ms = items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4], y: it.transform[5], s: it.str }))
  ms.sort((a, b) => b.y - a.y || a.x - b.x)
  const dong = []
  for (const m of ms) {
    const cuoi = dong[dong.length - 1]
    if (cuoi && Math.abs(cuoi.y - m.y) <= 2) cuoi.ms.push(m)
    else dong.push({ y: m.y, ms: [m] })
  }
  return dong.map(d => d.ms.sort((a, b) => a.x - b.x).map(m => m.s).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
}

// buf: ArrayBuffer | Uint8Array → [[dòng…] mỗi trang]. Dừng sớm khi gặp "Tôi cam đoan" (hết phần tờ khai).
export async function layDongPdf(buf, { soTrangToiDa = 4, pdfjs } = {}) {
  const lib = pdfjs || await napPdfjs()
  // pdfjs từ chối Buffer của node (dù Buffer là Uint8Array) và có thể "chuyển giao" mất mảng gốc → luôn chép ra mảng mới
  const data = buf instanceof ArrayBuffer ? new Uint8Array(buf.slice(0)) : Uint8Array.from(buf)
  const doc = await lib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  try {
    const trang = []
    for (let p = 1; p <= Math.min(doc.numPages, soTrangToiDa); p++) {
      const pg = await doc.getPage(p)
      const dong = gomDong((await pg.getTextContent()).items)
      trang.push(dong)
      if (dong.some(d => /Tôi cam đoan/i.test(d))) break
    }
    return trang
  } finally {
    doc.destroy()
  }
}
