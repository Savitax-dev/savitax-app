// VI PHẠM KPI công việc (sql/26_vi_pham_kpi.sql) — anh chốt 10/10/2026.
//
// Nhân viên tick việc nhưng không thực hiện; Trưởng phòng phát hiện thì đánh dấu "Vi phạm" cho nhân
// viên đó ở tháng đó -> %-hoàn thành công việc của tháng bị TRỪ 20 ĐIỂM, một lần (95% còn 75%), sàn 0.
// Chỉ trừ %-công việc, KHÔNG đụng %-công nợ.
//
// Mọi nơi tính %-công việc của nhân viên (kpi-overview, room, my-room) đều phải đi qua `truViPham`,
// thiếu một nơi là trang đó ra số khác các trang còn lại.

export const MUC_TRU_VI_PHAM = 20

export const truViPham = (pct, viPham) => viPham ? Math.max(0, (Number(pct) || 0) - MUC_TRU_VI_PHAM) : pct

// Map staffId -> { reason, created_at, created_by } của một tháng. Bảng chưa tạo (chưa chạy sql/26,
// hoặc bản clone) thì trả Map rỗng — không được làm hỏng trang KPI.
export async function docViPham(supabase, year, month, staffIds = null) {
  const out = new Map()
  try {
    let q = supabase.from('kpi_violations').select('staff_id, reason, created_at, created_by').eq('year', year).eq('month', month)
    if (staffIds?.length) q = q.in('staff_id', staffIds)
    const { data, error } = await q
    if (error) return out
    for (const r of data || []) out.set(r.staff_id, { reason: r.reason, created_at: r.created_at, created_by: r.created_by })
  } catch (_) { /* chưa có bảng */ }
  return out
}
