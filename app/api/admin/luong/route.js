// Phân hệ TIỀN LƯƠNG — BƯỚC 1: cấp bậc, lương từng nhân viên, ngày lễ, chấm công (sql/31).
// Bước 2 (thưởng) ở ./thuong, bước 3 (chốt) ở ./chot. Tổng quan: lib/luong/README.md.
//
//   GET  ?viec=quyen                         → quyền của người gọi trong phân hệ
//   GET  ?viec=cap_bac                       → bảng cấp bậc                      (view/manage_payroll)
//   GET  ?viec=luong_nv                      → lương hiện hành + lịch sử từng NV (view/manage_payroll)
//   GET  ?viec=ngay_le&nam=                  → ngày lễ của năm                   (mọi người đăng nhập)
//   GET  ?viec=cua_toi&nam=&thang=           → bảng công của chính mình + ngày công chuẩn
//   GET  ?viec=phong&nam=&thang=             → bảng công các nhân viên trong phạm vi (TP: phòng mình làm trưởng)
//   POST {viec:'luu_cap_bac', ds:[…]}                           (manage_payroll)
//   POST {viec:'luu_luong_nv', staffId, thang:'YYYY-MM', …}     (manage_payroll)
//   POST {viec:'them_ngay_le', ngay, den?, ten} | {viec:'xoa_ngay_le', ngays}   (manage_payroll)
//   POST {viec:'luu_cong', nam, thang, ngay_di_lam, nghi_phep, nghi_khong_luong, ghi_chu, xacNhan}
//   POST {viec:'sua_cong', id, ngay_di_lam, nghi_phep, nghi_khong_luong, ghi_chu, ly_do}   (TP của phòng / quản trị)
//
// Lương là dữ liệu nhạy cảm: nhân viên CHỈ thấy công của chính mình, trưởng phòng thấy CÔNG (không
// thấy lương) của phòng mình làm trưởng, chỉ người có view_payroll / manage_payroll thấy lương.
import { requireLogin } from '@/lib/serverAuth'
import { roomsWithRole } from '@/lib/roleUnion'
import { getAdmin, loi, pad, quyenCua, ngayLeCuaThang, namThang, soTien, tienHopLe } from '@/lib/luong/api'
import { ngayCongChuan, kiemChamCong, thangDuocKhai, soNgayHopLe } from '@/lib/luong/ngayCong'

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return loi(auth.error, auth.status)
  const supabase = getAdmin()
  const caller = auth.caller
  const q = new URL(request.url).searchParams
  const viec = q.get('viec')

  try {
    const quyen = await quyenCua(supabase, caller)
    if (viec === 'quyen') {
      return Response.json({ ...quyen, phongTruong: roomsWithRole(caller, ['leader']), thangDuocKhai: thangDuocKhai() })
    }

    if (viec === 'ngay_le') {
      const nam = Number(q.get('nam'))
      const { data, error } = await supabase.from('luong_ngay_le').select('ngay, ten')
        .gte('ngay', nam + '-01-01').lte('ngay', nam + '-12-31').order('ngay')
      if (error) return loi('Chưa chạy sql/31_tien_luong.sql (' + error.message + ')', 500)
      return Response.json({ data })
    }

    if (viec === 'cap_bac') {
      if (!quyen.view) return loi('Không đủ quyền xem cấp bậc', 403)
      const { data, error } = await supabase.from('luong_cap_bac').select('*').order('thu_tu')
      if (error) return loi('Chưa chạy sql/31_tien_luong.sql (' + error.message + ')', 500)
      return Response.json({ data })
    }

    if (viec === 'luong_nv') {
      if (!quyen.view) return loi('Không đủ quyền xem lương', 403)
      const { data, error } = await supabase.from('luong_nhan_vien').select('*').order('ap_dung_tu', { ascending: false }).limit(5000)
      if (error) return loi('Chưa chạy sql/31_tien_luong.sql (' + error.message + ')', 500)
      return Response.json({ data })
    }

    const nt = namThang(q.get('nam'), q.get('thang'))
    if (!nt) return loi('Tháng không hợp lệ')
    const le = await ngayLeCuaThang(supabase, nt.nam, nt.thang)
    const cc = ngayCongChuan(nt.nam, nt.thang, le.map(x => x.ngay))

    if (viec === 'cua_toi') {
      if (!quyen.cham_cong) return loi('Chưa được cấp quyền chấm công', 403)
      const { data } = await supabase.from('luong_cham_cong').select('*')
        .eq('staff_id', caller.staffId).eq('nam', nt.nam).eq('thang', nt.thang).maybeSingle()
      const duocKhai = thangDuocKhai().some(t => t.nam === nt.nam && t.thang === nt.thang)
      return Response.json({ data: data || null, ngayCong: cc, ngayLe: le, duocKhai })
    }

    if (viec === 'phong') {
      // Phạm vi: quản trị / view_payroll → mọi nhân viên; trưởng phòng → nhân viên phòng mình LÀM TRƯỞNG.
      const phongTruong = roomsWithRole(caller, ['leader'])
      if (!quyen.view && !phongTruong.length) return loi('Không đủ quyền xem chấm công của phòng', 403)
      let qs = supabase.from('staff').select('id, full_name, room_id, role, rooms(name)').eq('is_active', true).order('full_name')
      if (!quyen.view) qs = qs.in('room_id', phongTruong)
      const { data: ds, error } = await qs
      if (error) return loi(error.message, 500)
      const ids = (ds || []).map(s => s.id)
      const { data: cong } = ids.length
        ? await supabase.from('luong_cham_cong').select('*').eq('nam', nt.nam).eq('thang', nt.thang).in('staff_id', ids)
        : { data: [] }
      const map = new Map((cong || []).map(c => [c.staff_id, c]))
      return Response.json({
        ngayCong: cc, ngayLe: le,
        data: (ds || []).map(s => ({
          staff_id: s.id, full_name: s.full_name, room_id: s.room_id, phong: s.rooms?.name || '',
          truongPhong: ['leader', 'hcns_leader', 'sales_leader'].includes(s.role),
          duocSua: quyen.admin || phongTruong.includes(s.room_id),
          cong: map.get(s.id) || null,
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

    // ── Thiết lập (manage_payroll) ────────────────────────────────────────
    if (viec === 'luu_cap_bac') {
      if (!quyen.manage) return loi('Không đủ quyền thiết lập cấp bậc', 403)
      const ds = Array.isArray(body.ds) ? body.ds : []
      if (!ds.length || ds.length > 50) return loi('Danh sách cấp bậc không hợp lệ')
      const rows = []
      for (const r of ds) {
        const v = { lcb: soTien(r.luong_co_ban), dt: soTien(r.doanh_thu_toi_thieu), bh: soTien(r.luong_bhxh) }
        if (!/^CAP_[A-Z0-9]{1,3}$/.test(String(r.ma)) || !String(r.ten || '').trim() || v.lcb === null || !tienHopLe(v.lcb) || !tienHopLe(v.dt) || !tienHopLe(v.bh)) {
          return loi('Dòng cấp bậc không hợp lệ: ' + (r.ten || r.ma))
        }
        rows.push({
          ma: r.ma, ten: String(r.ten).trim(), nhom: r.nhom === 'truong_phong' ? 'truong_phong' : 'nhan_vien',
          thu_tu: Number(r.thu_tu) || 0, luong_co_ban: v.lcb, doanh_thu_toi_thieu: v.dt, luong_bhxh: v.bh,
          mo_ta: r.mo_ta ? String(r.mo_ta).slice(0, 200) : null, updated_at: new Date().toISOString(),
        })
      }
      const { error } = await supabase.from('luong_cap_bac').upsert(rows, { onConflict: 'ma' })
      if (error) return loi(error.message, 500)
      return Response.json({ ok: true })
    }

    if (viec === 'luu_luong_nv') {
      if (!quyen.manage) return loi('Không đủ quyền đặt lương', 403)
      const m = /^(\d{4})-(\d{2})$/.exec(String(body.thang || ''))
      if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return loi('Tháng áp dụng không hợp lệ')
      const lcb = soTien(body.luong_co_ban), dt = soTien(body.doanh_thu_toi_thieu), bh = soTien(body.luong_bhxh)
      if (lcb === null || !tienHopLe(lcb) || !tienHopLe(dt) || !tienHopLe(bh)) return loi('Số tiền không hợp lệ')
      const thamGia = !!body.tham_gia_bhxh
      if (thamGia && !bh) return loi('Đã tick tham gia BHXH thì phải có lương đóng BHXH')
      const { data: st } = await supabase.from('staff').select('id').eq('id', body.staffId).maybeSingle()
      if (!st) return loi('Không tìm thấy nhân viên')
      if (body.cap_bac) {
        const { data: cb } = await supabase.from('luong_cap_bac').select('ma').eq('ma', body.cap_bac).maybeSingle()
        if (!cb) return loi('Cấp bậc không tồn tại')
      }
      const { error } = await supabase.from('luong_nhan_vien').upsert({
        staff_id: body.staffId, ap_dung_tu: m[1] + '-' + m[2] + '-01', cap_bac: body.cap_bac || null,
        luong_co_ban: lcb, doanh_thu_toi_thieu: dt, luong_bhxh: bh, tham_gia_bhxh: thamGia,
        ghi_chu: body.ghi_chu ? String(body.ghi_chu).slice(0, 300) : null,
        tao_boi: caller.staffId, tao_luc: new Date().toISOString(),
      }, { onConflict: 'staff_id,ap_dung_tu' })
      if (error) return loi(error.message, 500)
      return Response.json({ ok: true })
    }

    if (viec === 'them_ngay_le' || viec === 'xoa_ngay_le') {
      if (!quyen.manage) return loi('Không đủ quyền sửa ngày lễ', 403)
      const laNgay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
      if (viec === 'xoa_ngay_le') {
        // Xoá một ngày, hoặc cả đợt nghỉ nhiều ngày (danh sách `ngays`).
        const ds = Array.isArray(body.ngays) ? body.ngays : [body.ngay]
        if (!ds.length || ds.length > 31 || !ds.every(laNgay)) return loi('Ngày không hợp lệ')
        const { error } = await supabase.from('luong_ngay_le').delete().in('ngay', ds)
        return error ? loi(error.message, 500) : Response.json({ ok: true })
      }
      if (!laNgay(body.ngay)) return loi('Ngày không hợp lệ')
      if (!String(body.ten || '').trim()) return loi('Thiếu tên ngày lễ')
      // Đợt nghỉ NHIỀU NGÀY (vd Tết): từ `ngay` tới `den`, ghi từng ngày. Chủ nhật vẫn ghi để hiện đủ đợt
      // nghỉ — tính công chuẩn đã tự bỏ qua lễ rơi vào chủ nhật nên không trừ hai lần.
      const den = body.den && laNgay(body.den) ? body.den : body.ngay
      if (den < body.ngay) return loi('Ngày kết thúc phải sau ngày bắt đầu')
      const rows = []
      for (let t = new Date(body.ngay + 'T00:00:00Z'); t <= new Date(den + 'T00:00:00Z'); t = new Date(t.getTime() + 86400000)) {
        rows.push({ ngay: t.toISOString().slice(0, 10), ten: String(body.ten).trim().slice(0, 100) })
      }
      if (rows.length > 31) return loi('Một đợt nghỉ tối đa 31 ngày')
      const { error } = await supabase.from('luong_ngay_le').upsert(rows, { onConflict: 'ngay' })
      return error ? loi(error.message, 500) : Response.json({ ok: true, soNgay: rows.length })
    }

    // ── Nhân viên tự khai công của MÌNH ──────────────────────────────────
    if (viec === 'luu_cong') {
      if (!quyen.cham_cong) return loi('Chưa được cấp quyền chấm công', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Tháng không hợp lệ')
      if (!thangDuocKhai().some(t => t.nam === nt.nam && t.thang === nt.thang)) {
        return loi('Chỉ tự khai được tháng này và tháng trước. Tháng khác nhờ trưởng phòng cập nhật.', 403)
      }
      const { data: cu } = await supabase.from('luong_cham_cong').select('*')
        .eq('staff_id', caller.staffId).eq('nam', nt.nam).eq('thang', nt.thang).maybeSingle()
      if (cu?.trang_thai === 'da_xac_nhan') return loi('Bảng công tháng này đã xác nhận và khoá. Sai sót thì liên hệ trưởng phòng để kiểm tra và cập nhật.', 409)
      const le = await ngayLeCuaThang(supabase, nt.nam, nt.thang)
      const chuan = ngayCongChuan(nt.nam, nt.thang, le.map(x => x.ngay)).chuan
      const vao = {
        ngay_di_lam: Number(body.ngay_di_lam), nghi_phep: Number(body.nghi_phep), nghi_khong_luong: Number(body.nghi_khong_luong),
        so_lan_vi_pham: Math.max(0, Math.min(50, Math.round(Number(body.so_lan_vi_pham) || 0))),
        ghi_chu: String(body.ghi_chu || '').trim().slice(0, 300) || null,
      }
      const kq = kiemChamCong(vao, chuan, { xacNhan: !!body.xacNhan })
      if (kq.loi) return loi(kq.loi)
      const nay = new Date().toISOString()
      const dong = {
        staff_id: caller.staffId, nam: nt.nam, thang: nt.thang, ...vao, updated_at: nay,
        ...(body.xacNhan ? { trang_thai: 'da_xac_nhan', xac_nhan_luc: nay, ngay_cong_chuan: chuan } : { trang_thai: 'nhap' }),
      }
      // Chốt chống ghi đè khi hai tab cùng bấm: chỉ cập nhật dòng còn ở trạng thái nháp.
      let ghi
      if (cu) ghi = await supabase.from('luong_cham_cong').update(dong).eq('id', cu.id).eq('trang_thai', 'nhap').select('*').maybeSingle()
      else ghi = await supabase.from('luong_cham_cong').insert(dong).select('*').maybeSingle()
      if (ghi.error) return loi(ghi.error.message, 500)
      if (!ghi.data) return loi('Bảng công vừa được xác nhận ở nơi khác — tải lại trang.', 409)
      if (body.xacNhan) {
        await supabase.from('luong_cham_cong_log').insert({
          cham_cong_id: ghi.data.id, staff_id: caller.staffId, hanh_dong: 'xac_nhan',
          sau: { ngay_di_lam: vao.ngay_di_lam, nghi_phep: vao.nghi_phep, nghi_khong_luong: vao.nghi_khong_luong, so_lan_vi_pham: vao.so_lan_vi_pham, ngay_cong_chuan: chuan },
          boi: caller.staffId,
        })
      }
      return Response.json({ ok: true, data: ghi.data, canhBao: kq.canhBao })
    }

    // ── Trưởng phòng / quản trị sửa công đã khoá ──────────────────────────
    if (viec === 'sua_cong') {
      const { data: cu } = await supabase.from('luong_cham_cong').select('*').eq('id', body.id).maybeSingle()
      if (!cu) return loi('Không tìm thấy bảng công')
      const { data: nv } = await supabase.from('staff').select('room_id').eq('id', cu.staff_id).maybeSingle()
      const duoc = quyen.admin || roomsWithRole(caller, ['leader']).includes(nv?.room_id)
      if (!duoc) return loi('Chỉ trưởng phòng của nhân viên này hoặc quản trị được sửa', 403)
      if (cu.staff_id === caller.staffId && !quyen.admin) return loi('Không tự sửa bảng công của chính mình — nhờ quản trị', 403)
      const lyDo = String(body.ly_do || '').trim()
      if (lyDo.length < 5) return loi('Ghi lý do sửa (ít nhất 5 ký tự)')
      const le = await ngayLeCuaThang(supabase, cu.nam, cu.thang)
      const chuan = ngayCongChuan(cu.nam, cu.thang, le.map(x => x.ngay)).chuan
      const vao = {
        ngay_di_lam: Number(body.ngay_di_lam), nghi_phep: Number(body.nghi_phep), nghi_khong_luong: Number(body.nghi_khong_luong),
        so_lan_vi_pham: Math.max(0, Math.min(50, Math.round(Number(body.so_lan_vi_pham) || 0))),
        ghi_chu: String(body.ghi_chu ?? cu.ghi_chu ?? '').trim().slice(0, 300) || null,
      }
      if (![vao.ngay_di_lam, vao.nghi_phep, vao.nghi_khong_luong].every(soNgayHopLe)) return loi('Số ngày không hợp lệ')
      const kq = kiemChamCong(vao, chuan)
      if (kq.loi) return loi(kq.loi)
      const { data, error } = await supabase.from('luong_cham_cong').update({
        ...vao, ngay_cong_chuan: chuan, trang_thai: 'da_xac_nhan', xac_nhan_luc: cu.xac_nhan_luc || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', cu.id).select('*').maybeSingle()
      if (error) return loi(error.message, 500)
      await supabase.from('luong_cham_cong_log').insert({
        cham_cong_id: cu.id, staff_id: cu.staff_id, hanh_dong: 'sua', ly_do: lyDo.slice(0, 300), boi: caller.staffId,
        truoc: { ngay_di_lam: cu.ngay_di_lam, nghi_phep: cu.nghi_phep, nghi_khong_luong: cu.nghi_khong_luong, so_lan_vi_pham: cu.so_lan_vi_pham, ghi_chu: cu.ghi_chu },
        sau: { ngay_di_lam: vao.ngay_di_lam, nghi_phep: vao.nghi_phep, nghi_khong_luong: vao.nghi_khong_luong, so_lan_vi_pham: vao.so_lan_vi_pham, ghi_chu: vao.ghi_chu },
      })
      return Response.json({ ok: true, data })
    }

    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
