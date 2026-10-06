// Khối dòng tiền TOÀN CÔNG TY (trang "Công nợ toàn công ty") — dựng lại đúng cách route
// debt-overview?dongTien=1 làm: tính từng phòng nghiệp vụ rồi gopDongTien. Chỉ đọc.
//   node --env-file=.env.local scripts/test-dong-tien-toan-cty.mjs [tháng]
// Kiểm: cộng trừ từng loại thu khớp; chuyển kỳ sau T(n-1) = tồn đầu kỳ T(n); tổng = 3 dòng = danh sách.
import { createClient } from '@supabase/supabase-js'
import { tinhDongTienPhong, gopDongTien } from '../lib/dongTienPhong.js'
import { loadHcnsFees } from '../lib/hcnsPhiCongTy.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const Y = 2026, M = Number(process.argv[2]) || 10
const COLS = 'id, name, assigned_to, monthly_fee, other_debt, fee_period, status, contract_start, created_at'
let loi = 0
const ok = (t) => console.log('   OK  ' + t)
const bad = (t) => { loi++; console.log('   SAI ' + t) }

async function toanCty(year, month) {
  const [{ data: rl }, { data: sl }] = await Promise.all([
    sb.from('rooms').select('id, name, type').not('type', 'in', '(hcns,kinhdoanh)').order('name'),
    sb.from('staff').select('id, full_name, room_id'),
  ])
  const motPhong = async (room) => {
    const ids = sl.filter(x => x.room_id === room.id).map(x => x.id)
    if (!ids.length) return null
    const { data: cl } = await sb.from('clients').select(COLS).in('assigned_to', ids)
    if (!cl?.length) return null
    const active = cl.filter(c => (c.status || 'active') === 'active').map(c => c.id)
    const [{ data: plans }, { data: logs }, hcns] = await Promise.all([
      sb.from('service_fees').select('client_id, year, month, amount').in('client_id', active).eq('type', 'fee_plan'),
      sb.from('client_change_log').select('client_id, old_value, changed_at').in('client_id', active).eq('entity', 'monthly_fee').eq('action', 'update'),
      loadHcnsFees(sb, active, year, month),
    ])
    return tinhDongTienPhong(sb, {
      clients: cl, year, month, feePlanRows: plans || [], changeLogRows: logs || [],
      hcnsByClient: hcns.byClient || {}, hcnsLichSu: { links: hcns.links || [], plans: hcns.plans || [], paid: hcns.paid || [] },
    })
  }
  return gopDongTien(await Promise.all(rl.map(motPhong)))
}

const t0 = Date.now()
const d = await toanCty(Y, M)
console.log('TOÀN CÔNG TY T' + M + '/' + Y + '  (tính trong ' + ((Date.now() - t0) / 1000).toFixed(1) + ' giây)')
console.log(' Tồn đầu kỳ     ' + fmt(d.tonDau.total).padStart(15) + '  (KT ' + fmt(d.tonDau.ketoan) + ' · HCNS ' + fmt(d.tonDau.hcns) + ' · DVK ' + fmt(d.tonDau.dvk) + ') · ' + d.tonDau.soCty + ' cty')
console.log(' Phí kế toán    ' + fmt(d.phiKetoan.phi).padStart(15) + '  đã thu ' + fmt(d.phiKetoan.daThu) + ' (' + d.phiKetoan.pct + '%) · ' + d.phiKetoan.soCty + ' cty')
console.log(' Phí HCNS       ' + fmt(d.phiHcns.phi).padStart(15) + '  đã thu ' + fmt(d.phiHcns.daThu) + ' (' + d.phiHcns.pct + '%) · ' + d.phiHcns.soCty + ' cty')
console.log(' Phí thu khác   ' + fmt(d.thuKhac.phaiThu).padStart(15) + '  đã thu ' + fmt(d.thuKhac.daThu) + ' (' + d.thuKhac.pct + '%)')
console.log(' Chuyển kỳ sau  ' + fmt(d.chuyenKySau.total).padStart(15) + '  (KT ' + fmt(d.chuyenKySau.ketoan) + ' · HCNS ' + fmt(d.chuyenKySau.hcns) + ' · DVK ' + fmt(d.chuyenKySau.dvk) + ') · ' + d.chuyenKySau.soCty + ' cty')
console.log(' Đã ngưng còn nợ: ' + d.ngungConNo.length + ' cty · ' + fmt(d.ngungConNo.reduce((a, x) => a + x.total, 0)))

for (const [ten, t, ps, dt, ck] of [
  ['kế toán', d.tonDau.ketoan, d.phiKetoan.phi, d.phiKetoan.daThu + d.tonDau.daThuTrongKy + d.tonDau.daXoaTrongKy, d.chuyenKySau.ketoan],
  ['HCNS', d.tonDau.hcns, d.phiHcns.phi, d.phiHcns.daThu, d.chuyenKySau.hcns],
  ['dịch vụ khác', d.tonDau.dvk, d.thuKhac.phaiThu, d.thuKhac.daThu, d.chuyenKySau.dvk],
]) {
  const tinh = t + ps - dt
  if (ck === tinh) ok(ten + ': ' + fmt(t) + ' + ' + fmt(ps) + ' − ' + fmt(dt) + ' = ' + fmt(ck))
  else if (ck > tinh) console.log('   ⓘ ' + ten + ': chuyển kỳ sau ' + fmt(ck) + ' > cộng thẳng ' + fmt(tinh) + ' (lệch ' + fmt(ck - tinh) + ') — có công ty trả vượt số dư')
  else bad(ten + ': chuyển kỳ sau ' + fmt(ck) + ' < cộng thẳng ' + fmt(tinh))
}
for (const [ten, x] of [['tồn đầu kỳ', d.tonDau], ['chuyển kỳ sau', d.chuyenKySau]]) {
  const ba = x.ketoan + x.hcns + x.dvk, ds = x.theoCty.reduce((a, y) => a + y.total, 0)
  ba === x.total && ds === x.total ? ok(ten + ': tổng = 3 dòng = danh sách') : bad(ten + ': tổng ' + fmt(x.total) + ' / 3 dòng ' + fmt(ba) + ' / danh sách ' + fmt(ds))
}
const hc = d.phiHcns.theoCty
hc.reduce((a, x) => a + x.fee, 0) === d.phiHcns.phi ? ok('bảng HCNS khớp thẻ (' + hc.length + ' cty)') : bad('bảng HCNS lệch thẻ')

const truoc = await toanCty(M === 1 ? Y - 1 : Y, M === 1 ? 12 : M - 1)
for (const k of ['ketoan', 'hcns', 'dvk']) {
  truoc.chuyenKySau[k] === d.tonDau[k] ? ok('nối kỳ ' + k + ': ' + fmt(d.tonDau[k])) : bad('nối kỳ ' + k + ': kỳ trước chuyển ' + fmt(truoc.chuyenKySau[k]) + ' ≠ tồn đầu ' + fmt(d.tonDau[k]))
}
console.log(loi === 0 ? '\nTẤT CẢ ĐẠT' : '\n' + loi + ' lỗi')
process.exit(loi === 0 ? 0 : 1)
