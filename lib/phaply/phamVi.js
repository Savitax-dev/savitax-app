// Phân hệ Pháp lý — luật phạm vi THUẦN (không import máy chủ, kiểm được bằng node): ai thấy / sửa được hồ sơ nào.
// auth = { caller: { staffId }, q: { xem, sua, ca_phong, mau } } — dựng ở lib/phaply/quyen.js requirePhapLy().

// Thấy hồ sơ: trưởng phòng thấy hết; nhân viên thấy hồ sơ mình + hồ sơ chưa ai nhận
export function xemDuoc(auth, hoSo) {
  if (!hoSo || hoSo.is_deleted) return false
  if (auth.q.ca_phong) return true
  return !hoSo.assigned_to || hoSo.assigned_to === auth.caller.staffId
}

// Sửa hồ sơ: trưởng phòng; hoặc nhân viên có manage_phaply với hồ sơ mình / chưa ai nhận
export function suaDuoc(auth, hoSo) {
  if (!xemDuoc(auth, hoSo)) return false
  if (auth.q.ca_phong && (auth.q.sua || auth.q.mau)) return true
  return !!auth.q.sua && (!hoSo.assigned_to || hoSo.assigned_to === auth.caller.staffId)
}
