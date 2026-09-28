'use client'
// Nạp phông chữ để dựng PDF — Phân hệ Tờ khai, GĐ 6.
//
// Phông Tinos nằm ở public/fonts (giấy phép SIL OFL, phát hành kèm app được, bề rộng chữ giống
// Times New Roman nên bản in khớp mẫu giấy chính thức). Ba kiểu: thường, đậm, nghiêng — tổng
// khoảng 1,6 MB, tải MỘT LẦN cho cả lượt tải file rồi trình duyệt nhớ luôn.
//
// KHÔNG nhúng phông vào mã nguồn dạng base64: làm vậy là mỗi lần mở trang đều phải tải 2 MB mã
// JavaScript, kể cả khi nhân viên không tải file nào.

const DUONG_DAN = {
  thuong: '/fonts/Tinos-Regular.ttf',
  dam: '/fonts/Tinos-Bold.ttf',
  nghieng: '/fonts/Tinos-Italic.ttf',
}

let dangCho = null

// Gọi bao nhiêu lần cũng chỉ tải một lượt: lần đầu giữ lại Promise, các lần sau dùng chung.
export function layPhong() {
  if (!dangCho) {
    dangCho = Promise.all(
      Object.entries(DUONG_DAN).map(async ([ten, dd]) => {
        const r = await fetch(dd)
        if (!r.ok) throw new Error(`Không tải được phông ${dd} (HTTP ${r.status})`)
        return [ten, new Uint8Array(await r.arrayBuffer())]
      }),
    ).then(Object.fromEntries)
    // Tải hỏng thì đừng nhớ cái hỏng — lần sau bấm lại phải thử lại từ đầu.
    dangCho.catch(() => { dangCho = null })
  }
  return dangCho
}
