'use client'
// Điều khiển một lượt đồng bộ ở phía trình duyệt — Phân hệ Tờ khai.
//
// Máy chủ dựng sẵn từng yêu cầu HTTP, hàm này nhờ tiện ích Chrome gọi hộ rồi mang phản hồi về.
// Tách ra đây để dùng chung cho cả đồng bộ MỘT công ty lẫn đồng bộ THEO LÔ — hai màn hình khác
// nhau nhưng luồng bên dưới phải giống hệt, nếu không sẽ lệch nhau lúc sửa.
//
// Bên gọi cung cấp:
//   onCaptcha({ anhCaptcha, nhan })  → trả về Promise<string> mã người gõ, hoặc null nếu bỏ qua
//   onTienDo(chu)                    → báo tiến độ để hiện lên màn hình
import { goiCong, donPhienCu } from './portalBridge'

const API = '/api/admin/tokhai/sync-ext'

const goiMayChu = body => fetch(API, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json())

export async function chayDongBo({ clientId, tuNgay, denNgay, onCaptcha, onTienDo }) {
  // Xoá cookie cổng trước mỗi công ty: cổng khoá mỗi tài khoản vào MỘT phiên, dính phiên của
  // công ty trước là bị đá ra giữa chừng. Đây là lý do không thể chạy 2 công ty song song.
  await donPhienCu()

  const kd = await goiMayChu({ clientId, tuNgay, denNgay })
  if (kd.error) return { ket_qua: 'loi', moTa: kd.error }

  let buoc = kd
  const maPhien = kd.maPhien

  for (let vong = 0; vong < 500; vong++) {
    if (buoc.error) return { ket_qua: 'loi', moTa: buoc.error }

    if (buoc.viec === 'xong') return { ket_qua: 'xong', ...buoc }
    if (buoc.viec === 'loi') return { ket_qua: 'loi', moTa: buoc.moTa }

    if (buoc.viec === 'go_captcha') {
      const ma = await onCaptcha({ anhCaptcha: buoc.anhCaptcha, nhan: buoc.nhan })
      if (!ma) {
        // Báo máy chủ đóng lượt ngay, nếu không công ty này bị khoá "đang chạy" cho tới khi
        // hết giờ, lần sau bấm lại là báo lỗi.
        await goiMayChu({ maPhien, huy: true })
        return { ket_qua: 'bo_qua', moTa: 'Người dùng bỏ qua công ty này' }
      }
      buoc = await goiMayChu({ maPhien, captcha: ma })
      continue
    }

    // viec === 'goi'
    if (buoc.tienDo && onTienDo) onTienDo(buoc.tienDo)
    if (buoc.nghi) await new Promise(r => setTimeout(r, buoc.nghi))

    const phanHoi = await goiCong(buoc.yeuCau)
    buoc = await goiMayChu({ maPhien, phanHoi })
  }

  return { ket_qua: 'loi', moTa: 'Chạy quá nhiều vòng, đã dừng để an toàn' }
}
