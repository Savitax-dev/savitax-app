// Tiền lương — DOANH THU + THƯỞNG của PHÒNG HCNS (anh chốt 03/11/2026, áp dụng từ kỳ lương tháng 10/2026).
//
// Nhân viên phòng HCNS (staff.room_id là phòng type 'hcns'):
//   • Doanh thu THỜI KỲ  = phí HCNS hằng tháng (chưa VAT; công ty quý ÷ 3) của công ty HCNS Thời kỳ mình phụ trách
//     (hcns_clients.assigned_to), công ty kế toán gốc đang dùng DV HCNS. "Thời kỳ – Phát sinh" không thu phí riêng.
//     Phí PHẢI THU theo kỳ, không xét đã thu — giống doanh thu kế toán.
//   • Doanh thu THỜI ĐIỂM = tiền khách trả TRONG THÁNG cho hồ sơ Thời điểm mình phụ trách (chưa VAT) — cùng luật với
//     thưởng DVK HCNS (lib/luong/dvkHcns.js). Vẫn GIỮ khai thưởng DVK (anh chọn — một khoản có thể được thưởng 2 lần).
//   • Thưởng: (thời kỳ + thời điểm − mức tối thiểu) × 20%, vượt mới có — thời kỳ vượt cũng được thưởng
//     (anh đổi 04/11/2026; trước đó chỉ phần thời điểm dư mới × 20%).
// Trưởng phòng HCNS (vai trò hcns_leader ở phòng HCNS, kể cả kiêm nhiệm): thưởng doanh số phòng = 1% × TỔNG DOANH THU
// THỜI KỲ của nhân viên phòng HCNS, TỐI ĐA bằng tổng mức tối thiểu (anh chốt lại 03/11/2026: "chưa đạt 79tr thì tổng
// doanh thu thời kỳ × 1%"; vd tối thiểu 28 tr + 51 tr = 79 tr, thời kỳ 83,9 tr → 790.000; thời kỳ 70 tr → 700.000).
import { resolveHcnsFeeForMonth } from '../hcnsFee.js'
import { countsForMonth } from '../contractDates.js'
import { docCtyDacThu } from '../ctyDacThu.js'
import { hoSoHcnsChonDuoc } from './dvkHcns.js'

export const TY_LE_VUOT = 0.2
const VAT = 1.08

// Hàm THUẦN — thưởng vượt của một nhân viên HCNS. Chưa đặt mức tối thiểu → không thưởng.
export function thuongVuotHcns({ thoiKy, thoiDiem, toiThieu }) {
  const tk = Math.round(Number(thoiKy) || 0), td = Math.round(Number(thoiDiem) || 0)
  if (toiThieu === null || toiThieu === undefined || toiThieu === '') return { thieu: null, vuot: 0, thuong: 0 }
  const chenh = tk + td - Math.round(Number(toiThieu))
  const vuot = Math.max(0, chenh)
  return { thieu: Math.max(0, -chenh), vuot, thuong: Math.round(vuot * TY_LE_VUOT) }
}

// Lật trang có sắp theo id — PostgREST cắt im lặng ở 1000 dòng.
async function docHet(q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

// Map staffId → { thoiKy, soCtyThoiKy, thoiDiem, soDvThoiDiem, congTy: [...], hoSo: [...] } (tiền CHƯA VAT).
// Bản clone không có HCNS (thiếu bảng) → Map rỗng.
export async function doanhThuHcnsTheoNhanVien(supabase, nam, thang) {
  const out = new Map()
  const lay = id => { if (!out.has(id)) out.set(id, { thoiKy: 0, soCtyThoiKy: 0, thoiDiem: 0, soDvThoiDiem: 0, congTy: [], hoSo: [] }); return out.get(id) }
  let links
  try {
    links = await docHet(() => supabase.from('hcns_clients').select('id, name, assigned_to, hcns_fee, fee_period, created_at, linked_client_id, is_active').eq('category', 'thoi_ky'))
  } catch { return out }
  links = links.filter(l => l.assigned_to && l.linked_client_id)
  if (links.length) {
    const ids = [...new Set(links.map(l => l.linked_client_id))]
    const cty = [], plans = []
    for (let i = 0; i < ids.length; i += 200) {
      cty.push(...await docHet(() => supabase.from('clients').select('id, name, client_code, uses_hcns, status, service_end, contract_start, created_at').in('id', ids.slice(i, i + 200))))
    }
    const lo = links.map(l => l.id)
    for (let i = 0; i < lo.length; i += 200) {
      for (const f of await docHet(() => supabase.from('hcns_service_fees').select('id, hcns_client_id, year, month, amount').eq('type', 'fee_plan').in('hcns_client_id', lo.slice(i, i + 200))))
        plans.push({ ...f, client_id: f.hcns_client_id })
    }
    const ctyMap = new Map(cty.map(c => [c.id, c]))
    const khongVat = (await docCtyDacThu(supabase)).khongVat
    for (const l of links) {
      const c = ctyMap.get(l.linked_client_id)
      // clients.uses_hcns là NGUỒN ĐÚNG (AGENTS.md); công ty phải đang được tính ở tháng này (HĐ, ngưng dịch vụ)
      if (!c || c.uses_hcns !== true || !l.is_active || !countsForMonth(c, nam, thang)) continue
      if (c.status !== 'active' && !c.service_end) continue
      const phi = resolveHcnsFeeForMonth(plans, l.id, nam, thang, Number(l.hcns_fee) || 0, l.created_at)
      const thangPhi = phi / (l.fee_period === 'quarterly' ? 3 : 1)
      const dt = Math.round(khongVat.has(c.id) ? thangPhi : thangPhi / VAT)
      if (dt <= 0) continue
      const x = lay(l.assigned_to)
      x.thoiKy += dt; x.soCtyThoiKy++
      x.congTy.push({ id: c.id, ten: c.name, ma: c.client_code || '', phiKy: phi, quy: l.fee_period === 'quarterly', doanhThu: dt })
    }
  }
  // Thời điểm: tiền khách trả trong tháng, chia theo dịch vụ, cộng cho người phụ trách hồ sơ
  const td = await hoSoHcnsChonDuoc(supabase, { staffId: null, roomIds: [] }, { admin: true }, { nam, thang })
  for (const d of td) {
    if (!d.nvPhuTrach) continue
    const x = lay(d.nvPhuTrach)
    const dt = Math.round(d.daThu / VAT)
    x.thoiDiem += dt; x.soDvThoiDiem++
    x.hoSo.push({ ten: d.ten, cty: d.cty, ky: d.ky, thu: d.daThu, doanhThu: dt })
  }
  return out
}
