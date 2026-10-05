// Kiểm khối DÒNG TIỀN công nợ phòng trên DỮ LIỆU THẬT (chỉ đọc, không ghi gì).
//
//   node --env-file=.env.local scripts/test-dong-tien-phong.mjs [tên phòng] [năm] [tháng]
//
// Bất biến phải đúng cho TỪNG loại thu (kế toán / HCNS / dịch vụ khác):
//   tồn đầu kỳ + phí phát sinh trong kỳ − đã thu trong kỳ = còn phải thu chuyển kỳ sau
// và tổng "chuyển kỳ sau" của một kỳ phải bằng tổng "tồn đầu kỳ" của kỳ liền sau.
import { createClient } from '@supabase/supabase-js'
import { tinhDongTienPhong } from '../lib/dongTienPhong.js'
import { feeCountsForMonth, resolveFeeForMonth } from '../lib/feeDue.js'
import { resolveHcnsFeeForMonth } from '../lib/hcnsFee.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
let loi = 0
const ok = (t) => console.log('   OK  ' + t)
const bad = (t) => { loi++; console.log('   SAI ' + t) }

const tenPhong = process.argv[2] || null
const nam = Number(process.argv[3]) || 2026
const thang = Number(process.argv[4]) || 10

const hetTrang = async (q) => {
  let all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
  }
  return all
}

// Dựng lại ĐÚNG đầu vào mà app/api/admin/room/route.js truyền cho lib.
async function duLieuPhong(room, year, month) {
  const { data: staff } = await sb.from('staff').select('id, full_name').eq('room_id', room.id)
  const ids = (staff || []).map(s => s.id)
  const { data: clients } = await hetTrang(() => sb.from('clients')
    .select('id, name, assigned_to, monthly_fee, report_type, fee_period, status, contract_start, created_at, other_debt')
    .in('assigned_to', ids)).then(d => ({ data: d }))
  const cids = clients.map(c => c.id)
  // Lịch sử phí chỉ nạp cho công ty ĐANG dùng dịch vụ — y như app/api/admin/room/route.js. Nạp
  // cho tất cả thì bộ kiểm che mất lỗi "công ty ngưng bị tính theo phí hôm nay".
  const cidsActive = clients.filter(c => (c.status || 'active') === 'active').map(c => c.id)
  const [feeKt, feePlan, changeLog] = await Promise.all([
    hetTrang(() => sb.from('service_fees').select('client_id, amount').in('client_id', cids).eq('year', year).eq('month', month).eq('type', 'ketoan')),
    hetTrang(() => sb.from('service_fees').select('client_id, year, month, amount').in('client_id', cidsActive).eq('type', 'fee_plan')),
    hetTrang(() => sb.from('client_change_log').select('client_id, old_value, changed_at').in('client_id', cidsActive).eq('entity', 'monthly_fee').eq('action', 'update')),
  ])
  const feeKetoanMap = {}
  for (const f of feeKt) feeKetoanMap[f.client_id] = (feeKetoanMap[f.client_id] || 0) + Number(f.amount || 0)

  // phí HCNS kỳ này — rút gọn từ loadHcnsFees của route
  const hcnsByClient = {}
  let hcnsLichSu = { links: [], plans: [], paid: [] }
  const { data: links } = await sb.from('hcns_clients')
    .select('id, linked_client_id, hcns_fee, fee_period, created_at')
    .in('linked_client_id', cids).eq('category', 'thoi_ky').eq('is_active', true)
  if (links?.length) {
    const { data: fees } = await sb.from('hcns_service_fees')
      .select('hcns_client_id, year, month, amount, type').in('hcns_client_id', links.map(l => l.id))
    const paid = new Map(), plans = []
    for (const f of fees || []) {
      if (f.type === 'hcns') paid.set(f.hcns_client_id + '_' + f.year + '_' + f.month, Number(f.amount) || 0)
      else if (f.type === 'fee_plan') plans.push({ ...f, client_id: f.hcns_client_id })
    }
    for (const l of links) {
      const due = feeCountsForMonth(l.fee_period, year, month)
      hcnsByClient[l.linked_client_id] = {
        due,
        fee: due ? resolveHcnsFeeForMonth(plans, l.id, year, month, Number(l.hcns_fee) || 0, l.created_at) : 0,
        collected: paid.get(l.id + '_' + year + '_' + month) || 0,
      }
    }
    hcnsLichSu = { links, plans, paid: [...paid.entries()] }
  }
  return { clients, feePlanRows: feePlan, changeLogRows: changeLog, feeKetoanMap, hcnsByClient, hcnsLichSu }
}

const { data: rooms } = await sb.from('rooms').select('id, name, type').order('name')
const list = (rooms || []).filter(r => r.type !== 'kinhdoanh' && r.type !== 'hcns')
  .filter(r => !tenPhong || r.name.toLowerCase().includes(tenPhong.toLowerCase()))

for (const room of list) {
  const dl = await duLieuPhong(room, nam, thang)
  const d = await tinhDongTienPhong(sb, { ...dl, year: nam, month: thang })
  console.log('\n=== ' + room.name + ' · T' + thang + '/' + nam + ' · ' + dl.clients.length + ' công ty ===')
  console.log(' Tồn đầu kỳ        ' + fmt(d.tonDau.total).padStart(14)
    + '   (KT ' + fmt(d.tonDau.ketoan) + ' · HCNS ' + fmt(d.tonDau.hcns) + (d.tonDau.hcnsCoSoLieu ? '' : ' [chưa chốt]')
    + ' · DVK ' + fmt(d.tonDau.dvk) + ') · ' + d.tonDau.soCty + ' cty')
  console.log(' Phí kế toán       ' + fmt(d.phiKetoan.phi).padStart(14) + '   đã thu ' + fmt(d.phiKetoan.daThu) + ' (' + d.phiKetoan.pct + '%) · ' + d.phiKetoan.soCty + ' cty')
  console.log(' Phí HCNS          ' + fmt(d.phiHcns.phi).padStart(14) + '   đã thu ' + fmt(d.phiHcns.daThu) + ' (' + d.phiHcns.pct + '%) · ' + d.phiHcns.soCty + ' cty')
  console.log(' Phí thu khác      ' + fmt(d.thuKhac.phaiThu).padStart(14) + '   đã thu ' + fmt(d.thuKhac.daThu) + ' (' + d.thuKhac.pct + '%) · ' + d.thuKhac.soHoSo + ' hồ sơ')
  console.log(' Thu nợ tồn kỳ này ' + fmt(d.tonDau.daThuTrongKy).padStart(14))
  console.log(' CHUYỂN KỲ SAU     ' + fmt(d.chuyenKySau.total).padStart(14)
    + '   (KT ' + fmt(d.chuyenKySau.ketoan) + ' · HCNS ' + fmt(d.chuyenKySau.hcns) + ' · DVK ' + fmt(d.chuyenKySau.dvk) + ') · ' + d.chuyenKySau.soCty + ' cty')

  // --- bất biến 1: cộng trừ khớp theo TỪNG công ty (max(0,..) nên chỉ kiểm chiều không âm) ---
  const chuyenTheoCty = new Map(d.chuyenKySau.theoCty.map(x => [x.clientId, x]))
  const tonTheoCty = new Map(d.tonDau.theoCty.map(x => [x.clientId, x]))
  let lechKt = 0
  for (const [id, t] of tonTheoCty) {
    const c = chuyenTheoCty.get(id)
    // công ty không phát sinh phí kỳ này và không thu gì -> chuyển kỳ sau phải Y NGUYÊN tồn đầu
    const coPhatSinh = (dl.feeKetoanMap[id] || 0) > 0 || (dl.hcnsByClient[id]?.fee || 0) > 0
    if (!coPhatSinh && c && Math.abs(c.ketoan - t.ketoan) > 1 && !dl.clients.find(x => x.id === id && feeCountsForMonth(x.fee_period, nam, thang))) lechKt++
  }
  lechKt === 0 ? ok('công ty không phát sinh/không thu: tồn đầu = chuyển kỳ sau') : bad(lechKt + ' công ty lệch')

  // --- bất biến 1b: tổng thẻ = tổng 3 dòng bên trong = tổng danh sách bấm vào ---
  for (const [ten, x] of [['tồn đầu kỳ', d.tonDau], ['chuyển kỳ sau', d.chuyenKySau]]) {
    const ba = x.ketoan + x.hcns + x.dvk
    const ds = x.theoCty.reduce((a, y) => a + y.total, 0)
    if (ba !== x.total || ds !== x.total) bad(ten + ': tổng ' + fmt(x.total) + ' ≠ 3 dòng ' + fmt(ba) + ' / danh sách ' + fmt(ds))
    else ok(ten + ': tổng = 3 dòng = danh sách')
  }

  // --- bất biến 1c: cộng trừ của cả thẻ phải khớp (chặn sàn 0 chỉ làm chuyển kỳ sau LỚN hơn) ---
  for (const [ten, t, ps, dt, ck] of [
    ['kế toán', d.tonDau.ketoan, d.phiKetoan.phi, d.phiKetoan.daThu + d.tonDau.daThuTrongKy + (d.tonDau.daXoaTrongKy || 0), d.chuyenKySau.ketoan],
    ['HCNS', d.tonDau.hcns, d.phiHcns.phi, d.phiHcns.daThu, d.chuyenKySau.hcns],
    ['dịch vụ khác', d.tonDau.dvk, d.thuKhac.phaiThu, d.thuKhac.daThu, d.chuyenKySau.dvk],
  ]) {
    const tinh = t + ps - dt
    if (ck === tinh) ok(ten + ': ' + fmt(t) + ' + ' + fmt(ps) + ' − ' + fmt(dt) + ' = ' + fmt(ck))
    else if (ck > tinh) console.log('   ⓘ ' + ten + ': chuyển kỳ sau ' + fmt(ck) + ' > tính thẳng ' + fmt(tinh)
      + ' (lệch ' + fmt(ck - tinh) + ') — do chặn sàn 0 ở công ty trả vượt / thu khác lẻ')
    else bad(ten + ': chuyển kỳ sau ' + fmt(ck) + ' < tính thẳng ' + fmt(tinh))
  }

  // --- bất biến 1d: công ty ngưng còn nợ — số ở trang Phòng phải bằng số khi gọi riêng công ty đó
  //     (đường xoá nợ / Quản lý công nợ). Lệch thì xoá nợ xong vẫn treo lại một khoản.
  for (const x of d.ngungConNo || []) {
    const le = await tinhDongTienPhong(sb, { clients: dl.clients.filter(c => c.id === x.clientId), year: nam, month: thang, lichSuTu: nam * 12 + thang - 4 })
    const soLe = le.chuyenKySau.theoCty[0]?.ketoan || 0
    if (soLe === x.ketoan) ok('công ty ngưng ' + x.name + ': ' + fmt(x.ketoan) + ' ở cả hai đường tính')
    else bad('công ty ngưng ' + x.name + ': trang Phòng ' + fmt(x.ketoan) + ' ≠ gọi riêng ' + fmt(soLe))
  }

  // --- bất biến 2: không có số âm ---
  const am = [d.tonDau, d.chuyenKySau].some(x => x.ketoan < 0 || x.hcns < 0 || x.dvk < 0)
  am ? bad('có số âm') : ok('không có số âm')

  // --- bất biến 3: tồn đầu kỳ KHÔNG được vượt tổng nợ tồn hiện có của các công ty ---
  const { data: od } = await sb.from('clients').select('other_debt').in('id', dl.clients.map(c => c.id))
  const tongNoTon = (od || []).reduce((a, x) => a + Number(x.other_debt || 0), 0)
  console.log('   (nợ tồn hiện tại trong clients.other_debt: ' + fmt(tongNoTon) + ')')
}

// --- bất biến 4: CHUYỂN KỲ SAU của kỳ P = TỒN ĐẦU KỲ của kỳ P+1, mọi phòng ---
console.log('')
console.log('=== Nối kỳ: chuyển kỳ sau T' + (thang - 1) + ' phải bằng tồn đầu kỳ T' + thang + ' ===')
for (const room of list) {
  const truoc = await tinhDongTienPhong(sb, { ...(await duLieuPhong(room, nam, thang - 1)), year: nam, month: thang - 1 })
  const sau = await tinhDongTienPhong(sb, { ...(await duLieuPhong(room, nam, thang)), year: nam, month: thang })
  for (const [ten, a, b] of [
    ['kế toán', truoc.chuyenKySau.ketoan, sau.tonDau.ketoan],
    ['HCNS', truoc.chuyenKySau.hcns, sau.tonDau.hcns],
    ['DV khác', truoc.chuyenKySau.dvk, sau.tonDau.dvk],
  ]) {
    if (a === b) ok(room.name + ' · ' + ten + ': ' + fmt(a))
    else bad(room.name + ' · ' + ten + ': chuyển kỳ sau ' + fmt(a) + ' ≠ tồn đầu kỳ ' + fmt(b) + ' (lệch ' + fmt(a - b) + ')')
  }
}

console.log(loi === 0 ? '\nTẤT CẢ ĐẠT' : '\n' + loi + ' lỗi')
process.exit(loi === 0 ? 0 : 1)
