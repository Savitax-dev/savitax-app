// Phân hệ TIỀN LƯƠNG — BƯỚC 3: chốt / mở chốt bảng lương tháng (sql/33). Tổng quan: lib/luong/README.md.
//   POST {viec:'chot_bang', nam, thang}       → chụp nguyên bảng lương vào luong_bang_chot   (manage_payroll)
//   POST {viec:'mo_chot', nam, thang, ly_do}  → bỏ bản chụp, quay về tính từ dữ liệu sống   (manage_payroll)
// Khoản trừ và file Excel tính ở lib/luong/khauTru.js, lib/luong/excel.js.
import { requireLogin } from '@/lib/serverAuth'
import { getAdmin, loi, quyenCua, namThang } from '@/lib/luong/api'
import { tinhBangLuong } from '@/lib/luong/bangLuong'

export const maxDuration = 60

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const caller = auth.caller
  let body
  try { body = await request.json() } catch { return loi('Thân yêu cầu không hợp lệ') }
  const viec = body?.viec

  try {
    const quyen = await quyenCua(supabase, caller)

    // ── Chốt / mở chốt bảng lương (sql/33) ───────────────────────────────
    if (viec === 'chot_bang' || viec === 'mo_chot') {
      if (!quyen.manage) return loi('Chỉ người có quyền thiết lập lương mới chốt / mở chốt bảng lương', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Tháng không hợp lệ')
      if (viec === 'mo_chot') {
        const lyDo = String(body.ly_do || '').trim()
        if (lyDo.length < 5) return loi('Ghi lý do mở chốt (ít nhất 5 ký tự)')
        const { error } = await supabase.from('luong_bang_chot').update({ da_mo: true, mo_boi: caller.staffId, mo_luc: new Date().toISOString(), ly_do_mo: lyDo.slice(0, 300) })
          .eq('nam', nt.nam).eq('thang', nt.thang)
        return error ? loi(error.message, 500) : Response.json({ ok: true })
      }
      const kq = await tinhBangLuong(supabase, nt.nam, nt.thang)
      const { error } = await supabase.from('luong_bang_chot').upsert({
        nam: nt.nam, thang: nt.thang, du_lieu: kq, chot_boi: caller.staffId, chot_luc: new Date().toISOString(),
        da_mo: false, mo_boi: null, mo_luc: null, ly_do_mo: null,
      }, { onConflict: 'nam,thang' })
      if (error) return loi(/luong_bang_chot/.test(error.message) ? 'Chưa chạy sql/33_luong_chot.sql (' + error.message + ')' : error.message, 500)
      return Response.json({ ok: true })
    }

    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
