// Bản rời — kho dữ liệu trên máy: danh sách công ty + cài đặt, lưu IndexedDB của trình duyệt (không có máy chủ).
// Tay cầm thư mục Drive và bộ nhớ đệm đọc file KHÔNG ở đây — chúng nằm ở kho riêng của lib/phanTich/khoMay.js như app.
// Mọi file mở từ ổ đĩa (file://) dùng chung một vùng lưu, nên kho đặt tên riêng để không lẫn với file HTML khác.
import { useSyncExternalStore } from 'react'

const TEN_KHO = 'savitax-hoso-ban-roi'
export const PHIEN_BAN_DU_LIEU = 1

// Ngày nghỉ lễ mặc định = bảng tax_holidays của app chính (16/11/2026). Ô "Ngày nghỉ lễ" ở Cài đặt để trống thì dùng danh
// sách này; khách tự thêm Tết Nguyên đán, Giỗ Tổ, ngày nghỉ bù… vì các ngày đó đổi theo năm.
export const NGAY_LE_MAC_DINH = [
  '2026-01-01 Tết Dương lịch', '2026-04-30 Ngày Giải phóng miền Nam', '2026-05-01 Quốc tế Lao động', '2026-09-02 Quốc khánh',
  '2027-01-01 Tết Dương lịch', '2027-04-30 Ngày Giải phóng miền Nam', '2027-05-01 Quốc tế Lao động', '2027-09-02 Quốc khánh',
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

// ── Sao lưu / khôi phục (file JSON) ─────────────────────────────────────────────────────
// Thư mục đã trỏ KHÔNG đi theo: trình duyệt không cho mang quyền đọc thư mục sang máy khác.
export function taoSaoLuu() {
  return { loai: 'savitax-hoso-sao-luu', phienBan: PHIEN_BAN_DU_LIEU, luc: new Date().toISOString(), congTy: anh.congTy, caiDat: { ...anh.caiDat, ctyDangLam: '' } }
}
export async function khoiPhuc(j) {
  if (!j || j.loai !== 'savitax-hoso-sao-luu' || !Array.isArray(j.congTy)) throw new Error('File không phải bản sao lưu của app này.')
  const caiDat = { ...CAI_DAT_MAC_DINH, ...(j.caiDat || {}) }
  dat({ congTy: j.congTy, caiDat })
  await luu('congTy', j.congTy)
  await luu('caiDat', caiDat)
}
