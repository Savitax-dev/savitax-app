// Thưởng Dịch vụ khác — phần HCNS (anh yêu cầu 03/11/2026, sql/48): nhân viên HCNS khai thưởng theo DỊCH VỤ trong
// hồ sơ Thời điểm (và Vãng lai cũ) của Phòng HCNS. Chỉ dịch vụ đã HOÀN THÀNH **và** đã thu (đủ hoặc một phần) —
// tiền thu chung cho cả hồ sơ chia vào từng dịch vụ như trang công nợ HCNS (lib/hcnsPhanBoThu.js).
// Ai được khai: nhân viên phụ trách hồ sơ (hcns_clients.assigned_to) hoặc người thuộc phòng HCNS; quản trị: mọi hồ sơ.
// Dòng khai lưu luong_dvk_khai.hcns_case_service_id (service_id để trống). Mã chọn ở trình duyệt: 'hcns:<id dịch vụ>'.
// Bản clone không có HCNS (thiếu bảng) → danh sách rỗng, không báo lỗi.
import { allocatePayments } from '../hcnsPhanBoThu.js'

export const TIEN_TO_HCNS = 'hcns:'

// Lật trang có sắp theo id — PostgREST cắt im lặng ở 1000 dòng (AGENTS.md). Lỗi (thiếu bảng / cột) → ném ra.
async function docHet(q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}
const LOAI_HO_SO = ['thoi_diem', 'vang_lai']

// Hàm THUẦN (kiểm bằng scripts/test-luong-dvk-hcns.mjs): ghép dữ liệu đã đọc → danh sách dịch vụ được khai.
export function chonDichVuHcns({ hoSo = [], dichVu = [], thu = [], mau = [], khai = [], laQuanTri = false, staffId = null, laPhongHcns = false }) {
  const hoSoMap = new Map(hoSo.filter(h => LOAI_HO_SO.includes(h.category)).map(h => [h.id, h]))
  const tenMau = new Map(mau.map(t => [t.id, t.name]))
  const daKhai = new Map()
  for (const k of khai) if (k.hcns_case_service_id && k.trang_thai !== 'tra_lai') daKhai.set(k.hcns_case_service_id, (daKhai.get(k.hcns_case_service_id) || 0) + (Number(k.so_tien) || 0))
  const dvTheoHoSo = new Map(), thuTheoHoSo = new Map()
  for (const d of dichVu) if (hoSoMap.has(d.hcns_client_id)) (dvTheoHoSo.get(d.hcns_client_id) || dvTheoHoSo.set(d.hcns_client_id, []).get(d.hcns_client_id)).push(d)
  for (const p of thu) if (hoSoMap.has(p.hcns_client_id)) (thuTheoHoSo.get(p.hcns_client_id) || thuTheoHoSo.set(p.hcns_client_id, []).get(p.hcns_client_id)).push(p)
  const out = []
  for (const [hsId, ds] of dvTheoHoSo) {
    const h = hoSoMap.get(hsId)
    if (!laQuanTri && !laPhongHcns && h.assigned_to !== staffId) continue
    const chia = allocatePayments(ds, thuTheoHoSo.get(hsId) || [])
    for (const d of ds) {
      if (d.status !== 'hoan_thanh') continue
      const a = chia.get(d.id)
      const daThu = (a?.direct || 0) + (a?.shared || 0)
      if (daThu <= 0) continue
      const xong = String(d.completed_at || d.expected_at || d.received_at || '').slice(0, 10)
      out.push({
        id: TIEN_TO_HCNS + d.id, loai: 'hcns', hcns_case_service_id: d.id, client_id: null, khong_vat: false,
        ten: tenMau.get(d.template_id) || 'Dịch vụ HCNS', cty: h.name || '', ma: h.case_code || '',
        ky: xong ? 'xong ' + xong.slice(8, 10) + '/' + xong.slice(5, 7) + '/' + xong.slice(0, 4) : '',
        phaiThu: Number(d.cost) || 0, daThu, daKhai: daKhai.get(d.id) || 0,
      })
    }
  }
  return out.sort((a, b) => a.cty.localeCompare(b.cty, 'vi') || a.ten.localeCompare(b.ten, 'vi'))
}

// Đọc dữ liệu thật rồi gọi chonDichVuHcns. caller: từ requireLogin; quyen.admin: quản trị.
export async function hoSoHcnsChonDuoc(supabase, caller, quyen) {
  let dvXong
  try { dvXong = await docHet(() => supabase.from('hcns_case_services').select('id, hcns_client_id').eq('status', 'hoan_thanh')) }
  catch { return [] }   // bản clone không có HCNS
  if (!dvXong.length) return []
  const hsIds = [...new Set(dvXong.map(d => d.hcns_client_id))]
  const hoSo = [], dichVu = [], thu = []
  const COT_DV = 'id, hcns_client_id, template_id, cost, status, received_at, expected_at, created_at'
  for (let i = 0; i < hsIds.length; i += 200) {
    const lo = hsIds.slice(i, i + 200)
    hoSo.push(...await docHet(() => supabase.from('hcns_clients').select('id, name, case_code, category, assigned_to').in('id', lo)))
    // completed_at có từ sql/18 — thiếu cột thì đọc lại không có nó
    dichVu.push(...await docHet(() => supabase.from('hcns_case_services').select(COT_DV + ', completed_at').in('hcns_client_id', lo))
      .catch(() => docHet(() => supabase.from('hcns_case_services').select(COT_DV).in('hcns_client_id', lo))))
    thu.push(...await docHet(() => supabase.from('hcns_case_payments').select('id, hcns_client_id, case_service_id, amount').in('hcns_client_id', lo)).catch(() => []))
  }
  const [{ data: mau }, khaiRes, { data: phongHcns }] = await Promise.all([
    supabase.from('hcns_service_templates').select('id, name'),
    docHet(() => supabase.from('luong_dvk_khai').select('id, hcns_case_service_id, so_tien, trang_thai').not('hcns_case_service_id', 'is', null)).then(data => ({ data }), e => ({ error: e })),
    supabase.from('rooms').select('id').eq('type', 'hcns'),
  ])
  const phongToi = new Set(caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean))
  return chonDichVuHcns({
    hoSo, dichVu, thu, mau: mau || [], khai: khaiRes.error ? [] : khaiRes.data || [],
    laQuanTri: !!quyen.admin, staffId: caller.staffId, laPhongHcns: (phongHcns || []).some(r => phongToi.has(r.id)),
  })
}
