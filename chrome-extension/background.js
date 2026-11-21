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
// BẢN 1.2: yêu cầu có `theoChuyenHuong: true` thì đi theo chuyển hướng (bước SSO sang eTax của giấy nộp tiền)
// và trả kèm `urlCuoi`. Trang đích vẫn phải thuộc 2 tên miền thuế. Mọi yêu cầu khác giữ redirect manual như cũ.
// Cookie phiên cổng chỉ nằm trong bộ nhớ (chrome.storage.session), không ghi ra đĩa.
//
// BẢN 1.3 (19/11/2026): thêm tracuunnt.gdt.gov.vn — trang tra cứu thông tin người nộp thuế của Cục Thuế. App gửi yêu cầu mở
// trang / lấy ảnh mã xác nhận / gửi form (MST + mã NHÂN VIÊN TỰ GÕ); tiện ích không đọc mã, không tự tra hàng loạt.

import {
  docCookieCong, xoaCookieCong, datCookieCong, khoPhien, taoHangDoi,
} from './phien.js'

// Chỉ cho gọi đúng các tên miền của cơ quan thuế dưới đây. Thiếu chặn này thì bất kỳ trang nào trên
// app.savitax.vn (kể cả trang bị chèn mã độc) cũng biến tiện ích thành máy chủ trung chuyển
// gọi đi khắp nơi bằng máy của nhân viên.
const MIEN_CHO_PHEP = [
  'https://dichvucong.gdt.gov.vn/',
  'https://thuedientu.gdt.gov.vn/',
  'https://tracuunnt.gdt.gov.vn/',     // 1.3: tra trạng thái MST người bán (Rủi ro thuế → Tra cứu NCC), nhân viên tự gõ mã xác nhận
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
      // Mặc định KHÔNG đi theo chuyển hướng. Bản 1.2: yêu cầu nào ghi rõ theoChuyenHuong thì mới đi theo
      // (bước SSO sang eTax trả 302 liên tiếp, chế độ manual chỉ thấy status 0 và không biết địa chỉ đích).
      redirect: req.theoChuyenHuong ? 'follow' : 'manual',
      signal: kiemSoat.signal,
    })

    // Đi theo chuyển hướng mà dừng ở tên miền khác → không trả nội dung về
    if (req.theoChuyenHuong && res.url && !duocPhep(res.url)) {
      return { ok: false, loi: 'Cổng chuyển hướng ra ngoài tên miền thuế: ' + res.url.split('?')[0] }
    }

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

    return { ok: true, status: res.status, kieu, laNhiPhan, noiDung, urlCuoi: res.url || req.url }
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

// ── 1.4: bảng kê hóa đơn — BẤM HỘ NÚT của trang hoadondientu.gdt.gov.vn (bộ hàm ở hddt-trang.js) ───────────────────────
// Tiện ích KHÔNG gửi yêu cầu nào tới cổng hóa đơn (cổng chặn mọi yêu cầu không do trang gửi, đo 13/10/2026 — không lách).
// Việc của tiện ích ở đây: mở cửa sổ cổng, nạp bộ hàm bấm nút vào trang, chuyển trang (như người gõ địa chỉ), và đặt tên
// file trình duyệt vừa tải từ cổng về thư mục Tải về\Savitax-HDDT\<mã lượt>.xlsx để app tìm đúng file mà đọc.
const CONG_HDDT = 'https://hoadondientu.gdt.gov.vn/*'
const GOC_HDDT = 'https://hoadondientu.gdt.gov.vn'
const HAM_TRANG = ['trangThai', 'moDangNhap', 'layMaMoi', 'guiMa', 'dangXuat', 'chayLuot', 'doTrang', 'dongThongBao', 'vaoTraCuu']
const THU_MUC_TAI = 'Savitax-HDDT'

async function tabHddt() {
  const daNho = (await chrome.storage.session.get('hddtTab')).hddtTab
  if (daNho) { try { const t = await chrome.tabs.get(daNho); if (/^https:\/\/hoadondientu\.gdt\.gov\.vn\//.test(t.url || t.pendingUrl || '')) return t } catch { /* đã đóng */ } }
  const tabs = await chrome.tabs.query({ url: CONG_HDDT })
  if (!tabs.length) return null
  return tabs.find(t => t.active) || tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0]
}

function choTabTai(tabId, gioiHan = 30000) {
  return new Promise(xong => {
    let het = null
    const nghe = (id, info) => { if (id === tabId && info.status === 'complete') ket() }
    const ket = () => { chrome.tabs.onUpdated.removeListener(nghe); clearTimeout(het); setTimeout(xong, 2000) }   // chờ thêm cho trang React vẽ xong
    chrome.tabs.onUpdated.addListener(nghe)
    het = setTimeout(ket, gioiHan)
  })
}

// Dùng lại tab cổng nhân viên đang mở; chưa có thì mở MỘT tab cổng NỀN cạnh tab app. CHẠY NGẦM (anh chốt 21/11/2026): không
// bao giờ đưa tab cổng lên trước — ảnh mã xác nhận chép sang app, nhân viên gõ mã trên app. Lần thử đầu (cổng nằm ở tab nền,
// nhân viên đứng ở tab app) bộ bấm vẫn đọc được chú thích nút + xuất đủ file.
async function moCuaSoCong(nguoiGui) {
  let tab = await tabHddt()
  if (!tab) {
    tab = await chrome.tabs.create({ url: GOC_HDDT + '/', active: false, ...(nguoiGui?.tab ? { windowId: nguoiGui.tab.windowId, index: nguoiGui.tab.index + 1 } : {}) })
    await choTabTai(tab.id)
  }
  await chrome.storage.session.set({ hddtTab: tab.id })
  return tab
}

async function diToi(tab, duongDan) {
  const url = GOC_HDDT + duongDan
  if ((tab.url || '').split('#')[0] === url) return
  const cho = choTabTai(tab.id)
  await chrome.tabs.update(tab.id, { url })
  await cho
}

// File tải về trong lúc một lượt đang chạy → đặt tên theo mã lượt
let choTai = null
const laFileHddt = d => /hoadondientu\.gdt\.gov\.vn/.test([d.url, d.referrer, d.finalUrl].join(' '))
const tenFile = p => String(p || '').split(/[\\/]/).pop()
chrome.downloads.onDeterminingFilename.addListener((d, suggest) => {
  if (choTai && Date.now() < choTai.het && laFileHddt(d)) {
    const duoi = (String(d.filename || '').match(/\.[A-Za-z0-9]+$/) || ['.xlsx'])[0]
    suggest({ filename: `${THU_MUC_TAI}/${choTai.ma}${duoi}`, conflictAction: 'overwrite' })
    choTai = null
    return
  }
  suggest()
})

async function goiTrang(tab, ham, thamSo) {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['hddt-trang.js'] })
  const [kq] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (ten, ts) => window.__svtHddt[ten](ts),
    args: [ham, thamSo ?? {}],
  })
  return kq?.result ?? null
}

async function hddt(tin, nguoiGui) {
  if (tin.viec === 'hddtTai') {
    const ds = await chrome.downloads.search({ startedAfter: new Date(tin.tu || Date.now() - 600000).toISOString(), orderBy: ['-startTime'], limit: 30 })
    return {
      ok: true,
      file: ds.filter(laFileHddt).filter(d => !tin.ma || tenFile(d.filename).startsWith(tin.ma)).map(d => ({
        ten: tenFile(d.filename), duongDan: d.filename, kichThuoc: d.fileSize || d.totalBytes || 0, trangThai: d.state, loi: d.error || '', luc: d.startTime,
      })),
    }
  }
  if (tin.viec === 'hddtMo') {
    const tab = await moCuaSoCong(nguoiGui)
    return { ok: true, tab: { url: tab.url, tieuDe: tab.title } }
  }
  const tab = await tabHddt()
  if (!tab) return { ok: false, chuaMo: true, loi: 'Chưa mở cổng hoadondientu.gdt.gov.vn' }
  if (tin.viec === 'hddtTab') return { ok: true, tab: { url: tab.url, tieuDe: tab.title } }
  if (tin.viec === 'hddtXem') { await chrome.windows.update(tab.windowId, { focused: true }); await chrome.tabs.update(tab.id, { active: true }); return { ok: true } }
  if (tin.viec === 'hddtDiToi') {
    if (!/^\/[\w\-/]*$/.test(tin.duongDan || '')) return { ok: false, loi: 'Đường dẫn không hợp lệ' }
    await diToi(tab, tin.duongDan)
    return { ok: true }
  }
  // Bản thử /thu-hoadon dùng tên cũ
  const ham = tin.viec === 'hddtDo' ? 'doTrang' : tin.viec === 'hddtChay' ? 'chayLuot' : tin.ham
  if (!HAM_TRANG.includes(ham)) return { ok: false, loi: 'Không hiểu yêu cầu' }
  const thamSo = tin.viec === 'hddtChay' ? tin.tuyChon : tin.thamSo
  if (ham === 'chayLuot' && thamSo?.maLuot) choTai = { ma: String(thamSo.maLuot).replace(/[^\w-]/g, ''), het: Date.now() + 120000 }
  try {
    const ketQua = await goiTrang(tab, ham, thamSo)
    return { ok: true, ketQua, tab: { url: tab.url, tieuDe: tab.title } }
  } finally {
    if (ham === 'chayLuot') setTimeout(() => { if (choTai && choTai.ma === thamSo?.maLuot) choTai = null }, 60000)
  }
}

chrome.runtime.onMessageExternal.addListener((tin, nguoiGui, traLoi) => {
  // Chỉ nhận tin từ đúng trang của Savitax (đã khai trong externally_connectable, kiểm lại cho chắc).
  const goc = nguoiGui?.origin || ''
  if (!/^https:\/\/(app|demo)\.savitax\.vn$/.test(goc) && !/^http:\/\/localhost(:\d+)?$/.test(goc)) {
    traLoi({ ok: false, loi: 'Nguồn gọi không được phép: ' + goc })
    return false
  }

  if (tin?.viec === 'ping') {
    traLoi({ ok: true, phienBan: chrome.runtime.getManifest().version, coPhienAo: true, theoChuyenHuong: true, traNnt: true, hddt: 2 })
    return false
  }
  if (tin?.viec === 'xoaCookie') { donCookie().then(traLoi); return true }
  if (tin?.viec === 'moPhien') { moPhien(tin.phien).then(traLoi); return true }
  if (tin?.viec === 'dongPhien') { dongPhien(tin.phien).then(traLoi); return true }
  if (tin?.viec === 'goiCong') { goiCong(tin).then(traLoi); return true }
  if (/^hddt(Tab|Do|Chay|Tai|Mo|Xem|DiToi|Goi)$/.test(tin?.viec || '')) {
    hddt(tin, nguoiGui).then(traLoi, e => traLoi({ ok: false, loi: String(e?.message || e) }))
    return true
  }

  traLoi({ ok: false, loi: 'Không hiểu yêu cầu' })
  return false
})
