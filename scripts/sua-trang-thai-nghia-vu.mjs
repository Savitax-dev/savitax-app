// Sửa một lần các nghĩa vụ bị lỗi "hồ sơ duyệt sau cùng thắng" (trước 26/10/2026): đặt lại trạng thái
// theo hồ sơ TỐT NHẤT của kỳ. Mặc định CHỈ XEM, thêm --ghi mới ghi.
//   node --env-file=.env.local scripts/sua-trang-thai-nghia-vu.mjs [--ghi]
import { createClient } from '@supabase/supabase-js'
import { trangThaiTotNhat, tinhLaiTrangThaiNghiaVu } from '../lib/tokhaiTrangThai.js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const docHet = async (bang, cot, loc) => { const o = []; for (let f = 0; ; f += 1000) { let q = sb.from(bang).select(cot); if (loc) q = loc(q); const { data, error } = await q.order('id').range(f, f + 999); if (error) throw error; o.push(...data); if (data.length < 1000) return o } }
const [hs, nv, cl, lt] = await Promise.all([
  docHet('tax_filings', 'obligation_id, state', q => q.not('obligation_id', 'is', null)),
  docHet('tax_obligations', 'id, client_id, filing_type_id, period_code, state'),
  docHet('clients', 'id, client_code, name'), docHet('tax_filing_types', 'id, code')])
const theoNv = new Map(); for (const h of hs) theoNv.set(h.obligation_id, [...(theoNv.get(h.obligation_id) || []), h.state])
const ma = new Map(cl.map(c => [c.id, c.client_code || c.name])), loai = new Map(lt.map(t => [t.id, t.code]))
const lech = nv.filter(o => o.state !== 'no_activity' && theoNv.has(o.id)).map(o => ({ o, dung: trangThaiTotNhat(theoNv.get(o.id)) })).filter(x => x.dung && x.dung !== x.o.state)
const dem = {}; lech.forEach(x => { const k = x.o.state + ' → ' + x.dung; dem[k] = (dem[k] || 0) + 1 })
console.log('Nghĩa vụ có hồ sơ:', theoNv.size, '· đang sai trạng thái:', lech.length, JSON.stringify(dem))
for (const x of lech) console.log('  ', String(ma.get(x.o.client_id)).padEnd(16), (loai.get(x.o.filing_type_id) || '').padEnd(11), x.o.period_code.padEnd(10), x.o.state, '→', x.dung)
if (process.argv.includes('--ghi')) console.log('ĐÃ SỬA:', await tinhLaiTrangThaiNghiaVu(sb, lech.map(x => x.o.id)), 'nghĩa vụ')
else if (lech.length) console.log('\n(Chỉ xem — thêm --ghi để sửa)')
