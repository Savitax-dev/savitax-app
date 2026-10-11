// Bất biến: cộng khối dòng tiền của TỪNG NHÂN VIÊN (trang Quản lý công nợ) phải ra đúng số của CẢ PHÒNG
// (trang Phòng). Chỉ đọc.  node --env-file=.env.local scripts/test-dong-tien-nhan-vien.mjs [tháng]
import { createClient } from '@supabase/supabase-js'
import { tinhDongTienPhong } from '../lib/dongTienPhong.js'
import { loadHcnsFees } from '../lib/hcnsPhiCongTy.js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const Y = 2026, M = Number(process.argv[2]) || 10
const COLS = 'id, name, assigned_to, monthly_fee, other_debt, fee_period, status, contract_start, created_at'
const { data: rooms } = await sb.from('rooms').select('id, name, type').order('name')
let loi = 0
for (const room of rooms.filter(r => r.type !== 'kinhdoanh' && r.type !== 'hcns')) {
  const { data: staff } = await sb.from('staff').select('id, full_name').eq('room_id', room.id)
  if (!staff?.length) continue
  const { data: all } = await sb.from('clients').select(COLS).in('assigned_to', staff.map(s => s.id))
  if (!all?.length) continue
  const act = (list) => list.filter(c => (c.status || 'active') === 'active').map(c => c.id)
  const nap = async (ids) => {
    if (!ids.length) return { plans: [], logs: [] }
    const [{ data: plans }, { data: logs }] = await Promise.all([
      sb.from('service_fees').select('client_id, year, month, amount').in('client_id', ids).eq('type', 'fee_plan'),
      sb.from('client_change_log').select('client_id, old_value, changed_at').in('client_id', ids).eq('entity', 'monthly_fee').eq('action', 'update'),
    ])
    return { plans: plans || [], logs: logs || [] }
  }
  // CẢ PHÒNG (như trang Phòng)
  const a0 = act(all), h0 = await loadHcnsFees(sb, a0, Y, M), f0 = await nap(a0)
  const phong = await tinhDongTienPhong(sb, { clients: all, year: Y, month: M, feePlanRows: f0.plans, changeLogRows: f0.logs, hcnsByClient: h0.byClient || {}, hcnsLichSu: { links: h0.links || [], plans: h0.plans || [], paid: h0.paid || [] } })
  // TỪNG NHÂN VIÊN (như trang Quản lý công nợ)
  const { data: ro } = await sb.from('debt_rollovers').select('year, month').in('client_id', all.map(c => c.id)).or('source.is.null,source.eq.ketoan').order('year').order('month').limit(1)
  const lichSuTu = ro?.[0] ? ro[0].year * 12 + ro[0].month : null
  const cong = { ton: 0, phiKt: 0, thuKt: 0, phiH: 0, thuH: 0, khac: 0, khacThu: 0, chuyen: 0 }
  for (const s of staff) {
    const mine = all.filter(c => c.assigned_to === s.id)
    if (!mine.length) continue
    const a = act(mine), h = await loadHcnsFees(sb, a, Y, M), f = await nap(a)
    const d = await tinhDongTienPhong(sb, { clients: mine, year: Y, month: M, feePlanRows: f.plans, changeLogRows: f.logs, hcnsByClient: h.byClient || {}, hcnsLichSu: { links: h.links || [], plans: h.plans || [], paid: h.paid || [] }, lichSuTu })
    cong.ton += d.tonDau.total; cong.phiKt += d.phiKetoan.phi; cong.thuKt += d.phiKetoan.daThu; cong.phiH += d.phiHcns.phi; cong.thuH += d.phiHcns.daThu
    cong.khac += d.thuKhac.phaiThu; cong.khacThu += d.thuKhac.daThu; cong.chuyen += d.chuyenKySau.total
  }
  const p = { ton: phong.tonDau.total, phiKt: phong.phiKetoan.phi, thuKt: phong.phiKetoan.daThu, phiH: phong.phiHcns.phi, thuH: phong.phiHcns.daThu, khac: phong.thuKhac.phaiThu, khacThu: phong.thuKhac.daThu, chuyen: phong.chuyenKySau.total }
  const lech = Object.keys(p).filter(k => p[k] !== cong[k])
  if (lech.length) { loi++; console.log('LECH ' + room.name + ': ' + lech.map(k => k + ' phong ' + fmt(p[k]) + ' / cong NV ' + fmt(cong[k])).join(' | ')) }
  else console.log('KHOP ' + room.name.padEnd(12) + ' ton ' + fmt(p.ton) + ' | chuyen ky sau ' + fmt(p.chuyen))
}
console.log(loi ? loi + ' phong lech' : 'TAT CA KHOP — T' + M)
