// Phân hệ Tiền lương — dựng BẢNG LƯƠNG một tháng từ dữ liệu thật (chỉ đọc, không ghi gì).
// Dùng chung cho màn hình Bảng lương và file Excel (bước 3) để hai nơi luôn ra một số.
//
// Bảng lương tháng N lấy:
//   lương cơ bản / lương BHXH đang áp dụng ở tháng N (luong_nhan_vien, lịch sử theo tháng)
//   ngày công tháng N (luong_cham_cong) · ngày công chuẩn tháng N (trừ CN + luong_ngay_le)
//   %-công việc tháng N và %-công nợ tháng N−1 — ĐÚNG hàm của Báo cáo KPI (lib/kpiTongQuan.js)
//   doanh thu thực tế tháng N = phí kế toán phải thu của công ty mình phụ trách CHÍNH, quy về tháng
//   thưởng Dịch vụ khác = các dòng khai ĐÃ được trưởng phòng duyệt cho kỳ lương N
//   thuế TNCN (thueTncn.js): lũy tiến cho người tham gia BHXH, khấu trừ 10% cho người thử việc / học việc
import { tinhKpiToanCty } from '../kpiTongQuan.js'
import { countsForMonth } from '../contractDates.js'
import { hoaHongThang } from './hoaHong.js'
import { resolveFeeForMonth } from '../feeDue.js'
import { ngayCongChuan, luongCuaThang } from './ngayCong.js'
import { thuongTheoKpi, thuongDoanhSo, doanhThuThangCuaCongTy, luongTheoCong, thangLui, tacPhongNhanVien, diemKpiPhong } from './thuong.js'
import { khauTru, congTyDong } from './khauTru.js'
import { thueTncn } from './thueTncn.js'

const pad = n => String(n).padStart(2, '0')

async function docHet(q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

// Doanh thu thực tế từng nhân viên trong (nam, thang): Map staffId → { tong, soCty, congTy:[…] }.
// Công ty tính nếu đã bắt đầu hợp đồng và chưa ngưng ở tháng đó (countsForMonth tôn trọng
// service_end). Không dựa vào clients.status: đó là trạng thái HÔM NAY, không phải của tháng cũ —
// công ty ngưng mà không ghi tháng ngưng thì không biết ngưng lúc nào nên bỏ qua.
// Hạn chế đã biết: người phụ trách lấy theo HIỆN TẠI (clients.assigned_to), app chưa lưu lịch sử đổi.
export async function doanhThuTheoNhanVien(supabase, nam, thang) {
  let clients
  try {
    clients = await docHet(() => supabase.from('clients')
      .select('id, name, client_code, monthly_fee, fee_period, assigned_to, contract_start, created_at, status, service_end')
      .not('assigned_to', 'is', null))
  } catch {
    clients = await docHet(() => supabase.from('clients')
      .select('id, name, client_code, monthly_fee, fee_period, assigned_to, contract_start, created_at, status')
      .not('assigned_to', 'is', null))
  }
  const dung = clients.filter(c => (c.status === 'active' || (c.service_end && c.status !== 'active')) && countsForMonth(c, nam, thang))
  const ids = dung.map(c => c.id)
  const feePlan = [], changeLog = []
  for (let i = 0; i < ids.length; i += 200) {
    const lo = ids.slice(i, i + 200)
    feePlan.push(...await docHet(() => supabase.from('service_fees').select('id, client_id, year, month, amount').in('client_id', lo).eq('type', 'fee_plan')))
    changeLog.push(...await docHet(() => supabase.from('client_change_log').select('id, client_id, old_value, changed_at').in('client_id', lo).eq('entity', 'monthly_fee').eq('action', 'update')))
  }
  const theoNv = new Map()
  for (const c of dung) {
    const phi = resolveFeeForMonth(feePlan, c.id, nam, thang, c.monthly_fee, changeLog)
    const dt = doanhThuThangCuaCongTy(phi, c.fee_period)
    if (!theoNv.has(c.assigned_to)) theoNv.set(c.assigned_to, { tong: 0, soCty: 0, congTy: [] })
    const x = theoNv.get(c.assigned_to)
    x.tong += dt
    if (dt > 0) x.soCty++
    x.congTy.push({ id: c.id, ten: c.name, ma: c.client_code, phiKy: Number(phi) || 0, quy: c.fee_period === 'quarterly', doanhThu: dt })
  }
  return theoNv
}

export async function tinhBangLuong(supabase, nam, thang) {
  // Kỳ số liệu (anh chốt lại 19/10/2026): %-công việc CÙNG tháng N, %-công nợ tháng N−1, doanh thu
  // tháng N (phí phải thu của tháng, quý chia 3). Trước đó là việc N−1 / nợ N−2 / doanh thu N−1.
  const kyViec = thangLui(nam, thang, 0), kyNo = thangLui(nam, thang, 1), kyDt = thangLui(nam, thang, 0)
  const moc = nam + '-' + pad(thang)

  const [{ data: staff, error: e1 }, { data: rooms }, { data: capBac }, lichSuLuong, { data: cong }, { data: le }, dvk] = await Promise.all([
    supabase.from('staff').select('id, full_name, room_id, role, is_active').eq('is_active', true).order('full_name'),
    supabase.from('rooms').select('id, name, type'),
    supabase.from('luong_cap_bac').select('ma, ten, nhom'),
    // Cột so_nguoi_phu_thuoc có từ sql/35 — chưa chạy thì đọc như cũ (0 người phụ thuộc).
    docHet(() => supabase.from('luong_nhan_vien').select('id, staff_id, ap_dung_tu, cap_bac, luong_co_ban, doanh_thu_toi_thieu, luong_bhxh, tham_gia_bhxh, so_nguoi_phu_thuoc').lte('ap_dung_tu', moc + '-01'))
      .catch(() => docHet(() => supabase.from('luong_nhan_vien').select('id, staff_id, ap_dung_tu, cap_bac, luong_co_ban, doanh_thu_toi_thieu, luong_bhxh, tham_gia_bhxh').lte('ap_dung_tu', moc + '-01'))),
    supabase.from('luong_cham_cong').select('*').eq('nam', nam).eq('thang', thang),
    supabase.from('luong_ngay_le').select('ngay').gte('ngay', moc + '-01').lte('ngay', moc + '-' + pad(new Date(Date.UTC(nam, thang, 0)).getUTCDate())),
    supabase.from('luong_dvk_khai').select('staff_id, ten_dv, so_tien, ty_le, tien_thuong, trang_thai, ghi_chu, service_id').eq('nam', nam).eq('thang', thang),
  ])
  // Phụ cấp / điều chỉnh ngoại lệ do kế toán nội bộ nhập (sql/34). Chưa chạy SQL thì coi như không có.
  const dc = await supabase.from('luong_dieu_chinh').select('staff_id, phu_cap, dieu_chinh, ly_do').eq('nam', nam).eq('thang', thang)
  const dcNv = new Map((dc.error ? [] : dc.data || []).map(x => [x.staff_id, x]))
  // Tài khoản nhận lương (sql/35). Chưa chạy SQL thì để trống.
  const nh = await supabase.from('luong_ngan_hang').select('staff_id, ngan_hang, so_tai_khoan, chu_tai_khoan')
  const nhNv = new Map((nh.error ? [] : nh.data || []).map(x => [x.staff_id, x]))
  if (e1) throw new Error(e1.message)

  const [kpiViec, kpiNo, dtTheoNv, hoaHong] = await Promise.all([
    tinhKpiToanCty(supabase, kyViec.nam, kyViec.thang),
    tinhKpiToanCty(supabase, kyNo.nam, kyNo.thang),
    doanhThuTheoNhanVien(supabase, kyDt.nam, kyDt.thang),
    // Hoa hồng giới thiệu (sql/39) — phần khách trả thêm từ lần chốt trước × % bậc. Chưa có SQL → rỗng.
    hoaHongThang(supabase, nam, thang, { countsForMonth }),
  ])
  const viecNv = new Map(kpiViec.staff.map(s => [s.staff_id, s]))
  const noNv = new Map(kpiNo.staff.map(s => [s.staff_id, s]))
  const viecPhong = new Map(kpiViec.rooms.map(r => [r.room_id, r]))
  const noPhong = new Map(kpiNo.rooms.map(r => [r.room_id, r]))
  const phong = new Map((rooms || []).map(r => [r.id, r]))
  const cap = new Map((capBac || []).map(c => [c.ma, c]))
  const congNv = new Map((cong || []).map(c => [c.staff_id, c]))
  const chuan = ngayCongChuan(nam, thang, (le || []).map(x => x.ngay)).chuan
  const dvkNv = new Map()
  if (!dvk.error) for (const d of dvk.data || []) {
    if (!dvkNv.has(d.staff_id)) dvkNv.set(d.staff_id, { duyet: 0, choDuyet: 0 })
    const x = dvkNv.get(d.staff_id)
    if (d.trang_thai === 'da_duyet') { x.duyet += Number(d.tien_thuong) || 0; (x.dong ||= []).push(d) }
    else if (d.trang_thai === 'cho_duyet') x.choDuyet++
  }

  // Phòng remote KHÔNG tính lương trên app (anh chốt 23/10/2026).
  const dong = (staff || []).filter(s => phong.get(s.room_id)?.type !== 'remote')
    .filter(s => s.role !== 'admin' || lichSuLuong.some(l => l.staff_id === s.id)).map(s => {
    const p = phong.get(s.room_id)
    const luong = luongCuaThang(lichSuLuong.filter(l => l.staff_id === s.id), nam, thang)
    const capNv = luong?.cap_bac ? cap.get(luong.cap_bac) : null
    const laTruongPhong = capNv ? capNv.nhom === 'truong_phong' : ['leader', 'hcns_leader', 'sales_leader'].includes(s.role)
    // Phòng HCNS / Kinh doanh không có %-công việc, %-công nợ kiểu kế toán → không tự tính thưởng KPI.
    const kpiApDung = !!p && !['hcns', 'kinhdoanh'].includes(p.type)
    const c = congNv.get(s.id)
    const ngayTinh = c ? Number(c.ngay_di_lam) + Number(c.nghi_phep) : null
    const soLanViPham = c ? Number(c.so_lan_vi_pham) || 0 : 0
    const chuanDung = c?.ngay_cong_chuan ? Number(c.ngay_cong_chuan) : chuan
    const pctViec = kpiApDung ? (viecNv.get(s.id)?.task_pct ?? null) : null
    const pctNo = kpiApDung ? (noNv.get(s.id)?.debt_pct ?? null) : null
    const dt = dtTheoNv.get(s.id) || { tong: 0, soCty: 0, congTy: [] }
    const thuongViec = kpiApDung ? thuongTheoKpi(pctViec) : 0
    const thuongNo = kpiApDung ? thuongTheoKpi(pctNo) : 0
    // Trưởng phòng: 20% doanh thu công ty tự làm — KHÔNG cần mức lương / doanh thu tối thiểu nên tính
    // được cả khi chưa đặt lương. Nhân viên thì cần mức tối thiểu theo cấp (chưa đặt lương → 0).
    const thuongDs = (luong || laTruongPhong) ? thuongDoanhSo({ doanhThu: dt.tong, toiThieu: luong?.doanh_thu_toi_thieu ?? null, laTruongPhong }) : 0
    const thuongDvk = dvkNv.get(s.id)?.duyet || 0
    const canhBao = []
    if (!luong) canhBao.push('Chưa đặt lương')
    if (!c) canhBao.push('Chưa khai công')
    else if (c.trang_thai !== 'da_xac_nhan') canhBao.push('Công chưa xác nhận')
    if (dvkNv.get(s.id)?.choDuyet) canhBao.push(dvkNv.get(s.id).choDuyet + ' dòng DVK chờ duyệt')
    return {
      staff_id: s.id, ten: s.full_name, room_id: s.room_id, phong: p?.name || '', role: s.role,
      capBac: capNv?.ten || null, laTruongPhong, kpiApDung,
      luongCoBan: luong ? Number(luong.luong_co_ban) : null,
      toiThieu: luong?.doanh_thu_toi_thieu === null || luong?.doanh_thu_toi_thieu === undefined ? null : Number(luong.doanh_thu_toi_thieu),
      luongBhxh: luong?.luong_bhxh === null || luong?.luong_bhxh === undefined ? null : Number(luong.luong_bhxh),
      thamGiaBhxh: !!luong?.tham_gia_bhxh,
      soNguoiPhuThuoc: Number(luong?.so_nguoi_phu_thuoc) || 0,
      nganHang: nhNv.has(s.id) ? { ten: nhNv.get(s.id).ngan_hang || '', stk: nhNv.get(s.id).so_tai_khoan || '', chu: nhNv.get(s.id).chu_tai_khoan || '' } : null,
      cong: c ? { di_lam: Number(c.ngay_di_lam), phep: Number(c.nghi_phep), khong_luong: Number(c.nghi_khong_luong), trang_thai: c.trang_thai } : null,
      soLanViPham, pctTacPhong: tacPhongNhanVien(soLanViPham),
      phuCap: Number(dcNv.get(s.id)?.phu_cap) || 0, dieuChinh: Number(dcNv.get(s.id)?.dieu_chinh) || 0, lyDoDieuChinh: dcNv.get(s.id)?.ly_do || '',
      ngayCongChuan: chuanDung, ngayTinhLuong: ngayTinh,
      luongTheoCong: luong && ngayTinh !== null ? luongTheoCong(luong.luong_co_ban, ngayTinh, chuanDung) : null,
      pctViec, thuongViec, pctNo, thuongNo,
      doanhThu: dt.tong, soCtyDoanhThu: dt.soCty, congTyDoanhThu: dt.congTy,
      thuongDoanhSo: thuongDs, thuongDvk,
      hoaHongGt: hoaHong.get(s.id) || null, thuongHoaHong: hoaHong.get(s.id)?.hoaHong || 0,
      tongThuong: thuongViec + thuongNo + thuongDs + thuongDvk + (hoaHong.get(s.id)?.hoaHong || 0),
      dvkDong: (dvkNv.get(s.id)?.dong || []).map(d => ({ ten: d.ten_dv, soTien: Number(d.so_tien), tyLe: Number(d.ty_le), thuong: Number(d.tien_thuong), ghiChu: d.ghi_chu || '', ngoaiApp: !d.service_id })),
      khauTru: luong ? khauTru(luong.luong_bhxh, luong.tham_gia_bhxh) : khauTru(0, false),
      // Phần công ty đóng BHXH / BHYT / BHTN / KPCĐ — không trừ lương, để xuất tổng số tiền đóng (23/10/2026).
      congTyDong: luong ? congTyDong(luong.luong_bhxh, luong.tham_gia_bhxh) : congTyDong(0, false),
      canhBao,
    }
  })

  // KPI phòng = trung bình 3 tiêu chí: %-công việc, %-công nợ (như Báo cáo KPI) và %-TÁC PHONG = trung
  // bình % tác phong của mọi người trong phòng (mỗi người 100 − 20 × số lần vi phạm tự khai).
  const phongKpi = (rooms || []).filter(r => !['hcns', 'kinhdoanh', 'remote'].includes(r.type)).map(r => {
    const nguoi = dong.filter(x => x.room_id === r.id)
    const pctViec = viecPhong.get(r.id)?.staff_count ? viecPhong.get(r.id).avg_task_pct : null
    const pctNo = noPhong.get(r.id)?.staff_count ? noPhong.get(r.id).avg_debt_pct : null
    const pctTacPhong = nguoi.length ? Math.round(nguoi.reduce((a, x) => a + x.pctTacPhong, 0) / nguoi.length) : null
    const diem = diemKpiPhong(pctViec, pctNo, pctTacPhong)
    return { room_id: r.id, ten: r.name, pctViec, pctNo, pctTacPhong, soNguoi: nguoi.length, soLanViPham: nguoi.reduce((a, x) => a + x.soLanViPham, 0), diem, thuongMoiNguoi: thuongTheoKpi(diem) }
  }).filter(r => r.pctViec !== null || r.pctNo !== null)
  const kpiPhong = new Map(phongKpi.map(r => [r.room_id, r]))

  // Thưởng phòng (mỗi người nhận đủ mức) + phụ cấp + điều chỉnh → thu nhập → thuế TNCN → thực lĩnh.
  for (const x of dong) {
    x.diemKpiPhong = x.kpiApDung ? (kpiPhong.get(x.room_id)?.diem ?? null) : null
    x.thuongPhong = x.kpiApDung ? (kpiPhong.get(x.room_id)?.thuongMoiNguoi || 0) : 0
    x.tongThuong += x.thuongPhong
    x.thuNhap = (x.luongTheoCong || 0) + x.tongThuong + x.phuCap + x.dieuChinh
    x.thueTncn = thueTncn({ thuNhap: x.thuNhap, thamGiaBhxh: x.thamGiaBhxh, soNguoiPhuThuoc: x.soNguoiPhuThuoc, bhxh: x.khauTru.bhxh })
    x.thucLinh = x.thuNhap - x.khauTru.tong - x.thueTncn.thue
    x.chiPhiLuong = x.thuNhap + x.congTyDong.tong   // tổng công ty bỏ ra cho người này
  }

  // Hoa hồng của người KHÔNG có dòng trong bảng lương (phòng remote, quản trị chưa đặt lương…) — không trả qua bảng
  // lương, không ghi sổ; liệt kê để kế toán xử lý tay thay vì mất lặng lẽ.
  const coDong = new Set(dong.map(x => x.staff_id))
  const hoaHongNgoai = [...hoaHong].filter(([id, h]) => !coDong.has(id) && h.hoaHong).map(([id, h]) => ({ staff_id: id, ten: (staff || []).find(s => s.id === id)?.full_name || 'Nhân viên đã nghỉ / phòng remote', soCty: h.soCty, tyLe: h.tyLe, hoaHong: h.hoaHong }))
  return { nam, thang, kyViec, kyNo, kyDoanhThu: kyDt, ngayCongChuan: chuan, dong, phong: phongKpi, hoaHongNgoai }
}
