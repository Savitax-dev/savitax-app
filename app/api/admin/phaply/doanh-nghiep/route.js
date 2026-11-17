// Phân hệ Pháp lý — tìm công ty ĐÃ CÓ để tạo hồ sơ Thay đổi / Tạm ngừng / Giải thể / Khác (anh yêu cầu 17/11/2026 "lấy thông tin qua lại").
//   GET ?q=  (≥ 2 ký tự: tên hoặc MST) → { phap_ly: [...], ke_toan: [...] }
//   phap_ly = pháp nhân đã có hồ sơ pháp lý (dùng LẠI nguyên doanh nghiệp, người, CCCD, ngành nghề) — chỉ những pháp nhân có hồ sơ
//             trong phạm vi của người hỏi (nhân viên: hồ sơ mình + chưa giao; trưởng phòng: cả phòng).
//   ke_toan = khách kế toán Savitax (bảng clients) chưa có pháp nhân — chỉ trả tên, MST, địa chỉ, người đại diện để tạo pháp nhân mới.
import { requirePhapLy, locPhamVi, loi } from '@/lib/phaply/quyen'
import { thuTucLabel } from '@/lib/phaply/hoSo'

const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const sach = s => String(s || '').replace(/[%,()*]/g, ' ').trim()

export async function GET(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin } = auth
  const q = sach(new URL(request.url).searchParams.get('q'))
  if (q.length < 2) return Response.json({ phap_ly: [], ke_toan: [] })
  const so = q.replace(/\D/g, '')
  try {
    // pháp nhân trong phạm vi: lấy qua hồ sơ người hỏi được xem
    const { data: cases } = await locPhamVi(admin.from('legal_cases').select('id, code, procedure_code, entity_id, stage, received_at, contact_name, contact_phone, contact_email').eq('is_deleted', false), auth)
      .order('received_at', { ascending: false }).order('id').limit(1000)
    const theoEnt = new Map()
    for (const c of cases || []) if (c.entity_id) {
      if (!theoEnt.has(c.entity_id)) theoEnt.set(c.entity_id, [])
      theoEnt.get(c.entity_id).push(c)
    }
    let phapLy = []
    if (theoEnt.size) {
      const { data: ents } = await admin.from('legal_entities').select('id, name, tax_code, entity_type, address, linked_client_id').in('id', [...theoEnt.keys()])
      const k = boDau(q)
      phapLy = (ents || []).filter(e => boDau(e.name).includes(k) || (so.length >= 4 && String(e.tax_code || '').includes(so)))
        .slice(0, 15).map(e => {
          const ds = theoEnt.get(e.id), moi = ds[0]
          return { ...e, lien_he: { ten: moi.contact_name || '', sdt: moi.contact_phone || '', email: moi.contact_email || '' },
            ho_so: ds.slice(0, 5).map(c => ({ id: c.id, ma: c.code, thu_tuc: thuTucLabel(c.procedure_code), buoc: c.stage })) }
        })
    }
    // khách kế toán (tên / MST), bỏ khách đã nối với pháp nhân vừa tìm thấy
    const daNoi = new Set(phapLy.map(e => e.linked_client_id).filter(Boolean))
    let x = admin.from('clients').select('id, name, tax_code, address, representative, client_code').limit(15)
    x = so.length >= 4 ? x.ilike('tax_code', `%${so}%`) : x.ilike('name', `%${q}%`)
    const { data: kh } = await x
    return Response.json({ phap_ly: phapLy, ke_toan: (kh || []).filter(c => !daNoi.has(c.id)) })
  } catch (e) { return loi(500, e.message) }
}
