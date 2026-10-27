// Phân hệ Tiền lương — phần dùng chung cho 3 route API (máy chủ):
//   app/api/admin/luong          BƯỚC 1: cấp bậc, lương nhân viên, ngày lễ, chấm công
//   app/api/admin/luong/thuong   BƯỚC 2: thưởng dịch vụ khác, bảng lương
//   app/api/admin/luong/chot     BƯỚC 3: chốt / mở chốt bảng lương
import { createClient } from '@supabase/supabase-js'
import { ngayCongChuan } from './ngayCong.js'
import { coVaiTroHeThong, quyenTrongDanhSach } from '../quyenCache.js'

export function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
export const loi = (error, status = 400) => Response.json({ error }, { status })
export const pad = n => String(n).padStart(2, '0')

// Quyền của người gọi trong phân hệ (đọc một lần mỗi lượt gọi).
export async function quyenCua(supabase, caller) {
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  if (roles.includes('admin')) return { admin: true, cham_cong: true, view: true, manage: true }
  if (await coVaiTroHeThong(supabase, roles)) return { admin: false, cham_cong: true, view: true, manage: true }
  const k = await quyenTrongDanhSach(supabase, roles, ['cham_cong', 'view_payroll', 'manage_payroll'])   // nhớ tạm 5 phút
  return { admin: false, cham_cong: k.has('cham_cong'), view: k.has('view_payroll') || k.has('manage_payroll'), manage: k.has('manage_payroll') }
}

export async function ngayLeCuaThang(supabase, nam, thang) {
  const tu = nam + '-' + pad(thang) + '-01'
  const den = nam + '-' + pad(thang) + '-' + pad(new Date(Date.UTC(nam, thang, 0)).getUTCDate())
  const { data, error } = await supabase.from('luong_ngay_le').select('ngay, ten').gte('ngay', tu).lte('ngay', den).order('ngay')
  if (error) throw new Error('Chưa chạy sql/31_tien_luong.sql (' + error.message + ')')
  return data || []
}

export const namThang = (nam, thang) => {
  const y = Number(nam), m = Number(thang)
  return Number.isInteger(y) && y >= 2024 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12 ? { nam: y, thang: m } : null
}
export const soTien = v => (v === '' || v === null || v === undefined) ? null : Number(v)
export const tienHopLe = v => v === null || (isFinite(v) && v >= 0 && v < 1e10)

// Ngày công chuẩn của tháng (đọc ngày lễ rồi tính).
export async function congChuanThang(supabase, nam, thang) {
  return ngayCongChuan(nam, thang, (await ngayLeCuaThang(supabase, nam, thang)).map(x => x.ngay))
}
