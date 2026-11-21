// Cầu nối giữa app.savitax.vn và cổng thuế — Phân hệ Tờ khai.
//
// VÌ SAO CẦN: cổng dichvucong.gdt.gov.vn chặn máy chủ nước ngoài (đo thật 21/09/2026 — Vercel ở
// Singapore bị nuốt gói tin). Máy nhân viên ở Việt Nam thì vào bình thường, nên tiện ích này gọi
// hộ máy chủ, rồi trả nguyên văn phản hồi về.
//
// TIỆN ÍCH KHÔNG BIẾT GÌ VỀ NGHIỆP VỤ THUẾ. Nó chỉ chuyển tiếp đúng một yêu cầu HTTP mà máy chủ
// đã dựng sẵn. Mọi việc đọc bảng, khớp danh mục, tính đúng hạn đều nằm trong web app — nhờ vậy
// sửa nghiệp vụ chỉ cần deploy app, không phải đi cài lại tiện ích trên từng máy.
//
// BẢN 1.1: thêm PHIÊN ẢO. Yêu cầu nào kèm `phien` thì tiện ích nạp đúng bộ cookie của phiên đó
// trước khi gọi, gọi xong cất lại. Nhờ vậy nhiều công ty sống song song trên cùng một trình duyệt,
// và nhân viên gõ được mã cho công ty kế tiếp NGAY TRONG LÚC công ty này đang tải file, thay vì
// ngồi chờ từng công ty một. Xem chrome-extension/phien.js.
//
// Cookie phiên cổng chỉ nằm trong bộ nhớ (chrome.storage.session), không ghi ra đĩa.

import {
  docCookieCong, xoaCookieCong, datCookieCong, khoPhien, taoHangDoi,
} from './phien.js'

// Chỉ cho gọi đúng 2 tên miền của cơ quan thuế. Thiếu chặn này thì bất kỳ trang nào trên
// app.savitax.vn (kể cả trang bị chèn mã độc) cũng biến tiện ích thành máy chủ trung chuyển
// gọi đi khắp nơi bằng máy của nhân viên.
const MIEN_CHO_PHEP = [
  'https://dichvucong.gdt.gov.vn/',
  'https://thuedientu.gdt.gov.vn/',
]

const duocPhep = url => MIEN_CHO_PHEP.some(m => typeof url === 'string' && url.startsWith(m))

const kho = khoPhien(chrome.storage.session)
// MỘT hàng đợi cho cả tiện ích: mỗi lúc đúng một lượt gọi cổng, và giữ khoảng cách giữa các lượt.
const xepHang = taoHangDoi()

async function goiMotLuot(req, phien) {
  // Phiên ảo: dọn cookie đang có rồi nạp cookie của đúng phiên này.
  if (phien) {
    await xoaCookieCong(chrome.cookies)
    await datCookieCong(chrome.cookies, await kho.doc(phien))
  }

  const kiemSoat = new AbortController()
  const henGio = setTimeout(() => kiemSoat.abort(), Math.min(req.hanGio || 25000, 60000))

  try {
    const res = await fetch(req.url, {
      method: req.method || 'GET',
      headers: req.headers || {},
      body: req.body ?? undefined,
      credentials: 'include',      // cookie phiên cổng do trình duyệt giữ
      redirect: 'manual',
      signal: kiemSoat.signal,
    })

    const kieu = res.headers.get('content-type') || ''
    // Ảnh captcha và file tải về phải giữ nguyên dạng nhị phân → mã hóa base64 để đi qua tin nhắn.
    const laNhiPhan = /image|pdf|zip|octet-stream/i.test(kieu)

    let noiDung
    if (laNhiPhan) {
      const buf = new Uint8Array(await res.arrayBuffer())
      let chuoi = ''
      for (let i = 0; i < buf.length; i += 8192) {
        chuoi += String.fromCharCode.apply(null, buf.subarray(i, i + 8192))
      }
      noiDung = btoa(chuoi)
    } else {
      noiDung = await res.text()
    }

    return { ok: true, status: res.status, kieu, laNhiPhan, noiDung }
  } catch (e) {
    return { ok: false, loi: e.name === 'AbortError' ? 'Cổng thuế không phản hồi kịp' : String(e.message || e) }
  } finally {
    clearTimeout(henGio)
    // Cất cookie SAU MỌI TRƯỜNG HỢP, kể cả khi gọi lỗi: cổng có thể đã đổi mã phiên trước khi hỏng,
    // mất bước này là phiên đó coi như chết.
    if (phien) {
      try { await kho.ghi(phien, await docCookieCong(chrome.cookies)) } catch { /* bỏ qua */ }
    }
  }
}

function goiCong(tin) {
  const req = tin?.yeuCau
  if (!duocPhep(req?.url)) {
    return Promise.resolve({ ok: false, loi: 'Địa chỉ không nằm trong danh sách cho phép: ' + (req?.url || '(trống)') })
  }
  return xepHang(() => goiMotLuot(req, tin.phien || null), tin.nhip)
}

// Xoá sạch cookie cổng đang có trên trình duyệt. Giữ lại cho các màn hình chạy một phiên như cũ.
async function donCookie() {
  const daXoa = await xepHang(() => xoaCookieCong(chrome.cookies))
  return { ok: true, daXoa }
}

// Mở một phiên ảo rỗng (bắt đầu lượt mới cho một công ty).
async function moPhien(phien) {
  if (!phien) return { ok: false, loi: 'Thiếu mã phiên' }
  await kho.ghi(phien, [])
  return { ok: true }
}

// Đóng phiên ảo: bỏ cookie đã cất, và nếu cookie của nó đang nằm trên trình duyệt thì dọn luôn.
async function dongPhien(phien) {
  if (!phien) return { ok: false, loi: 'Thiếu mã phiên' }
  await kho.xoa(phien)
  await xepHang(() => xoaCookieCong(chrome.cookies))
  return { ok: true }
}

chrome.runtime.onMessageExternal.addListener((tin, nguoiGui, traLoi) => {
  // Chỉ nhận tin từ đúng trang của Savitax (đã khai trong externally_connectable, kiểm lại cho chắc).
  const goc = nguoiGui?.origin || ''
  if (!/^https:\/\/app\.savitax\.vn$/.test(goc) && !/^http:\/\/localhost(:\d+)?$/.test(goc)) {
    traLoi({ ok: false, loi: 'Nguồn gọi không được phép: ' + goc })
    return false
  }

  if (tin?.viec === 'ping') {
    traLoi({ ok: true, phienBan: chrome.runtime.getManifest().version, coPhienAo: true })
    return false
  }
  if (tin?.viec === 'xoaCookie') { donCookie().then(traLoi); return true }
  if (tin?.viec === 'moPhien') { moPhien(tin.phien).then(traLoi); return true }
  if (tin?.viec === 'dongPhien') { dongPhien(tin.phien).then(traLoi); return true }
  if (tin?.viec === 'goiCong') { goiCong(tin).then(traLoi); return true }

  traLoi({ ok: false, loi: 'Không hiểu yêu cầu' })
  return false
})
