'use client'
// Ghi file tờ khai xuống đĩa máy nhân viên — Phân hệ Tờ khai, GĐ 6.
//
// Dùng File System Access API: nhân viên CHỌN MỘT LẦN thư mục của mình trên ổ chung, trình duyệt
// nhớ quyền ghi, từ đó app tự dò xuống đúng thư mục từng công ty rồi ghi file vào chỗ.
//
// CÂY THƯ MỤC THẬT của Savitax (ví dụ THỊNH PHÁT):
//   G:\Shared drives\12. SAVITAX - PHÒNG NGHIỆP VỤ GRAND\   ← phòng
//      Huỳnh Thị Mỹ Lệ\                                     ← nhân viên   ⇦ CHỌN Ở ĐÂY
//         3.THỊNH PHÁT\                                     ← công ty (kế toán đánh số thứ tự)
//            2. HỒ SƠ KẾ TOÁN\ Năm 2026\ 7. BỘ BÁO CÁO\     ← app tự đi tiếp
//
// Chọn thư mục NHÂN VIÊN thì lo được mọi công ty người đó phụ trách; trưởng phòng chọn thư mục
// PHÒNG thì lo được cả phòng (app dò xuống thêm một tầng). Đúng bằng cách phân hệ này chia phạm vi.
//
// ⚠ THƯ MỤC CÔNG TY CHỈ DÒ, KHÔNG TẠO. Dò không ra thì báo để nhân viên chọn tay — tạo bừa một
// thư mục công ty trên ổ chung của cả phòng là làm bẩn dữ liệu người khác. Các tầng bên dưới
// (Năm, BỘ BÁO CÁO) thì tạo được, vì lúc đó đã chắc chắn đang đứng trong đúng thư mục công ty.
//
// Tay cầm thư mục KHÔNG lưu được ra chuỗi — phải lưu nguyên đối tượng vào IndexedDB, localStorage
// không nhận. Đó là lý do file này có một mẩu IndexedDB tự viết.

import {
  moTheoDuongDan, moThuMuc, ghiFile, laCungThuMuc, chuanHoaTen, boSoThuTu, THU_MUC_TAO_SAN,
} from './tokhaiThuMuc.js'

const TEN_KHO = 'savitax-tokhai'
const TEN_BANG = 'tay-cam'
const KHOA_GOC = 'thu-muc-goc'
const khoaCty = clientId => 'thu-muc-cty:' + clientId

// Tên các tầng app tự đi xuống, và tên app dùng khi phải tạo mới.
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

const luuTayCam = (khoa, tay) => lamViecKho('readwrite', b => b.put(tay, khoa))
const docTayCam = khoa => lamViecKho('readonly', b => b.get(khoa))
const xoaTayCam = khoa => lamViecKho('readwrite', b => b.delete(khoa))

// ── Chọn / mở lại thư mục ────────────────────────────────────────────────────

// PHẢI gọi từ trong một cú bấm của người dùng — trình duyệt không cho mở hộp chọn thư mục ngoài đó.
async function chonVaNho(khoa, { id, goiY }) {
  if (!coHoTro()) throw new Error('Trình duyệt này không ghi được vào thư mục. Dùng Chrome hoặc Edge trên máy tính.')
  const tay = await window.showDirectoryPicker({ id, mode: 'readwrite', startIn: goiY || 'documents' })
  await luuTayCam(khoa, tay)
  return tay
}

// Quyền ghi có thể bị thu khi đóng trình duyệt → phải xin lại, mà xin lại CŨNG phải trong cú bấm.
async function mo(khoa, { xinQuyen = false } = {}) {
  if (!coHoTro()) return { tay: null, trangThai: 'khong_ho_tro' }
  let tay
  try { tay = await docTayCam(khoa) } catch { return { tay: null, trangThai: 'chua_chon' } }
  if (!tay) return { tay: null, trangThai: 'chua_chon' }

  const q = { mode: 'readwrite' }
  let tt = await tay.queryPermission(q)
  if (tt === 'granted') return { tay, trangThai: 'san_sang', ten: tay.name }
  if (!xinQuyen) return { tay, trangThai: 'can_xin_lai', ten: tay.name }

  try { tt = await tay.requestPermission(q) } catch { tt = 'denied' }
  return { tay, trangThai: tt === 'granted' ? 'san_sang' : 'bi_tu_choi', ten: tay.name }
}

export const chonThuMucGoc = () => chonVaNho(KHOA_GOC, { id: 'savitax-thu-muc-nhan-vien' })
export const layThuMucGoc = opt => mo(KHOA_GOC, opt)
export const quenThuMucGoc = () => xoaTayCam(KHOA_GOC).catch(() => {})

// Thư mục công ty chọn tay — dùng khi dò không ra, hoặc công ty để chỗ riêng.
export const chonThuMucCongTy = clientId => chonVaNho(khoaCty(clientId), { id: 'savitax-thu-muc-cong-ty' })
export const layThuMucCongTy = (clientId, opt) => mo(khoaCty(clientId), opt)
export const quenThuMucCongTy = clientId => xoaTayCam(khoaCty(clientId)).catch(() => {})

// ── Dò thư mục công ty ───────────────────────────────────────────────────────

// Bỏ phần "CÔNG TY TNHH", "CÔNG TY CỔ PHẦN"… ở đầu tên để so với tên thư mục kế toán đặt gọn.
const boPhanLoaiHinh = s => String(s || '').replace(
  /^\s*(CÔNG\s*TY|CTY|CT)\s*(TNHH|CỔ\s*PHẦN|CP|MTV|một\s*thành\s*viên)?\s*/i, '')

// Điểm khớp giữa tên một thư mục và một công ty. Cao hơn = chắc chắn hơn.
//   3 = trùng khít Mã khách hàng          (chắc nhất — mã do Savitax đặt)
//   2 = trùng khít tên công ty
//   1 = tên thư mục nằm gọn trong tên công ty (kế toán đặt tên rút gọn)
//   0 = không liên quan
export function diemKhopThuMuc(tenThuMuc, { maKH, tenCty }) {
  const t = chuanHoaTen(boSoThuTu(tenThuMuc))
  if (!t) return 0
  const m = chuanHoaTen(maKH)
  const c = chuanHoaTen(tenCty)
  const cGon = chuanHoaTen(boPhanLoaiHinh(tenCty))
  if (m && t === m) return 3
  if (c && (t === c || t === cGon)) return 2
  // Ngưỡng 5 ký tự: dưới đó dễ trùng bậy ('AN' khớp với chục công ty).
  if (t.length >= 5 && ((c && c.includes(t)) || (m && m.includes(t)) || (t.includes(cGon) && cGon.length >= 5))) return 1
  return 0
}

// Dò thư mục công ty trong thư mục gốc, xuống tối đa 2 tầng (gốc là thư mục NHÂN VIÊN → 1 tầng;
// gốc là thư mục PHÒNG → 2 tầng). Ưu tiên tầng nông hơn và điểm khớp cao hơn.
//
// KHÔNG ĐOÁN BỪA: cùng một mức ưu tiên mà có từ 2 thư mục trở lên thì trả về 'nhieu_lua_chon' để
// nhân viên chọn tay. Ghi tờ khai công ty này vào thư mục công ty kia là hỏng việc thật.
export async function doThuMucCongTy(goc, { maKH, tenCty }) {
  if (!goc) return { tay: null, ly_do: 'chua_chon_goc' }

  const ungVien = []   // { tay, ten, diem, tang, duongDan }
  const quet = async (tay, tang, truoc) => {
    for await (const [ten, con] of tay.entries()) {
      if (con.kind !== 'directory') continue
      const dd = [...truoc, ten]
      const diem = diemKhopThuMuc(ten, { maKH, tenCty })
      if (diem > 0) ungVien.push({ tay: con, ten, diem, tang, duongDan: dd })
      else if (tang < 2) await quet(con, tang + 1, dd)
    }
  }
  try { await quet(goc, 1, []) } catch (e) { return { tay: null, ly_do: 'loi_doc', moTa: e.message } }

  if (!ungVien.length) return { tay: null, ly_do: 'khong_thay' }

  // Chọn nhóm tốt nhất: tầng nông nhất trước, rồi điểm cao nhất.
  ungVien.sort((a, b) => a.tang - b.tang || b.diem - a.diem)
  const tot = ungVien[0]
  const cungHang = ungVien.filter(u => u.tang === tot.tang && u.diem === tot.diem)
  if (cungHang.length > 1) {
    return { tay: null, ly_do: 'nhieu_lua_chon', ungVien: cungHang.map(u => u.duongDan.join('\\')) }
  }
  return { tay: tot.tay, duongDan: tot.duongDan, diem: tot.diem }
}

// Từ thư mục CÔNG TY đi xuống '2. HỒ SƠ KẾ TOÁN' → 'Năm <nam>' → '7. BỘ BÁO CÁO'.
//
// Tầng HỒ SƠ KẾ TOÁN chỉ DÒ, không tạo: thư mục công ty nào cũng phải có sẵn tầng này, thiếu nó
// nghĩa là nhiều khả năng vừa dò nhầm sang thư mục khác — thà báo còn hơn tạo bậy.
export async function moBoBaoCao(tayCty, nam) {
  const hoSo = await moThuMuc(tayCty, TANG_HO_SO, { taoMoi: false })
  if (!hoSo) {
    throw new Error(`Thư mục "${tayCty.name}" không có "2. HỒ SƠ KẾ TOÁN" — có thể đã dò nhầm công ty. `
      + 'Bấm "Chọn tay" để trỏ đúng thư mục công ty.')
  }
  const namTay = await moThuMuc(hoSo, tenNam(nam))            // sang năm mới thì tạo, bình thường
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

export { laCungThuMuc }
