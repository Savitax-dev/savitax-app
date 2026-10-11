// Thêm 2 việc checklist mới cho CẢ báo cáo tháng lẫn báo cáo quý, mọi tháng (anh chốt 10/10/2026):
//   · Ngày 10: "Hoàn thiện Nhật ký công việc SVT.MB07 tới tháng <tháng trước>"
//   · Ngày 27: "Hoàn thiện Folder lưu trữ trên drive tới tháng <tháng trước>"
// Áp dụng từ T10/2026. Các kỳ CŨ phải "tự hoàn thành đúng hạn" để %-công việc quá khứ không tụt:
//   · T1–T9/2026: cả 2 việc
//   · T10/2026: riêng việc ngày 10 (thêm vào đúng ngày hạn, nhân viên không kịp tick ~300 công ty) —
//     việc ngày 27 của T10 tính thật.
// Cách làm: ghi sẵn dòng task_records is_done=true, done_at = đúng ngày hạn. Không sửa code tính KPI
// (logic đó nằm rải ở ~10 route/trang), nên mọi trang tự hiểu là "đúng hạn".
//
//   node --env-file=.env.local scripts/them-checklist-nhat-ky-folder.mjs            # chạy khô
//   node --env-file=.env.local scripts/them-checklist-nhat-ky-folder.mjs --apply    # ghi thật
//   node --env-file=.env.local scripts/them-checklist-nhat-ky-folder.mjs --undo <file.json>
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { enteredAppByMonth } from '../lib/contractDates.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY = process.argv.includes('--apply')
const UNDO = process.argv.indexOf('--undo')
const NAM = 2026, AP_DUNG_TU = 10
const GHI_CHU = 'Tự động hoàn thành — việc này áp dụng từ T10/2026'
const VIEC = [
  { day: 10, ten: (truoc) => 'Hoàn thiện Nhật ký công việc SVT.MB07 tới tháng ' + truoc },
  { day: 27, ten: (truoc) => 'Hoàn thiện Folder lưu trữ trên drive tới tháng ' + truoc },
]
const chia = (a, n = 500) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

if (UNDO > 0) {
  const f = JSON.parse(readFileSync(process.argv[UNDO + 1], 'utf8'))
  for (const lo of chia(f.recordIds, 200)) await sb.from('task_records').delete().in('id', lo)
  // dòng nhân viên tự tick sau đó cho các việc này cũng phải gỡ trước khi xoá định nghĩa
  for (const lo of chia(f.defIds, 50)) { await sb.from('task_records').delete().in('task_def_id', lo); await sb.from('task_definitions').delete().in('id', lo) }
  console.log('đã gỡ ' + f.defIds.length + ' việc mẫu và ' + f.recordIds.length + ' dòng tự hoàn thành')
  process.exit(0)
}

const { data: defs } = await sb.from('task_definitions').select('*').eq('is_active', true).order('sort_order').range(0, 999)
if (defs.some(d => /SVT\.MB07|Folder lưu trữ trên drive/i.test(d.name))) { console.log('!! đã có việc này trong checklist mẫu — dừng để không thêm trùng'); process.exit(1) }

const moi = []
for (const rt of ['monthly', 'quarterly']) {
  for (let m = 1; m <= 12; m++) {
    const nhom = defs.filter(d => d.report_type === rt && Number(d.month) === m)
    if (!nhom.length) { console.log('!! không có việc mẫu nào cho ' + rt + ' T' + m); process.exit(1) }
    const truoc = m === 1 ? 12 : m - 1
    for (const v of VIEC) {
      // Xếp ngay sau việc cuối cùng có hạn <= ngày của việc mới, để danh sách vẫn theo thứ tự ngày.
      const truocNo = nhom.filter(d => Number(d.deadline_day) <= v.day)
      let sort = (truocNo.length ? Math.max(...truocNo.map(d => d.sort_order)) : Math.min(...nhom.map(d => d.sort_order)) - 2) + 1
      while (nhom.some(d => d.sort_order === sort) || moi.some(x => x.report_type === rt && x.month === m && x.sort_order === sort)) sort++
      moi.push({ name: v.ten(truoc), description: null, deadline_day: v.day, sort_order: sort, applies_to: nhom[0].applies_to, report_type: rt, is_active: true, month: m })
    }
  }
}
console.log('Việc mẫu sẽ thêm: ' + moi.length)
for (const x of moi.filter(x => x.month === 10 || x.month === 1)) console.log('   ' + x.report_type.padEnd(9) + ' T' + String(x.month).padStart(2) + ' ngày ' + x.deadline_day + ' (sort ' + x.sort_order + ') ' + x.name)

const { data: cl } = await sb.from('clients').select('id, created_at')
const demTu = (m, day) => cl.filter(c => enteredAppByMonth(c.created_at, NAM, m)).length
let n = 0
for (let m = 1; m <= AP_DUNG_TU; m++) n += demTu(m) * (m < AP_DUNG_TU ? 2 : 1)
console.log('Dòng "tự hoàn thành đúng hạn" sẽ ghi: ' + n + ' (T1–T9: cả 2 việc; T10: riêng việc ngày 10) cho ' + cl.length + ' công ty')
if (!APPLY) { console.log('(chạy khô — chưa ghi gì)'); process.exit(0) }

const { data: ins, error } = await sb.from('task_definitions').insert(moi).select('id, report_type, month, deadline_day')
if (error) { console.log('LỖI thêm việc mẫu:', error.message); process.exit(1) }
const { data: full } = await sb.from('clients').select('id, created_at, report_type')
const recs = []
for (const c of full) {
  const rt = c.report_type || 'monthly'
  for (let m = 1; m <= AP_DUNG_TU; m++) {
    if (!enteredAppByMonth(c.created_at, NAM, m)) continue
    for (const d of ins.filter(x => x.report_type === rt && Number(x.month) === m)) {
      if (m === AP_DUNG_TU && Number(d.deadline_day) !== 10) continue
      recs.push({ client_id: c.id, task_def_id: d.id, year: NAM, month: m, is_done: true, done_by: null,
        done_at: NAM + '-' + String(m).padStart(2, '0') + '-' + String(d.deadline_day).padStart(2, '0') + 'T00:00:00+00:00', note: GHI_CHU })
    }
  }
}
const recordIds = []
for (const lo of chia(recs)) {
  const { data, error: e } = await sb.from('task_records').insert(lo).select('id')
  if (e) { console.log('LỖI ghi dòng tự hoàn thành:', e.message); break }
  recordIds.push(...data.map(x => x.id))
}
const file = process.argv[process.argv.indexOf('--apply') + 1]
if (file) writeFileSync(file, JSON.stringify({ luc: new Date().toISOString(), defIds: ins.map(x => x.id), recordIds }))
console.log('ĐÃ GHI: ' + ins.length + ' việc mẫu, ' + recordIds.length + '/' + recs.length + ' dòng tự hoàn thành' + (file ? ' · lưu danh sách để gỡ lại: ' + file : ''))
