// Phụ cấp / điều chỉnh NHIỀU DÒNG (anh yêu cầu 02/11/2026, sql/47) — hàm THUẦN, dùng chung cho máy chủ
// (api/admin/luong/chot), bảng lương (bangLuong.js) và bộ kiểm scripts/test-luong-dieu-chinh.mjs.
//
// Mỗi dòng: { id, loai: 'phu_cap' | 'dieu_chinh', so_tien, noi_dung, nguoi, luc }.
//   phu_cap   : số dương (khoản cộng thêm có danh mục: xăng xe, điện thoại, ăn trưa…)
//   dieu_chinh: + hoặc − (ngoại lệ giám đốc duyệt: truy thu, bù lương tháng trước…)
// Cột phu_cap / dieu_chinh / ly_do của luong_dieu_chinh vẫn là số TỔNG — mọi chỗ tính thuế / Excel / chốt đọc như cũ.

export const LOAI_DIEU_CHINH = { phu_cap: 'Phụ cấp', dieu_chinh: 'Điều chỉnh' }
const TOI_DA = 1e9, SO_DONG_TOI_DA = 30, NOI_DUNG_TOI_THIEU = 3

const fmt = n => Number(n || 0).toLocaleString('vi-VN')
const taoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

// Chuẩn hoá danh sách dòng người dùng gửi lên. `cu` = chi_tiet đang lưu: dòng nào giữ nguyên (cùng id, cùng loại,
// số tiền, nội dung) thì giữ người nhập / lúc nhập cũ; dòng mới hoặc sửa thì ghi người đang lưu.
// Trả { loi } hoặc { dong, phuCap, dieuChinh, lyDo }.
export function chuanHoaDong(dongGui, cu, nguoi, luc) {
  if (!Array.isArray(dongGui)) return { loi: 'Danh sách khoản không hợp lệ' }
  const ds = dongGui.filter(d => d && (Number(d.so_tien) || String(d.noi_dung || '').trim()))
  if (ds.length > SO_DONG_TOI_DA) return { loi: 'Tối đa ' + SO_DONG_TOI_DA + ' khoản mỗi người mỗi tháng' }
  const cuMap = new Map((Array.isArray(cu) ? cu : []).map(d => [d.id, d]))
  const dong = []
  for (const [i, d] of ds.entries()) {
    const loai = d.loai === 'dieu_chinh' ? 'dieu_chinh' : d.loai === 'phu_cap' ? 'phu_cap' : null
    if (!loai) return { loi: 'Dòng ' + (i + 1) + ': chưa chọn Phụ cấp hay Điều chỉnh' }
    const soTien = Math.round(Number(d.so_tien) || 0)
    if (!soTien) return { loi: 'Dòng ' + (i + 1) + ': chưa nhập số tiền' }
    if (Math.abs(soTien) > TOI_DA) return { loi: 'Dòng ' + (i + 1) + ': số tiền không hợp lệ' }
    if (loai === 'phu_cap' && soTien < 0) return { loi: 'Dòng ' + (i + 1) + ': phụ cấp không được âm — khoản trừ thì chọn Điều chỉnh (−)' }
    const noiDung = String(d.noi_dung || '').trim().slice(0, 200)
    // Bắt buộc ghi nội dung từng khoản (anh chốt 01/11/2026 — trước là một ô lý do chung)
    if (noiDung.length < NOI_DUNG_TOI_THIEU) return { loi: 'Dòng ' + (i + 1) + ': ghi nội dung khoản (vd: Phụ cấp xăng xe, Truy thu BHXH T9…)' }
    const c = d.id && cuMap.get(d.id)
    const giuNguyen = c && c.loai === loai && Number(c.so_tien) === soTien && c.noi_dung === noiDung
    dong.push({ id: c ? c.id : taoId(), loai, so_tien: soTien, noi_dung: noiDung, nguoi: giuNguyen ? c.nguoi : nguoi, luc: giuNguyen ? c.luc : luc })
  }
  const phuCap = dong.filter(d => d.loai === 'phu_cap').reduce((a, d) => a + d.so_tien, 0)
  const dieuChinh = dong.filter(d => d.loai === 'dieu_chinh').reduce((a, d) => a + d.so_tien, 0)
  return { dong, phuCap, dieuChinh, lyDo: vanBanLyDo(dong) }
}

// Một dòng chữ gộp mọi khoản — lưu vào cột ly_do (Excel cột "Lý do điều chỉnh", bản chụp cũ đọc cột này).
export function vanBanLyDo(dong) {
  return (dong || []).map(d => (d.so_tien > 0 ? '+' : '−') + fmt(Math.abs(d.so_tien)) + ' ' + d.noi_dung).join('; ').slice(0, 2000) || null
}

// Danh sách khoản của một bản ghi luong_dieu_chinh. Bản ghi cũ (trước sql/47 — chưa có chi_tiet) thì dựng lại từ
// hai cột tổng + lý do chung để màn hình vẫn hiện đúng, bấm Sửa là thành nhiều dòng.
export function dongCuaBanGhi(r) {
  if (!r) return []
  if (Array.isArray(r.chi_tiet) && r.chi_tiet.length) return r.chi_tiet
  const out = []
  if (Number(r.phu_cap)) out.push({ id: 'cu-pc', loai: 'phu_cap', so_tien: Number(r.phu_cap), noi_dung: r.ly_do || '', nguoi: r.sua_boi || null, luc: r.sua_luc || null })
  if (Number(r.dieu_chinh)) out.push({ id: 'cu-dc', loai: 'dieu_chinh', so_tien: Number(r.dieu_chinh), noi_dung: r.ly_do || '', nguoi: r.sua_boi || null, luc: r.sua_luc || null })
  return out
}
