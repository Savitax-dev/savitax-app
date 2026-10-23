// Phân hệ Tiền lương — đọc file "Bảng chấm công chi tiết" xuất từ phần mềm chấm công và quy về bảng công
// của app. Hàm THUẦN: nhận một hàm đọc ô (o(hàng, cột) → chữ) nên chạy được trên trình duyệt (exceljs) lẫn
// bộ kiểm node. BƯỚC 1 của phân hệ (xem lib/luong/README.md).
//
// Anh chốt 23/10/2026:
//   Ngày đi làm      = HC + Công tác + số THỨ BẢY làm việc trong tháng (máy không chấm thứ Bảy online;
//                      app tính thứ Bảy đủ công — ai nghỉ thứ Bảy thì tự báo / trưởng phòng sửa)
//   Nghỉ phép        = Nghỉ phép + Nghỉ phép đột xuất Ban GĐ duyệt
//   Nghỉ không lương = Nghỉ không lương + Nghỉ thai sản
//   Nghỉ lễ          = bỏ qua (đã trừ khỏi công chuẩn)
//   Vi phạm tác phong = số lần đi muộn + số lần về sớm (mỗi lần = 1 lần vi phạm)
// Cột nhận theo TÊN tiêu đề (không theo vị trí) để phần mềm chấm công thêm / bớt cột vẫn đọc đúng.

const pad = n => String(n).padStart(2, '0')
const chuan = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()

// Tiêu đề → khoá. Thứ tự quan trọng: "nghỉ phép đột xuất" phải khớp trước "nghỉ phép".
const TIEU_DE = [
  ['ma', /^mã nhân viên$/], ['ten', /^họ và tên$/], ['hc', /^hc$/],
  ['dotXuat', /^nghỉ phép đột xuất/], ['phep', /^nghỉ phép$/], ['le', /^nghỉ lễ$/], ['congTac', /^công tác$/],
  ['khongLuong', /^nghỉ không lương$/], ['thaiSan', /^nghỉ thai sản$/],
  ['muonLan', /^tổng số lần đi muộn$/], ['somLan', /^tổng số lần về sớm$/],
  ['muonPhut', /^tổng số phút đi muộn$/], ['somPhut', /^tổng số phút về sớm$/],
]

const so = v => {
  const t = String(v ?? '').trim().replace(',', '.')
  if (!t) return 0
  const n = Number(t)
  return isFinite(n) ? n : NaN
}
export const lam2 = n => Math.round(n * 100) / 100

// o(r, c): chữ của ô (r, c tính từ 1). soHang / soCot: kích thước bảng.
export function docBangMayChamCong(o, soHang, soCot) {
  // Kỳ: dòng "… Từ 01/10/2026 Đến 31/10/2026" ở phần đầu file.
  let tuNgay = null, denNgay = null
  for (let r = 1; r <= Math.min(12, soHang) && !tuNgay; r++) {
    for (let c = 1; c <= Math.min(10, soCot); c++) {
      const m = /Từ\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+Đến\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(o(r, c))
      if (m) { tuNgay = m[3] + '-' + pad(m[2]) + '-' + pad(m[1]); denNgay = m[6] + '-' + pad(m[5]) + '-' + pad(m[4]); break }
    }
  }
  // Dòng tiêu đề: dòng đầu tiên có ô "Mã nhân viên". Tiêu đề con (HC, Nghỉ thai sản…) nằm ở 1–2 dòng dưới.
  let dau = 0
  for (let r = 1; r <= Math.min(40, soHang) && !dau; r++) {
    for (let c = 1; c <= soCot; c++) if (chuan(o(r, c)) === 'mã nhân viên') { dau = r; break }
  }
  if (!dau) return { loi: 'Không thấy cột "Mã nhân viên" — đây có phải file "Bảng chấm công chi tiết" xuất từ phần mềm chấm công?' }
  const cot = {}
  for (let r = dau; r <= dau + 2; r++) {
    for (let c = 1; c <= soCot; c++) {
      const t = chuan(o(r, c))
      if (!t) continue
      for (const [k, re] of TIEU_DE) if (!cot[k] && re.test(t)) { cot[k] = c; break }
    }
  }
  const thieu = ['ma', 'ten', 'hc', 'phep', 'khongLuong'].filter(k => !cot[k])
  if (thieu.length) return { loi: 'File thiếu cột: ' + thieu.join(', ') + '. Kiểm lại mẫu xuất của phần mềm chấm công.' }

  const dong = []
  for (let r = dau + 1; r <= soHang; r++) {
    const ma = String(o(r, cot.ma) || '').trim()
    if (!ma || chuan(ma) === 'mã nhân viên') continue
    const x = { hang: r, ma, ten: String(o(r, cot.ten) || '').replace(/\s+/g, ' ').trim() }
    // Bỏ dòng chữ ký / ghi chú cuối file ("Ngày ….. tháng …", "Người lập"): mã có dấu cách hoặc không có tên.
    if (!/^[\p{L}\p{N}._\-/]{1,20}$/u.test(ma) || !x.ten) continue
    for (const [k] of TIEU_DE) if (k !== 'ma' && k !== 'ten') x[k] = cot[k] ? so(o(r, cot[k])) : 0
    x.soLoi = TIEU_DE.filter(([k]) => k !== 'ma' && k !== 'ten' && Number.isNaN(x[k])).map(([k]) => k)
    dong.push(x)
  }
  return { tuNgay, denNgay, dong, cot }
}

// Số thứ Bảy LÀM VIỆC của tháng (bỏ thứ Bảy trùng ngày lễ — đã trừ khỏi công chuẩn).
export function soThuBayLamViec(nam, thang, ngayLe = []) {
  const le = new Set(ngayLe)
  let n = 0
  const cuoi = new Date(Date.UTC(nam, thang, 0)).getUTCDate()
  for (let d = 1; d <= cuoi; d++) {
    if (new Date(Date.UTC(nam, thang - 1, d)).getUTCDay() === 6 && !le.has(nam + '-' + pad(thang) + '-' + pad(d))) n++
  }
  return n
}

// Quy một dòng file về các ô của bảng công app.
export function quyDoiMay(x, soThuBay) {
  return {
    ngay_di_lam: lam2(x.hc + x.congTac + soThuBay),
    nghi_phep: lam2(x.phep + x.dotXuat),
    nghi_khong_luong: lam2(x.khongLuong + x.thaiSan),
    so_lan_vi_pham: Math.max(0, Math.round(x.muonLan + x.somLan)),
    may: {
      hc: x.hc, cong_tac: x.congTac, thu_bay: soThuBay, phep: x.phep, dot_xuat: x.dotXuat, le: x.le,
      khong_luong: x.khongLuong, thai_san: x.thaiSan,
      muon_lan: x.muonLan, som_lan: x.somLan, muon_phut: x.muonPhut, som_phut: x.somPhut,
    },
  }
}

// Ghép tên không phân biệt dấu cách thừa / hoa thường (vẫn GIỮ dấu tiếng Việt — bỏ dấu dễ ghép nhầm người).
export const khoaTen = s => chuan(s)
