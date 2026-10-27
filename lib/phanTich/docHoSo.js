// Đọc nội dung các file cần cho màn Hồ sơ dữ liệu — tờ khai trong "7. BỘ BÁO CÁO" của một năm: XML, và PDF có
// chữ khi KHÔNG có XML cùng tên bên cạnh (XML luôn đáng tin hơn).
//
// Chỉ ĐỌC (tay.getFile). Kết quả nhớ trong bộ nhớ đệm trên máy, khoá theo đường dẫn + cỡ + ngày sửa,
// nên lần mở sau không tải lại file chưa đổi. Truyền vào để node kiểm được không cần trình duyệt:
//   dem   = { khoa(tep, loai), lay(khoa), ghi(khoa, giaTri) }
//   docPdf = async (arrayBuffer) → kết quả docToKhaiPdfChu ({ ok, tk } | { khongPhai } | { scan } | { loi })
import { docToKhai } from './doc/toKhai.js'
import { docBangKe } from './doc/bangKe.js'
import { docBangLuong } from './doc/bangLuong.js'
import { docSaoKe, docToKhaiHaiQuan, soToKhaiTuTen } from './doc/saoKeHaiQuan.js'
import { docSaoKeTien, docSoTien } from './doc/soTien.js'
import { khoaGop, conHieuLuc } from './soatKy.js'

const tepBoBaoCao = quetNam => {
  const bbc = quetNam?.boBaoCao
  if (!bbc) return []
  // Giữ NGUYÊN đối tượng file (màn hình so theo đối tượng để gắn lỗi đọc vào đúng dòng) — vùng để riêng
  return [...bbc.ky.flatMap(k => Object.entries(k.vung || {}).flatMap(([vung, ds]) => ds.map(t => [t, vung, k.ky || null]))), ...(bbc.khongRo || []).map(t => [t, null, null])]
}
const thuMucVaTen = t => `${t.duongDan.join('\\')}\\${t.ten.replace(/\.[^.]+$/, '').toLowerCase()}`

// Mọi file .xml trong bộ báo cáo thuế theo kỳ + file để lẻ (bản xuất HTKK có khi nằm ở thư mục BẢNG KÊ).
export function tepToKhaiCuaNam(quetNam) {
  return tepBoBaoCao(quetNam).map(([t]) => t).filter(t => t && t.duoi === 'xml')
}

// PDF có thể là tờ khai: không nằm trong thư mục thông báo / bảng kê, và không có .xml cùng tên cùng thư mục.
export function tepPdfCuaNam(quetNam) {
  const ds = tepBoBaoCao(quetNam)
  const coXml = new Set(ds.filter(([t]) => t.duoi === 'xml').map(([t]) => thuMucVaTen(t)))
  return ds.filter(([t, vung]) => t.duoi === 'pdf' && !['thong_bao', 'bang_ke'].includes(vung) && !coXml.has(thuMucVaTen(t))).map(([t]) => t)
}

async function docMotTep(tep, loai, dem, doc) {
  const khoa = dem?.khoa(tep, loai)
  let kq = khoa ? await dem.lay(khoa) : undefined
  if (kq !== undefined) return { kq, tuDem: true }
  try { kq = await doc(await tep.tay.getFile()) } catch (e) { kq = { ok: false, loi: e?.message || String(e) } }
  if (khoa && !(kq.ok === false && kq.loi && !kq.scan)) await dem.ghi(khoa, kq)   // lỗi đọc thì lần sau thử lại
  return { kq, tuDem: false }
}

const docXml = async f => {
  const xml = await f.text()
  // File XML không phải tờ khai (hóa đơn, thông báo) → ghi nhận là "không phải tờ khai", không báo lỗi
  if (!/<HSoThueDTu\b/.test(xml)) return { ok: false, khongPhai: true }
  const tk = docToKhai(xml)
  // Hỏng giữa chừng thì bộ đọc vẫn trả về được nhưng trống loại / kỳ → coi là không đọc được
  return tk.loai && tk.ky ? { ok: true, tk } : { ok: false, loi: 'Không nhận ra loại tờ khai hoặc kỳ khai' }
}

// Trả { toKhai: [{...tk, tep, nguon}], loi: [{ tep, loi }], scan: [tep], tuDem }
export async function docToKhaiCuaNam(quetNam, { dem, tienDo, docPdf } = {}) {
  const dsXml = tepToKhaiCuaNam(quetNam)
  const dsPdf = docPdf ? tepPdfCuaNam(quetNam) : []
  const tong = dsXml.length + dsPdf.length
  const toKhai = [], loi = [], scan = []
  let tuDem = 0, xong = 0
  for (const [ds, loai, doc] of [[dsXml, 'tokhai', docXml], [dsPdf, 'tokhai-pdf', async f => docPdf(await f.arrayBuffer())]]) {
    for (const tep of ds) {
      const { kq, tuDem: d } = await docMotTep(tep, loai, dem, doc)
      if (d) tuDem++
      if (kq.ok) toKhai.push({ nguon: loai === 'tokhai' ? 'xml' : 'pdf', ...kq.tk, tep })
      else if (kq.scan) scan.push(tep)
      else if (!kq.khongPhai) loi.push({ tep, loi: kq.loi })
      tienDo?.(++xong, tong)
    }
  }
  // Cùng tờ khai (loại + kỳ + lần) có cả XML và PDF ở hai chỗ khác nhau → giữ XML
  const coXml = new Set(toKhai.filter(t => t.nguon === 'xml').map(t => `${t.loai}|${t.maKy}|${t.lanBoSung}`))
  const loc = toKhai.filter(t => t.nguon === 'xml' || !coXml.has(`${t.loai}|${t.maKy}|${t.lanBoSung}`))
  return { toKhai: loc, loi, scan, tuDem }
}

// ── Bảng kê Excel (cổng HĐĐT + phần mềm kế toán) ─────────────────────────────

const LA_EXCEL = new Set(['xlsx', 'xls', 'xlsm'])

// File Excel trong bộ báo cáo (kèm kỳ của thư mục chứa nó) và trong thư mục hóa đơn.
export function tepBangKeCuaNam(quetNam) {
  const ds = tepBoBaoCao(quetNam).filter(([t]) => LA_EXCEL.has(t.duoi)).map(([t, , ky]) => ({ tep: t, kyThuMuc: ky }))
  for (const t of quetNam?.hoaDon?.tep || []) if (LA_EXCEL.has(t.duoi)) ds.push({ tep: t, kyThuMuc: null })
  return ds
}

// docExcelBuf = async (arrayBuffer) → [{ ten, hang }] (lib/phanTich/doc/excel.js — truyền vào để trang tự nạp thư viện).
// Chỉ lưu BẢN TÓM TẮT mỗi sheet vào bộ nhớ đệm (mẫu, chiều, số hóa đơn, tháng) — không lưu hàng nghìn dòng.
// Trả { bangKe: [{ tep, kyThuMuc, sheet, mau, chieu, soHd, thang, soTheoThang, canhBao }], loi }
export async function docBangKeCuaNam(quetNam, { dem, tienDo, docExcelBuf, mstCty = '' } = {}) {
  const ds = tepBangKeCuaNam(quetNam)
  const bangKe = [], loi = []
  let tuDem = 0, xong = 0
  for (const { tep, kyThuMuc } of ds) {
    // 'bangke4': thêm sheet tờ khai trong file phần mềm (tk_pm); 'bangke3': bỏ phụ lục giảm thuế (27/10/2026); 'bangke2' thêm khoá hóa đơn + tiền theo tháng — đổi tên để bỏ đệm cũ
    const { kq, tuDem: d } = await docMotTep(tep, 'bangke4|' + mstCty, dem, async f => {
      const sheets = docBangKe(await docExcelBuf(await f.arrayBuffer()), { chieu: tep.goiY?.chieu || null, mstCty })
      return { ok: true, sheet: sheets.map(b => {
        const soTheoThang = {}
        const khoaTheoThang = {}, tienTheoThang = {}
        for (const h of b.hoaDon) {
          if (!h.ngay) continue
          const t = h.ngay.slice(0, 7)
          soTheoThang[t] = (soTheoThang[t] || 0) + 1
          if (!conHieuLuc(h)) continue                       // hóa đơn đã hủy / bị thay thế: không đếm
          ;(khoaTheoThang[t] || (khoaTheoThang[t] = [])).push(khoaGop(h))
          tienTheoThang[t] = (tienTheoThang[t] || 0) + (h.tienChuaThue || 0)
        }
        return { sheet: b.sheet, mau: b.mau, chieu: b.chieu, soHd: b.hoaDon.length, thang: b.thang, soTheoThang, khoaTheoThang, tienTheoThang, canhBao: b.canhBao, ...(b.chiTieu ? { chiTieu: b.chiTieu, kyTk: b.ky } : {}) }
      }) }
    })
    if (d) tuDem++
    if (kq.ok) for (const sh of kq.sheet) bangKe.push({ tep, kyThuMuc, ...sh })
    else loi.push({ tep, loi: kq.loi })
    tienDo?.(++xong, ds.length)
  }
  return { bangKe, loi, tuDem }
}

// Đọc ĐẦY ĐỦ từng hóa đơn của các file bảng kê đã có tóm tắt (docBangKeCuaNam) — Soát kỳ cần ghép từng hóa đơn.
// `chon(tomTat)` lọc file cần đọc (vd chỉ file có hóa đơn trong kỳ). Giữ trong bộ nhớ của tab (không lưu IndexedDB vì
// mỗi file có thể hàng nghìn dòng), khoá theo file + cỡ + ngày sửa.
const _dayDu = new Map()
export async function docBangKeDayDu(tomTat, { docExcelBuf, mstCty = '', chon = () => true, tienDo } = {}) {
  const theoTep = new Map()
  for (const b of tomTat.filter(chon)) if (!theoTep.has(b.tep)) theoTep.set(b.tep, b.kyThuMuc)
  const ra = [], loi = []
  let xong = 0
  for (const [tep, kyThuMuc] of theoTep) {
    const khoa = `${tep.duongDan.join('/')}/${tep.ten}|${tep.co}|${tep.sua}|${mstCty}`
    try {
      let sheets = _dayDu.get(khoa)
      if (!sheets) {
        const f = await tep.tay.getFile()
        sheets = docBangKe(await docExcelBuf(await f.arrayBuffer()), { chieu: tep.goiY?.chieu || null, mstCty })
        _dayDu.set(khoa, sheets)
      }
      for (const b of sheets) ra.push({ ...b, tep, kyThuMuc })
    } catch (e) {
      loi.push({ tep, loi: e?.message || String(e) })
    }
    tienDo?.(++xong, theoTep.size)
  }
  return { bangKe: ra, loi }
}

// ── Bảng lương (Excel, thư mục 6. LƯƠNG) + C12 (PDF, thư mục 5. BẢO HIỂM XÃ HỘI) — Soát kỳ lát 2 ─────────────

// docExcelBuf: như docBangKeCuaNam. Trả { bangLuong: [{ tep, thang, nam, tong, nguoi }], loi, tuDem }
export async function docBangLuongCuaNam(quetNam, { dem, docExcelBuf } = {}) {
  const ds = (quetNam?.vung?.luong || []).filter(t => LA_EXCEL.has(t.duoi))
  const bangLuong = [], loi = []
  let tuDem = 0
  for (const tep of ds) {
    const { kq, tuDem: d } = await docMotTep(tep, 'luong|1', dem, async f => ({ ok: true, ds: docBangLuong(await docExcelBuf(await f.arrayBuffer()), { namMacDinh: quetNam.nam }) }))
    if (d) tuDem++
    if (kq.ok) for (const b of kq.ds) bangLuong.push({ tep, ...b })
    else loi.push({ tep, loi: kq.loi })
  }
  return { bangLuong, loi, tuDem }
}

// docC12 = async (arrayBuffer) → kết quả docC12PdfChu. Trả { c12: [{ tep, thang, nam, soLaoDong, quyLuong }], loi }
export async function docC12CuaNam(quetNam, { dem, docC12 } = {}) {
  const ds = (quetNam?.vung?.bhxh || []).filter(t => t.duoi === 'pdf')
  const c12 = [], loi = []
  for (const tep of ds) {
    const { kq } = await docMotTep(tep, 'c12|1', dem, async f => docC12(await f.arrayBuffer()))
    if (kq.ok) c12.push({ tep, ...kq })
    else if (kq.loi && !kq.khongPhai && !kq.scan) loi.push({ tep, loi: kq.loi })
  }
  return { c12, loi }
}

// ── Sao kê ngân hàng (9. SỔ PHỤ NGÂN HÀNG) + tờ khai hải quan (4. TỜ KHAI HẢI QUAN) — màn Tăng trưởng & phí ──────

// Trả { giaoDich: [{ ngay, khoa }] (đã bỏ trùng giữa các file), tien: [{ ngay, vao, ra, moTa, tienTe }], soFile, loi }
//   giaoDich: đếm số giao dịch (Tăng trưởng) · tien: số tiền từng giao dịch (Soát kỳ: sổ phụ ↔ sổ 112)
export async function docSaoKeCuaNam(quetNam, { dem, docExcelBuf } = {}) {
  const ds = (quetNam?.vung?.so_phu || []).filter(t => LA_EXCEL.has(t.duoi))
  const theoKhoa = new Map(), tien = new Map(), loi = []
  for (const tep of ds) {
    const { kq } = await docMotTep(tep, 'saoke|2', dem, async f => { const sh = await docExcelBuf(await f.arrayBuffer()); return { ok: true, gd: docSaoKe(sh), tien: docSaoKeTien(sh) } })
    if (kq.ok) { for (const g of kq.gd) theoKhoa.set(g.khoa, g); for (const g of kq.tien || []) tien.set(g.khoa, g) }
    else loi.push({ tep, loi: kq.loi })
  }
  return { giaoDich: [...theoKhoa.values()], tien: [...tien.values()].map(({ khoa, ...g }) => g), soFile: ds.length, loi }
}

// Sổ quỹ (TK 111) + sổ tiền gửi (TK 112) trong "8. SỔ SÁCH KẾ TOÁN" — chỉ file có tên / thư mục giống sổ tiền hoặc sổ chi tiết
// tài khoản (nhật ký chung, tồn kho, khấu hao… rất nặng, không đọc). Dòng trùng giữa các file (cùng sổ xuất 2 lần) bỏ.
// Trả { dong: [{ tk, ngay, soCt, dienGiai, tkDu, no, co }], soFile, loi }
const LA_SO_TIEN = /111|112|TIENGUI|TIENMAT|SOQUY|QUYTIEN|NGANHANG|PHIEUTHU|PHIEUCHI|SOCHITIET|CHITIETTAIKHOAN|CHITIETCACTAIKHOAN/
const chuanTen = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '')
export function tepSoTienCuaNam(quetNam) {
  return (quetNam?.vung?.so_sach || []).filter(t => LA_EXCEL.has(t.duoi) && LA_SO_TIEN.test(chuanTen(t.duongDan.slice(-1)[0]) + '|' + chuanTen(t.ten)))
}
export async function docSoTienCuaNam(quetNam, { dem, docExcelBuf } = {}) {
  const ds = tepSoTienCuaNam(quetNam)
  const theoKhoa = new Map(), loi = []
  for (const tep of ds) {
    const { kq } = await docMotTep(tep, 'sotien|1', dem, async f => ({ ok: true, dong: docSoTien(await docExcelBuf(await f.arrayBuffer())) }))
    if (kq.ok) for (const d of kq.dong) theoKhoa.set([d.tk, d.ngay, d.soCt, d.no, d.co, d.dienGiai].join('|'), d)
    else loi.push({ tep, loi: kq.loi })
  }
  return { dong: [...theoKhoa.values()], soFile: ds.length, loi }
}

// Trả { toKhai: [{ so, ngay, loai, tep }], khongRoNgay: [{ so, tep }], kps } — đếm theo SỐ tờ khai, quý theo ngày đăng ký
export async function docHaiQuanCuaNam(quetNam, { dem, docExcelBuf } = {}) {
  const kps = (quetNam?.thuMuc || []).some(t => t.ma === 'hai_quan' && t.kps)
  const ds = quetNam?.vung?.hai_quan || []
  const theoSo = new Map(), khongRo = new Map()
  for (const tep of ds) {
    if (LA_EXCEL.has(tep.duoi)) {
      const { kq } = await docMotTep(tep, 'haiquan|1', dem, async f => ({ ok: true, tk: docToKhaiHaiQuan(await docExcelBuf(await f.arrayBuffer())) }))
      if (kq.ok) for (const t of kq.tk) if (!theoSo.has(t.so)) theoSo.set(t.so, { ...t, tep })
      if (kq.ok && kq.tk.length) continue
    }
    const so = soToKhaiTuTen(tep.ten)
    if (so && !khongRo.has(so)) khongRo.set(so, { so, tep })
  }
  for (const so of theoSo.keys()) khongRo.delete(so)
  return { toKhai: [...theoSo.values()], khongRoNgay: [...khongRo.values()], kps }
}
