// Phần dùng chung của màn Soát xét báo cáo năm: gom kết quả bộ máy (lib/soatbaocao) về 9 nhóm như mockup, tỷ lệ, xuất Excel.
// CHƯA CHẤM ĐIỂM (anh chốt 25/10/2026): không hiện điểm tin cậy, điểm sức khỏe, Z-score, xếp loại chỉ số; chỉ số liệu + chênh lệch.

export const NHOM = [
  { ma: 'cd', ten: 'Cân đối BCTC', mo: 'BCĐKT, KQKD, LCTT khớp nhau', mau: '#8B1A1A', cat: ['cd'] },
  { ma: 'tb', ten: 'Cân đối phát sinh', mo: 'BCTC ↔ bảng cân đối tài khoản', mau: '#2563EB', cat: ['tb'] },
  { ma: 'so', ten: 'Sổ sách, chứng từ', mo: 'Nhật ký chung, sổ chi tiết, công nợ, kho', mau: '#D97706', cat: ['so'] },
  { ma: 'nh', ten: 'Tiền, ngân hàng', mo: 'Sổ phụ ↔ sổ tiền gửi, quỹ tiền mặt', mau: '#0891B2', cat: ['nh'] },
  { ma: 'thue', ten: 'Thuế GTGT', mo: 'Tờ khai ↔ hóa đơn ↔ sổ 1331 / 33311', mau: '#7C3AED', cat: ['thue'] },
  { ma: 'tndn', ten: 'Thuế TNDN', mo: 'Quyết toán ↔ KQKD, chi phí không được trừ', mau: '#059669', cat: ['tndn'] },
  { ma: 'tncn', ten: 'TNCN, bảo hiểm', mo: 'Bảng lương ↔ 334 ↔ 05/KK ↔ C12', mau: '#DB2777', cat: ['tncn'] },
  { ma: 'dc', ten: 'Đối chiếu chéo, liên kết năm', mo: 'Liên kết các phần hệ và năm trước', mau: '#475569', cat: ['dc', 'lk'] },
  { ma: 'tc', ten: 'Tài chính, doanh thu', mo: 'Lỗ liên tiếp, biến động doanh thu, đặc thù ngành', mau: '#B8860B', cat: ['tc', 'dt'] },
]
export const NHOM_THEO_MA = Object.fromEntries(NHOM.map(n => [n.ma, n]))

// Nhóm của một phép đối chiếu theo tên nhóm bộ máy đặt
export function nhomDoiChieu(grp) {
  const g = String(grp || '')
  if (/cân đối phát sinh/i.test(g)) return 'tb'
  if (/tiền mặt|tiền gửi|ngân hàng|sao kê/i.test(g)) return 'nh'
  if (/công nợ|tồn kho|giá thành|sổ /i.test(g) && !/tờ khai/i.test(g)) return 'so'
  if (/GTGT/i.test(g)) return 'thue'
  if (/TNCN|lương, bảo hiểm/i.test(g)) return 'tncn'
  if (/TNDN/i.test(g)) return 'tndn'
  return 'dc'
}
export const nhomPhatHien = cat => (NHOM.find(n => n.cat.includes(cat)) || {}).ma || null   // 'cs' (chính sách theo thời kỳ) → null

// |a − b| ÷ số lớn hơn
export function tyLe(a, b, d) {
  if (typeof a !== 'number' || typeof b !== 'number') return null
  const c = Math.abs(typeof d === 'number' ? d : a - b)
  if (c < 1) return 0
  const g = Math.max(Math.abs(a), Math.abs(b))
  return g ? c / g : null
}

// Gom kết quả một năm: { phep: [{ nhom, loai:'can_doi'|'doi_chieu', ten, a, b, la, lb, d, st, tl, ma }], phatHien: [{ nhom, ...Rk }], chinhSach: [...] }
export function gomKetQua(C) {
  const phep = []
  for (const c of C.C || []) if (c.st !== 'na') phep.push({ nhom: 'cd', loai: 'can_doi', ten: c.n, a: c.L, b: c.R, la: c.ls, lb: c.rs, d: c.diff, st: c.st, tl: tyLe(c.L, c.R, c.diff), ma: c.id, ky: c.s === 'P' ? 'đầu năm' : '' })
  for (const r of C.RC || []) phep.push({ nhom: nhomDoiChieu(r.grp), loai: 'doi_chieu', nhomGoc: r.grp, ten: r.n, a: r.a, b: r.b, la: r.la, lb: r.lb, d: r.d, st: r.st, tl: tyLe(r.a, r.b, r.d), ma: r.code })
  const phatHien = (C.Rk || []).filter(r => nhomPhatHien(r.cat)).map(r => ({ ...r, nhom: nhomPhatHien(r.cat) }))
  const chinhSach = (C.Rk || []).filter(r => !nhomPhatHien(r.cat))
  return { phep, phatHien, chinhSach }
}
export const coChenh = p => p.st === 'fail'

const soChu = v => (typeof v === 'number' ? v : v == null ? '' : String(v))
const ptChu = t => (t == null ? '' : (t * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%')
const ST = { ok: 'Khớp', fail: 'Có chênh lệch', round: 'Lệch làm tròn', na: 'Không đủ số liệu' }

export async function xuatExcelSoatNam({ cty, nam, gom, C, file }) {
  const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
  const wb = await soExcelMoi()
  const moTa = `${cty.ten} · MST ${cty.mst || '—'} · xuất ${new Date().toLocaleString('vi-VN')} · Chưa chấm điểm, chưa xếp loại — chỉ số liệu và chênh lệch`
  const nhomTen = m => NHOM_THEO_MA[m]?.ten || m
  themSheetMang(wb, `Đối chiếu ${nam}`, [
    [`SOÁT XÉT BÁO CÁO NĂM ${nam} — ${cty.ten}`], [moTa],
    ['Nhóm', 'Phép kiểm', 'Số 1', 'Nguồn số 1', 'Số 2', 'Nguồn số 2', 'Chênh lệch', 'Tỷ lệ', 'Kết quả'],
    ...[...gom.phep].sort((x, y) => NHOM.findIndex(n => n.ma === x.nhom) - NHOM.findIndex(n => n.ma === y.nhom) || (coChenh(y) - coChenh(x))).map(p => [nhomTen(p.nhom), p.ten + (p.ky ? ` (${p.ky})` : ''), soChu(p.a), p.la || '', soChu(p.b), p.lb || '', soChu(p.d), ptChu(p.tl), ST[p.st] || p.st]),
  ], { doRong: [24, 56, 18, 22, 18, 22, 16, 10, 16], cotTien: [2, 4, 6] })
  const dongPH = []
  for (const r of gom.phatHien) {
    dongPH.push([nhomTen(r.nhom), r.code || '', r.t, r.d || '', r.kn || '', r.cb || '', '', '', '', ''])
    for (const i of (r.items || []).slice(0, 200)) dongPH.push(['', '', '', '', '', '', i.d || '', i.so || '', i.dg || '', soChu(i.amt)])
  }
  themSheetMang(wb, 'Phát hiện', [
    [`PHÁT HIỆN NĂM ${nam} — ${cty.ten}`], ['Mỗi phát hiện kèm danh sách chứng từ / hóa đơn liên quan (tối đa 200 dòng mỗi phát hiện)'],
    ['Nhóm', 'Mã', 'Phát hiện', 'Chi tiết', 'Hướng xử lý', 'Căn cứ', 'Ngày', 'Số chứng từ', 'Diễn giải', 'Số tiền'],
    ...dongPH,
  ], { doRong: [22, 18, 50, 50, 50, 36, 12, 14, 46, 16], cotTien: [9] })
  themSheetMang(wb, 'Chỉ số tài chính', [
    [`CHỈ SỐ TÀI CHÍNH NĂM ${nam} — ${cty.ten}`], ['Chỉ hiện giá trị, chưa so ngưỡng ngành'],
    ['Mã', 'Chỉ số', 'Đơn vị', `Năm ${nam}`, `Năm ${nam - 1}`, 'Công thức', 'Ghi chú'],
    ...(C.Rt || []).map(r => [r.id, r.n, r.u || '', r.t == null ? '' : Math.round(r.t * 100) / 100, r.p == null ? '' : Math.round(r.p * 100) / 100, r.xf || '', r.na || '']),
    ...(C.K || []).map(k => ['', k.n, k.u || '', k.x == null ? '' : Math.round(k.x * 100) / 100, '', k.m || '', 'Đặc thù ngành']),
  ], { doRong: [8, 46, 8, 16, 16, 50, 30] })
  themSheetMang(wb, 'File đã đọc', [
    ['FILE APP ĐỌC ĐƯỢC TRONG THƯ MỤC'], [cty.ten + ' · năm theo nội dung file'],
    ['Năm', 'Loại', 'File', 'Nội dung đọc được', 'Thư mục'],
    ...[...file].sort((a, b) => b.nam - a.nam).map(f => [f.nam, f.kind, f.ten, f.note || '', (f.duongDan || []).join('\\')]),
  ], { doRong: [8, 10, 46, 50, 70] })
  await taiVeExcel(wb, `SoatXet_${cty.maKH || cty.mst || 'cty'}_${nam}.xlsx`)
}
