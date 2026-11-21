'use client'
// Bảng kê hóa đơn cổng → thư mục công ty, chạy trên máy nhân viên (File System Access API, như phân hệ Tờ khai).
//
// Đường đi của một file: nút "Xuất hóa đơn" của cổng → trình duyệt tải về → tiện ích đặt tên Tải về\Savitax-HDDT\<mã lượt>.xlsx
// → app đọc file đó qua tay cầm thư mục Tải về (nhân viên trỏ MỘT lần) → kiểm (lib/hddtBangKe.js) → ghi vào
// <cty>\…\Năm <năm>\2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO → xoá bản trong Tải về.
import { moThuMucNam, tangCuaThuMuc, namCuaTen } from './tokhaiLuuDia.js'
import { moThuMuc } from './tokhaiThuMuc.js'

const TEN_KHO = 'savitax-hddt'
const BANG = 'tay-cam'
const KHOA_TAI_VE = 'thu-muc-tai-ve'
export const THU_MUC_TAI = 'Savitax-HDDT'

function lamViecKho(cheDo, viec) {
  return new Promise((giaiQuyet, tuChoi) => {
    const yc = indexedDB.open(TEN_KHO, 1)
    yc.onupgradeneeded = () => { if (!yc.result.objectStoreNames.contains(BANG)) yc.result.createObjectStore(BANG) }
    yc.onerror = () => tuChoi(yc.error)
    yc.onsuccess = () => {
      const kho = yc.result
      const gd = kho.transaction(BANG, cheDo)
      const r = viec(gd.objectStore(BANG))
      r.onsuccess = () => giaiQuyet(r.result)
      r.onerror = () => tuChoi(r.error)
      gd.oncomplete = () => kho.close()
    }
  })
}

// Thư mục Tải về: trỏ một lần (PHẢI trong cú bấm). Cần quyền GHI để xoá file sau khi đã chép sang thư mục công ty.
export async function chonThuMucTaiVe() {
  const tay = await window.showDirectoryPicker({ id: 'savitax-tai-ve', mode: 'readwrite', startIn: 'downloads' })
  await lamViecKho('readwrite', b => b.put(tay, KHOA_TAI_VE))
  return tay
}
export async function layThuMucTaiVe({ xinQuyen = false } = {}) {
  let tay = null
  try { tay = await lamViecKho('readonly', b => b.get(KHOA_TAI_VE)) } catch { tay = null }
  if (!tay) return { tay: null, trangThai: 'chua_chon' }
  let tt = await tay.queryPermission({ mode: 'readwrite' })
  if (tt !== 'granted' && xinQuyen) { try { tt = await tay.requestPermission({ mode: 'readwrite' }) } catch { tt = 'denied' } }
  return { tay, ten: tay.name, trangThai: tt === 'granted' ? 'san_sang' : 'can_xin_lai' }
}

// Đọc file tiện ích vừa đặt tên. `duongDanDay` = đường dẫn đầy đủ trình duyệt báo (để nói rõ khi trỏ nhầm thư mục Tải về).
export async function docFileTai(tayTaiVe, tenFile, duongDanDay = '') {
  let thuMuc
  try { thuMuc = await tayTaiVe.getDirectoryHandle(THU_MUC_TAI) } catch {
    throw new Error(`Không thấy thư mục "${THU_MUC_TAI}" trong "${tayTaiVe.name}". File nằm ở: ${duongDanDay || '(không rõ)'} — trỏ lại thư mục Tải về cho đúng thư mục chứa "${THU_MUC_TAI}".`)
  }
  const tayFile = await thuMuc.getFileHandle(tenFile)
  const f = await tayFile.getFile()
  return { byte: new Uint8Array(await f.arrayBuffer()), xoa: () => thuMuc.removeEntry(tenFile).catch(() => {}) }
}

// Thư mục NĂM của công ty: nhân viên trỏ thư mục công ty (như Tờ khai) → đi vào "2. HỒ SƠ KẾ TOÁN" → "Năm <năm>".
// Trỏ thẳng vào thư mục năm cũng nhận. Trỏ vào "7. BỘ BÁO CÁO" thì không đi ngược lên được → báo trỏ lại.
async function moNamCuaCongTy(tayCty, nam) {
  const tang = tangCuaThuMuc(tayCty.name)
  if (tang === 'bo_bao_cao') throw new Error(`Thư mục đang trỏ là "${tayCty.name}" (bộ báo cáo) — app không đi ngược lên được. Trỏ lại vào THƯ MỤC CÔNG TY.`)
  if (tang && tang.startsWith('nam:')) {
    if (tang !== 'nam:' + nam) throw new Error(`Thư mục đang trỏ là năm ${tang.slice(4)}, kỳ cần lưu thuộc năm ${nam} — trỏ lại vào THƯ MỤC CÔNG TY.`)
    return tayCty
  }
  const hoSo = (await moThuMuc(tayCty, 'HỒ SƠ KẾ TOÁN', { taoMoi: false })) || tayCty
  return moThuMucNam(hoSo, nam)
}

// Ghi đè file cùng tên: bảng kê cổng tải lại là bản MỚI NHẤT của chính cổng (khác tờ khai — Tờ khai giữ bản cũ thêm _v2).
// Ghi xong đọc lại cỡ: ổ Google Drive đôi khi đổi tên file tạm hỏng mà không báo lỗi → file 0 byte (ca DOEL 19/10/2026).
async function ghiDe(thuMuc, tenFile, byte) {
  let daCo = false
  try { await thuMuc.getFileHandle(tenFile); daCo = true } catch { /* chưa có */ }
  const tay = await thuMuc.getFileHandle(tenFile, { create: true })
  const w = await tay.createWritable()
  await w.write(byte)
  await w.close()
  const f = await tay.getFile()
  if (f.size !== byte.length) throw new Error(`ghi xong nhưng file chỉ ${f.size}/${byte.length} byte — ổ Drive chưa đồng bộ, chạy lại kỳ này`)
  return { daCo }
}

// Đã có file bảng kê của lượt này trong thư mục công ty chưa — CHỈ ĐỌC, không tạo thư mục nào (dùng cho bảng "còn thiếu").
export async function daCoFile({ tayCty, nam, duongDan, tenFile }) {
  try {
    const tang = tangCuaThuMuc(tayCty.name)
    let tm = null
    if (tang === 'nam:' + nam) tm = tayCty
    else if (!tang) {
      const hoSo = (await moThuMuc(tayCty, 'HỒ SƠ KẾ TOÁN', { taoMoi: false })) || tayCty
      for await (const [ten, tay] of hoSo.entries()) if (tay.kind === 'directory' && namCuaTen(ten) === String(nam)) { tm = tay; break }
    }
    if (!tm) return false
    for (const t of duongDan) { tm = await moThuMuc(tm, t, { taoMoi: false }); if (!tm) return false }
    await tm.getFileHandle(tenFile)
    return true
  } catch { return false }
}

// Lưu một file đã kiểm vào đúng chỗ. Trả { duongDan: 'Năm 2026\\2. HÓA ĐƠN…\\QUÝ 3\\HĐ MUA VÀO\\<tên>', ghiDe }
export async function luuVaoCongTy({ tayCty, nam, duongDan, tenFile, byte }) {
  if (!tayCty) throw new Error('Chưa chọn thư mục công ty')
  let thuMuc, buoc = 'Mở thư mục năm'
  try {
    thuMuc = await moNamCuaCongTy(tayCty, nam)
    const ten = [thuMuc.name]
    for (const t of duongDan) { buoc = `Mở / tạo "${t}"`; thuMuc = await moThuMuc(thuMuc, t); ten.push(thuMuc.name) }
    buoc = `Ghi "${tenFile}"`
    const { daCo } = await ghiDe(thuMuc, tenFile, byte)
    return { duongDan: [...ten, tenFile].join('\\'), ghiDe: daCo }
  } catch (e) {
    const m = String(e?.message || e)
    const goiY = /NotAllowed|permission/i.test(m) ? ' — trình duyệt chưa được cấp quyền ghi, bấm "Cấp quyền" ở dòng công ty.'
      : /could not be found|NotFound/i.test(m) ? ' — thư mục có thể đã bị đổi tên / xoá, hoặc ổ Google Drive chưa sẵn sàng.' : ''
    throw new Error(`${buoc}: ${m}${goiY}`)
  }
}
