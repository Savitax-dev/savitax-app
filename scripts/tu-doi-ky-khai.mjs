// Quét MỘT LẦN mọi công ty đã có hồ sơ đồng bộ về: công ty nào khai kiểu khác kỳ khai app đang giữ
// (vd CHARGEPOINT kê tháng nhưng TNCN nộp theo quý) thì tự đổi kỳ khai + sinh lại lịch hạn nộp.
// Từ 19/10/2026 việc này tự chạy sau mỗi lần đồng bộ (lib/tokhaiGhi.js); script này chỉ để dọn
// các hồ sơ đã về TRƯỚC ngày đó.
//
//   node --env-file=.env.local scripts/tu-doi-ky-khai.mjs          (CHẠY KHÔ — chỉ in, không ghi)
//   node --env-file=.env.local scripts/tu-doi-ky-khai.mjs --ghi    (ghi thật)
//
// Luật ở lib/tokhaiLich.js (timKyKhaiTheoCong), ghi ở lib/tokhaiKyKhai.js — dùng chung với lúc
// đồng bộ, nên script này không có luật riêng nào.
import { createClient } from '@supabase/supabase-js'
import { tuDoiKyKhaiTheoCong } from '../lib/tokhaiKyKhai.js'

const ghi = process.argv.includes('--ghi')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Các công ty có hồ sơ — lật trang có .order('id'), không thì lặp / sót dòng (giới hạn 1.000 dòng).
const coHoSo = new Set()
for (let tu = 0; ; tu += 1000) {
  const { data, error } = await supabase.from('tax_filings').select('id, client_id')
    .not('filing_type_id', 'is', null).order('id').range(tu, tu + 999)
  if (error) throw new Error(error.message)
  for (const r of data) coHoSo.add(r.client_id)
  if (data.length < 1000) break
}
const { data: dsCty } = await supabase.from('clients').select('id, name, is_active, status').in('id', [...coHoSo])
const cty = (dsCty || []).filter(c => c.is_active !== false && c.status !== 'inactive')
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

console.log(`${ghi ? 'GHI THẬT' : 'CHẠY KHÔ (không ghi gì)'} — ${cty.length} công ty có hồ sơ\n`)
let soDoi = 0, soXemTay = 0
for (const c of cty) {
  const kq = await tuDoiKyKhaiTheoCong(supabase, c.id, { thu: !ghi })
  if (!kq.doi.length && !kq.xemTay.length) continue
  console.log(c.name)
  for (const d of kq.doi) {
    soDoi++
    const k = d.ketQua || {}
    console.log(`  ĐỔI  ${d.code} -> ${d.periodKind === 'month' ? 'Tháng' : 'Quý'} từ ${d.quy}`)
    console.log(`       xoá: ${k.daXoa?.join(', ') || '—'} | sinh: ${k.daThem?.join(', ') || '—'} | gắn hồ sơ: ${k.ganLaiHoSo?.join(', ') || '—'}`
      + (k.giuLai?.length ? ` | GIỮ (có dữ liệu): ${k.giuLai.map(g => g.ky + ':' + g.trangThai).join(', ')}` : ''))
  }
  for (const x of kq.xemTay) {
    soXemTay++
    console.log(`  XEM TAY  ${x.code} ${x.quy}: ${x.lyDo}`)
  }
}
console.log(`\nTổng: ${soDoi} lần đổi, ${soXemTay} chỗ cần xem tay.${ghi ? '' : ' Chưa ghi gì — thêm --ghi để ghi thật.'}`)
