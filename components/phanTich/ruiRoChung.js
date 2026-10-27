// Phần dùng chung của màn Rủi ro thuế: cách tính tỷ lệ, phân nhóm, xuất Excel (exceljs qua lib/excelDep.js).
// Chỉ số liệu + tỷ lệ — KHÔNG xuất mức đánh giá / điểm / thuế ảnh hưởng (anh chốt 25/10/2026).

export const NHOM = { GTGT: 'GTGT', TNDN: 'TNDN', BCTC: 'BCTC', LCTT: 'LCTT', 'Khác': 'Khác' }
export const nhomCua = r => (NHOM[r.group] ? r.group : 'Khác')
export const laDoiChieu = r => r.type === 'compare'

// |SL1 − SL2| ÷ số lớn hơn; khớp = 0; không đủ số = null
export function tyLe(r) {
  if (typeof r.sl1 !== 'number' || typeof r.sl2 !== 'number') return null
  const cl = Math.abs(typeof r.cl === 'number' ? r.cl : r.sl1 - r.sl2)
  if (cl <= 0.5) return 0
  const goc = Math.max(Math.abs(r.sl1), Math.abs(r.sl2))
  return goc ? cl / goc : null
}

const ptChu = t => (t == null ? '' : (t * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%')
const soHoacChu = v => (typeof v === 'number' ? v : v == null ? '' : String(v))
const trangThaiChu = r => (r.level === 'missing' ? 'Thiếu dữ liệu: ' + (r.missingDocs || []).join('; ') : r.level === 'na' ? 'Không áp dụng' : '')
const nguonChu = r => [...new Set((r.refs || []).flatMap(x => [...(x.src?.files || []), x.src?.file].filter(Boolean)))].slice(0, 6).join(', ')

export async function xuatExcelRuiRo({ cty, rr, R39 }) {
  const { danhGia, namSoat, tuTim, suaNam, hoSo, nhieuNam } = rr
  const { ev, evTruoc } = danhGia
  const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
  const wb = await soExcelMoi()
  const moTa = `${cty.ten} · MST ${cty.mst || hoSo.client.mst || '—'} · xuất ${new Date().toLocaleString('vi-VN')} · Chưa chấm điểm, chưa xếp loại — chỉ số liệu, chênh lệch và tỷ lệ`
  const coSo = r => r.level !== 'missing' && r.level !== 'na'
  const ma = r => R39.CODES(r.guide).join(' ')

  const A = ev.results.filter(laDoiChieu).sort((a, b) => (coSo(b) - coSo(a)) || ((tyLe(b) ?? -1) - (tyLe(a) ?? -1)))
  const truoc = Object.fromEntries((evTruoc?.results || []).map(r => [r.id, r]))
  const B = ev.results.filter(r => !laDoiChieu(r))
  themSheetMang(wb, `39 tiêu chí ${namSoat}`, [
    [`RỦI RO THUẾ NĂM ${namSoat} — ${cty.ten}`], [moTa],
    [`A. ${A.length} tiêu chí đối chiếu · sắp theo tỷ lệ chênh lệch`],
    ['Mã', 'Tiêu chí', 'Nhóm', 'Mã rủi ro', 'SL1', 'Diễn giải SL1', 'SL2', 'Diễn giải SL2', 'Chênh lệch SL1 − SL2', 'Tỷ lệ chênh lệch', 'Tình trạng', 'File nguồn'],
    ...A.map(r => [r.id, r.name, nhomCua(r), ma(r), coSo(r) ? soHoacChu(r.sl1) : '', r.sl1Label || '', coSo(r) ? soHoacChu(r.sl2) : '', r.sl2Label || '',
      coSo(r) ? soHoacChu(r.cl) : '', coSo(r) ? ptChu(tyLe(r)) : '', trangThaiChu(r), nguonChu(r)]),
    [],
    [`B. ${B.length} tiêu chí số dư · năm ${namSoat} so với năm ${namSoat - 1}`],
    ['Mã', 'Tiêu chí', 'Nhóm', 'Mã rủi ro', `Năm ${namSoat}`, 'Diễn giải', `Năm ${namSoat - 1}`, '', 'Tăng (giảm)', '% thay đổi', 'Tình trạng', 'File nguồn'],
    ...B.map(r => {
      const t = truoc[r.id], a = typeof r.sl1 === 'number' ? r.sl1 : null, b = t && t.level !== 'missing' && typeof t.sl1 === 'number' ? t.sl1 : null
      const tang = a != null && b != null ? a - b : null
      return [r.id, r.name, nhomCua(r), ma(r), coSo(r) ? soHoacChu(r.sl1) : '', r.sl1Label || '', b ?? '', '', tang ?? '',
        tang == null ? '' : b ? ptChu(tang / Math.abs(b)) : a ? 'mới phát sinh' : '', trangThaiChu(r), nguonChu(r)]
    }),
  ], { doRong: [7, 52, 8, 12, 18, 34, 18, 34, 18, 12, 30, 50], cotTien: [4, 6, 8] })

  themSheetMang(wb, 'Thông tin bổ sung', [
    [`THÔNG TIN BỔ SUNG NĂM ${namSoat} — APP TỰ TÌM`], [cty.ten + ' · số sửa tạm trên màn hình (nếu có) ghi ở cột "Đang dùng"'],
    ['Thông tin', 'Tiêu chí', 'App tìm được', 'Đang dùng', 'Trạng thái', 'Nguồn', 'Ghi chú'],
    ...tuTim.bang.map(d => [d.ten, d.tieuChi, d.hienThi, suaNam[d.khoa] != null ? soHoacChu(suaNam[d.khoa]) : '', suaNam[d.khoa] != null ? 'Sửa tạm' : { tu_tim: 'Tự tìm', tam: 'Tạm — cần xác nhận', tu_dong: 'Bộ máy tự lấy', can_nhap: 'Chờ nhân viên' }[d.trangThai], d.nguon || '', d.ghiChu.join(' · ')]),
  ], { doRong: [36, 12, 24, 18, 20, 60, 70] })

  if (nhieuNam?.length > 1) {
    const cacNam = nhieuNam.map(x => x.nam)
    const lay = (n, id) => nhieuNam.find(x => x.nam === n).ev.results.find(r => r.id === id)
    const o = r => (!r || r.level === 'missing' ? 'thiếu dữ liệu' : r.level === 'na' ? 'không áp dụng' : laDoiChieu(r) ? soHoacChu(r.cl) : soHoacChu(r.sl1))
    themSheetMang(wb, 'Nhiều năm', [
      ['RỦI RO THUẾ QUA CÁC NĂM — ' + cty.ten], ['Đối chiếu: chênh lệch SL1 − SL2 (kèm tỷ lệ). Số dư: số của từng năm.'],
      ['Mã', 'Tiêu chí', 'Loại', ...cacNam.flatMap(n => [`Năm ${n}`, `Tỷ lệ ${n}`])],
      ...nhieuNam[nhieuNam.length - 1].ev.results.map(g => [g.id, g.name, laDoiChieu(g) ? 'Đối chiếu' : 'Số dư',
        ...cacNam.flatMap(n => { const r = lay(n, g.id); return [o(r), r && laDoiChieu(r) && r.level !== 'missing' && r.level !== 'na' ? ptChu(tyLe(r)) : ''] })]),
    ], { doRong: [7, 52, 10, ...cacNam.flatMap(() => [18, 10])] })
  }

  themSheetMang(wb, 'File đã đọc', [
    ['FILE APP ĐỌC ĐƯỢC TRONG THƯ MỤC'], [cty.ten + ' · năm theo nội dung file'],
    ['Năm', 'Loại', 'File', 'Thư mục'],
    ...[...hoSo.items].sort((a, b) => b.year - a.year || a.kind.localeCompare(b.kind)).map(i => [i.year, i.kind, i.ten, i.duongDan.join('\\')]),
  ], { doRong: [8, 10, 50, 90] })

  await taiVeExcel(wb, `RuiRoThue_${cty.maKH || cty.mst || 'cty'}_${namSoat}.xlsx`)
}
