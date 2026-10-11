// Dòng tiền theo QUÝ / NĂM: tồn đầu = đầu tháng đầu kỳ, phí và đã thu = cộng các tháng, chuyển kỳ sau = sau
// tháng cuối và phải bằng tồn đầu kỳ của tháng kế. Chỉ đọc.  node --env-file=.env.local scripts/test-dong-tien-quy-nam.mjs
import { createClient } from '@supabase/supabase-js'
import { tinhDongTienPhong, gopDongTien } from '../lib/dongTienPhong.js'
import { loadHcnsFees } from '../lib/hcnsPhiCongTy.js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const COLS = 'id, name, assigned_to, monthly_fee, other_debt, fee_period, status, contract_start, created_at'
const [{ data: rl }, { data: sl }] = await Promise.all([
  sb.from('rooms').select('id, name, type').not('type', 'in', '(hcns,kinhdoanh)').order('name'),
  sb.from('staff').select('id, room_id'),
])
const nap = new Map()
for (const room of rl) {
  const ids = sl.filter(x => x.room_id === room.id).map(x => x.id); if (!ids.length) continue
  const { data: cl } = await sb.from('clients').select(COLS).in('assigned_to', ids); if (!cl?.length) continue
  const active = cl.filter(c => (c.status || 'active') === 'active').map(c => c.id)
  const [{ data: plans }, { data: logs }] = await Promise.all([
    sb.from('service_fees').select('client_id, year, month, amount').in('client_id', active).eq('type', 'fee_plan'),
    sb.from('client_change_log').select('client_id, old_value, changed_at').in('client_id', active).eq('entity', 'monthly_fee').eq('action', 'update'),
  ])
  nap.set(room.id, { cl, active, plans: plans || [], logs: logs || [] })
}
const ky = async (months) => gopDongTien(await Promise.all([...nap.values()].map(async r => {
  const last = months[months.length - 1]
  const h = await loadHcnsFees(sb, r.active, 2026, last)
  return tinhDongTienPhong(sb, { clients: r.cl, year: 2026, month: last, months, feePlanRows: r.plans, changeLogRows: r.logs, hcnsByClient: h.byClient || {}, hcnsLichSu: { links: h.links || [], plans: h.plans || [], paid: h.paid || [] } })
})))
let loi = 0
const so = (ten, a, b) => { if (a === b) console.log('   OK  ' + ten + ': ' + fmt(a)); else { loi++; console.log('   SAI ' + ten + ': ' + fmt(a) + ' ≠ ' + fmt(b)) } }
const [q3, t7, t8, t9, t10, nam] = await Promise.all([ky([7, 8, 9]), ky([7]), ky([8]), ky([9]), ky([10]), ky([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])])
console.log('QUÝ 3/2026: tồn đầu ' + fmt(q3.tonDau.total) + ' | phí KT ' + fmt(q3.phiKetoan.phi) + ' đã thu ' + fmt(q3.phiKetoan.daThu) + ' (' + q3.phiKetoan.pct + '%) | HCNS ' + fmt(q3.phiHcns.phi) + '/' + fmt(q3.phiHcns.daThu) + ' | thu khác ' + fmt(q3.thuKhac.phaiThu) + '/' + fmt(q3.thuKhac.daThu) + ' | chuyển ' + fmt(q3.chuyenKySau.total))
for (const k of ['ketoan', 'hcns', 'dvk']) {
  so('tồn đầu Q3 = tồn đầu T7 [' + k + ']', q3.tonDau[k], t7.tonDau[k])
  so('chuyển kỳ sau Q3 = chuyển kỳ sau T9 [' + k + ']', q3.chuyenKySau[k], t9.chuyenKySau[k])
  so('chuyển kỳ sau Q3 = tồn đầu T10 [' + k + ']', q3.chuyenKySau[k], t10.tonDau[k])
}
so('phí KT Q3 = T7+T8+T9', q3.phiKetoan.phi, t7.phiKetoan.phi + t8.phiKetoan.phi + t9.phiKetoan.phi)
so('đã thu KT Q3 = T7+T8+T9', q3.phiKetoan.daThu, t7.phiKetoan.daThu + t8.phiKetoan.daThu + t9.phiKetoan.daThu)
so('phí HCNS Q3 = T7+T8+T9', q3.phiHcns.phi, t7.phiHcns.phi + t8.phiHcns.phi + t9.phiHcns.phi)
so('đã thu HCNS Q3 = T7+T8+T9', q3.phiHcns.daThu, t7.phiHcns.daThu + t8.phiHcns.daThu + t9.phiHcns.daThu)
so('thu khác phải thu Q3 = T7+T8+T9', q3.thuKhac.phaiThu, t7.thuKhac.phaiThu + t8.thuKhac.phaiThu + t9.thuKhac.phaiThu)
so('thu khác đã thu Q3 = T7+T8+T9', q3.thuKhac.daThu, t7.thuKhac.daThu + t8.thuKhac.daThu + t9.thuKhac.daThu)
console.log('NĂM 2026 (đến T10): tồn đầu ' + fmt(nam.tonDau.total) + ' | phí KT ' + fmt(nam.phiKetoan.phi) + ' đã thu ' + fmt(nam.phiKetoan.daThu) + ' (' + nam.phiKetoan.pct + '%) | chuyển ' + fmt(nam.chuyenKySau.total))
for (const k of ['ketoan', 'hcns', 'dvk']) so('chuyển kỳ sau Năm = chuyển kỳ sau T10 [' + k + ']', nam.chuyenKySau[k], t10.chuyenKySau[k])
console.log(loi ? loi + ' LỖI' : 'TẤT CẢ ĐẠT')
