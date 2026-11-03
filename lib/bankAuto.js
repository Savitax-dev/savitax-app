// Đối soát ngân hàng — TỰ XỬ LÝ (anh duyệt 01/11/2026: "kích hoạt ghi công nợ tự động với các khoản thanh toán đúng,
// áp dụng trước với các cty nợ tồn = 0đ"; "nhân viên đã ghi tay thì không đề xuất ghi thêm và khoá").
//
// Chạy khi VPS đẩy giao dịch mới (/api/bank/incoming) và khi mở trang Đối soát (quét các giao dịch còn mở).
//   1) TỰ GHI: chỉ khi phân loại ra "Sẵn sàng" (lib/bankMatch.js: nhận bằng MÃ KH hoặc MST + có kỳ + phí đáng tin + khớp
//      ĐÚNG phần còn phải thu) VÀ công ty KHÔNG còn nợ tồn (other_debt = 0) VÀ đề xuất không có dòng nợ tồn. Ghi bằng
//      đúng executePlan của nút "Ghi" (lib/bankPost.js), posted_by trống + post_detail.tuDong = true.
//   2) TỰ KHOÁ: phân loại ra "Đã khớp sổ" (nhân viên đã ghi tay chính khoản này) → đóng giao dịch như nút "Xác nhận khớp
//      sổ" (state 'ignored', ghi chú có chữ "khớp sổ") để không ai ghi trùng được nữa.
// Công ty còn nợ tồn, nhận theo TÊN, thiếu / thừa tiền… vẫn để người xem ("Cần xem") như cũ.
// Công tắc: TU_GHI_CONG_NO. Tắt = chỉ còn tự khoá khoản đã ghi tay.
import { classifyTransactions } from './bankData.js'
import { executePlan } from './bankPost.js'
import { ST_READY, ST_DONE } from './bankMatch.js'
// Giao dịch ghi nhiều phần (03/11/2026): phân loại + tự ghi + tự khớp sổ chạy trên PHẦN CÒN LẠI.
import { daGhiCuaGd, conLaiCuaGd, txConLai, themPhan } from './bankPhan.js'

export const TU_GHI_CONG_NO = true

const fmtDay = (iso) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0')
}
const KIND_LABEL = { ketoan: 'Kế toán', hcns: 'HCNS', no_ton: 'Nợ tồn' }

async function ghiLog(supabase, row) {
  try { await supabase.from('bank_action_logs').insert(row) } catch (e) { console.error('bankAuto log:', e?.message || e) }
}

// Đủ điều kiện tự ghi?
export function duocTuGhi(c) {
  return c.status === ST_READY && !!c.client?.id && ['code', 'mst'].includes(c.via)
    && (Number(c.otherDebt) || 0) === 0
    && Array.isArray(c.plan) && c.plan.length > 0 && c.plan.every(l => l.kind === 'ketoan' || l.kind === 'hcns')
}

// txIds: chỉ xử lý các giao dịch này (null = mọi giao dịch đang mở). Trả { tuGhi, tuKhoa, loi }.
export async function tuXuLyGiaoDich(supabase, txIds = null) {
  const kq = { tuGhi: [], tuKhoa: [], loi: [] }
  let q = supabase.from('bank_transactions').select('*').eq('state', 'open')
  if (txIds) { if (!txIds.length) return kq; q = q.in('id', txIds) }
  const { data: txs, error } = await q.order('tx_time').limit(1000)
  if (error || !txs?.length) return kq
  const ds = await classifyTransactions(supabase, txs.map(txConLai))

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i], c = ds[i]
    try {
      if (c.status === ST_DONE && c.client?.id) {
        const note = 'Tự khớp sổ — ' + (c.reason || 'nhân viên đã ghi tay')
        // Đã ghi một phần (khách chuyển gộp) → phần còn lại khớp sổ = ĐÃ GHI HẾT, giao dịch 'posted' (giữ các phần đã ghi)
        const motPhan = daGhiCuaGd(tx) > 0
        const { data } = await supabase.from('bank_transactions')
          .update({ state: motPhan ? 'posted' : 'ignored', posted_at: new Date().toISOString(), posted_by: null, client_id: c.client.id, note: note.slice(0, 500),
            ...(motPhan ? { post_detail: themPhan(tx, { kind: 'khop_so', amount: conLaiCuaGd(tx), reason: c.reason || null, tuDong: true }).post_detail } : {}),
            ...(c.period?.year && c.period?.month ? { period_year: c.period.year, period_month: c.period.month } : {}) })
          .eq('id', tx.id).eq('state', 'open').select('id')
        if (data?.length) {
          kq.tuKhoa.push(tx.id)
          await ghiLog(supabase, { tx_id: tx.id, client_id: c.client.id, action: 'ignore', detail: note.slice(0, 500), note: 'Tự động', staff_id: null })
        }
        continue
      }
      if (!TU_GHI_CONG_NO || !duocTuGhi(c)) continue
      // Giữ chỗ (2 lượt chạy song song chỉ một lượt qua) rồi mới ghi
      const { data: claimed } = await supabase.from('bank_transactions')
        .update({ state: 'posted', posted_at: new Date().toISOString(), posted_by: null, client_id: c.client.id })
        .eq('id', tx.id).eq('state', 'open').select('id')
      if (!claimed?.length) continue
      const res = await executePlan(supabase, c.client.id, c.plan, 'Đối soát NH ' + String(tx.source || '').toUpperCase() + ' ' + fmtDay(tx.tx_time) + ' (tự ghi)', null)
      const coPhanTruoc = daGhiCuaGd(tx) > 0
      if (!res.ok && !res.done.length) {
        await supabase.from('bank_transactions').update({ state: 'open', posted_at: tx.posted_at, posted_by: tx.posted_by,
          post_detail: coPhanTruoc ? tx.post_detail : { plan: c.plan, done: [], reason: c.reason, error: res.error || null, tuDong: true } }).eq('id', tx.id)
        kq.loi.push({ id: tx.id, error: res.error })
        continue
      }
      const moi = themPhan(tx, { kind: 'cong_no', plan: c.plan, done: res.done, reason: c.reason, error: res.error || null, tuDong: true,
        amount: conLaiCuaGd(tx) })   // nhận TRỌN phần còn lại (phần không ghi = đã ghi tay sẵn), như trước
      await supabase.from('bank_transactions').update({ post_detail: moi.post_detail, state: moi.dong ? 'posted' : 'open',
        note: res.ok ? 'Tự ghi công nợ' : 'LỖI GHI MỘT PHẦN — kiểm tra tay: ' + res.error }).eq('id', tx.id)
      await ghiLog(supabase, {
        tx_id: tx.id, client_id: c.client.id, action: 'post', staff_id: null, note: 'Tự động',
        detail: (res.ok ? 'Tự ghi công nợ: ' : 'Tự ghi được một phần: ')
          + res.done.map(l => (KIND_LABEL[l.kind] || l.kind) + (l.month ? ' T' + l.month + '/' + l.year : '') + ' ' + Number(l.amount).toLocaleString('vi-VN') + 'đ').join(' + ')
          + (res.ok ? '' : ' · LỖI: ' + res.error),
      })
      if (res.ok) kq.tuGhi.push(tx.id); else kq.loi.push({ id: tx.id, error: res.error })
    } catch (e) {
      kq.loi.push({ id: tx.id, error: e?.message || String(e) })
    }
  }
  return kq
}
