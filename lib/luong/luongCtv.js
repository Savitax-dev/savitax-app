// Phân hệ Tiền lương — LƯƠNG CTV (phòng type 'remote': Danxia, Dakshin, CTV Savitax). Anh chốt 06/11/2026.
// TÁCH RIÊNG bảng lương nhân viên Savitax (lib/luong/bangLuong.js không đổi) — tab "Lương CTV", sql/51.
//
// Không chấm công. Mỗi người:
//   doanh thu  = phí kế toán PHẢI THU theo kỳ của công ty phụ trách chính, CHƯA VAT (÷1,08; công ty quý ÷3) —
//                đúng hàm doanhThuTheoNhanVien của bảng lương (công ty không VAT không chia)
//   hoa hồng   = Σ doanh thu từng công ty × tỷ lệ (theo phòng; Danxia: hộ kinh doanh 20%, doanh nghiệp 30%)
//   giữ lại    = 20% × hoa hồng — SVT giữ, cộng dồn sổ luong_ctv_giu_lai, quản trị bấm trả tay
//   dịch vụ khác = thưởng DVK CTV tự khai, ĐÃ DUYỆT (luong_dvk_khai — đúng luồng nhân viên). Anh chốt 18/11/2026:
//                hồ sơ DVK đã THANH LÝ (other_services.status = 'done'; dịch vụ HCNS Thời điểm luôn đã xong + đã thu)
//                thì KHÔNG giữ lại; hồ sơ còn mở / dịch vụ ngoài app thì giữ 20% như hoa hồng
//   điều chỉnh = khoản tăng / giảm ngoại lệ, nhiều dòng có nội dung (luong_dieu_chinh — cùng bảng với nhân viên)
//   thu nhập   = hoa hồng + dịch vụ khác − giữ lại + tiền giữ lại được trả tháng này + điều chỉnh
//   thuế TNCN  = 10% × thu nhập (thu nhập âm thì thuế 0)
//   thực nhận  = thu nhập − thuế
// Ví dụ anh gửi (CTV): doanh thu 10.000.000 → hoa hồng 2.000.000 → giữ 400.000 → thu nhập 1.600.000 → thuế 160.000
// → thực nhận 1.440.000.
import { doanhThuTheoNhanVien } from './bangLuong.js'
import { dongCuaBanGhi } from './dieuChinh.js'

export const GIU_LAI = 0.2
export const THUE_CTV = 0.1

// Tỷ lệ hoa hồng theo phòng (nhận theo TÊN phòng, không dấu). Phòng remote chưa có ở đây → chưa tính (báo trên bảng).
const khongDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
export const TY_LE_PHONG = [
  { khop: /danxia/, dn: 0.3, hkd: 0.2, mo_ta: 'Doanh nghiệp 30% · Hộ kinh doanh 20%' },
  { khop: /dakshin/, dn: 0.3, hkd: 0.3, mo_ta: '30% doanh thu kế toán' },
  { khop: /ctv/, dn: 0.2, hkd: 0.2, mo_ta: '20% doanh thu kế toán' },
]
export const tyLeCuaPhong = tenPhong => TY_LE_PHONG.find(t => t.khop.test(khongDau(tenPhong))) || null

// Hàm THUẦN — một dòng lương CTV.
//   congTy: [{ doanhThu, hkd }] · tyLe: phần tử TY_LE_PHONG · traGiuLai: tiền giữ lại trả trong tháng
//   dvk: [{ ten, thuong, thanhLy }] — dòng DVK đã duyệt · dieuChinh: tổng điều chỉnh (+/−)
export function tinhDongCtv({ congTy = [], tyLe, traGiuLai = 0, dvk = [], dieuChinh = 0 }) {
  const ct = congTy.map(c => {
    const tl = !tyLe ? 0 : c.hkd ? tyLe.hkd : tyLe.dn
    return { ...c, tyLe: tl, hoaHong: Math.round((Number(c.doanhThu) || 0) * tl) }
  })
  const doanhThu = ct.reduce((a, c) => a + (Number(c.doanhThu) || 0), 0)
  const hoaHong = ct.reduce((a, c) => a + c.hoaHong, 0)
  const dvkDong = dvk.map(d => {
    const thuong = Math.round(Number(d.thuong) || 0)
    return { ...d, thuong, giu: d.thanhLy ? 0 : Math.round(thuong * GIU_LAI) }
  })
  const dvkTong = dvkDong.reduce((a, d) => a + d.thuong, 0)
  const giuHoaHong = Math.round(hoaHong * GIU_LAI)
  const giuDvk = dvkDong.reduce((a, d) => a + d.giu, 0)
  const giuLai = giuHoaHong + giuDvk
  const tra = Math.max(0, Math.round(Number(traGiuLai) || 0))
  const dc = Math.round(Number(dieuChinh) || 0)
  const thuNhap = hoaHong + dvkTong - giuLai + tra + dc
  const thue = Math.max(0, Math.round(thuNhap * THUE_CTV))
  return { congTy: ct, doanhThu, hoaHong, dvk: dvkTong, dvkDong, giuHoaHong, giuDvk, giuLai, traGiuLai: tra, dieuChinh: dc, thuNhap, thue, thucNhan: thuNhap - thue }
}

// Lật trang có sắp theo id — PostgREST cắt im lặng ở 1000 dòng.
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

// Sổ giữ lại: Map staffId → { truoc (còn giữ TRƯỚC tháng này), giuThang, traThang, ghiChuTra }
export async function soGiuLai(supabase, nam, thang) {
  const out = new Map()
  let rows = []
  try { rows = await docHet(() => supabase.from('luong_ctv_giu_lai').select('id, staff_id, nam, thang, loai, so_tien, ghi_chu')) } catch { return out }
  const ky = nam * 12 + thang
  for (const r of rows) {
    if (!out.has(r.staff_id)) out.set(r.staff_id, { truoc: 0, giuThang: 0, traThang: 0, ghiChuTra: null })
    const x = out.get(r.staff_id), k = r.nam * 12 + r.thang, v = Number(r.so_tien) || 0
    if (k < ky) x.truoc += r.loai === 'giu' ? v : -v
    else if (k === ky) { if (r.loai === 'giu') x.giuThang = v; else { x.traThang = v; x.ghiChuTra = r.ghi_chu || null } }
  }
  return out
}

// Bảng lương CTV tháng (nam, thang) — tính từ dữ liệu sống.
export async function tinhBangLuongCtv(supabase, nam, thang) {
  const { data: rooms } = await supabase.from('rooms').select('id, name, type').eq('type', 'remote')
  const phong = new Map((rooms || []).map(r => [r.id, r]))
  if (!phong.size) return { nam, thang, dong: [], phong: [], tong: tongCua([]) }
  // loai_khoi_luong_ctv (sql/52): người quản trị bấm "Loại" — chưa chạy SQL thì đọc như cũ (không ai bị loại)
  let { data: staff, error: eSt } = await supabase.from('staff').select('id, full_name, room_id, is_active, loai_khoi_luong_ctv').in('room_id', [...phong.keys()])
  if (eSt) ({ data: staff } = await supabase.from('staff').select('id, full_name, room_id, is_active').in('room_id', [...phong.keys()]))
  const daLoai = []
  const staffIds = (staff || []).map(s => s.id)
  const [dt, hkdRows, so, dvkTheoNv, dcTheoNv] = await Promise.all([
    doanhThuTheoNhanVien(supabase, nam, thang),
    docHet(() => supabase.from('clients').select('id').eq('is_hkd', true)).catch(() => []),
    soGiuLai(supabase, nam, thang),
    dvkCuaCtv(supabase, staffIds, nam, thang),
    dieuChinhCuaCtv(supabase, staffIds, nam, thang),
  ])
  const laHkd = new Set(hkdRows.map(r => r.id))
  const dong = []
  for (const s of staff || []) {
    const x = dt.get(s.id), g = so.get(s.id), dv = dvkTheoNv.get(s.id), dc = dcTheoNv.get(s.id)
    // Có công ty (doanh thu), DVK / điều chỉnh, hoặc còn tiền đang giữ / được trả tháng này mới có dòng (để quản trị bấm trả được)
    if (!(x?.tong > 0) && !(g?.traThang > 0) && !(g?.truoc > 0) && !dv?.duyet.length && !dv?.choDuyet && !dc?.tong) continue
    if (s.loai_khoi_luong_ctv === true) { daLoai.push({ staff_id: s.id, ten: s.full_name, phong: phong.get(s.room_id)?.name || '', doanhThu: x?.tong || 0 }); continue }
    const p = phong.get(s.room_id), tyLe = tyLeCuaPhong(p?.name)
    const kq = tinhDongCtv({
      congTy: (x?.congTy || []).filter(c => c.doanhThu > 0).map(c => ({ id: c.id, ten: c.ten, ma: c.ma, phiKy: c.phiKy, quy: c.quy, khongVat: c.khongVat, doanhThu: c.doanhThu, hkd: laHkd.has(c.id) })),
      tyLe, traGiuLai: g?.traThang || 0, dvk: dv?.duyet || [], dieuChinh: dc?.tong || 0,
    })
    dong.push({
      staff_id: s.id, ten: s.full_name, room_id: s.room_id, phong: p?.name || '', dangLam: s.is_active !== false,
      tyLeMoTa: tyLe?.mo_ta || null, chuaCoTyLe: !tyLe, soCty: kq.congTy.length, ...kq,
      ghiChuTra: g?.ghiChuTra || null,
      dvkChoDuyet: dv?.choDuyet || 0,                     // số dòng DVK đang chờ duyệt (chưa tính)
      dongDieuChinh: dc?.dong || [],
      giuTruoc: g?.truoc || 0,                            // còn giữ trước tháng này
      giuSau: (g?.truoc || 0) + kq.giuLai - kq.traGiuLai,  // còn giữ sau tháng này (khi chốt)
    })
  }
  dong.sort((a, b) => a.phong.localeCompare(b.phong, 'vi') || a.ten.localeCompare(b.ten, 'vi'))
  const dsPhong = [...phong.values()].map(r => ({ room_id: r.id, ten: r.name, tyLe: tyLeCuaPhong(r.name)?.mo_ta || 'chưa có tỷ lệ', ...tongCua(dong.filter(d => d.room_id === r.id)) }))
  return { nam, thang, dong, phong: dsPhong, tong: tongCua(dong), daLoai }
}

// Thưởng DVK của người phòng remote (luong_dvk_khai, sql/32) → Map staffId → { duyet: [...], choDuyet }.
// "Thanh lý" = hồ sơ Dịch vụ khác đã đóng (status 'done'); dòng HCNS Thời điểm chỉ khai được khi dịch vụ đã xong +
// đã thu → coi như thanh lý; dịch vụ ngoài app không có hồ sơ để biết → giữ 20%. Chưa có bảng thì như không ai khai.
export async function dvkCuaCtv(supabase, staffIds, nam, thang) {
  const out = new Map()
  if (!staffIds.length) return out
  const doc = cot => docHet(() => supabase.from('luong_dvk_khai').select(cot).eq('nam', nam).eq('thang', thang).in('staff_id', staffIds))
  let rows = []
  try { rows = await doc('id, staff_id, ten_dv, so_tien, ty_le, tien_thuong, trang_thai, ghi_chu, service_id, hcns_case_service_id') }
  catch { try { rows = await doc('id, staff_id, ten_dv, so_tien, ty_le, tien_thuong, trang_thai, ghi_chu, service_id') } catch { return out } }
  const svIds = [...new Set(rows.filter(r => r.trang_thai === 'da_duyet' && r.service_id).map(r => r.service_id))]
  const daDong = new Set()
  for (let i = 0; i < svIds.length; i += 200) {
    const { data } = await supabase.from('other_services').select('id, status').in('id', svIds.slice(i, i + 200))
    for (const r of data || []) if (r.status === 'done') daDong.add(r.id)
  }
  for (const r of rows) {
    if (!out.has(r.staff_id)) out.set(r.staff_id, { duyet: [], choDuyet: 0 })
    const x = out.get(r.staff_id)
    if (r.trang_thai === 'cho_duyet') { x.choDuyet++; continue }
    if (r.trang_thai !== 'da_duyet') continue
    const thanhLy = r.service_id ? daDong.has(r.service_id) : !!r.hcns_case_service_id
    x.duyet.push({ id: r.id, ten: r.ten_dv, soTien: Number(r.so_tien) || 0, tyLe: Number(r.ty_le) || 0, thuong: Number(r.tien_thuong) || 0, thanhLy,
      ngoaiApp: !r.service_id && !r.hcns_case_service_id, ghiChu: r.ghi_chu || '' })
  }
  return out
}

// Điều chỉnh tăng / giảm của người phòng remote (luong_dieu_chinh — cùng bảng nhân viên) → Map staffId → { tong, dong }.
export async function dieuChinhCuaCtv(supabase, staffIds, nam, thang) {
  const out = new Map()
  if (!staffIds.length) return out
  const doc = cot => supabase.from('luong_dieu_chinh').select(cot).eq('nam', nam).eq('thang', thang).in('staff_id', staffIds)
  let r = await doc('staff_id, phu_cap, dieu_chinh, ly_do, sua_boi, sua_luc, chi_tiet')
  if (r.error) r = await doc('staff_id, phu_cap, dieu_chinh, ly_do, sua_boi, sua_luc')
  if (r.error) return out
  const ten = new Map()
  const ids = [...new Set((r.data || []).flatMap(x => [x.sua_boi, ...(x.chi_tiet || []).map(d => d.nguoi)]).filter(Boolean))]
  if (ids.length) { const { data } = await supabase.from('staff').select('id, full_name').in('id', ids); for (const s of data || []) ten.set(s.id, s.full_name) }
  for (const x of r.data || []) {
    const dong = dongCuaBanGhi(x).map(d => ({ ...d, tenNguoi: ten.get(d.nguoi) || null }))
    out.set(x.staff_id, { tong: (Number(x.phu_cap) || 0) + (Number(x.dieu_chinh) || 0), dong })
  }
  return out
}

export function tongCua(ds) {
  const t = { soNguoi: ds.length, doanhThu: 0, hoaHong: 0, dvk: 0, giuLai: 0, traGiuLai: 0, dieuChinh: 0, thuNhap: 0, thue: 0, thucNhan: 0 }
  for (const d of ds) for (const k of Object.keys(t)) if (k !== 'soNguoi') t[k] += Number(d[k]) || 0
  return t
}
