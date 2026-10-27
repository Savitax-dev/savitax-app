// Số liệu GIẢ LẬP 11 quý cho mockup Dashboard tăng trưởng (Q1/2024 → Q3/2026).
// Khớp các màn khác: [34] 2025 = 57 tỷ, HĐ mua vào 2025 = 286 (Q3 = 98), HĐ bán ra 2025 = 412,
// 1 tờ khai hải quan quý 3/2025.
// Phí theo biểu phí: chạy thật computeFees (lib/salesPricing.js), ngành mặc định thương mại, kê khai tháng.
// Biểu phí là giá CHƯA VAT → × 1,08 để so với phí đang thu (monthly_fee đã gồm VAT):
//   mốc Q3/2024: 115 chứng từ/tháng, không HQ, DT 4 quý 43,8 tỷ → 8.700.000 chưa VAT → 9.396.000 gồm VAT
//   nay  Q3/2026: 206 chứng từ/tháng, có HQ,   DT 4 quý 63,8 tỷ → 14.760.000 chưa VAT → 15.940.800 gồm VAT
const QUY = ['Q1/24', 'Q2/24', 'Q3/24', 'Q4/24', 'Q1/25', 'Q2/25', 'Q3/25', 'Q4/25', 'Q1/26', 'Q2/26', 'Q3/26']
// Mỗi chỉ tiêu một màu riêng — để PHÂN BIỆT chỉ tiêu, không phải màu đánh giá.
const CHI_TIEU = [
  { k: 'dt', ten: 'Doanh thu', dv: 'tỷ đồng', icon: '💰', mau: '#8B1A1A', nhat: '#FBEAEA', nguon: 'xml', mo: 'Σ[34] tờ khai 01/GTGT', v: [10.6, 11.4, 12.0, 12.8, 13.4, 14.0, 14.5, 15.1, 15.4, 16.3, 17.0] },
  { k: 'ld', ten: 'Lao động trên bảng lương', dv: 'người', icon: '👥', mau: '#7C3AED', nhat: '#F3EEFF', nguon: 'excel', mo: 'Bình quân tháng · bảng lương', v: [18, 19, 20, 21, 22, 24, 25, 26, 27, 29, 30] },
  { k: 'vao', ten: 'Hóa đơn đầu vào', dv: 'hóa đơn', icon: '📥', mau: '#2563EB', nhat: '#EAF1FF', nguon: 'excel', mo: 'Bảng kê mua vào cổng HĐĐT', v: [48, 52, 55, 60, 62, 68, 98, 58, 75, 88, 104] },
  { k: 'ra', ten: 'Hóa đơn đầu ra', dv: 'hóa đơn', icon: '📤', mau: '#059669', nhat: '#E6F7F1', nguon: 'excel', mo: 'Bảng kê bán ra cổng HĐĐT', v: [70, 74, 80, 86, 92, 98, 106, 116, 120, 131, 142] },
  { k: 'hq', ten: 'Tờ khai hải quan', dv: 'tờ khai', icon: '🚢', mau: '#D97706', nhat: '#FEF4E6', nguon: 'pdf', mo: 'Thư mục 4. TỜ KHAI HẢI QUAN', v: [0, 0, 0, 0, 0, 0, 1, 0, 2, 3, 5] },
  { k: 'sk', ten: 'Giao dịch sao kê ngân hàng', dv: 'giao dịch', icon: '🏦', mau: '#0891B2', nhat: '#E6F6FA', nguon: 'excel', mo: 'Sổ phụ ngân hàng, mọi tài khoản', v: [180, 195, 210, 220, 240, 262, 281, 300, 330, 352, 371] },
]
const ctThang = i => (CHI_TIEU[2].v[i] + CHI_TIEU[3].v[i] + CHI_TIEU[5].v[i]) / 3
const MOC = 2, NAY = 10 // Q3/24 = lần đổi phí gần nhất; Q3/26 = quý đang xem
const VAT = 1.08
const PHI = {
  dangThu: 8500000, tuNgay: '01/07/2024',
  moc: { ct: 115, hq: false, dt: 43.8, bieuPhi: 8700000 },
  nay: { ct: 206, hq: true, dt: 63.8, bieuPhi: 14760000 },
  canCu: ['Khối lượng 206 chứng từ/tháng vượt bậc cao nhất; tính bậc 70 cộng thêm 50.000 đ mỗi hóa đơn vượt.',
    'Doanh nghiệp kê khai theo tháng nên phí cộng thêm 20% so với kê khai theo quý.'],
  canhBao: 'Doanh thu trên 30 tỷ đồng/năm — biểu phí theo doanh thu ghi “thỏa thuận”, cần Giám đốc duyệt mức phí.',
}
PHI.moc.gomVat = Math.round(PHI.moc.bieuPhi * VAT)
PHI.nay.gomVat = Math.round(PHI.nay.bieuPhi * VAT)
PHI.deXuat = PHI.nay.gomVat // mặc định = biểu phí gồm VAT; TP/admin sửa được, không lưu

const tang = (a, b) => (b == null || a == null) ? null : b === 0 ? (a > 0 ? 'moi' : 0) : (a - b) / b
const soVN = (v, d = 0) => v.toLocaleString('vi-VN', { maximumFractionDigits: d })
const ptTang = x => x === 'moi' ? '<span class="text-slate-500">mới phát sinh</span>' : x == null ? '—'
  : `<span class="${x > 0 ? 'text-slate-800' : 'text-gray-500'}">${x > 0 ? '+' : ''}${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span>`
// Nhãn tăng/giảm có màu: tăng xanh lá ▲, giảm hồng ▼, mới phát sinh tím.
function huy(x, nhan) {
  if (x == null) return `<span class="rounded-full px-2 py-0.5 text-[11px] bg-gray-100 text-gray-400">${nhan} —</span>`
  if (x === 'moi') return `<span class="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-700">${nhan} ✦ mới</span>`
  const len = x > 0, p = (len ? '+' : '') + (x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'
  return `<span class="rounded-full px-2 py-0.5 text-[11px] font-semibold ${len ? 'bg-emerald-100 text-emerald-700' : x < 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'}">${nhan} ${len ? '▲' : x < 0 ? '▼' : '='} ${p}</span>`
}
// Đồ thị cột theo quý: cột quý đang xem màu đậm, các cột khác màu nhạt, cột mốc viền vàng.
function cot(v, cao = 56, hienSo = false, nay = NAY, moc = MOC, mau = '#475569') {
  const max = Math.max(...v, 1)
  return `<div class="flex items-end gap-1" style="height:${cao}px">${v.map((x, i) => `<div class="flex-1 flex flex-col items-center justify-end h-full">
    ${hienSo ? `<span class="text-[9px] text-gray-500 tabular-nums mb-0.5">${soVN(x, 1)}</span>` : ''}
    <div class="w-full rounded-t ${i === moc ? 'ring-2 ring-[#C9A84C] ring-offset-1' : ''}" style="height:${Math.max(3, x / max * 100)}%;background:${mau};opacity:${i === nay ? 1 : 0.32}"></div></div>`).join('')}</div>`
}
