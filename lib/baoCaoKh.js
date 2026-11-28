// Báo cáo tình hình kinh doanh gửi khách (sheet "5. BC Tháng_Quý" của SVT.MB07 đưa lên app, anh chốt 28/11/2026).
// Hàm thuần — dùng chung cho tab "📊 Báo cáo KH" (components/BaoCaoKhachHang.js), ảnh (components/AnhBaoCaoKH.js),
// API (app/api/admin/bao-cao-kh) và bộ kiểm scripts/test-bao-cao-kh.mjs.

// Các dòng báo cáo — đúng thứ tự, tên như file Excel nhân viên đang gửi khách.
//   loai: 'so' (số lượng) · 'tien' (đồng) ; tinh: dòng app tự tính ; tuyChon: để trống thì không in lên ảnh ;
//   nam: chỉ có ở báo cáo năm.
export const DONG = [
  { k: 'hd_mv', stt: '1', ten: 'Số lượng hóa đơn mua vào, trong đó:', loai: 'so', tinh: true, con: ['hd_mv_hddt', 'hd_mv_hq', 'hd_mv_tm'] },
  { k: 'hd_mv_hddt', stt: '1.1', ten: 'Số lượng hóa đơn mua vào trên HĐĐT', loai: 'so', phu: true },
  { k: 'hd_mv_hq', stt: '1.2', ten: 'Số lượng hóa đơn tờ khai hải quan (nếu có)', loai: 'so', phu: true, tuyChon: true },
  { k: 'hd_mv_tm', stt: '1.3', ten: 'Số lượng hóa đơn bảng kê thu mua (nếu có)', loai: 'so', phu: true, tuyChon: true },
  { k: 'hd_br', stt: '2', ten: 'Số lượng hóa đơn bán ra', loai: 'so' },
  { k: 'doanh_so', stt: '3', ten: 'Doanh số bán ra (không bao gồm VAT)', loai: 'tien' },
  { k: 'gtgt_dk', stt: '4', ten: 'Số thuế GTGT đầu kỳ', loai: 'tien' },
  { k: 'gtgt_mv', stt: '5', ten: 'Số thuế GTGT mua vào', loai: 'tien' },
  { k: 'gtgt_br', stt: '6', ten: 'Số thuế GTGT bán ra', loai: 'tien' },
  { k: 'gtgt_kq', stt: '7', ten: 'Số thuế GTGT phải nộp / khấu trừ', loai: 'tien', tinh: true },
  { k: 'ld', stt: '8', ten: 'Số lượng lao động tham gia, trong đó:', loai: 'so', tinh: true, con: ['ld_tv_kt', 'ld_tv_kkt', 'ld_bhxh'], tuyChon: true },
  { k: 'ld_tv_kt', stt: '8.1', ten: 'Lao động thời vụ không tham gia BHXH, có khấu trừ 10%', loai: 'so', phu: true, tuyChon: true },
  { k: 'ld_tv_kkt', stt: '8.2', ten: 'Lao động thời vụ không tham gia BHXH, không khấu trừ 10%', loai: 'so', phu: true, tuyChon: true },
  { k: 'ld_bhxh', stt: '8.3', ten: 'Lao động tham gia BHXH', loai: 'so', phu: true, tuyChon: true },
  { k: 'tncn', stt: '9', ten: 'Số thuế TNCN phải nộp (khấu trừ của NLĐ)', loai: 'tien', tuyChon: true },
  { k: 'ln_tt', stt: '10', ten: 'Lợi nhuận kế toán trước thuế', loai: 'tien', tuyChon: true, am: true },
  { k: 'cp_khl', stt: '11', ten: 'Chi phí không hợp lý', loai: 'tien', tuyChon: true },
  { k: 'tndn_tt', stt: '12', ten: 'Số thuế TNDN tạm tính phải nộp', loai: 'tien', tuyChon: true },
  { k: 'tndn_da_nop', stt: '13', ten: 'Số thuế TNDN đã tạm nộp trong năm', loai: 'tien', tuyChon: true, nam: true },
  { k: 'tndn_con_lai', stt: '14', ten: 'Số thuế TNDN còn lại phải nộp', loai: 'tien', tinh: true, tuyChon: true, nam: true },
]
export const KHOA_NHAP = DONG.filter(d => !d.tinh).map(d => d.k)

// ---------- kỳ ----------
const HAI = n => String(n).padStart(2, '0')

export function phanTichKy(ky) {
  const s = String(ky || '')
  let m
  if ((m = s.match(/^T(0[1-9]|1[0-2])\.(\d{4})$/))) return { kieu: 'T', so: +m[1], nam: +m[2] }
  if ((m = s.match(/^Q([1-4])\.(\d{4})$/))) return { kieu: 'Q', so: +m[1], nam: +m[2] }
  if ((m = s.match(/^NAM\.(\d{4})$/))) return { kieu: 'NAM', so: 0, nam: +m[1] }
  return null
}
export const kyHopLe = ky => !!phanTichKy(ky)

export function maKy(kieu, so, nam) {
  if (kieu === 'T') return `T${HAI(so)}.${nam}`
  if (kieu === 'Q') return `Q${so}.${nam}`
  return `NAM.${nam}`
}

export function nhanKy(ky) {
  const p = phanTichKy(ky)
  if (!p) return String(ky || '')
  if (p.kieu === 'T') return `Tháng ${HAI(p.so)}/${p.nam}`
  if (p.kieu === 'Q') return `Quý ${p.so}/${p.nam}`
  return `Năm ${p.nam}`
}

export function kyTruoc(ky) {
  const p = phanTichKy(ky)
  if (!p) return null
  if (p.kieu === 'T') return p.so === 1 ? maKy('T', 12, p.nam - 1) : maKy('T', p.so - 1, p.nam)
  if (p.kieu === 'Q') return p.so === 1 ? maKy('Q', 4, p.nam - 1) : maKy('Q', p.so - 1, p.nam)
  return maKy('NAM', 0, p.nam - 1)
}

const cuoiThang = (nam, th) => new Date(Date.UTC(nam, th, 0)).getUTCDate()
// Ngày đầu / cuối kỳ dạng 'YYYY-MM-DD'
export function khoangKy(ky) {
  const p = phanTichKy(ky)
  if (!p) return null
  let t1, t2
  if (p.kieu === 'T') t1 = t2 = p.so
  else if (p.kieu === 'Q') { t1 = p.so * 3 - 2; t2 = p.so * 3 }
  else { t1 = 1; t2 = 12 }
  return { tu: `${p.nam}-${HAI(t1)}-01`, den: `${p.nam}-${HAI(t2)}-${HAI(cuoiThang(p.nam, t2))}` }
}

// Kỳ mặc định khi mở từ thẻ công ty: kỳ ĐANG LÀM tạm tính của tháng checklist.
export function kyMacDinh(reportType, thang, nam) {
  return reportType === 'quarterly' ? maKy('Q', Math.ceil(thang / 3), nam) : maKy('T', thang, nam)
}

// Kỳ suy từ tên việc trên Checklist ("Gửi BCT tạm tính tháng 11…", "Gửi báo cáo thuế quý 4 cho khách hàng…",
// "Gửi Báo cáo thuế tạm tính Qúy 1…"). Việc ở tháng checklist M, năm Y: số tháng/quý lớn hơn kỳ hiện tại
// nghĩa là kỳ của năm trước (VD quý 4 trên checklist tháng 1).
export function kyTuTenViec(ten, thang, nam, reportType) {
  const s = String(ten || '').toLowerCase().replace(/qúy/g, 'quý')
  let m
  if ((m = s.match(/quý\s*(\d)/))) {
    const q = +m[1]
    if (q >= 1 && q <= 4) return maKy('Q', q, q > Math.ceil(thang / 3) ? nam - 1 : nam)
  }
  if ((m = s.match(/tháng\s*(\d{1,2})/))) {
    const t = +m[1]
    if (t >= 1 && t <= 12) return maKy('T', t, t > thang ? nam - 1 : nam)
  }
  return kyMacDinh(reportType, thang, nam)
}

// ---------- số ----------
export function docSo(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null
  const s = String(v).trim()
  if (!s) return null
  const am = /^[-(−]/.test(s)
  const chi = s.replace(/[^\d]/g, '')
  if (!chi) return null
  const n = Number(chi)
  return am ? -n : n
}
export const vietSo = n => (n === null || n === undefined ? '' : Number(n).toLocaleString('vi-VN'))

// Chuẩn hóa số liệu nhận từ trình duyệt — chỉ giữ khóa biết trước. Máy chủ dùng lại hàm này, không tin dữ liệu gửi lên.
export function chuanHoa(soLieu = {}) {
  const ra = {}
  for (const k of KHOA_NHAP) {
    const d = DONG.find(x => x.k === k)
    let n = docSo(soLieu[k])
    if (n !== null && n < 0 && !d.am) n = Math.abs(n)
    ra[k] = n
  }
  ra.den_ngay = /^\d{4}-\d{2}-\d{2}$/.test(String(soLieu.den_ngay || '')) ? soLieu.den_ngay : null
  return ra
}

// Các dòng tự tính: tổng con, thuế GTGT phải nộp/khấu trừ, TNDN còn lại.
export function tinh(soLieu = {}) {
  const v = { ...soLieu }
  const tong = keys => (keys.some(k => v[k] !== null && v[k] !== undefined) ? keys.reduce((s, k) => s + (Number(v[k]) || 0), 0) : null)
  v.hd_mv = tong(['hd_mv_hddt', 'hd_mv_hq', 'hd_mv_tm'])
  v.ld = tong(['ld_tv_kt', 'ld_tv_kkt', 'ld_bhxh'])
  v.gtgt_kq = (Number(v.gtgt_br) || 0) - (Number(v.gtgt_mv) || 0) - (Number(v.gtgt_dk) || 0)
  v.tndn_con_lai = v.tndn_tt === null || v.tndn_tt === undefined ? null : (Number(v.tndn_tt) || 0) - (Number(v.tndn_da_nop) || 0)
  return v
}

// Đầu kỳ gợi ý = phần còn khấu trừ của báo cáo kỳ trước (kỳ trước phải nộp → 0).
export function dauKyTuKyTruoc(soLieuTruoc) {
  if (!soLieuTruoc) return null
  const kq = tinh(soLieuTruoc).gtgt_kq
  return kq < 0 ? -kq : 0
}

const ngayVN = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '')
export { ngayVN }

// Nhãn + ghi chú tự sinh cho dòng 7 và dòng 14.
export function nhanKetQua(kq) {
  if (kq > 0) return 'Số thuế GTGT phải nộp'
  if (kq < 0) return 'Số thuế GTGT còn được khấu trừ'
  return 'Số thuế GTGT phải nộp / khấu trừ'
}
export function ghiChuKetQua(kq, hanGtgt, kieu) {
  if (kq > 0) return hanGtgt ? `Nộp trước ngày ${ngayVN(hanGtgt)}` : 'Phải nộp'
  if (kq < 0) return kieu === 'NAM' ? 'Còn được khấu trừ' : 'Chuyển khấu trừ kỳ sau (không phải nộp)'
  return ''
}

// Dòng in lên ảnh: bỏ dòng năm ở báo cáo tháng/quý, bỏ dòng tùy chọn để trống.
export function dongIn(ky, soLieu, ghiChu = {}, han = {}) {
  const p = phanTichKy(ky)
  const v = tinh(soLieu)
  const ra = []
  for (const d of DONG) {
    if (d.nam && p?.kieu !== 'NAM') continue
    const val = v[d.k]
    // Dòng tùy chọn để trống HOẶC bằng 0 thì không in (anh chốt 28/11: 1.2, 1.3 = 0 → ẩn) — trừ khi có ghi chú tay
    if (d.tuyChon && (val === null || val === undefined || val === 0) && !ghiChu[d.k]) continue
    let ten = d.ten, gc = ghiChu[d.k] || '', so = val
    if (d.k === 'gtgt_kq') { ten = nhanKetQua(val); so = Math.abs(val); gc = gc || ghiChuKetQua(val, han.gtgt, p?.kieu) }
    if (d.k === 'tndn_con_lai' && val !== null) { gc = gc || (han.tndn ? `Nộp trước ngày ${ngayVN(han.tndn)}` : '') }
    ra.push({ k: d.k, stt: d.stt, ten, so, phu: !!d.phu, gc })
  }
  return ra
}

// ---------- lời nhắn Zalo ----------
export const MAU_LOI_NHAN = [
  'Dạ anh/chị, em gửi anh/chị Báo cáo thuế tạm tính {ky} từ ngày {tuNgay} đến ngày {denNgay} số thuế phát sinh của công ty như sau:',
  '- Thuế GTGT mua vào là: {gtgtMv}đ',
  '- Thuế GTGT bán ra là: {gtgtBr}đ',
  '- {ketQua}',
  '{dongThem}',
  'Bên mình xem xét số liệu báo cáo và nắm tình hình để mình cân đối, bổ sung thêm chứng từ đầy đủ (nếu có) giúp em nhé.',
  'Em cảm ơn anh/chị ạ.',
].join('\n')

export function dienLoiNhan(mau, { ky, soLieu, han = {} }) {
  const v = tinh(soLieu)
  const kh = khoangKy(ky)
  const den = soLieu.den_ngay || kh?.den
  const kq = v.gtgt_kq
  const ketQua = kq > 0
    ? `Thuế GTGT phải nộp là: ${vietSo(kq)}đ${han.gtgt ? ` (nộp trước ngày ${ngayVN(han.gtgt)})` : ''}`
    : kq < 0 ? `Thuế GTGT được khấu trừ là: ${vietSo(-kq)}đ` : 'Thuế GTGT phải nộp là: 0đ'
  const them = []
  if (v.tncn) them.push(`- Thuế TNCN phải nộp là: ${vietSo(v.tncn)}đ`)
  if (v.tndn_tt) them.push(`- Thuế TNDN tạm tính là: ${vietSo(v.tndn_tt)}đ`)
  const ra = String(mau || '')
    .replaceAll('{ky}', nhanKy(ky).replace('Tháng 0', 'Tháng '))
    .replaceAll('{tuNgay}', ngayVN(kh?.tu))
    .replaceAll('{denNgay}', ngayVN(den))
    .replaceAll('{gtgtMv}', vietSo(v.gtgt_mv || 0))
    .replaceAll('{gtgtBr}', vietSo(v.gtgt_br || 0))
    .replaceAll('{ketQua}', ketQua)
    .replaceAll('{dongThem}', them.join('\n'))
  // Zalo giãn mỗi lần xuống dòng thành khoảng cách lớn → bỏ dòng trống
  return ra.split('\n').map(x => x.trimEnd()).filter(x => x.trim()).join('\n')
}

// Tên file ảnh lưu vào Tài liệu: BCKD_<kỳ>_<MÃ KH>_<YYYYMMDD-HHmm>.png (quy ước SVT.QT.04)
export function tenFileAnh(ky, maKh, luc = new Date()) {
  const vn = new Date(luc.getTime() + 7 * 3600e3)
  const t = vn.toISOString()
  const ma = String(maKh || 'CTY').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'CTY'
  return `BCKD_${ky}_${ma}_${t.slice(0, 10).replace(/-/g, '')}-${t.slice(11, 13)}${t.slice(14, 16)}.png`
}

// Hôm nay theo giờ VN 'YYYY-MM-DD'
export const homNayVN = (luc = new Date()) => new Date(luc.getTime() + 7 * 3600e3).toISOString().slice(0, 10)
// "Số liệu đến ngày" mặc định: hôm nay nếu kỳ chưa hết, không thì ngày cuối kỳ
export function denNgayMacDinh(ky, luc = new Date()) {
  const kh = khoangKy(ky); const hn = homNayVN(luc)
  if (!kh) return hn
  return hn < kh.den ? (hn < kh.tu ? kh.tu : hn) : kh.den
}
