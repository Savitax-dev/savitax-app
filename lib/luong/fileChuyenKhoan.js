// Phân hệ Tiền lương — FILE CHUYỂN KHOẢN chi lương hàng loạt (anh gửi mẫu ngân hàng 20/10/2026).
//
// Đúng 12 cột của mẫu, tiêu đề ở DÒNG 1, không dòng tiêu đề phụ / dòng tổng (file tải thẳng lên ngân
// hàng — thêm dòng lạ là ngân hàng từ chối cả file):
//   STT | Tên NV | Mã NV | Chức danh | Số tiền | Mã ngân hàng | Số tài khoản | Số CMND | Ngày cấp CMND |
//   Nơi cấp CMND | Số thẻ | Nội dung giao dịch
// Tên NV = tên chủ tài khoản viết HOA KHÔNG DẤU; số tài khoản để dạng CHỮ (giữ số 0 đầu); mã ngân hàng
// là mã số theo danh mục của ngân hàng chi lương — kế toán nội bộ nhập ở trang Quản lý nhân viên.
// Số tiền = THỰC LĨNH của bảng lương ĐÃ CHỐT; người thực lĩnh ≤ 0 hoặc thiếu tài khoản không vào Sheet1.
// Người thiếu số tài khoản / mã ngân hàng nằm ở sheet RIÊNG "Chuyen tay" (anh yêu cầu 05/11/2026) để kế toán chuyển
// tay — Sheet1 vẫn đúng mẫu ngân hàng, tải lên ngân hàng chỉ đọc Sheet1.

export const COT_CK = [
  ['STT', 5], ['Tên NV', 30], ['Mã NV', 9], ['Chức danh', 10], ['Số tiền', 14], ['Mã ngân hàng', 11],
  ['Số tài khoản', 20], ['Số CMND', 16], ['Ngày cấp CMND', 16], ['Nơi cấp CMND', 16], ['Số thẻ', 14], ['Nội dung giao dịch', 34],
]

export const khongDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9 .,\-/]/g, ' ').replace(/\s+/g, ' ').trim()

// Hàm THUẦN: tách bảng lương thành dòng chuyển khoản + danh sách người phải xử lý tay.
//   nganHang: Map staffId → { ngan_hang, so_tai_khoan, chu_tai_khoan, ma_ngan_hang } (số HIỆN TẠI)
export function dongChuyenKhoan(dong, nganHang, noiDung) {
  const ra = [], thieu = [], khongTra = []
  const nd = khongDau(noiDung).slice(0, 140)
  for (const x of dong || []) {
    const tien = Math.round(Number(x.thucLinh) || 0)
    if (x.luongCoBan === null || x.luongCoBan === undefined || tien <= 0) { if (x.luongCoBan !== null && x.luongCoBan !== undefined) khongTra.push({ ten: x.ten, tien }); continue }
    const nh = nganHang.get(x.staff_id)
    const ly = !nh?.so_tai_khoan ? 'chưa có số tài khoản' : !nh?.ma_ngan_hang ? 'chưa có mã ngân hàng' : null
    if (ly) {
      thieu.push({ ten: x.ten, tien, ly, nganHang: nh?.ngan_hang || '', maNh: nh?.ma_ngan_hang ? String(nh.ma_ngan_hang).trim() : '',
        stk: nh?.so_tai_khoan ? String(nh.so_tai_khoan).replace(/\s+/g, '') : '', chuTk: nh?.chu_tai_khoan || '', noiDung: nd })
      continue
    }
    ra.push({ staffId: x.staff_id, ten: khongDau(nh.chu_tai_khoan || x.ten).toUpperCase(), tien,
      maNh: String(nh.ma_ngan_hang).trim(), stk: String(nh.so_tai_khoan).replace(/\s+/g, ''), noiDung: nd, baoSai: x.phieu?.trang_thai === 'bao_sai' })
  }
  return { ra, thieu, khongTra, tong: ra.reduce((a, r) => a + r.tien, 0), tongThieu: thieu.reduce((a, r) => a + r.tien, 0) }
}

export async function taoWorkbookChuyenKhoan(ds, thieu = []) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Savitax — Hệ thống nội bộ'
  const ws = wb.addWorksheet('Sheet1', { views: [{ state: 'frozen', ySplit: 1 }] })
  const vien = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  COT_CK.forEach(([ten, rong], k) => {
    ws.getColumn(k + 1).width = rong
    const o = ws.getCell(1, k + 1)
    o.value = ten
    o.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333399' } }
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    o.border = vien
  })
  ws.getRow(1).height = 32
  ws.getColumn(7).numFmt = '@'   // số tài khoản: chữ, giữ số 0 đầu
  ds.forEach((r, i) => {
    const row = ws.getRow(i + 2)
    const ma = /^[1-9]\d{0,9}$/.test(r.maNh) ? Number(r.maNh) : r.maNh
    ;[i + 1, r.ten, null, null, r.tien, ma, r.stk, null, null, null, null, r.noiDung].forEach((v, k) => {
      const o = row.getCell(k + 1)
      o.value = v
      o.border = vien
      o.font = { size: 10 }
    })
    row.getCell(5).numFmt = '#,##0'
    row.getCell(7).numFmt = '@'
  })
  if (thieu.length) themSheetChuyenTay(wb, thieu, vien)
  return wb
}

// Sheet "Chuyen tay": người chưa đủ thông tin tài khoản — không đưa lên ngân hàng, kế toán chuyển tay.
const COT_TAY = [['STT', 5], ['Họ tên', 28], ['Số tiền', 14], ['Ngân hàng', 22], ['Mã ngân hàng', 12], ['Số tài khoản', 20],
  ['Chủ tài khoản', 26], ['Còn thiếu', 22], ['Nội dung giao dịch', 34]]
function themSheetChuyenTay(wb, thieu, vien) {
  const ws = wb.addWorksheet('Chuyen tay', { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: 'FFC0392B' } } })
  COT_TAY.forEach(([ten, rong], k) => {
    ws.getColumn(k + 1).width = rong
    const o = ws.getCell(1, k + 1)
    o.value = ten
    o.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } }
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    o.border = vien
  })
  ws.getRow(1).height = 32
  ws.getColumn(6).numFmt = '@'
  thieu.forEach((r, i) => {
    const row = ws.getRow(i + 2)
    ;[i + 1, r.ten, r.tien, r.nganHang || '', r.maNh || '', r.stk || '', r.chuTk || '', r.ly, r.noiDung || ''].forEach((v, k) => {
      const o = row.getCell(k + 1)
      o.value = v
      o.border = vien
      o.font = { size: 10, ...(k === 7 ? { color: { argb: 'FFC0392B' } } : {}) }
    })
    row.getCell(3).numFmt = '#,##0'
    row.getCell(6).numFmt = '@'
  })
  const cuoi = ws.getRow(thieu.length + 2)
  cuoi.getCell(2).value = 'Tổng ' + thieu.length + ' người'
  cuoi.getCell(3).value = thieu.reduce((a, r) => a + r.tien, 0)
  cuoi.getCell(3).numFmt = '#,##0'
  for (let k = 1; k <= COT_TAY.length; k++) {
    const o = cuoi.getCell(k)
    o.border = vien
    o.font = { bold: true, size: 10 }
    o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDEDEC' } }
  }
}

export async function xuatFileChuyenKhoan(ds, nam, thang, thieu = []) {
  const wb = await taoWorkbookChuyenKhoan(ds, thieu)
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'ChuyenKhoanLuong_T' + thang + '-' + nam + '.xlsx'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
