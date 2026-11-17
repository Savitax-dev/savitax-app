// Phân hệ Pháp lý — chuẩn bị DATABASE DEMO để thử trên máy (KHÔNG BAO GIỜ chạy vào production):
//   node --env-file=.env.local scripts/phaply-chuan-bi-demo.mjs [--mau]
//   1. chạy sql/56 + sql/57 (chạy lại an toàn)   2. nạp checklist + lịch thu mặc định
//   3. --mau: thêm vài hồ sơ GIẢ (tên, SĐT bịa) có phí / đợt / khoản thu để thử danh sách, công nợ, báo cáo
// DB demo bị làm mới mỗi đêm 2h (truncate mọi bảng + nạp lại quyền từ ảnh chụp) → mỗi lần làm việc chạy lại script này.
import fs from 'node:fs'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import { napMauMacDinh } from '../lib/phaply/mauMacDinh.js'
import { hanNoiBo, homNayVN } from '../lib/phaply/hoSo.js'

const REF_THAT = 'ykorxlkgsmzskdybebzg'
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || ''), db = String(process.env.DEMO_DB_URL || '')
if (!url || url.includes(REF_THAT) || !db || db.includes(REF_THAT)) throw new Error('Không phải database demo — từ chối')
if (!db.includes(url.replace(/^https?:\/\//, '').split('.')[0])) throw new Error('DEMO_DB_URL và NEXT_PUBLIC_SUPABASE_URL khác project — từ chối')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { error: khongDemo } = await admin.from('demo_la_ban_demo').select('id').limit(1)
if (khongDemo) throw new Error('Không thấy bảng demo_la_ban_demo — không phải database demo, từ chối')

const sql = postgres(db, { ssl: 'require', max: 1, onnotice: () => {} })
for (const f of ['sql/56_phap_ly_ho_so.sql', 'sql/57_phap_ly_phap_nhan.sql']) await sql.unsafe(fs.readFileSync(f, 'utf8'))
await sql.unsafe("notify pgrst, 'reload schema'")   // PostgREST nhận bảng mới ngay
await sql.end()
await new Promise(r => setTimeout(r, 2500))
console.log('✓ sql/56 + sql/57 đã chạy trên demo (danh mục: scripts/phaply-nap-danh-muc.mjs --ghi)')
console.log('✓ mẫu mặc định:', await napMauMacDinh(admin))

if (process.argv.includes('--mau')) {
  const { data: nv } = await admin.from('staff').select('id, full_name, role').in('role', ['phaply', 'phaply_leader'])
  const tp = nv?.find(s => s.role === 'phaply_leader')
  if (!tp) throw new Error('Demo chưa có tài khoản trưởng phòng Pháp lý')
  const { count } = await admin.from('legal_cases').select('id', { count: 'exact', head: false })
  if (count) { console.log('· đã có', count, 'hồ sơ — không thêm hồ sơ mẫu'); process.exit(0) }
  const hn = homNayVN()
  const lui = (n) => { const t = new Date(hn + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10) }
  const { data: tpl } = await admin.from('legal_task_templates').select('id, procedure_code, sla_days')
  const MAU = [
    { ten: 'CÔNG TY TNHH THƯƠNG MẠI HOA SEN XANH', loai: '1tv', tt: 'tlm', lienHe: 'Nguyễn Văn Bình', sdt: '0901000111', nhan: lui(40), buoc: 7, dv: 4_000_000, th: 1_000_000, thu: [[lui(38), 3_000_000], [lui(5), 1_000_000]] },
    { ten: 'CÔNG TY CỔ PHẦN ĐẦU TƯ MINH KHANG', loai: 'cp', tt: 'tlm', lienHe: 'Trần Thị Hạnh', sdt: '0902000222', nhan: lui(12), buoc: 5, cho: 'khach', dv: 6_000_000, th: 1_500_000, thu: [[lui(10), 4_500_000]] },
    { ten: 'CÔNG TY TNHH DỊCH VỤ AN NHIÊN', loai: '2tv', tt: 'thay_doi', lienHe: 'Lê Quốc Huy', sdt: '0903000333', nhan: lui(3), buoc: 2, dv: 2_500_000, th: 300_000, thu: [] },
    { ten: '', loai: '1tv', tt: 'tlm', lienHe: 'Phạm Thu Trang', sdt: '0904000444', nhan: hn, buoc: 1, dv: 0, th: 0, thu: [], chuaGiao: true },
  ]
  for (const [i, m] of MAU.entries()) {
    const t = tpl.find(x => x.procedure_code === m.tt)
    const { data: ent } = await admin.from('legal_entities').insert({ entity_type: m.loai, name: m.ten }).select('id').single()
    const { data: hs, error } = await admin.from('legal_cases').insert({
      code: `PL-${hn.slice(2, 4)}${hn.slice(5, 7)}-${String(90 + i)}`, procedure_code: m.tt, entity_type: m.loai, entity_id: ent.id,
      title: m.ten || m.lienHe, contact_name: m.lienHe, contact_phone: m.sdt, stage: m.buoc, wait_state: m.cho || null,
      assigned_to: m.chuaGiao ? null : tp.id, received_by: tp.id, received_at: m.nhan, due_at: hanNoiBo(m.nhan, t?.sla_days || 7), created_by: tp.id,
    }).select('id').single()
    if (error) throw new Error(error.message)
    const { data: items } = await admin.from('legal_task_template_items').select('id, stage, title, sort').eq('template_id', t.id).eq('is_active', true)
    await admin.from('legal_case_tasks').insert((items || []).map(it => ({ case_id: hs.id, template_item_id: it.id, stage: it.stage, title: it.title, sort: it.sort,
      done_at: it.stage < m.buoc ? new Date().toISOString() : null, done_by: it.stage < m.buoc ? tp.id : null })))
    if (m.buoc > 1) await admin.from('legal_case_stage_log').insert({ case_id: hs.id, kind: 'stage', from_value: '1', to_value: String(m.buoc), created_by: tp.id,
      created_at: new Date(Date.parse(m.nhan + 'T03:00:00Z') + 2 * 86400000).toISOString() })
    if (m.dv + m.th) {
      await admin.from('legal_case_fees').insert([{ case_id: hs.id, kind: 'dich_vu', name: 'Phí dịch vụ', amount: m.dv, sort: 0 }, { case_id: hs.id, kind: 'thu_ho', name: 'Lệ phí + khắc dấu', amount: m.th, sort: 1 }])
      const { data: dots } = await admin.from('legal_case_installments').insert([
        { case_id: hs.id, seq: 1, name: 'Đợt 1 — khi nhận hồ sơ', amount_dich_vu: m.dv / 2, amount_thu_ho: m.th, due_stage: 1 },
        { case_id: hs.id, seq: 2, name: 'Đợt 2 — khi có kết quả', amount_dich_vu: m.dv / 2, amount_thu_ho: 0, due_stage: 7 },
      ]).select('id, seq')
      for (const [ngay, tien] of m.thu) {
        const dot = tien >= m.th + m.dv / 2 || ngay === m.thu[0][0] ? dots[0] : dots[1]
        const th = dot.seq === 1 ? Math.min(tien, m.th) : 0
        await admin.from('legal_case_payments').insert({ case_id: hs.id, installment_id: dot.id, amount_thu_ho: th, amount_dich_vu: tien - th, paid_at: ngay, staff_id: tp.id, method: 'chuyen_khoan', created_by: tp.id })
      }
    }
  }
  console.log('✓ thêm', MAU.length, 'hồ sơ mẫu (dữ liệu giả)')
}
