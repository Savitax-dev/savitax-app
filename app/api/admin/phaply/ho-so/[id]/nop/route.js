// Phân hệ Pháp lý — GĐ 4: trình ký (từng tờ đã ký), nộp & theo dõi (mỗi lần nộp một dòng), kết quả GCN (mã số DN → pháp nhân),
// danh sách tệp scan đã tải lên Drive. sql/58. Xem: ai xem được hồ sơ; sửa: suaDuoc.
//   PATCH { action }: ky { dot, ma, da_ky } · nop_luu { id?, fields } · nop_xoa { id } · gcn { ma_so, ngay_cap, noi_cap }
// Lưu / xoá lần nộp thì TỰ đặt trạng thái chờ của hồ sơ theo lần nộp mới nhất (choTheoNop): chờ kết quả → Chờ Sở / Chờ Thuế,
// yêu cầu bổ sung → Cần bổ sung, đạt → bỏ chờ. Ghi nhật ký như khi nhân viên tự đổi.
import { requirePhapLy, xemDuoc, suaDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { mauCuaBo } from '@/lib/phaply/word/danhMuc'
import { choTheoNop, lanKeTiep, maSoHopLe, CO_QUAN, KET_QUA, coQuanLabel, ketQuaLabel } from '@/lib/phaply/nop'
import { goiYCoQuan } from '@/lib/phaply/phapNhanMayChu'
import { coDrive } from '@/lib/phaply/drive'
import { choLabel } from '@/lib/phaply/hoSo'

async function moHoSo(auth, id) {
  const { data: hs } = await auth.admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  return hs && !hs.is_deleted && xemDuoc(auth, hs) ? hs : null
}

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin } = auth
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  const [ky, nop, tep, ent, nv] = await Promise.all([
    admin.from('legal_case_signing').select('*').eq('case_id', id),
    admin.from('legal_case_submissions').select('*').eq('case_id', id).order('ngay_nop').order('created_at').order('id'),
    admin.from('legal_case_files').select('*').eq('case_id', id).order('created_at', { ascending: false }).order('id'),
    hs.entity_id ? admin.from('legal_entities').select('tax_code, ngay_cap_gcn, noi_cap_gcn, phong_dkkd, tru_so_ma_tinh').eq('id', hs.entity_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('staff').select('id, full_name'),
  ])
  if (nop.error) return loi(500, nop.error.message)
  const ten = new Map((nv.data || []).map(s => [s.id, s.full_name]))
  const goiY = ent.data ? await goiYCoQuan(admin, ent.data.tru_so_ma_tinh, null) : {}
  return Response.json({
    ky: (ky.data || []).map(k => ({ ...k, ten_nguoi: ten.get(k.signed_by) || '' })),
    nop: (nop.data || []).map(s => ({ ...s, ten_nguoi: ten.get(s.created_by) || '' })),
    tep: (tep.data || []).map(f => ({ ...f, ten_nguoi: ten.get(f.uploaded_by) || '' })),
    gcn: { ma_so: ent.data?.tax_code || '', ngay_cap: ent.data?.ngay_cap_gcn || '', noi_cap: ent.data?.noi_cap_gcn || '', goi_y_noi_cap: ent.data?.phong_dkkd || goiY.phong_dkkd || '' },
    drive: coDrive(hs.procedure_code), sua_duoc: suaDuoc(auth, hs), loai_hinh: hs.entity_type,
  })
}

const ngay = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null)
const chu = v => (v == null ? null : String(v).trim() || null)

export async function PATCH(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, caller } = auth
  const { id } = await params
  const hs = await moHoSo(auth, id)
  if (!hs) return loi(404, 'Không tìm thấy hồ sơ')
  if (!suaDuoc(auth, hs)) return loi(403, 'Không có quyền sửa hồ sơ này')
  const b = await request.json().catch(() => ({}))
  const ghi = note => ghiNhatKy(admin, id, 'edit', null, null, caller.staffId, note)

  // đặt trạng thái chờ theo lần nộp mới nhất
  const dongBoCho = async () => {
    const { data: ds } = await admin.from('legal_case_submissions').select('co_quan, ngay_nop, ket_qua, created_at').eq('case_id', id)
    const moi = choTheoNop(ds || [])
    if (moi === undefined || moi === (hs.wait_state || null)) return
    await admin.from('legal_cases').update({ wait_state: moi, updated_at: new Date().toISOString() }).eq('id', id)
    await ghiNhatKy(admin, id, 'wait', hs.wait_state, moi, caller.staffId, 'Tự đặt theo kết quả nộp hồ sơ')
  }

  try {
    if (b.action === 'ky') {
      if (!['so', 'thue'].includes(b.dot) || !mauCuaBo(b.dot, hs.entity_type).some(m => m.ma === b.ma)) return loi(400, 'Tờ hồ sơ không thuộc bộ của hồ sơ này')
      if (b.da_ky) {
        const { error } = await admin.from('legal_case_signing').upsert({ case_id: id, dot: b.dot, ma: b.ma, signed_at: new Date().toISOString(), signed_by: caller.staffId })
        if (error) throw new Error(error.message)
      } else await admin.from('legal_case_signing').delete().eq('case_id', id).eq('dot', b.dot).eq('ma', b.ma)
      await ghi(`${b.da_ky ? 'Đã ký' : 'Bỏ dấu đã ký'}: ${mauCuaBo(b.dot, hs.entity_type).find(m => m.ma === b.ma).ten}`)
      return Response.json({ ok: true })
    }

    if (b.action === 'nop_luu') {
      const f = b.fields || {}
      const row = {
        co_quan: CO_QUAN.some(c => c.k === f.co_quan) ? f.co_quan : 'so', ngay_nop: ngay(f.ngay_nop),
        hinh_thuc: f.hinh_thuc === 'giay' ? 'giay' : 'online', ma_bien_nhan: chu(f.ma_bien_nhan), ngay_hen_tra: ngay(f.ngay_hen_tra),
        ket_qua: KET_QUA.some(k => k.k === f.ket_qua) ? f.ket_qua : 'cho', ngay_ket_qua: ngay(f.ngay_ket_qua),
        noi_dung_bo_sung: chu(f.noi_dung_bo_sung), han_bo_sung: ngay(f.han_bo_sung), ghi_chu: chu(f.ghi_chu), updated_at: new Date().toISOString(),
      }
      if (!row.ngay_nop) return loi(400, 'Nhập ngày nộp')
      if (row.ket_qua === 'bo_sung' && !row.noi_dung_bo_sung) return loi(400, 'Ghi nội dung cơ quan yêu cầu sửa đổi, bổ sung')
      if (b.id) {
        const { error } = await admin.from('legal_case_submissions').update(row).eq('id', b.id).eq('case_id', id)
        if (error) throw new Error(error.message)
      } else {
        const { data: ds } = await admin.from('legal_case_submissions').select('co_quan, lan').eq('case_id', id)
        const { error } = await admin.from('legal_case_submissions').insert({ ...row, case_id: id, lan: lanKeTiep(ds, row.co_quan), created_by: caller.staffId })
        if (error) throw new Error(error.message)
      }
      await ghi(`${b.id ? 'Sửa' : 'Ghi'} lần nộp ${coQuanLabel(row.co_quan)} ${row.ngay_nop}: ${ketQuaLabel(row.ket_qua)}${row.ma_bien_nhan ? ' · mã ' + row.ma_bien_nhan : ''}`)
      await dongBoCho()
      return Response.json({ ok: true })
    }

    if (b.action === 'nop_xoa') {
      const { data: s } = await admin.from('legal_case_submissions').select('co_quan, ngay_nop').eq('id', b.id).eq('case_id', id).maybeSingle()
      if (!s) return loi(404, 'Không thấy lần nộp')
      await admin.from('legal_case_submissions').delete().eq('id', b.id)
      await ghi(`Xoá lần nộp ${coQuanLabel(s.co_quan)} ${s.ngay_nop}`)
      await dongBoCho()
      return Response.json({ ok: true })
    }

    if (b.action === 'gcn') {
      if (!hs.entity_id) return loi(400, 'Hồ sơ chưa có pháp nhân')
      const maSo = String(b.ma_so || '').replace(/\s/g, '')
      if (maSo && !maSoHopLe(maSo)) return loi(400, 'Mã số doanh nghiệp phải 10 chữ số (chi nhánh: 10 số-3 số)')
      const ngayCap = chu(b.ngay_cap)
      if (ngayCap && !/^\d{2}\/\d{2}\/\d{4}$/.test(ngayCap)) return loi(400, 'Ngày cấp dạng dd/mm/yyyy')
      const { error } = await admin.from('legal_entities').update({ tax_code: maSo || null, ngay_cap_gcn: ngayCap, noi_cap_gcn: chu(b.noi_cap), updated_at: new Date().toISOString() }).eq('id', hs.entity_id)
      if (error) throw new Error(error.message)
      await ghi(`Kết quả GCN ĐKDN: mã số ${maSo || '(trống)'}${ngayCap ? ', cấp ' + ngayCap : ''}`)
      return Response.json({ ok: true, cho: choLabel(hs.wait_state) })
    }
    return loi(400, 'Thao tác không hợp lệ')
  } catch (e) { return loi(500, e.message) }
}
