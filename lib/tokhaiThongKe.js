// Đếm số liệu tờ khai cho báo cáo — Phân hệ Tờ khai.
//
// TÁCH RA KHỎI ROUTE để kiểm được bằng script. Đây là phần sai âm thầm nhất của cả phân hệ: bảng
// vẫn hiện ra đầy đủ, cột vẫn thẳng, chỉ có CON SỐ là sai — mà trưởng phòng lại dựa vào đúng mấy
// con số đó để đôn đốc nhân viên. Trong một lần soát (28/09/2026) đã tìm ra hai lỗi cùng loại:
//   1. Câu lấy nghĩa vụ quên cột `id`, nên phép ghép hồ sơ ↔ nghĩa vụ LUÔN TRƯỢT: báo cáo không
//      bao giờ lấy được trạng thái thật từ cổng, chỉ dùng trạng thái app tự suy.
//   2. Chỉ đếm theo nghĩa vụ. Kỳ nào chưa sinh nghĩa vụ (nghĩa vụ chỉ sinh cho kỳ có hạn sau
//      21/09/2026) thì báo cáo trắng trơn, dù công ty đã nộp thật và hồ sơ đã lấy về.
//
// Nguyên tắc: BÁO CÁO VẼ THEO CẢ HAI NGUỒN — lịch hạn nộp (app nghĩ phải nộp gì) và hồ sơ thật lấy
// từ cổng (công ty đã nộp gì). Giống hệt màn "Lịch hạn nộp".

// Trạng thái của một ô: có hồ sơ thật thì LẤY THEO CỔNG, không lấy theo trạng thái app tự suy.
export function trangThaiCuaO(nghiaVu, hoSo, homNayISO) {
  if (hoSo) return hoSo.state
  if (nghiaVu?.state === 'not_filed' && nghiaVu.due_date && nghiaVu.due_date < homNayISO) return 'overdue'
  return nghiaVu?.state || 'not_filed'
}

// Dựng danh sách ô để đếm, mỗi ô là một việc phải nộp.
//   - Mỗi nghĩa vụ là một ô, đắp hồ sơ thật lên nếu có.
//   - Hồ sơ thật KHÔNG khớp nghĩa vụ nào thì thêm một ô mới, đánh dấu ngoaiLich.
//     Bỏ qua nếu công ty đó đã có ô cùng LOẠI tờ khai — tránh đếm đôi.
export function dungCacO({ nghiaVu = [], hoSo = [], homNayISO }) {
  const hoSoTheoNghiaVu = new Map()
  for (const h of hoSo) if (h.obligation_id) hoSoTheoNghiaVu.set(h.obligation_id, h)

  const ra = nghiaVu.map(o => {
    const h = hoSoTheoNghiaVu.get(o.id) || null
    return {
      clientId: o.client_id,
      loaiId: o.filing_type_id,
      trangThai: trangThaiCuaO(o, h, homNayISO),
      ngoaiLich: false,
      ngayTiepNhan: h?.received_at || null,
      dungHan: h ? h.on_time : null,
    }
  })

  const daCoO = new Set(nghiaVu.map(o => `${o.client_id}|${o.filing_type_id}`))
  for (const h of hoSo) {
    if (h.obligation_id) continue
    if (daCoO.has(`${h.client_id}|${h.filing_type_id}`)) continue
    ra.push({
      clientId: h.client_id,
      loaiId: h.filing_type_id,
      trangThai: h.state,
      ngoaiLich: true,
      ngayTiepNhan: h.received_at || null,
      dungHan: h.on_time,
    })
  }
  return ra
}

// Cộng một ô vào bộ đếm của nhóm (phòng / nhân viên / công ty).
export function congO(dem, o) {
  dem.phaiNop++
  if (o.ngoaiLich) dem.ngoaiLich++
  if (o.trangThai === 'accepted') dem.chapNhan++
  else if (o.trangThai === 'received') dem.choKetQua++
  else if (o.trangThai === 'rejected') dem.khongChapNhan++
  else if (o.trangThai === 'overdue') dem.quaHan++
  else if (o.trangThai === 'no_activity') dem.khongPhatSinh++
  else dem.chuaNop++

  // % đúng hạn chỉ tính trên tờ ĐÃ có ngày tiếp nhận — tờ chưa nộp thì chưa kết luận được.
  if (o.ngayTiepNhan) {
    dem.coNgayTiepNhan++
    if (o.dungHan) dem.dungHan++
  }
  return dem
}
