'use client'
// Gọi tiện ích "Savitax — Cầu nối cổng thuế" (bản 1.4+) cho phần bảng kê hóa đơn. Tiện ích chỉ bấm nút của trang
// hoadondientu.gdt.gov.vn — xem chrome-extension/hddt-trang.js. Mã tiện ích cố định (chrome-extension/CAI-DAT.md).
const MA_TIEN_ICH = process.env.NEXT_PUBLIC_TOKHAI_EXT_ID || 'affcgkipcpdjoiednghajbahjanhlnnn'

export function guiTin(tin) {
  return new Promise(xong => {
    try {
      if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) { xong({ ok: false, loi: 'Không phải Chrome / Edge, hoặc chưa cài tiện ích Savitax' }); return }
      chrome.runtime.sendMessage(MA_TIEN_ICH, tin, kq => {
        if (chrome.runtime.lastError || !kq) { xong({ ok: false, loi: chrome.runtime.lastError?.message || 'Tiện ích không phản hồi' }); return }
        xong(kq)
      })
    } catch (e) { xong({ ok: false, loi: String(e?.message || e) }) }
  })
}

export const kiemTienIch = () => guiTin({ viec: 'ping' })
export const moCong = () => guiTin({ viec: 'hddtMo' })
export const xemCong = () => guiTin({ viec: 'hddtXem' })
export const diToi = duongDan => guiTin({ viec: 'hddtDiToi', duongDan })
export const fileTai = ({ ma, tu }) => guiTin({ viec: 'hddtTai', ma, tu })
// Gọi một hàm của bộ bấm trong trang cổng → trả thẳng kết quả của hàm (hoặc { ok:false, loi } khi tiện ích / tab lỗi)
// veApp: xong thì đưa tab app lên lại (bước nhân viên phải gõ mã xác nhận trên app)
// khongLenTruoc: chỉ hỏi, không đưa tab cổng lên trước (dùng khi đang chờ nhân viên gõ mã trên cổng)
export async function goi(ham, thamSo, { veApp = false, khongLenTruoc = false } = {}) {
  const kq = await guiTin({ viec: 'hddtGoi', ham, thamSo, veApp, khongLenTruoc })
  if (!kq.ok) return { ok: false, loi: kq.loi, chuaMo: kq.chuaMo }
  return kq.ketQua || { ok: false, loi: 'Trang cổng không trả lời (đang tải lại?)' }
}
