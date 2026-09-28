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
import { goiCong, donPhienCu } from './portalBridge'
import { ghiVaoDia, base64ThanhByte, byteThanhChu } from './tokhaiLuuDia'
import { layPhong } from './tokhaiPhong'

const API = '/api/admin/tokhai/tai-file'

const goiMayChu = body => fetch(API, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json())

const doiDuoi = (ten, duoi) => ten.replace(/\.[^.]+$/, '') + '.' + duoi

// Ghi file cổng vừa trả, rồi dựng thêm bản PDF nếu đó là XML đọc được.
// Trả về danh sách tên file đã ghi thật.
async function ghiMotHoSo({ goc, ghiFile, phanHoiTruoc, phong }) {
  const j = JSON.parse(phanHoiTruoc.noiDung || '{}')
  if (!j.content) throw new Error('cổng không trả nội dung')

  const byte = base64ThanhByte(j.content)
  const daGhi = []

  daGhi.push(await ghiVaoDia({
    goc, duongDan: ghiFile.duongDan, tenFile: ghiFile.tenFile, duLieu: byte,
  }))

  // Bản PDF chỉ dựng được từ XML. File nén (.zip) hoặc thứ khác thì giữ nguyên, không dựng.
  if (!/\.xml$/i.test(ghiFile.tenFile)) return daGhi

  const xml = byteThanhChu(byte)
  const laThongBao = /<TBaoThueDTu/.test(xml)
  const laToKhai = /<HSoThueDTu/.test(xml)
  if (!laThongBao && !laToKhai) return daGhi

  // Nạp bộ dựng PDF ngay lúc cần: gói pdf-lib khá nặng, không nên bắt mọi trang khác tải theo.
  const { dungPdfThongBao, dungPdfToKhai } = await import('./tokhaiPdf')
  const pdf = laThongBao
    ? await dungPdfThongBao(xml, phong)
    : await dungPdfToKhai(xml, phong)

  daGhi.push(await ghiVaoDia({
    goc, duongDan: ghiFile.duongDan, tenFile: doiDuoi(ghiFile.tenFile, 'pdf'), duLieu: pdf,
  }))
  return daGhi
}

export async function chayTaiFile({
  clientId, tuNgay, denNgay, taiLai = false, goc,
  onCaptcha, onTienDo, onFile,
}) {
  if (!goc) return { ket_qua: 'loi', moTa: 'Chưa chọn thư mục lưu file' }

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
        const ten = await ghiMotHoSo({ goc, ghiFile: buoc.ghiFile, phanHoiTruoc, phong })
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
