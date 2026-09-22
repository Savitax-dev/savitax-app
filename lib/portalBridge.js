'use client'
// Cầu nối phía trình duyệt: web app ↔ tiện ích Chrome "Savitax — Cầu nối cổng thuế".
//
// Máy chủ dựng sẵn yêu cầu HTTP (URL, tham số, cả phần thân), trang web chỉ chuyển cho tiện ích
// gọi hộ rồi mang phản hồi nguyên văn về cho máy chủ đọc. Trang web KHÔNG tự đọc hiểu gì.
//
// Mã tiện ích sinh ra khi cài; anh lấy ở chrome://extensions rồi đặt vào biến môi trường
// NEXT_PUBLIC_TOKHAI_EXT_ID. Chưa đặt thì hàm dò qua danh sách mã đã biết.

const MA_TIEN_ICH = process.env.NEXT_PUBLIC_TOKHAI_EXT_ID || ''

function coChrome() {
  return typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage
}

function guiTin(maTienIch, tin) {
  return new Promise(giaiQuyet => {
    try {
      chrome.runtime.sendMessage(maTienIch, tin, kq => {
        // Không cài tiện ích thì Chrome đặt lastError và gọi lại với kq = undefined.
        if (chrome.runtime.lastError || !kq) {
          giaiQuyet({ ok: false, loi: chrome.runtime.lastError?.message || 'Tiện ích không phản hồi' })
          return
        }
        giaiQuyet(kq)
      })
    } catch (e) {
      giaiQuyet({ ok: false, loi: String(e.message || e) })
    }
  })
}

// Có tiện ích không, bản mấy.
export async function kiemTraTienIch() {
  if (!coChrome()) {
    return { co: false, loi: 'Trình duyệt không phải Chrome/Edge, hoặc chưa bật tiện ích' }
  }
  if (!MA_TIEN_ICH) {
    return { co: false, loi: 'Chưa cấu hình NEXT_PUBLIC_TOKHAI_EXT_ID' }
  }
  const kq = await guiTin(MA_TIEN_ICH, { viec: 'ping' })
  return kq.ok ? { co: true, phienBan: kq.phienBan } : { co: false, loi: kq.loi }
}

// Xóa cookie cổng thuế trước mỗi lượt: cổng khóa mỗi tài khoản vào một phiên, dính phiên cũ của
// công ty khác là bị đá ra giữa chừng.
export async function donPhienCu() {
  if (!MA_TIEN_ICH) return { ok: false }
  return guiTin(MA_TIEN_ICH, { viec: 'xoaCookie' })
}

// Nhờ tiện ích gọi một yêu cầu tới cổng thuế.
export async function goiCong(yeuCau) {
  if (!MA_TIEN_ICH) return { ok: false, loi: 'Chưa cấu hình mã tiện ích' }
  return guiTin(MA_TIEN_ICH, { viec: 'goiCong', yeuCau })
}
