// Doanh số và thưởng cuối tháng của Phòng Kinh doanh (đề xuất 04/11/2026, mục "Sửa 4").
// Hàm thuần, không đụng DB/DOM.
//
// Quy tắc sếp Huyền đã chốt:
//   · Doanh số tính thưởng là tiền THỰC THU trong tháng, CHƯA gồm thuế GTGT.
//   · Mốc tối thiểu: 30.000.000 đ (thử việc) · 35.000.000 đ (chính thức).
//   · Thưởng = 10% phần VƯỢT mốc. Không đạt mốc thì không có thưởng.
//   · Khoản khách trả thẳng cho bên thứ ba (MISA — "Về Savitax: Không") KHÔNG tính doanh số;
//     chỗ lọc nằm ở lib/salesContract.js (trackContract) nên ở đây không phải lọc lại.
// Mốc và tỷ lệ để trong "Cài đặt thưởng" cho sếp tự sửa khi cơ chế đổi — 3 hằng số dưới chỉ là
// giá trị mặc định lúc chưa cài đặt gì.
export const NGUONG_THU_VIEC = 30000000
export const NGUONG_CHINH_THUC = 35000000
export const TY_LE_THUONG = 10        // % phần vượt mốc

export const MUC_NV = [
  { k: 'thu_viec', label: 'Thử việc', nguongKey: 'nguong_thu_viec' },
  { k: 'chinh_thuc', label: 'Chính thức', nguongKey: 'nguong_chinh_thuc' },
]
export const mucOf = k => MUC_NV.find(m => m.k === k) || MUC_NV[1]

export const TRANG_THAI = [
  { k: 'cho_duyet', label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  { k: 'da_duyet', label: 'Đã duyệt', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { k: 'tu_choi', label: 'Trả lại', cls: 'bg-red-50 text-red-800 border-red-200' },
]
export const trangThaiOf = k => TRANG_THAI.find(t => t.k === k) || TRANG_THAI[0]

const num = v => { const n = Math.round(Number(v) || 0); return n > 0 ? n : 0 }

export function defaultSettings() {
  return { nguong_thu_viec: NGUONG_THU_VIEC, nguong_chinh_thuc: NGUONG_CHINH_THUC, ty_le: TY_LE_THUONG, vat_rate: 8 }
}

// Mốc doanh số của một người: mốc riêng (nếu sếp đặt tay) > mốc theo cấp > mặc định.
export function nguongCua(level, settings) {
  const s = { ...defaultSettings(), ...(settings || {}) }
  if (level && level.nguong != null && Number(level.nguong) >= 0) return num(level.nguong)
  return num(s[mucOf(level?.level).nguongKey])
}

// Thưởng = (doanh số chưa VAT − mốc) × tỷ lệ. Chưa đạt mốc thì 0 đồng, KHÔNG âm.
export function tinhThuong(doanhSo, nguong, tyLe = TY_LE_THUONG) {
  const ds = num(doanhSo)
  const mc = num(nguong)
  const ty = Number(tyLe)
  const vuot = ds - mc
  if (vuot <= 0) return { vuot: 0, thuong: 0, dat: false }
  return { vuot, thuong: Math.round(vuot * (Number.isFinite(ty) && ty > 0 ? ty : 0) / 100), dat: true }
}

// Dựng bảng báo cáo tháng: mỗi nhân viên một dòng, kèm doanh số, mốc, phần vượt và tiền thưởng.
//   staff    — [{ id, full_name }] nhân viên Phòng Kinh doanh
//   doanhSo  — Map(staffId -> tiền chưa VAT trong tháng) từ revenueByStaff
//   levels   — Map(staffId -> { level, nguong })
//   saved    — Map(staffId -> dòng đã lưu trong sales_bonus_reports) để lấy trạng thái duyệt
// Người không có doanh số vẫn hiện (0 đồng) để sếp thấy đủ phòng.
export function buildBonusReport({ period, staff, doanhSo, levels, settings, saved } = {}) {
  const s = { ...defaultSettings(), ...(settings || {}) }
  const rows = (staff || []).map(nv => {
    const level = levels?.get(nv.id) || { level: 'chinh_thuc', nguong: null }
    const ds = num(doanhSo?.get(nv.id))
    const nguong = nguongCua(level, s)
    const { vuot, thuong, dat } = tinhThuong(ds, nguong, s.ty_le)
    const cu = saved?.get(nv.id) || null
    return {
      staff_id: nv.id, staff_name: nv.full_name, level: mucOf(level.level).k, level_label: mucOf(level.level).label,
      doanh_so: ds, nguong, vuot, thuong, dat, ty_le: num(s.ty_le),
      trang_thai: cu?.trang_thai || null, nguoi_duyet: cu?.nguoi_duyet || null, luc_duyet: cu?.luc_duyet || null,
      ghi_chu: cu?.ghi_chu || null, saved_id: cu?.id || null,
      // Số đã lưu khác số tính lại = có lần thu được thêm/sửa sau khi trình duyệt.
      lech: cu ? num(cu.doanh_so) !== ds : false,
      doanh_so_da_trinh: cu ? num(cu.doanh_so) : null,
    }
  })
  rows.sort((a, b) => b.doanh_so - a.doanh_so || a.staff_name.localeCompare(b.staff_name, 'vi'))
  return {
    period: period || null,
    rows,
    tongDoanhSo: rows.reduce((a, r) => a + r.doanh_so, 0),
    tongThuong: rows.reduce((a, r) => a + r.thuong, 0),
    soNguoiDat: rows.filter(r => r.dat).length,
    settings: s,
  }
}
