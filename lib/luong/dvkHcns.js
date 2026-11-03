// Thưởng Dịch vụ khác — phần HCNS (anh yêu cầu 03/11/2026, sql/48): nhân viên HCNS khai thưởng theo DỊCH VỤ trong
// hồ sơ Thời điểm (và Vãng lai cũ) của Phòng HCNS.
// Kỳ lương tháng N lấy TIỀN KHÁCH TRẢ TRONG THÁNG N (theo ngày trả thật hcns_case_payments.paid_at — anh chốt 03/11/2026:
// "thanh toán tháng 10 và các khoản đã thu một phần của tháng 10", khoản trả từ tháng 9 đã chi thưởng tháng 9). KHÔNG cần
// dịch vụ đã hoàn thành. Tiền "thu chung cho cả hồ sơ" chia vào từng dịch vụ như trang công nợ HCNS (lib/hcnsPhanBoThu.js);
// phần của tháng N = chia số thu tới hết tháng N − chia số thu tới hết tháng N−1.
// Ai được khai: nhân viên phụ trách hồ sơ (hcns_clients.assigned_to) hoặc người thuộc phòng HCNS; quản trị: mọi hồ sơ.
// Dòng khai lưu luong_dvk_khai.hcns_case_service_id (service_id để trống). Mã chọn ở trình duyệt: 'hcns:<id dịch vụ>'.
// Bản clone không có HCNS (thiếu bảng) → danh sách rỗng, không báo lỗi.
import { allocatePayments } from '../hcnsPhanBoThu.js'

export const TIEN_TO_HCNS = 'hcns:'
const LOAI_HO_SO = ['thoi_diem', 'vang_lai']
const pad = n => String(n).padStart(2, '0')

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

// Ngày khách trả (YYYY-MM-DD): paid_at (sql/20); khoản cũ chưa có thì lấy ngày ghi theo giờ VN.
export const ngayTra = p => p.paid_at ? String(p.paid_at).slice(0, 10)
  : p.created_at ? new Date(new Date(p.created_at).getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''

// Hàm THUẦN (kiểm bằng scripts/test-luong-dvk-hcns.mjs): ghép dữ liệu đã đọc → danh sách dịch vụ được khai cho kỳ (nam, thang).
export function chonDichVuHcns({ hoSo = [], dichVu = [], thu = [], mau = [], khai = [], laQuanTri = false, staffId = null, laPhongHcns = false, nam, thang }) {
  const ky = nam + '-' + pad(thang)
  const hoSoMap = new Map(hoSo.filter(h => LOAI_HO_SO.includes(h.category)).map(h => [h.id, h]))
  const tenMau = new Map(mau.map(t => [t.id, t.name]))
  const daKhai = new Map()
  for (const k of khai) if (k.hcns_case_service_id && k.trang_thai !== 'tra_lai' && Number(k.nam) === Number(nam) && Number(k.thang) === Number(thang)) daKhai.set(k.hcns_case_service_id, (daKhai.get(k.hcns_case_service_id) || 0) + (Number(k.so_tien) || 0))
  const nhom = (ds, khoa) => { const m = new Map(); for (const x of ds) if (hoSoMap.has(x[khoa])) (m.get(x[khoa]) || m.set(x[khoa], []).get(x[khoa])).push(x); return m }
  const dvTheoHoSo = nhom(dichVu, 'hcns_client_id'), thuTheoHoSo = nhom(thu, 'hcns_client_id')
  const out = []
  for (const [hsId, ds] of dvTheoHoSo) {
    const h = hoSoMap.get(hsId)
    if (!laQuanTri && !laPhongHcns && h.assigned_to !== staffId) continue
    const tt = thuTheoHoSo.get(hsId) || []
    const trongKy = tt.filter(p => ngayTra(p).slice(0, 7) === ky)
    if (!trongKy.length) continue
    const chiaDen = allocatePayments(ds, tt.filter(p => ngayTra(p).slice(0, 7) <= ky))
    const chiaTruoc = allocatePayments(ds, tt.filter(p => ngayTra(p).slice(0, 7) < ky))
    const ngay = [...new Set(trongKy.map(p => ngayTra(p)))].sort().map(n => n.slice(8, 10) + '/' + n.slice(5, 7))
    for (const d of ds) {
      const a = chiaDen.get(d.id), b = chiaTruoc.get(d.id)
      const thuKy = ((a?.direct || 0) + (a?.shared || 0)) - ((b?.direct || 0) + (b?.shared || 0))
      if (thuKy <= 0) continue
      out.push({
        id: TIEN_TO_HCNS + d.id, loai: 'hcns', hcns_case_service_id: d.id, client_id: null, khong_vat: false,
        nvPhuTrach: h.assigned_to || null,   // người phụ trách hồ sơ — doanh thu thời điểm của bảng lương (doanhThuHcns.js)
        ten: tenMau.get(d.template_id) || 'Dịch vụ HCNS', cty: h.name || '', ma: h.case_code || '',
        ky: 'thu ' + ngay.join(', ') + (d.status === 'hoan_thanh' ? ' · đã xong' : ' · đang làm'),
        phaiThu: Number(d.cost) || 0, daThu: thuKy, daKhai: daKhai.get(d.id) || 0,
      })
    }
  }
  return out.sort((a, b) => a.cty.localeCompare(b.cty, 'vi') || a.ten.localeCompare(b.ten, 'vi'))
}

// Đọc dữ liệu thật rồi gọi chonDichVuHcns. caller: từ requireLogin; quyen.admin: quản trị; ky: { nam, thang } kỳ lương.
export async function hoSoHcnsChonDuoc(supabase, caller, quyen, ky) {
  if (!ky?.nam || !ky?.thang) return []
  let thu
  try { thu = await docHet(() => supabase.from('hcns_case_payments').select('id, hcns_client_id, case_service_id, amount, paid_at, created_at')) }
  catch {
    try { thu = await docHet(() => supabase.from('hcns_case_payments').select('id, hcns_client_id, case_service_id, amount, created_at')) }
    catch { return [] }   // bản clone không có HCNS
  }
  const kyStr = ky.nam + '-' + pad(ky.thang)
  const hsIds = [...new Set(thu.filter(p => ngayTra(p).slice(0, 7) === kyStr).map(p => p.hcns_client_id))]
  if (!hsIds.length) return []
  const hoSo = [], dichVu = []
  const COT_DV = 'id, hcns_client_id, template_id, cost, status, received_at, expected_at, created_at'
  for (let i = 0; i < hsIds.length; i += 200) {
    const lo = hsIds.slice(i, i + 200)
    hoSo.push(...await docHet(() => supabase.from('hcns_clients').select('id, name, case_code, category, assigned_to').in('id', lo)))
    dichVu.push(...await docHet(() => supabase.from('hcns_case_services').select(COT_DV).in('hcns_client_id', lo)))
  }
  const [{ data: mau }, khaiRes, { data: phongHcns }] = await Promise.all([
    supabase.from('hcns_service_templates').select('id, name'),
    docHet(() => supabase.from('luong_dvk_khai').select('id, hcns_case_service_id, so_tien, trang_thai, nam, thang').not('hcns_case_service_id', 'is', null)).then(data => ({ data }), e => ({ error: e })),
    supabase.from('rooms').select('id').eq('type', 'hcns'),
  ])
  const phongToi = new Set(caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean))
  return chonDichVuHcns({
    hoSo, dichVu, thu: thu.filter(p => hsIds.includes(p.hcns_client_id)), mau: mau || [], khai: khaiRes.error ? [] : khaiRes.data || [],
    laQuanTri: !!quyen.admin, staffId: caller.staffId, laPhongHcns: (phongHcns || []).some(r => phongToi.has(r.id)),
    nam: ky.nam, thang: ky.thang,
  })
}
