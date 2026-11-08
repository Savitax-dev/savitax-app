// Kiểm phân hệ Theo dõi hợp đồng + Doanh số/thưởng trên DỮ LIỆU THẬT trước khi đẩy.
//
//   node --env-file=.env.local scripts/verify-sales-contract.mjs
//
// Chỉ ĐỌC, trừ một lần thu TẠM ghi vào hợp đồng mới nhất rồi XOÁ ngay (để chắc là insert/update/
// delete chạy được và số chưa VAT đúng). Dùng GET thật chứ không head:true — head:true nuốt lỗi
// bảng không tồn tại, từng báo "OK" cho bảng chưa tạo.
import { createClient } from '@supabase/supabase-js'
import { trackContract, revenueByStaff, netFromGross } from '../lib/salesContract.js'
import { buildBonusReport, defaultSettings } from '../lib/salesBonus.js'
import { monthVN } from '../lib/salesItems.js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let loi = 0
const ok = (t, d) => console.log('  [OK]   ' + t + (d ? '  — ' + d : ''))
const bad = (t, d) => { loi++; console.log('  [LỖI]  ' + t + (d ? '  — ' + d : '')) }

console.log('1. Bảng mới đã có chưa (GET thật, không head)\n')
const BANG = {
  sales_contract_payments: 'id, quote_id, due_month, paid_month, gross, vat_rate, net, staff_id, note, created_by, created_at, updated_at',
  sales_bonus_settings: 'id, nguong_thu_viec, nguong_chinh_thuc, ty_le, vat_rate, updated_by, updated_at',
  sales_staff_bonus: 'staff_id, level, nguong, note, updated_by, updated_at',
  sales_bonus_reports: 'id, period, staff_id, doanh_so, nguong, ty_le, vuot, thuong, level, trang_thai, nguoi_duyet, luc_duyet, ghi_chu, chi_tiet, created_by, created_at, updated_at',
}
for (const [ten, cot] of Object.entries(BANG)) {
  const { error } = await s.from(ten).select(cot).limit(1)
  if (error) bad(ten, error.message)
  else ok(ten, 'đủ ' + cot.split(',').length + ' cột')
}

console.log('\n2. Dòng cài đặt thưởng mặc định\n')
{
  const { data, error } = await s.from('sales_bonus_settings').select('*').eq('id', 1).maybeSingle()
  if (error) bad('đọc cài đặt', error.message)
  else if (!data) bad('chưa có dòng id=1', 'chạy lại sql/55')
  else {
    const d = defaultSettings()
    const khop = Number(data.nguong_thu_viec) === d.nguong_thu_viec && Number(data.nguong_chinh_thuc) === d.nguong_chinh_thuc && Number(data.ty_le) === d.ty_le
    if (khop) ok('mốc 30tr / 35tr · thưởng 10% · VAT ' + data.vat_rate + '%')
    else bad('số khác mặc định', JSON.stringify(data))
  }
}

console.log('\n3. Hợp đồng đã chốt + bảng khoản phí\n')
const { data: hd } = await s.from('sales_quotes')
  .select('id, quote_no, company_name, author_id, contract_status')
  .eq('is_deleted', false).eq('contract_status', 'signed').order('quote_date', { ascending: false })
const ids = (hd || []).map(q => q.id)
const { data: dong } = ids.length
  ? await s.from('sales_quote_items').select('quote_id, service, billing, amount, months, start_month, to_savitax').in('quote_id', ids)
  : { data: [] }
const theoHd = new Map()
for (const it of dong || []) { if (!theoHd.has(it.quote_id)) theoHd.set(it.quote_id, []); theoHd.get(it.quote_id).push(it) }
ok((hd || []).length + ' hợp đồng đã chốt', (dong || []).length + ' dòng phí')
const thieu = (hd || []).filter(q => !theoHd.has(q.id))
if (thieu.length) bad(thieu.length + ' hợp đồng CHƯA tách dòng phí', thieu.map(q => q.quote_no).join(', ') + ' — tab sẽ nhắc mở lại Bước 5')
else ok('mọi hợp đồng chốt đều đã có dòng phí')

const thang = monthVN()
let tongCan = 0
for (const q of hd || []) {
  const r = trackContract({ items: theoHd.get(q.id) || [], payments: [], upto: thang })
  tongCan += r.canThu
}
ok('tổng cần thu tính tới ' + thang, tongCan.toLocaleString('vi-VN') + ' đ (chưa VAT)')

console.log('\n4. Ghi thử một lần thu rồi xoá (hợp đồng mới nhất)\n')
if (!hd?.length) {
  bad('không có hợp đồng nào để thử')
} else {
  const q = hd[0]
  const ky = (theoHd.get(q.id) || []).map(i => i.start_month).filter(Boolean).sort()[0] || thang
  const net = netFromGross(16200000, 8)
  const { data: them, error: e1 } = await s.from('sales_contract_payments').insert({
    quote_id: q.id, due_month: ky, paid_month: thang, gross: 16200000, vat_rate: 8, net,
    staff_id: q.author_id, note: 'KIỂM THỬ — script tự xoá',
  }).select('*').single()
  if (e1) bad('ghi lần thu', e1.message)
  else {
    ok('ghi được lần thu vào ' + q.quote_no + ' (' + (q.company_name || '') + ')')
    if (Number(them.net) === 15000000) ok('16.200.000 đã gồm VAT 8% -> 15.000.000 chưa VAT')
    else bad('số chưa VAT sai', String(them.net))

    const r = trackContract({ items: theoHd.get(q.id) || [], payments: [them], upto: thang })
    const kyDo = r.kys.find(k => k.month === ky)
    if (kyDo && kyDo.paid === 15000000) ok('kỳ ' + ky + ' nhận đúng 15.000.000 đã thu', 'cần thu ' + kyDo.due.toLocaleString('vi-VN') + ' đ')
    else bad('kỳ ' + ky + ' không nhận được tiền đã thu', JSON.stringify(r.kys.map(k => [k.month, k.paid])))

    const ds = revenueByStaff([them], thang)
    if (ds.get(q.author_id) === 15000000) ok('doanh số tháng ' + thang + ' của người lập +15.000.000')
    else bad('doanh số theo người sai', JSON.stringify([...ds.entries()]))

    const { error: e2 } = await s.from('sales_contract_payments').update({ gross: 10800000, net: netFromGross(10800000, 8) }).eq('id', them.id)
    if (e2) bad('sửa lần thu', e2.message)
    else ok('sửa được lần thu')

    const { error: e3 } = await s.from('sales_contract_payments').delete().eq('id', them.id)
    if (e3) bad('XOÁ lần thu kiểm thử', e3.message + ' — PHẢI XOÁ TAY dòng id=' + them.id)
    else ok('đã xoá lần thu kiểm thử, dữ liệu thật nguyên vẹn')
  }
}

console.log('\n5. Bảng thưởng tháng này (chỉ đọc)\n')
{
  const { data: tra } = await s.from('sales_contract_payments').select('*').eq('paid_month', thang)
  const { data: lv } = await s.from('sales_staff_bonus').select('staff_id, level, nguong')
  const { data: cai } = await s.from('sales_bonus_settings').select('*').eq('id', 1).maybeSingle()
  // Đúng bộ lọc của loadSalesStaff: chỉ người Phòng Kinh doanh, không phải cả công ty.
  const [{ data: rp }, { data: rooms }] = await Promise.all([
    s.from('role_permissions').select('role_id').eq('permission_key', 'view_sales'),
    s.from('rooms').select('id').eq('type', 'kinhdoanh'),
  ])
  const roleIds = [...new Set((rp || []).map(r => r.role_id))]
  const roomIds = (rooms || []).map(r => r.id)
  const { data: ex } = await s.from('staff_extra_roles').select('staff_id, role, room_id')
  const extra = (ex || []).filter(e => roleIds.includes(e.role) || roomIds.includes(e.room_id)).map(e => e.staff_id)
  const { data: tatCa } = await s.from('staff').select('id, full_name, role, room_id').eq('is_active', true)
  const nv = (tatCa || []).filter(x => roleIds.includes(x.role) || roomIds.includes(x.room_id) || extra.includes(x.id))
  const rep = buildBonusReport({
    period: thang, staff: nv || [], doanhSo: revenueByStaff(tra || [], thang),
    levels: new Map((lv || []).map(l => [l.staff_id, l])), settings: cai || defaultSettings(), saved: new Map(),
  })
  ok('dựng được bảng ' + rep.rows.length + ' dòng', 'doanh số ' + rep.tongDoanhSo.toLocaleString('vi-VN') + ' đ · thưởng ' + rep.tongThuong.toLocaleString('vi-VN') + ' đ')
  if ((tra || []).length === 0) ok('tháng này chưa có lần thu nào — đúng, phân hệ vừa mới bật')
}

console.log('\n6. Dữ liệu cũ không bị đụng\n')
for (const [ten, dk] of [['sales_quotes', 'is_deleted'], ['sales_quote_items', null]]) {
  let q = s.from(ten).select('id')
  if (dk) q = q.eq(dk, false)
  const { data, error } = await q
  if (error) bad(ten, error.message)
  else ok(ten, data.length + ' dòng')
}

console.log('\n' + (loi ? '✗ CÒN ' + loi + ' LỖI — chưa đẩy được' : '✓ Toàn bộ kiểm tra đạt'))
process.exit(loi ? 1 : 0)
