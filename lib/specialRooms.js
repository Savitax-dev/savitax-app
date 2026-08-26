// Phòng "đặc thù" — phòng nghiệp vụ mà MỌI trưởng phòng đều được xem/làm việc như phòng của
// chính mình, không cần gán trưởng phòng riêng cho phòng đó (yêu cầu 2026-08-25 cho phòng
// "CTV Savitax": các nhân viên đã có quyền trưởng phòng sẽ thấy và làm việc với phòng này như
// phòng nghiệp vụ bình thường).
//
// Cố tình hard-code ID thay vì thêm cột mới vào bảng `rooms`: hiện chỉ có ĐÚNG 1 phòng thuộc
// diện này, thêm cột + migration SQL cho 1 trường hợp đơn lẻ là quá nặng. Nếu sau này có thêm
// phòng đặc thù khác, cân nhắc chuyển sang cột `rooms.is_shared` (hoặc tương tự) và bỏ file này.
//
// LƯU Ý: khác hoàn toàn với `rooms.type='remote'` — `type` chỉ ảnh hưởng nhãn hiển thị "Remote"
// và việc loại khỏi xếp hạng "Phòng/Nhân viên xuất sắc nhất" ở Trang chủ, KHÔNG liên quan quyền.
export const SHARED_ROOM_IDS = [
  '2dd11113-985e-472b-92da-39e7082780a7', // Phòng CTV Savitax
]

export function isSharedRoom(roomId) {
  return !!roomId && SHARED_ROOM_IDS.includes(roomId)
}
