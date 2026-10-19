// Phân hệ TIỀN LƯƠNG — BƯỚC 3: chốt / mở chốt bảng lương tháng (sql/33). Tổng quan: lib/luong/README.md.
//   POST {viec:'chot_bang', nam, thang}       → chụp nguyên bảng lương vào luong_bang_chot   (manage_payroll)
//   POST {viec:'mo_chot', nam, thang, ly_do}  → bỏ bản chụp, quay về tính từ dữ liệu sống   (manage_payroll)
//   POST {viec:'dieu_chinh', nam, thang, staffId, phu_cap, dieu_chinh, ly_do} → phụ cấp / điều chỉnh   (manage_payroll)
//   POST {viec:'gui_xac_nhan', nam, thang}    → gửi phiếu lương tháng ĐÃ CHỐT cho từng nhân viên      (manage_payroll)
// Khoản trừ và file Excel tính ở lib/luong/khauTru.js, lib/luong/excel.js.
import { requireLogin } from '@/lib/serverAuth'
import { getAdmin, loi, quyenCua, namThang } from '@/lib/luong/api'
import { tinhBangLuong } from '@/lib/luong/bangLuong'
import { docBanChot } from '@/lib/luong/chot'

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
        // Mở chốt là THU HỒI phiếu đã gửi: nhân viên không thấy phiếu cho tới khi chốt + gửi lại.
        const { error } = await supabase.from('luong_bang_chot').update({ da_mo: true, mo_boi: caller.staffId, mo_luc: new Date().toISOString(), ly_do_mo: lyDo.slice(0, 300), da_gui: false })
          .eq('nam', nt.nam).eq('thang', nt.thang)
        return error ? loi(error.message, 500) : Response.json({ ok: true })
      }
      const kq = await tinhBangLuong(supabase, nt.nam, nt.thang)
      const { error } = await supabase.from('luong_bang_chot').upsert({
        nam: nt.nam, thang: nt.thang, du_lieu: kq, chot_boi: caller.staffId, chot_luc: new Date().toISOString(),
        da_mo: false, mo_boi: null, mo_luc: null, ly_do_mo: null, da_gui: false,
      }, { onConflict: 'nam,thang' })
      if (error) return loi(/luong_bang_chot/.test(error.message) ? 'Chưa chạy sql/33_luong_chot.sql (' + error.message + ')' : error.message, 500)
      return Response.json({ ok: true })
    }

    // ── Phụ cấp / điều chỉnh ngoại lệ (giám đốc duyệt) ────────────────────
    if (viec === 'dieu_chinh') {
      if (!quyen.manage) return loi('Chỉ người có quyền thiết lập lương mới nhập phụ cấp / điều chỉnh', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Tháng không hợp lệ')
      const chot = await docBanChot(supabase, nt.nam, nt.thang)
      if (chot && !chot.da_mo) return loi('Bảng lương tháng này đã chốt — mở chốt rồi mới sửa phụ cấp / điều chỉnh', 409)
      const phuCap = Math.round(Number(body.phu_cap) || 0), dieuChinh = Math.round(Number(body.dieu_chinh) || 0)
      if (phuCap < 0 || Math.abs(phuCap) > 1e9 || Math.abs(dieuChinh) > 1e9) return loi('Số tiền không hợp lệ')
      const lyDo = String(body.ly_do || '').trim()
      if (dieuChinh !== 0 && lyDo.length < 3) return loi('Có điều chỉnh thì phải ghi lý do (vd: giám đốc duyệt ngoại lệ …)')
      const { data: st } = await supabase.from('staff').select('id').eq('id', body.staffId).maybeSingle()
      if (!st) return loi('Không tìm thấy nhân viên')
      const { error } = await supabase.from('luong_dieu_chinh').upsert({
        nam: nt.nam, thang: nt.thang, staff_id: body.staffId, phu_cap: phuCap, dieu_chinh: dieuChinh,
        ly_do: lyDo.slice(0, 300) || null, sua_boi: caller.staffId, sua_luc: new Date().toISOString(),
      }, { onConflict: 'nam,thang,staff_id' })
      if (error) return loi(/luong_dieu_chinh/.test(error.message) ? 'Chưa chạy sql/34_luong_tac_phong_phieu.sql (' + error.message + ')' : error.message, 500)
      return Response.json({ ok: true })
    }

    // ── Gửi phiếu lương cho nhân viên xác nhận ────────────────────────────
    // Chỉ tháng ĐÃ CHỐT (nhân viên thấy đúng bản chụp). Gửi lại sau khi sửa: người đã xác nhận mà
    // thực lĩnh KHÔNG đổi thì giữ xác nhận; số đổi hoặc đang báo sai thì quay về "chờ xác nhận".
    if (viec === 'gui_xac_nhan') {
      if (!quyen.manage) return loi('Chỉ người có quyền thiết lập lương mới gửi phiếu lương', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Tháng không hợp lệ')
      const chot = await docBanChot(supabase, nt.nam, nt.thang)
      if (!chot || chot.da_mo) return loi('Chốt bảng lương trước rồi mới gửi phiếu cho nhân viên', 409)
      const { data: cu, error: e0 } = await supabase.from('luong_phieu_xac_nhan').select('staff_id, trang_thai, thuc_linh').eq('nam', nt.nam).eq('thang', nt.thang)
      if (e0) return loi('Chưa chạy sql/34_luong_tac_phong_phieu.sql (' + e0.message + ')', 500)
      const cuMap = new Map((cu || []).map(x => [x.staff_id, x]))
      const nay = new Date().toISOString()
      const rows = (chot.du_lieu.dong || []).filter(x => x.luongCoBan !== null).map(x => {
        const c = cuMap.get(x.staff_id)
        const giu = c && c.trang_thai === 'da_xac_nhan' && Number(c.thuc_linh) === Number(x.thucLinh)
        return giu ? null : { nam: nt.nam, thang: nt.thang, staff_id: x.staff_id, trang_thai: 'cho_xac_nhan', ghi_chu: null, thuc_linh: x.thucLinh, luc: nay }
      }).filter(Boolean)
      if (rows.length) {
        const { error } = await supabase.from('luong_phieu_xac_nhan').upsert(rows, { onConflict: 'nam,thang,staff_id' })
        if (error) return loi(error.message, 500)
      }
      const { error: e2 } = await supabase.from('luong_bang_chot').update({ da_gui: true, gui_luc: nay, gui_boi: caller.staffId }).eq('nam', nt.nam).eq('thang', nt.thang)
      if (e2) return loi(e2.message, 500)
      const soNguoi = (chot.du_lieu.dong || []).filter(x => x.luongCoBan !== null).length
      return Response.json({ ok: true, soPhieu: soNguoi, choXacNhanLai: rows.length })
    }

    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
