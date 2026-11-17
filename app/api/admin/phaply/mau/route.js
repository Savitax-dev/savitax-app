// Phân hệ Pháp lý — checklist mẫu theo thủ tục + lịch thu mẫu. Đọc: mọi người có view_phaply (để chọn khi tạo hồ sơ);
// sửa: manage_phaply_template. Đổi mẫu chỉ áp cho hồ sơ TẠO SAU (việc của hồ sơ cũ giữ nguyên, như HCNS).
import { requirePhapLy, loi } from '@/lib/phaply/quyen'
import { THU_TUC, BUOC_DONG } from '@/lib/phaply/hoSo'
import { napMauMacDinh } from '@/lib/phaply/mauMacDinh'

export async function GET() {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin } = auth
  const [tpl, items, plans] = await Promise.all([
    admin.from('legal_task_templates').select('*').order('procedure_code'),
    admin.from('legal_task_template_items').select('*').eq('is_active', true).order('stage').order('sort').order('id'),
    admin.from('legal_payment_plans').select('*').eq('is_active', true).order('sort').order('id'),
  ])
  if (tpl.error) return Response.json({ chua_cai: true, thu_tuc: [], lich_mau: [] })
  const theoTpl = new Map()
  for (const it of items.data || []) { if (!theoTpl.has(it.template_id)) theoTpl.set(it.template_id, []); theoTpl.get(it.template_id).push(it) }
  return Response.json({
    thu_tuc: THU_TUC.map(t => {
      const m = (tpl.data || []).find(x => x.procedure_code === t.k)
      return { ...t, template_id: m?.id || null, sla_days: m?.sla_days ?? null, note: m?.note || '', items: m ? theoTpl.get(m.id) || [] : [] }
    }),
    lich_mau: plans.data || [],
    sua_duoc: auth.q.mau,
  })
}

// PUT { procedure_code, sla_days, items: [{id?, stage, title}] }   — lưu checklist một thủ tục
//     { lich_mau: [{id?, name, procedure_code?, items: [{ten, pt_dich_vu, pt_thu_ho, due_stage}]}] } — lưu toàn bộ lịch thu mẫu
export async function PUT(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  if (!auth.q.mau) return loi(403, 'Chỉ trưởng phòng sửa được mẫu')
  const { admin } = auth
  const b = await request.json().catch(() => ({}))

  if (b.nap_mac_dinh) {
    try { return Response.json({ ok: true, ...(await napMauMacDinh(admin)) }) } catch (e) { return loi(500, e.message) }
  }

  if (Array.isArray(b.lich_mau)) {
    const { data: cu } = await admin.from('legal_payment_plans').select('id').eq('is_active', true)
    const giu = new Set(b.lich_mau.filter(p => p.id).map(p => p.id))
    const bo = (cu || []).filter(p => !giu.has(p.id)).map(p => p.id)
    if (bo.length) await admin.from('legal_payment_plans').update({ is_active: false }).in('id', bo)
    for (const [i, p] of b.lich_mau.entries()) {
      const items = (p.items || []).map(it => ({
        ten: String(it.ten || '').trim() || 'Đợt', pt_dich_vu: Math.max(0, Number(it.pt_dich_vu) || 0),
        pt_thu_ho: Math.max(0, Number(it.pt_thu_ho) || 0), due_stage: Number(it.due_stage) >= 1 && Number(it.due_stage) <= BUOC_DONG ? Number(it.due_stage) : null,
      }))
      const tong = k => items.reduce((a, it) => a + it[k], 0)
      if (items.length && (tong('pt_dich_vu') !== 100 || tong('pt_thu_ho') !== 100))
        return loi(400, `Lịch "${p.name}": tổng % phí dịch vụ và % thu hộ phải đúng 100`)
      const row = { name: String(p.name || '').trim() || 'Lịch thu', procedure_code: p.procedure_code || null, items, sort: i, is_active: true }
      const kq = p.id ? await admin.from('legal_payment_plans').update(row).eq('id', p.id) : await admin.from('legal_payment_plans').insert(row)
      if (kq.error) return loi(500, kq.error.message)
    }
    return Response.json({ ok: true })
  }

  if (!THU_TUC.some(t => t.k === b.procedure_code)) return loi(400, 'Thủ tục không hợp lệ')
  const sla = Math.max(0, Math.round(Number(b.sla_days) || 0))
  let { data: tpl } = await admin.from('legal_task_templates').select('id').eq('procedure_code', b.procedure_code).maybeSingle()
  if (!tpl) {
    const r = await admin.from('legal_task_templates').insert({ procedure_code: b.procedure_code, sla_days: sla }).select('id').single()
    if (r.error) return loi(500, r.error.message)
    tpl = r.data
  } else await admin.from('legal_task_templates').update({ sla_days: sla, updated_at: new Date().toISOString() }).eq('id', tpl.id)

  const items = (b.items || []).map(it => ({ ...it, title: String(it.title || '').trim(), stage: Number(it.stage) }))
    .filter(it => it.title && it.stage >= 1 && it.stage <= BUOC_DONG)
  const { data: cu } = await admin.from('legal_task_template_items').select('id').eq('template_id', tpl.id).eq('is_active', true)
  const giu = new Set(items.filter(i => i.id).map(i => i.id))
  const bo = (cu || []).filter(i => !giu.has(i.id)).map(i => i.id)
  // Xoá MỀM: việc của hồ sơ cũ còn trỏ tới dòng mẫu
  if (bo.length) await admin.from('legal_task_template_items').update({ is_active: false }).in('id', bo)
  const demBuoc = {}
  for (const it of items) {
    const sort = (demBuoc[it.stage] = (demBuoc[it.stage] || 0) + 1)
    const row = { template_id: tpl.id, stage: it.stage, title: it.title.slice(0, 300), sort, is_active: true }
    const kq = it.id && giu.has(it.id) ? await admin.from('legal_task_template_items').update(row).eq('id', it.id) : await admin.from('legal_task_template_items').insert(row)
    if (kq.error) return loi(500, kq.error.message)
  }
  return Response.json({ ok: true })
}
