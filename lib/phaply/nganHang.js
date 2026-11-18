// Phân hệ Pháp lý ↔ Đối soát ngân hàng (/bank) — hàm THUẦN (anh yêu cầu 18/11/2026: "nối Đối soát ngân hàng để tự nhận nội dung
// thanh toán ghép với công nợ phòng pháp lý, mở ghép tay luôn"). Máy chủ: lib/phaply/nganHangMayChu.js + route bank-transactions.
//
// Nội dung chuyển khoản phiếu ĐNTT pháp lý in: "PL261192_ThanhToan_Phidichvu_11_2026" (mã hồ sơ PL-2611-92 bỏ gạch).
// Ngân hàng hay đổi "_" thành khoảng trắng / bỏ hẳn, viết hoa, khách gõ tay "PL-2611-92" / "PL 2611 92" → nhận mọi kiểu.
import { tachKhoanThu } from './tien.js'

const so = v => Number(v) || 0

// Nội dung CK → các mã hồ sơ "PL-YYMM-NN" (không trùng). Trước "PL" không được là chữ / số (tránh "APPLE…", "KPL…").
export function docMaHoSo(noiDung) {
  const s = String(noiDung || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const ra = new Set()
  for (const m of s.matchAll(/(?<![A-Z0-9])PL[\s._\-/]*(\d{2})(\d{2})[\s._\-/]*(\d{2,3})(?!\d)/g)) {
    const thang = Number(m[2])
    if (thang < 1 || thang > 12) continue
    ra.add(`PL-${m[1]}${m[2]}-${m[3]}`)
  }
  return [...ra]
}

// Chia số tiền khách trả vào các ĐỢT còn nợ, đợt cũ (seq nhỏ) trước; mỗi phần trừ THU HỘ còn thiếu của đợt trước (giống nút
// "Ghi thu" ở tab Công nợ — tachKhoanThu). Hồ sơ chưa lập đợt → một khoản không gắn đợt.
// tien: tongHopHoSo(...). Trả { phan: [{ installment_id, amount_dich_vu, amount_thu_ho }], du } — du = phần VƯỢT còn phải thu.
export function phanBoVaoDot(tien, soTien) {
  let con = Math.max(0, Math.round(so(soTien)))
  const phan = []
  const dots = [...(tien.dots || [])].filter(d => so(d.con) > 0).sort((a, b) => so(a.seq) - so(b.seq))
  if (dots.length) {
    for (const d of dots) {
      if (!con) break
      const lay = Math.min(con, so(d.con))
      phan.push({ installment_id: d.id, ...tachKhoanThu(lay, Math.max(0, so(d.con_thu_ho))) })
      con -= lay
    }
  }
  // chưa lập đợt — hoặc lịch thu chưa phủ hết tổng phí (thẻ Công nợ đang báo "lịch thu chưa khớp") → phần còn lại không gắn đợt
  const daChia = phan.reduce((a, p) => a + p.amount_dich_vu + p.amount_thu_ho, 0)
  const conHoSo = so(tien.con_phai_thu) - daChia
  if (con && conHoSo > 0) {
    const lay = Math.min(con, conHoSo)
    const thDaChia = phan.reduce((a, p) => a + p.amount_thu_ho, 0)
    phan.push({ installment_id: null, ...tachKhoanThu(lay, Math.max(0, so(tien.phi_thu_ho) - so(tien.da_thu_thu_ho) - thDaChia)) })
    con -= lay
  }
  return { phan, du: con }
}
