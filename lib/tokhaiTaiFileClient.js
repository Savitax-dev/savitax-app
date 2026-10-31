'use client'
// Điều khiển một lượt TẢI FILE ở phía trình duyệt — Phân hệ Tờ khai, GĐ 6.
//
// Luồng: máy chủ dựng sẵn từng yêu cầu → tiện ích Chrome gọi cổng → trình duyệt giữ nội dung →
// máy chủ ra lệnh 'ghi file này vào thư mục kia' → trình duyệt ghi xuống đĩa.
//
// ⚠ ĂN KHỚP NGƯỢC MỘT NHỊP: lệnh `ghiFile` đi kèm phản hồi CHỨA YÊU CẦU KẾ TIẾP, còn nội dung file
// thì nằm ở phản hồi cổng của lượt TRƯỚC. Nên phải giữ lại phản hồi trước (`phanHoiTruoc`). Làm sai
// chỗ này thì file nào cũng ghi ra nội dung của file kế bên — mà tên file vẫn đúng, nên rất khó thấy.
//
// Máy chủ KHÔNG bao giờ giữ nội dung file: nội dung đi thẳng cổng → tiện ích → đĩa.
import { goiCong, moPhien, dongPhien } from './portalBridge.js'
import { ghiVaoDia, moBoBaoCao, base64ThanhByte, byteThanhChu } from './tokhaiLuuDia.js'
import { layPhong } from './tokhaiPhong.js'

const API = '/api/admin/tokhai/tai-file'

// ⚠ TẠM TẮT PHẦN DỰNG PDF — anh chốt 28/09/2026: bản in ra còn sai, chờ nghiên cứu thêm.
// App chỉ lưu file XML gốc của cơ quan thuế, kế toán vẫn in tay từ HTKK như trước.
//
// Mã dựng PDF giữ nguyên ở lib/tokhaiPdf.js và bộ kiểm vẫn chạy, bật lại chỉ cần đổi cờ này.
// Trước khi bật lại: phải đối chiếu từng bản in với bản gốc cơ quan thuế phát, đặc biệt là thông
// báo TIẾP NHẬN (mẫu 01-1) vì chưa có bản gốc nào để soi.
export const DUNG_PDF = false

// ✅ PDF tờ khai ĐÚNG MẪU cổng thuế (anh yêu cầu 31/10/2026) — lib/tokhaiPdfMau.js, chép theo bản PDF cổng
// in ra từ XML. Chỉ các mẫu đã có bản gốc để đối chiếu: tờ khai 01/GTGT (mẫu mới kèm phụ lục giảm thuế NQ 204),
// 05/KK-TNCN (TT80) — mẫu cũ (PLATINUM) và mẫu mới (QUANG) chọn theo phiên bản XML — và thông báo CHẤP NHẬN
// 01-2/TB-TĐT. Mẫu khác / phụ lục chưa có bản gốc chỉ lưu XML như cũ. Thông báo TIẾP NHẬN không
// tải nữa (route tai-file bỏ qua, anh chốt 31/10/2026). Phông cắt gọn bằng lib/catPhong.js (~60–80 KB/file).
export const DUNG_PDF_MAU = true

const goiMayChu = body => fetch(API, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json())

const doiDuoi = (ten, duoi) => ten.replace(/\.[^.]+$/, '') + '.' + duoi

// Năm của thư mục 'Năm <nam>'. Máy chủ gửi sẵn theo KỲ TÍNH THUẾ; thiếu thì gỡ từ tên file
// (TK_GTGT_Q1.2026_THINHPHAT.xml). Không đoán bừa bằng năm hiện tại — tờ khai quý 4/2025 nộp
// tháng 1/2026 mà rơi vào 'Năm 2026' là kế toán tìm không ra.
function namCuaFile(ghiFile) {
  if (ghiFile.nam) return String(ghiFile.nam)
  const m = String(ghiFile.tenFile || '').match(/_(?:Q[1-4]|T\d{2}|NAM|PS\d+)\.(\d{4})_/)
  if (m) return m[1]
  throw new Error('không xác định được năm để chọn thư mục')
}

export const laFileNen = byte => byte.length > 1 && byte[0] === 0x50 && byte[1] === 0x4B   // 'PK'

// Giải nén DỰ PHÒNG, không qua thư viện: đọc MỤC LỤC TRUNG TÂM ở cuối file zip (nơi luôn ghi đúng
// cỡ từng phần — kể cả khi phần đầu mỗi file để cỡ 0 rồi ghi cỡ thật ở đuôi, kiểu nén "phát trực
// tiếp" mà nhiều máy chủ Java dùng), rồi bung bằng DecompressionStream có sẵn trong trình duyệt.
// Chỉ hỗ trợ hai kiểu thông dụng: 0 (không nén) và 8 (deflate).
export async function moNenDuPhong(byte) {
  const dv = new DataView(byte.buffer, byte.byteOffset, byte.byteLength)
  let cuoi = -1
  for (let i = byte.length - 22; i >= Math.max(0, byte.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { cuoi = i; break }
  }
  if (cuoi < 0) throw new Error('không thấy mục lục của file nén')
  const soMuc = dv.getUint16(cuoi + 10, true)
  let p = dv.getUint32(cuoi + 16, true)
  const ra = []
  for (let k = 0; k < soMuc; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('mục lục file nén hỏng')
    const kieuNen = dv.getUint16(p + 10, true)
    const coNen = dv.getUint32(p + 20, true)
    const dTen = dv.getUint16(p + 28, true)
    const dPhu = dv.getUint16(p + 30, true)
    const dGhiChu = dv.getUint16(p + 32, true)
    const viTri = dv.getUint32(p + 42, true)
    const ten = new TextDecoder().decode(byte.subarray(p + 46, p + 46 + dTen))
    p += 46 + dTen + dPhu + dGhiChu
    if (ten.endsWith('/')) continue
    const dau = viTri + 30 + dv.getUint16(viTri + 26, true) + dv.getUint16(viTri + 28, true)
    const nen = byte.subarray(dau, dau + coNen)
    let du
    if (kieuNen === 0) du = nen.slice()
    else if (kieuNen === 8) {
      const luong = new Blob([nen]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      du = new Uint8Array(await new Response(luong).arrayBuffer())
    } else throw new Error('kiểu nén ' + kieuNen + ' chưa hỗ trợ')
    ra.push({ goc: ten, du })
  }
  return ra
}

// Cổng trả TỜ KHAI dưới dạng .zip chỉ chứa đúng một file XML (đo thật 28/09: tên bên trong kiểu
// 'files_G12.18-260716-00198606_0.xml'). Phải mở ra: bộ file chuẩn của Savitax lưu XML chứ không
// lưu zip, mà có XML mới dựng được PDF — bản trước để nguyên .zip nên tờ khai không có PDF nào.
//
// Tên bên trong zip là tên máy, vô nghĩa với kế toán → đổi sang tên theo quy ước Savitax.
export async function moFileNen(byte, tenChuan) {
  const PizZip = (await import('pizzip')).default
  let phan = []
  try {
    const zip = new PizZip(byte)
    phan = Object.keys(zip.files)
      .filter(t => !zip.files[t].dir)
      .map(t => ({ goc: t, du: zip.files[t].asUint8Array() }))
  } catch { phan = [] }

  // GẶP THẬT 19/10/2026 ở DOEL: thông báo của mọi hồ sơ NỘP TỪ THÁNG 7/2026 (Q2 chính thức, Q1 bổ
  // sung) ra file 0 byte, không báo lỗi gì — kế toán mở ra trắng trơn; hồ sơ nộp tháng 4 thì bình
  // thường. pizzip đọc ra phần rỗng mà không kêu. Nên: pizzip không ra dữ liệu thì giải nén LẠI bằng
  // cách thứ hai (moNenDuPhong) trước khi chịu thua.
  if (!phan.some(p => p.du.length > 0)) {
    try {
      const duPhong = await moNenDuPhong(byte)
      if (duPhong.some(p => p.du.length > 0)) phan = duPhong
      else if (!phan.length) phan = duPhong
    } catch { /* để nguyên kết quả pizzip, báo lỗi ở dưới */ }
  }
  if (!phan.length) throw new Error('file nén rỗng')

  // Phần rỗng không bao giờ được làm file chính; rỗng hết thì báo lỗi kèm danh sách phần để biết
  // cổng trả gì.
  const coDuLieu = phan.filter(p => p.du.length > 0)
  if (!coDuLieu.length) {
    throw new Error('cổng trả file nén nhưng bên trong rỗng (' + phan.map(p => p.goc + ': 0 byte').join(', ') + ')')
  }
  const doDau = p => { try { return byteThanhChu(p.du.subarray(0, 400)) } catch { return '' } }
  const chinh = coDuLieu.find(p => /<(HSoThueDTu|TBaoThueDTu)/.test(doDau(p)))
    || coDuLieu.find(p => /\.xml$/i.test(p.goc))
    || coDuLieu[0]

  const goc = tenChuan.replace(/\.[^.]+$/, '')
  return coDuLieu.map(p => ({
    // File chính mang tên chuẩn; file kèm theo (nếu có) giữ tên gốc để khỏi lẫn.
    ten: p === chinh
      ? goc + ((p.goc.match(/\.[^.]+$/) || ['.xml'])[0])
      : `${goc}_${p.goc.replace(/[\\/]/g, '_')}`,
    du: p.du,
    laChinh: p === chinh,
  }))
}

// Ghi file cổng vừa trả, rồi dựng thêm bản PDF nếu đó là XML đọc được.
// Trả về danh sách tên file đã ghi thật.
async function ghiMotHoSo({ moThuMucNam, ghiFile, phanHoiTruoc, phong, baoLoi }) {
  const j = JSON.parse(phanHoiTruoc.noiDung || '{}')
  if (!j.content) throw new Error('cổng không trả nội dung')

  // Một lượt tải trải nhiều kỳ → nhiều năm → nhiều thư mục 'Năm <nam>' khác nhau. Phải hỏi lại
  // theo từng file, không lấy một thư mục rồi dùng cho cả lượt.
  const goc = await moThuMucNam(namCuaFile(ghiFile))

  const byte = base64ThanhByte(j.content)
  if (!byte.length) throw new Error('cổng trả nội dung rỗng' + (j.fileType ? ' (kiểu ' + j.fileType + ')' : ''))
  let cacPhan = [{ ten: ghiFile.tenFile, du: byte, laChinh: true }]
  if (laFileNen(byte)) {
    // Mở không được thì GIỮ NGUYÊN file nén, đừng để mất dữ liệu vừa tải về.
    try { cacPhan = await moFileNen(byte, ghiFile.tenFile) } catch (e) {
      if (/bên trong rỗng/.test(e.message)) {
        // Cả hai cách giải nén đều ra rỗng: ghi nguyên file .zip gốc làm BẰNG CHỨNG (Windows có thể
        // tự mở được, và có mẫu thật mới sửa tận gốc được), rồi báo lỗi để người tải biết.
        const tenZip = doiDuoi(ghiFile.tenFile, 'zip')
        await ghiVaoDia({ goc, duongDan: ghiFile.duongDan, tenFile: tenZip, duLieu: byte })
        throw new Error(e.message + ' — đã giữ nguyên file nén ' + tenZip + ', gửi file này cho bộ phận kỹ thuật')
      }
    }
  }

  const daGhi = []
  for (const p of cacPhan) {
    daGhi.push(await ghiVaoDia({ goc, duongDan: ghiFile.duongDan, tenFile: p.ten, duLieu: p.du }))
  }

  // Bản PDF chỉ dựng được từ XML.
  if (!DUNG_PDF && !DUNG_PDF_MAU) return daGhi
  const chinh = cacPhan.find(p => p.laChinh)
  if (!chinh || !/\.xml$/i.test(chinh.ten)) return daGhi

  const xml = byteThanhChu(chinh.du)
  const laThongBao = /<TBaoThueDTu/.test(xml)
  const laToKhai = /<HSoThueDTu/.test(xml)

  // Tờ khai / thông báo đúng mẫu cổng: dựng hỏng thì XML vẫn đã ghi — chỉ báo lỗi, không coi cả hồ sơ là
  // hỏng (hồ sơ hỏng thì lần sau tải lại, đẻ file _v2 cho XML).
  if ((laToKhai || laThongBao) && DUNG_PDF_MAU) {
    const { coTheDungPdfMau, dungPdfMau } = await import('./tokhaiPdfMau.js')
    if (!coTheDungPdfMau(xml).duoc) return daGhi
    const tenPdf = doiDuoi(chinh.ten, 'pdf')
    try {
      const pdf = await dungPdfMau(xml, phong)
      daGhi.push(await ghiVaoDia({ goc, duongDan: ghiFile.duongDan, tenFile: tenPdf, duLieu: pdf }))
    } catch (e) {
      baoLoi?.(`${tenPdf}: không dựng được bản PDF (${e.message}) — file XML đã lưu đủ`)
    }
    return daGhi
  }

  if (!DUNG_PDF) return daGhi
  if (!laThongBao && !laToKhai) return daGhi

  // Nạp bộ dựng PDF ngay lúc cần: gói pdf-lib khá nặng, không nên bắt mọi trang khác tải theo.
  const { dungPdfThongBao, dungPdfToKhai } = await import('./tokhaiPdf.js')
  const pdf = laThongBao
    ? await dungPdfThongBao(xml, phong)
    : await dungPdfToKhai(xml, phong)

  daGhi.push(await ghiVaoDia({
    goc, duongDan: ghiFile.duongDan, tenFile: doiDuoi(chinh.ten, 'pdf'), duLieu: pdf,
  }))
  return daGhi
}

export async function chayTaiFile({
  clientId, tuNgay, denNgay, taiLai = false, tayCty,
  onCaptcha, onTienDo, onFile,
}) {
  if (!tayCty) return { ket_qua: 'loi', moTa: 'Chưa xác định được thư mục của công ty này' }

  // Mỗi công ty MỘT phiên ảo riêng trong tiện ích. Nhờ vậy nhiều công ty chạy song song được, và
  // nhân viên gõ mã cho công ty kế tiếp ngay trong lúc công ty này đang tải file.
  const phien = 'tai-' + clientId + '-' + Date.now().toString(36)

  // Mở '…/Năm <nam>/7. BỘ BÁO CÁO' một lần cho mỗi năm rồi dùng lại: mỗi lần mở là một vòng quét
  // thư mục trên ổ chung Google Drive, không nên lặp cho từng file.
  const theoNam = new Map()
  const moThuMucNam = async nam => {
    if (!theoNam.has(nam)) theoNam.set(nam, await moBoBaoCao(tayCty, nam))
    return theoNam.get(nam)
  }

  // Nạp phông TRƯỚC khi mở phiên cổng: phông hỏng thì thà biết ngay, đừng để đăng nhập xong, gõ
  // captcha xong mới báo lỗi rồi phải làm lại từ đầu. Đang tắt dựng PDF thì khỏi tải 1,6 MB phông.
  let phong = null
  if (DUNG_PDF || DUNG_PDF_MAU) {
    try {
      phong = await layPhong()
    } catch (e) {
      return { ket_qua: 'loi', moTa: 'Không nạp được phông chữ để dựng PDF: ' + e.message }
    }
  }

  await moPhien(phien)

  const kd = await goiMayChu({ clientId, tuNgay, denNgay, taiLai })
  if (kd.error) { await dongPhien(phien); return { ket_qua: 'loi', moTa: kd.error } }

  const maPhien = kd.maPhien
  let buoc = kd
  let phanHoiTruoc = null

  // Báo cho máy chủ biết hồ sơ nào ĐÃ ghi được xuống đĩa, để lần sau khỏi tải lại.
  // Trước đây máy chủ có đọc cột file_path để bỏ qua, nhưng KHÔNG AI GHI cột đó — nên lần nào
  // chạy cũng tải lại từ đầu, đẻ ra file _v2, _v3 và gõ cửa cổng thêm mấy chục lượt vô ích.
  let baoDaGhi = null
  const goiTiep = async body => {
    const kq = await goiMayChu(baoDaGhi ? { ...body, daGhi: baoDaGhi } : body)
    baoDaGhi = null
    return kq
  }
  const dsFile = []
  const loiGhi = []

  // Đóng phiên ảo ở MỌI đường ra: không đóng thì cookie của công ty đó nằm lại trong bộ nhớ
  // tiện ích tới khi đóng trình duyệt.
  const ketThuc = async kq => {
    await dongPhien(phien)
    return { ...kq, dsFile, loiGhi }
  }

  for (let vong = 0; vong < 3000; vong++) {
    if (buoc.error) return await ketThuc({ ket_qua: 'loi', moTa: buoc.error })

    // Ghi file trước đã, rồi mới làm việc kế tiếp — kể cả khi việc kế tiếp là đăng xuất.
    if (buoc.ghiFile && phanHoiTruoc) {
      try {
        const ten = await ghiMotHoSo({ moThuMucNam, ghiFile: buoc.ghiFile, phanHoiTruoc, phong, baoLoi: m => loiGhi.push(m) })
        dsFile.push(...ten)
        if (onFile) onFile({ ten, duongDan: buoc.ghiFile.duongDan })
        // Chỉ đánh dấu khi ghi được TỜ KHAI, không tính thông báo: tờ khai là thứ đại diện cho
        // cả hồ sơ, và nếu sau đó thông báo ghi hỏng thì loiGhi vẫn hiện ra để chạy lại.
        if (!buoc.ghiFile.laThongBao && buoc.ghiFile.maHoSo) {
          baoDaGhi = {
            maHoSo: buoc.ghiFile.maHoSo,
            duongDan: [...buoc.ghiFile.duongDan, ten[0]].join('\\'),
          }
        }
      } catch (e) {
        loiGhi.push(`${buoc.ghiFile.tenFile}: ${e.message}`)
      }
      phanHoiTruoc = null
    }

    if (buoc.viec === 'xong') return await ketThuc({ ket_qua: 'xong', ...buoc })
    if (buoc.viec === 'loi') return await ketThuc({ ket_qua: 'loi', moTa: buoc.moTa })

    if (buoc.viec === 'go_captcha') {
      const ma = await onCaptcha({ anhCaptcha: buoc.anhCaptcha, nhan: buoc.nhan })
      if (!ma) {
        // Báo máy chủ đóng phiên ngay, nếu không công ty này bị khoá 'đang chạy' tới khi hết giờ.
        await goiMayChu({ maPhien, huy: true })
        return await ketThuc({ ket_qua: 'bo_qua', moTa: 'Người dùng dừng giữa chừng' })
      }
      phanHoiTruoc = null
      buoc = await goiTiep({ maPhien, captcha: ma })
      continue
    }

    // viec === 'goi'
    if (buoc.tienDo && onTienDo) onTienDo(buoc.tienDo)

    // Giãn nhịp GIAO CHO TIỆN ÍCH, không tự ngủ ở đây nữa. Chạy nhiều công ty cùng lúc mà mỗi
    // công ty tự ngủ riêng thì cổng vẫn nhận gấp đôi số lượt gọi — đúng thứ phải tránh. Tiện ích
    // có một hàng đợi chung nên nhịp tính trên TOÀN BỘ lượt gọi, bao nhiêu công ty cũng vậy.
    const phanHoi = await goiCong(buoc.yeuCau, { phien, nhip: buoc.nghi || 0 })
    phanHoiTruoc = phanHoi
    buoc = await goiTiep({ maPhien, phanHoi })
  }

  return await ketThuc({ ket_qua: 'loi', moTa: 'Chạy quá nhiều vòng, đã dừng để an toàn' })
}
