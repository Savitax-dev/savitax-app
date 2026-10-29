// Nối bộ máy Soát xét báo cáo năm (lib/soatbaocao/boMay.js) với thư mục công ty trên Drive. CHỈ ĐỌC.
//
// Quét RỘNG cả thư mục năm như Rủi ro thuế (năm cũ xếp tự do), lấy:
//   • mọi .xml trừ hóa đơn điện tử lẻ (tờ khai 01/GTGT, 05/KK, 05/QTT, 03/TNDN, BCTC XML) — bộ đọc của bản gốc tự nhận loại;
//   • mọi Excel / CSV (BCTC, bảng cân đối tài khoản, sổ nhật ký chung, sổ chi tiết, sổ quỹ, tiền gửi, công nợ, nhập xuất tồn,
//     giá thành, bảng kê hóa đơn, sao kê, bảng lương) — bộ máy tự nhận loại theo tiêu đề / cột;
//   • bỏ ảnh, PDF (chưa đọc PDF ở phân hệ này), file nén, nhánh hợp đồng / hình ảnh / giấy nộp tiền.
// Loại tài liệu + năm lấy theo NỘI DUNG (bộ máy tự định tuyến năm), không theo tên thư mục.
import * as XLSX from 'xlsx'
import { taoBoMay } from './boMay.js'
import { loaiThuMucNam, duoiFile, conAnToan } from '../phanTich/thuMuc.js'
import { docWorkbook } from '../phanTich/doc/excel.js'

const PHIEN_BAN = 'soat2'
const GIOI_HAN = 3000
const NHANH_BO = new Set(['hop_dong', 'hop_dong_khac', 'hinh_anh', 'giay_nop_tien'])
const LA_BANG = new Set(['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv'])

// Đọc bảng tính ĐÚNG như bản gốc: SheetJS cellDates:true (ngày ra Date — bộ máy tự cộng 20 phút chữa lệch múi giờ), ô trống ''
// và bỏ dòng trống. CSV: tự đoán dấu phân cách.
export function docBang(ten, buf) {
  const duoi = duoiFile(ten)
  if (duoi === 'csv') {
    const tx = new TextDecoder('utf-8').decode(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    const dau = tx.split(/\r?\n/, 1)[0]
    const sep = dau.includes('\t') ? '\t' : dau.split(';').length > dau.split(',').length ? ';' : ','
    const rows = tx.split(/\r?\n/).map(l => { const o = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++ } else q = !q } else if (ch === sep && !q) { o.push(cur); cur = '' } else cur += ch } o.push(cur); return o }).filter(r => r.some(c => c.trim()))
    return [{ name: ten, rows }]
  }
  const wb = docWorkbook(XLSX, buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: 'array', cellDates: true })   // chịu được .xls lỗi liên kết ngoài
  return wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }).filter(r => r.some(c => c !== '' && c != null)) })).filter(t => t.rows.length)
}

const laHoaDonXml = x => /<HDon\b/.test(x.slice(0, 4000)) && /<DLHDon\b/.test(x.slice(0, 6000))

// Các file của một thư mục năm → [{ ten, duongDan, duoi, co, sua, tay }]
export async function tepSoatNam(quetNam) {
  const ra = { tep: [], canhBao: [] }
  if (!quetNam?.tay) return ra
  async function di(tay, duongDan) {
    const thuMuc = []
    for await (const [ten, t] of conAnToan(tay, tay === quetNam.tay, ra.canhBao)) {
      if (t.kind === 'directory') { thuMuc.push([ten, t]); continue }
      if (ten.startsWith('~$') || ten.startsWith('.')) continue
      const duoi = duoiFile(ten)
      if (duoi !== 'xml' && !LA_BANG.has(duoi)) continue
      if (ra.tep.length >= GIOI_HAN) { ra.canhBao.push(`Quá ${GIOI_HAN} file trong thư mục năm ${quetNam.nam} — chỉ đọc phần đầu`); return false }
      let co = null, sua = null
      try { const f = await t.getFile(); co = f.size; sua = f.lastModified } catch { /* file Drive chưa tải về */ }
      ra.tep.push({ ten, duongDan, duoi, co, sua, tay: t, namGoiY: quetNam.nam })
    }
    thuMuc.sort((a, b) => a[0].localeCompare(b[0], 'vi'))
    for (const [ten, t] of thuMuc) {
      if (NHANH_BO.has(loaiThuMucNam(ten).ma)) continue
      if (await di(t, [...duongDan, ten]) === false) return false
    }
  }
  await di(quetNam.tay, quetNam.duongDan || [quetNam.ten])
  return ra
}

async function docCoDem(tep, dem, doc) {
  const khoa = dem?.khoa(tep, PHIEN_BAN)
  if (khoa) { const c = await dem.lay(khoa); if (c !== undefined) return c }
  let kq
  try { kq = await doc(await tep.tay.getFile()) } catch (e) { kq = { loi: e?.message || String(e) } }
  if (khoa && !kq.loi) await dem.ghi(khoa, kq)
  return kq
}

// Đọc mọi năm có thư mục vào MỘT bộ máy (bộ máy tự xếp từng file vào đúng năm theo nội dung).
// Trả { X (bộ máy), file: [{ ten, duongDan, kind, n, note, nam }], boQua, loi, canhBao, cacNam }
export async function docHoSoSoat({ quetTheoNam, meta = {}, dem, tienDo, homNay } = {}) {
  const X = taoBoMay({ homNay })
  const S = X.normCase({ ...X.blank(), meta: { ...X.blank().meta, ...meta, vd: false } })
  X.setS(S); X.invalidate()
  const ds = [], canhBao = []
  for (const n of Object.keys(quetTheoNam).map(Number).sort()) {
    const r = await tepSoatNam(quetTheoNam[n]); ds.push(...r.tep); canhBao.push(...r.canhBao)
  }
  const file = [], loi = []
  let boQua = 0, xong = 0
  for (const tep of ds) {
    const kq = await docCoDem(tep, dem, async f => {
      // Chỉ hồ sơ khai thuế (tờ khai, BCTC — có thẻ HSoThueDTu); hóa đơn lẻ, thông báo của cơ quan thuế… bỏ qua
      if (tep.duoi === 'xml') { const x = await f.text(); return laHoaDonXml(x) || !/<HSoThueDTu\b/.test(x.slice(0, 3000)) ? { boQua: true } : { xml: x } }
      return { bang: docBang(tep.ten, new Uint8Array(await f.arrayBuffer())) }
    })
    tienDo?.(++xong, ds.length)
    if (kq.boQua) { boQua++; continue }
    if (kq.loi) { loi.push({ tep, loi: kq.loi }); continue }
    for (const r of X.nhapFile({ ten: tep.ten, duoi: tep.duoi, xml: kq.xml, bang: kq.bang, namGoiY: tep.namGoiY })) {
      if (r.kind === 'unknown') { boQua++; continue }
      file.push({ ...r, duongDan: tep.duongDan })
    }
  }
  const cacNam = X.xongNhap()
  return { X, file, boQua, loi, canhBao, cacNam: [...new Set([...cacNam, ...X.yearKeys().map(Number)])].filter(Boolean).sort((a, b) => b - a) }
}

// Tính kết quả một năm (bộ máy đã nạp)
export function tinhNamSoat(X, nam) { X.setYear(nam); X.syncYear(); X.invalidate(); return X.compute() }
