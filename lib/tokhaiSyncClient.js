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
import { goiCong, moPhien, dongPhien } from './portalBridge'

const API = '/api/admin/tokhai/sync-ext'

const goiMayChu = body => fetch(API, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json())

export async function chayDongBo({ clientId, tuNgay, denNgay, onCaptcha, onTienDo }) {
  // Mỗi công ty MỘT phiên ảo riêng trong tiện ích (bản 1.1 trở lên): tiện ích tráo cookie trước
  // mỗi lượt gọi, nhờ vậy nhiều công ty sống song song mà không đá nhau ra khỏi cổng.
  //
  // Trước 01/10/2026 chỗ này gọi `donPhienCu()` — xoá sạch cookie — nên BẮT BUỘC chạy tuần tự:
  // nhân viên gõ xong mã công ty này phải ngồi chờ nó chạy hết mới tới công ty sau. Màn hình Tải
  // file đã bỏ cách đó từ 29/09.
  //
  // ⚠ Song song KHÔNG làm nhanh hơn: tiện ích vẫn giữ một hàng đợi chung, sàn 2,2 giây mỗi lượt
  // gọi cổng. Cái lợi là NGƯỜI gõ mã liên tục, không phải ngồi canh.
  const phien = 'dongbo-' + clientId + '-' + Date.now().toString(36)
  await moPhien(phien)

  const ketThuc = async kq => { await dongPhien(phien); return kq }

  const kd = await goiMayChu({ clientId, tuNgay, denNgay })
  if (kd.error) return await ketThuc({ ket_qua: 'loi', moTa: kd.error })

  let buoc = kd
  const maPhien = kd.maPhien

  for (let vong = 0; vong < 500; vong++) {
    if (buoc.error) return await ketThuc({ ket_qua: 'loi', moTa: buoc.error })

    if (buoc.viec === 'xong') return await ketThuc({ ket_qua: 'xong', ...buoc })
    if (buoc.viec === 'loi') return await ketThuc({ ket_qua: 'loi', moTa: buoc.moTa })

    if (buoc.viec === 'go_captcha') {
      const ma = await onCaptcha({ anhCaptcha: buoc.anhCaptcha, nhan: buoc.nhan })
      if (!ma) {
        // Báo máy chủ đóng lượt ngay, nếu không công ty này bị khoá "đang chạy" cho tới khi
        // hết giờ, lần sau bấm lại là báo lỗi.
        await goiMayChu({ maPhien, huy: true })
        return await ketThuc({ ket_qua: 'bo_qua', moTa: 'Người dùng bỏ qua công ty này' })
      }
      buoc = await goiMayChu({ maPhien, captcha: ma })
      continue
    }

    // viec === 'goi'
    if (buoc.tienDo && onTienDo) onTienDo(buoc.tienDo)

    // Nhịp nghỉ giao cho HÀNG ĐỢI của tiện ích chứ không `setTimeout` ở đây: chờ tại chỗ thì mỗi
    // công ty tự đếm giờ riêng, mở 3 công ty là cổng nhận 3 lượt sát nhau.
    const phanHoi = await goiCong(buoc.yeuCau, { phien, nhip: buoc.nghi || 0 })
    buoc = await goiMayChu({ maPhien, phanHoi })
  }

  return await ketThuc({ ket_qua: 'loi', moTa: 'Chạy quá nhiều vòng, đã dừng để an toàn' })
}
