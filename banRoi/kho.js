// Bản rời — kho dữ liệu trên máy: danh sách công ty + cài đặt, lưu IndexedDB của trình duyệt (không có máy chủ).
// Tay cầm thư mục Drive và bộ nhớ đệm đọc file KHÔNG ở đây — chúng nằm ở kho riêng của lib/phanTich/khoMay.js như app.
// Mọi file mở từ ổ đĩa (file://) dùng chung một vùng lưu, nên kho đặt tên riêng để không lẫn với file HTML khác.
import { useSyncExternalStore } from 'react'

const TEN_KHO = 'savitax-hoso-ban-roi'
export const PHIEN_BAN_DU_LIEU = 1

// Ngày nghỉ lễ mặc định = bảng tax_holidays của app chính (16/11/2026) GỘP danh sách của phân hệ Hồ sơ chứng từ (Tết Nguyên
// đán, Giỗ Tổ, nghỉ bù — 17/11/2026). Dùng chung cho hạn nộp tờ khai và lùi ngày chứng từ. Ô "Ngày nghỉ lễ" ở Cài đặt để trống
// thì dùng danh sách này; khách tự sửa / thêm năm sau vì ngày âm lịch, ngày nghỉ bù đổi theo năm.
export const NGAY_LE_MAC_DINH = [
  '2026-01-01 Tết Dương lịch', '2026-02-16 Tết Nguyên đán', '2026-02-17 Tết Nguyên đán', '2026-02-18 Tết Nguyên đán',
  '2026-02-19 Tết Nguyên đán', '2026-02-20 Tết Nguyên đán', '2026-04-27 Giỗ Tổ Hùng Vương (nghỉ bù)',
  '2026-04-30 Ngày Giải phóng miền Nam', '2026-05-01 Quốc tế Lao động', '2026-09-01 Quốc khánh', '2026-09-02 Quốc khánh',
  '2027-01-01 Tết Dương lịch', '2027-02-05 Tết Nguyên đán', '2027-02-08 Tết Nguyên đán', '2027-02-09 Tết Nguyên đán',
  '2027-02-10 Tết Nguyên đán', '2027-02-11 Tết Nguyên đán', '2027-04-16 Giỗ Tổ Hùng Vương', '2027-04-30 Ngày Giải phóng miền Nam',
  '2027-05-01 Quốc tế Lao động', '2027-05-03 Quốc tế Lao động (nghỉ bù)', '2027-09-02 Quốc khánh', '2027-09-03 Quốc khánh',
].join('\n')

export const CAI_DAT_MAC_DINH = {
  tenDonVi: '', mstDonVi: '', dcDonVi: '', logo: '',  // thương hiệu đơn vị dùng app (trống = Savitax)
  ngayLe: '',                                          // mỗi dòng một ngày YYYY-MM-DD (hạn nộp, lùi ngày chứng từ)
  ctyDangLam: '',
  saoLuuLuc: '',
}

let dbHua = null
function moKho() {
  if (!dbHua) dbHua = new Promise((ok, hong) => {
    const yc = indexedDB.open(TEN_KHO, 1)
    yc.onupgradeneeded = () => yc.result.createObjectStore('kv')
    yc.onsuccess = () => ok(yc.result)
    yc.onerror = () => hong(yc.error)
  })
  return dbHua
}
async function doc(khoa) {
  const db = await moKho()
  return new Promise((ok, hong) => { const r = db.transaction('kv').objectStore('kv').get(khoa); r.onsuccess = () => ok(r.result); r.onerror = () => hong(r.error) })
}
async function ghi(khoa, giaTri) {
  const db = await moKho()
  return new Promise((ok, hong) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(giaTri, khoa); t.oncomplete = () => ok(); t.onerror = () => hong(t.error) })
}

// Ảnh chụp trạng thái cho React (đổi = đối tượng mới)
let anh = { congTy: [], caiDat: { ...CAI_DAT_MAC_DINH }, daNap: false, khoLoi: '' }
const nguoiNghe = new Set()
function dat(sua) { anh = { ...anh, ...sua }; nguoiNghe.forEach(f => f()) }
export const layKho = () => anh
export function useKho() {
  return useSyncExternalStore(cb => { nguoiNghe.add(cb); return () => nguoiNghe.delete(cb) }, () => anh, () => anh)
}

export async function napKho() {
  try {
    const [congTy, caiDat] = await Promise.all([doc('congTy'), doc('caiDat')])
    dat({ congTy: Array.isArray(congTy) ? congTy : [], caiDat: { ...CAI_DAT_MAC_DINH, ...(caiDat || {}) }, daNap: true })
  } catch (e) {
    // Trình duyệt chặn lưu trữ (cửa sổ ẩn danh, xem thử…) → vẫn chạy, nhưng tắt là mất
    dat({ daNap: true, khoLoi: 'Trình duyệt không cho lưu dữ liệu (' + (e?.message || e) + '). App vẫn chạy nhưng tắt đi là mất — hãy sao lưu.' })
  }
}
async function luu(khoa, giaTri) {
  try { await ghi(khoa, giaTri) } catch (e) { dat({ khoLoi: 'Không lưu được vào trình duyệt: ' + (e?.message || e) }) }
}

// ── Công ty ─────────────────────────────────────────────────────────────────────────────
// { id, maKH, ten, mst, dc, kyKhai: 'quy'|'thang', laHkd, batDau: 'YYYY-MM-DD'|null }  (bản rời không có phí dịch vụ)
const taoId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export const chuanMst = s => String(s || '').replace(/[\s.]/g, '')
const mstGoc = s => chuanMst(s).replace(/-/g, '')

// Trả lỗi (mảng chữ) nếu không hợp lệ
export function kiemCongTy(c, idDangSua = null, ds = anh.congTy) {
  const loi = []
  if (!c.maKH) loi.push('Thiếu mã KH.')
  else if (ds.some(x => x.id !== idDangSua && x.maKH === c.maKH)) loi.push(`Mã KH "${c.maKH}" đã có.`)
  if (!c.ten) loi.push('Thiếu tên công ty.')
  if (!/^\d{10}(-?\d{3})?$/.test(chuanMst(c.mst))) loi.push('MST phải 10 số, hoặc 13 số (10 số + 3 số chi nhánh).')
  else if (ds.some(x => x.id !== idDangSua && mstGoc(x.mst) === mstGoc(c.mst))) loi.push(`MST ${c.mst} đã có ở công ty khác.`)
  return loi
}
export function timTheoMst(mst, idBo = null) { return anh.congTy.find(c => c.id !== idBo && mstGoc(c.mst) === mstGoc(mst)) || null }

export async function luuCongTy(c) {
  const ds = [...anh.congTy]
  const i = c.id ? ds.findIndex(x => x.id === c.id) : -1
  const moi = { kyKhai: 'quy', laHkd: false, dc: '', batDau: null, ...c, id: c.id || taoId() }
  if (i >= 0) ds[i] = { ...ds[i], ...moi }; else ds.push(moi)
  dat({ congTy: ds })
  await luu('congTy', ds)
  return moi
}
export async function xoaCongTy(id) {
  const ds = anh.congTy.filter(c => c.id !== id)
  dat({ congTy: ds })
  await luu('congTy', ds)
}

// ── Cài đặt ─────────────────────────────────────────────────────────────────────────────
export async function datCaiDat(sua) {
  const caiDat = { ...anh.caiDat, ...sua }
  dat({ caiDat })
  await luu('caiDat', caiDat)
}
// Ô để trống → danh sách mặc định. Mỗi dòng: ngày YYYY-MM-DD (chữ sau ngày là ghi chú).
export const ngayLeHieuLuc = () => String(anh.caiDat.ngayLe || '').trim() || NGAY_LE_MAC_DINH
export function ngayLeSet() {
  return new Set(ngayLeHieuLuc().split(/\s+/).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)))
}

// ── Hồ sơ chứng từ (banRoi/hoSoChungTu) ────────────────────────────────────────────────
// Cả khối dữ liệu của phân hệ (hồ sơ, danh bạ, mẫu, bộ hồ sơ đã sửa) nằm ở MỘT khoá. Ghi hỏng thì ném lỗi để phân hệ báo.
export const docHoSoChungTu = () => doc('hoSoChungTu').catch(() => null)
export const luuHoSoChungTu = d => ghi('hoSoChungTu', d)
// "Thế hệ" đổi khi dữ liệu bị thay từ ngoài phân hệ (khôi phục sao lưu chung) → khung bỏ bản đang chạy, dựng lại phân hệ
let theHe = 0
export const theHeHoSoChungTu = () => theHe

// ── Sao lưu / khôi phục (file JSON) ─────────────────────────────────────────────────────
// Thư mục đã trỏ KHÔNG đi theo: trình duyệt không cho mang quyền đọc thư mục sang máy khác.
export async function taoSaoLuu() {
  return {
    loai: 'savitax-hoso-sao-luu', phienBan: PHIEN_BAN_DU_LIEU, luc: new Date().toISOString(), congTy: anh.congTy,
    caiDat: { ...anh.caiDat, ctyDangLam: '' }, hoSoChungTu: (await docHoSoChungTu()) || null,
  }
}
export async function khoiPhuc(j) {
  if (!j || j.loai !== 'savitax-hoso-sao-luu' || !Array.isArray(j.congTy)) throw new Error('File không phải bản sao lưu của app này.')
  const caiDat = { ...CAI_DAT_MAC_DINH, ...(j.caiDat || {}) }
  dat({ congTy: j.congTy, caiDat })
  await luu('congTy', j.congTy)
  await luu('caiDat', caiDat)
  // File sao lưu cũ (trước khi có Hồ sơ chứng từ) không có khoá này → giữ nguyên dữ liệu chứng từ đang có
  if (j.hoSoChungTu) { await luu('hoSoChungTu', j.hoSoChungTu); theHe++ }
}
