// Phân hệ Tiền lương — BƯỚC 3: bản chụp bảng lương đã CHỐT (sql/33).
// Tháng đã chốt thì màn hình và file Excel đọc bản chụp, không tính lại từ dữ liệu sống.
// Chưa chạy sql/33 (bảng chưa có) thì coi như chưa chốt — trả null, không báo lỗi.
export async function docBanChot(supabase, nam, thang) {
  const { data, error } = await supabase.from('luong_bang_chot')
    .select('*, staff:chot_boi(full_name)')
    .eq('nam', nam).eq('thang', thang).maybeSingle()
  if (error || !data) return null
  return data
}
