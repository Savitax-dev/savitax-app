// Phân hệ Pháp lý — danh sách hồ sơ (lọc phạm vi ở máy chủ) + tạo hồ sơ mới.
import { requirePhapLy, locPhamVi, docHet, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, docTienNhieuHoSo, ghiNhatKy, maMoi, mauCuaThuTuc, taoViecTuMau, hanTuMau, nhanVienPhapLy, tenNhanVien } from '@/lib/phaply/hoSoMayChu'
import { THU_TUC, LOAI_HINH, NGUON, homNayVN, treHan, thuTucLabel, BUOC_DONG } from '@/lib/phaply/hoSo'
import { tongHopHoSo, apLichMau } from '@/lib/phaply/tien'

// GET ?dong=1 (gồm hồ sơ đã đóng) → { ho_so: [...], the: {...}, nhan_vien, q, toi }
export async function GET(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, q } = auth
  const coDong = new URL(request.url).searchParams.get('dong') === '1'

  let rows
  try {
    rows = await docHet((a, b) => {
      let x = admin.from('legal_cases').select(COT_HO_SO).eq('is_deleted', false)
      if (!coDong) x = x.lt('stage', BUOC_DONG)
      return locPhamVi(x, auth).order('received_at', { ascending: false }).order('id').range(a, b)
    })
  } catch (e) {
    // Chưa chạy sql/56 (hoặc bản clone) — báo rõ thay vì lỗi 500 khó hiểu
    if (/legal_cases/.test(e.message)) return Response.json({ chua_cai: true, ho_so: [], q })
    return loi(500, e.message)
  }
  const [nv, tienMap, ents] = await Promise.all([
    tenNhanVien(admin),
    docTienNhieuHoSo(admin, rows.map(r => r.id)),
    rows.some(r => r.entity_id)
      ? admin.from('legal_entities').select('id, name, tax_code').in('id', [...new Set(rows.map(r => r.entity_id).filter(Boolean))])
      : Promise.resolve({ data: [] }),
  ])
  const entById = new Map((ents.data || []).map(e => [e.id, e]))
  const homNay = homNayVN()
  const ds = rows.map(r => {
    const t = tienMap.get(r.id)
    const th = tongHopHoSo({ hoSo: r, fees: t.fees, dots: t.dots, payments: t.payments, nhatKy: t.nhatKy, homNayISO: homNay })
    const viecBuoc = t.viec.filter(v => v.stage === r.stage)
    return {
      ...r,
      ten_phap_nhan: entById.get(r.entity_id)?.name || '', mst: entById.get(r.entity_id)?.tax_code || '',
      ten_phu_trach: nv.get(r.assigned_to)?.full_name || '',
      tre_han: treHan(r, homNay),
      viec_buoc: { xong: viecBuoc.filter(v => v.done_at).length, tong: viecBuoc.length },
      ...(q.tien ? { phi: th.phi, da_thu: th.da_thu, no_den_han: th.no_den_han, con_phai_thu: th.con_phai_thu } : {}),
    }
  })
  const dang = ds.filter(r => r.stage < BUOC_DONG)
  const the = {
    dang_lam: dang.length,
    cho_khach: dang.filter(r => r.wait_state === 'khach').length,
    cho_co_quan: dang.filter(r => r.wait_state === 'so' || r.wait_state === 'thue').length,
    bo_sung: dang.filter(r => r.wait_state === 'bo_sung').length,
    tre_han: dang.filter(r => r.tre_han).length,
    chua_giao: dang.filter(r => !r.assigned_to).length,
    ...(q.tien ? { no_den_han: dang.reduce((a, r) => a + (r.no_den_han || 0), 0) } : {}),
  }
  return Response.json({ ho_so: ds, the, nhan_vien: await nhanVienPhapLy(admin), q, toi: auth.caller.staffId })
}

// POST — tạo hồ sơ. Body: { procedure_code, entity_type, ten_phap_nhan, mst?, contact_name, contact_phone, contact_email?,
//   source, assigned_to?, received_at?, note?, phi?: [{kind, name, amount}], lich_mau_id? }
export async function POST(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, q, caller } = auth
  if (!q.sua && !q.ca_phong) return loi(403, 'Không có quyền tạo hồ sơ pháp lý')
  const b = await request.json().catch(() => ({}))

  if (!THU_TUC.some(t => t.k === b.procedure_code)) return loi(400, 'Chọn thủ tục')
  if (!LOAI_HINH.some(t => t.k === b.entity_type)) return loi(400, 'Chọn loại hình')
  const ten = String(b.ten_phap_nhan || '').trim().toLocaleUpperCase('vi-VN')
  const lienHe = String(b.contact_name || '').trim()
  const sdt = String(b.contact_phone || '').replace(/[^\d+]/g, '')
  if (!ten && !lienHe) return loi(400, 'Nhập tên doanh nghiệp (dự kiến) hoặc người liên hệ')
  if (!sdt) return loi(400, 'Nhập số điện thoại liên hệ')
  const nguon = NGUON.some(n => n.k === b.source) ? b.source : 'moi'

  // Người phụ trách: trưởng phòng giao được cho người khác; nhân viên tạo là tự nhận
  let phuTrach = caller.staffId
  if (b.assigned_to !== undefined && q.ca_phong) phuTrach = b.assigned_to || null
  const ngayNhan = /^\d{4}-\d{2}-\d{2}$/.test(b.received_at || '') ? b.received_at : homNayVN()

  const { data: ent, error: e1 } = await admin.from('legal_entities').insert({
    entity_type: b.entity_type, name: ten, tax_code: String(b.mst || '').trim() || null, created_by: caller.staffId,
  }).select('id').single()
  if (e1) return loi(500, e1.message)

  const mau = await mauCuaThuTuc(admin, b.procedure_code)
  const tieuDe = `${thuTucLabel(b.procedure_code)} — ${ten || lienHe}`
  let hs = null
  for (let lan = 0; lan < 5 && !hs; lan++) {
    const code = await maMoi(admin)
    const { data, error } = await admin.from('legal_cases').insert({
      code, procedure_code: b.procedure_code, entity_type: b.entity_type, entity_id: ent.id, title: tieuDe,
      contact_name: lienHe || null, contact_phone: sdt, contact_email: String(b.contact_email || '').trim() || null,
      source: nguon, stage: 1, assigned_to: phuTrach, received_by: caller.staffId, received_at: ngayNhan,
      due_at: hanTuMau(ngayNhan, mau.sla_days), note: String(b.note || '').trim() || null, created_by: caller.staffId,
    }).select('id, code').single()
    if (!error) hs = data
    else if (error.code !== '23505') return loi(500, error.message)   // 23505 = trùng mã (2 người tạo cùng lúc) → thử mã kế
  }
  if (!hs) return loi(500, 'Không sinh được mã hồ sơ, thử lại')

  await taoViecTuMau(admin, hs.id, mau.items)
  await ghiNhatKy(admin, hs.id, 'create', null, 1, caller.staffId, `Tạo hồ sơ ${hs.code}`)

  // Phí ban đầu + lịch thu mẫu (tuỳ chọn) — chỉ người thấy tiền
  if (q.tien && Array.isArray(b.phi) && b.phi.length) {
    const phi = b.phi.filter(f => ['dich_vu', 'thu_ho'].includes(f.kind) && String(f.name || '').trim())
      .map((f, i) => ({ case_id: hs.id, kind: f.kind, name: String(f.name).trim(), amount: Math.max(0, Math.round(Number(f.amount) || 0)), sort: i }))
    if (phi.length) await admin.from('legal_case_fees').insert(phi)
    if (b.lich_mau_id) {
      const { data: lm } = await admin.from('legal_payment_plans').select('items').eq('id', b.lich_mau_id).maybeSingle()
      const dv = phi.filter(f => f.kind === 'dich_vu').reduce((a, f) => a + f.amount, 0)
      const th = phi.filter(f => f.kind === 'thu_ho').reduce((a, f) => a + f.amount, 0)
      const dots = apLichMau(lm?.items || [], dv, th).map(d => ({ ...d, case_id: hs.id }))
      if (dots.length) await admin.from('legal_case_installments').insert(dots)
    }
  }
  return Response.json({ ok: true, id: hs.id, code: hs.code })
}
