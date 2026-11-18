// Phân hệ Pháp lý ↔ Đối soát ngân hàng — phần MÁY CHỦ (service role). Hàm thuần ở lib/phaply/nganHang.js.
// Route dùng: app/api/admin/bank-transactions (quyền bank_reconcile — người đối soát xem TOÀN BỘ giao dịch).
import { docHet } from './quyen.js'
import { docTienNhieuHoSo, docHoSoDayDu } from './hoSoMayChu.js'
import { tongHopHoSo } from './tien.js'
import { phanBoVaoDot } from './nganHang.js'

const COT = 'id, code, title, stage, received_at, assigned_to, is_deleted, contact_name'

async function kemTien(admin, ds) {
  const tien = await docTienNhieuHoSo(admin, ds.map(h => h.id))
  return ds.map(h => {
    const x = tien.get(h.id)
    const t = tongHopHoSo({ hoSo: h, fees: x.fees, dots: x.dots, payments: x.payments, nhatKy: x.nhatKy })
    return {
      id: h.id, code: h.code, title: h.title, contact: h.contact_name || '',
      phi: t.phi, da_thu: t.da_thu, con: t.con_phai_thu, no_den_han: t.no_den_han,
      dots: t.dots.filter(d => d.con > 0).map(d => ({ id: d.id, name: d.name || 'Đợt ' + d.seq, con: d.con, da_den_han: d.da_den_han })),
    }
  })
}

// Mọi hồ sơ pháp lý còn phải thu — cho ô "Hồ sơ pháp lý" ghép tay ở trang đối soát
export async function hoSoPhapLyConNo(admin) {
  const ds = await docHet((a, b) => admin.from('legal_cases').select(COT).eq('is_deleted', false).order('id').range(a, b))
  return (await kemTien(admin, ds)).filter(h => h.con > 0).sort((a, b) => String(b.code).localeCompare(String(a.code)))
}

// Hồ sơ theo mã đọc được từ nội dung chuyển khoản: Map code → hồ sơ (kèm tiền)
export async function hoSoTheoMa(admin, codes) {
  const ra = new Map()
  if (!codes.length) return ra
  const { data } = await admin.from('legal_cases').select(COT).in('code', codes).eq('is_deleted', false)
  for (const h of await kemTien(admin, data || [])) ra.set(h.code, h)
  return ra
}

// Ghi tiền khách trả từ ngân hàng vào công nợ pháp lý: chia vào các đợt còn nợ (đợt cũ trước), mỗi đợt một dòng
// legal_case_payments. Doanh số tính người PHỤ TRÁCH hồ sơ (như nút Ghi thu). Trả { ok, ids, phan, conSau } | { loi }.
export async function ghiThuTuNganHang(admin, { caseId, soTien, paidAt, staffId, ghiChu }) {
  const d = await docHoSoDayDu(admin, caseId)
  if (!d || d.ho_so.is_deleted) return { loi: 'Không tìm thấy hồ sơ pháp lý' }
  const con = d.tien.con_phai_thu
  if (soTien > con) return { loi: `Số tiền ghi (${soTien.toLocaleString('vi-VN')}đ) lớn hơn phần còn phải thu của hồ sơ ${d.ho_so.code} (${Math.max(0, con).toLocaleString('vi-VN')}đ)` }
  const { phan, du } = phanBoVaoDot(d.tien, soTien)
  if (du > 0 || !phan.length) return { loi: 'Không chia được số tiền vào công nợ hồ sơ — kiểm lại các khoản phí / lịch thu ở tab Công nợ' }
  const rows = phan.map(p => ({
    case_id: caseId, installment_id: p.installment_id, amount_dich_vu: p.amount_dich_vu, amount_thu_ho: p.amount_thu_ho,
    paid_at: paidAt, staff_id: d.ho_so.assigned_to || staffId, method: 'chuyen_khoan', note: ghiChu, created_by: staffId,
  }))
  const { data, error } = await admin.from('legal_case_payments').insert(rows).select('id')
  if (error) return { loi: 'Chưa ghi được: ' + error.message }
  return { ok: true, ids: (data || []).map(x => x.id), phan, code: d.ho_so.code, title: d.ho_so.title, conSau: con - soTien }
}
