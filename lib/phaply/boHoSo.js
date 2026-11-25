// Phân hệ Pháp lý — MỘT chỗ quy định "thủ tục nào có những BỘ hồ sơ nào" (bộ biểu mẫu mới phòng gửi 25/11/2026).
// Hàm thuần, dùng chung máy chủ + trình duyệt: xuất Word / PDF / Drive, trình ký, hướng dẫn in ký, "còn thiếu gì".
//
// Biến thể thủ tục = mã thủ tục của hồ sơ (legal_cases.procedure_code) + đuôi theo loại hình:
//   hộ kinh doanh → _hkd ;  chi nhánh / văn phòng đại diện / địa điểm kinh doanh → _dvpt (đơn vị phụ thuộc)
// Hồ sơ đơn vị phụ thuộc gắn với DOANH NGHIỆP MẸ (entity_id = công ty mẹ) → mẫu chọn theo loại hình công ty mẹ (1tv/2tv/cp), còn
// loại đơn vị (chi_nhanh / vpdd / ddkd) lọc thêm giấy tờ riêng (ĐĐKD không cần quyết định / biên bản họp).

export const DVPT = ['chi_nhanh', 'vpdd', 'ddkd']
export const LOAI_DN = ['1tv', '2tv', 'cp']

export function bienThe(procedureCode, entityType) {
  const p = procedureCode || 'tlm'
  if (entityType === 'hkd') return p + '_hkd'
  if (DVPT.includes(entityType)) return p + '_dvpt'
  return p
}

// Các bộ của từng biến thể (thứ tự = thứ tự làm việc). 'ban_giao' (biên bản bàn giao) là bộ chung, không khai ở đây.
export const BO = {
  tlm:               [['so', 'Hồ sơ thành lập — nộp Phòng ĐKKD'], ['thue', 'Hồ sơ pháp lý ban đầu — sau khi có GPKD']],
  tlm_hkd:           [['so', 'Hồ sơ đăng ký hộ kinh doanh']],
  tlm_dvpt:          [['so', 'Hồ sơ đăng ký hoạt động đơn vị phụ thuộc']],
  tam_ngung:         [['so', 'Hồ sơ tạm ngừng kinh doanh']],
  tam_ngung_hkd:     [['so', 'Hồ sơ tạm ngừng hộ kinh doanh']],
  hoat_dong_lai:     [['so', 'Hồ sơ tiếp tục kinh doanh trước thời hạn']],
  hoat_dong_lai_hkd: [['so', 'Hồ sơ tiếp tục kinh doanh trước thời hạn']],
  giai_the:          [['so1', 'Giải thể — hồ sơ Sở bước 1 (quyết định giải thể)'], ['thue', 'Giải thể — hồ sơ thuế (đóng mã số thuế)'], ['so2', 'Giải thể — hồ sơ Sở bước 2 (đề nghị giải thể)']],
  giai_the_dvpt:     [['thue', 'Chấm dứt đơn vị phụ thuộc — hồ sơ thuế'], ['so', 'Chấm dứt đơn vị phụ thuộc — hồ sơ Sở']],
  giai_the_hkd:      [['thue', 'Chấm dứt hộ kinh doanh — hồ sơ thuế'], ['so', 'Chấm dứt hộ kinh doanh — hồ sơ cấp xã']],
  thay_doi:          [['so', 'Hồ sơ thay đổi đăng ký doanh nghiệp']],
  thay_doi_hkd:      [['so', 'Hồ sơ thay đổi đăng ký hộ kinh doanh']],
  thay_doi_dvpt:     [['so', 'Hồ sơ thay đổi đơn vị phụ thuộc']],
}

export const dsBo = bt => (BO[bt] || []).map(([dot, ten]) => ({ dot, ten }))
export const tenBo = (bt, dot) => dot === 'ban_giao' ? 'Biên bản bàn giao' : (BO[bt] || []).find(b => b[0] === dot)?.[1] || dot
export const coBo = (bt, dot) => dot === 'ban_giao' || (BO[bt] || []).some(b => b[0] === dot)

// Loại hình dùng để chọn mẫu: đơn vị phụ thuộc → loại hình công ty mẹ; còn lại → loại hình của hồ sơ
export function loaiHinhMau(entityType, loaiHinhMe) {
  if (DVPT.includes(entityType)) return LOAI_DN.includes(loaiHinhMe) ? loaiHinhMe : null
  return entityType
}
