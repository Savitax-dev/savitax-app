// BẢN DEMO — nạp phân hệ Pháp lý sau mỗi lần làm mới (datLaiDemo). Làm mới truncate MỌI bảng rồi nạp lại quyền từ ảnh chụp
// cấu hình production (lib/demo/cauHinh.js) — production chưa có phân hệ Pháp lý nên ảnh chụp KHÔNG có quyền Pháp lý; bước này
// thêm lại 7 quyền + gán cho 2 vai trò pháp lý (giống sql/56), checklist + lịch thu mặc định, và vài hồ sơ GIẢ để phòng pháp lý thử.
// Chưa chạy sql/56 trên database demo thì bỏ qua (làm mới không được hỏng vì phân hệ phụ).
import { napMauMacDinh } from '../phaply/mauMacDinh.js'
import { hanNoiBo, homNayVN } from '../phaply/hoSo.js'
import { TAI_KHOAN_THEM } from './sinhDuLieu.js'

const QUYEN = [
  ['view_phaply', 'Vào phân hệ Pháp lý (thấy hồ sơ mình phụ trách + hồ sơ chưa ai nhận)'],
  ['manage_phaply', 'Tạo / sửa hồ sơ pháp lý, chuyển bước, ghi thu (hồ sơ mình phụ trách)'],
  ['view_phaply_fee', 'Xem số tiền phí / doanh số hồ sơ pháp lý'],
  ['view_phaply_all_staff', 'Xem cả phòng Pháp lý, giao / chuyển hồ sơ, báo cáo phòng'],
  ['manage_phaply_template', 'Sửa mẫu Pháp lý: checklist, lịch thu mẫu, mẫu giấy tờ, danh mục'],
  ['close_phaply_case', 'Đóng hồ sơ còn nợ / mở lại hồ sơ đã đóng / xoá khoản thu / xoá hồ sơ'],
  ['view_phaply_cccd_image', 'Mở ảnh CCCD gốc của hồ sơ pháp lý'],
]
const GAN = {
  phaply: ['view_phaply', 'manage_phaply', 'view_phaply_fee', 'view_phaply_cccd_image'],
  phaply_leader: QUYEN.map(q => q[0]),
}

export async function napPhapLyDemo(admin, { now = new Date(), log = () => {} } = {}) {
  const { error: chuaCai } = await admin.from('legal_cases').select('id').limit(1)
  if (chuaCai) { log('Pháp lý: bỏ qua (database demo chưa chạy sql/56)'); return }

  const { data: coQuyen } = await admin.from('permissions').select('key').in('key', QUYEN.map(q => q[0]))
  const daCo = new Set((coQuyen || []).map(p => p.key))
  const them = QUYEN.filter(q => !daCo.has(q[0])).map(([key, label]) => ({ key, label, group_name: 'Phòng Pháp lý' }))
  if (them.length) { const { error } = await admin.from('permissions').insert(them); if (error) throw new Error('Pháp lý quyền: ' + error.message) }
  const { data: rp } = await admin.from('role_permissions').select('role_id, permission_key').in('role_id', Object.keys(GAN))
  const coRp = new Set((rp || []).map(r => r.role_id + '|' + r.permission_key))
  const ganMoi = Object.entries(GAN).flatMap(([role_id, ds]) => ds.filter(k => !coRp.has(role_id + '|' + k)).map(permission_key => ({ role_id, permission_key })))
  if (ganMoi.length) { const { error } = await admin.from('role_permissions').insert(ganMoi); if (error) throw new Error('Pháp lý gán quyền: ' + error.message) }

  await napMauMacDinh(admin)

  // Nhân viên Pháp lý có tài khoản đăng nhập (nvphaply@demo.savitax.vn — TAI_KHOAN_THEM): taiKhoanDemo đã tạo tài khoản, ở đây
  // tạo dòng staff cùng id (bộ sinh dữ liệu không có người này để dữ liệu kế toán demo không đổi)
  const { data: phongPl } = await admin.from('rooms').select('id').eq('type', 'phaply').limit(1).maybeSingle()
  const { data: dsTk } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const tk of TAI_KHOAN_THEM.filter(t => t.phong === 'phaply')) {
    const u = dsTk?.users?.find(x => String(x.email).toLowerCase() === tk.email)
    if (!u) continue
    const { data: co } = await admin.from('staff').select('id').eq('id', u.id).maybeSingle()
    if (co) continue
    const { error } = await admin.from('staff').insert({
      id: u.id, room_id: phongPl?.id || null, full_name: tk.ten, email: tk.email, role: tk.role, is_active: true,
      phone: '0900000990', ma_nhan_vien: 'NV-PL2', ngay_vao_lam: homNayVN(now).slice(0, 4) + '-03-01', cham_cong_may: true,
    })
    if (error) throw new Error('Pháp lý nhân viên ' + tk.email + ': ' + error.message)
  }

  const { count } = await admin.from('legal_cases').select('id', { count: 'exact', head: false })
  if (count) { log('Pháp lý: quyền + mẫu (đã có hồ sơ)'); return }
  const { data: nv } = await admin.from('staff').select('id, role').in('role', ['phaply_leader', 'phaply'])
  const tp = nv?.find(s => s.role === 'phaply_leader') || nv?.[0]
  const nvPl = nv?.find(s => s.role === 'phaply')    // hồ sơ An Nhiên giao nhân viên → thử đúng phạm vi nhân viên
  if (!tp) { log('Pháp lý: quyền + mẫu (demo không có nhân viên pháp lý → không tạo hồ sơ mẫu)'); return }
  const hn = homNayVN(now)
  const lui = n => { const t = new Date(hn + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10) }
  const { data: tpl } = await admin.from('legal_task_templates').select('id, procedure_code, sla_days')
  // Dữ liệu GIẢ (tên công ty, người, SĐT bịa)
  const MAU = [
    { ten: 'CÔNG TY TNHH THƯƠNG MẠI HOA SEN XANH', loai: '1tv', tt: 'tlm', lienHe: 'Nguyễn Văn Bình', sdt: '0901000111', nhan: lui(40), buoc: 7, dv: 4_000_000, th: 1_000_000, thu: [[lui(38), 3_000_000, 0], [lui(5), 1_000_000, 1]] },
    { ten: 'CÔNG TY CỔ PHẦN ĐẦU TƯ MINH KHANG', loai: 'cp', tt: 'tlm', lienHe: 'Trần Thị Hạnh', sdt: '0902000222', nhan: lui(12), buoc: 5, cho: 'khach', dv: 6_000_000, th: 1_500_000, thu: [[lui(10), 4_500_000, 0]] },
    { ten: 'CÔNG TY TNHH DỊCH VỤ AN NHIÊN', loai: '2tv', tt: 'thay_doi', lienHe: 'Lê Quốc Huy', sdt: '0903000333', nhan: lui(3), buoc: 2, dv: 2_500_000, th: 300_000, thu: [], giaoNv: true },
    { ten: '', loai: '1tv', tt: 'tlm', lienHe: 'Phạm Thu Trang', sdt: '0904000444', nhan: hn, buoc: 1, dv: 0, th: 0, thu: [], chuaGiao: true },
  ]
  for (const [i, m] of MAU.entries()) {
    const t = tpl.find(x => x.procedure_code === m.tt)
    const { data: ent } = await admin.from('legal_entities').insert({ entity_type: m.loai, name: m.ten }).select('id').single()
    const { data: hs, error } = await admin.from('legal_cases').insert({
      code: `PL-${hn.slice(2, 4)}${hn.slice(5, 7)}-${String(90 + i)}`, procedure_code: m.tt, entity_type: m.loai, entity_id: ent.id,
      title: m.ten || m.lienHe, contact_name: m.lienHe, contact_phone: m.sdt, stage: m.buoc, wait_state: m.cho || null,
      assigned_to: m.chuaGiao ? null : (m.giaoNv && nvPl ? nvPl.id : tp.id), received_by: tp.id, received_at: m.nhan, due_at: hanNoiBo(m.nhan, t?.sla_days || 7), created_by: tp.id,
    }).select('id').single()
    if (error) throw new Error('Pháp lý hồ sơ mẫu: ' + error.message)
    const { data: items } = await admin.from('legal_task_template_items').select('id, stage, title, sort').eq('template_id', t.id).eq('is_active', true)
    await admin.from('legal_case_tasks').insert((items || []).map(it => ({ case_id: hs.id, template_item_id: it.id, stage: it.stage, title: it.title, sort: it.sort,
      done_at: it.stage < m.buoc ? now.toISOString() : null, done_by: it.stage < m.buoc ? tp.id : null })))
    if (m.buoc > 1) await admin.from('legal_case_stage_log').insert({ case_id: hs.id, kind: 'stage', from_value: '1', to_value: String(m.buoc), created_by: tp.id,
      created_at: new Date(Date.parse(m.nhan + 'T03:00:00Z') + 2 * 86400000).toISOString() })
    if (m.dv + m.th) {
      await admin.from('legal_case_fees').insert([{ case_id: hs.id, kind: 'dich_vu', name: 'Phí dịch vụ', amount: m.dv, sort: 0 }, { case_id: hs.id, kind: 'thu_ho', name: 'Lệ phí + khắc dấu', amount: m.th, sort: 1 }])
      const { data: dots } = await admin.from('legal_case_installments').insert([
        { case_id: hs.id, seq: 1, name: 'Đợt 1 — khi nhận hồ sơ', amount_dich_vu: m.dv / 2, amount_thu_ho: m.th, due_stage: 1 },
        { case_id: hs.id, seq: 2, name: 'Đợt 2 — khi có kết quả', amount_dich_vu: m.dv / 2, amount_thu_ho: 0, due_stage: 7 },
      ]).select('id, seq').order('seq')
      for (const [ngay, tien, dotIdx] of m.thu) {
        const dot = dots[dotIdx]
        const th = dot.seq === 1 ? Math.min(tien, m.th) : 0
        await admin.from('legal_case_payments').insert({ case_id: hs.id, installment_id: dot.id, amount_thu_ho: th, amount_dich_vu: tien - th, paid_at: ngay, staff_id: tp.id, method: 'chuyen_khoan', created_by: tp.id })
      }
    }
  }
  log('Pháp lý: quyền + mẫu + ' + MAU.length + ' hồ sơ mẫu')
}
