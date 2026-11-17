// Phân hệ Pháp lý — danh sách hồ sơ (lọc phạm vi ở máy chủ) + tạo hồ sơ mới.
// Mỗi NHÓM thủ tục một trang (lib/phaply/nhom.js — anh yêu cầu 17/11/2026): GET ?nhom=thanh_lap|thay_doi|tam_ngung|giai_the|khac.
// Tạm ngừng: trả thêm `theo_doi_tam_ngung` — mọi lần tạm ngừng (CẢ hồ sơ đã đóng) còn cần theo dõi, kèm trạng thái sắp hết hạn để nhắc khách.
import { requirePhapLy, locPhamVi, docHet, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, docTienNhieuHoSo, ghiNhatKy, maMoi, mauCuaThuTuc, taoViecTuMau, hanTuMau, nhanVienPhapLy, tenNhanVien } from '@/lib/phaply/hoSoMayChu'
import { THU_TUC, LOAI_HINH, NGUON, homNayVN, treHan, thuTucLabel, BUOC_DONG } from '@/lib/phaply/hoSo'
import { tongHopHoSo, apLichMau } from '@/lib/phaply/tien'
import { NHOM, nhomCuaThuTuc, locNoiDung, kiemTamNgung, trangThaiTamNgung, canNhac } from '@/lib/phaply/nhom'

// Lần tạm ngừng cần theo dõi (cả hồ sơ đã đóng): chưa có hồ sơ tiếp theo, hoặc vừa kết thúc trong 60 ngày
async function docTheoDoiTamNgung(admin, auth, homNay, tenNv) {
  const ds = await docHet((a, b) => locPhamVi(admin.from('legal_cases')
    .select('id, code, title, entity_id, assigned_to, stage, tam_ngung_tu, tam_ngung_den, nhac_khach_luc, nhac_khach_ghi_chu, contact_name, contact_phone')
    .eq('is_deleted', false).eq('procedure_code', 'tam_ngung').not('tam_ngung_den', 'is', null), auth).order('id').range(a, b))
  if (!ds.length) return []
  const { data: tiep } = await admin.from('legal_cases').select('id, code, procedure_code, case_goc_id').eq('is_deleted', false).in('case_goc_id', ds.map(c => c.id))
  const tiepTheo = new Map((tiep || []).map(t => [t.case_goc_id, t]))
  const { data: ents } = await admin.from('legal_entities').select('id, name, tax_code').in('id', [...new Set(ds.map(c => c.entity_id).filter(Boolean))])
  const ent = new Map((ents || []).map(e => [e.id, e]))
  return ds.map(c => {
    const t = tiepTheo.get(c.id)
    const tt = trangThaiTamNgung({ tu: c.tam_ngung_tu, den: c.tam_ngung_den, daCoTiepTheo: !!t }, homNay)
    return { ...c, ...tt, ten_phap_nhan: ent.get(c.entity_id)?.name || c.title, mst: ent.get(c.entity_id)?.tax_code || '',
      ten_phu_trach: tenNv.get(c.assigned_to)?.full_name || '', tiep_theo: t ? { id: t.id, ma: t.code, thu_tuc: thuTucLabel(t.procedure_code) } : null }
  }).filter(c => c.muc !== 'da_xu_ly' || c.con_ngay >= -60)
    .sort((a, b) => (canNhac(b.muc) - canNhac(a.muc)) || String(a.tam_ngung_den).localeCompare(String(b.tam_ngung_den)))
}

// GET ?dong=1 (gồm hồ sơ đã đóng) &nhom= → { ho_so: [...], the: {...}, theo_doi_tam_ngung?, nhan_vien, q, toi }
export async function GET(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, q } = auth
  const sp = new URL(request.url).searchParams
  const coDong = sp.get('dong') === '1'
  const nhom = NHOM[sp.get('nhom')] ? sp.get('nhom') : null

  let rows
  try {
    rows = await docHet((a, b) => {
      let x = admin.from('legal_cases').select(COT_HO_SO).eq('is_deleted', false)
      if (!coDong) x = x.lt('stage', BUOC_DONG)
      if (nhom) x = x.in('procedure_code', NHOM[nhom].thuTuc)
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
  const theoDoi = await docTheoDoiTamNgung(admin, auth, homNay, nv).catch(() => [])
  const dang = ds.filter(r => r.stage < BUOC_DONG)
  const the = {
    dang_lam: dang.length,
    cho_khach: dang.filter(r => r.wait_state === 'khach').length,
    cho_co_quan: dang.filter(r => r.wait_state === 'so' || r.wait_state === 'thue').length,
    bo_sung: dang.filter(r => r.wait_state === 'bo_sung').length,
    tre_han: dang.filter(r => r.tre_han).length,
    chua_giao: dang.filter(r => !r.assigned_to).length,
    // tạm ngừng sắp hết / quá hạn cần nhắc khách — hiện ở MỌI trang để nhân viên không bỏ sót
    tam_ngung_can_nhac: theoDoi.filter(c => canNhac(c.muc)).length,
    tam_ngung_dang: theoDoi.filter(c => ['dang', 'sap', 'gap'].includes(c.muc)).length,
    ...(q.tien ? { no_den_han: dang.reduce((a, r) => a + (r.no_den_han || 0), 0) } : {}),
  }
  return Response.json({ ho_so: ds, the, nhom, theo_doi_tam_ngung: nhom === 'tam_ngung' ? theoDoi : undefined,
    nhan_vien: await nhanVienPhapLy(admin), q, toi: auth.caller.staffId })
}

// POST — tạo hồ sơ. Body: { procedure_code, entity_type, ten_phap_nhan, mst?, contact_name, contact_phone, contact_email?,
//   source, assigned_to?, received_at?, note?, phi?: [{kind, name, amount}], lich_mau_id?,
//   entity_id? (dùng LẠI pháp nhân đã có) | client_id? (tạo pháp nhân từ khách kế toán), case_goc_id? (hồ sơ trước, VD lần tạm ngừng),
//   noi_dung_thay_doi?: [...], tam_ngung_tu?, tam_ngung_den?, hoat_dong_lai_tu? }
export async function POST(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, q, caller } = auth
  if (!q.sua && !q.ca_phong) return loi(403, 'Không có quyền tạo hồ sơ pháp lý')
  const b = await request.json().catch(() => ({}))

  if (!THU_TUC.some(t => t.k === b.procedure_code)) return loi(400, 'Chọn thủ tục')
  const nhom = nhomCuaThuTuc(b.procedure_code)
  const lienHe = String(b.contact_name || '').trim()
  const sdt = String(b.contact_phone || '').replace(/[^\d+]/g, '')
  if (!sdt) return loi(400, 'Nhập số điện thoại liên hệ')
  const nguon = NGUON.some(n => n.k === b.source) ? b.source : 'moi'

  // Thông tin riêng theo nhóm — kiểm TRƯỚC khi tạo pháp nhân (lỗi nhập không để lại pháp nhân rác)
  const rieng = {}
  if (nhom === 'thay_doi') rieng.noi_dung_thay_doi = locNoiDung(b.noi_dung_thay_doi)
  if (b.procedure_code === 'tam_ngung' && (b.tam_ngung_tu || b.tam_ngung_den)) {
    const l = kiemTamNgung(b.tam_ngung_tu, b.tam_ngung_den)
    if (l) return loi(400, l)
    Object.assign(rieng, { tam_ngung_tu: b.tam_ngung_tu, tam_ngung_den: b.tam_ngung_den })
  }
  if (b.procedure_code === 'hoat_dong_lai' && /^\d{4}-\d{2}-\d{2}$/.test(b.hoat_dong_lai_tu || '')) rieng.hoat_dong_lai_tu = b.hoat_dong_lai_tu

  // Pháp nhân: dùng lại (entity_id, phải nằm trong phạm vi) · tạo từ khách kế toán (client_id) · tạo mới
  let ent = null
  if (b.entity_id) {
    const { data: e } = await admin.from('legal_entities').select('id, name, entity_type').eq('id', b.entity_id).maybeSingle()
    if (!e) return loi(404, 'Không tìm thấy công ty đã chọn')
    const { data: coHs } = await locPhamVi(admin.from('legal_cases').select('id').eq('entity_id', e.id).eq('is_deleted', false), auth).limit(1)
    if (!coHs?.length) return loi(403, 'Công ty này không thuộc hồ sơ bạn phụ trách')
    ent = e
  } else if (b.client_id) {
    if (!LOAI_HINH.some(t => t.k === b.entity_type)) return loi(400, 'Chọn loại hình')
    const { data: c } = await admin.from('clients').select('id, name, tax_code, address').eq('id', b.client_id).maybeSingle()
    if (!c) return loi(404, 'Không tìm thấy khách kế toán đã chọn')
    const { data, error } = await admin.from('legal_entities').insert({ entity_type: b.entity_type, name: String(c.name || '').toLocaleUpperCase('vi-VN'),
      tax_code: c.tax_code || null, address: c.address || null, linked_client_id: c.id, created_by: caller.staffId }).select('id, name, entity_type').single()
    if (error) return loi(500, error.message)
    ent = data
  } else {
    if (!LOAI_HINH.some(t => t.k === b.entity_type)) return loi(400, 'Chọn loại hình')
    const ten = String(b.ten_phap_nhan || '').trim().toLocaleUpperCase('vi-VN')
    if (NHOM[nhom].coSan && !ten) return loi(400, 'Chọn công ty đã có, hoặc nhập tên công ty')
    if (!ten && !lienHe) return loi(400, 'Nhập tên doanh nghiệp (dự kiến) hoặc người liên hệ')
    const { data, error } = await admin.from('legal_entities').insert({
      entity_type: b.entity_type, name: ten, tax_code: String(b.mst || '').trim() || null, created_by: caller.staffId,
    }).select('id, name, entity_type').single()
    if (error) return loi(500, error.message)
    ent = data
  }
  if (b.case_goc_id) {
    const { data: goc } = await locPhamVi(admin.from('legal_cases').select('id, entity_id').eq('id', b.case_goc_id), auth).maybeSingle()
    if (!goc || goc.entity_id !== ent.id) return loi(400, 'Hồ sơ gốc không cùng công ty')
    rieng.case_goc_id = goc.id
  }

  // Người phụ trách: trưởng phòng giao được cho người khác; nhân viên tạo là tự nhận
  let phuTrach = caller.staffId
  if (b.assigned_to !== undefined && q.ca_phong) phuTrach = b.assigned_to || null
  const ngayNhan = /^\d{4}-\d{2}-\d{2}$/.test(b.received_at || '') ? b.received_at : homNayVN()

  const mau = await mauCuaThuTuc(admin, b.procedure_code)
  const tieuDe = `${thuTucLabel(b.procedure_code)} — ${ent.name || lienHe}`
  let hs = null
  for (let lan = 0; lan < 5 && !hs; lan++) {
    const code = await maMoi(admin)
    const { data, error } = await admin.from('legal_cases').insert({
      code, procedure_code: b.procedure_code, entity_type: ent.entity_type, entity_id: ent.id, title: tieuDe,
      contact_name: lienHe || null, contact_phone: sdt, contact_email: String(b.contact_email || '').trim() || null,
      source: nguon, stage: 1, assigned_to: phuTrach, received_by: caller.staffId, received_at: ngayNhan,
      due_at: hanTuMau(ngayNhan, mau.sla_days), note: String(b.note || '').trim() || null, created_by: caller.staffId, ...rieng,
    }).select('id, code').single()
    if (!error) hs = data
    else if (error.code !== '23505') return loi(500, error.message)   // 23505 = trùng mã (2 người tạo cùng lúc) → thử mã kế
  }
  if (!hs) return loi(500, 'Không sinh được mã hồ sơ, thử lại')

  await taoViecTuMau(admin, hs.id, mau.items)
  await ghiNhatKy(admin, hs.id, 'create', null, 1, caller.staffId, `Tạo hồ sơ ${hs.code}${b.entity_id ? ' (dùng lại thông tin công ty đã có)' : b.client_id ? ' (từ khách kế toán)' : ''}`)

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
