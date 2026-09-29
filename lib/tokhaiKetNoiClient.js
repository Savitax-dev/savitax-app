'use client'
// Điều khiển một lượt KIỂM TRA KẾT NỐI ở phía trình duyệt — Phân hệ Tờ khai.
//
// Máy chủ dựng sẵn từng yêu cầu HTTP, tiện ích Chrome gọi hộ rồi mang phản hồi về. Nhờ vậy chức
// năng này chạy được trên app thật; bản cũ để máy chủ tự gọi nên chỉ chạy ở máy tại Việt Nam.
//
// Vòng lặp ở đây cùng hình dạng với lib/tokhaiSyncClient.js và lib/tokhaiTaiFileClient.js. Cố ý
// KHÔNG gộp ba cái làm một ngay lúc này: hai cái kia đã chạy thật nhiều lượt, đụng vào ngay trước
// khi đẩy lên là đổi thứ đang chắc chắn lấy thứ gọn hơn.
import { goiCong, moPhien, dongPhien } from './portalBridge.js'

const API = '/api/admin/tokhai/connect-ext'

const goiMayChu = body => fetch(API, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json())

export async function kiemTraKetNoi({ clientId, onCaptcha, onTienDo }) {
  // Phiên ảo riêng: cổng khóa mỗi tài khoản vào MỘT phiên, dính cookie của công ty khác là bị đá ra.
  const phien = 'ketnoi-' + clientId + '-' + Date.now().toString(36)
  await moPhien(phien)

  const xong = async kq => { await dongPhien(phien); return kq }

  const kd = await goiMayChu({ clientId })
  if (kd.error) return xong({ ket_qua: 'loi', moTa: kd.error })

  const maPhien = kd.maPhien
  let buoc = kd

  for (let vong = 0; vong < 40; vong++) {
    if (buoc.error) return xong({ ket_qua: 'loi', moTa: buoc.error })
    if (buoc.viec === 'xong') return xong({ ket_qua: buoc.ket_qua, moTa: buoc.moTa })

    if (buoc.viec === 'go_captcha') {
      const ma = await onCaptcha({ anhCaptcha: buoc.anhCaptcha, nhan: buoc.nhan })
      if (!ma) {
        // Báo máy chủ đóng phiên ngay, đừng để nó treo tới lúc hết giờ.
        await goiMayChu({ maPhien, huy: true })
        return xong({ ket_qua: 'bo_qua', moTa: 'Đã bỏ giữa chừng' })
      }
      buoc = await goiMayChu({ maPhien, captcha: ma })
      continue
    }

    // viec === 'goi'
    if (buoc.moTa && onTienDo) onTienDo(buoc.moTa)
    const phanHoi = await goiCong(buoc.yeuCau, { phien })
    buoc = await goiMayChu({ maPhien, phanHoi })
  }

  return xong({ ket_qua: 'loi', moTa: 'Chạy quá nhiều vòng, đã dừng để an toàn' })
}
