// Phân hệ TIỀN LƯƠNG — BƯỚC 4: phiếu lương của từng nhân viên (sql/34). Tổng quan: lib/luong/README.md.
//   GET  ?viec=cua_toi                         → các tháng đã gửi phiếu, kèm phiếu của CHÍNH người gọi
//   POST {viec:'xac_nhan', nam, thang}         → nhân viên xác nhận phiếu của mình
//   POST {viec:'bao_sai', nam, thang, ghi_chu} → nhân viên báo sai (bắt buộc ghi chú)
// Ai cũng CHỈ thấy phiếu của chính mình — máy chủ lọc theo người đăng nhập, không theo tham số gửi lên.
import { requireLogin } from '@/lib/serverAuth'
import { getAdmin, loi, namThang } from '@/lib/luong/api'

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const me = auth.caller.staffId
  try {
    const { data: px, error } = await supabase.from('luong_phieu_xac_nhan').select('nam, thang, trang_thai, ghi_chu, luc').eq('staff_id', me)
      .order('nam', { ascending: false }).order('thang', { ascending: false }).limit(24)
    if (error) return Response.json({ data: [], chuaCoBang: true })
    const out = []
    for (const p of px || []) {
      // Chỉ phiếu của tháng đang ở trạng thái ĐÃ CHỐT + ĐÃ GỬI (mở chốt là thu hồi).
      const { data: c } = await supabase.from('luong_bang_chot').select('du_lieu, da_gui, da_mo, gui_luc').eq('nam', p.nam).eq('thang', p.thang).maybeSingle()
      if (!c || !c.da_gui || c.da_mo) continue
      const dong = (c.du_lieu?.dong || []).find(x => x.staff_id === me)
      if (!dong) continue
      const { congTyDoanhThu, ...gon } = dong   // bỏ danh sách công ty cho gọn, giữ số tổng
      out.push({
        nam: p.nam, thang: p.thang, trangThai: p.trang_thai, ghiChu: p.ghi_chu, luc: p.luc, guiLuc: c.gui_luc,
        ky: { viec: c.du_lieu.kyViec, no: c.du_lieu.kyNo, doanhThu: c.du_lieu.kyDoanhThu },
        phong: (c.du_lieu.phong || []).find(r => r.room_id === dong.room_id) || null,
        dong: gon,
      })
    }
    return Response.json({ data: out })
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const me = auth.caller.staffId
  let body
  try { body = await request.json() } catch { return loi('Thân yêu cầu không hợp lệ') }
  const nt = namThang(body?.nam, body?.thang)
  if (!nt) return loi('Tháng không hợp lệ')
  try {
    const { data: c } = await supabase.from('luong_bang_chot').select('da_gui, da_mo').eq('nam', nt.nam).eq('thang', nt.thang).maybeSingle()
    if (!c || !c.da_gui || c.da_mo) return loi('Phiếu lương tháng này đang được kế toán điều chỉnh — chờ gửi lại', 409)
    const { data: p } = await supabase.from('luong_phieu_xac_nhan').select('trang_thai').eq('nam', nt.nam).eq('thang', nt.thang).eq('staff_id', me).maybeSingle()
    if (!p) return loi('Không có phiếu lương của anh/chị trong tháng này', 404)
    if (body.viec === 'xac_nhan') {
      const { error } = await supabase.from('luong_phieu_xac_nhan').update({ trang_thai: 'da_xac_nhan', ghi_chu: null, luc: new Date().toISOString() })
        .eq('nam', nt.nam).eq('thang', nt.thang).eq('staff_id', me)
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }
    if (body.viec === 'bao_sai') {
      const ghiChu = String(body.ghi_chu || '').trim()
      if (ghiChu.length < 5) return loi('Ghi rõ chỗ sai (vd: thiếu 1 ngày công, chưa có thưởng DVK hồ sơ X)')
      const { error } = await supabase.from('luong_phieu_xac_nhan').update({ trang_thai: 'bao_sai', ghi_chu: ghiChu.slice(0, 500), luc: new Date().toISOString() })
        .eq('nam', nt.nam).eq('thang', nt.thang).eq('staff_id', me)
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }
    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
