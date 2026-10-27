'use client'
// Kho trên máy nhân viên cho Phân hệ Soát xét báo cáo + Rủi ro thuế (IndexedDB, KHÔNG gửi đi đâu).
//
// - Thư mục chính của công ty: dùng CHUNG tay cầm với Phân hệ Tờ khai (lib/tokhaiLuuDia.js) nhưng chỉ xin
//   quyền ĐỌC — trỏ một lần là cả hai phân hệ cùng thấy.
// - Thư mục năm cũ (≤ 2025): app mặc định chỉ soát từ 2026; năm cũ thì nhân viên tải về một thư mục rồi
//   trỏ riêng vào (anh chốt 26/10/2026). Lưu ở kho riêng, mỗi công ty một danh sách.
// - Bộ nhớ đệm kết quả đọc file: khoá = đường dẫn + cỡ + ngày sửa, file đổi là tự đọc lại. Xoá kho thì
//   app đọc lại từ Drive, không mất gì — nguồn đúng luôn là Drive.
import { coHoTro, layThuMucCongTy, quenThuMucCongTy, luuThuMucCongTy, tangCuaThuMuc } from '../tokhaiLuuDia.js'
import { namCuaThuMuc, laThuMucNamTheoCon } from './thuMuc.js'

export { coHoTro }

// Thư mục vừa chọn là thư mục NĂM (theo tên hoặc theo cây con) chứ không phải thư mục công ty?
async function laThuMucNam(tay) {
  if (namCuaThuMuc(tay.name) != null) return true
  const con = []
  try { for await (const [ten, t] of tay.entries()) if (t.kind === 'directory') con.push(ten) } catch { return false }
  return laThuMucNamTheoCon(con)
}

const TEN_KHO = 'savitax-phantich'
const BANG_TAY = 'tay-cam'
const BANG_DEM = 'bo-nho-dem'

function moKho() {
  return new Promise((ok, loi) => {
    const yc = indexedDB.open(TEN_KHO, 1)
    yc.onupgradeneeded = () => {
      for (const b of [BANG_TAY, BANG_DEM]) if (!yc.result.objectStoreNames.contains(b)) yc.result.createObjectStore(b)
    }
    yc.onsuccess = () => ok(yc.result)
    yc.onerror = () => loi(yc.error || new Error('Không mở được kho IndexedDB'))
  })
}
function lamViec(bang, cheDo, viec) {
  return moKho().then(kho => new Promise((ok, loi) => {
    const gd = kho.transaction(bang, cheDo)
    const yc = viec(gd.objectStore(bang))
    yc.onsuccess = () => ok(yc.result)
    yc.onerror = () => loi(yc.error || new Error('Lỗi đọc/ghi IndexedDB'))
    gd.oncomplete = () => kho.close()
  }))
}

// ── Thư mục chính của công ty (chung với Tờ khai, chỉ đọc) ─────────────────────

// ⚠ Chỉ thư mục CÔNG TY mới ghi vào chỗ dùng chung với Tờ khai. Trỏ vào thư mục NĂM (vd "2026 - Test BCT",
// anh thử 26/10/2026) mà ghi chung thì Tờ khai không nhận ra tầng năm, lần tải sau sẽ đẻ thêm
// "Năm 2026\7. BỘ BÁO CÁO" lồng bên trong. Nên thư mục năm vào danh sách riêng của phân hệ này.
// Phải gọi trong cú bấm. Trả { tay, laNam }.
export async function chonThuMucChinh(clientId) {
  if (!coHoTro()) throw new Error('Trình duyệt này không mở được thư mục trên máy. Dùng Chrome hoặc Edge trên máy tính.')
  const tay = await window.showDirectoryPicker({ id: 'savitax-thu-muc-cong-ty', mode: 'read', startIn: 'documents' })
  if (await laThuMucNam(tay)) { await luuTayNam(clientId, tay); return { tay, laNam: true } }
  await luuThuMucCongTy(clientId, tay)
  return { tay, laNam: false }
}

// Đọc thư mục chung. Nếu chỗ chung đang giữ một thư mục năm mà Tờ khai KHÔNG nhận ra là năm (do bản trước của
// màn này ghi vào) → chuyển sang danh sách riêng và gỡ khỏi chỗ chung, để Tờ khai không ghi nhầm tầng.
// Thư mục "Năm 2026" thì Tờ khai hiểu đúng → để nguyên.
export async function layThuMucChinh(clientId, { xinQuyen = false } = {}) {
  const kq = await layThuMucCongTy(clientId, { xinQuyen, cheDo: 'read' })
  // Chỉ khi chính TÊN có số năm (ca thật "2026 - Test BCT"): đoán theo thư mục con dễ gỡ nhầm thư mục công ty của Tờ khai
  if (kq.tay && kq.trangThai === 'san_sang' && !tangCuaThuMuc(kq.tay.name) && /20\d\d/.test(kq.tay.name) && await laThuMucNam(kq.tay)) {
    await luuTayNam(clientId, kq.tay)
    await quenThuMucCongTy(clientId)
    return { tay: null, trangThai: 'chua_chon', daChuyen: kq.tay.name }
  }
  return kq
}
export const quenThuMucChinh = quenThuMucCongTy

// ── Thư mục năm cũ ───────────────────────────────────────────────────────────

const khoaNamCu = clientId => 'nam-cu:' + clientId

export async function dsThuMucNamCu(clientId) {
  if (!coHoTro()) return []
  try { return (await lamViec(BANG_TAY, 'readonly', b => b.get(khoaNamCu(clientId)))) || [] } catch { return [] }
}

// Trùng tên với thư mục đã có thì thay thế.
async function luuTayNam(clientId, tay) {
  const ds = await dsThuMucNamCu(clientId)
  await lamViec(BANG_TAY, 'readwrite', b => b.put([...ds.filter(t => t.name !== tay.name), tay], khoaNamCu(clientId)))
}

// Phải gọi trong cú bấm. Trả tay cầm vừa chọn.
export async function themThuMucNamCu(clientId) {
  const tay = await window.showDirectoryPicker({ id: 'savitax-nam-cu', mode: 'read', startIn: 'documents' })
  await luuTayNam(clientId, tay)
  return tay
}

export async function boThuMucNamCu(clientId, ten) {
  const ds = await dsThuMucNamCu(clientId)
  await lamViec(BANG_TAY, 'readwrite', b => b.put(ds.filter(t => t.name !== ten), khoaNamCu(clientId)))
}

// Quyền đọc có thể bị thu khi đóng trình duyệt. xinQuyen chỉ được gọi trong cú bấm.
export async function quyenDoc(tay, { xinQuyen = false } = {}) {
  let tt = await tay.queryPermission({ mode: 'read' })
  if (tt !== 'granted' && xinQuyen) { try { tt = await tay.requestPermission({ mode: 'read' }) } catch { tt = 'denied' } }
  return tt === 'granted'
}

// ── Bộ nhớ đệm kết quả đọc file ───────────────────────────────────────────────

// Đổi số này khi bộ đọc đổi cách ra kết quả → toàn bộ đệm cũ tự bỏ.
const PHIEN_BAN_DOC = 1
export const khoaDem = (tep, loai) =>
  `${PHIEN_BAN_DOC}|${loai}|${tep.duongDan.join('\\')}\\${tep.ten}|${tep.co ?? ''}|${tep.sua ?? ''}`

export async function layDem(khoa) {
  try { return await lamViec(BANG_DEM, 'readonly', b => b.get(khoa)) } catch { return undefined }
}
export async function ghiDem(khoa, giaTri) {
  try { await lamViec(BANG_DEM, 'readwrite', b => b.put(giaTri, khoa)) } catch { /* đầy kho thì thôi, lần sau đọc lại */ }
}
