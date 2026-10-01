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

import { moTheoDuongDan, moThuMuc, ghiFile, THU_MUC_TAO_SAN, laCungThuMuc } from './tokhaiThuMuc.js'

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

// Soát NGAY LÚC CHỌN chứ không đợi tới lúc chạy, để nhân viên thấy trước file sẽ rơi vào đâu.
//
// ⚠ BÁO CHO BIẾT, KHÔNG CHẶN. Bản trước từ chối thư mục không có '2. HỒ SƠ KẾ TOÁN'; anh gặp ngay
// khi thử bằng một thư mục trống (28/09). Cái soát đó sinh ra để chặn MÁY dò nhầm công ty — giờ
// nhân viên tự tay trỏ nên không còn gì để nghi ngờ, chặn chỉ cản công ty mới chưa dựng sẵn cấu
// trúc và cản cả việc chạy thử.
//
// Trả về { ok, kieu, cacNam, canhBao, duongDanMau }:
//   kieu = 'cong_ty' → bên trong có '2. HỒ SƠ KẾ TOÁN', app đi vào đó
//   kieu = 'tu_chon' → không có, app tạo 'Năm <năm>' ngay trong thư mục nhân viên đã trỏ
export async function soatThuMucCongTy(tay) {
  if (!tay) return { ok: false, loi: 'Chưa chọn thư mục' }
  try {
    const tang = tangCuaThuMuc(tay.name)

    // Trỏ THẲNG vào '7. BỘ BÁO CÁO' — cách chọn chính xác nhất. App không đẻ thêm tầng nào.
    if (tang === 'bo_bao_cao') {
      return {
        ok: true, kieu: 'bo_bao_cao', cacNam: [],
        duongDanMau: [tay.name],
        canhBao: 'Đang trỏ THẲNG vào "' + tay.name + '". Mọi kỳ sẽ rơi vào đúng thư mục này, '
          + 'KHÔNG tự chia theo năm — vì tầng năm nằm bên trên, app không nhìn thấy. Muốn app tự '
          + 'xếp theo năm thì chọn lại thư mục công ty (ví dụ 5. MINH ĐỨC DŨNG).',
      }
    }

    // Trỏ vào 'Năm 2026' — app chỉ đi xuống BỘ BÁO CÁO.
    if (tang) {
      const namDaChon = tang.slice(4)
      return {
        ok: true, kieu: 'nam', cacNam: [namDaChon],
        duongDanMau: [tay.name, TEN_TAO_BO_BAO_CAO],
        canhBao: 'Đang trỏ vào thư mục năm ' + namDaChon + '. Hồ sơ của năm khác cũng sẽ rơi vào '
          + 'đây — chọn khoảng ngày trong năm ' + namDaChon + ', hoặc chọn lại thư mục công ty.',
      }
    }

    const hoSo = await moThuMuc(tay, TANG_HO_SO, { taoMoi: false })
    if (hoSo) {
      // Lấy ĐÚNG tên thư mục có thật ('2. HỒ SƠ KẾ TOÁN'), không in tên chuẩn hoá của app.
      return {
        ok: true, kieu: 'cong_ty', cacNam: await cacThuMucNam(hoSo),
        duongDanMau: [tay.name, hoSo.name, 'Năm <năm>', TEN_TAO_BO_BAO_CAO],
      }
    }

    // Không có tầng hồ sơ kế toán → app tạo 'Năm <năm>' ngay trong thư mục đã trỏ.
    // Đã sẵn thư mục 'Năm ...' bên trong thì đúng tầng rồi, khỏi cảnh báo.
    const cacNam = await cacThuMucNam(tay)
    return {
      ok: true, kieu: 'tu_chon', cacNam,
      duongDanMau: [tay.name, 'Năm <năm>', TEN_TAO_BO_BAO_CAO],
      canhBao: cacNam.length ? null
        : `Thư mục này chưa có "2. HỒ SƠ KẾ TOÁN" lẫn thư mục năm nào. App sẽ tạo thẳng `
          + `"Năm <năm>" trong "${tay.name}" — không phải ý anh/chị thì chọn lại thư mục công ty, `
          + 'ví dụ 3.THỊNH PHÁT.',
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

// Nhân viên đã trỏ tới TẦNG NÀO trong cây thư mục?
//
// Lý do phải đoán: trình duyệt chỉ đưa cho app cái TÊN của thư mục được chọn, KHÔNG có đường dẫn
// và KHÔNG đi ngược lên thư mục cha được. Muốn biết đang đứng ở đâu thì chỉ còn cách nhìn tên.
//
//   'bo_bao_cao' → chính là '7. BỘ BÁO CÁO', file rơi thẳng vào đây
//   'nam:2026'   → là 'Năm 2026', chỉ cần đi xuống BỘ BÁO CÁO
//   null         → thư mục công ty (hoặc thứ gì khác), đi đủ Năm → BỘ BÁO CÁO
export function tangCuaThuMuc(ten) {
  if (laCungThuMuc(ten, TANG_BO_BAO_CAO)) return 'bo_bao_cao'
  const m = String(ten || '').normalize('NFC').match(/n[ăa]m\s*(\d{4})\s*$/i)
  return m ? 'nam:' + m[1] : null
}

// Từ thư mục nhân viên đã trỏ, đi xuống 'Năm <nam>' → '7. BỘ BÁO CÁO'.
//
// ⚠ ĐỪNG ĐẺ THÊM TẦNG KHI NHÂN VIÊN ĐÃ TRỎ SÂU SẴN. Ngày 01/10/2026 anh trỏ thẳng vào thư mục
// '7. BỘ BÁO CÁO' của Năm 2026, app lại tạo thêm 'Năm 2026' rồi '7. BỘ BÁO CÁO' nữa bên trong —
// vì nó chỉ biết tìm '2. HỒ SƠ KẾ TOÁN', không thấy thì mặc định mình đang ở thư mục công ty.
// Trỏ thẳng vào BỘ BÁO CÁO là cách chọn CHÍNH XÁC NHẤT, phải tôn trọng.
export async function moBoBaoCao(tayCty, nam) {
  if (!tayCty) throw new Error('Chưa chọn thư mục lưu')
  const tang = tangCuaThuMuc(tayCty.name)

  // Đã đứng ngay trong BỘ BÁO CÁO: đây chính là đích. Tầng năm nằm NGAY TRÊN nó, app không nhìn
  // thấy và cũng không đi lên được — nên mọi kỳ sẽ rơi vào đúng thư mục này, không chia theo năm.
  // Màn hình đã nói rõ điều đó lúc chọn (soatThuMucCongTy).
  if (tang === 'bo_bao_cao') return tayCty

  // Đã đứng trong 'Năm <năm>': chỉ còn thiếu một tầng.
  if (tang) {
    let bo = await moThuMuc(tayCty, TANG_BO_BAO_CAO, { taoMoi: false })
    if (!bo) bo = await tayCty.getDirectoryHandle(TEN_TAO_BO_BAO_CAO, { create: true })
    return bo
  }

  const hoSo = (await moThuMuc(tayCty, TANG_HO_SO, { taoMoi: false })) || tayCty
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
