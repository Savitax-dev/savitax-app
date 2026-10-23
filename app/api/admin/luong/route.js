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
//   POST {viec:'luu_luong_nv', staffId, thang:'YYYY-MM', …, so_nguoi_phu_thuoc}   (manage_payroll)
//   POST {viec:'luu_ngan_hang', staffId, ngan_hang, so_tai_khoan, chu_tai_khoan}  (manage_payroll)
//   POST {viec:'them_ngay_le', ngay, den?, ten} | {viec:'xoa_ngay_le', ngays}   (manage_payroll)
//   POST {viec:'luu_cong', nam, thang, ngay_di_lam, nghi_phep, nghi_khong_luong, ghi_chu, xacNhan}
//   POST {viec:'sua_cong', id, ngay_di_lam, nghi_phep, nghi_khong_luong, ghi_chu, ly_do}   (TP của phòng / quản trị)
//
// Lương là dữ liệu nhạy cảm: nhân viên CHỈ thấy công của chính mình, trưởng phòng thấy CÔNG (không
// thấy lương) của phòng mình làm trưởng, chỉ người có view_payroll / manage_payroll thấy lương.
import { requireLogin } from '@/lib/serverAuth'
import { roomsWithRole } from '@/lib/roleUnion'
import { getAdmin, loi, pad, quyenCua, ngayLeCuaThang, namThang, soTien, tienHopLe } from '@/lib/luong/api'
import { ngayCongChuan, kiemChamCong, thangDuocKhai, soNgayHopLe, soNgayMayHopLe, luongCuaThang } from '@/lib/luong/ngayCong'
import { quyDoiMay, soThuBayLamViec, khoaTen } from '@/lib/luong/mayChamCong'

// Phòng remote KHÔNG tính lương trên app (anh chốt 23/10/2026): không chấm công, không bảng lương.
const laRemote = s => s?.rooms?.type === 'remote'
const MA_NV_HOP_LE = /^[\p{L}\p{N}._\-/]{1,20}$/u
// Lịch sử lương — lật trang có .order('id') (PostgREST cắt im lặng ở 1000 dòng).
async function docHetLuong(supabase) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('luong_nhan_vien').select('id, staff_id, ap_dung_tu, cap_bac').order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
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
      // Tài khoản nhận lương (sql/35) — chưa chạy SQL thì trả rỗng.
      let nh = await supabase.from('luong_ngan_hang').select('staff_id, ngan_hang, so_tai_khoan, chu_tai_khoan, ma_ngan_hang').limit(5000)
      if (nh.error) nh = await supabase.from('luong_ngan_hang').select('staff_id, ngan_hang, so_tai_khoan, chu_tai_khoan').limit(5000)   // chưa chạy sql/36
      // Mã nhân viên, ngày vào làm, chấm công bằng máy (sql/38) — chưa chạy SQL thì trả rỗng.
      const hs = await supabase.from('staff').select('id, ma_nhan_vien, ngay_vao_lam, cham_cong_may').limit(5000)
      return Response.json({ data, nganHang: nh.error ? [] : nh.data || [], hoSo: hs.error ? [] : hs.data || [] })
    }

    // Báo cáo THÂM NIÊN (trang Báo cáo KPI) — có cấp bậc (lộ mức lương) nên chỉ view_payroll. Trừ phòng remote.
    if (viec === 'tham_nien') {
      if (!quyen.view) return loi('Chỉ người có quyền xem lương được xem báo cáo thâm niên', 403)
      const [{ data: st, error }, { data: cap }, ls] = await Promise.all([
        supabase.from('staff').select('id, full_name, role, ma_nhan_vien, ngay_vao_lam, rooms(name, type)').eq('is_active', true),
        supabase.from('luong_cap_bac').select('ma, ten, nhom, thu_tu, mo_ta').order('thu_tu'),
        docHetLuong(supabase),
      ])
      if (error) return loi(/ma_nhan_vien|ngay_vao_lam/.test(error.message) ? 'Chưa chạy sql/38_luong_ma_nv_may_cham_cong.sql' : error.message, 500)
      const vn = new Date(Date.now() + 7 * 3600e3)
      return Response.json({
        homNay: vn.toISOString().slice(0, 10), capBac: cap || [],
        nhanVien: (st || []).filter(s => !laRemote(s)).map(s => {
          const l = luongCuaThang(ls.filter(x => x.staff_id === s.id), vn.getUTCFullYear(), vn.getUTCMonth() + 1)
          return { id: s.id, ten: s.full_name, ma: s.ma_nhan_vien, phong: s.rooms?.name || '', laTruongPhong: s.role === 'leader',
            ngayVao: s.ngay_vao_lam, capHienTai: l?.cap_bac || null }
        }),
      })
    }

    // Dữ liệu dựng file mẫu "Hồ sơ lương nhân viên" (lib/luong/fileHoSoLuong.js) — trừ phòng remote.
    if (viec === 'ho_so_mau') {
      if (!quyen.manage) return loi('Không đủ quyền', 403)
      const [{ data: st, error }, { data: cap }, { data: ls }, nh] = await Promise.all([
        supabase.from('staff').select('id, full_name, email, role, ma_nhan_vien, ngay_vao_lam, cham_cong_may, rooms(name, type)').eq('is_active', true),
        supabase.from('luong_cap_bac').select('*').order('thu_tu'),
        supabase.from('luong_nhan_vien').select('*').limit(5000),
        supabase.from('luong_ngan_hang').select('*').limit(5000),
      ])
      if (error) return loi(/ma_nhan_vien|ngay_vao_lam|cham_cong_may/.test(error.message) ? 'Chưa chạy sql/38_luong_ma_nv_may_cham_cong.sql' : error.message, 500)
      const vn = new Date(Date.now() + 7 * 3600e3)
      const nhanVien = (st || []).filter(s => !laRemote(s)).map(s => ({
        id: s.id, full_name: s.full_name, email: s.email, role: s.role, phong: s.rooms?.name || '',
        ma_nhan_vien: s.ma_nhan_vien, ngay_vao_lam: s.ngay_vao_lam, cham_cong_may: s.cham_cong_may,
        luong: luongCuaThang((ls || []).filter(l => l.staff_id === s.id), vn.getUTCFullYear(), vn.getUTCMonth() + 1),
        nganHang: (nh.data || []).find(b => b.staff_id === s.id) || null,
      })).sort((a, b) => (a.phong ? 0 : 1) - (b.phong ? 0 : 1) || a.phong.localeCompare(b.phong, 'vi')
        || (b.role === 'leader') - (a.role === 'leader') || a.full_name.localeCompare(b.full_name, 'vi'))
      return Response.json({ nhanVien, capBac: cap || [], tuThang: pad(vn.getUTCMonth() + 1) + '/' + vn.getUTCFullYear() })
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
      const { data: toi } = await supabase.from('staff').select('rooms(type)').eq('id', caller.staffId).maybeSingle()
      return Response.json({ data: data || null, ngayCong: cc, ngayLe: le, duocKhai, khongTinhLuong: laRemote(toi) })
    }

    if (viec === 'phong') {
      // Phạm vi: quản trị / view_payroll → mọi nhân viên; trưởng phòng → nhân viên phòng mình LÀM TRƯỞNG.
      const phongTruong = roomsWithRole(caller, ['leader'])
      if (!quyen.view && !phongTruong.length) return loi('Không đủ quyền xem chấm công của phòng', 403)
      let qs = supabase.from('staff').select('id, full_name, room_id, role, rooms(name, type)').eq('is_active', true).order('full_name')
      if (!quyen.view) qs = qs.in('room_id', phongTruong)
      const { data: tatCa, error } = await qs
      if (error) return loi(error.message, 500)
      const ds = (tatCa || []).filter(s => !laRemote(s))
      const ids = ds.map(s => s.id)
      const hs = await supabase.from('staff').select('id, ma_nhan_vien, cham_cong_may').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      const hoSo = new Map((hs.error ? [] : hs.data || []).map(x => [x.id, x]))
      const { data: cong } = ids.length
        ? await supabase.from('luong_cham_cong').select('*').eq('nam', nt.nam).eq('thang', nt.thang).in('staff_id', ids)
        : { data: [] }
      const map = new Map((cong || []).map(c => [c.staff_id, c]))
      return Response.json({
        ngayCong: cc, ngayLe: le,
        nhapDuoc: quyen.manage,
        data: ds.map(s => ({
          staff_id: s.id, full_name: s.full_name, room_id: s.room_id, phong: s.rooms?.name || '',
          maNv: hoSo.get(s.id)?.ma_nhan_vien || null, chamCongMay: hoSo.get(s.id)?.cham_cong_may !== false,
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
      const npt = Number(body.so_nguoi_phu_thuoc ?? 0)
      if (!Number.isInteger(npt) || npt < 0 || npt > 20) return loi('Số người phụ thuộc không hợp lệ (0–20)')
      const { data: st } = await supabase.from('staff').select('id').eq('id', body.staffId).maybeSingle()
      if (!st) return loi('Không tìm thấy nhân viên')
      if (body.cap_bac) {
        const { data: cb } = await supabase.from('luong_cap_bac').select('ma').eq('ma', body.cap_bac).maybeSingle()
        if (!cb) return loi('Cấp bậc không tồn tại')
      }
      const dongLuong = {
        staff_id: body.staffId, ap_dung_tu: m[1] + '-' + m[2] + '-01', cap_bac: body.cap_bac || null,
        luong_co_ban: lcb, doanh_thu_toi_thieu: dt, luong_bhxh: bh, tham_gia_bhxh: thamGia,
        ghi_chu: body.ghi_chu ? String(body.ghi_chu).slice(0, 300) : null,
        tao_boi: caller.staffId, tao_luc: new Date().toISOString(), so_nguoi_phu_thuoc: npt,
      }
      // Cột người phụ thuộc có từ sql/35 — chưa chạy SQL mà không có người phụ thuộc thì vẫn lưu được lương.
      let { error } = await supabase.from('luong_nhan_vien').upsert(dongLuong, { onConflict: 'staff_id,ap_dung_tu' })
      if (error && /so_nguoi_phu_thuoc/.test(error.message)) {
        if (npt > 0) return loi('Chưa chạy sql/35_luong_thue_ngan_hang.sql — chưa lưu được người phụ thuộc', 500)
        delete dongLuong.so_nguoi_phu_thuoc
        ;({ error } = await supabase.from('luong_nhan_vien').upsert(dongLuong, { onConflict: 'staff_id,ap_dung_tu' }))
      }
      if (error) return loi(error.message, 500)
      return Response.json({ ok: true })
    }

    // Tài khoản nhận lương — mỗi người một dòng, không theo tháng (sql/35).
    if (viec === 'luu_ngan_hang') {
      if (!quyen.manage) return loi('Không đủ quyền sửa tài khoản nhận lương', 403)
      const chu = v => String(v ?? '').trim().slice(0, 120)
      const stk = String(body.so_tai_khoan ?? '').replace(/\s+/g, '')
      if (stk && !/^[0-9A-Za-z.-]{4,30}$/.test(stk)) return loi('Số tài khoản không hợp lệ')
      // Mã ngân hàng = mã SỐ trong danh mục của ngân hàng chi lương (file chuyển khoản, sql/36).
      const maNh = String(body.ma_ngan_hang ?? '').trim()
      if (maNh && !/^\d{1,10}$/.test(maNh)) return loi('Mã ngân hàng chỉ gồm chữ số (theo danh mục của ngân hàng chi lương)')
      const { data: st } = await supabase.from('staff').select('id').eq('id', body.staffId).maybeSingle()
      if (!st) return loi('Không tìm thấy nhân viên')
      const dongNh = {
        staff_id: body.staffId, ngan_hang: chu(body.ngan_hang) || null, so_tai_khoan: stk || null,
        chu_tai_khoan: chu(body.chu_tai_khoan).toUpperCase() || null, ma_ngan_hang: maNh || null,
        sua_boi: caller.staffId, sua_luc: new Date().toISOString(),
      }
      let { error } = await supabase.from('luong_ngan_hang').upsert(dongNh, { onConflict: 'staff_id' })
      if (error && /ma_ngan_hang/.test(error.message)) {
        if (maNh) return loi('Chưa chạy sql/36_luong_ma_ngan_hang.sql — chưa lưu được mã ngân hàng', 500)
        delete dongNh.ma_ngan_hang
        ;({ error } = await supabase.from('luong_ngan_hang').upsert(dongNh, { onConflict: 'staff_id' }))
      }
      if (error) return loi(/luong_ngan_hang/.test(error.message) ? 'Chưa chạy sql/35_luong_thue_ngan_hang.sql' : error.message, 500)
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
      // Số từ MÁY CHẤM CÔNG: nhân viên không sửa số — chỉ Xác nhận (dùng đúng số đã nhập) hoặc Báo sai.
      const tuMay = cu?.nguon === 'may_cham_cong'
      if (tuMay && !body.xacNhan) return loi('Số công lấy từ máy chấm công — chỉ bấm Xác nhận hoặc Báo sai, không sửa số.', 409)
      const vao = tuMay ? {
        ngay_di_lam: Number(cu.ngay_di_lam), nghi_phep: Number(cu.nghi_phep), nghi_khong_luong: Number(cu.nghi_khong_luong),
        so_lan_vi_pham: Number(cu.so_lan_vi_pham) || 0, ghi_chu: cu.ghi_chu,
      } : {
        ngay_di_lam: Number(body.ngay_di_lam), nghi_phep: Number(body.nghi_phep), nghi_khong_luong: Number(body.nghi_khong_luong),
        so_lan_vi_pham: Math.max(0, Math.min(50, Math.round(Number(body.so_lan_vi_pham) || 0))),
        ghi_chu: String(body.ghi_chu || '').trim().slice(0, 300) || null,
      }
      const kq = kiemChamCong(vao, chuan, { xacNhan: !!body.xacNhan, tuMay })
      if (kq.loi) return loi(kq.loi)
      const nay = new Date().toISOString()
      const dong = {
        staff_id: caller.staffId, nam: nt.nam, thang: nt.thang, ...vao, updated_at: nay,
        ...(body.xacNhan ? { trang_thai: 'da_xac_nhan', xac_nhan_luc: nay, ngay_cong_chuan: chuan } : { trang_thai: 'nhap' }),
        ...(tuMay ? { bao_sai: null } : {}),
      }
      // Chốt chống ghi đè khi hai tab cùng bấm: chỉ cập nhật dòng chưa xác nhận (nháp / đã báo sai).
      let ghi
      if (cu) ghi = await supabase.from('luong_cham_cong').update(dong).eq('id', cu.id).in('trang_thai', ['nhap', 'bao_sai']).select('*').maybeSingle()
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
      const tuMay = cu.nguon === 'may_cham_cong'   // số máy có lẻ (15,38) — sửa vẫn giữ được số lẻ
      if (![vao.ngay_di_lam, vao.nghi_phep, vao.nghi_khong_luong].every(tuMay ? soNgayMayHopLe : soNgayHopLe)) return loi('Số ngày không hợp lệ')
      const kq = kiemChamCong(vao, chuan, { tuMay })
      if (kq.loi) return loi(kq.loi)
      const { data, error } = await supabase.from('luong_cham_cong').update({
        ...vao, ngay_cong_chuan: chuan, trang_thai: 'da_xac_nhan', xac_nhan_luc: cu.xac_nhan_luc || new Date().toISOString(),
        updated_at: new Date().toISOString(), ...(tuMay ? { bao_sai: null } : {}),
      }).eq('id', cu.id).select('*').maybeSingle()
      if (error) return loi(error.message, 500)
      await supabase.from('luong_cham_cong_log').insert({
        cham_cong_id: cu.id, staff_id: cu.staff_id, hanh_dong: 'sua', ly_do: lyDo.slice(0, 300), boi: caller.staffId,
        truoc: { ngay_di_lam: cu.ngay_di_lam, nghi_phep: cu.nghi_phep, nghi_khong_luong: cu.nghi_khong_luong, so_lan_vi_pham: cu.so_lan_vi_pham, ghi_chu: cu.ghi_chu },
        sau: { ngay_di_lam: vao.ngay_di_lam, nghi_phep: vao.nghi_phep, nghi_khong_luong: vao.nghi_khong_luong, so_lan_vi_pham: vao.so_lan_vi_pham, ghi_chu: vao.ghi_chu },
      })
      return Response.json({ ok: true, data })
    }

    // ── Nhân viên báo sai số công lấy từ máy chấm công ────────────────────
    if (viec === 'bao_sai_cong') {
      if (!quyen.cham_cong) return loi('Chưa được cấp quyền chấm công', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Tháng không hợp lệ')
      const ghiChu = String(body.ghi_chu || '').trim()
      if (ghiChu.length < 5) return loi('Ghi rõ chỗ sai (ít nhất 5 ký tự)')
      const { data: cu } = await supabase.from('luong_cham_cong').select('*')
        .eq('staff_id', caller.staffId).eq('nam', nt.nam).eq('thang', nt.thang).maybeSingle()
      if (!cu || cu.nguon !== 'may_cham_cong') return loi('Chỉ báo sai được bảng công lấy từ máy chấm công')
      if (cu.trang_thai === 'da_xac_nhan') return loi('Bảng công đã xác nhận — liên hệ trưởng phòng để sửa', 409)
      const { error } = await supabase.from('luong_cham_cong').update({ trang_thai: 'bao_sai', bao_sai: ghiChu.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', cu.id)
      if (error) return loi(error.message, 500)
      await supabase.from('luong_cham_cong_log').insert({ cham_cong_id: cu.id, staff_id: caller.staffId, hanh_dong: 'bao_sai', ly_do: ghiChu.slice(0, 300), boi: caller.staffId })
      return Response.json({ ok: true })
    }

    // ── Hồ sơ nhân viên cho chấm công: mã NV, ngày vào làm, chấm công bằng máy (sql/38) ──
    if (viec === 'luu_ho_so_nv') {
      if (!quyen.manage) return loi('Không đủ quyền sửa hồ sơ nhân viên', 403)
      const ma = String(body.ma_nhan_vien ?? '').trim()
      if (ma && !MA_NV_HOP_LE.test(ma)) return loi('Mã nhân viên không hợp lệ (tối đa 20 ký tự, không dấu cách)')
      const ngay = String(body.ngay_vao_lam ?? '').trim()
      if (ngay && !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return loi('Ngày vào làm không hợp lệ')
      const { error } = await supabase.from('staff').update({
        ma_nhan_vien: ma || null, ngay_vao_lam: ngay || null, cham_cong_may: body.cham_cong_may !== false,
      }).eq('id', body.staffId)
      if (error) {
        if (/staff_ma_nhan_vien_uniq|duplicate/i.test(error.message)) return loi('Mã ' + ma + ' đã dùng cho nhân viên khác')
        return loi(/ma_nhan_vien|ngay_vao_lam|cham_cong_may/.test(error.message) ? 'Chưa chạy sql/38_luong_ma_nv_may_cham_cong.sql' : error.message, 500)
      }
      return Response.json({ ok: true })
    }

    // ── Nhập file "Hồ sơ lương nhân viên" (file mẫu tải từ app, lib/luong/fileHoSoLuong.js) ──
    // Nhận người theo EMAIL. ghi=false → xem trước từng dòng (đổi gì, lỗi gì); ghi=true → lưu.
    if (viec === 'nhap_ho_so') {
      if (!quyen.manage) return loi('Không đủ quyền nhập hồ sơ lương', 403)
      const dsFile = Array.isArray(body.dong) ? body.dong.slice(0, 500) : []
      if (!dsFile.length) return loi('File không có dòng nhân viên nào')
      const [{ data: st, error: eSt }, { data: cap }, { data: ls }, nhRes] = await Promise.all([
        supabase.from('staff').select('id, full_name, email, is_active, ma_nhan_vien, ngay_vao_lam, cham_cong_may, rooms(type)'),
        supabase.from('luong_cap_bac').select('*'),
        supabase.from('luong_nhan_vien').select('*').limit(5000),
        supabase.from('luong_ngan_hang').select('*').limit(5000),
      ])
      if (eSt) return loi(/ma_nhan_vien|ngay_vao_lam|cham_cong_may/.test(eSt.message) ? 'Chưa chạy sql/38_luong_ma_nv_may_cham_cong.sql' : eSt.message, 500)
      const theoEmail = new Map((st || []).map(s => [String(s.email).toLowerCase(), s]))
      const capTheoTen = new Map((cap || []).map(c => [String(c.ten).trim().toLowerCase(), c]))
      const chu = v => String(v ?? '').trim()
      const tien = v => { const t = chu(v).replace(/[^\d]/g, ''); return t === '' ? null : Number(t) }
      const coKhong = v => { const t = chu(v).toLowerCase(); return t === 'có' || t === 'co' || t === 'x' ? true : t === 'không' || t === 'khong' ? false : null }
      const ngayIso = v => {
        // Ô gõ thành NGÀY của Excel đọc ra số sê-ri (44935 = 09/01/2023).
        if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10)
        const t = chu(v); if (!t) return ''
        let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return m[1] + '-' + m[2] + '-' + m[3]
        m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1])
        return null
      }
      const maTrongFile = new Map()
      const ketQua = []
      for (const x of dsFile) {
        const r = { hang: Number(x.hang) || null, email: chu(x.email).toLowerCase(), loi: [], doi: [] }
        const s = theoEmail.get(r.email)
        if (!s || !s.is_active) { ketQua.push({ ...r, tt: 'khong_thay', loi: ['Không có nhân viên đang làm việc với email này'] }); continue }
        r.staff_id = s.id; r.ten = s.full_name
        if (laRemote(s)) { ketQua.push({ ...r, tt: 'remote' }); continue }
        // 1) Hồ sơ: mã, ngày vào làm, chấm công bằng máy
        const hs = {}
        const ma = chu(x.ma).toUpperCase()
        if (ma && !MA_NV_HOP_LE.test(ma)) r.loi.push('Mã NV "' + ma + '" không hợp lệ')
        else if (ma && maTrongFile.has(ma)) r.loi.push('Mã ' + ma + ' trùng với dòng ' + maTrongFile.get(ma))
        else if (ma) {
          maTrongFile.set(ma, r.hang)
          const khac = (st || []).find(o => o.id !== s.id && String(o.ma_nhan_vien || '').toUpperCase() === ma)
          if (khac && !dsFile.some(y => chu(y.email).toLowerCase() === String(khac.email).toLowerCase())) r.loi.push('Mã ' + ma + ' đang là của ' + khac.full_name)
          if (ma !== (s.ma_nhan_vien || '')) { hs.ma_nhan_vien = ma; r.doi.push('mã ' + (s.ma_nhan_vien || '—') + ' → ' + ma) }
        }
        const ngay = ngayIso(x.ngayVao)
        if (ngay === null) r.loi.push('Ngày vào làm "' + chu(x.ngayVao) + '" không đúng dạng dd/mm/yyyy')
        else if (ngay && ngay !== (s.ngay_vao_lam || '')) { hs.ngay_vao_lam = ngay; r.doi.push('vào làm ' + ngay.split('-').reverse().join('/')) }
        const may = coKhong(x.mayCC)
        if (may !== null && may !== (s.cham_cong_may !== false)) { hs.cham_cong_may = may; r.doi.push(may ? 'chấm công bằng máy' : 'tự khai công') }
        // 2) Lương: chỉ khi có cấp bậc hoặc lương cơ bản
        let luong = null
        const capRow = chu(x.cap) ? capTheoTen.get(chu(x.cap).toLowerCase()) : null
        if (chu(x.cap) && !capRow) r.loi.push('Cấp bậc "' + chu(x.cap) + '" không có trong bảng cấp')
        let lcb = tien(x.lcb), dt = tien(x.dt), bh = tien(x.bhxh)
        if (capRow && lcb === null) { lcb = Number(capRow.luong_co_ban); dt = capRow.doanh_thu_toi_thieu == null ? null : Number(capRow.doanh_thu_toi_thieu); bh = capRow.luong_bhxh == null ? null : Number(capRow.luong_bhxh) }
        if (lcb !== null) {
          const m = /^(\d{1,2})\/(\d{4})$/.exec(chu(x.tuThang))
          const thamGia = coKhong(x.thamGia) ?? false
          const npt = chu(x.npt) === '' ? 0 : Number(x.npt)
          if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) r.loi.push('Áp dụng từ tháng "' + chu(x.tuThang) + '" không đúng dạng MM/YYYY')
          else if (!tienHopLe(lcb) || !tienHopLe(dt) || !tienHopLe(bh)) r.loi.push('Số tiền lương không hợp lệ')
          else if (thamGia && !bh) r.loi.push('Tham gia BHXH thì phải có lương đóng BHXH')
          else if (!Number.isInteger(npt) || npt < 0 || npt > 20) r.loi.push('Người phụ thuộc phải là số nguyên 0–20')
          else {
            luong = { staff_id: s.id, ap_dung_tu: m[2] + '-' + pad(m[1]) + '-01', cap_bac: capRow?.ma || null, luong_co_ban: lcb, doanh_thu_toi_thieu: dt,
              luong_bhxh: bh, tham_gia_bhxh: thamGia, so_nguoi_phu_thuoc: npt, ghi_chu: chu(x.ghiChu).slice(0, 300) || 'Nhập từ file hồ sơ lương' }
            const cu = (ls || []).find(l => l.staff_id === s.id && String(l.ap_dung_tu).slice(0, 10) === luong.ap_dung_tu)
            const giong = cu && ['cap_bac', 'luong_co_ban', 'doanh_thu_toi_thieu', 'luong_bhxh', 'tham_gia_bhxh', 'so_nguoi_phu_thuoc']
              .every(k => String(cu[k] ?? '') === String(luong[k] ?? '') || (typeof luong[k] === 'number' && Number(cu[k]) === luong[k]))
            if (giong) luong = null
            else r.doi.push('lương ' + (capRow?.ten || 'riêng') + ' ' + lcb.toLocaleString('vi-VN') + (thamGia ? ' · BHXH ' + Number(bh).toLocaleString('vi-VN') : ' · không BHXH') + (npt ? ' · ' + npt + ' NPT' : '') + ' từ ' + m[1] + '/' + m[2])
          }
        }
        // 3) Tài khoản ngân hàng
        let nh = null
        const stk = chu(x.stk).replace(/\s+/g, ''), maNh = chu(x.maNh)
        if (stk || chu(x.nh) || maNh) {
          if (stk && !/^[0-9A-Za-z.-]{4,30}$/.test(stk)) r.loi.push('Số tài khoản "' + stk + '" không hợp lệ')
          else if (maNh && !/^\d{1,10}$/.test(maNh)) r.loi.push('Mã ngân hàng "' + maNh + '" chỉ gồm chữ số')
          else {
            nh = { staff_id: s.id, ngan_hang: chu(x.nh).slice(0, 120) || null, so_tai_khoan: stk || null, ma_ngan_hang: maNh || null, chu_tai_khoan: chu(x.chuTk).toUpperCase().slice(0, 120) || null }
            const cu = (nhRes.data || []).find(b => b.staff_id === s.id)
            if (cu && ['ngan_hang', 'so_tai_khoan', 'ma_ngan_hang', 'chu_tai_khoan'].every(k => (cu[k] || null) === nh[k])) nh = null
            else r.doi.push('tài khoản ' + (nh.ngan_hang || '') + ' ' + (nh.so_tai_khoan || ''))
          }
        }
        r.hs = Object.keys(hs).length ? hs : null; r.luong = luong; r.nh = nh
        r.tt = r.loi.length ? 'loi' : (r.hs || r.luong || r.nh) ? 'doi' : 'giu'
        ketQua.push(r)
      }
      if (!body.ghi) return Response.json({ preview: true, dong: ketQua.map(({ hs, luong, nh, ...r }) => r) })

      let soGhi = 0
      const loiGhi = []
      for (const r of ketQua) {
        if (r.tt !== 'doi') continue
        const nay = new Date().toISOString()
        if (r.hs) {
          const { error } = await supabase.from('staff').update(r.hs).eq('id', r.staff_id)
          if (error) { loiGhi.push(r.ten + ': ' + (/uniq|duplicate/i.test(error.message) ? 'mã nhân viên đã dùng cho người khác' : error.message)); continue }
        }
        if (r.luong) {
          const { error } = await supabase.from('luong_nhan_vien').upsert({ ...r.luong, tao_boi: caller.staffId, tao_luc: nay }, { onConflict: 'staff_id,ap_dung_tu' })
          if (error) { loiGhi.push(r.ten + ' (lương): ' + error.message); continue }
        }
        if (r.nh) {
          const { error } = await supabase.from('luong_ngan_hang').upsert({ ...r.nh, sua_boi: caller.staffId, sua_luc: nay }, { onConflict: 'staff_id' })
          if (error) { loiGhi.push(r.ten + ' (tài khoản): ' + error.message); continue }
        }
        soGhi++
      }
      return Response.json({ ok: true, soGhi, loiGhi })
    }

    // ── Nhập file "Bảng chấm công chi tiết" của phần mềm chấm công (anh chốt 23/10/2026) ──
    // Trình duyệt đọc file (lib/luong/mayChamCong.js) rồi gửi các dòng lên. ghi=false → chỉ xem trước.
    // Ghi: số vào bảng công ở trạng thái NHÁP, nguồn "máy chấm công" → nhân viên Xác nhận / Báo sai.
    if (viec === 'nhap_may') {
      if (!quyen.manage) return loi('Chỉ người quản lý lương được nhập file chấm công', 403)
      const nt = namThang(body.nam, body.thang)
      if (!nt) return loi('Tháng không hợp lệ')
      const kyFile = String(body.tuNgay || '').slice(0, 7)
      if (kyFile && kyFile !== nt.nam + '-' + pad(nt.thang)) {
        return loi('File là bảng công tháng ' + kyFile.slice(5) + '/' + kyFile.slice(0, 4) + ', đang chọn tháng ' + nt.thang + '/' + nt.nam + '. Chọn đúng tháng rồi nhập lại.')
      }
      const dsFile = Array.isArray(body.dong) ? body.dong.slice(0, 500) : []
      if (!dsFile.length) return loi('File không có dòng nhân viên nào')
      const { data: st, error: eSt } = await supabase.from('staff').select('id, full_name, is_active, ma_nhan_vien, cham_cong_may, rooms(type)')
      if (eSt) return loi(/ma_nhan_vien|cham_cong_may/.test(eSt.message) ? 'Chưa chạy sql/38_luong_ma_nv_may_cham_cong.sql' : eSt.message, 500)
      const dang = (st || []).filter(s => s.is_active)
      const theoMa = new Map(dang.filter(s => s.ma_nhan_vien).map(s => [s.ma_nhan_vien.toUpperCase(), s]))
      const theoTen = new Map()
      for (const s of dang) { const k = khoaTen(s.full_name); theoTen.set(k, theoTen.has(k) ? null : s) }   // null = trùng tên
      const le = await ngayLeCuaThang(supabase, nt.nam, nt.thang)
      const chuan = ngayCongChuan(nt.nam, nt.thang, le.map(x => x.ngay)).chuan
      const thuBay = soThuBayLamViec(nt.nam, nt.thang, le.map(x => x.ngay))
      const { data: congCu } = await supabase.from('luong_cham_cong').select('*').eq('nam', nt.nam).eq('thang', nt.thang)
      const cuMap = new Map((congCu || []).map(c => [c.staff_id, c]))
      const SO = ['hc', 'phep', 'le', 'congTac', 'khongLuong', 'thaiSan', 'dotXuat', 'muonLan', 'somLan', 'muonPhut', 'somPhut']
      const ketQua = [], daDung = new Set()
      for (const x of dsFile) {
        const r = { hang: Number(x.hang) || null, ma: String(x.ma || '').trim().slice(0, 20), ten: String(x.ten || '').trim().slice(0, 100) }
        const sach = {}
        for (const k of SO) sach[k] = Number(x[k]) || 0
        if (SO.some(k => sach[k] < 0 || sach[k] > 10000)) { ketQua.push({ ...r, tt: 'loi', loi: 'Có ô số không hợp lệ' }); continue }
        let s = theoMa.get(r.ma.toUpperCase()), cach = 'ma'
        if (!s) {
          const t = theoTen.get(khoaTen(r.ten))
          if (t === null) { ketQua.push({ ...r, tt: 'khong_thay', loi: 'Trùng tên với nhiều nhân viên — đặt mã nhân viên trên app' }); continue }
          s = t; cach = 'ten'
        }
        if (!s) { ketQua.push({ ...r, tt: 'khong_thay' }); continue }
        // Mã trên file SẼ ĐỔI (anh dặn 23/10): khớp mã mà khác họ tên → nhiều khả năng mã đã cấp cho người khác.
        // Không ghi — ghi nhầm người là sai công thật của hai người.
        if (cach === 'ma' && r.ten && khoaTen(r.ten) !== khoaTen(s.full_name)) {
          ketQua.push({ ...r, tt: 'loi', tenApp: s.full_name, loi: 'Mã ' + r.ma + ' trên app đang là của ' + s.full_name + ' nhưng trong file là ' + r.ten + ' — mã đã đổi? Sửa mã ở trang Quản lý nhân viên rồi nhập lại.' })
          continue
        }
        if (daDung.has(s.id)) { ketQua.push({ ...r, tt: 'loi', loi: 'Nhân viên này xuất hiện 2 lần trong file' }); continue }
        daDung.add(s.id)
        Object.assign(r, { staff_id: s.id, tenApp: s.full_name, cach, maApp: s.ma_nhan_vien || null })
        if (laRemote(s)) { ketQua.push({ ...r, tt: 'remote' }); continue }
        if (s.cham_cong_may === false) { ketQua.push({ ...r, tt: 'tu_khai' }); continue }
        const moi = quyDoiMay(sach, thuBay)
        const c = cuMap.get(s.id)
        r.moi = moi
        r.cu = c ? { ngay_di_lam: Number(c.ngay_di_lam), nghi_phep: Number(c.nghi_phep), nghi_khong_luong: Number(c.nghi_khong_luong), so_lan_vi_pham: Number(c.so_lan_vi_pham) || 0, trang_thai: c.trang_thai, nguon: c.nguon || 'tu_khai' } : null
        const k = kiemChamCong(moi, chuan, { tuMay: true })
        if (k.loi) { ketQua.push({ ...r, tt: 'loi', loi: k.loi }); continue }
        r.canhBao = k.canhBao
        r.tt = !c ? 'moi' : c.trang_thai === 'da_xac_nhan' ? 'da_xac_nhan' : 'cap_nhat'
        ketQua.push(r)
      }
      const khongCoTrongFile = dang.filter(s => !laRemote(s) && s.cham_cong_may !== false && !daDung.has(s.id)).map(s => s.full_name).sort((a, b) => a.localeCompare(b, 'vi'))
      if (!body.ghi) return Response.json({ preview: true, chuan, thuBay, dong: ketQua, khongCoTrongFile })

      const ghiDe = !!body.ghiDeXacNhan
      const lyDo = String(body.ly_do || '').trim()
      if (ghiDe && lyDo.length < 5) return loi('Ghi lý do ghi đè bảng công đã xác nhận (ít nhất 5 ký tự)')
      const nay = new Date().toISOString()
      const tenFile = String(body.tenFile || '').slice(0, 200)
      let soGhi = 0, soLuuMa = 0
      const loiGhi = []
      for (const r of ketQua) {
        if (!(r.tt === 'moi' || r.tt === 'cap_nhat' || (r.tt === 'da_xac_nhan' && ghiDe))) continue
        const { may, ...so } = r.moi
        const { data: ghi, error } = await supabase.from('luong_cham_cong').upsert({
          staff_id: r.staff_id, nam: nt.nam, thang: nt.thang, ...so,
          nguon: 'may_cham_cong', may: { ...may, file: tenFile, nhap_luc: nay, nhap_boi: caller.staffId },
          trang_thai: 'nhap', bao_sai: null, xac_nhan_luc: null, ngay_cong_chuan: null,
          ghi_chu: 'Nhập từ máy chấm công', updated_at: nay,
        }, { onConflict: 'staff_id,nam,thang' }).select('id').maybeSingle()
        if (error) { loiGhi.push(r.tenApp + ': ' + error.message); continue }
        soGhi++
        await supabase.from('luong_cham_cong_log').insert({
          cham_cong_id: ghi?.id || null, staff_id: r.staff_id, hanh_dong: 'nhap_may', boi: caller.staffId,
          truoc: r.cu, sau: { ...so, file: tenFile }, ly_do: r.tt === 'da_xac_nhan' ? lyDo.slice(0, 300) : null,
        })
      }
      // Lưu mã cho người ghép theo TÊN mà chưa có mã trên app — lần sau ghép theo mã.
      if (body.luuMa) {
        for (const r of ketQua) {
          if (r.cach !== 'ten' || r.maApp || !r.staff_id || !MA_NV_HOP_LE.test(r.ma)) continue
          const { error } = await supabase.from('staff').update({ ma_nhan_vien: r.ma }).eq('id', r.staff_id).is('ma_nhan_vien', null)
          if (error) loiGhi.push('Mã ' + r.ma + ' (' + r.tenApp + '): ' + (/duplicate|uniq/i.test(error.message) ? 'đã dùng cho người khác' : error.message))
          else soLuuMa++
        }
      }
      return Response.json({ ok: true, soGhi, soLuuMa, loiGhi })
    }

    return loi('Không hiểu yêu cầu')
  } catch (e) {
    return loi(e.message || 'Lỗi không rõ', 500)
  }
}
