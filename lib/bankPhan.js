// Đối soát ngân hàng — MỘT giao dịch GHI NHIỀU PHẦN (anh duyệt 03/11/2026, ca Ý CƠ: khách chuyển gộp 3.780.000 =
// HCNS Thời điểm 1.620.000 + phí kế toán 2.160.000, trước đây ghi xong phần HCNS là giao dịch đóng luôn).
//
// post_detail.parts = [{ kind, amount, luc, ... }] — mỗi lần ghi là một phần:
//   cong_no       : phí kế toán / HCNS thời kỳ / nợ tồn theo đề xuất (plan + done của executePlan). Một lần "Ghi công nợ"
//                   NHẬN TRỌN phần còn lại của giao dịch (amount = phần còn lại) — đề xuất đã tính cả khoản nhân viên ghi tay
//                   sẵn ("app đã ghi sẵn X — chỉ ghi phần còn thiếu"), y như trước khi có ghi nhiều phần. Vì vậy khách chuyển
//                   gộp thì ghi phần HỒ SƠ (Dịch vụ khác / HCNS Thời điểm, số tiền nhập tay) TRƯỚC, phần kế toán ghi SAU CÙNG.
//   other_service : hồ sơ Dịch vụ khác      hcns_case : hồ sơ HCNS Thời điểm
//   khop_so       : phần còn lại nhân viên ĐÃ GHI TAY ở công nợ (không ghi tiền thêm)
//   dong_con_lai  : người dùng đóng phần còn lại (không phải phí dịch vụ…)
// Giao dịch còn tiền chưa ghi thì vẫn state 'open' và được PHÂN LOẠI THEO PHẦN CÒN LẠI (txConLai) — đề xuất kế toán,
// tự ghi, tự khớp sổ đều chạy trên số còn lại. Ghi hết mới 'posted'.
// Bản ghi cũ (trước 03/11/2026) chỉ có MỘT chi tiết không có `parts` → phanDaGhi dựng lại thành một phần.

const so = v => Math.round(Number(v) || 0)

export function phanDaGhi(tx) {
  const pd = tx?.post_detail
  if (!pd) return []
  if (Array.isArray(pd.parts)) return pd.parts.filter(p => so(p.amount) > 0)
  // Chi tiết cũ chỉ có ý nghĩa khi giao dịch đã đóng do GHI — 'open' mang chi tiết là lần ghi lỗi chưa ghi được gì.
  if (tx.state !== 'posted') return []
  if (pd.kind === 'other_service' || pd.kind === 'hcns_case') return so(pd.amount) > 0 ? [{ ...pd, amount: so(pd.amount) }] : []
  // Ghi công nợ kiểu cũ luôn xử lý TRỌN giao dịch (phần không ghi là phần nhân viên đã ghi tay sẵn).
  if (Array.isArray(pd.done)) {
    return pd.done.length ? [{ kind: 'cong_no', plan: pd.plan || null, done: pd.done, reason: pd.reason || null, tuDong: !!pd.tuDong, amount: so(tx.amount) }] : []
  }
  return []
}

export const daGhiCuaGd = tx => phanDaGhi(tx).reduce((a, p) => a + so(p.amount), 0)
export const conLaiCuaGd = tx => Math.max(0, so(tx?.amount) - daGhiCuaGd(tx))

// Bản sao giao dịch với số tiền = PHẦN CÒN LẠI — đưa vào classifyTransactions để đề xuất / tự ghi / khớp sổ đúng phần dư.
export const txConLai = tx => (daGhiCuaGd(tx) > 0 ? { ...tx, amount: conLaiCuaGd(tx) } : tx)

// post_detail mới sau khi thêm một phần. Trả { post_detail, conLai, dong } — dong = đã ghi hết, đóng giao dịch.
export function themPhan(tx, phan, luc = new Date().toISOString()) {
  const parts = [...phanDaGhi(tx), { ...phan, amount: so(phan.amount), luc }]
  const daGhi = parts.reduce((a, p) => a + so(p.amount), 0)
  const conLai = Math.max(0, so(tx.amount) - daGhi)
  return { post_detail: { parts }, conLai, dong: conLai === 0 }
}

// Một dòng chữ cho từng phần — thẻ giao dịch + nhật ký.
const KIND_LABEL = { ketoan: 'Kế toán', hcns: 'HCNS', no_ton: 'Nợ tồn' }
export function moTaPhan(p) {
  const tien = so(p.amount).toLocaleString('vi-VN') + 'đ'
  if (p.kind === 'other_service') return 'Dịch vụ khác "' + (p.name || '') + '" ' + tien
  if (p.kind === 'hcns_case') return 'HCNS Thời điểm "' + (p.name || '') + '" ' + tien
  if (p.kind === 'khop_so') return 'Khớp sổ (đã ghi tay) ' + tien + (p.reason ? ' — ' + p.reason : '')
  if (p.kind === 'dong_con_lai') return 'Đóng phần còn lại ' + tien + (p.note ? ' — ' + p.note : '')
  if (Array.isArray(p.done) && p.done.length) {
    const ghi = p.done.reduce((a, l) => a + so(l.amount), 0)
    return p.done.map(l => (KIND_LABEL[l.kind] || l.kind) + (l.month ? ' T' + l.month + '/' + l.year : '') + ' ' + so(l.amount).toLocaleString('vi-VN') + 'đ').join(' + ')
      + (so(p.amount) > ghi ? ' · ' + (so(p.amount) - ghi).toLocaleString('vi-VN') + 'đ đã ghi tay sẵn' : '')
  }
  return 'Công nợ ' + tien
}
