// Phân hệ Pháp lý — hạn lưu ảnh CCCD (anh chốt 31/10/2026): XOÁ ẢNH 24 tháng sau khi đóng hồ sơ, giữ số liệu đã nhập (số CCCD, ngày
// cấp…) để hồ sơ vẫn tra cứu được. Mở lại hồ sơ = dừng đếm (closed_at bị xoá khi mở lại). Hàm THUẦN — kiểm offline test-phaply-han-luu.
// Chạy bằng cron hằng ngày app/api/cron/phaply-xoa-cccd (xoá trong kho phaply-cccd VÀ bản trên Drive phòng pháp lý).
import { BUOC_DONG } from './hoSo.js'

export const THANG_LUU = 24

// mốc: hồ sơ đóng TRƯỚC hoặc ĐÚNG mốc này thì tới hạn xoá (giờ VN không quan trọng ở độ dài 24 tháng — so theo thời điểm tuyệt đối)
export function mocHetHan(now = new Date(), thang = THANG_LUU) {
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() - thang)
  return d
}

// cases: [{ id, entity_id, stage, closed_at, is_deleted }] của MỌI hồ sơ (để biết pháp nhân còn hồ sơ đang làm không)
// → id các hồ sơ tới hạn xoá ảnh. Pháp nhân còn hồ sơ khác chưa đóng (cùng khách làm tiếp thủ tục thay đổi…) thì CHƯA xoá: ảnh còn dùng.
export function hoSoToiHanXoa(cases, now = new Date(), thang = THANG_LUU) {
  const moc = mocHetHan(now, thang)
  const conLam = new Set(cases.filter(c => !c.is_deleted && Number(c.stage) < BUOC_DONG && c.entity_id).map(c => c.entity_id))
  return cases.filter(c => Number(c.stage) >= BUOC_DONG && c.closed_at && new Date(c.closed_at) <= moc && !(c.entity_id && conLam.has(c.entity_id)))
    .map(c => c.id)
}
