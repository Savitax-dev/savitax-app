// Phân hệ Pháp lý — NHÓM THỦ TỤC (mỗi nhóm một trang riêng, anh yêu cầu 17/11/2026) + nội dung thay đổi + thời hạn TẠM NGỪNG.
// Hàm THUẦN — kiểm offline scripts/test-phaply-nhom.mjs. Thủ tục (procedure_code) định nghĩa ở lib/phaply/hoSo.js (THU_TUC).

export const NHOM = {
  thanh_lap: { ten: 'Thành lập mới', duong: '/phaply/thanh-lap', bieuTuong: '🏢', thuTuc: ['tlm'], coSan: false },
  thay_doi: { ten: 'Thay đổi đăng ký', duong: '/phaply/thay-doi', bieuTuong: '✏️', thuTuc: ['thay_doi'], coSan: true },
  tam_ngung: { ten: 'Tạm ngừng / Hoạt động lại', duong: '/phaply/tam-ngung', bieuTuong: '⏸️', thuTuc: ['tam_ngung', 'hoat_dong_lai'], coSan: true },
  giai_the: { ten: 'Giải thể / Chấm dứt', duong: '/phaply/giai-the', bieuTuong: '🔚', thuTuc: ['giai_the'], coSan: true },
  khac: { ten: 'Thủ tục khác', duong: '/phaply/khac', bieuTuong: '📎', thuTuc: ['cap_lai_gpkd', 'khoi_phuc_mst', 'rut_ho_so', 'khac'], coSan: true },
}
// coSan = thủ tục làm trên công ty ĐÃ CÓ → tạo hồ sơ bắt đầu bằng chọn công ty (hồ sơ pháp lý cũ / khách kế toán)
export const nhomCuaThuTuc = code => Object.keys(NHOM).find(k => NHOM[k].thuTuc.includes(code)) || 'khac'

// Nội dung thay đổi (một hồ sơ Thay đổi có thể gồm nhiều nội dung)
export const NOI_DUNG_THAY_DOI = [
  { k: 'tang_von', label: 'Tăng vốn điều lệ' },
  { k: 'giam_von', label: 'Giảm vốn điều lệ' },
  { k: 'ten', label: 'Đổi tên doanh nghiệp' },
  { k: 'dia_chi', label: 'Đổi địa chỉ trụ sở' },
  { k: 'dai_dien', label: 'Đổi người đại diện theo pháp luật' },
  { k: 'thanh_vien', label: 'Thay đổi thành viên / cổ đông / chuyển nhượng vốn' },
  { k: 'chu_so_huu', label: 'Thay đổi chủ sở hữu' },
  { k: 'nganh', label: 'Bổ sung / rút ngành nghề' },
  { k: 'chuyen_doi', label: 'Chuyển đổi loại hình' },
  { k: 'cap_nhat', label: 'Cập nhật thông tin (CCCD, địa giới hành chính…)' },
  { k: 'khac', label: 'Nội dung khác' },
]
export const noiDungLabel = k => NOI_DUNG_THAY_DOI.find(x => x.k === k)?.label || k
export const locNoiDung = ds => (Array.isArray(ds) ? [...new Set(ds.filter(k => NOI_DUNG_THAY_DOI.some(x => x.k === k)))] : [])

// ─── Tạm ngừng ──────────────────────────────────────────────────────────────────────────────────────────
// Luật Doanh nghiệp 2020 Điều 206 + nghị định hướng dẫn (NĐ 168/2025): mỗi lần tạm ngừng KHÔNG QUÁ 1 NĂM; thông báo bằng văn bản
// CHẬM NHẤT 3 NGÀY LÀM VIỆC trước ngày tạm ngừng / ngày tiếp tục kinh doanh trước thời hạn. (Pháp lý kiểm lại nếu luật đổi.)
// Ngày làm việc ở đây = thứ Hai–thứ Sáu (chưa trừ ngày lễ — ngày lễ thì nộp sớm hơn).
export const NGAY_BAO_SAP = 30, NGAY_BAO_GAP = 7

const d = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z')
const iso = t => t.toISOString().slice(0, 10)
export function congNgay(s, n) { const t = d(s); t.setUTCDate(t.getUTCDate() + n); return iso(t) }
export const soNgay = (tu, den) => Math.round((d(den) - d(tu)) / 86400000)

// Ngày tối đa được tạm ngừng khi bắt đầu từ `tu`: tròn 1 năm (tu + 1 năm − 1 ngày)
export function denToiDa(tu) { const t = d(tu); t.setUTCFullYear(t.getUTCFullYear() + 1); t.setUTCDate(t.getUTCDate() - 1); return iso(t) }

// Lùi n ngày làm việc (bỏ thứ Bảy, Chủ nhật)
export function luiNgayLamViec(s, n) {
  const t = d(s); let dem = 0
  while (dem < n) { t.setUTCDate(t.getUTCDate() - 1); const w = t.getUTCDay(); if (w !== 0 && w !== 6) dem++ }
  return iso(t)
}
// Hạn nộp thông báo cho một mốc (ngày bắt đầu tạm ngừng / ngày hoạt động lại / ngày gia hạn bắt đầu)
export const hanThongBao = moc => luiNgayLamViec(moc, 3)

// Kiểm khoảng tạm ngừng nhập vào → chuỗi lỗi hoặc null
export function kiemTamNgung(tu, den) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu || '') || !/^\d{4}-\d{2}-\d{2}$/.test(den || '')) return 'Nhập đủ ngày bắt đầu và ngày kết thúc tạm ngừng'
  if (den < tu) return 'Ngày kết thúc phải sau ngày bắt đầu'
  if (den > denToiDa(tu)) return `Mỗi lần tạm ngừng tối đa 1 năm — kết thúc chậm nhất ${denToiDa(tu).split('-').reverse().join('/')}`
  return null
}

// Trạng thái theo dõi một khoảng tạm ngừng tại ngày `homNay` (YYYY-MM-DD):
//   chua_bat_dau · dang (còn > 30 ngày) · sap (≤ 30) · gap (≤ 7) · qua_han (đã hết mà chưa có hồ sơ tiếp theo) · da_xu_ly (đã có hồ sơ
//   hoạt động lại / gia hạn / giải thể tiếp theo)
export function trangThaiTamNgung({ tu, den, daCoTiepTheo = false }, homNay) {
  if (!tu || !den) return null
  const con = soNgay(homNay, den)
  const muc = daCoTiepTheo ? 'da_xu_ly' : homNay < tu ? 'chua_bat_dau' : con < 0 ? 'qua_han' : con <= NGAY_BAO_GAP ? 'gap' : con <= NGAY_BAO_SAP ? 'sap' : 'dang'
  return { muc, con_ngay: con, han_thong_bao_tiep: congNgay(den, 1) > homNay ? hanThongBao(congNgay(den, 1)) : null }
}
export const MUC_TAM_NGUNG = {
  chua_bat_dau: { label: 'Chưa tới ngày tạm ngừng', mau: '#64748B' },
  dang: { label: 'Đang tạm ngừng', mau: '#1D4ED8' },
  sap: { label: 'Sắp hết hạn — nhắc khách', mau: '#B45309' },
  gap: { label: 'Gấp — sắp hết hạn', mau: '#B91C1C' },
  qua_han: { label: 'ĐÃ HẾT HẠN — chưa xử lý', mau: '#7F1D1D' },
  da_xu_ly: { label: 'Đã có hồ sơ tiếp theo', mau: '#15803D' },
}
export const canNhac = muc => ['sap', 'gap', 'qua_han'].includes(muc)
