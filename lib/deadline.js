// Tính ngày hạn thực tế cho 1 task: clamp về số ngày thực có của tháng (vd ngày 30
// ở tháng 2 -> ngày 28/29), sau đó nếu rơi vào Chủ nhật thì dời sang thứ 2 tuần kế
// (nhân viên không cần làm/nộp việc vào Chủ nhật).
//
// Trả về THỜI ĐIỂM 0 giờ ngày hạn theo GIỜ VIỆT NAM, bất kể máy chạy ở múi giờ nào. Trước 17/10/2026
// hàm dựng ngày theo giờ của máy: trình duyệt nhân viên (giờ VN) ra 0h VN, nhưng máy chủ Vercel (giờ
// quốc tế) ra 0h UTC = 7h sáng VN → việc tick từ 0h tới 7h sáng hôm sau ngày hạn vẫn bị Báo cáo KPI
// tính "đúng hạn" trong khi màn hình Checklist báo "trễ hạn". Đo thật: mỗi tháng 1–2 nhân viên bị
// nâng %-công việc (vd T8 Cao Nguyễn Thanh Thi 84% thành 92%).
// Muốn lấy ngày/tháng/năm của kết quả thì cộng 7 giờ rồi đọc getUTC* (xem ngayVN bên dưới), đừng
// dùng getDate() — trên máy chủ nó ra ngày hôm trước.
const LECH_VN = 7 * 3600 * 1000
export function effectiveDeadlineDate(year, month, deadlineDay) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const date = new Date(Date.UTC(year, month - 1, Math.min(deadlineDay, lastDay)))
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1) // Chủ nhật (0) -> thứ 2
  return new Date(date.getTime() - LECH_VN)
}

// Ngày / tháng / năm theo giờ Việt Nam của một thời điểm.
export function ngayVN(d) {
  const t = new Date(new Date(d).getTime() + LECH_VN)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}
