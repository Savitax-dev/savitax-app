// Bộ kiểm hạn lưu ảnh CCCD 24 tháng (lib/phaply/hanLuu.js) — offline; thêm --that [URL] để chạy cron thật trên DB DEMO + máy chủ thử
// với một hồ sơ GIẢ đóng cách đây 25 tháng (ảnh giả 1 điểm ảnh), rồi dọn sạch.
//   node scripts/test-phaply-han-luu.mjs
//   node --env-file=.env.local scripts/test-phaply-han-luu.mjs --that [http://localhost:3010]
import { hoSoToiHanXoa, mocHetHan } from '../lib/phaply/hanLuu.js'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }
const NOW = new Date('2026-11-17T03:00:00Z')
const truoc = thang => { const d = new Date(NOW); d.setUTCMonth(d.getUTCMonth() - thang); return d.toISOString() }

ok(mocHetHan(NOW).toISOString().startsWith('2024-11-17'), 'mốc = 24 tháng trước', mocHetHan(NOW).toISOString())
const ds = [
  { id: 'a', entity_id: 'E1', stage: 10, closed_at: truoc(25) },             // tới hạn
  { id: 'b', entity_id: 'E2', stage: 10, closed_at: truoc(23) },             // chưa đủ 24 tháng
  { id: 'c', entity_id: 'E3', stage: 10, closed_at: truoc(30) },             // tới hạn nhưng pháp nhân còn hồ sơ d đang làm
  { id: 'd', entity_id: 'E3', stage: 4, closed_at: null },
  { id: 'e', entity_id: 'E4', stage: 7, closed_at: null },                   // đang làm (hoặc đã mở lại → closed_at bị xoá)
  { id: 'f', entity_id: 'E5', stage: 10, closed_at: truoc(24) },             // đúng 24 tháng → tới hạn
  { id: 'g', entity_id: 'E6', stage: 10, closed_at: truoc(40) },             // tới hạn; hồ sơ khác cùng pháp nhân đã XOÁ → không giữ lại
  { id: 'h', entity_id: 'E6', stage: 3, closed_at: null, is_deleted: true },
]
const kq = hoSoToiHanXoa(ds, NOW)
ok(JSON.stringify(kq.sort()) === JSON.stringify(['a', 'f', 'g']), 'chọn đúng hồ sơ tới hạn', JSON.stringify(kq))

if (process.argv.includes('--that')) {
  const GOC = process.argv[process.argv.indexOf('--that') + 1]?.startsWith('http') ? process.argv[process.argv.indexOf('--that') + 1] : 'http://localhost:3010'
  const { createClient } = await import('@supabase/supabase-js')
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (!url || url.includes('ykorxlkgsmzskdybebzg')) throw new Error('Không phải database demo — từ chối')
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
  if ((await admin.from('demo_la_ban_demo').select('id').limit(1)).error) throw new Error('Không phải database demo — từ chối')
  const goiCron = q => fetch(`${GOC}/api/cron/phaply-xoa-cccd${q}`, { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }).then(r => r.json())
  const { data: ent } = await admin.from('legal_entities').insert({ entity_type: '1tv', name: '[THỬ] HẠN LƯU' }).select('id').single()
  const { data: hs } = await admin.from('legal_cases').insert({ code: 'PL-0000-99', procedure_code: 'tlm', entity_type: '1tv', entity_id: ent.id, title: '[THỬ] HẠN LƯU',
    stage: 10, received_at: truoc(26).slice(0, 10), closed_at: new Date(Date.now() - 25 * 30.5 * 86400000).toISOString(), note: '[TEST-API]' }).select('id').single()
  const anh = `${hs.id}/00000000-gia-truoc.png`
  await admin.storage.from('phaply-cccd').upload(anh, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), { contentType: 'image/png', upsert: true })
  const { data: p } = await admin.from('legal_people').insert({ ho_ten: 'Thử Hạn Lưu', so_giay_to: '079090000808', cccd_front_path: anh }).select('id').single()
  await admin.from('legal_entity_people').insert({ entity_id: ent.id, person_id: p.id, vai_tro: 'dai_dien', chuc_danh: null, chu_tich: false, thu_tu: 0 })
  try {
    const xem = await goiCron('?xem=1')
    ok(xem.ok && xem.ket_qua?.some(k => k.ho_so === 'PL-0000-99' && k.so_anh === 1), 'cron ?xem=1 liệt kê hồ sơ thử', JSON.stringify(xem))
    ok(((await admin.storage.from('phaply-cccd').list(hs.id)).data || []).length === 1, 'xem thử không xoá ảnh')
    const sai = await fetch(`${GOC}/api/cron/phaply-xoa-cccd`)
    ok(sai.status === 401, 'gọi không có khoá cron → 401')
    const that = await goiCron('')
    ok(that.ok && that.ket_qua?.some(k => k.ho_so === 'PL-0000-99' && !k.loi), 'cron xoá thật', JSON.stringify(that))
    // liệt kê thư mục, KHÔNG tải ảnh: lần tải trước đó để CDN của Storage nhớ tạm, tải lại vẫn ra ảnh dù đã xoá
    ok(!((await admin.storage.from('phaply-cccd').list(hs.id)).data || []).length, 'ảnh đã xoá khỏi kho')
    const { data: sau } = await admin.from('legal_people').select('so_giay_to, cccd_front_path').eq('id', p.id).single()
    ok(sau.so_giay_to === '079090000808' && !sau.cccd_front_path, 'giữ số liệu, bỏ đường dẫn ảnh', JSON.stringify(sau))
    const { data: nk } = await admin.from('legal_case_stage_log').select('note').eq('case_id', hs.id)
    ok(nk?.some(n => /hết hạn lưu 24 tháng/.test(n.note)), 'ghi nhật ký hồ sơ')
  } finally {
    await admin.storage.from('phaply-cccd').remove([anh])
    await admin.from('legal_case_stage_log').delete().eq('case_id', hs.id)
    await admin.from('legal_cases').delete().eq('id', hs.id)
    await admin.from('legal_entities').delete().eq('id', ent.id)
    await admin.from('legal_people').delete().eq('id', p.id)
    console.log('· đã dọn dữ liệu thử')
  }
}
console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
