'use client'
// Ghi file tờ khai xuống đĩa máy nhân viên — Phân hệ Tờ khai, GĐ 6.
//
// Dùng File System Access API: nhân viên CHỌN MỘT LẦN thư mục '7. BỘ BÁO CÁO', trình duyệt nhớ
// quyền ghi vào đó, từ đó app tự tạo cây thư mục con và ghi file vào đúng chỗ. Không qua thư mục
// Tải xuống, không phải kéo thả tay từng file.
//
// VÌ SAO KHÔNG DÙNG CÁCH TẢI XUỐNG THÔNG THƯỜNG: một công ty một kỳ đã 4–8 file; làm cho nhiều kỳ
// là vài trăm file đổ hết vào Tải xuống rồi nhân viên ngồi xếp tay — đúng việc mà phân hệ này sinh
// ra để bỏ.
//
// GIỚI HẠN: chỉ Chrome/Edge trên máy tính có API này. Nhân viên đã phải cài tiện ích Chrome để gọi
// cổng thuế rồi, nên không phát sinh yêu cầu mới.
//
// Cái "tay cầm" thư mục (handle) KHÔNG lưu được ra chuỗi — phải lưu nguyên đối tượng vào IndexedDB.
// localStorage không nhận. Đây là lý do file này có một mẩu IndexedDB tự viết.

import { moTheoDuongDan, moThuMuc, ghiFile, THU_MUC_TAO_SAN } from './tokhaiThuMuc.js'

const TEN_KHO = 'savitax-tokhai'
const TEN_BANG = 'tay-cam'
const KHOA_GOC = 'thu-muc-goc'

export function coHoTro() {
  return typeof window !== 'undefined'
    && typeof window.showDirectoryPicker === 'function'
    && typeof indexedDB !== 'undefined'
}

// ── Nhớ tay cầm thư mục qua IndexedDB ────────────────────────────────────────

function moKho() {
  return new Promise((giaiQuyet, tuChoi) => {
    const yc = indexedDB.open(TEN_KHO, 1)
    yc.onupgradeneeded = () => {
      if (!yc.result.objectStoreNames.contains(TEN_BANG)) yc.result.createObjectStore(TEN_BANG)
    }
    yc.onsuccess = () => giaiQuyet(yc.result)
    yc.onerror = () => tuChoi(yc.error || new Error('Không mở được kho IndexedDB'))
  })
}

function lamViecKho(cheDo, viec) {
  return moKho().then(kho => new Promise((giaiQuyet, tuChoi) => {
    const gd = kho.transaction(TEN_BANG, cheDo)
    const yc = viec(gd.objectStore(TEN_BANG))
    yc.onsuccess = () => giaiQuyet(yc.result)
    yc.onerror = () => tuChoi(yc.error || new Error('Lỗi đọc/ghi IndexedDB'))
    gd.oncomplete = () => kho.close()
  }))
}

const luuTayCam = tay => lamViecKho('readwrite', b => b.put(tay, KHOA_GOC))
const docTayCam = () => lamViecKho('readonly', b => b.get(KHOA_GOC))
const xoaTayCam = () => lamViecKho('readwrite', b => b.delete(KHOA_GOC))

// ── Chọn và mở lại thư mục gốc ───────────────────────────────────────────────

// PHẢI gọi từ trong một cú bấm của người dùng, trình duyệt không cho mở hộp chọn thư mục ngoài đó.
export async function chonThuMucGoc() {
  if (!coHoTro()) throw new Error('Trình duyệt này không ghi được vào thư mục. Dùng Chrome hoặc Edge trên máy tính.')
  const tay = await window.showDirectoryPicker({
    id: 'savitax-bo-bao-cao',   // Chrome nhớ chỗ mở lần trước theo id này
    mode: 'readwrite',
    startIn: 'documents',
  })
  await luuTayCam(tay)
  return tay
}

// Lấy lại thư mục đã chọn lần trước. Quyền ghi có thể đã bị thu hồi khi đóng trình duyệt, nên phải
// xin lại — và việc xin lại CŨNG phải nằm trong một cú bấm.
export async function layThuMucGoc({ xinQuyen = false } = {}) {
  if (!coHoTro()) return { tay: null, trangThai: 'khong_ho_tro' }
  let tay
  try { tay = await docTayCam() } catch { return { tay: null, trangThai: 'chua_chon' } }
  if (!tay) return { tay: null, trangThai: 'chua_chon' }

  const quyen = { mode: 'readwrite' }
  let tt = await tay.queryPermission(quyen)
  if (tt === 'granted') return { tay, trangThai: 'san_sang', ten: tay.name }
  if (!xinQuyen) return { tay, trangThai: 'can_xin_lai', ten: tay.name }

  try { tt = await tay.requestPermission(quyen) } catch { tt = 'denied' }
  if (tt === 'granted') return { tay, trangThai: 'san_sang', ten: tay.name }
  return { tay, trangThai: 'bi_tu_choi', ten: tay.name }
}

export async function quenThuMucGoc() {
  try { await xoaTayCam() } catch { /* không có gì để quên */ }
}

// ── Ghi file ─────────────────────────────────────────────────────────────────

// Cổng trả nội dung dạng base64 trong JSON. Chuyển sang byte để ghi thẳng, KHÔNG qua chuỗi ký tự —
// file XML có dấu tiếng Việt, đi qua chuỗi là hỏng mã.
export function base64ThanhByte(b64) {
  const s = atob(String(b64 || ''))
  const ra = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) ra[i] = s.charCodeAt(i)
  return ra
}

export function byteThanhChu(byte) {
  return new TextDecoder('utf-8').decode(byte)
}

// Ghi một file vào cây thư mục, tính từ thư mục gốc nhân viên đã cấp quyền.
// Trả về tên file thật đã ghi (có thể khác tên xin ghi nếu trùng — xem ghiFile trong tokhaiThuMuc).
export async function ghiVaoDia({ goc, duongDan, tenFile, duLieu }) {
  if (!goc) throw new Error('Chưa chọn thư mục lưu')
  const thuMuc = await moTheoDuongDan(goc, duongDan)
  // Tạo sẵn thư mục BẢNG KÊ cạnh bên để nhân viên tự bỏ bảng kê vào — app không ghi gì vào đó.
  if (duongDan.length >= 2) {
    const cha = await moTheoDuongDan(goc, duongDan.slice(0, -1))
    for (const t of THU_MUC_TAO_SAN) await moThuMuc(cha, t)
  }
  return ghiFile(thuMuc, tenFile, duLieu)
}
