// Phân hệ Pháp lý — một hồ sơ: xem đầy đủ (GET) và mọi thao tác trên hồ sơ (PATCH theo action).
import { requirePhapLy, xemDuoc, suaDuoc, anTien, loi } from '@/lib/phaply/quyen'
import { docHoSoDayDu, ghiNhatKy, nhanVienPhapLy, tenNhanVien, COT_HO_SO, mauCuaThuTuc, hanTuMau } from '@/lib/phaply/hoSoMayChu'
import { BUOC_DONG, CHO, LOAI_HINH, NGUON, THU_TUC, choLabel } from '@/lib/phaply/hoSo'
import { docDieuKienDong } from '@/lib/phaply/banGiaoMayChu'
import { thieuDieuKien } from '@/lib/phaply/banGiao'
import { kiemTamNgung, locNoiDung, trangThaiTamNgung } from '@/lib/phaply/nhom'
import { homNayVN, thuTucLabel } from '@/lib/phaply/hoSo'

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { id } = await params
  const d = await docHoSoDayDu(auth.admin, id).catch(e => ({ loi: e.message }))
  if (d?.loi) return loi(500, d.loi)
  if (!d || !xemDuoc(auth, d.ho_so)) return loi(404, 'Không tìm thấy hồ sơ (hoặc không thuộc phạm vi của bạn)')
  const nv = await tenNhanVien(auth.admin)
  const ten = sid => nv.get(sid)?.full_name || ''
  const kq = {
    ...d,
    ho_so: { ...d.ho_so, ten_phu_trach: ten(d.ho_so.assigned_to), ten_nguoi_nhan: ten(d.ho_so.received_by), ten_nguoi_dong: ten(d.ho_so.closed_by) },
    viec: d.viec.map(v => ({ ...v, ten_nguoi_xong: ten(v.done_by) })),
    ghi_chu: d.ghi_chu.map(g => ({ ...g, ten_nguoi: ten(g.created_by) })),
    nhat_ky: d.nhat_ky.map(l => ({ ...l, ten_nguoi: ten(l.created_by) })),
    payments: d.payments.map(p => ({ ...p, ten_phu_trach: ten(p.staff_id), ten_nguoi_ghi: ten(p.created_by), ten_nguoi_xoa: ten(p.deleted_by) })),
    nhan_vien: await nhanVienPhapLy(auth.admin),
    ...(await lichSuCongTy(auth, d.ho_so)),
    sua_duoc: suaDuoc(auth, d.ho_so), q: auth.q, toi: auth.caller.staffId,
  }
  return Response.json(anTien(auth, kq))
}

// PATCH { action, ... }:
//   sua   { fields: {title, contact_*, source, note, received_at, ten_phap_nhan, mst, entity_type, procedure_code} }
//   buoc  { stage, note? }        cho { wait_state|null }       giao { assigned_to|null } (trưởng phòng)
//   dong  { note? }  (đủ tiền, hoặc close_phaply_case + lý do)   mo_lai { note } (close_phaply_case)
//   nhan  {} — nhân viên tự nhận hồ sơ chưa ai phụ trách          xoa { note } (close_phaply_case, xoá mềm)
export async function PATCH(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, q, caller } = auth
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const { data: hs } = await admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (!hs || !xemDuoc(auth, hs)) return loi(404, 'Không tìm thấy hồ sơ')
  const capNhat = async (doi) => {
    const { error } = await admin.from('legal_cases').update({ ...doi, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
  }
  const ghi = (kind, tu, toi, note) => ghiNhatKy(admin, id, kind, tu, toi, caller.staffId, note || null)
  const ok = () => Response.json({ ok: true })

  try {
    if (b.action === 'nhan') {
      if (hs.assigned_to) return loi(409, 'Hồ sơ đã có người phụ trách')
      if (!q.sua) return loi(403, 'Không có quyền nhận hồ sơ')
      await capNhat({ assigned_to: caller.staffId })
      await ghi('assign', null, caller.staffId, 'Tự nhận hồ sơ'); return ok()
    }
    if (b.action === 'giao') {
      if (!q.ca_phong) return loi(403, 'Chỉ trưởng phòng giao / chuyển hồ sơ')
      const moi = b.assigned_to || null
      if (moi === hs.assigned_to) return ok()
      await capNhat({ assigned_to: moi })
      await ghi('assign', hs.assigned_to, moi, b.note); return ok()
    }
    if (b.action === 'mo_lai') {
      if (!q.dong) return loi(403, 'Không có quyền mở lại hồ sơ')
      if (hs.stage < BUOC_DONG) return loi(409, 'Hồ sơ chưa đóng')
      if (!String(b.note || '').trim()) return loi(400, 'Ghi lý do mở lại')
      const ve = Number(b.stage) >= 1 && Number(b.stage) < BUOC_DONG ? Number(b.stage) : 9
      await capNhat({ stage: ve, closed_at: null, closed_by: null })
      await ghi('reopen', BUOC_DONG, ve, b.note); return ok()
    }
    if (b.action === 'xoa') {
      if (!q.dong) return loi(403, 'Không có quyền xoá hồ sơ')
      if (!String(b.note || '').trim()) return loi(400, 'Ghi lý do xoá')
      await capNhat({ is_deleted: true, close_note: b.note })
      await ghi('edit', null, 'xoa', b.note); return ok()
    }

    if (!suaDuoc(auth, hs)) return loi(403, 'Bạn chỉ sửa được hồ sơ mình phụ trách')

    // Nhắc khách sắp hết hạn tạm ngừng — làm được cả khi hồ sơ tạm ngừng đã đóng (thời hạn vẫn đang chạy)
    if (b.action === 'nhac_khach') {
      if (hs.procedure_code !== 'tam_ngung') return loi(400, 'Chỉ hồ sơ tạm ngừng mới theo dõi nhắc khách')
      const note = String(b.note || '').trim()
      await capNhat({ nhac_khach_luc: new Date().toISOString(), nhac_khach_boi: caller.staffId, nhac_khach_ghi_chu: note || null })
      await ghi('edit', null, null, 'Đã nhắc khách sắp hết hạn tạm ngừng' + (note ? ': ' + note : '')); return ok()
    }
    if (hs.stage >= BUOC_DONG && b.action !== 'cho') return loi(409, 'Hồ sơ đã đóng — trưởng phòng mở lại trước khi sửa')

    // Thời hạn tạm ngừng (tối đa 1 năm mỗi lần) / ngày hoạt động lại
    if (b.action === 'tam_ngung') {
      if (hs.procedure_code === 'tam_ngung') {
        const l = kiemTamNgung(b.tu, b.den)
        if (l) return loi(400, l)
        await capNhat({ tam_ngung_tu: b.tu, tam_ngung_den: b.den })
        await ghi('edit', null, null, `Thời hạn tạm ngừng ${b.tu} → ${b.den}`); return ok()
      }
      if (hs.procedure_code === 'hoat_dong_lai') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(b.hoat_dong_lai_tu || '')) return loi(400, 'Nhập ngày hoạt động trở lại')
        await capNhat({ hoat_dong_lai_tu: b.hoat_dong_lai_tu })
        await ghi('edit', null, null, `Ngày hoạt động trở lại ${b.hoat_dong_lai_tu}`); return ok()
      }
      return loi(400, 'Thủ tục này không có thời hạn tạm ngừng')
    }
    // Nội dung thay đổi (hồ sơ Thay đổi đăng ký)
    if (b.action === 'noi_dung') {
      const ds = locNoiDung(b.ds)
      await capNhat({ noi_dung_thay_doi: ds })
      await ghi('edit', null, null, 'Nội dung thay đổi: ' + (ds.join(', ') || '(trống)')); return ok()
    }

    if (b.action === 'sua') {
      const f = b.fields || {}, doi = {}, doiPn = {}
      for (const k of ['title', 'contact_name', 'contact_phone', 'contact_email', 'note'])
        if (f[k] !== undefined) doi[k] = String(f[k] ?? '').trim() || null
      if (doi.title === null) delete doi.title
      if (f.source !== undefined && NGUON.some(n => n.k === f.source)) doi.source = f.source
      if (f.procedure_code !== undefined && THU_TUC.some(t => t.k === f.procedure_code)) doi.procedure_code = f.procedure_code
      if (f.entity_type !== undefined && LOAI_HINH.some(t => t.k === f.entity_type)) { doi.entity_type = f.entity_type; doiPn.entity_type = f.entity_type }
      if (f.received_at !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(f.received_at)) {
        doi.received_at = f.received_at
        const mau = await mauCuaThuTuc(admin, doi.procedure_code || hs.procedure_code)
        doi.due_at = hanTuMau(f.received_at, mau.sla_days)            // đổi ngày nhận thì tính lại hạn
      }
      if (f.due_at !== undefined && q.ca_phong) doi.due_at = /^\d{4}-\d{2}-\d{2}$/.test(f.due_at || '') ? f.due_at : null
      if (f.ten_phap_nhan !== undefined) doiPn.name = String(f.ten_phap_nhan || '').trim().toLocaleUpperCase('vi-VN')
      if (f.mst !== undefined) doiPn.tax_code = String(f.mst || '').trim() || null
      if (Object.keys(doi).length) await capNhat(doi)
      if (Object.keys(doiPn).length && hs.entity_id) await admin.from('legal_entities').update(doiPn).eq('id', hs.entity_id)
      await ghi('edit', null, null, 'Sửa thông tin: ' + [...Object.keys(doi), ...Object.keys(doiPn)].join(', ')); return ok()
    }

    if (b.action === 'cho') {
      const w = b.wait_state || null
      if (w && !CHO.some(c => c.k === w)) return loi(400, 'Trạng thái chờ không hợp lệ')
      if (w === hs.wait_state) return ok()
      await capNhat({ wait_state: w })
      await ghi('wait', choLabel(hs.wait_state) || 'Không chờ', choLabel(w) || 'Không chờ', b.note); return ok()
    }

    if (b.action === 'buoc' || b.action === 'dong') {
      const toi = b.action === 'dong' ? BUOC_DONG : Number(b.stage)
      if (!(toi >= 1 && toi <= BUOC_DONG)) return loi(400, 'Bước không hợp lệ')
      if (toi === hs.stage) return ok()
      const doi = { stage: toi }
      if (toi === BUOC_DONG) {
        // Đóng: đủ điều kiện (thu đủ · có kết quả · đã bàn giao · có scan BBBG — lib/phaply/banGiao.js), hoặc người có
        // close_phaply_case đóng khi còn thiếu, BẮT BUỘC lý do
        const thieu = thieuDieuKien(await docDieuKienDong(admin, hs))
        if (thieu.length) {
          if (!q.dong) return loi(409, 'Chưa đủ điều kiện đóng: ' + thieu.map(t => t.muc).join('; ') + ' — trưởng phòng mới đóng được khi còn thiếu')
          if (!String(b.note || '').trim()) return loi(400, 'Còn thiếu điều kiện đóng: ghi lý do')
        }
        Object.assign(doi, { closed_at: new Date().toISOString(), closed_by: caller.staffId, close_note: String(b.note || '').trim() || null, wait_state: null })
      }
      await capNhat(doi)
      await ghi(toi === BUOC_DONG ? 'close' : 'stage', hs.stage, toi, b.note)
      return ok()
    }
    return loi(400, 'Thao tác không hợp lệ')
  } catch (e) {
    return loi(500, e.message)
  }
}

// Lịch sử pháp lý của CÙNG công ty (dùng chung pháp nhân — anh yêu cầu 17/11/2026 "lấy thông tin qua lại") + trạng thái tạm ngừng
async function lichSuCongTy(auth, hs) {
  const { admin } = auth
  const ra = { lich_su: [], tam_ngung: null }
  if (hs.entity_id) {
    const { data } = await admin.from('legal_cases').select('id, code, procedure_code, stage, received_at, closed_at, assigned_to, case_goc_id, tam_ngung_tu, tam_ngung_den, is_deleted')
      .eq('entity_id', hs.entity_id).eq('is_deleted', false).neq('id', hs.id).order('received_at', { ascending: false }).order('id')
    // chỉ liệt kê hồ sơ người xem được — hồ sơ ngoài phạm vi hiện mã + thủ tục, không mở được
    ra.lich_su = (data || []).map(c => ({ id: c.id, ma: c.code, thu_tuc: thuTucLabel(c.procedure_code), procedure_code: c.procedure_code, buoc: c.stage,
      nhan: c.received_at, dong: c.closed_at, xem_duoc: xemDuoc(auth, c), la_tiep_theo: c.case_goc_id === hs.id, la_goc: c.id === hs.case_goc_id,
      tam_ngung_tu: c.tam_ngung_tu, tam_ngung_den: c.tam_ngung_den }))
  }
  if (hs.procedure_code === 'tam_ngung' && hs.tam_ngung_tu && hs.tam_ngung_den)
    ra.tam_ngung = trangThaiTamNgung({ tu: hs.tam_ngung_tu, den: hs.tam_ngung_den, daCoTiepTheo: ra.lich_su.some(c => c.la_tiep_theo) }, homNayVN())
  return ra
}
