// Xuất Excel CÓ ĐỊNH DẠNG cho mọi báo cáo của app (anh yêu cầu đồng bộ 18/10/2026, sau khi đổi bảng
// lương sang exceljs). Các trang vẫn dựng dữ liệu bằng MẢNG HÀNG như trước (mỗi hàng là một mảng ô);
// hàm này tự nhận ra đâu là tiêu đề, hàng tên cột, dòng tổng, rồi tô màu / kẻ khung / định dạng số.
//
//   const wb = await soExcelMoi()
//   themSheetMang(wb, 'Tổng hợp', hang, { doRong: [...], cotTien: [2, 3], cotPhanTram: [5] })
//   await taiVeExcel(wb, 'BaoCao.xlsx')
//
// Quy ước nhận dạng (khớp cách các trang đang dựng):
//   - hàng chỉ có MỘT ô chữ ở cột đầu: hàng 0 là tiêu đề lớn; trước bảng đầu tiên là dòng mô tả;
//     sau đó là nhãn mục ("A. …", "B. …") hoặc ghi chú.
//   - hàng có từ 3 ô trở lên và TOÀN LÀ CHỮ: hàng tên cột.
//   - hàng có ô chữ bắt đầu bằng "TỔNG", "Tổng " hoặc "KPI PHÒNG": dòng tổng.
// Thư viện exceljs nặng nên chỉ nạp khi bấm nút xuất.

const DO = 'FF8B1A1A', TRANG = 'FFFFFFFF', XAM = 'FFF5F5F4', VIEN = 'FFD6D3D1', DEN = 'FF1F2937'
const to = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const vien = (m = VIEN) => ({ top: { style: 'thin', color: { argb: m } }, left: { style: 'thin', color: { argb: m } }, bottom: { style: 'thin', color: { argb: m } }, right: { style: 'thin', color: { argb: m } } })
const SO = '#,##0;[Red]-#,##0;"-"'

export async function soExcelMoi() {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Savitax — Hệ thống nội bộ'
  wb.created = new Date()
  return wb
}

const rong = v => v === null || v === undefined || v === ''
const oCo = h => (h || []).filter(v => !rong(v))
const laTieuDeCot = h => oCo(h).length >= 3 && oCo(h).every(v => typeof v === 'string')
const laDongTong = h => (h || []).some(v => typeof v === 'string' && /^(TỔNG|Tổng |KPI PHÒNG)/.test(v.trim()))
const laMotO = h => oCo(h).length === 1 && typeof h[0] === 'string' && !rong(h[0])

// Tên sheet Excel: tối đa 31 ký tự, không có : \ / ? * [ ]
const tenHopLe = t => String(t).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Sheet'

export function themSheetMang(wb, ten, hang, opts = {}) {
  const { doRong = [], cotTien = [], cotPhanTram = [], cotPhanTramSo = [], coDinh = true } = opts
  const soCot = Math.max(1, doRong.length, ...hang.map(h => (h || []).length))
  const iTieuDe = hang.findIndex(laTieuDeCot)
  const nhieuBang = hang.filter(laTieuDeCot).length > 1
  const ws = wb.addWorksheet(tenHopLe(ten), {
    views: coDinh && iTieuDe >= 0 && !nhieuBang ? [{ state: 'frozen', ySplit: iTieuDe + 1 }] : [{}],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  })
  doRong.forEach((w, k) => { ws.getColumn(k + 1).width = w })

  let daGapBang = false, soDongBang = 0
  hang.forEach((h, r) => {
    const row = ws.getRow(r + 1)
    h = h || []
    if (!h.length || !oCo(h).length) return

    if (laMotO(h)) {
      const o = row.getCell(1)
      o.value = h[0]
      if (soCot > 1) ws.mergeCells(r + 1, 1, r + 1, soCot)
      if (/^[A-Z]\.\s/.test(h[0])) { o.font = { bold: true, size: 12, color: { argb: DO } }; row.height = 20 }
      else if (r === 0) { o.font = { bold: true, size: 15, color: { argb: DO } }; row.height = 26 }
      else if (!daGapBang) { o.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }; o.alignment = { wrapText: true, vertical: 'top' }; row.height = String(h[0]).length > 150 ? 30 : 16 }
      else { o.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } } }
      return
    }

    if (laTieuDeCot(h)) {
      daGapBang = true; soDongBang = 0
      for (let k = 0; k < soCot; k++) {
        const o = row.getCell(k + 1)
        o.value = rong(h[k]) ? '' : h[k]
        o.fill = to(DO)
        o.font = { bold: true, size: 10, color: { argb: TRANG } }
        o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        o.border = vien(DO)
      }
      row.height = 32
      if (r === iTieuDe && !nhieuBang) ws.autoFilter = { from: { row: r + 1, column: 1 }, to: { row: r + 1, column: soCot } }
      return
    }

    const tong = laDongTong(h)
    soDongBang++
    for (let k = 0; k < soCot; k++) {
      const v = h[k]
      const o = row.getCell(k + 1)
      o.value = rong(v) ? null : v
      o.border = vien()
      o.font = { size: 10, bold: tong }
      if (typeof v === 'number') {
        if (cotPhanTram.includes(k)) o.numFmt = '0%'
        else if (cotPhanTramSo.includes(k)) o.numFmt = '0"%"'
        else if (cotTien.includes(k) || Math.abs(v) >= 1000) o.numFmt = SO
      }
      if (tong) { o.fill = to('FFE7E5E4'); o.border = { ...vien(), top: { style: 'medium', color: { argb: DEN } } } }
      else if (soDongBang % 2 === 0) o.fill = to('FFFAFAF9')
    }
  })
  return ws
}

// Tải file về máy (chạy trên trình duyệt).
export async function taiVeExcel(wb, tenFile) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = tenFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
