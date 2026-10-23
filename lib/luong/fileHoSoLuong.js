// Phân hệ Tiền lương — FILE HỒ SƠ LƯƠNG NHÂN VIÊN: tải file mẫu (điền sẵn danh sách) → kế toán nội bộ điền →
// nhập lại vào app. Dùng chung cho trình duyệt (tạo / đọc file bằng exceljs) và máy chủ (hằng số cột).
// Nhận người theo EMAIL đăng nhập (không đổi) — mã nhân viên sẽ đổi theo phần mềm chấm công (anh dặn 23/10).
// Phòng remote không có trong file: không tính lương trên app.

export const COT_HS = [
  // [khoá, tiêu đề, độ rộng, nhóm, điền?]
  ['stt', 'STT', 5, 'NHÂN VIÊN — app điền sẵn', 0], ['ma', 'Mã NV', 10, 'NHÂN VIÊN — app điền sẵn', 1],
  ['ten', 'Họ tên', 26, 'NHÂN VIÊN — app điền sẵn', 0], ['email', 'Email đăng nhập (KHÔNG sửa)', 30, 'NHÂN VIÊN — app điền sẵn', 0],
  ['phong', 'Phòng', 13, 'NHÂN VIÊN — app điền sẵn', 0], ['vaiTro', 'Vai trò', 13, 'NHÂN VIÊN — app điền sẵn', 0],
  ['ngayVao', 'Ngày vào làm (dd/mm/yyyy)', 13, 'CHẤM CÔNG', 1], ['mayCC', 'Chấm công bằng máy', 11, 'CHẤM CÔNG', 1],
  ['cap', 'Cấp bậc', 10, 'LƯƠNG', 1], ['lcb', 'Lương cơ bản', 14, 'LƯƠNG', 1], ['dt', 'DT tối thiểu', 14, 'LƯƠNG', 1],
  ['bhxh', 'Lương đóng BHXH', 15, 'LƯƠNG', 1], ['thamGia', 'Tham gia BHXH', 10, 'LƯƠNG', 1], ['npt', 'Người phụ thuộc', 10, 'LƯƠNG', 1],
  ['tuThang', 'Áp dụng từ tháng (MM/YYYY)', 13, 'LƯƠNG', 1],
  ['nh', 'Ngân hàng', 16, 'TÀI KHOẢN NHẬN LƯƠNG', 1], ['maNh', 'Mã ngân hàng', 11, 'TÀI KHOẢN NHẬN LƯƠNG', 1],
  ['stk', 'Số tài khoản', 18, 'TÀI KHOẢN NHẬN LƯƠNG', 1], ['chuTk', 'Tên chủ TK (không dấu)', 24, 'TÀI KHOẢN NHẬN LƯƠNG', 1],
  ['ghiChu', 'Ghi chú', 26, 'GHI CHÚ', 1],
]
const VAI = { admin: 'Quản trị', leader: 'Trưởng phòng', staff: 'Nhân viên', nhan_vien_nb: 'Nhân viên NB', hcns: 'HCNS', sales: 'Kinh doanh', collab: 'Cộng tác' }
const MAU_NHOM = { 'NHÂN VIÊN — app điền sẵn': 'FF1F2937', 'CHẤM CÔNG': 'FF0E7490', 'LƯƠNG': 'FF1D4ED8', 'TÀI KHOẢN NHẬN LƯƠNG': 'FF0F766E', 'GHI CHÚ': 'FF6B7280' }
const DO = 'FF8B1A1A', TRANG = 'FFFFFFFF', XAM = 'FFF3F4F6'
const to = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const net = { style: 'thin', color: { argb: 'FFD6D3D1' } }
const vien = { top: net, left: net, bottom: net, right: net }
const SO = '#,##0;[Red]-#,##0;""'
const ngayVN = iso => iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) + '/' + String(iso).slice(0, 4) : null

// d = { nhanVien: [{ id, full_name, email, role, phong, ma_nhan_vien, ngay_vao_lam, cham_cong_may, luong, nganHang }], capBac: [...] }
export async function taoWorkbookHoSo(d) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Savitax — Hệ thống nội bộ'
  const cap = d.capBac || []
  const capTen = new Map(cap.map(c => [c.ma, c.ten]))

  const wc = wb.addWorksheet('Cap bac')
  wc.columns = [{ header: 'Cấp bậc', width: 10 }, { header: 'Mô tả', width: 26 }, { header: 'Lương cơ bản', width: 15 }, { header: 'DT tối thiểu', width: 15 }, { header: 'Lương đóng BHXH', width: 16 }]
  cap.forEach(c => wc.addRow([c.ten, c.mo_ta || '', Number(c.luong_co_ban) || null, c.doanh_thu_toi_thieu == null ? null : Number(c.doanh_thu_toi_thieu), c.luong_bhxh == null ? null : Number(c.luong_bhxh)]))
  wc.getRow(1).eachCell(o => { o.font = { bold: true, color: { argb: TRANG } }; o.fill = to(DO) })
  for (let r = 2; r <= cap.length + 1; r++) for (let k = 3; k <= 5; k++) wc.getRow(r).getCell(k).numFmt = SO
  const nCap = cap.length + 1

  const ws = wb.addWorksheet('Nhap thong tin', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] })
  const n = COT_HS.length
  COT_HS.forEach((c, k) => { ws.getColumn(k + 1).width = c[2] })
  ws.mergeCells(1, 1, 1, n)
  ws.getCell(1, 1).value = 'HỒ SƠ LƯƠNG NHÂN VIÊN — NHẬP VÀO APP SAVITAX'
  ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: DO } }
  ws.mergeCells(2, 1, 2, n)
  ws.getCell(2, 1).value = 'Ô vàng = điền · ô xám = app điền sẵn, KHÔNG sửa (nhận người theo Email) · Chọn cấp bậc thì lương tự lấy theo bảng cấp · Xem sheet "Huong dan"'
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && COT_HS[j + 1][3] === COT_HS[i][3]) j++
    if (j > i) ws.mergeCells(3, i + 1, 3, j + 1)
    const o = ws.getCell(3, i + 1)
    o.value = COT_HS[i][3]; o.fill = to(MAU_NHOM[COT_HS[i][3]]); o.font = { bold: true, color: { argb: TRANG }, size: 10 }; o.alignment = { horizontal: 'center' }
    i = j + 1
  }
  COT_HS.forEach((c, k) => {
    const o = ws.getCell(4, k + 1)
    o.value = c[1]; o.fill = to(c[4] ? 'FFFFF4CC' : XAM); o.font = { bold: true, size: 10 }
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; o.border = vien
  })
  ws.getRow(4).height = 42
  const cot = k => COT_HS.findIndex(c => c[0] === k) + 1
  const L = (k, r) => ws.getColumn(cot(k)).letter + r
  d.nhanVien.forEach((s, idx) => {
    const r = 5 + idx, l = s.luong, b = s.nganHang
    const tra = so => ({ formula: `IF(${L('cap', r)}="","",IFERROR(VLOOKUP(${L('cap', r)},'Cap bac'!$A$2:$E$${nCap},${so},FALSE),""))` })
    const gt = {
      stt: idx + 1, ma: s.ma_nhan_vien || null, ten: s.full_name, email: s.email, phong: s.phong || '', vaiTro: VAI[s.role] || s.role,
      ngayVao: ngayVN(s.ngay_vao_lam), mayCC: s.cham_cong_may === false ? 'Không' : 'Có',
      cap: l?.cap_bac ? capTen.get(l.cap_bac) || null : null,
      lcb: l ? Number(l.luong_co_ban) : tra(3), dt: l ? (l.doanh_thu_toi_thieu == null ? null : Number(l.doanh_thu_toi_thieu)) : tra(4),
      bhxh: l ? (l.luong_bhxh == null ? null : Number(l.luong_bhxh)) : tra(5),
      thamGia: l ? (l.tham_gia_bhxh ? 'Có' : 'Không') : null, npt: l ? Number(l.so_nguoi_phu_thuoc) || 0 : null,
      tuThang: d.tuThang || null,
      nh: b?.ngan_hang || null, maNh: b?.ma_ngan_hang || null, stk: b?.so_tai_khoan || null, chuTk: b?.chu_tai_khoan || null, ghiChu: null,
    }
    COT_HS.forEach((c, k) => {
      const o = ws.getRow(r).getCell(k + 1)
      o.value = gt[c[0]]; o.border = vien; o.font = { size: 10 }
      o.fill = to(c[4] ? 'FFFFFBEB' : XAM)
      if (['lcb', 'dt', 'bhxh'].includes(c[0])) o.numFmt = SO
      if (['ma', 'ngayVao', 'tuThang', 'maNh', 'stk'].includes(c[0])) o.numFmt = '@'
    })
    ws.getRow(r).getCell(cot('ten')).font = { size: 10, bold: true }
    ws.getRow(r).getCell(cot('cap')).dataValidation = { type: 'list', allowBlank: true, formulae: [`'Cap bac'!$A$2:$A$${nCap}`], showErrorMessage: true, errorTitle: 'Cấp bậc', error: 'Chọn trong danh sách cấp bậc' }
    ws.getRow(r).getCell(cot('thamGia')).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Có,Không"'] }
    ws.getRow(r).getCell(cot('mayCC')).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Có,Không"'] }
    ws.getRow(r).getCell(cot('npt')).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [0, 20], showErrorMessage: true, error: 'Số người phụ thuộc từ 0 đến 20' }
  })
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } }

  const wh = wb.addWorksheet('Huong dan')
  wh.getColumn(1).width = 26; wh.getColumn(2).width = 100
  ;[
    ['HƯỚNG DẪN ĐIỀN', ''],
    ['Ô xám', 'App điền sẵn từ danh sách nhân viên đang làm việc (trừ phòng remote). KHÔNG sửa — nhất là cột Email: app nhận đúng người theo email.'],
    ['Mã NV', 'Mã theo phần mềm chấm công (dùng để nhập file chấm công hằng tháng). Mỗi người một mã, không trùng.'],
    ['Ngày vào làm', 'Dạng dd/mm/yyyy (vd 15/03/2024) — dùng cho báo cáo thâm niên và xét cấp bậc.'],
    ['Chấm công bằng máy', '"Không" cho nhân viên online và ban giám đốc — họ tự khai công trên app, nhập file chấm công sẽ bỏ qua họ.'],
    ['Cấp bậc', 'Chọn trong danh sách (sheet "Cap bac"). Chọn xong 3 cột lương tự lấy theo cấp; gõ số khác vào ô nếu người này được đặt riêng.'],
    ['Lương đóng BHXH', 'Để trống = chưa đóng BHXH.'],
    ['Tham gia BHXH', '"Có" = nhân viên chính thức, thuế TNCN tính lũy tiến. "Không" = thử việc / học việc, khấu trừ 10% tổng thu nhập.'],
    ['Người phụ thuộc', 'Chỉ ghi người đã nộp hồ sơ đăng ký người phụ thuộc. Mỗi người giảm trừ 6.200.000đ/tháng.'],
    ['Áp dụng từ tháng', 'Tháng bắt đầu áp dụng mức lương, dạng MM/YYYY (vd 10/2026). Mỗi lần đổi lương là một dòng lịch sử, tháng cũ giữ số cũ.'],
    ['Mã ngân hàng', 'Mã SỐ của ngân hàng theo danh mục của ngân hàng công ty dùng chi lương (cột "Mã ngân hàng" trong file chi lương hàng loạt).'],
    ['Số tài khoản', 'Gõ đúng số, giữ số 0 ở đầu (ô đã để dạng chữ). Tên chủ TK viết HOA KHÔNG DẤU.'],
    ['Người không tính lương', 'Tài khoản dùng chung / quản trị: để trống phần lương, app bỏ qua.'],
  ].forEach((h, k) => {
    const row = wh.addRow(h)
    if (k === 0) row.font = { bold: true, size: 13, color: { argb: DO } }
    else { row.getCell(1).font = { bold: true }; row.getCell(2).alignment = { wrapText: true, vertical: 'top' } }
  })
  wb.views = [{ activeTab: 1 }]
  return wb
}

export async function taiFileMauHoSo(d) {
  const wb = await taoWorkbookHoSo(d)
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'Ho_so_luong_nhan_vien.xlsx'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Đọc file đã điền. o(r, c) → giá trị ô (chữ / số / Date). Trả { dong: [{ hang, email, ...}] } hoặc { loi }.
export function docFileHoSo(o, soHang, soCot) {
  const chuan = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
  let dau = 0
  for (let r = 1; r <= Math.min(20, soHang) && !dau; r++) for (let c = 1; c <= soCot; c++) if (chuan(o(r, c)).startsWith('email đăng nhập')) { dau = r; break }
  if (!dau) return { loi: 'Không thấy cột "Email đăng nhập" — hãy dùng đúng file mẫu tải từ app.' }
  const cot = {}
  for (let c = 1; c <= soCot; c++) {
    const t = chuan(o(dau, c))
    const k = COT_HS.find(x => chuan(x[1]) === t)
    if (k) cot[k[0]] = c
  }
  const dong = []
  for (let r = dau + 1; r <= soHang; r++) {
    const email = String(o(r, cot.email) ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) continue
    const x = { hang: r, email }
    for (const [k] of COT_HS) if (cot[k] && !['stt', 'email', 'phong', 'vaiTro'].includes(k)) {
      const v = o(r, cot[k])
      x[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : typeof v === 'number' ? v : String(v).trim()
    }
    dong.push(x)
  }
  return { dong }
}
