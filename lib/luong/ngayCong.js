// Phân hệ Tiền lương — ngày công. Hàm THUẦN (không đọc database), dùng chung cho máy chủ, trang và
// bộ kiểm scripts/test-luong-ngay-cong.mjs. BƯỚC 1 của phân hệ (xem lib/luong/README.md).
//
// Anh chốt 14/10/2026: ngày công chuẩn = số ngày THẬT của tháng, trừ chủ nhật và ngày nghỉ lễ.
// Thứ Bảy (làm online nửa ngày) vẫn tính ĐỦ một công.

const pad = n => String(n).padStart(2, '0')
export const soNgayTrongThang = (nam, thang) => new Date(Date.UTC(nam, thang, 0)).getUTCDate()

// ngayLe: mảng 'YYYY-MM-DD'. Lễ rơi vào chủ nhật không trừ hai lần.
export function ngayCongChuan(nam, thang, ngayLe = []) {
  const le = new Set(ngayLe)
  let chuNhat = 0, leTru = 0
  const n = soNgayTrongThang(nam, thang)
  for (let d = 1; d <= n; d++) {
    const laCN = new Date(Date.UTC(nam, thang - 1, d)).getUTCDay() === 0
    if (laCN) { chuNhat++; continue }
    if (le.has(nam + '-' + pad(thang) + '-' + pad(d))) leTru++
  }
  return { soNgay: n, chuNhat, le: leTru, chuan: n - chuNhat - leTru }
}

// Số ngày hợp lệ: không âm, bước nửa ngày.
export const soNgayHopLe = v => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 31 && Math.round(v * 2) === v * 2

// Kiểm bảng công trước khi lưu / xác nhận. Trả { loi } hoặc { canhBao?, tong, tinhLuong }.
//   - tổng ba ô KHÔNG được vượt ngày công chuẩn;
//   - thiếu so với chuẩn (vd vào làm giữa tháng) thì phải ghi chú lý do khi xác nhận.
export function kiemChamCong({ ngay_di_lam, nghi_phep, nghi_khong_luong, ghi_chu }, chuan, { xacNhan = false } = {}) {
  const v = [ngay_di_lam, nghi_phep, nghi_khong_luong].map(Number)
  if (!v.every(soNgayHopLe)) return { loi: 'Số ngày phải là số không âm, theo bước nửa ngày (0,5).' }
  const tong = v[0] + v[1] + v[2]
  if (tong > chuan) return { loi: 'Tổng ba ô là ' + tong + ' ngày, vượt ngày công chuẩn của tháng (' + chuan + ').' }
  const thieu = chuan - tong
  if (thieu > 0 && xacNhan && !String(ghi_chu || '').trim()) {
    return { loi: 'Còn ' + thieu + ' ngày chưa khai so với ngày công chuẩn (' + chuan + '). Ghi chú lý do (vd: vào làm từ ngày 15) rồi mới xác nhận.' }
  }
  return { tong, tinhLuong: v[0] + v[1], canhBao: thieu > 0 ? 'Còn ' + thieu + ' ngày chưa khai so với ngày công chuẩn.' : null }
}

// Tháng nhân viên được tự khai: tháng hiện tại và tháng trước (giờ Việt Nam).
export function thangDuocKhai(now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600e3)
  const nam = vn.getUTCFullYear(), thang = vn.getUTCMonth() + 1
  const truoc = thang === 1 ? { nam: nam - 1, thang: 12 } : { nam, thang: thang - 1 }
  return [{ nam, thang }, truoc]
}

// Lương áp dụng cho tháng: dòng có ap_dung_tu lớn nhất mà <= ngày 01 của tháng.
export function luongCuaThang(dsLichSu, nam, thang) {
  const moc = nam + '-' + pad(thang) + '-01'
  let chon = null
  for (const r of dsLichSu || []) {
    if (String(r.ap_dung_tu).slice(0, 10) <= moc && (!chon || r.ap_dung_tu > chon.ap_dung_tu)) chon = r
  }
  return chon
}
