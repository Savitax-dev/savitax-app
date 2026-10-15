// Danh sách công ty CHỈ dùng Dịch vụ khác (clients.dvk_only, sql/29).
//
// VÌ SAO ĐỌC RIÊNG CHỨ KHÔNG THÊM VÀO SELECT CHUNG: PostgREST hỏng NGUYÊN cả truy vấn khi gặp một
// cột không tồn tại, không phải chỉ bỏ trống trường đó. Nhét `dvk_only` vào danh sách cột của
// trang Phòng là mọi công ty biến mất sạch cho tới khi chạy SQL — đúng chuyện đã xảy ra trên máy
// anh ngày 14/10/2026: "0 công ty · 9 nhân viên" ở toàn bộ các phòng.
//
// Đọc riêng và NUỐT lỗi thì thiếu cột chỉ có nghĩa là "chưa công ty nào thuộc nhóm này" — app chạy
// y như trước. Nhờ vậy đẩy mã trước hay chạy SQL trước đều được, và bản clone chưa chạy sql/29
// cũng không hỏng. Cùng lối với cách `service_end` và `checklist_reviews` đang được đọc.
//
// Chỉ lấy đúng các dòng dvk_only = true nên dù có 328 công ty thì cũng chỉ về vài dòng.
export async function docDvkOnly(supabase, clientIds = null) {
  try {
    let q = supabase.from('clients').select('id').eq('dvk_only', true)
    if (clientIds && clientIds.length) q = q.in('id', clientIds)
    const { data, error } = await q
    if (error) return new Set()
    return new Set((data || []).map(c => c.id))
  } catch (_) {
    return new Set()
  }
}

// Một công ty có phải nhóm "chỉ dùng Dịch vụ khác" không. Dùng khi chỉ xét đúng một công ty.
export async function laDvkOnly(supabase, clientId) {
  if (!clientId) return false
  return (await docDvkOnly(supabase, [clientId])).has(clientId)
}
