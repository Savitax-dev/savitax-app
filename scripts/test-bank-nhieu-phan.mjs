// Kiểm "một giao dịch ngân hàng ghi nhiều phần" (lib/bankPhan.js — anh duyệt 03/11/2026, ca Ý CƠ).
//   node scripts/test-bank-nhieu-phan.mjs                                  — chỉ quy tắc
//   node --env-file=.env.local scripts/test-bank-nhieu-phan.mjs --that     — thêm: giả lập mở phần còn lại của các giao dịch
//                                                                            thật đã đóng mà còn dư, phân loại lại (CHỈ ĐỌC)
import { phanDaGhi, daGhiCuaGd, conLaiCuaGd, txConLai, themPhan, moTaPhan } from '../lib/bankPhan.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

console.log('Bản ghi cũ (một chi tiết):')
const cuHcns = { amount: 3780000, state: 'posted', post_detail: { kind: 'hcns_case', name: 'Ý CƠ', amount: 1620000, hcnsClientId: 'h1' } }
kiem('HCNS cũ → 1 phần 1.620.000', [phanDaGhi(cuHcns).length, daGhiCuaGd(cuHcns), conLaiCuaGd(cuHcns)], [1, 1620000, 2160000])
const cuKeToan = { amount: 2160000, state: 'posted', post_detail: { plan: [{ kind: 'ketoan', month: 9, year: 2026, amount: 2160000 }], done: [{ kind: 'ketoan', month: 9, year: 2026, amount: 2160000 }] } }
kiem('ghi công nợ cũ đủ tiền → còn 0', [daGhiCuaGd(cuKeToan), conLaiCuaGd(cuKeToan)], [2160000, 0])
kiem('mô tả phần công nợ', moTaPhan(phanDaGhi(cuKeToan)[0]), 'Kế toán T9/2026 2.160.000đ')
const cuGhiThieu = { amount: 2700000, state: 'posted', post_detail: { plan: [{ kind: 'hcns', month: 9, year: 2026, amount: 540000 }], done: [{ kind: 'hcns', month: 9, year: 2026, amount: 540000 }], reason: 'app đã ghi sẵn 2.160.000' } }
kiem('ghi công nợ cũ chỉ ghi phần thiếu (HOANGANH) → vẫn KHÔNG còn dư', conLaiCuaGd(cuGhiThieu), 0)
kiem('mô tả ghi phần thiếu', moTaPhan(phanDaGhi(cuGhiThieu)[0]), 'HCNS T9/2026 540.000đ · 2.160.000đ đã ghi tay sẵn')
const moLoi = { amount: 500000, state: 'open', post_detail: { plan: [], done: [], error: 'x' } }
kiem('giao dịch mở mang chi tiết lỗi cũ → chưa ghi gì', [daGhiCuaGd(moLoi), conLaiCuaGd(moLoi)], [0, 500000])
kiem('bỏ qua cũ (ignored) không tính là đã ghi', daGhiCuaGd({ amount: 1, state: 'ignored', post_detail: { kind: 'hcns_case', amount: 1 } }), 0)

console.log('\nGhi nhiều phần:')
const gd = { amount: 3780000, state: 'open', post_detail: null }
kiem('chưa ghi → phân loại nguyên số tiền', txConLai(gd).amount, 3780000)
const b1 = themPhan(gd, { kind: 'hcns_case', name: 'Ý CƠ', amount: 1620000 }, 't1')
kiem('ghi HCNS 1.620.000 → còn 2.160.000, chưa đóng', [b1.conLai, b1.dong], [2160000, false])
const gd2 = { ...gd, post_detail: b1.post_detail }
kiem('phân loại phần còn lại 2.160.000', txConLai(gd2).amount, 2160000)
const b2 = themPhan(gd2, { kind: 'cong_no', done: [{ kind: 'ketoan', month: 10, year: 2026, amount: 2160000 }], amount: conLaiCuaGd(gd2) }, 't2')
kiem('ghi kế toán phần còn lại → đóng', [b2.conLai, b2.dong, b2.post_detail.parts.length], [0, true, 2])
kiem('giữ thứ tự + lúc ghi', b2.post_detail.parts.map(p => [p.kind, p.luc]), [['hcns_case', 't1'], ['cong_no', 't2']])
const tuCu = themPhan(cuHcns, { kind: 'khop_so', amount: 2160000, reason: 'đã ghi tay' }, 't3')
kiem('mở lại bản cũ + khớp sổ phần dư → 2 phần, đóng', [tuCu.post_detail.parts.length, tuCu.dong], [2, true])
kiem('mô tả khớp sổ', moTaPhan(tuCu.post_detail.parts[1]), 'Khớp sổ (đã ghi tay) 2.160.000đ — đã ghi tay')

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const { classifyTransactions } = await import('../lib/bankData.js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: txs } = await sb.from('bank_transactions').select('*').eq('state', 'posted').order('tx_time', { ascending: false }).limit(1000)
  const du = (txs || []).filter(t => conLaiCuaGd(t) > 0)
  console.log('\nGiao dịch thật đã đóng mà CÒN DƯ: ' + du.length)
  // Giả lập "Ghi tiếp phần còn lại": giao dịch mở với các phần đã ghi — KHÔNG ghi gì vào database
  const gia = du.map(t => ({ ...t, state: 'open', post_detail: { parts: phanDaGhi(t) } }))
  const cls = gia.length ? await classifyTransactions(sb, gia.map(txConLai)) : []
  gia.forEach((t, i) => console.log('   · ' + String(t.memo).slice(0, 45).padEnd(45) + ' ' + Number(t.amount).toLocaleString('vi-VN').padStart(10)
    + ' | đã ghi ' + daGhiCuaGd(t).toLocaleString('vi-VN') + ' | còn ' + conLaiCuaGd(t).toLocaleString('vi-VN')
    + ' → ' + cls[i].status + (cls[i].client ? ' · ' + cls[i].client.client_code : '') + ' · ' + (cls[i].reason || '')))
  kiem('chỉ còn Ý CƠ là còn dư thật (HOANGANH, MBG ghi công nợ trọn giao dịch)', du.map(t => String(t.memo).slice(0, 3)), ['YCO'])
  const yco = gia.findIndex(t => /^YCO-TTPHIDICHVU-10\/2026/.test(t.memo || ''))
  if (yco >= 0) kiem('Ý CƠ: phần còn lại 2.160.000 nhận ra "đã ghi tay" (khớp sổ, không ghi trùng)', [conLaiCuaGd(gia[yco]), cls[yco].status], [2160000, 'done'])
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
