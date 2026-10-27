// Đọc một hóa đơn điện tử XML (TT78) — chỉ phần cần cho rủi ro thuế: số, ngày, người bán/mua, tổng tiền, hình thức thanh toán.
// Hình thức thanh toán là chữ người bán tự ghi: "Tiền mặt", "TM", "CK", "TM/CK", "Tiền mặt/Chuyển khoản"… — chỉ coi là
// TIỀN MẶT khi ghi đúng tiền mặt; ghi lẫn (TM/CK) thì "không rõ", phải đối chiếu sổ quỹ.

const NGUONG_TIEN_MAT = 5000000   // hóa đơn từ 5 triệu (gồm thuế) phải thanh toán không dùng tiền mặt

function the(xml, ten, trong) {
  const x = trong ? ((xml.match(new RegExp('<' + trong + '>([\\s\\S]*?)</' + trong + '>')) || [])[1] || '') : xml
  const m = x.match(new RegExp('<' + ten + '>([^<]*)<'))
  return m ? m[1].trim() : null
}
const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim()
const so0 = s => String(s || '').replace(/\D/g, '').replace(/^0+/, '')

export function loaiThanhToan(ht) {
  const s = boDau(ht)
  if (!s) return 'khong_ro'
  const tm = /tien mat|\btm\b/.test(s), ck = /chuyen khoan|\bck\b|ctcn|the|vi dien tu|bu tru|doi tru/.test(s)
  if (tm && !ck) return 'tien_mat'
  if (ck && !tm) return 'khong_tien_mat'
  return 'khong_ro'
}

// → { ok:true, so, kyHieu, ngay:'YYYY-MM-DD', mstBan, mstMua, tong, thanhToan, loaiTT } | { ok:false }
export function docHoaDonXml(xml) {
  const x = String(xml || '')
  if (!/<HDon\b/.test(x) || !/<DLHDon\b/.test(x)) return { ok: false }
  const ngay = (the(x, 'NLap') || '').slice(0, 10)
  const tong = Number(the(x, 'TgTTTBSo') || 0)
  const thanhToan = the(x, 'HTTToan') || ''
  return {
    ok: true, so: the(x, 'SHDon'), kyHieu: (the(x, 'KHMSHDon') || '') + (the(x, 'KHHDon') || ''), ngay,
    mstBan: the(x, 'MST', 'NBan'), mstMua: the(x, 'MST', 'NMua'),
    tong: Number.isFinite(tong) ? tong : 0, thanhToan, loaiTT: loaiThanhToan(thanhToan),
  }
}

// Gộp các hóa đơn mua vào của năm: Σ hóa đơn ≥ 5 triệu ghi thanh toán tiền mặt (+ đếm các hóa đơn ghi lẫn TM/CK).
// hoaDon: [kết quả docHoaDonXml], mstCty: MST công ty (chỉ lấy hóa đơn mà công ty là người mua).
export function tienMatTren5tr(hoaDon, { nam, mstCty }) {
  const cty = so0(mstCty), daCo = new Set()
  const ra = { soHoaDon: 0, tienMat: { so: 0, tien: 0 }, khongRo: { so: 0, tien: 0 } }
  for (const h of hoaDon || []) {
    if (!h?.ok || String(h.ngay).slice(0, 4) !== String(nam)) continue
    if (cty && so0(h.mstMua) !== cty) continue
    const khoa = `${so0(h.mstBan)}|${h.kyHieu}|${h.so}`
    if (daCo.has(khoa)) continue
    daCo.add(khoa); ra.soHoaDon++
    if (h.tong < NGUONG_TIEN_MAT) continue
    if (h.loaiTT === 'tien_mat') { ra.tienMat.so++; ra.tienMat.tien += h.tong }
    else if (h.loaiTT === 'khong_ro') { ra.khongRo.so++; ra.khongRo.tien += h.tong }
  }
  return ra
}
