// Xuất BẢNG LƯƠNG ra Excel có CÔNG THỨC và ĐỊNH DẠNG — phân hệ Tiền lương bước 3.
//
// Kế toán nội bộ / nhân viên HCNS làm tiếp trên file: sửa số lần vi phạm, phụ cấp, điều chỉnh ngoại lệ
// giám đốc duyệt (+/−), số người phụ thuộc — file tự tính lại thưởng phòng, tổng thu nhập, thuế TNCN,
// khoản trừ và thực lĩnh. Tỉ lệ / mốc thưởng nằm ở sheet Tham so, sửa ở đó là cả file đổi.
//
// Dùng exceljs (18/10/2026, anh chê bản SheetJS "xấu quá"): tô màu, kẻ khung, cố định tiêu đề, định
// dạng số. Thư viện nặng nên chỉ nạp khi bấm nút (import động), không làm chậm lúc mở trang.
import { THUONG_KPI, TY_LE_VUOT_DOANH_SO, MUC_TRU_TAC_PHONG } from './thuong.js'
import { KHAU_TRU, CONG_TY_DONG } from './khauTru.js'
import { GIAM_TRU, BAC_THUE, TY_LE_KHAU_TRU_KHONG_BHXH } from './thueTncn.js'

const TS = "'Tham so'", KP = "'KPI phong'"
const MAU = {
  do: 'FF8B1A1A', doNhat: 'FFFDECEC', vang: 'FFFFF4CC', xam: 'FFF5F5F4', xamVien: 'FFD6D3D1',
  xanhLa: 'FFE8F5E9', xanhDuong: 'FFE8F0FB', tim: 'FFF1ECFB', cam: 'FFFFF0E0', den: 'FF1F2937', trang: 'FFFFFFFF',
}
// Biểu lũy tiến 5 bậc dựng từ BAC_THUE (thueTncn.js) — đổi biểu ở đó là file Excel đổi theo.
const fLuyTien = t => BAC_THUE.reduceRight((sau, [tran, ts, tru]) => {
  const bieuThuc = `${t}*${ts}` + (tru ? `-${tru}` : '')
  return tran === Infinity ? bieuThuc : `IF(${t}<=${tran},${bieuThuc},${sau})`
}, '')
const fThuongKpi = o => `IF(${o}="",0,IF(${o}<${TS}!$B$5,0,IF(${o}<=${TS}!$B$6,${TS}!$B$7,${TS}!$B$8)))`
const SO = '#,##0;[Red]-#,##0;"-"'
const PT = '0"%"'
const vien = (mau = MAU.xamVien) => ({ top: { style: 'thin', color: { argb: mau } }, left: { style: 'thin', color: { argb: mau } }, bottom: { style: 'thin', color: { argb: mau } }, right: { style: 'thin', color: { argb: mau } } })
const to = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

// Cột của sheet chính: [tiêu đề, độ rộng, nhóm, kiểu: so|pt|chu|nhap]
const COT = [
  ['STT', 5, 'NHÂN VIÊN', 'chu'], ['Họ tên', 26, 'NHÂN VIÊN', 'chu'], ['Phòng', 12, 'NHÂN VIÊN', 'chu'], ['Cấp', 8, 'NHÂN VIÊN', 'chu'], ['Là TP', 7, 'NHÂN VIÊN', 'chu'],
  ['Lương cơ bản', 13, 'LƯƠNG', 'so'], ['Lương đóng BHXH', 13, 'LƯƠNG', 'so'], ['Tham gia BHXH', 9, 'LƯƠNG', 'chu'], ['Công chuẩn', 8, 'LƯƠNG', 'so'], ['Ngày tính lương', 9, 'LƯƠNG', 'so'], ['Lương theo công', 14, 'LƯƠNG', 'so'],
  ['% CV', 7, 'THƯỞNG KPI', 'pt'], ['Thưởng KPI CV', 12, 'THƯỞNG KPI', 'so'], ['% Nợ', 7, 'THƯỞNG KPI', 'pt'], ['Thưởng KPI nợ', 12, 'THƯỞNG KPI', 'so'],
  ['Doanh thu (chưa VAT)', 15, 'DOANH SỐ', 'so'], ['DT tối thiểu', 13, 'DOANH SỐ', 'so'], ['Thưởng doanh số', 13, 'DOANH SỐ', 'so'],
  ['Thưởng DVK', 12, 'THƯỞNG KHÁC', 'so'], ['Hoa hồng GT', 12, 'THƯỞNG KHÁC', 'so'], ['Số lần vi phạm', 9, 'THƯỞNG KHÁC', 'so'], ['% tác phong', 9, 'THƯỞNG KHÁC', 'pt'],
  ['KPI phòng', 8, 'THƯỞNG KHÁC', 'pt'], ['Thưởng phòng', 12, 'THƯỞNG KHÁC', 'so'],
  ['Phụ cấp', 12, 'NHẬP TAY', 'nhap'], ['Điều chỉnh (+/−)', 13, 'NHẬP TAY', 'nhap'], ['Lý do điều chỉnh', 26, 'NHẬP TAY', 'nhap'],
  ['Tổng thu nhập', 14, 'THU NHẬP', 'so'],
  ['Thu nhập chịu thuế', 14, 'THUẾ TNCN', 'so'], ['Người phụ thuộc', 9, 'THUẾ TNCN', 'so'], ['Giảm trừ bản thân', 13, 'THUẾ TNCN', 'so'],
  ['Giảm trừ NPT', 12, 'THUẾ TNCN', 'so'], ['Giảm trừ BHXH', 11, 'THUẾ TNCN', 'so'], ['Thu nhập tính thuế', 14, 'THUẾ TNCN', 'so'],
  ['Cách tính thuế', 12, 'THUẾ TNCN', 'chu'], ['Thuế TNCN', 12, 'THUẾ TNCN', 'so'],
  ['BHXH 10,5%', 11, 'KHOẢN TRỪ', 'so'], ['KPCĐ 0,5%', 10, 'KHOẢN TRỪ', 'so'], ['Đoàn phí', 9, 'KHOẢN TRỪ', 'so'], ['Tổng trừ (gồm thuế)', 12, 'KHOẢN TRỪ', 'so'],
  ['THỰC LĨNH', 15, 'THỰC LĨNH', 'so'],
  ['Cty BHXH 17,5%', 12, 'CÔNG TY ĐÓNG', 'so'], ['Cty BHYT 3%', 11, 'CÔNG TY ĐÓNG', 'so'], ['Cty BHTN 1%', 11, 'CÔNG TY ĐÓNG', 'so'],
  ['Cty KPCĐ 2%', 11, 'CÔNG TY ĐÓNG', 'so'], ['Tổng nộp BHXH (NLĐ + Cty)', 14, 'CÔNG TY ĐÓNG', 'so'], ['Chi phí lương Cty', 15, 'CÔNG TY ĐÓNG', 'so'],
  ['Ngân hàng', 16, 'CHUYỂN KHOẢN', 'chu'], ['Số tài khoản', 18, 'CHUYỂN KHOẢN', 'chu'], ['Chủ tài khoản', 24, 'CHUYỂN KHOẢN', 'chu'],
  ['Cần xem', 30, 'GHI CHÚ', 'chu'],
]
const MAU_NHOM = {
  'NHÂN VIÊN': MAU.den, 'LƯƠNG': 'FF1D4ED8', 'THƯỞNG KPI': 'FF047857', 'DOANH SỐ': 'FF6D28D9', 'THƯỞNG KHÁC': 'FFC2410C',
  'NHẬP TAY': 'FFA16207', 'THU NHẬP': 'FF334155', 'THUẾ TNCN': 'FFB91C1C', 'KHOẢN TRỪ': 'FFBE123C', 'THỰC LĨNH': MAU.do,
  'CÔNG TY ĐÓNG': 'FF4338CA', 'CHUYỂN KHOẢN': 'FF0E7490', 'GHI CHÚ': 'FF6B7280',
}
const iCot = ten => COT.findIndex(c => c[0] === ten)

// Tiêu đề hai tầng: tầng trên gộp ô theo nhóm, tầng dưới là tên cột.
function tieuDeHaiTang(ws, hangNhom, hangCot, cot) {
  let i = 0
  while (i < cot.length) {
    let j = i
    while (j + 1 < cot.length && cot[j + 1][2] === cot[i][2]) j++
    if (j > i) ws.mergeCells(hangNhom, i + 1, hangNhom, j + 1)
    const o = ws.getCell(hangNhom, i + 1)
    o.value = cot[i][2]
    o.fill = to(MAU_NHOM[cot[i][2]] || MAU.den)
    o.font = { bold: true, color: { argb: MAU.trang }, size: 10 }
    o.alignment = { horizontal: 'center', vertical: 'middle' }
    i = j + 1
  }
  cot.forEach((c, k) => {
    const o = ws.getCell(hangCot, k + 1)
    o.value = c[3] === 'nhap' ? '✎ ' + c[0] : c[0]
    o.fill = to(c[3] === 'nhap' ? MAU.vang : MAU.xam)
    o.font = { bold: true, size: 10, color: { argb: MAU.den } }
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    o.border = vien()
  })
  ws.getRow(hangNhom).height = 18
  ws.getRow(hangCot).height = 34
}

function tieuDeSheet(ws, soCot, dong1, dong2) {
  ws.mergeCells(1, 1, 1, soCot)
  const a = ws.getCell(1, 1)
  a.value = dong1
  a.font = { bold: true, size: 15, color: { argb: MAU.do } }
  a.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 26
  ws.mergeCells(2, 1, 2, soCot)
  const b = ws.getCell(2, 1)
  b.value = dong2
  b.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
}

// Dựng workbook (tách riêng để bộ kiểm chạy được trên node, không cần trình duyệt).
export async function taoWorkbookBangLuong(d) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Savitax — Hệ thống nội bộ'
  wb.created = new Date()
  const ky = d.thang + '/' + d.nam
  const trangThai = d.daChot ? 'ĐÃ CHỐT ' + new Date(d.daChot.luc).toLocaleString('vi-VN') + (d.daChot.boi ? ' bởi ' + d.daChot.boi : '') : 'CHƯA CHỐT — số có thể đổi khi dữ liệu trên app đổi'
  const kySoLieu = '%-công việc T' + d.kyViec.thang + '/' + d.kyViec.nam + ' · %-công nợ T' + d.kyNo.thang + '/' + d.kyNo.nam + ' · doanh thu T' + d.kyDoanhThu.thang + '/' + d.kyDoanhThu.nam + ' (chưa VAT) · công chuẩn ' + d.ngayCongChuan

  // ── Sheet chính ────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Bang luong T' + d.thang + '-' + d.nam, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4, zoomScale: 90 }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  })
  COT.forEach((c, k) => { ws.getColumn(k + 1).width = c[1] })
  tieuDeSheet(ws, COT.length, 'BẢNG LƯƠNG THÁNG ' + ky + ' — SAVITAX', trangThai + '   ·   ' + kySoLieu + '   ·   Cột vàng ✎ nhập tay, file tự tính lại')
  tieuDeHaiTang(ws, 3, 4, COT)
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COT.length } }

  // Theo phòng; trong mỗi phòng trưởng phòng đứng đầu rồi nhân viên theo tên — khớp màn hình.
  const ds = [...d.dong].sort((a, b) => (a.phong ? 0 : 1) - (b.phong ? 0 : 1) || String(a.phong).localeCompare(String(b.phong), 'vi')
    || (b.laTruongPhong ? 1 : 0) - (a.laTruongPhong ? 1 : 0) || String(a.ten).localeCompare(String(b.ten), 'vi'))
  const dau = 5
  ds.forEach((x, i) => {
    const r = dau + i
    const L = ten => ws.getColumn(iCot(ten) + 1).letter + r
    const ct = (formula, result) => ({ formula, result: result ?? 0 })
    const gt = [
      i + 1, x.ten, x.phong || '', x.capBac || '', x.laTruongPhong ? 'Có' : 'Không',
      x.luongCoBan ?? null, x.luongBhxh ?? null, x.thamGiaBhxh ? 'Có' : 'Không', x.ngayCongChuan ?? null, x.ngayTinhLuong ?? null,
      ct(`IF(OR(${L('Công chuẩn')}="",${L('Công chuẩn')}=0,${L('Ngày tính lương')}=""),0,ROUND(${L('Lương cơ bản')}*${L('Ngày tính lương')}/${L('Công chuẩn')},0))`, x.luongTheoCong || 0),
      x.kpiApDung ? x.pctViec : null, ct(fThuongKpi(L('% CV')), x.thuongViec),
      x.kpiApDung ? x.pctNo : null, ct(fThuongKpi(L('% Nợ')), x.thuongNo),
      x.doanhThu, x.toiThieu ?? null,
      ct(`IF(${L('Là TP')}="Có",ROUND(${L('Doanh thu (chưa VAT)')}*${TS}!$B$9,0),IF(OR(${L('DT tối thiểu')}="",${L('Doanh thu (chưa VAT)')}<=${L('DT tối thiểu')}),0,ROUND((${L('Doanh thu (chưa VAT)')}-${L('DT tối thiểu')})*${TS}!$B$9,0)))`, x.thuongDoanhSo),
      x.thuongDvk || 0,
      x.thuongHoaHong || 0,   // hoa hồng giới thiệu (sql/39) — chi tiết ở sheet "Hoa hong GT"
      x.soLanViPham || 0, ct(`MAX(0,100-${TS}!$B$10*N(${L('Số lần vi phạm')}))`, x.pctTacPhong ?? 100),
      ct(`IFERROR(VLOOKUP(${L('Phòng')},${KP}!$A$4:$E$60,5,FALSE),"")`, x.diemKpiPhong ?? ''), ct(fThuongKpi(L('KPI phòng')), x.thuongPhong || 0),
      x.phuCap || null, x.dieuChinh || null, x.lyDoDieuChinh || null,
      ct(['Lương theo công', 'Thưởng KPI CV', 'Thưởng KPI nợ', 'Thưởng doanh số', 'Thưởng DVK', 'Hoa hồng GT', 'Thưởng phòng', 'Phụ cấp', 'Điều chỉnh (+/−)'].map(n => `N(${L(n)})`).join('+'), x.thuNhap),
      // Thuế TNCN: tham gia BHXH → lũy tiến sau giảm trừ; thử việc / học việc → 10% tổng thu nhập.
      // Tách đủ từng khoản giảm trừ (anh yêu cầu 22/10/2026) — người không BHXH thì các ô giảm trừ = 0.
      ct(`MAX(0,${L('Tổng thu nhập')})`, x.thueTncn?.thuNhapChiuThue || 0),
      x.soNguoiPhuThuoc || 0,
      ct(`IF(${L('Tham gia BHXH')}="Có",${TS}!$B$11,0)`, x.thueTncn?.giamTruBanThan || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có",${TS}!$B$12*N(${L('Người phụ thuộc')}),0)`, x.thueTncn?.giamTruPhuThuoc || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có",${L('BHXH 10,5%')},0)`, x.thueTncn?.giamTruBhxh || 0),
      ct(`MAX(0,${L('Thu nhập chịu thuế')}-${L('Giảm trừ bản thân')}-${L('Giảm trừ NPT')}-${L('Giảm trừ BHXH')})`, x.thueTncn?.thuNhapTinhThue || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có","Lũy tiến","Khấu trừ 10%")`, x.thamGiaBhxh ? 'Lũy tiến' : 'Khấu trừ 10%'),
      ct(`IF(${L('Tham gia BHXH')}="Có",IF(${L('Thu nhập tính thuế')}<=0,0,ROUND(${fLuyTien(L('Thu nhập tính thuế'))},0)),ROUND(${L('Thu nhập tính thuế')}*${TS}!$B$13,0))`, x.thueTncn?.thue || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có",ROUND(${L('Lương đóng BHXH')}*${TS}!$B$2,0),0)`, x.khauTru?.bhxh),
      ct(`IF(${L('Tham gia BHXH')}="Có",ROUND(${L('Lương đóng BHXH')}*${TS}!$B$3,0),0)`, x.khauTru?.kpcd),
      ct(`IF(${L('Tham gia BHXH')}="Có",${TS}!$B$4,0)`, x.khauTru?.doanPhi),
      ct(`${L('BHXH 10,5%')}+${L('KPCĐ 0,5%')}+${L('Đoàn phí')}+${L('Thuế TNCN')}`, (x.khauTru?.tong || 0) + (x.thueTncn?.thue || 0)),
      ct(`${L('Tổng thu nhập')}-${L('Tổng trừ (gồm thuế)')}`, x.thucLinh),
      // Công ty đóng (không trừ lương) — tỉ lệ ở Tham so B14:B17.
      ct(`IF(${L('Tham gia BHXH')}="Có",ROUND(${L('Lương đóng BHXH')}*${TS}!$B$14,0),0)`, x.congTyDong?.bhxh || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có",ROUND(${L('Lương đóng BHXH')}*${TS}!$B$15,0),0)`, x.congTyDong?.bhyt || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có",ROUND(${L('Lương đóng BHXH')}*${TS}!$B$16,0),0)`, x.congTyDong?.bhtn || 0),
      ct(`IF(${L('Tham gia BHXH')}="Có",ROUND(${L('Lương đóng BHXH')}*${TS}!$B$17,0),0)`, x.congTyDong?.kpcd || 0),
      ct(`${L('BHXH 10,5%')}+${L('Cty BHXH 17,5%')}+${L('Cty BHYT 3%')}+${L('Cty BHTN 1%')}`, (x.khauTru?.bhxh || 0) + (x.congTyDong?.nopBhxh || 0)),
      ct(`${L('Tổng thu nhập')}+${L('Cty BHXH 17,5%')}+${L('Cty BHYT 3%')}+${L('Cty BHTN 1%')}+${L('Cty KPCĐ 2%')}`, (x.thuNhap || 0) + (x.congTyDong?.tong || 0)),
      x.nganHang?.ten || '', x.nganHang?.stk || '', x.nganHang?.chu || '',
      (x.canhBao || []).join('; '),
    ]
    const row = ws.getRow(r)
    gt.forEach((v, k) => {
      const o = row.getCell(k + 1)
      o.value = v
      const kieu = COT[k][3]
      o.border = vien()
      o.font = { size: 10 }
      if (kieu === 'so') o.numFmt = SO
      if (kieu === 'pt') { o.numFmt = PT; o.alignment = { horizontal: 'center' } }
      if (kieu === 'nhap') { o.fill = to(MAU.vang); if (COT[k][0] !== 'Lý do điều chỉnh') o.numFmt = SO }
      else if (i % 2) o.fill = to('FFFAFAF9')
    })
    row.getCell(iCot('Họ tên') + 1).font = { size: 10, bold: true }
    row.getCell(iCot('Tổng thu nhập') + 1).font = { size: 10, bold: true }
    const tl = row.getCell(iCot('THỰC LĨNH') + 1)
    tl.font = { size: 11, bold: true, color: { argb: MAU.do } }
    tl.fill = to(MAU.doNhat)
    const cx = row.getCell(iCot('Cần xem') + 1)
    cx.font = { size: 9, color: { argb: 'FFB45309' } }
    cx.alignment = { wrapText: true, vertical: 'top' }
  })

  // Hàng tổng cộng
  const cuoi = dau + ds.length - 1, rTong = cuoi + 1
  const tong = ws.getRow(rTong)
  tong.getCell(iCot('Họ tên') + 1).value = 'TỔNG CỘNG (' + ds.length + ' người)'
  COT.forEach((c, k) => {
    const o = tong.getCell(k + 1)
    o.fill = to(MAU.den)
    o.font = { bold: true, color: { argb: MAU.trang }, size: 10 }
    o.border = vien(MAU.den)
    if (c[3] === 'so' || (c[3] === 'nhap' && c[0] !== 'Lý do điều chỉnh')) {
      if (['Lương cơ bản', 'Lương đóng BHXH', 'Công chuẩn', 'Ngày tính lương', 'DT tối thiểu', 'Người phụ thuộc'].includes(c[0])) return
      const col = ws.getColumn(k + 1).letter
      const tt = ds.reduce((a, _, i) => { const v = ws.getRow(dau + i).getCell(k + 1).value; return a + (typeof v === 'number' ? v : (v && typeof v.result === 'number' ? v.result : 0)) }, 0)
      o.value = { formula: `SUM(${col}${dau}:${col}${cuoi})`, result: tt }
      o.numFmt = SO
    }
  })
  tong.height = 20
  const tlTong = tong.getCell(iCot('THỰC LĨNH') + 1)
  tlTong.fill = to(MAU.do)

  // ── Tổng hợp nộp BHXH tháng (anh yêu cầu 23/10/2026) — công thức trỏ về sheet bảng lương ──
  const wbh = wb.addWorksheet('Tong hop BHXH')
  wbh.getColumn(1).width = 44; wbh.getColumn(2).width = 18; wbh.getColumn(3).width = 52
  const cotL = ten => "'" + ws.name + "'!" + ws.getColumn(iCot(ten) + 1).letter + dau + ':' + ws.getColumn(iCot(ten) + 1).letter + cuoi
  const cong = f => ds.reduce((a, x) => a + (f(x) || 0), 0)
  const coBh = ds.filter(x => x.thamGiaBhxh)
  const DONG_BH = [
    ['Số người tham gia BHXH', `COUNTIF(${cotL('Tham gia BHXH')},"Có")`, coBh.length, ''],
    ['Tổng lương đóng BHXH', `SUMIF(${cotL('Tham gia BHXH')},"Có",${cotL('Lương đóng BHXH')})`, coBh.reduce((a, x) => a + (Number(x.luongBhxh) || 0), 0), 'Quỹ lương làm căn cứ đóng'],
    ['Người lao động đóng 10,5% (trừ lương)', `SUM(${cotL('BHXH 10,5%')})`, cong(x => x.khauTru?.bhxh), 'BHXH 8% + BHYT 1,5% + BHTN 1%'],
    ['Công ty đóng BHXH 17,5%', `SUM(${cotL('Cty BHXH 17,5%')})`, cong(x => x.congTyDong?.bhxh), 'Hưu trí 14% + ốm đau thai sản 3% + TNLĐ-BNN 0,5%'],
    ['Công ty đóng BHYT 3%', `SUM(${cotL('Cty BHYT 3%')})`, cong(x => x.congTyDong?.bhyt), ''],
    ['Công ty đóng BHTN 1%', `SUM(${cotL('Cty BHTN 1%')})`, cong(x => x.congTyDong?.bhtn), ''],
    ['TỔNG NỘP CƠ QUAN BHXH (32%)', `SUM(${cotL('Tổng nộp BHXH (NLĐ + Cty)')})`, cong(x => (x.khauTru?.bhxh || 0) + (x.congTyDong?.nopBhxh || 0)), 'Số chuyển cho cơ quan BHXH tháng này'],
    ['Kinh phí công đoàn — người lao động 0,5%', `SUM(${cotL('KPCĐ 0,5%')})`, cong(x => x.khauTru?.kpcd), ''],
    ['Kinh phí công đoàn — công ty 2%', `SUM(${cotL('Cty KPCĐ 2%')})`, cong(x => x.congTyDong?.kpcd), ''],
    ['Phí Đoàn Thanh niên', `SUM(${cotL('Đoàn phí')})`, cong(x => x.khauTru?.doanPhi), ''],
    ['TỔNG CHI PHÍ LƯƠNG CÔNG TY', `SUM(${cotL('Chi phí lương Cty')})`, cong(x => (x.thuNhap || 0) + (x.congTyDong?.tong || 0)), 'Tổng thu nhập + phần công ty đóng'],
  ]
  tieuDeSheet(wbh, 3, 'TỔNG HỢP NỘP BHXH — LƯƠNG THÁNG ' + ky, trangThai)
  ;['Khoản', 'Số tiền', 'Ghi chú'].forEach((t, k) => { const o = wbh.getCell(4, k + 1); o.value = t; o.fill = to(MAU.den); o.font = { bold: true, color: { argb: MAU.trang } }; o.border = vien() })
  DONG_BH.forEach(([nhan, f, kq, chu], k) => {
    const row = wbh.getRow(5 + k)
    row.getCell(1).value = nhan; row.getCell(2).value = { formula: f, result: kq }; row.getCell(3).value = chu
    for (let c = 1; c <= 3; c++) { row.getCell(c).border = vien(); row.getCell(c).font = { size: 11 } }
    row.getCell(2).numFmt = k === 0 ? '0' : SO
    if (/^TỔNG/.test(nhan)) for (let c = 1; c <= 3; c++) { row.getCell(c).font = { bold: true, size: 11, color: { argb: MAU.do } }; row.getCell(c).fill = to(MAU.doNhat) }
  })

  // Tô màu % theo mốc thưởng: dưới 80 đỏ, 80–90 vàng, trên 90 xanh.
  for (const ten of ['% CV', '% Nợ', 'KPI phòng']) {
    const col = ws.getColumn(iCot(ten) + 1).letter
    ws.addConditionalFormatting({
      ref: `${col}${dau}:${col}${cuoi}`,
      rules: [
        { type: 'cellIs', operator: 'lessThan', formulae: [String(THUONG_KPI.duoi)], priority: 1, style: { font: { color: { argb: 'FFDC2626' }, bold: true } } },
        { type: 'cellIs', operator: 'between', formulae: [String(THUONG_KPI.duoi), String(THUONG_KPI.tren)], priority: 2, style: { font: { color: { argb: 'FFB45309' }, bold: true } } },
        { type: 'cellIs', operator: 'greaterThan', formulae: [String(THUONG_KPI.tren)], priority: 3, style: { font: { color: { argb: 'FF047857' }, bold: true } } },
      ],
    })
  }

  // ── KPI phòng ──────────────────────────────────────────────────────────
  const COT_P = [['Phòng', 16, 'PHÒNG', 'chu'], ['% công việc T' + d.kyViec.thang, 14, 'KPI TỪ APP', 'pt'], ['% công nợ T' + d.kyNo.thang, 14, 'KPI TỪ APP', 'pt'],
    ['% tác phong', 14, 'KPI TỪ APP', 'pt'], ['Điểm KPI phòng', 14, 'KẾT QUẢ', 'pt'], ['Thưởng phòng / người', 18, 'KẾT QUẢ', 'so']]
  Object.assign(MAU_NHOM, { 'PHÒNG': MAU.den, 'KPI TỪ APP': 'FF047857', 'KẾT QUẢ': MAU.do })
  const wp = wb.addWorksheet('KPI phong', { views: [{ state: 'frozen', ySplit: 4 }] })
  COT_P.forEach((c, k) => { wp.getColumn(k + 1).width = c[1] })
  tieuDeSheet(wp, COT_P.length, 'KPI PHÒNG — LƯƠNG THÁNG ' + ky, '% tác phong = trung bình % tác phong của mọi người trong phòng (100 − 20 × số lần vi phạm, ở sheet bảng lương). Điểm KPI phòng = trung bình 3 tiêu chí; mỗi người trong phòng nhận đủ mức thưởng.')
  tieuDeHaiTang(wp, 3, 4, COT_P)
  d.phong.forEach((p, i) => {
    const r = 5 + i
    const row = wp.getRow(r)
    const cP = "'" + ws.name + "'!$" + ws.getColumn(iCot('Phòng') + 1).letter + ':$' + ws.getColumn(iCot('Phòng') + 1).letter
    const cT = "'" + ws.name + "'!$" + ws.getColumn(iCot('% tác phong') + 1).letter + ':$' + ws.getColumn(iCot('% tác phong') + 1).letter
    const v = [p.ten, p.pctViec, p.pctNo,
      { formula: `IFERROR(ROUND(AVERAGEIF(${cP},A${r},${cT}),0),"")`, result: p.pctTacPhong ?? '' },
      { formula: `IF(OR(B${r}="",C${r}="",D${r}=""),"",ROUND(AVERAGE(B${r}:D${r}),0))`, result: p.diem ?? '' },
      { formula: fThuongKpi('E' + r), result: p.thuongMoiNguoi || 0 }]
    v.forEach((x, k) => {
      const o = row.getCell(k + 1)
      o.value = x
      o.border = vien()
      if (COT_P[k][3] === 'pt') { o.numFmt = PT; o.alignment = { horizontal: 'center' } }
      if (COT_P[k][3] === 'so') o.numFmt = SO
      if (COT_P[k][3] === 'nhap') { o.fill = to(MAU.vang); o.numFmt = PT; o.alignment = { horizontal: 'center' } }
    })
    row.getCell(1).font = { bold: true }
    row.getCell(6).font = { bold: true, color: { argb: MAU.do } }
  })

  // ── Doanh thu chi tiết ────────────────────────────────────────────────
  const COT_D = [['Nhân viên', 26, 'DOANH THU', 'chu'], ['Phòng', 12, 'DOANH THU', 'chu'], ['Mã KH', 14, 'DOANH THU', 'chu'], ['Công ty', 46, 'DOANH THU', 'chu'],
    ['Phí kỳ (gồm VAT)', 16, 'DOANH THU', 'so'], ['Đóng theo quý', 12, 'DOANH THU', 'chu'], ['Doanh thu tháng (chưa VAT)', 18, 'DOANH THU', 'so']]
  MAU_NHOM['DOANH THU'] = 'FF6D28D9'
  const wd = wb.addWorksheet('Doanh thu T' + d.kyDoanhThu.thang, { views: [{ state: 'frozen', ySplit: 4 }] })
  COT_D.forEach((c, k) => { wd.getColumn(k + 1).width = c[1] })
  tieuDeSheet(wd, COT_D.length, 'DOANH THU THỰC TẾ T' + d.kyDoanhThu.thang + '/' + d.kyDoanhThu.nam + ' — TỪNG CÔNG TY', 'Phí kế toán phải thu của công ty mình phụ trách chính, tách VAT 8%, công ty đóng theo quý chia 3.')
  tieuDeHaiTang(wd, 3, 4, COT_D)
  wd.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COT_D.length } }
  let rd = 5
  for (const x of ds) for (const c of x.congTyDoanhThu || []) {
    const row = wd.getRow(rd++)
    ;[x.ten, x.phong, c.ma || '', c.ten, c.phiKy, c.quy ? 'Có (÷3)' : '', c.doanhThu].forEach((v, k) => {
      const o = row.getCell(k + 1); o.value = v; o.border = vien(); o.font = { size: 10 }
      if (COT_D[k][3] === 'so') o.numFmt = SO
    })
  }

  // ── Thưởng DVK đã duyệt ────────────────────────────────────────────────
  const COT_K = [['Nhân viên', 26, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'chu'], ['Phòng', 12, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'chu'], ['Hồ sơ', 50, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'chu'],
    ['Số tiền thực nhận', 16, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'so'], ['Tỉ lệ %', 8, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'chu'], ['Thưởng', 14, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'so'],
    ['Ngoài app', 10, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'chu'], ['Ghi chú', 40, 'THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT', 'chu']]
  MAU_NHOM['THƯỞNG DỊCH VỤ KHÁC ĐÃ DUYỆT'] = 'FFC2410C'
  const wk = wb.addWorksheet('Thuong DVK', { views: [{ state: 'frozen', ySplit: 4 }] })
  COT_K.forEach((c, k) => { wk.getColumn(k + 1).width = c[1] })
  tieuDeSheet(wk, COT_K.length, 'THƯỞNG DỊCH VỤ KHÁC — KỲ LƯƠNG ' + ky, 'Chỉ các dòng trưởng phòng đã duyệt. "Ngoài app" = dịch vụ chưa nhập vào app, kiểm theo ghi chú.')
  tieuDeHaiTang(wk, 3, 4, COT_K)
  let rk = 5
  for (const x of ds) for (const k of x.dvkDong || []) {
    const row = wk.getRow(rk++)
    ;[x.ten, x.phong, k.ten, k.soTien, k.tyLe + '%', k.thuong, k.ngoaiApp ? 'Có' : '', k.ghiChu].forEach((v, j) => {
      const o = row.getCell(j + 1); o.value = v; o.border = vien(); o.font = { size: 10 }
      if (COT_K[j][3] === 'so') o.numFmt = SO
      if (j === 6 && v) o.fill = to(MAU.vang)
    })
  }

  // ── Hoa hồng giới thiệu chi tiết (sql/39) ─────────────────────────────
  const COT_H = [['Người giới thiệu', 24, 'HOA HỒNG GIỚI THIỆU', 'chu'], ['Phòng', 12, 'HOA HỒNG GIỚI THIỆU', 'chu'], ['Mã KH', 12, 'HOA HỒNG GIỚI THIỆU', 'chu'],
    ['Công ty', 40, 'HOA HỒNG GIỚI THIỆU', 'chu'], ['Nguồn tiền', 13, 'HOA HỒNG GIỚI THIỆU', 'chu'], ['Kỳ', 9, 'HOA HỒNG GIỚI THIỆU', 'chu'],
    ['Khách trả thêm (gồm VAT)', 16, 'HOA HỒNG GIỚI THIỆU', 'so'], ['Chưa VAT', 14, 'HOA HỒNG GIỚI THIỆU', 'so'], ['Tỉ lệ %', 8, 'HOA HỒNG GIỚI THIỆU', 'chu'], ['Hoa hồng', 13, 'HOA HỒNG GIỚI THIỆU', 'so']]
  MAU_NHOM['HOA HỒNG GIỚI THIỆU'] = 'FF047857'
  const wg = wb.addWorksheet('Hoa hong GT', { views: [{ state: 'frozen', ySplit: 4 }] })
  COT_H.forEach((c, k) => { wg.getColumn(k + 1).width = c[1] })
  tieuDeSheet(wg, COT_H.length, 'HOA HỒNG GIỚI THIỆU — KỲ LƯƠNG ' + ky, 'Phần khách trả THÊM kể từ lần chốt lương trước (phí kế toán, HCNS, dịch vụ khác, thu nợ tồn) × % theo bậc số công ty đang dùng dịch vụ. Chưa VAT = ÷ 1,08.')
  tieuDeHaiTang(wg, 3, 4, COT_H)
  const TEN_NGUON = { ketoan: 'Phí kế toán', hcns: 'Phí HCNS', khach: 'Thu khác', dvk: 'Dịch vụ khác', no_ton: 'Thu nợ tồn' }
  let rg = 5
  for (const x of ds) for (const c of x.hoaHongGt?.chiTiet || []) {
    const row = wg.getRow(rg++)
    ;[x.ten, x.phong, c.ma || '', c.ten, TEN_NGUON[c.nguon] || c.nguon, String(c.kyThang || '').split('-').reverse().join('/'), c.so_tien, Math.round(c.so_tien / 1.08), c.ty_le + '%', c.hoa_hong].forEach((v, k) => {
      const o = row.getCell(k + 1); o.value = v; o.border = vien(); o.font = { size: 10 }
      if (COT_H[k][3] === 'so') o.numFmt = SO
    })
  }
  if (rg === 5) wg.getCell(5, 1).value = 'Kỳ này không có hoa hồng giới thiệu.'

  // ── Tham số (công thức các sheet trỏ vào cột B ở đây) ─────────────────
  const wt = wb.addWorksheet('Tham so')
  wt.getColumn(1).width = 32; wt.getColumn(2).width = 14; wt.getColumn(3).width = 70
  const tham = [
    ['Tham số', 'Giá trị', 'Ghi chú'],
    ['BHXH (gồm BHYT, BHTN)', KHAU_TRU.bhxh, '× lương đóng BHXH, chỉ người tham gia BHXH'],
    ['Kinh phí công đoàn', KHAU_TRU.kpcd, '× lương đóng BHXH'],
    ['Phí Đoàn Thanh niên', KHAU_TRU.doanPhi, 'đồng/người'],
    ['Mốc KPI thấp (%)', THUONG_KPI.duoi, 'dưới mốc này không thưởng'],
    ['Mốc KPI cao (%)', THUONG_KPI.tren, 'trên mốc này được mức cao'],
    ['Mức thưởng giữa', THUONG_KPI.mucGiua, 'từ mốc thấp tới mốc cao'],
    ['Mức thưởng cao', THUONG_KPI.mucCao, 'trên mốc cao'],
    ['Tỉ lệ thưởng vượt doanh số', TY_LE_VUOT_DOANH_SO, 'nhân viên: × phần vượt tối thiểu; trưởng phòng: × doanh thu công ty tự làm'],
    ['Trừ mỗi lần vi phạm tác phong (%)', MUC_TRU_TAC_PHONG, '% tác phong của người = 100 − mức này × số lần vi phạm (thấp nhất 0)'],
    ['Giảm trừ bản thân (TNCN)', GIAM_TRU.banThan, 'đồng/tháng — chỉ người tham gia BHXH (biểu lũy tiến)'],
    ['Giảm trừ mỗi người phụ thuộc', GIAM_TRU.nguoiPhuThuoc, 'đồng/người/tháng'],
    ['Khấu trừ TNCN thử việc / học việc', TY_LE_KHAU_TRU_KHONG_BHXH, '× tổng thu nhập, người không tham gia BHXH. Biểu lũy tiến 5 bậc nằm trong công thức cột Thuế TNCN'],
    ['Công ty đóng BHXH', CONG_TY_DONG.bhxh, '× lương đóng BHXH (hưu trí 14% + ốm đau thai sản 3% + tai nạn LĐ-BNN 0,5%)'],
    ['Công ty đóng BHYT', CONG_TY_DONG.bhyt, '× lương đóng BHXH'],
    ['Công ty đóng BHTN', CONG_TY_DONG.bhtn, '× lương đóng BHXH'],
    ['Công ty đóng KPCĐ', CONG_TY_DONG.kpcd, '× lương đóng BHXH (nộp công đoàn, không nộp cơ quan BHXH)'],
    [],
    ['Kỳ lương', ky, kySoLieu],
    ['Trạng thái', '', trangThai],
  ]
  tham.forEach((h, i) => {
    const row = wt.getRow(i + 1)
    h.forEach((v, k) => {
      const o = row.getCell(k + 1)
      o.value = v
      if (i === 0) { o.fill = to(MAU.do); o.font = { bold: true, color: { argb: MAU.trang } } }
      else if (i >= 1 && i <= 16) { o.border = vien(); if (k === 1) { o.fill = to(MAU.vang); o.font = { bold: true }; o.numFmt = v < 1 ? '0.0%' : SO } }
    })
  })

  return wb
}

export async function xuatExcelBangLuong(d) {
  const wb = await taoWorkbookBangLuong(d)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'BangLuong_T' + d.thang + '-' + d.nam + (d.daChot ? '_da_chot' : '_tam') + '.xlsx'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
