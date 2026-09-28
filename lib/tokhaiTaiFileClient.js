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
import { goiCong, donPhienCu } from './portalBridge.js'
import { ghiVaoDia, moBoBaoCao, base64ThanhByte, byteThanhChu } from './tokhaiLuuDia.js'
import { layPhong } from './tokhaiPhong.js'

const API = '/api/admin/tokhai/tai-file'

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

// Cổng trả TỜ KHAI dưới dạng .zip chỉ chứa đúng một file XML (đo thật 28/09: tên bên trong kiểu
// 'files_G12.18-260716-00198606_0.xml'). Phải mở ra: bộ file chuẩn của Savitax lưu XML chứ không
// lưu zip, mà có XML mới dựng được PDF — bản trước để nguyên .zip nên tờ khai không có PDF nào.
//
// Tên bên trong zip là tên máy, vô nghĩa với kế toán → đổi sang tên theo quy ước Savitax.
export async function moFileNen(byte, tenChuan) {
  const PizZip = (await import('pizzip')).default
  const zip = new PizZip(byte)
  const phan = Object.keys(zip.files)
    .filter(t => !zip.files[t].dir)
    .map(t => ({ goc: t, du: zip.files[t].asUint8Array() }))
  if (!phan.length) throw new Error('file nén rỗng')

  const doDau = p => { try { return byteThanhChu(p.du.subarray(0, 400)) } catch { return '' } }
  const chinh = phan.find(p => /<(HSoThueDTu|TBaoThueDTu)/.test(doDau(p)))
    || phan.find(p => /\.xml$/i.test(p.goc))
    || phan[0]

  const goc = tenChuan.replace(/\.[^.]+$/, '')
  return phan.map(p => ({
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
async function ghiMotHoSo({ moThuMucNam, ghiFile, phanHoiTruoc, phong }) {
  const j = JSON.parse(phanHoiTruoc.noiDung || '{}')
  if (!j.content) throw new Error('cổng không trả nội dung')

  // Một lượt tải trải nhiều kỳ → nhiều năm → nhiều thư mục 'Năm <nam>' khác nhau. Phải hỏi lại
  // theo từng file, không lấy một thư mục rồi dùng cho cả lượt.
  const goc = await moThuMucNam(namCuaFile(ghiFile))

  const byte = base64ThanhByte(j.content)
  let cacPhan = [{ ten: ghiFile.tenFile, du: byte, laChinh: true }]
  if (laFileNen(byte)) {
    // Mở không được thì GIỮ NGUYÊN file nén, đừng để mất dữ liệu vừa tải về.
    try { cacPhan = await moFileNen(byte, ghiFile.tenFile) } catch { /* giữ nguyên .zip */ }
  }

  const daGhi = []
  for (const p of cacPhan) {
    daGhi.push(await ghiVaoDia({ goc, duongDan: ghiFile.duongDan, tenFile: p.ten, duLieu: p.du }))
  }

  // Bản PDF chỉ dựng được từ XML.
  const chinh = cacPhan.find(p => p.laChinh)
  if (!chinh || !/\.xml$/i.test(chinh.ten)) return daGhi

  const xml = byteThanhChu(chinh.du)
  const laThongBao = /<TBaoThueDTu/.test(xml)
  const laToKhai = /<HSoThueDTu/.test(xml)
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

  // Mở '…/Năm <nam>/7. BỘ BÁO CÁO' một lần cho mỗi năm rồi dùng lại: mỗi lần mở là một vòng quét
  // thư mục trên ổ chung Google Drive, không nên lặp cho từng file.
  const theoNam = new Map()
  const moThuMucNam = async nam => {
    if (!theoNam.has(nam)) theoNam.set(nam, await moBoBaoCao(tayCty, nam))
    return theoNam.get(nam)
  }

  // Nạp phông TRƯỚC khi mở phiên cổng: phông hỏng thì thà biết ngay, đừng để đăng nhập xong, gõ
  // captcha xong mới báo lỗi rồi phải làm lại từ đầu.
  let phong
  try {
    phong = await layPhong()
  } catch (e) {
    return { ket_qua: 'loi', moTa: 'Không nạp được phông chữ để dựng PDF: ' + e.message }
  }

  await donPhienCu()

  const kd = await goiMayChu({ clientId, tuNgay, denNgay, taiLai })
  if (kd.error) return { ket_qua: 'loi', moTa: kd.error }

  const maPhien = kd.maPhien
  let buoc = kd
  let phanHoiTruoc = null
  const dsFile = []
  const loiGhi = []

  const ketThuc = kq => ({ ...kq, dsFile, loiGhi })

  for (let vong = 0; vong < 3000; vong++) {
    if (buoc.error) return ketThuc({ ket_qua: 'loi', moTa: buoc.error })

    // Ghi file trước đã, rồi mới làm việc kế tiếp — kể cả khi việc kế tiếp là đăng xuất.
    if (buoc.ghiFile && phanHoiTruoc) {
      try {
        const ten = await ghiMotHoSo({ moThuMucNam, ghiFile: buoc.ghiFile, phanHoiTruoc, phong })
        dsFile.push(...ten)
        if (onFile) onFile({ ten, duongDan: buoc.ghiFile.duongDan })
      } catch (e) {
        loiGhi.push(`${buoc.ghiFile.tenFile}: ${e.message}`)
      }
      phanHoiTruoc = null
    }

    if (buoc.viec === 'xong') return ketThuc({ ket_qua: 'xong', ...buoc })
    if (buoc.viec === 'loi') return ketThuc({ ket_qua: 'loi', moTa: buoc.moTa })

    if (buoc.viec === 'go_captcha') {
      const ma = await onCaptcha({ anhCaptcha: buoc.anhCaptcha, nhan: buoc.nhan })
      if (!ma) {
        // Báo máy chủ đóng phiên ngay, nếu không công ty này bị khoá 'đang chạy' tới khi hết giờ.
        await goiMayChu({ maPhien, huy: true })
        return ketThuc({ ket_qua: 'bo_qua', moTa: 'Người dùng dừng giữa chừng' })
      }
      phanHoiTruoc = null
      buoc = await goiMayChu({ maPhien, captcha: ma })
      continue
    }

    // viec === 'goi'
    if (buoc.tienDo && onTienDo) onTienDo(buoc.tienDo)
    if (buoc.nghi) await new Promise(r => setTimeout(r, buoc.nghi))

    const phanHoi = await goiCong(buoc.yeuCau)
    phanHoiTruoc = phanHoi
    buoc = await goiMayChu({ maPhien, phanHoi })
  }

  return ketThuc({ ket_qua: 'loi', moTa: 'Chạy quá nhiều vòng, đã dừng để an toàn' })
}
