// Đưa danh mục kênh truyền thông của Phòng Kinh doanh về đúng danh sách + thứ tự chuẩn.
//
//   node --env-file=.env.local scripts/seed-sales-channels.mjs           -- xem trước
//   node --env-file=.env.local scripts/seed-sales-channels.mjs --apply   -- ghi
//
// Chạy lại nhiều lần an toàn. Không xoá kênh nào (khách cũ đang trỏ tới): kênh không có trong danh
// sách chuẩn giữ nguyên, xếp sau cùng. Đổi tên thì giữ nguyên id nên khách đã gắn kênh vẫn đúng.
import { createClient } from '@supabase/supabase-js'

// Thứ tự hiển thị trong ô chọn kênh (người dùng chốt 2026-09-11: tách Zalo OA / Zalo cá nhân — OA đứng trên,
// thêm Email ngay dưới Website).
const CHANNELS = ['Facebook', 'Zalo OA', 'Zalo cá nhân', 'Website', 'Email', 'TikTok', 'Google', 'Hotline', 'Giới thiệu', 'Khách cũ', 'Khác']
// Tên cũ → tên mới (đổi tên, giữ id)
const RENAME = { 'Zalo': 'Zalo cá nhân' }

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
const low = x => String(x || '').trim().toLowerCase()

const { data: cur, error } = await s.from('sales_channels').select('id, name, sort_order, is_active').order('sort_order')
if (error) { console.log('Lỗi đọc danh mục kênh: ' + error.message); process.exit(1) }
const { data: leads } = await s.from('sales_leads').select('channel_id').eq('is_deleted', false)
const used = new Map()
for (const l of leads || []) used.set(l.channel_id, (used.get(l.channel_id) || 0) + 1)

const ops = []
const byName = new Map((cur || []).map(c => [low(c.name), c]))
for (const [from, to] of Object.entries(RENAME)) {
  const c = byName.get(low(from))
  if (c && !byName.has(low(to))) {
    ops.push({ kind: 'đổi tên', id: c.id, patch: { name: to }, text: from + ' → ' + to + ' (' + (used.get(c.id) || 0) + ' khách đang gắn)' })
    byName.delete(low(from)); byName.set(low(to), { ...c, name: to })
  }
}
CHANNELS.forEach((name, i) => {
  const order = i === CHANNELS.length - 1 ? 99 : i + 1 // "Khác" luôn đứng cuối
  const c = byName.get(low(name))
  if (!c) ops.push({ kind: 'thêm', insert: { name, sort_order: order }, text: name + ' (thứ tự ' + order + ')' })
  else if (c.sort_order !== order || !c.is_active) ops.push({ kind: 'xếp lại', id: c.id, patch: { sort_order: order, is_active: true }, text: name + ': ' + c.sort_order + ' → ' + order })
})
const extra = (cur || []).filter(c => !CHANNELS.some(n => low(n) === low(c.name)) && !RENAME[c.name])
for (const c of extra) console.log('  giữ nguyên kênh ngoài danh sách: ' + c.name)

console.log((apply ? 'GHI' : 'XEM TRƯỚC (thêm --apply để ghi)') + ' — ' + ops.length + ' thay đổi')
for (const o of ops) console.log('  ' + o.kind.padEnd(8) + o.text)
if (!apply) process.exit(0)

for (const o of ops) {
  const r = o.insert ? await s.from('sales_channels').insert(o.insert) : await s.from('sales_channels').update(o.patch).eq('id', o.id)
  if (r.error) { console.log('  ✗ ' + o.text + ': ' + r.error.message); process.exitCode = 1 }
}
const { data: after } = await s.from('sales_channels').select('name, sort_order').eq('is_active', true).order('sort_order')
console.log('\nDanh mục kênh hiện tại: ' + (after || []).map(c => c.name).join(' · '))
