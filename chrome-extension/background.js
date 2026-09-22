// Cầu nối giữa app.savitax.vn và cổng thuế — Phân hệ Tờ khai, nhịp B.
//
// VÌ SAO CẦN: cổng dichvucong.gdt.gov.vn chặn máy chủ nước ngoài (đo thật 21/09/2026 — Vercel ở
// Singapore bị nuốt gói tin). Máy nhân viên ở Việt Nam thì vào bình thường, nên tiện ích này gọi
// hộ máy chủ, rồi trả nguyên văn phản hồi về.
//
// TIỆN ÍCH KHÔNG BIẾT GÌ VỀ NGHIỆP VỤ THUẾ. Nó chỉ chuyển tiếp đúng một yêu cầu HTTP mà máy chủ
// đã dựng sẵn. Mọi việc đọc bảng, khớp danh mục, tính đúng hạn đều nằm trong web app — nhờ vậy
// sửa nghiệp vụ chỉ cần deploy app, không phải đi cài lại tiện ích trên từng máy.
//
// Cookie phiên cổng thuế do chính trình duyệt giữ (fetch có credentials: 'include'), máy chủ
// không lưu cookie nào.

// Chỉ cho gọi đúng 2 tên miền của cơ quan thuế. Thiếu chặn này thì bất kỳ trang nào trên
// app.savitax.vn (kể cả trang bị chèn mã độc) cũng biến tiện ích thành máy chủ trung chuyển
// gọi đi khắp nơi bằng máy của nhân viên.
const MIEN_CHO_PHEP = [
  'https://dichvucong.gdt.gov.vn/',
  'https://thuedientu.gdt.gov.vn/',
]

const duocPhep = url => MIEN_CHO_PHEP.some(m => typeof url === 'string' && url.startsWith(m))

async function goiCong(req) {
  if (!duocPhep(req?.url)) {
    return { ok: false, loi: 'Địa chỉ không nằm trong danh sách cho phép: ' + (req?.url || '(trống)') }
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
  }
}

// Xóa sạch cookie của cổng thuế. Gọi khi bắt đầu một lượt mới để không dính phiên cũ của công ty
// khác — cổng khóa mỗi tài khoản vào một phiên duy nhất.
async function xoaCookieCong() {
  let daXoa = 0
  for (const mien of ['dichvucong.gdt.gov.vn', 'thuedientu.gdt.gov.vn']) {
    const ds = await chrome.cookies.getAll({ domain: mien })
    for (const c of ds) {
      const url = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path
      try { await chrome.cookies.remove({ url, name: c.name }); daXoa++ } catch { /* bỏ qua */ }
    }
  }
  return { ok: true, daXoa }
}

chrome.runtime.onMessageExternal.addListener((tin, nguoiGui, traLoi) => {
  // Chỉ nhận tin từ đúng trang của Savitax (đã khai trong externally_connectable, kiểm lại cho chắc).
  const goc = nguoiGui?.origin || ''
  if (!/^https:\/\/app\.savitax\.vn$/.test(goc) && !/^http:\/\/localhost(:\d+)?$/.test(goc)) {
    traLoi({ ok: false, loi: 'Nguồn gọi không được phép: ' + goc })
    return false
  }

  if (tin?.viec === 'ping') {
    traLoi({ ok: true, phienBan: chrome.runtime.getManifest().version })
    return false
  }
  if (tin?.viec === 'xoaCookie') {
    xoaCookieCong().then(traLoi)
    return true
  }
  if (tin?.viec === 'goiCong') {
    goiCong(tin.yeuCau).then(traLoi)
    return true      // giữ kênh mở để trả lời bất đồng bộ
  }

  traLoi({ ok: false, loi: 'Không hiểu yêu cầu' })
  return false
})
