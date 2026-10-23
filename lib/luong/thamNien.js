// Phân hệ Tiền lương — THÂM NIÊN & cấp bậc theo thâm niên (báo cáo ở trang Báo cáo KPI, anh yêu cầu 23/10/2026).
// Hàm THUẦN. Mốc của từng cấp đọc từ cột MÔ TẢ của bảng cấp bậc (luong_cap_bac.mo_ta, vd "Dưới 2 tháng",
// "Trên 1 năm – dưới 2 năm") — anh sửa mô tả trên app là báo cáo tự đổi theo, không phải sửa mã.
// Chỉ nhóm nhân viên (Cấp 1 … 8) xét theo thâm niên; cấp trưởng phòng (A/B/C) không có mốc.

// Số THÁNG TRÒN đã làm từ ngày vào làm tới ngày xét (đủ ngày trong tháng mới tính tháng đó).
export function soThangThamNien(ngayVao, ngayXet) {
  if (!ngayVao) return null
  const [y1, m1, d1] = String(ngayVao).slice(0, 10).split('-').map(Number)
  const [y2, m2, d2] = String(ngayXet).slice(0, 10).split('-').map(Number)
  let t = (y2 - y1) * 12 + (m2 - m1)
  if (d2 < d1) t--
  return Math.max(0, t)
}

export const chuThamNien = t => {
  if (t == null) return '—'
  const y = Math.floor(t / 12), m = t % 12
  return y ? (m ? y + ' năm ' + m + ' tháng' : y + ' năm') : m + ' tháng'
}

// "dưới X tháng/năm" → trần (tháng, không gồm). Không có "dưới" → không trần (cấp cao nhất).
export function tranCuaCap(moTa) {
  const m = /dưới\s+(\d+)\s*(tháng|năm)/i.exec(String(moTa || ''))
  if (!m) return null
  return Number(m[1]) * (/năm/i.test(m[2]) ? 12 : 1)
}

// Bậc thang cấp theo thâm niên: [{ ma, ten, tu, den }] (tháng; den = null là không trần), xếp theo thứ tự.
export function bacThang(capBac) {
  const ds = (capBac || []).filter(c => c.nhom !== 'truong_phong').sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0))
  let tu = 0
  return ds.map(c => { const den = tranCuaCap(c.mo_ta); const b = { ma: c.ma, ten: c.ten, tu, den }; if (den != null) tu = den; return b })
}

// Cấp đúng theo thâm niên + mốc kế tiếp. ngayXet: 'YYYY-MM-DD'.
export function capTheoThamNien(capBac, ngayVao, ngayXet) {
  const t = soThangThamNien(ngayVao, ngayXet)
  if (t == null) return null
  const thang = bacThang(capBac)
  if (!thang.length) return null
  const i = thang.findIndex(b => b.den == null || t < b.den)
  const dung = thang[i === -1 ? thang.length - 1 : i]
  const ke = dung.den != null ? thang[thang.indexOf(dung) + 1] : null
  let ngayLenCap = null
  if (ke) {
    const [y, m, d] = String(ngayVao).slice(0, 10).split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1 + dung.den, 1))
    const cuoi = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
    ngayLenCap = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(Math.min(d, cuoi)).padStart(2, '0')
  }
  return { thang: t, dung, ke, ngayLenCap }
}

// So cấp hiện tại với cấp đúng. Trả: 'dung' | 'den_han' (thấp hơn thâm niên) | 'cao_hon' | 'chua_ngay' | 'chua_cap' | 'truong_phong'
export function soSanhCap(capBac, maHienTai, ngayVao, ngayXet) {
  const cap = (capBac || []).find(c => c.ma === maHienTai)
  if (cap?.nhom === 'truong_phong') return { tt: 'truong_phong' }
  const kq = capTheoThamNien(capBac, ngayVao, ngayXet)
  if (!kq) return { tt: 'chua_ngay' }
  if (!cap) return { tt: 'chua_cap', ...kq }
  const thu = c => (capBac.find(x => x.ma === c)?.thu_tu) ?? 0
  const lech = thu(maHienTai) - thu(kq.dung.ma)
  return { tt: lech === 0 ? 'dung' : lech < 0 ? 'den_han' : 'cao_hon', ...kq }
}
