// Tra MST khi thêm công ty: 1) trên máy (danh sách công ty) → 2) tra mạng qua VietQR (dữ liệu tổng hợp từ trang Cục Thuế,
// cho phép gọi từ file HTML, giới hạn ~2 lượt / vài giây). Đây là chức năng DUY NHẤT của bản rời cần mạng.
// Chỉ gửi đi mã số thuế (thông tin công khai).
import { timTheoMst, chuanMst } from '../kho'

// → { loai: 'trung'|'ok'|'ngung'|'khong_co'|'loi', cty?, ten?, dc?, trangThai?, capNhat?, chu }
export async function traMst(mstVao, idDangSua = null) {
  const mst = chuanMst(mstVao)
  if (!/^\d{10}(-?\d{3})?$/.test(mst)) return { loai: 'loi', chu: 'MST phải 10 số, hoặc 13 số (10 số + 3 số chi nhánh).' }
  const trung = timTheoMst(mst, idDangSua)
  if (trung) return { loai: 'trung', cty: trung, chu: `MST này đã có trong danh sách: ${trung.maKH} · ${trung.ten}.` }
  const mstTra = mst.length > 10 && !mst.includes('-') ? mst.slice(0, 10) + '-' + mst.slice(10) : mst
  try {
    const hen = new AbortController()
    const t = setTimeout(() => hen.abort(), 8000)
    const r = await fetch('https://api.vietqr.io/v2/business/' + encodeURIComponent(mstTra), { signal: hen.signal })
    clearTimeout(t)
    if (r.status === 429) return { loai: 'loi', chu: 'Tra quá nhanh — đợi vài giây rồi bấm lại.' }
    const j = await r.json()
    if (j.code === '00' && j.data) {
      const conHd = /đang hoạt động/i.test(j.data.status || '')
      const capNhat = j.metadata?.updatedAt ? new Date(j.metadata.updatedAt).toLocaleDateString('vi-VN') : ''
      return {
        loai: conHd ? 'ok' : 'ngung', ten: String(j.data.name || '').toUpperCase(), dc: j.data.address || '', trangThai: j.data.status || '',
        chu: `${conHd ? '✓' : '⚠'} ${j.data.status || 'Không rõ trạng thái'} — theo dữ liệu Cục Thuế${capNhat ? ' (cập nhật ' + capNhat + ')' : ''}. Kiểm lại tên trước khi lưu.`,
      }
    }
    if (j.code === '51') return { loai: 'khong_co', chu: 'MST không tồn tại trên dữ liệu Cục Thuế — kiểm lại số.' }
    return { loai: 'loi', chu: 'Không tra được (' + (j.desc || 'lỗi lạ') + ') — gõ tay tên công ty.' }
  } catch {
    return { loai: 'loi', chu: 'Không tra được trên mạng (máy không có mạng hoặc dịch vụ tra bận) — gõ tay tên công ty.' }
  }
}
