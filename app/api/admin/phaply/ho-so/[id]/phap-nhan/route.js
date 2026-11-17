// Phân hệ Pháp lý — dữ liệu pháp nhân của một hồ sơ: doanh nghiệp, người + vai trò, ngành nghề, "Còn thiếu gì".
// Ai xem được hồ sơ thì xem được chữ (cần để làm việc); ảnh CCCD gốc mới cần view_phaply_cccd_image. Sửa = suaDuoc.
import { requirePhapLy, xemDuoc, suaDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { docPhapNhan, locCotCty, locCotNguoi, locVaiTro, ghepDiaChi, goiYCoQuan } from '@/lib/phaply/phapNhanMayChu'
import { hoSoDauVao, conThieu } from '@/lib/phaply/phapNhan'
import { coDrive, linkThuMuc } from '@/lib/phaply/drive'
import { coPdf } from '@/lib/phaply/pdf'

async function moHoSo(auth, id) {
  const { data: hs } = await auth.admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  return hs && !hs.is_deleted && xemDuoc(auth, hs) ? hs : null
}

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  try {
    const d = await docPhapNhan(auth.admin, hs)
    const dauVao = hoSoDauVao({ ...d, entity: d.entity || { entity_type: hs.entity_type } })
    return Response.json({
      entity: d.entity, vai_tro: d.vaiTro.map(({ nguoi, ...v }) => ({ ...v, nguoi: anAnh(auth, nguoi) })),
      nganh: d.nganh, uy_quyen: anAnh(auth, d.uyQuyen), goi_y: d.goiY,
      thieu: { so: conThieu(dauVao, { dot: 'so' }), thue: conThieu(dauVao, { dot: 'thue' }) },
      sua_duoc: suaDuoc(auth, hs),
      drive: { co: coDrive(hs.procedure_code), url: linkThuMuc(hs.drive_folder_id), luc: hs.drive_saved_at },
      pdf: coPdf(),
    })
  } catch (e) { return loi(500, e.message) }
}
// Đường dẫn ảnh CCCD chỉ trả cho người có quyền xem ảnh
const anAnh = (auth, p) => (!p || auth.q.cccd ? p : { ...p, cccd_front_path: p.cccd_front_path ? 'an' : null, cccd_back_path: p.cccd_back_path ? 'an' : null })

// PATCH { action, ... }
//   cty      { fields }                         sửa doanh nghiệp (tạo pháp nhân nếu hồ sơ chưa có)
//   nguoi    { nguoi: {id?, ...}, vai_tro: [...] } thêm / sửa một người + đặt lại vai trò của người đó trong doanh nghiệp
//   bo_nguoi { person_id }                      gỡ người khỏi doanh nghiệp (xoá người nếu không còn gắn đâu)
//   nganh    { nganh: [{ma, ten, chi_tiet, chinh}] } thay toàn bộ ngành nghề (thứ tự theo mảng)
export async function PATCH(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  if (!suaDuoc(auth, hs)) return loi(403, 'Không có quyền sửa hồ sơ này')
  const b = await request.json().catch(() => ({}))

  try {
    // pháp nhân của hồ sơ (tạo nếu chưa có)
    let entityId = hs.entity_id
    if (!entityId) {
      const { data, error } = await admin.from('legal_entities').insert({ entity_type: hs.entity_type, name: '', created_by: caller.staffId }).select('id').single()
      if (error) throw new Error(error.message)
      entityId = data.id
      await admin.from('legal_cases').update({ entity_id: entityId }).eq('id', id)
    }

    if (b.action === 'cty') {
      const doi = locCotCty(b.fields)
      if (!Object.keys(doi).length) return loi(400, 'Không có gì để lưu')
      const { data: cu } = await admin.from('legal_entities').select('*').eq('id', entityId).single()
      const moi = { ...cu, ...doi }
      if ('tru_so_ma_xa' in doi || 'tru_so_so_nha' in doi || 'tru_so_tinh' in doi) doi.address = ghepDiaChi(moi)
      const { error } = await admin.from('legal_entities').update({ ...doi, updated_at: new Date().toISOString() }).eq('id', entityId)
      if (error) throw new Error(error.message)
      // tên doanh nghiệp đổi → tiêu đề hồ sơ đi theo khi tiêu đề đang là tên cũ / tên người liên hệ
      if ('name' in doi && doi.name && (!hs.title || hs.title === cu.name || hs.title === hs.contact_name)) {
        await admin.from('legal_cases').update({ title: doi.name, updated_at: new Date().toISOString() }).eq('id', id)
      }
      await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, 'Sửa thông tin doanh nghiệp: ' + Object.keys(doi).filter(k => k !== 'address').join(', '))
      return Response.json({ ok: true, goi_y: await goiYCoQuan(admin, moi.tru_so_ma_tinh, moi.tru_so_ma_xa) })
    }

    if (b.action === 'nguoi') {
      const f = locCotNguoi(b.nguoi)
      // ảnh CCCD vừa tải (route cccd) — chỉ nhận đường dẫn nằm trong thư mục của CHÍNH hồ sơ này; 'an' = người không có quyền xem
      // ảnh gửi lại giá trị che → bỏ qua, giữ ảnh cũ
      for (const k of ['cccd_front_path', 'cccd_back_path']) {
        const v = b.nguoi?.[k]
        if (v === null) f[k] = null
        else if (typeof v === 'string' && v.startsWith(id + '/') && !v.includes('..')) f[k] = v
      }
      if (b.nguoi?.cccd_doc && typeof b.nguoi.cccd_doc === 'object') f.cccd_doc = b.nguoi.cccd_doc
      const vaiTro = (b.vai_tro || []).map(locVaiTro).filter(Boolean)
      if (!vaiTro.length) return loi(400, 'Chọn ít nhất một vai trò cho người này')
      let pid = b.nguoi?.id || null
      if (pid) {
        const { data: gan } = await admin.from('legal_entity_people').select('id').eq('entity_id', entityId).eq('person_id', pid).limit(1)
        if (!gan?.length) return loi(404, 'Người này không thuộc doanh nghiệp của hồ sơ')
        const { error } = await admin.from('legal_people').update({ ...f, updated_at: new Date().toISOString() }).eq('id', pid).is('staff_id', null)
        if (error) throw new Error(error.message)
      } else {
        const { data, error } = await admin.from('legal_people').insert({ ...f, created_by: caller.staffId }).select('id').single()
        if (error) throw new Error(error.message)
        pid = data.id
      }
      // đặt lại vai trò: giữ thứ tự cũ của vai trò đã có, vai trò mới xếp cuối
      const { data: cu } = await admin.from('legal_entity_people').select('vai_tro, thu_tu, person_id').eq('entity_id', entityId)
      const thuTuCu = new Map((cu || []).filter(r => r.person_id === pid).map(r => [r.vai_tro, r.thu_tu]))
      const maxTheoVai = v => Math.max(-1, ...(cu || []).filter(r => r.vai_tro === v).map(r => r.thu_tu))
      await admin.from('legal_entity_people').delete().eq('entity_id', entityId).eq('person_id', pid)
      const { error: e2 } = await admin.from('legal_entity_people').insert(vaiTro.map(v => ({
        ...v, entity_id: entityId, person_id: pid, thu_tu: thuTuCu.has(v.vai_tro) ? thuTuCu.get(v.vai_tro) : maxTheoVai(v.vai_tro) + 1,
      })))
      if (e2) throw new Error(e2.message)
      // chỉ một Chủ tịch HĐTV / HĐQT: người này vừa được chọn thì bỏ dấu của người khác
      for (const v of vaiTro.filter(v => v.chu_tich)) {
        await admin.from('legal_entity_people').update({ chu_tich: false }).eq('entity_id', entityId).eq('vai_tro', v.vai_tro).neq('person_id', pid)
      }
      await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, `${b.nguoi?.id ? 'Sửa' : 'Thêm'} người: ${f.ho_ten || ''} (${vaiTro.map(v => v.vai_tro).join(', ')})`)
      return Response.json({ ok: true, id: pid })
    }

    if (b.action === 'bo_nguoi') {
      const pid = b.person_id
      const { data: p } = await admin.from('legal_people').select('id, ho_ten, staff_id').eq('id', pid).maybeSingle()
      if (!p) return loi(404, 'Không tìm thấy người')
      await admin.from('legal_entity_people').delete().eq('entity_id', entityId).eq('person_id', pid)
      const { count } = await admin.from('legal_entity_people').select('id', { count: 'exact', head: false }).eq('person_id', pid)
      if (!count && !p.staff_id) await admin.from('legal_people').delete().eq('id', pid)
      await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, 'Gỡ người: ' + (p.ho_ten || ''))
      return Response.json({ ok: true })
    }

    if (b.action === 'nganh') {
      const ds = (b.nganh || []).map((n, i) => ({
        entity_id: entityId, ma: String(n.ma || '').trim(), ten: String(n.ten || '').trim(), chi_tiet: String(n.chi_tiet || '').trim() || null,
        chinh: !!n.chinh, thu_tu: i,
      })).filter(n => n.ma && n.ten)
      await admin.from('legal_entity_industries').delete().eq('entity_id', entityId)
      if (ds.length) { const { error } = await admin.from('legal_entity_industries').insert(ds); if (error) throw new Error(error.message) }
      await ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, `Ngành nghề: ${ds.length} ngành`)
      return Response.json({ ok: true })
    }
    return loi(400, 'Thao tác không hợp lệ')
  } catch (e) { return loi(500, e.message) }
}
