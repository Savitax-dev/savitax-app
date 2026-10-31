// Cây thư mục và quy tắc đặt tên file tờ khai — Phân hệ Tờ khai, GĐ 6.
//
// Theo đúng quy ước Savitax trong gói bàn giao (mục 6.1). Phần TÍNH TÊN tách riêng khỏi phần GHI
// ĐĨA để kiểm được bằng script, vì đây là chỗ sai một ly đi một dặm: đặt sai tên thì kế toán tìm
// không ra file, mà lỗi kiểu đó phải mở thư mục thật mới phát hiện.
//
// MỌI KỲ ĐỀU NGANG HÀNG, bên trong đúng một bố cục (anh chốt 29/09) — mở thư mục nào cũng như nhau,
// kế toán không phải nhớ hai kiểu:
//
//   7. BỘ BÁO CÁO\                                ← nhân viên cấp quyền, app KHÔNG tạo
//      ├─ BAOCAOTHUE_<kỳ>_<năm>_<Mã KH>\          ← quý / tháng
//      ├─ BAOCAOTHUE_<kỳ>_<năm>_<Mã KH>_BSL1\     ← bổ sung lần 1, ngang hàng bản chính thức
//      ├─ BỘ BÁO CÁO TÀI CHÍNH_<năm>_<Mã KH>\     ← kỳ năm (quyết toán + BCTC)
//      └─ BỘ BÁO CÁO TÀI CHÍNH_<năm>_<Mã KH>_BSL1\
//            ├─ TỜ KHAI THUẾ\          TK_<sắc thuế>_<kỳ>.<năm>_<Mã KH>.xml
//            ├─ THÔNG BÁO CHẤP NHẬN\   TBCN_… (chấp nhận; thông báo tiếp nhận không tải từ 31/10/2026)
//            └─ BẢNG KÊ\               (tạo sẵn, nhân viên tự bỏ vào)

// Bỏ dấu, bỏ khoảng trắng và dấu nối, không phân biệt hoa thường — dùng để SO tên thư mục có
// sẵn: 'THÔNG BÁO CHẤP NHẬN' phải nhận ra là cùng một chỗ với 'TB CHẤP NHẬN'.
export const chuanHoaTen = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .replace(/[\s\-_.]/g, '')
  .toUpperCase()

// Bỏ số thứ tự kế toán đánh ở đầu tên thư mục: '3.THỊNH PHÁT', '7. BỘ BÁO CÁO', '12. SAVITAX - …'.
// BẮT BUỘC có dấu chấm/gạch/khoảng trắng sau số, nếu không thì công ty tên '3M VIỆT NAM' bị cắt
// mất chữ 3 thành 'M VIỆT NAM'.
export const boSoThuTu = s => String(s || '').replace(/^\s*\d+\s*[.)\-]\s*|^\s*\d+\s+/, '')

// Vài tên thư mục kế toán hay đặt khác đi nhưng cùng ý nghĩa.
const TEN_TUONG_DUONG = {
  [chuanHoaTen('THÔNG BÁO CHẤP NHẬN')]: ['TB CHẤP NHẬN', 'TB CHAP NHAN', 'THONG BAO'],
  [chuanHoaTen('BẢNG KÊ')]: ['BẢNG KÊ MUA VÀO BÁN RA', 'BANG KE'],
  [chuanHoaTen('TỜ KHAI THUẾ')]: ['TO KHAI THUE', 'TỜ KHAI'],
  [chuanHoaTen('BỘ BÁO CÁO')]: ['BO BAO CAO', 'BỘ BÁO CÁO THUẾ'],
  [chuanHoaTen('HỒ SƠ KẾ TOÁN')]: ['HO SO KE TOAN', 'HỒ SƠ KT'],
}

// So tên thư mục, bỏ qua số thứ tự ở đầu — '7. BỘ BÁO CÁO' phải nhận ra là 'BỘ BÁO CÁO'.
export function laCungThuMuc(tenCo, tenMuon) {
  const a = chuanHoaTen(boSoThuTu(tenCo))
  const b = chuanHoaTen(boSoThuTu(tenMuon))
  if (a === b) return true
  const dsKhac = TEN_TUONG_DUONG[b] || []
  return dsKhac.some(x => chuanHoaTen(boSoThuTu(x)) === a)
}

// 'Q2.2026' → { ky: 'Q2', nam: '2026' } ; 'T09.2026' ; 'NAM.2026' ; 'PS.2026-07-13'
export function tachKy(periodCode) {
  const s = String(periodCode || '')
  const m = s.match(/^(Q[1-4]|T\d{2}|NAM)\.(\d{4})$/)
  if (m) return { ky: m[1], nam: m[2], laNam: m[1] === 'NAM' }
  const ps = s.match(/^PS\.(\d{4})-(\d{2})-(\d{2})$/)
  if (ps) return { ky: `PS${ps[2]}${ps[3]}`, nam: ps[1], laNam: false, laPhatSinh: true }
  return null
}

// Sắc thuế dùng trong tên file: GTGT, TNCN, TNDN, BCTC… Lấy từ danh mục tờ khai.
export function macSacThue(loaiToKhai) {
  if (!loaiToKhai) return 'KHAC'
  return (loaiToKhai.tax_kind || loaiToKhai.code || 'KHAC').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

// ── Tờ khai bổ sung ──────────────────────────────────────────────────────────
//
// Cùng một kỳ, cùng một sắc thuế, tờ khai BỔ SUNG trùng tên y hệt tờ khai chính thức — trước đây
// nó rơi thành '_v2', nhìn không biết là bản bổ sung hay bản tải trùng.
//
// Anh chốt 29/09: mỗi lần bổ sung là MỘT THƯ MỤC KỲ RIÊNG, nằm CÙNG CẤP với thư mục kỳ chính thức,
// bên trong vẫn đủ TỜ KHAI THUẾ / THÔNG BÁO CHẤP NHẬN / BẢNG KÊ như mọi kỳ khác. Mở thư mục nào
// cũng thấy cùng một bố cục:
//
//   7. BỘ BÁO CÁO\
//      BAOCAOTHUE_Q2_2026_VANLANG\        ← chính thức
//      BAOCAOTHUE_Q2_2026_VANLANG_BSL1\   ← bổ sung lần 1
//      BAOCAOTHUE_Q2_2026_VANLANG_BSL2\   ← bổ sung lần 2
//
// Tên file cũng mang _BSL<n>, không chỉ dựa vào tên thư mục: nhân viên hay chép file ra chỗ khác
// để mở (HTKK không đọc nổi đường dẫn tiếng Việt), lúc đó chỉ còn cái tên để phân biệt.
export const hauToBoSung = boSung => (boSung > 0 ? `_BSL${boSung}` : '')

// Mã KH đem ghép vào tên thư mục / file. Mã gõ tay trên app có thể dính dấu cách đầu-cuối hoặc ký tự
// Windows cấm (ca SOHNEX 27/10/2026: mã "SOHNEX " → thư mục "BAOCAOTHUE_Q3_2026_SOHNEX " kết thúc bằng
// dấu cách, Chrome từ chối "Name is not allowed", 6 file không ghi được; "82/7" thì dấu "/" bị hiểu là
// tách thư mục). Bỏ dấu cách thừa, đổi ký tự cấm \ / : * ? " < > | thành '-', bỏ dấu chấm/cách ở cuối.
// Thư mục cũ đã tạo với mã có dấu cách vẫn được dùng lại vì moThuMuc so tên bỏ qua khoảng trắng.
export const maKHTrongTen = maKH => String(maKH ?? '')
  .normalize('NFC')
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[. ]+$/, '')

// Tên thư mục của một kỳ. Kỳ năm mang tên khác vì đó là BỘ BÁO CÁO TÀI CHÍNH, không phải bộ báo
// cáo thuế của một quý/tháng — nhưng vẫn nằm ngang hàng với các thư mục kỳ khác.
export function tenThuMucKy(k, maKH, boSung = 0) {
  maKH = maKHTrongTen(maKH)
  const goc = k.laNam
    ? `BỘ BÁO CÁO TÀI CHÍNH_${k.nam}_${maKH}`
    : `BAOCAOTHUE_${k.ky}_${k.nam}_${maKH}`
  return goc + hauToBoSung(boSung)
}

// Cổng ghi cột 'Loại tờ khai' = 'Chính thức' | 'Bổ sung', và 'Lần nộp bổ sung' = số lần.
// Có dòng ghi 'Bổ sung' mà số lần để trống → coi như lần 1, đừng để rơi về chính thức.
export function soLanBoSung(hoSo) {
  if (!hoSo) return 0
  const laBoSung = /b[ổo]\s*sung/i.test(String(hoSo.loaiToKhai || ''))
  if (!laBoSung) return 0
  return Number(hoSo.lanBoSung) > 0 ? Number(hoSo.lanBoSung) : 1
}

// ── Tên file ─────────────────────────────────────────────────────────────────
export function tenFileToKhai({ sacThue, periodCode, maKH, duoi = 'xml', boSung = 0 }) {
  const k = tachKy(periodCode)
  if (!k) throw new Error('Không đọc được kỳ: ' + periodCode)
  maKH = maKHTrongTen(maKH)
  if (!maKH) throw new Error('Công ty chưa có Mã khách hàng — không đặt được tên file')
  return `TK_${sacThue}_${k.ky}.${k.nam}_${maKH}${hauToBoSung(boSung)}.${duoi}`
}

export function tenFileThongBao({ loaiThongBao, sacThue, periodCode, maKH, duoi = 'xml', boSung = 0 }) {
  const k = tachKy(periodCode)
  if (!k) throw new Error('Không đọc được kỳ: ' + periodCode)
  maKH = maKHTrongTen(maKH)
  if (!maKH) throw new Error('Công ty chưa có Mã khách hàng — không đặt được tên file')
  // TBTN = thông báo TIẾP NHẬN (ngày trên đây dùng xét đúng/trễ hạn)
  // TBCN = thông báo CHẤP NHẬN (kết quả)
  const dau = loaiThongBao === 'tiep_nhan' ? 'TBTN' : loaiThongBao === 'xac_nhan_nop' ? 'TBCN' : 'TB'
  return `${dau}_${sacThue}_${k.ky}.${k.nam}_${maKH}${hauToBoSung(boSung)}.${duoi}`
}

// ── Đường dẫn thư mục (mảng tên, tính từ bên trong '7. BỘ BÁO CÁO') ──────────
//
// MỌI kỳ đều là MỘT THƯ MỤC NGANG HÀNG, bên trong đúng hai thư mục con. Kỳ năm cũng vậy — anh chốt
// 29/09: "chia theo cùng cấp, không nhét vào 1 folder rồi mới chia".
//
//   7. BỘ BÁO CÁO\
//      BAOCAOTHUE_Q2_2026_VANLANG\
//      BAOCAOTHUE_Q2_2026_VANLANG_BSL1\
//      BỘ BÁO CÁO TÀI CHÍNH_2025_VANLANG\
//      BỘ BÁO CÁO TÀI CHÍNH_2025_VANLANG_BSL1\
//
// Bản cũ gom cả năm vào 'BỘ BÁO CÁO TÀI CHÍNH NĂM' rồi mới chia TỜ KHAI / THÔNG BÁO, trong đó lại
// chia tiếp theo từng loại tờ khai. Bỏ tầng chia theo loại: tên file đã mang sẵn sắc thuế
// (TK_TNDN_NAM.2025_…, TK_TNCN_NAM.2025_…) nên không đụng nhau, mà mở thư mục nào cũng thấy đúng
// một bố cục thì kế toán đỡ phải nhớ hai kiểu.
export function duongDanToKhai({ periodCode, maKH, boSung = 0 }) {
  return [tenThuMucKy(docKy(periodCode, maKH), maKH, boSung), 'TỜ KHAI THUẾ']
}

export function duongDanThongBao({ periodCode, maKH, boSung = 0 }) {
  // Thông báo của bản bổ sung nằm trong CHÍNH thư mục kỳ bổ sung đó — một lần bổ sung là một bộ
  // hồ sơ đầy đủ, có tờ khai và thông báo của riêng nó.
  return [tenThuMucKy(docKy(periodCode, maKH), maKH, boSung), 'THÔNG BÁO CHẤP NHẬN']
}

function docKy(periodCode, maKH) {
  const k = tachKy(periodCode)
  if (!k) throw new Error('Không đọc được kỳ: ' + periodCode)
  if (!maKHTrongTen(maKH)) throw new Error('Công ty chưa có Mã khách hàng')
  return k
}

// Thư mục tạo sẵn để nhân viên tự bỏ bảng kê vào (theo quy ước, app không ghi gì vào đây).
export const THU_MUC_TAO_SAN = ['BẢNG KÊ']

// ── Ghi đĩa (chỉ chạy trên trình duyệt có File System Access API) ────────────

// Dò trước – tạo sau: có thư mục tương đương thì DÙNG LẠI, không đẻ thêm thư mục trùng ý nghĩa.
export async function moThuMuc(thuMucCha, tenMuon, { taoMoi = true } = {}) {
  for await (const [ten, tay] of thuMucCha.entries()) {
    if (tay.kind === 'directory' && laCungThuMuc(ten, tenMuon)) return tay
  }
  if (!taoMoi) return null
  return thuMucCha.getDirectoryHandle(tenMuon, { create: true })
}

export async function moTheoDuongDan(goc, duongDan) {
  let tay = goc
  for (const ten of duongDan) tay = await moThuMuc(tay, ten)
  return tay
}

// Ghi file. TRÙNG TÊN thì GIỮ FILE CŨ và thêm hậu tố _v2, _v3… — tuyệt đối không ghi đè, vì file
// cũ có thể là bản kế toán đã đối chiếu với khách. Ngoại lệ duy nhất: file cũ RỖNG (xem coFile).
export async function ghiFile(thuMuc, tenFile, duLieu) {
  let ten = tenFile
  for (let lan = 2; lan <= 20; lan++) {
    const daCo = await coFile(thuMuc, ten)
    if (!daCo) break
    const cham = tenFile.lastIndexOf('.')
    ten = cham > 0
      ? `${tenFile.slice(0, cham)}_v${lan}${tenFile.slice(cham)}`
      : `${tenFile}_v${lan}`
  }
  // Không bao giờ ghi file rỗng — file 0 byte nằm đó trông như đã tải xong, kế toán mở ra mới biết.
  if (!duLieu || !(duLieu.length || duLieu.byteLength || duLieu.size)) throw new Error('nội dung rỗng, không ghi')
  const tay = await thuMuc.getFileHandle(ten, { create: true })
  // GHI XONG PHẢI ĐỌC LẠI CỠ FILE. Trình duyệt ghi vào file tạm rồi đổi tên đè lên file thật; trên ổ
  // Google Drive bước đổi tên đôi khi hỏng mà KHÔNG báo lỗi -> file 0 byte (ca DOEL 19/10/2026: cùng
  // lượt tải, cùng mã, ổ D ra đủ file còn ổ G ra thông báo rỗng). Rỗng thì ghi lại một lần nữa.
  for (let lan = 1; ; lan++) {
    try {
      const ghi = await tay.createWritable()
      await ghi.write(duLieu)
      await ghi.close()
    } catch (e) {
      // getFileHandle đã TẠO file rỗng rồi; ghi hỏng mà để lại thì lần chạy lại thành tên _v2, còn
      // file đúng tên vẫn trắng. Xoá đi rồi mới báo lỗi.
      try { await thuMuc.removeEntry(ten) } catch { /* không xoá được thì thôi, vẫn báo lỗi gốc */ }
      throw e
    }
    let co = -1
    try { co = (await tay.getFile()).size } catch { co = -1 }    // không đọc được cỡ thì tin lần ghi
    if (co !== 0) return ten
    if (lan >= 2) {
      try { await thuMuc.removeEntry(ten) } catch { /* vẫn báo lỗi */ }
      throw new Error('ghi xong nhưng file vẫn 0 byte (ổ Google Drive?) — chạy lại với "Tải lại"')
    }
    await new Promise(r => setTimeout(r, 800))
  }
}

// File 0 BYTE coi như CHƯA CÓ: đó là xác của một lần ghi hỏng (ca DOEL 19/10/2026), không phải bản
// kế toán đã đối chiếu — ghi đè lên đúng tên đó, đừng đẻ ra _v2 rồi để cái file trắng nằm lại.
async function coFile(thuMuc, ten) {
  let tay
  try {
    tay = await thuMuc.getFileHandle(ten)
  } catch {
    return false
  }
  try {
    return (await tay.getFile()).size > 0
  } catch {
    return true     // không đọc được cỡ thì cứ coi là có, để KHÔNG BAO GIỜ ghi đè nhầm file thật
  }
}
