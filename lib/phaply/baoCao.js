// Phân hệ Pháp lý — báo cáo theo hồ sơ + hồ sơ treo + đếm hồ sơ theo nhân viên (kế hoạch mục 8.3, GĐ 6). Hàm THUẦN —
// kiểm offline scripts/test-phaply-bao-cao.mjs. Tiền lấy từ tongHopHoSo (lib/phaply/tien.js), KHÔNG tự cộng lại.
import { BUOC_DONG, treHan, homNayVN, thuTucLabel, loaiHinhLabel, buocLabel, choLabel } from './hoSo.js'

const ngay = iso => (iso ? homNayVN(new Date(iso)) : null)   // timestamptz → YYYY-MM-DD giờ VN
const soNgay = (tu, den) => (tu && den ? Math.round((Date.parse(den + 'T00:00:00Z') - Date.parse(String(tu).slice(0, 10) + 'T00:00:00Z')) / 86400000) : null)

// Hồ sơ có liên quan tới khoảng [tu, toi] (YYYY-MM): nhận trước hết kỳ và (chưa đóng hoặc đóng từ đầu kỳ)
export function trongKy(c, tu, toi) {
  const nhan = String(c.received_at || '').slice(0, 7)
  const dong = c.closed_at ? ngay(c.closed_at).slice(0, 7) : null
  return nhan && nhan <= toi && (!dong || dong >= tu)
}

// Một dòng "Báo cáo theo hồ sơ"
export function dongHoSo(c, th, { tenNv = () => '', homNay = homNayVN() } = {}) {
  const daDong = Number(c.stage) >= BUOC_DONG
  const ketThuc = daDong && c.closed_at ? ngay(c.closed_at) : homNay
  return {
    id: c.id, ma: c.code, ten: c.title || '', thu_tuc: thuTucLabel(c.procedure_code), loai_hinh: loaiHinhLabel(c.entity_type, true),
    phu_trach: c.assigned_to ? tenNv(c.assigned_to) : '(Chưa giao)', nhan: c.received_at, han: c.due_at || null,
    buoc: Number(c.stage), buoc_ten: buocLabel(Number(c.stage), true), cho: c.wait_state ? choLabel(c.wait_state) : '',
    da_dong: daDong, ngay_dong: daDong ? ngay(c.closed_at) : null,
    so_ngay: soNgay(c.received_at, ketThuc),
    // trễ: đang làm mà quá hạn nội bộ, hoặc đã đóng SAU hạn nội bộ
    tre: daDong ? !!(c.due_at && ketThuc > String(c.due_at).slice(0, 10)) : treHan(c, homNay),
    phi: th.phi, phi_dich_vu: th.phi_dich_vu, phi_thu_ho: th.phi_thu_ho, da_thu: th.da_thu, con_no: th.con_phai_thu, no_den_han: th.no_den_han,
  }
}

// "Hồ sơ treo" (cho trưởng phòng): hồ sơ CHƯA đóng đang chờ ai (khách / Sở / Thuế / cần bổ sung), hoặc quá hạn nội bộ, hoặc quá hạn
// nộp bổ sung. choTu = ngày bắt đầu trạng thái chờ hiện tại (nhật ký kind 'wait'); boSung = lần nộp mới nhất của hồ sơ.
export function dongTreo(c, { choTu = null, boSung = null, tenNv = () => '', homNay = homNayVN() } = {}) {
  if (Number(c.stage) >= BUOC_DONG) return null
  const quaHanBs = boSung?.ket_qua === 'bo_sung' && boSung.han_bo_sung && boSung.han_bo_sung < homNay
  const tre = treHan(c, homNay)
  if (!c.wait_state && !tre && !quaHanBs) return null
  return {
    id: c.id, ma: c.code, ten: c.title || '', phu_trach: c.assigned_to ? tenNv(c.assigned_to) : '(Chưa giao)',
    buoc_ten: buocLabel(Number(c.stage), true), cho: c.wait_state ? choLabel(c.wait_state) : '',
    so_ngay_cho: c.wait_state ? soNgay(choTu || c.received_at, homNay) : null,
    han: c.due_at || null, tre_noi_bo: tre, so_ngay_tre: tre ? soNgay(c.due_at, homNay) : null,
    han_bo_sung: boSung?.ket_qua === 'bo_sung' ? boSung.han_bo_sung : null, qua_han_bo_sung: !!quaHanBs,
    noi_dung_bo_sung: boSung?.ket_qua === 'bo_sung' ? boSung.noi_dung_bo_sung || '' : '',
  }
}
// Xếp: quá hạn bổ sung → trễ nội bộ → chờ lâu nhất
export const xepTreo = ds => [...ds].sort((a, b) => (b.qua_han_bo_sung - a.qua_han_bo_sung) || (b.tre_noi_bo - a.tre_noi_bo) || ((b.so_ngay_cho ?? -1) - (a.so_ngay_cho ?? -1)))

// Đếm hồ sơ theo nhân viên ĐANG phụ trách trong từng tháng: mới (nhận trong tháng), xong (đóng trong tháng), đang làm (cuối tháng chưa đóng)
export function demHoSoNv(cases, thangs) {
  const ra = new Map()
  for (const c of cases) {
    const k = c.assigned_to || '_'
    if (!ra.has(k)) ra.set(k, thangs.map(() => ({ moi: 0, xong: 0, dang: 0 })))
    const nhan = String(c.received_at || '').slice(0, 7), dong = c.closed_at ? ngay(c.closed_at).slice(0, 7) : null
    thangs.forEach((m, i) => {
      const o = ra.get(k)[i]
      if (nhan === m) o.moi++
      if (dong === m) o.xong++
      if (nhan && nhan <= m && (!dong || dong > m)) o.dang++
    })
  }
  return ra
}
