// Phân hệ Tiền lương — LƯƠNG CTV (phòng remote), sql/51. Tách riêng bảng lương nhân viên Savitax. Luật: lib/luong/luongCtv.js
//   GET  ?viec=bang&nam&thang        → bảng lương CTV (bản chụp nếu đã chốt, không thì tính sống)     (view_payroll)
//   GET  ?viec=cua_toi               → phiếu lương CTV đã gửi của CHÍNH người gọi
//   POST {viec:'chot'|'mo_chot', nam, thang, ly_do?}                                                     (manage_payroll)
//   POST {viec:'gui_phieu', nam, thang}  · {viec:'chuyen_luong', nam, thang, da}                         (manage_payroll)
//   POST {viec:'tra_giu_lai', nam, thang, staffId, so_tien, ghi_chu} → trả tiền giữ lại ở tháng (chưa chốt)  (manage_payroll)
//   POST {viec:'xac_nhan'|'bao_sai', nam, thang, ghi_chu?} → người nhận xác nhận / báo sai phiếu của mình
import { requireLogin } from '@/lib/serverAuth'
import { getAdmin, loi, quyenCua, namThang } from '@/lib/luong/api'
import { tinhBangLuongCtv, soGiuLai } from '@/lib/luong/luongCtv'

export const maxDuration = 60
const CHUA_SQL = 'Chưa chạy sql/51_luong_ctv.sql trong Supabase'
const docChot = async (supabase, nam, thang) => {
  const { data, error } = await supabase.from('luong_ctv_chot').select('*, staff:chot_boi(full_name)').eq('nam', nam).eq('thang', thang).maybeSingle()
  if (error) return { thieuBang: true }
  return data || null
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const p = new URL(request.url).searchParams
  try {
    if (p.get('viec') === 'cua_toi') {
      const me = auth.caller.staffId
      const { data: px, error } = await supabase.from('luong_ctv_phieu').select('nam, thang, trang_thai, ghi_chu, luc').eq('staff_id', me)
        .order('nam', { ascending: false }).order('thang', { ascending: false }).limit(24)
      if (error) return Response.json({ data: [] })
      const out = []
      for (const x of px || []) {
        const c = await docChot(supabase, x.nam, x.thang)
        if (!c || c.thieuBang || !c.da_gui || c.da_mo) continue   // mở chốt = thu hồi phiếu
        const dong = (c.du_lieu?.dong || []).find(d => d.staff_id === me)
        if (dong) out.push({ nam: x.nam, thang: x.thang, trangThai: x.trang_thai, ghiChu: x.ghi_chu, luc: x.luc, guiLuc: c.gui_luc, dong })
      }
      return Response.json({ data: out })
    }

    const quyen = await quyenCua(supabase, auth.caller)
    if (!quyen.view) return loi('Không đủ quyền xem lương', 403)
    const nt = namThang(p.get('nam'), p.get('thang'))
    if (!nt) return loi('Tháng không hợp lệ')
    const chot = await docChot(supabase, nt.nam, nt.thang)
    if (chot?.thieuBang) return loi(CHUA_SQL, 500)
    const daChot = chot && !chot.da_mo
    const kq = daChot ? chot.du_lieu : await tinhBangLuongCtv(supabase, nt.nam, nt.thang)
    let phieu = []
    if (daChot && chot.da_gui) {
      const { data } = await supabase.from('luong_ctv_phieu').select('staff_id, trang_thai, ghi_chu, luc').eq('nam', nt.nam).eq('thang', nt.thang)
      phieu = data || []
    }
    return Response.json({
      ...kq, phieu,
      daChot: daChot ? { luc: chot.chot_luc, boi: chot.staff?.full_name || null, daGui: !!chot.da_gui, guiLuc: chot.gui_luc, daChuyenLuong: !!chot.da_chuyen_luong, chuyenLuongLuc: chot.chuyen_luong_luc } : null,
      moChot: chot?.da_mo ? { luc: chot.mo_luc, lyDo: chot.ly_do_mo } : null,
    })
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const caller = auth.caller
  let body
  try { body = await request.json() } catch { return loi('Thân yêu cầu không hợp lệ') }
  const viec = body?.viec
  const nt = namThang(body?.nam, body?.thang)
  if (!nt) return loi('Tháng không hợp lệ')

  try {
    // ── Người nhận xác nhận / báo sai phiếu của CHÍNH mình ──
    if (viec === 'xac_nhan' || viec === 'bao_sai') {
      const me = caller.staffId
      const c = await docChot(supabase, nt.nam, nt.thang)
      if (!c || c.thieuBang || !c.da_gui || c.da_mo) return loi('Phiếu lương tháng này đang được điều chỉnh — chờ gửi lại', 409)
      const { data: px } = await supabase.from('luong_ctv_phieu').select('trang_thai').eq('nam', nt.nam).eq('thang', nt.thang).eq('staff_id', me).maybeSingle()
      if (!px) return loi('Không có phiếu lương của anh/chị trong tháng này', 404)
      const ghiChu = String(body.ghi_chu || '').trim()
      if (viec === 'bao_sai' && ghiChu.length < 5) return loi('Ghi rõ chỗ sai (vd: thiếu công ty X)')
      const { error } = await supabase.from('luong_ctv_phieu').update({
        trang_thai: viec === 'xac_nhan' ? 'da_xac_nhan' : 'bao_sai', ghi_chu: viec === 'xac_nhan' ? null : ghiChu.slice(0, 500), luc: new Date().toISOString(),
      }).eq('nam', nt.nam).eq('thang', nt.thang).eq('staff_id', me)
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }

    const quyen = await quyenCua(supabase, caller)
    if (!quyen.manage) return loi('Chỉ người có quyền thiết lập lương', 403)
    const chot = await docChot(supabase, nt.nam, nt.thang)
    if (chot?.thieuBang) return loi(CHUA_SQL, 500)
    const daChot = chot && !chot.da_mo

    if (viec === 'chot') {
      if (daChot) return loi('Tháng này đã chốt', 409)
      const kq = await tinhBangLuongCtv(supabase, nt.nam, nt.thang)
      const { error } = await supabase.from('luong_ctv_chot').upsert({
        nam: nt.nam, thang: nt.thang, du_lieu: kq, chot_boi: caller.staffId, chot_luc: new Date().toISOString(),
        da_mo: false, mo_boi: null, mo_luc: null, ly_do_mo: null, da_gui: false, gui_luc: null,
        da_chuyen_luong: false, chuyen_luong_luc: null, chuyen_luong_boi: null,
      }, { onConflict: 'nam,thang' })
      if (error) return loi(error.message, 500)
      // Sổ giữ lại: ghi đúng như bản chụp (mở chốt thì xoá, chốt lại ghi lại)
      await supabase.from('luong_ctv_giu_lai').delete().eq('nam', nt.nam).eq('thang', nt.thang).eq('loai', 'giu')
      const giu = (kq.dong || []).filter(d => d.giuLai > 0).map(d => ({
        staff_id: d.staff_id, nam: nt.nam, thang: nt.thang, loai: 'giu', so_tien: d.giuLai, ghi_chu: 'Giữ lại 20% hoa hồng T' + nt.thang + '/' + nt.nam, tao_boi: caller.staffId,
      }))
      if (giu.length) {
        const { error: eg } = await supabase.from('luong_ctv_giu_lai').insert(giu)
        if (eg) return loi('Đã chốt nhưng CHƯA ghi được sổ giữ lại: ' + eg.message + ' — mở chốt rồi chốt lại.', 500)
      }
      return Response.json({ ok: true })
    }

    if (viec === 'mo_chot') {
      if (!daChot) return loi('Tháng này chưa chốt', 409)
      const lyDo = String(body.ly_do || '').trim()
      if (lyDo.length < 5) return loi('Ghi lý do mở chốt (ít nhất 5 ký tự)')
      const { error } = await supabase.from('luong_ctv_chot').update({
        da_mo: true, mo_boi: caller.staffId, mo_luc: new Date().toISOString(), ly_do_mo: lyDo.slice(0, 300),
        da_gui: false, da_chuyen_luong: false, chuyen_luong_luc: null, chuyen_luong_boi: null,
      }).eq('nam', nt.nam).eq('thang', nt.thang)
      if (error) return loi(error.message, 500)
      await supabase.from('luong_ctv_giu_lai').delete().eq('nam', nt.nam).eq('thang', nt.thang).eq('loai', 'giu')
      return Response.json({ ok: true })
    }

    if (viec === 'gui_phieu') {
      if (!daChot) return loi('Chốt bảng lương CTV trước rồi mới gửi phiếu', 409)
      const ds = (chot.du_lieu?.dong || [])
      const { data: cu } = await supabase.from('luong_ctv_phieu').select('staff_id, thuc_nhan, trang_thai, ghi_chu, luc').eq('nam', nt.nam).eq('thang', nt.thang)
      const cuMap = new Map((cu || []).map(x => [x.staff_id, x]))
      // Gửi lại mà số không đổi thì giữ trạng thái đã xác nhận; số đổi thì phải xác nhận lại
      const rows = ds.map(d => {
        const c = cuMap.get(d.staff_id)
        const giu = c && Number(c.thuc_nhan) === Number(d.thucNhan)
        return { nam: nt.nam, thang: nt.thang, staff_id: d.staff_id, thuc_nhan: d.thucNhan, ...(giu ? { trang_thai: c.trang_thai, ghi_chu: c.ghi_chu, luc: c.luc } : { trang_thai: 'cho_xac_nhan', ghi_chu: null, luc: new Date().toISOString() }) }   // đủ cột mọi dòng — upsert nhiều dòng khác cột sẽ ghi NULL
      })
      if (rows.length) {
        const { error } = await supabase.from('luong_ctv_phieu').upsert(rows, { onConflict: 'nam,thang,staff_id' })
        if (error) return loi(error.message, 500)
      }
      const { error } = await supabase.from('luong_ctv_chot').update({ da_gui: true, gui_luc: new Date().toISOString() }).eq('nam', nt.nam).eq('thang', nt.thang)
      return error ? loi(error.message, 500) : Response.json({ ok: true, soPhieu: rows.length })
    }

    if (viec === 'chuyen_luong') {
      if (!daChot) return loi('Chốt bảng lương CTV trước', 409)
      const bat = body.da !== false
      const { error } = await supabase.from('luong_ctv_chot').update({
        da_chuyen_luong: bat, chuyen_luong_luc: bat ? new Date().toISOString() : null, chuyen_luong_boi: bat ? caller.staffId : null,
      }).eq('nam', nt.nam).eq('thang', nt.thang)
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }

    // Loại / đưa lại một người khỏi bảng lương CTV (sql/52) — chỉ khi tháng đang xem chưa chốt
    if (viec === 'loai') {
      if (daChot) return loi('Tháng này đã chốt — mở chốt rồi mới loại / đưa lại người', 409)
      if (!body.staffId) return loi('Thiếu người')
      const { error } = await supabase.from('staff').update({ loai_khoi_luong_ctv: body.loai !== false }).eq('id', body.staffId)
      if (error) return loi(/loai_khoi_luong_ctv/.test(error.message) ? 'Chưa chạy sql/52_luong_ctv_loai.sql' : error.message, 500)
      return Response.json({ ok: true })
    }

    if (viec === 'tra_giu_lai') {
      if (daChot) return loi('Tháng này đã chốt — mở chốt rồi mới ghi trả giữ lại', 409)
      const staffId = body.staffId
      const soTien = Math.round(Number(body.so_tien) || 0)
      if (!staffId || soTien < 0) return loi('Thiếu người / số tiền')
      const so = (await soGiuLai(supabase, nt.nam, nt.thang)).get(staffId)
      const conGiu = so?.truoc || 0
      if (soTien > conGiu) return loi('Số trả lớn hơn số đang giữ (' + conGiu.toLocaleString('vi-VN') + 'đ, tính tới hết tháng trước)')
      if (soTien === 0) {
        const { error } = await supabase.from('luong_ctv_giu_lai').delete().eq('staff_id', staffId).eq('nam', nt.nam).eq('thang', nt.thang).eq('loai', 'tra')
        return error ? loi(error.message, 500) : Response.json({ ok: true })
      }
      const { error } = await supabase.from('luong_ctv_giu_lai').upsert({
        staff_id: staffId, nam: nt.nam, thang: nt.thang, loai: 'tra', so_tien: soTien,
        ghi_chu: String(body.ghi_chu || '').trim().slice(0, 300) || null, tao_boi: caller.staffId, tao_luc: new Date().toISOString(),
      }, { onConflict: 'staff_id,nam,thang,loai' })
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }

    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
