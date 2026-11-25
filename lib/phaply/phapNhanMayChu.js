// Phân hệ Pháp lý — đọc / ghi dữ liệu pháp nhân (sql/57) ở máy chủ. Hàm thuần đổi sang mẫu Word: lib/phaply/phapNhan.js.
import { hoSoDauVao } from './phapNhan.js'

// Gợi ý Phòng ĐKKD (theo tỉnh) + Thuế cơ sở (theo xã) từ danh mục
export async function goiYCoQuan(admin, maTinh, maXa) {
  const [pg, dbt] = await Promise.all([
    maTinh ? admin.from('legal_registries').select('ten_ghi_ho_so').eq('ma_tinh', maTinh).maybeSingle() : Promise.resolve({ data: null }),
    maXa ? admin.from('legal_place_tax').select('khoa_cqt').eq('ma_xa', maXa).maybeSingle() : Promise.resolve({ data: null }),
  ])
  let cqt = null
  if (dbt.data?.khoa_cqt) cqt = (await admin.from('legal_tax_offices').select('ten, ma_cqt').eq('khoa', dbt.data.khoa_cqt).maybeSingle()).data
  return { phong_dkkd: pg.data?.ten_ghi_ho_so || '', co_quan_thue: cqt?.ten || '', ma_cqt: cqt?.ma_cqt || '' }
}

// Hồ sơ cá nhân pháp lý (người được ủy quyền) của một nhân viên
export async function nguoiCuaNhanVien(admin, staffId) {
  if (!staffId) return null
  const { data } = await admin.from('legal_people').select('*').eq('staff_id', staffId).maybeSingle()
  return data || null
}

// Toàn bộ dữ liệu pháp nhân của một hồ sơ (dòng legal_cases)
export async function docPhapNhan(admin, hs) {
  if (!hs.entity_id) return { entity: null, vaiTro: [], nganh: [], uyQuyen: await nguoiCuaNhanVien(admin, hs.assigned_to), goiY: {} }
  // ⚠ legal_entity_people có HAI khoá ngoại sang legal_people (person_id + cua_person_id, sql/61) → embed PHẢI ghi !person_id, không thì
  // PostgREST báo mơ hồ và trả rỗng (25/11/2026: mọi người trong hồ sơ biến mất). Lỗi của cả 3 câu đều ném ra, không nuốt.
  const [{ data: entity, error }, { data: vt, error: e2 }, { data: ng, error: e3 }] = await Promise.all([
    admin.from('legal_entities').select('*').eq('id', hs.entity_id).maybeSingle(),
    admin.from('legal_entity_people').select('*, nguoi:legal_people!person_id(*)').eq('entity_id', hs.entity_id).order('thu_tu').order('id'),
    admin.from('legal_entity_industries').select('*').eq('entity_id', hs.entity_id).order('thu_tu').order('id'),
  ])
  if (error || e2 || e3) throw new Error((error || e2 || e3).message)
  const [uyQuyen, goiY] = await Promise.all([
    nguoiCuaNhanVien(admin, hs.assigned_to),
    goiYCoQuan(admin, entity?.tru_so_ma_tinh, entity?.tru_so_ma_xa),
  ])
  return { entity, vaiTro: vt || [], nganh: ng || [], uyQuyen, goiY }
}

export const dauVaoCuaHoSo = async (admin, hs) => {
  const d = await docPhapNhan(admin, hs)
  return { ...d, dauVao: hoSoDauVao({ ...d, entity: d.entity || { entity_type: hs.entity_type } }) }
}

// ─── Ghi ─────────────────────────────────────────────────────────────────────────────────────────────────
// Cột doanh nghiệp được sửa từ giao diện (tên cột DB). Kiểu số đổi ở đây, không tin chuỗi trình duyệt gửi.
const COT_CTY_CHU = ['name', 'name_en', 'name_short', 'tax_code', 'phone', 'email', 'fax', 'website', 'tru_so_so_nha', 'tru_so_ma_xa',
  'tru_so_xa', 'tru_so_ma_tinh', 'tru_so_tinh', 'mo_hinh', 'phong_dkkd', 'co_quan_thue', 'ma_cqt', 'khau_hao',
  'thoi_han_hoat_dong', 'so_lan_hop_hdtv', 'dia_chi_cn_vpdd']   // 3 cột cuối: Điều lệ bổ sung (sql/61)
const COT_CTY_SO = ['von_dieu_le', 'menh_gia', 'so_lao_dong', 'quy_uoc_phieu']
const COT_CTY_CO = ['csh_la_to_chuc', 'co_ndt_nuoc_ngoai', 'dien_thue_san']
const COT_CTY_JSON = ['thue', 'so_sach']

const soHoa = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[.\s]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null }
const chu = v => (v == null ? null : String(v).trim() || null)

export function locCotCty(f = {}) {
  const ra = {}
  for (const k of COT_CTY_CHU) if (k in f) ra[k] = chu(f[k])
  for (const k of COT_CTY_SO) if (k in f) ra[k] = soHoa(f[k])
  for (const k of COT_CTY_CO) if (k in f) ra[k] = !!f[k]
  for (const k of COT_CTY_JSON) if (k in f && f[k] && typeof f[k] === 'object') ra[k] = f[k]
  if ('name' in ra) ra.name = (ra.name || '').toLocaleUpperCase('vi-VN')
  if ('tax_code' in ra && ra.tax_code) ra.tax_code = ra.tax_code.replace(/\s/g, '')
  return ra
}
// Cột address cũ (danh sách hồ sơ) = địa chỉ trụ sở ghép
export const ghepDiaChi = e => [e.tru_so_so_nha, e.tru_so_xa, e.tru_so_tinh].filter(Boolean).join(', ') || null

const COT_NGUOI_CHU = ['ho_ten', 'gioi_tinh', 'ngay_sinh', 'dan_toc', 'quoc_tich', 'loai_giay_to', 'so_giay_to', 'ngay_cap', 'noi_cap',
  'ngay_het_han', 'dien_thoai', 'email',
  'ma_so_dn', 'ngay_cap_dn', 'noi_cap_dn', 'dai_dien_ten', 'dai_dien_chuc_danh']   // người là TỔ CHỨC (sql/61)
const locDiaChi = d => (d && typeof d === 'object'
  ? Object.fromEntries(['so_nha', 'ma_xa', 'xa', 'ma_tinh', 'tinh', 'quoc_gia'].filter(k => chu(d[k])).map(k => [k, chu(d[k])])) : {})
export function locCotNguoi(f = {}) {
  const ra = {}
  for (const k of COT_NGUOI_CHU) if (k in f) ra[k] = chu(f[k])
  if ('ho_ten' in ra) ra.ho_ten = ra.ho_ten || ''
  if (ra.gioi_tinh && !['Nam', 'Nữ'].includes(ra.gioi_tinh)) ra.gioi_tinh = null
  if ('thuong_tru' in f) ra.thuong_tru = locDiaChi(f.thuong_tru)
  if ('lien_lac' in f) ra.lien_lac = locDiaChi(f.lien_lac)
  if (ra.so_giay_to) ra.so_giay_to = ra.so_giay_to.replace(/\s/g, '')
  if ('la_to_chuc' in f) ra.la_to_chuc = !!f.la_to_chuc
  return ra
}

const VAI = ['dai_dien', 'giam_doc', 'chu_so_huu', 'thanh_vien', 'co_dong', 'ke_toan', 'thu_ky', 'dai_dien_uy_quyen', 'nguoi_dung_dau', 'thanh_vien_ho']
export function locVaiTro(v = {}) {
  if (!VAI.includes(v.vai_tro)) return null
  return {
    vai_tro: v.vai_tro, chuc_danh: chu(v.chuc_danh), von_gop: soHoa(v.von_gop), so_co_phan: soHoa(v.so_co_phan),
    loai_co_phan: chu(v.loai_co_phan), loai_tai_san: chu(v.loai_tai_san), thoi_han_gop: chu(v.thoi_han_gop),
    chu_tich: !!v.chu_tich, thu_tu: Number.isFinite(+v.thu_tu) ? +v.thu_tu : 0,
    // sql/61: người đại diện theo ủy quyền của tổ chức + quyền hạn người đại diện thứ 2 trở đi
    cua_person_id: v.vai_tro === 'dai_dien_uy_quyen' && v.cua_person_id ? v.cua_person_id : null,
    von_uy_quyen: soHoa(v.von_uy_quyen), thoi_diem_dai_dien: chu(v.thoi_diem_dai_dien), quyen_han: chu(v.quyen_han),
  }
}
