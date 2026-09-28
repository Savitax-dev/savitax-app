// Phòng của một công ty — Phân hệ Tờ khai.
//
// ⚠ BẪY: cột `clients.room_id` gần như LUÔN TRỐNG (đo 28/09/2026: 0/294 công ty có giá trị).
// Phòng của công ty thực chất suy từ **phòng của nhân viên phụ trách** (`clients.assigned_to`
// → `staff.room_id`), đúng cách `/api/admin/room` vẫn làm: lấy nhân viên theo phòng rồi lấy
// công ty theo nhân viên.
//
// Dùng `clients.room_id` trực tiếp thì hậu quả kép: báo cáo dồn hết vào "(chưa xếp phòng)", và
// TRƯỞNG PHÒNG KHÔNG THẤY công ty nào của phòng mình.

// Trả về Map: id công ty → id phòng (suy từ nhân viên phụ trách).
export async function mapPhongCuaCongTy(supabase, clients) {
  const idNV = [...new Set(clients.map(c => c.assigned_to).filter(Boolean))]
  if (!idNV.length) return new Map()

  const phongCuaNV = new Map()
  for (let i = 0; i < idNV.length; i += 300) {
    const { data } = await supabase.from('staff').select('id, room_id').in('id', idNV.slice(i, i + 300))
    for (const s of data || []) phongCuaNV.set(s.id, s.room_id)
  }

  return new Map(clients.map(c => [c.id, c.room_id || phongCuaNV.get(c.assigned_to) || null]))
}

// Phòng của MỘT công ty (dùng khi chỉ cần kiểm một cái, khỏi tải cả danh sách).
export async function phongCuaMotCongTy(supabase, client) {
  if (client?.room_id) return client.room_id
  if (!client?.assigned_to) return null
  const { data } = await supabase.from('staff').select('room_id').eq('id', client.assigned_to).maybeSingle()
  return data?.room_id || null
}
