// Phân hệ Tiền lương — LƯƠNG CTV (phòng type 'remote': Danxia, Dakshin, CTV Savitax). Anh chốt 06/11/2026.
// TÁCH RIÊNG bảng lương nhân viên Savitax (lib/luong/bangLuong.js không đổi) — tab "Lương CTV", sql/51.
//
// Không chấm công. Mỗi người:
//   doanh thu  = phí kế toán PHẢI THU theo kỳ của công ty phụ trách chính, CHƯA VAT (÷1,08; công ty quý ÷3) —
//                đúng hàm doanhThuTheoNhanVien của bảng lương (công ty không VAT không chia)
//   hoa hồng   = Σ doanh thu từng công ty × tỷ lệ (theo phòng; Danxia: hộ kinh doanh 20%, doanh nghiệp 30%)
//   giữ lại    = 20% × hoa hồng — SVT giữ, cộng dồn sổ luong_ctv_giu_lai, quản trị bấm trả tay
//   thu nhập   = hoa hồng − giữ lại + tiền giữ lại được trả tháng này
//   thuế TNCN  = 10% × thu nhập
//   thực nhận  = thu nhập − thuế
// Ví dụ anh gửi (CTV): doanh thu 10.000.000 → hoa hồng 2.000.000 → giữ 400.000 → thu nhập 1.600.000 → thuế 160.000
// → thực nhận 1.440.000.
import { doanhThuTheoNhanVien } from './bangLuong.js'

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
export function tinhDongCtv({ congTy = [], tyLe, traGiuLai = 0 }) {
  const ct = congTy.map(c => {
    const tl = !tyLe ? 0 : c.hkd ? tyLe.hkd : tyLe.dn
    return { ...c, tyLe: tl, hoaHong: Math.round((Number(c.doanhThu) || 0) * tl) }
  })
  const doanhThu = ct.reduce((a, c) => a + (Number(c.doanhThu) || 0), 0)
  const hoaHong = ct.reduce((a, c) => a + c.hoaHong, 0)
  const giuLai = Math.round(hoaHong * GIU_LAI)
  const tra = Math.max(0, Math.round(Number(traGiuLai) || 0))
  const thuNhap = hoaHong - giuLai + tra
  const thue = Math.round(thuNhap * THUE_CTV)
  return { congTy: ct, doanhThu, hoaHong, giuLai, traGiuLai: tra, thuNhap, thue, thucNhan: thuNhap - thue }
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
  const [dt, hkdRows, so] = await Promise.all([
    doanhThuTheoNhanVien(supabase, nam, thang),
    docHet(() => supabase.from('clients').select('id').eq('is_hkd', true)).catch(() => []),
    soGiuLai(supabase, nam, thang),
  ])
  const laHkd = new Set(hkdRows.map(r => r.id))
  const dong = []
  for (const s of staff || []) {
    const x = dt.get(s.id), g = so.get(s.id)
    // Có công ty (doanh thu), hoặc còn tiền đang giữ / được trả tháng này mới có dòng (để quản trị bấm trả được)
    if (!(x?.tong > 0) && !(g?.traThang > 0) && !(g?.truoc > 0)) continue
    if (s.loai_khoi_luong_ctv === true) { daLoai.push({ staff_id: s.id, ten: s.full_name, phong: phong.get(s.room_id)?.name || '', doanhThu: x?.tong || 0 }); continue }
    const p = phong.get(s.room_id), tyLe = tyLeCuaPhong(p?.name)
    const kq = tinhDongCtv({
      congTy: (x?.congTy || []).filter(c => c.doanhThu > 0).map(c => ({ id: c.id, ten: c.ten, ma: c.ma, phiKy: c.phiKy, quy: c.quy, khongVat: c.khongVat, doanhThu: c.doanhThu, hkd: laHkd.has(c.id) })),
      tyLe, traGiuLai: g?.traThang || 0,
    })
    dong.push({
      staff_id: s.id, ten: s.full_name, room_id: s.room_id, phong: p?.name || '', dangLam: s.is_active !== false,
      tyLeMoTa: tyLe?.mo_ta || null, chuaCoTyLe: !tyLe, soCty: kq.congTy.length, ...kq,
      ghiChuTra: g?.ghiChuTra || null,
      giuTruoc: g?.truoc || 0,                            // còn giữ trước tháng này
      giuSau: (g?.truoc || 0) + kq.giuLai - kq.traGiuLai,  // còn giữ sau tháng này (khi chốt)
    })
  }
  dong.sort((a, b) => a.phong.localeCompare(b.phong, 'vi') || a.ten.localeCompare(b.ten, 'vi'))
  const dsPhong = [...phong.values()].map(r => ({ room_id: r.id, ten: r.name, tyLe: tyLeCuaPhong(r.name)?.mo_ta || 'chưa có tỷ lệ', ...tongCua(dong.filter(d => d.room_id === r.id)) }))
  return { nam, thang, dong, phong: dsPhong, tong: tongCua(dong), daLoai }
}

export function tongCua(ds) {
  const t = { soNguoi: ds.length, doanhThu: 0, hoaHong: 0, giuLai: 0, traGiuLai: 0, thuNhap: 0, thue: 0, thucNhan: 0 }
  for (const d of ds) for (const k of Object.keys(t)) if (k !== 'soNguoi') t[k] += Number(d[k]) || 0
  return t
}
