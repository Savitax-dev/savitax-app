// Phân hệ TIỀN LƯƠNG — BƯỚC 2: thưởng Dịch vụ khác (sql/32) + bảng lương tính từ dữ liệu thật.
// Tổng quan: lib/luong/README.md.
//
//   GET  ?viec=bang_luong&nam=&thang=   → bảng lương (tháng đã CHỐT thì trả bản chụp — bước 3)   (view_payroll)
//   GET  ?viec=dvk_cua_toi&nam=&thang=  → dòng khai thưởng DVK của chính mình + hồ sơ được khai
//   GET  ?viec=dvk_duyet&nam=&thang=    → dòng khai trong phạm vi duyệt (TP: phòng mình làm trưởng)
//   POST {viec:'dvk_them', nam, thang, service_id | ngoai_app+ten_ngoai, so_tien, ty_le, ghi_chu}
//   POST {viec:'dvk_xoa', id}  ·  POST {viec:'dvk_duyet', id, dong_y, ly_do}
import { requireLogin } from '@/lib/serverAuth'
import { roomsWithRole } from '@/lib/roleUnion'
import { getAdmin, loi, pad, quyenCua, ngayLeCuaThang, namThang, soTien, tienHopLe } from '@/lib/luong/api'
import { thangDuocKhai } from '@/lib/luong/ngayCong'
import { tienThuongDvk } from '@/lib/luong/thuong'
import { tinhBangLuong } from '@/lib/luong/bangLuong'
import { docBanChot } from '@/lib/luong/chot'
import { mapPhongCuaCongTy } from '@/lib/clientRoom'

// Bảng lương tính KPI hai tháng + doanh thu từ dữ liệu thật — mất vài giây.
export const maxDuration = 60

// ── Thưởng Dịch vụ khác (sql/32) ─────────────────────────────────────────────
// Hồ sơ DVK nhân viên được chọn để khai: hồ sơ ĐÃ CÓ THU của công ty mình phụ trách chính / phụ, hoặc
// công ty thuộc phòng mình (nhiều người cùng làm một dự án). Quản trị chọn được mọi hồ sơ.
async function hoSoDvkChonDuoc(supabase, caller, quyen) {
  const { data: tt, error } = await supabase.from('other_service_payments').select('service_id, amount').limit(10000)
  if (error) throw new Error('Chưa có bảng Dịch vụ khác (sql/24): ' + error.message)
  const daThu = new Map()
  for (const r of tt || []) daThu.set(r.service_id, (daThu.get(r.service_id) || 0) + (Number(r.amount) || 0))
  const ids = [...daThu.keys()]
  if (!ids.length) return []
  const dv = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('other_services').select('id, client_id, name, amount, year, month, status').in('id', ids.slice(i, i + 200))
    dv.push(...(data || []))
  }
  const ctyIds = [...new Set(dv.map(d => d.client_id))]
  const cty = []
  for (let i = 0; i < ctyIds.length; i += 200) {
    const { data } = await supabase.from('clients').select('id, name, client_code, assigned_to, room_id').in('id', ctyIds.slice(i, i + 200))
    cty.push(...(data || []))
  }
  const ctyMap = new Map(cty.map(c => [c.id, c]))
  let duoc = () => true
  if (!quyen.admin) {
    const { data: sec } = await supabase.from('client_secondary_staff').select('client_id').eq('staff_id', caller.staffId)
    const phu = new Set((sec || []).map(x => x.client_id))
    const phongCua = await mapPhongCuaCongTy(supabase, cty)
    const phongToi = new Set(caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean))
    duoc = c => c && (c.assigned_to === caller.staffId || phu.has(c.id) || phongToi.has(phongCua.get(c.id)))
  }
  const { data: khai } = await supabase.from('luong_dvk_khai').select('service_id, so_tien, trang_thai').neq('trang_thai', 'tra_lai')
  const daKhai = new Map()
  for (const k of khai || []) daKhai.set(k.service_id, (daKhai.get(k.service_id) || 0) + (Number(k.so_tien) || 0))
  return dv.filter(d => duoc(ctyMap.get(d.client_id))).map(d => ({
    id: d.id, ten: d.name, client_id: d.client_id, cty: ctyMap.get(d.client_id)?.name || '', ma: ctyMap.get(d.client_id)?.client_code || '',
    ky: d.month + '/' + d.year, phaiThu: Number(d.amount) || 0, daThu: daThu.get(d.id) || 0, daKhai: daKhai.get(d.id) || 0,
  })).sort((a, b) => a.cty.localeCompare(b.cty, 'vi'))
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const caller = auth.caller
  const q = new URL(request.url).searchParams
  const viec = q.get('viec')

  try {
    const quyen = await quyenCua(supabase, caller)
    const nt = namThang(q.get('nam'), q.get('thang'))
    if (!nt) return loi('Tháng không hợp lệ')

    if (viec === 'bang_luong') {
      if (!quyen.view) return loi('Không đủ quyền xem bảng lương', 403)
      // Tháng đã CHỐT thì trả bản chụp (sql/33). Chưa có bảng (chưa chạy SQL) thì coi như chưa chốt.
      const chot = await docBanChot(supabase, nt.nam, nt.thang)
      if (chot && !chot.da_mo) {
        // Đã gửi phiếu thì kèm trạng thái xác nhận từng người (sql/34).
        const { data: px } = await supabase.from('luong_phieu_xac_nhan').select('staff_id, trang_thai, ghi_chu, luc').eq('nam', nt.nam).eq('thang', nt.thang)
        const pxMap = new Map((px || []).map(x => [x.staff_id, x]))
        const dong = (chot.du_lieu.dong || []).map(x => ({ ...x, phieu: pxMap.get(x.staff_id) || null }))
        return Response.json({ ...chot.du_lieu, dong, daChot: { luc: chot.chot_luc, boi: chot.staff?.full_name || '', daGui: !!chot.da_gui, guiLuc: chot.gui_luc || null }, duocChot: quyen.manage })
      }
      const kq = await tinhBangLuong(supabase, nt.nam, nt.thang)
      return Response.json({ ...kq, daChot: null, daMoChot: chot?.da_mo ? { luc: chot.mo_luc, lyDo: chot.ly_do_mo } : null, duocChot: quyen.manage })
    }

    if (viec === 'dvk_cua_toi') {
      if (!quyen.cham_cong) return loi('Chưa được cấp quyền', 403)
      const { data, error } = await supabase.from('luong_dvk_khai').select('*')
        .eq('staff_id', caller.staffId).eq('nam', nt.nam).eq('thang', nt.thang).order('tao_luc')
      if (error) return loi('Chưa chạy sql/32_luong_thuong_dvk.sql (' + error.message + ')', 500)
      return Response.json({ data, hoSo: await hoSoDvkChonDuoc(supabase, caller, quyen) })
    }

    if (viec === 'dvk_duyet') {
      // Trưởng phòng: dòng khai của nhân viên phòng mình LÀM TRƯỞNG. Quản trị: tất cả.
      const phongTruong = roomsWithRole(caller, ['leader'])
      if (!quyen.admin && !phongTruong.length && !quyen.view) return loi('Không đủ quyền', 403)
      const { data: ds, error } = await supabase.from('luong_dvk_khai').select('*, staff:staff_id(full_name, room_id, rooms(name))')
        .eq('nam', nt.nam).eq('thang', nt.thang).order('tao_luc')
      if (error) return loi('Chưa chạy sql/32_luong_thuong_dvk.sql (' + error.message + ')', 500)
      const hoSo = new Map((await hoSoDvkChonDuoc(supabase, caller, { admin: true })).map(h => [h.id, h]))
      return Response.json({
        data: (ds || []).filter(d => quyen.admin || quyen.view || phongTruong.includes(d.staff?.room_id)).map(d => ({
          ...d, ten_nv: d.staff?.full_name || '', phong: d.staff?.rooms?.name || '',
          duocDuyet: (quyen.admin || phongTruong.includes(d.staff?.room_id)) && d.staff_id !== caller.staffId,
          daThuHoSo: hoSo.get(d.service_id)?.daThu ?? null, daKhaiHoSo: hoSo.get(d.service_id)?.daKhai ?? null,
        })),
      })
    }

    return loi('Không hiểu yêu cầu')
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

  try {
    const quyen = await quyenCua(supabase, caller)

    // ── Khai thưởng Dịch vụ khác ─────────────────────────────────────────
    if (viec === 'dvk_them') {
      if (!quyen.cham_cong) return loi('Chưa được cấp quyền', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Kỳ lương không hợp lệ')
      const soTien = Number(body.so_tien), tyLe = Number(body.ty_le)
      if (!(soTien > 0 && soTien < 1e10)) return loi('Số tiền thực nhận phải lớn hơn 0')
      if (!(tyLe > 0 && tyLe <= 100)) return loi('Tỉ lệ % phải trong khoảng 0–100')
      const ghiChu = String(body.ghi_chu || '').trim()
      // Dịch vụ CHƯA CÓ TRÊN APP (anh cho phép 18/10/2026): không chọn hồ sơ, tự gõ tên + BẮT BUỘC ghi chú
      // để trưởng phòng biết mà kiểm. Không đối chiếu được với số đã thu nên trang duyệt gắn nhãn riêng.
      if (body.ngoai_app) {
        const ten = String(body.ten_ngoai || '').trim()
        if (ten.length < 3) return loi('Ghi tên dịch vụ (và công ty) chưa có trên app')
        if (ghiChu.length < 5) return loi('Dịch vụ chưa có trên app thì bắt buộc ghi chú (vd: lý do chưa nhập app, đã thu ngày nào)')
        const { data, error } = await supabase.from('luong_dvk_khai').insert({
          staff_id: caller.staffId, nam: nt.nam, thang: nt.thang, service_id: null, client_id: null,
          ten_dv: ('[Ngoài app] ' + ten).slice(0, 300), so_tien: soTien, ty_le: tyLe, tien_thuong: tienThuongDvk(soTien, tyLe),
          ghi_chu: ghiChu.slice(0, 300),
        }).select('*').maybeSingle()
        if (error) return loi(error.message, 500)
        return Response.json({ ok: true, data, canhBao: ['Dịch vụ chưa có trên app — trưởng phòng sẽ kiểm theo ghi chú.'] })
      }
      const hoSo = (await hoSoDvkChonDuoc(supabase, caller, quyen)).find(h => h.id === body.service_id)
      if (!hoSo) return loi('Hồ sơ Dịch vụ khác này không nằm trong danh sách anh/chị được khai (chưa có thu, hoặc không thuộc công ty / phòng mình)', 403)
      const { data, error } = await supabase.from('luong_dvk_khai').insert({
        staff_id: caller.staffId, nam: nt.nam, thang: nt.thang, service_id: hoSo.id, client_id: hoSo.client_id,
        ten_dv: (hoSo.ten + ' · ' + hoSo.cty).slice(0, 300), so_tien: soTien, ty_le: tyLe, tien_thuong: tienThuongDvk(soTien, tyLe),
        ghi_chu: String(body.ghi_chu || '').trim().slice(0, 300) || null,
      }).select('*').maybeSingle()
      if (error) return loi(error.message, 500)
      const canhBao = []
      if (hoSo.daKhai + soTien > hoSo.daThu) canhBao.push('Tổng số tiền mọi người khai cho hồ sơ này (' + (hoSo.daKhai + soTien).toLocaleString('vi-VN') + 'đ) đang VƯỢT số đã thu trên app (' + hoSo.daThu.toLocaleString('vi-VN') + 'đ) — trưởng phòng sẽ thấy cảnh báo này khi duyệt.')
      return Response.json({ ok: true, data, canhBao })
    }

    if (viec === 'dvk_xoa') {
      const { data: d } = await supabase.from('luong_dvk_khai').select('id, staff_id, trang_thai').eq('id', body.id).maybeSingle()
      if (!d || d.staff_id !== caller.staffId) return loi('Không tìm thấy dòng khai của anh/chị', 404)
      if (d.trang_thai === 'da_duyet') return loi('Dòng đã duyệt không xoá được — nhờ trưởng phòng trả lại trước', 409)
      const { error } = await supabase.from('luong_dvk_khai').delete().eq('id', d.id).neq('trang_thai', 'da_duyet')
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }

    if (viec === 'dvk_duyet') {
      const { data: d } = await supabase.from('luong_dvk_khai').select('id, staff_id, trang_thai, staff:staff_id(room_id)').eq('id', body.id).maybeSingle()
      if (!d) return loi('Không tìm thấy dòng khai', 404)
      const duoc = quyen.admin || roomsWithRole(caller, ['leader']).includes(d.staff?.room_id)
      if (!duoc) return loi('Chỉ trưởng phòng của nhân viên này hoặc quản trị được duyệt', 403)
      if (d.staff_id === caller.staffId && !quyen.admin) return loi('Không tự duyệt dòng khai của chính mình', 403)
      const dongY = body.dong_y === true
      const lyDo = String(body.ly_do || '').trim()
      if (!dongY && lyDo.length < 3) return loi('Ghi lý do trả lại')
      const { error } = await supabase.from('luong_dvk_khai').update({
        trang_thai: dongY ? 'da_duyet' : 'tra_lai', ly_do_tra: dongY ? null : lyDo.slice(0, 300),
        duyet_boi: caller.staffId, duyet_luc: new Date().toISOString(),
      }).eq('id', d.id)
      return error ? loi(error.message, 500) : Response.json({ ok: true })
    }

    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
