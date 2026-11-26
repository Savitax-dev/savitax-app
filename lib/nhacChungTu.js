// Hàm thuần cho trang "Mẫu nhắc khách gửi chứng từ" (/nhac-chung-tu) — app dựng sẵn ảnh thông báo + lời nhắn, nhân viên
// chép sang nhóm Zalo của khách và tự tick Checklist. Không gọi mạng, không đọc DB. Bộ kiểm: node scripts/test-nhac-chung-tu.mjs
//
// (Bản bot tự đăng vào nhóm khách nằm ở nhánh local `thu/zalo-bot-gui-nhom` — gói Zalo Bot miễn phí chỉ cho 3 nhóm.)

// Thông báo chứng từ THÁNG M được gửi trong checklist THÁNG M+1 (hạn ngày 5): chứng từ T12/2026 → checklist T1/2027.
export function thangChecklist(kyNam, kyThang) {
  return kyThang === 12 ? { nam: kyNam + 1, thang: 1 } : { nam: kyNam, thang: kyThang + 1 }
}

// Kỳ mặc định khi mở trang: từ ngày 20 trở đi là chứng từ của CHÍNH tháng này (gửi đầu tháng sau), trước đó là tháng trước.
export function kyMacDinh(homNay = new Date()) {
  const d = new Date(homNay.getTime() + 7 * 3600e3)   // giờ VN
  let nam = d.getUTCFullYear(), thang = d.getUTCMonth() + 1
  if (d.getUTCDate() < 20) { thang--; if (!thang) { thang = 12; nam-- } }
  return { nam, thang }
}

const hai = n => String(n).padStart(2, '0')

// Lời nhắn mặc định — chép theo tin Kiều Tiên gửi thật 26/11/2026. {..} được thay theo từng công ty.
export const MAU_LOI_NHAN = {
  quy: 'SAVITAX gửi Quý Khách hàng. Em nhờ bên mình tổng hợp tất cả chứng từ của Tháng {thang}/{nam} gửi trước ngày {han} để em nhập liệu dần để Báo cáo thuế {kyBaoCao} ạ.\nEm cảm ơn ạ.',
  thang: 'SAVITAX gửi Quý Khách hàng. Em nhờ bên mình tổng hợp tất cả chứng từ của Tháng {thang}/{nam} gửi trước ngày {han} để em làm Báo cáo thuế {kyBaoCao} ạ.\nEm cảm ơn ạ.',
}

// Thay {thang} {nam} {han} {kyBaoCao} {tenCty} {maKH}. kyKhai: 'thang' | 'quy'.
export function dienLoiNhan(mau, { kyNam, kyThang, kyKhai, tenCty = '', maKH = '' }) {
  const ck = thangChecklist(kyNam, kyThang)
  const han = `10/${hai(ck.thang)}/${ck.nam}`
  const kyBaoCao = kyKhai === 'thang' ? `tháng ${kyThang}/${kyNam}` : `Quý ${Math.ceil(kyThang / 3)}/${kyNam}`
  return String(mau || '')
    .replaceAll('{thang}', String(kyThang)).replaceAll('{nam}', String(kyNam)).replaceAll('{han}', han)
    .replaceAll('{kyBaoCao}', kyBaoCao).replaceAll('{tenCty}', tenCty).replaceAll('{maKH}', maKH)
    // Zalo hiện MỖI lần xuống dòng thành một khoảng cách lớn — dòng trống thành khoảng hở gấp đôi (anh chê 26/11/2026)
    .replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim()
    .slice(0, 2000)
}
