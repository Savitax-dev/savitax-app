// Bộ kiểm báo cáo phân hệ Pháp lý (lib/phaply/baoCao.js + route bao-cao).
//   node scripts/test-phaply-bao-cao.mjs                                   offline (luật theo hồ sơ / treo / đếm)
//   node --env-file=.env.local scripts/test-phaply-bao-cao.mjs --that [URL] BẤT BIẾN trên kết quả API thật (DB demo, chỉ đọc):
//     (1) tồn đầu + phát sinh − đã thu = chuyển kỳ sau  (2) chuyển kỳ sau T(n) = tồn đầu T(n+1)  (3) tổng nhân viên = tổng phòng
import { trongKy, dongHoSo, dongTreo, xepTreo, demHoSoNv } from '../lib/phaply/baoCao.js'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }
const HN = '2026-11-17'
const th = { phi: 5e6, phi_dich_vu: 4e6, phi_thu_ho: 1e6, da_thu: 3e6, con_phai_thu: 2e6, no_den_han: 1e6 }

ok(trongKy({ received_at: '2026-10-05' }, '2026-11', '2026-11'), 'nhận tháng trước, chưa đóng → thuộc kỳ')
ok(!trongKy({ received_at: '2026-12-01' }, '2026-11', '2026-11'), 'nhận sau kỳ → không')
ok(!trongKy({ received_at: '2026-09-01', closed_at: '2026-10-20T03:00:00Z' }, '2026-11', '2026-11'), 'đóng trước kỳ → không')
ok(trongKy({ received_at: '2026-09-01', closed_at: '2026-11-02T03:00:00Z' }, '2026-11', '2026-11'), 'đóng trong kỳ → có')
let r = dongHoSo({ id: 1, code: 'PL-1', stage: 5, received_at: '2026-11-01', due_at: '2026-11-10', assigned_to: 'A' }, th, { tenNv: () => 'An', homNay: HN })
ok(r.so_ngay === 16 && r.tre && r.con_no === 2e6 && r.phu_trach === 'An', 'đang làm: số ngày tới hôm nay, trễ hạn', JSON.stringify(r))
r = dongHoSo({ id: 2, code: 'PL-2', stage: 10, received_at: '2026-11-01', due_at: '2026-11-10', closed_at: '2026-11-08T05:00:00Z' }, th, { homNay: HN })
ok(r.so_ngay === 7 && !r.tre && r.ngay_dong === '2026-11-08' && r.phu_trach === '(Chưa giao)', 'đã đóng trước hạn: số ngày tới ngày đóng, không trễ', JSON.stringify(r))
r = dongHoSo({ id: 3, code: 'PL-3', stage: 10, received_at: '2026-11-01', due_at: '2026-11-05', closed_at: '2026-11-07T20:00:00Z' }, th, { homNay: HN })
ok(r.tre && r.ngay_dong === '2026-11-08', 'đóng sau hạn → trễ; ngày đóng theo giờ VN (20h UTC = sáng hôm sau)', JSON.stringify(r))

ok(dongTreo({ stage: 10, wait_state: 'khach' }) === null, 'đã đóng → không treo')
ok(dongTreo({ stage: 4, received_at: '2026-11-01', due_at: '2026-12-01' }, { homNay: HN }) === null, 'không chờ, chưa trễ → không treo')
const a = dongTreo({ id: 'a', stage: 6, wait_state: 'so', received_at: '2026-11-01', due_at: '2026-12-01' }, { choTu: '2026-11-12', homNay: HN })
ok(a?.cho === 'Chờ Sở' && a.so_ngay_cho === 5 && !a.tre_noi_bo, 'chờ Sở 5 ngày tính từ lúc bắt đầu chờ', JSON.stringify(a))
const b = dongTreo({ id: 'b', stage: 6, wait_state: 'bo_sung', received_at: '2026-11-01', due_at: '2026-12-01' },
  { boSung: { ket_qua: 'bo_sung', han_bo_sung: '2026-11-15', noi_dung_bo_sung: 'x' }, homNay: HN })
ok(b?.qua_han_bo_sung && b.han_bo_sung === '2026-11-15', 'quá hạn nộp bổ sung', JSON.stringify(b))
const c = dongTreo({ id: 'c', stage: 3, received_at: '2026-10-01', due_at: '2026-11-10' }, { homNay: HN })
ok(c?.tre_noi_bo && c.so_ngay_tre === 7 && c.so_ngay_cho === null, 'trễ hạn nội bộ 7 ngày (không chờ ai)', JSON.stringify(c))
ok(xepTreo([a, c, b]).map(x => x.id).join() === 'b,c,a', 'xếp: quá hạn bổ sung → trễ → chờ lâu')

const dem = demHoSoNv([
  { assigned_to: 'A', received_at: '2026-10-03' },
  { assigned_to: 'A', received_at: '2026-10-20', closed_at: '2026-11-04T03:00:00Z' },
  { assigned_to: null, received_at: '2026-11-02' },
], ['2026-10', '2026-11'])
ok(JSON.stringify(dem.get('A')) === JSON.stringify([{ moi: 2, xong: 0, dang: 2 }, { moi: 0, xong: 1, dang: 1 }]) && dem.get('_')[1].moi === 1, 'đếm mới / xong / đang làm theo tháng', JSON.stringify([...dem]))

if (process.argv.includes('--that')) {
  const i = process.argv.indexOf('--that')
  const GOC = process.argv[i + 1]?.startsWith('http') ? process.argv[i + 1] : 'http://localhost:3010'
  const { createClient } = await import('@supabase/supabase-js')
  const { createServerClient } = await import('@supabase/ssr')
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (!url || url.includes('ykorxlkgsmzskdybebzg')) throw new Error('Không phải database demo — từ chối')
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
  if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('Không phải database demo — từ chối')
  const cookieCua = async email => {
    const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: v } = await anon.auth.verifyOtp({ email, token: l.properties.email_otp, type: 'email' })
    let ds = []
    const sc = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: c => { ds = c } } })
    await sc.auth.setSession({ access_token: v.session.access_token, refresh_token: v.session.refresh_token })
    return ds.map(c => `${c.name}=${c.value}`).join('; ')
  }
  const ck = await cookieCua('phaply@demo.savitax.vn')   // trưởng phòng pháp lý (cả phòng)
  const r = await fetch(`${GOC}/api/admin/phaply/bao-cao?tu=2026-08&toi=2026-12`, { headers: { cookie: ck } })
  const d = await r.json()
  ok(r.status === 200 && d.thangs?.length === 5, 'đọc báo cáo T8–T12', r.status + ' ' + JSON.stringify(d).slice(0, 150))
  if (r.status === 200) {
    const dt = d.phong.dong_tien
    for (const o of dt) for (const k of ['tong', 'dich_vu', 'thu_ho'])
      ok(o[k].ton_dau + o[k].phat_sinh - o[k].da_thu === o[k].chuyen, `(1) ${o.thang} ${k}: cộng trừ khớp`, JSON.stringify(o[k]))
    for (let j = 1; j < dt.length; j++) ok(dt[j - 1].tong.chuyen === dt[j].tong.ton_dau, `(2) chuyển kỳ sau ${dt[j - 1].thang} = tồn đầu ${dt[j].thang}`)
    for (const [j, o] of dt.entries()) {
      ok(d.nhan_vien.reduce((a, n) => a + n.dong_tien[j].tong.chuyen, 0) === o.tong.chuyen, `(3) ${o.thang}: tổng nợ nhân viên = phòng`)
      ok(d.nhan_vien.reduce((a, n) => a + n.doanh_so[j], 0) === d.phong.doanh_so[j].gom_vat, `(3) ${o.thang}: tổng doanh số nhân viên = phòng`)
      ok(d.nhan_vien.reduce((a, n) => a + n.ho_so[j].moi, 0) === d.phong.ho_so_moi[j], `(3) ${o.thang}: tổng hồ sơ mới nhân viên = phòng`)
    }
    ok(Array.isArray(d.ho_so) && d.ho_so.length > 0 && d.ho_so.every(h => h.phi - h.da_thu === h.con_no), 'theo hồ sơ: phí − đã thu = còn nợ từng dòng', d.ho_so?.length)
    ok(Array.isArray(d.treo) && d.treo.every(h => h.cho || h.tre_noi_bo || h.qua_han_bo_sung), 'hồ sơ treo đều có lý do treo', d.treo?.length)
    console.log(`  (${d.ho_so.length} hồ sơ trong kỳ, ${d.treo.length} hồ sơ treo, ${d.nhan_vien.length} dòng nhân viên)`)
  }
}
console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
