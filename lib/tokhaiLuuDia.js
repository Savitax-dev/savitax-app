'use client'
// Ghi file tờ khai xuống đĩa máy nhân viên — Phân hệ Tờ khai, GĐ 6.
//
// Dùng File System Access API: nhân viên trỏ thẳng vào thư mục CỦA TỪNG CÔNG TY, trình duyệt nhớ
// quyền ghi, lần sau khỏi chọn lại. Từ đó app tự đi xuống đúng năm rồi ghi file.
//
// CÂY THƯ MỤC THẬT của Savitax (ví dụ THỊNH PHÁT):
//   G:\Shared drives\12. SAVITAX - PHÒNG NGHIỆP VỤ GRAND\Huỳnh Thị Mỹ Lệ\
//      3.THỊNH PHÁT\                                  ⇦ NHÂN VIÊN TRỎ VÀO ĐÂY, một lần
//         2. HỒ SƠ KẾ TOÁN\ Năm 2026\ 7. BỘ BÁO CÁO\  ← app tự đi tiếp
//
// ⚠ CỐ Ý KHÔNG DÒ TỰ ĐỘNG. Bản trước có dò thư mục công ty theo tên, anh bỏ (28/09): một nhân viên
// không phụ trách nhiều công ty tới mức phải dò, mà dò thì vừa chậm (quét cả cây trên Google Drive)
// vừa có ngày khớp nhầm — ghi tờ khai công ty này vào thư mục công ty kia là hỏng việc thật.
// Người chọn thì không bao giờ nhầm.
//
// Trỏ vào THƯ MỤC CÔNG TY chứ không phải thư mục 'Năm ...' hay '7. BỘ BÁO CÁO': một lượt tải trải
// nhiều kỳ là trải nhiều năm, app phải tự chọn được năm.
//
// Tay cầm thư mục KHÔNG lưu được ra chuỗi — phải lưu nguyên đối tượng vào IndexedDB, localStorage
// không nhận. Đó là lý do file này có một mẩu IndexedDB tự viết.

import { moTheoDuongDan, moThuMuc, ghiFile, THU_MUC_TAO_SAN } from './tokhaiThuMuc.js'

const TEN_KHO = 'savitax-tokhai'
const TEN_BANG = 'tay-cam'
const khoaCty = clientId => 'thu-muc-cty:' + clientId

const TANG_HO_SO = 'HỒ SƠ KẾ TOÁN'
const TANG_BO_BAO_CAO = 'BỘ BÁO CÁO'
const TEN_TAO_BO_BAO_CAO = '7. BỘ BÁO CÁO'
const tenNam = nam => `Năm ${nam}`

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

// ── Chọn / mở lại thư mục của một công ty ────────────────────────────────────

// PHẢI gọi từ trong một cú bấm của người dùng — trình duyệt không cho mở hộp chọn thư mục ngoài đó.
// Dùng chung một `id` cho mọi công ty để Chrome mở lại đúng chỗ lần trước: các thư mục công ty nằm
// cạnh nhau, nhân viên chỉ việc bấm sang thư mục kế bên.
export async function chonThuMucCongTy(clientId) {
  if (!coHoTro()) throw new Error('Trình duyệt này không ghi được vào thư mục. Dùng Chrome hoặc Edge trên máy tính.')
  const tay = await window.showDirectoryPicker({
    id: 'savitax-thu-muc-cong-ty', mode: 'readwrite', startIn: 'documents',
  })
  await lamViecKho('readwrite', b => b.put(tay, khoaCty(clientId)))
  return tay
}

// Quyền ghi có thể bị thu khi đóng trình duyệt → phải xin lại, mà xin lại CŨNG phải trong cú bấm.
export async function layThuMucCongTy(clientId, { xinQuyen = false } = {}) {
  if (!coHoTro()) return { tay: null, trangThai: 'khong_ho_tro' }
  let tay
  try { tay = await lamViecKho('readonly', b => b.get(khoaCty(clientId))) } catch { tay = null }
  if (!tay) return { tay: null, trangThai: 'chua_chon' }

  const q = { mode: 'readwrite' }
  let tt = await tay.queryPermission(q)
  if (tt === 'granted') return { tay, trangThai: 'san_sang', ten: tay.name }
  if (!xinQuyen) return { tay, trangThai: 'can_xin_lai', ten: tay.name }

  try { tt = await tay.requestPermission(q) } catch { tt = 'denied' }
  return { tay, trangThai: tt === 'granted' ? 'san_sang' : 'bi_tu_choi', ten: tay.name }
}

export const quenThuMucCongTy = clientId =>
  lamViecKho('readwrite', b => b.delete(khoaCty(clientId))).catch(() => {})

// ── Soát thư mục vừa chọn ────────────────────────────────────────────────────

// Soát NGAY LÚC CHỌN chứ không đợi tới lúc chạy: nhân viên trỏ nhầm (vào thư mục 'Năm 2026' hay
// '7. BỘ BÁO CÁO' chẳng hạn) thì biết liền, thay vì gõ captcha xong mới báo lỗi.
//
// Trả về { ok, kieu, cacNam, loi }:
//   kieu = 'cong_ty'  → thư mục công ty, bên trong có '2. HỒ SƠ KẾ TOÁN'  (đúng nhất)
//   kieu = 'ho_so'    → trỏ thẳng vào '2. HỒ SƠ KẾ TOÁN', vẫn dùng được
export async function soatThuMucCongTy(tay) {
  if (!tay) return { ok: false, loi: 'Chưa chọn thư mục' }
  try {
    const hoSo = await moThuMuc(tay, TANG_HO_SO, { taoMoi: false })
    if (hoSo) return { ok: true, kieu: 'cong_ty', cacNam: await cacThuMucNam(hoSo) }

    // Trỏ thẳng vào '2. HỒ SƠ KẾ TOÁN' — chấp nhận, vì vẫn tự chọn được năm.
    const cacNam = await cacThuMucNam(tay)
    if (cacNam.length) return { ok: true, kieu: 'ho_so', cacNam }

    return {
      ok: false,
      loi: `Thư mục "${tay.name}" không có "2. HỒ SƠ KẾ TOÁN" — hãy trỏ vào thư mục công ty, `
        + 'ví dụ 3.THỊNH PHÁT',
    }
  } catch (e) {
    return { ok: false, loi: 'Không đọc được thư mục: ' + e.message }
  }
}

async function cacThuMucNam(tay) {
  const ra = []
  for await (const [ten, con] of tay.entries()) {
    if (con.kind !== 'directory') continue
    const m = ten.match(/(?:^|\s)(\d{4})\s*$/)
    if (m && /n[ăa]m/i.test(ten.normalize('NFC'))) ra.push(m[1])
  }
  return ra.sort()
}

// Từ thư mục công ty đi xuống '2. HỒ SƠ KẾ TOÁN' → 'Năm <nam>' → '7. BỘ BÁO CÁO'.
// Nhân viên trỏ thẳng vào '2. HỒ SƠ KẾ TOÁN' thì bắt đầu ngay từ tầng đó.
//
// SOÁT LẠI trước khi tạo bất cứ thư mục nào, dù màn hình đã soát lúc chọn: đây là chỗ duy nhất
// thực sự ghi lên ổ chung của cả phòng, sai một lần là rải thư mục rác vào thư mục người khác.
export async function moBoBaoCao(tayCty, nam) {
  const soat = await soatThuMucCongTy(tayCty)
  if (!soat.ok) throw new Error(soat.loi)

  const hoSo = soat.kieu === 'cong_ty'
    ? await moThuMuc(tayCty, TANG_HO_SO, { taoMoi: false })
    : tayCty
  const namTay = await moThuMuc(hoSo, tenNam(nam))     // sang năm mới thì tạo
  let bo = await moThuMuc(namTay, TANG_BO_BAO_CAO, { taoMoi: false })
  if (!bo) bo = await namTay.getDirectoryHandle(TEN_TAO_BO_BAO_CAO, { create: true })
  return bo
}

// ── Ghi file ─────────────────────────────────────────────────────────────────

// Cổng trả nội dung base64 trong JSON. Chuyển thẳng sang byte, KHÔNG qua chuỗi ký tự — file XML có
// dấu tiếng Việt, đi qua chuỗi là hỏng mã.
export function base64ThanhByte(b64) {
  const s = atob(String(b64 || ''))
  const ra = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) ra[i] = s.charCodeAt(i)
  return ra
}

export function byteThanhChu(byte) {
  return new TextDecoder('utf-8').decode(byte)
}

// Ghi một file, tính từ thư mục '7. BỘ BÁO CÁO' của công ty.
// Trả về tên file THẬT đã ghi — trùng tên thì thành _v2, xem ghiFile trong tokhaiThuMuc.
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
