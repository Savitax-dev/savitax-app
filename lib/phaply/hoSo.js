// Phân hệ Pháp lý — hằng số dùng chung máy chủ + giao diện: thủ tục, loại hình, 10 bước, trạng thái chờ, mã hồ sơ, hạn.
// Kế hoạch: docs/phan-he-phap-ly-ke-hoach.md mục 3. Đổi mã ở đây là đổi dữ liệu đã lưu — chỉ THÊM, đừng đổi tên.

export const THU_TUC = [
  { k: 'tlm',           label: 'Thành lập mới' },
  { k: 'thay_doi',      label: 'Thay đổi đăng ký' },
  { k: 'tam_ngung',     label: 'Tạm ngừng kinh doanh' },
  { k: 'hoat_dong_lai', label: 'Hoạt động trở lại' },
  { k: 'cap_lai_gpkd',  label: 'Cấp lại GCN ĐKDN' },
  { k: 'khoi_phuc_mst', label: 'Khôi phục mã số thuế' },
  { k: 'giai_the',      label: 'Giải thể' },
  { k: 'rut_ho_so',     label: 'Rút hồ sơ' },
  { k: 'khac',          label: 'Thủ tục khác' },
]
export const thuTucLabel = k => THU_TUC.find(t => t.k === k)?.label || k || '—'

export const LOAI_HINH = [
  { k: '1tv',       label: 'TNHH 1 thành viên',   ngan: 'TNHH 1TV' },
  { k: '2tv',       label: 'TNHH 2 thành viên+',  ngan: 'TNHH 2TV' },
  { k: 'cp',        label: 'Công ty cổ phần',     ngan: 'CP' },
  { k: 'hkd',       label: 'Hộ kinh doanh',       ngan: 'HKD' },
  { k: 'chi_nhanh', label: 'Chi nhánh',           ngan: 'CN' },
  { k: 'vpdd',      label: 'Văn phòng đại diện',  ngan: 'VPĐD' },
  { k: 'ddkd',      label: 'Địa điểm kinh doanh', ngan: 'ĐĐKD' },
  { k: 'khac',      label: 'Khác',                ngan: 'Khác' },
]
export const loaiHinhLabel = (k, ngan) => { const l = LOAI_HINH.find(t => t.k === k); return l ? (ngan ? l.ngan : l.label) : k || '—' }

// 10 bước — khớp cây thư mục 1…8 nhân viên đang dùng trên ổ chung (kế hoạch mục 3)
export const BUOC = [
  { n: 1,  label: 'Tiếp nhận',        ngan: 'Tiếp nhận' },
  { n: 2,  label: 'Thu thập thông tin', ngan: 'Thu thập' },
  { n: 3,  label: 'Báo giá – ĐNTT',   ngan: 'Báo giá' },
  { n: 4,  label: 'Soạn hồ sơ',       ngan: 'Soạn' },
  { n: 5,  label: 'Trình ký',         ngan: 'Trình ký' },
  { n: 6,  label: 'Nộp & theo dõi',   ngan: 'Nộp Sở' },
  { n: 7,  label: 'Kết quả',          ngan: 'Kết quả' },
  { n: 8,  label: 'Hồ sơ thuế',       ngan: 'Hồ sơ thuế' },
  { n: 9,  label: 'Bàn giao',         ngan: 'Bàn giao' },
  { n: 10, label: 'Đóng – lưu trữ',   ngan: 'Đóng' },
]
export const BUOC_DONG = 10
export const buocLabel = (n, ngan) => { const b = BUOC.find(x => x.n === Number(n)); return b ? (ngan ? b.ngan : b.label) : '—' }

// Đang kẹt ở ai — tách khỏi bước để trưởng phòng nhìn một màn biết hồ sơ nào treo
export const CHO = [
  { k: 'khach',   label: 'Chờ khách',     mau: '#B45309' },
  { k: 'so',      label: 'Chờ Sở',        mau: '#1D4ED8' },
  { k: 'thue',    label: 'Chờ Thuế',      mau: '#7C3AED' },
  { k: 'bo_sung', label: 'Cần bổ sung',   mau: '#B91C1C' },
]
export const choLabel = k => CHO.find(c => c.k === k)?.label || ''

export const NGUON = [
  { k: 'moi',        label: 'Khách mới' },
  { k: 'khach_cu',   label: 'Khách cũ / khách kế toán' },
  { k: 'kinh_doanh', label: 'Từ Phòng Kinh doanh' },
  { k: 'gioi_thieu', label: 'Được giới thiệu' },
  { k: 'khac',       label: 'Khác' },
]

// ─── ngày giờ Việt Nam (Vercel chạy UTC) ───
export function homNayVN(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Hạn nội bộ = ngày nhận + số ngày, BỎ CHỦ NHẬT, ngày nhận tính là ngày 1 (giống lib/hcnsDue.js — anh chốt 31/10/2026).
export function hanNoiBo(ngayNhanISO, soNgay) {
  const n = Number(soNgay) || 0
  if (!ngayNhanISO || n <= 0) return null
  const [y, m, d] = String(ngayNhanISO).slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  let dem = t.getUTCDay() === 0 ? 0 : 1
  while (dem < n) { t.setUTCDate(t.getUTCDate() + 1); if (t.getUTCDay() !== 0) dem++ }
  return t.toISOString().slice(0, 10)
}

// Trễ hạn nội bộ: qua HẾT ngày hạn (0h ngày kế, giờ VN) mà hồ sơ chưa đóng
export function treHan(hoSo, homNay = homNayVN()) {
  return !!hoSo?.due_at && Number(hoSo.stage) < BUOC_DONG && String(hoSo.due_at).slice(0, 10) < homNay
}

// Mã hồ sơ PL-YYMM-NN (NN tăng trong tháng). daCo = các mã cùng tiền tố đã có.
export function tienToMa(homNay = homNayVN()) { return `PL-${homNay.slice(2, 4)}${homNay.slice(5, 7)}-` }
export function maKeTiep(daCo, homNay = homNayVN()) {
  const tt = tienToMa(homNay)
  const lon = (daCo || []).filter(c => c?.startsWith(tt)).map(c => parseInt(c.slice(tt.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0)
  return tt + String(lon + 1).padStart(2, '0')
}
