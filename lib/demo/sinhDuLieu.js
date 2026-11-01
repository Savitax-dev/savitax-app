// BẢN DEMO — sinh BỘ DỮ LIỆU MẪU (hoàn toàn giả) theo NGÀY HÔM NAY.
//
// Hàm thuần: nhận `now` + danh mục cấu hình (lib/demo/cauHinh.js) + id các tài khoản demo đã có trong Auth, trả về
// { bang: { <tên bảng>: [dòng…] }, sauNap: {...} } để lib/demo/datLai.js nạp vào database demo. Cùng một ngày thì
// ra cùng một bộ (bộ sinh số ngẫu nhiên có hạt giống cố định) — khách xem hôm nay và mai thấy cùng "công ty".
//
// Không có tên / MST / số điện thoại / tài khoản thật nào: tên ghép từ từ điển dưới đây, MST bắt đầu bằng "88"
// (không có tỉnh nào mã 88), điện thoại 0900 000 xxx.
import crypto from 'crypto'
import { effectiveDeadlineDate } from '../deadline.js'
import { hcnsDueDate } from '../hcnsDue.js'
import { priceQuote } from '../salesPricing.js'
import { ngayCongChuan } from '../luong/ngayCong.js'

// Trạng thái HĐ theo giai đoạn khách — chép từ lib/salesScope.js (file đó kéo theo serverAuth, không chạy được ngoài Next)
const contractForStage = (stage, current) => stage === 'gui_hd' ? 'sent' : stage === 'chot' ? 'signed' : stage === 'that_bai' ? (current === 'signed' ? 'sent' : current) : 'draft'

// ── Tiện ích ─────────────────────────────────────────────────────────────────────────
// UUID cố định theo khoá → id công ty / nhân viên giữ nguyên qua mỗi lần làm mới (đường dẫn khách lưu không gãy).
export function uid(...k) {
  const h = crypto.createHash('sha1').update('savitax-demo|' + k.join('|')).digest('hex')
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32)
}
function prng(seed) {   // mulberry32
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pad = n => String(n).padStart(2, '0')
const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d)
const soNgay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
// giờ VN → ISO (UTC)
const isoVN = (y, m, d, h = 9, mi = 0) => new Date(Date.UTC(y, m - 1, d, h - 7, mi)).toISOString()
const themThang = (y, m, n) => { const t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 } }
const ym = (y, m) => y * 12 + (m - 1)
const lamTron = (x, buoc = 1000) => Math.round(x / buoc) * buoc

// ── Từ điển tên giả ──────────────────────────────────────────────────────────────────
const TEN_CTY = ['AN KHANG PHÁT', 'BÌNH MINH XANH', 'CÁT TƯỜNG VIỆT', 'ĐẠI LỘC THỊNH', 'GIA HƯNG PHÚ', 'HẢI ĐĂNG SÀI GÒN',
  'HOÀNG KIM LONG', 'KIM NGÂN PHÁT', 'LÂM VIÊN XANH', 'MINH TÂM PHÁT', 'NAM VIỆT HƯNG', 'NGỌC BẢO CHÂU', 'PHÚ QUÝ GIA',
  'QUANG MINH TIẾN', 'SAO BẮC ĐẨU', 'TÂN THỊNH VƯỢNG', 'THIÊN ÂN LỘC', 'THUẬN PHONG', 'TRƯỜNG SƠN XANH', 'VẠN AN THỊNH',
  'VIỆT NHẬT TÂM', 'XUÂN MAI PHÁT', 'BẢO NGỌC HÀ', 'ĐÔNG Á THỊNH', 'HƯNG PHÁT LỢI', 'KHÁNH VY', 'LỘC PHÚC AN',
  'MỸ HẠNH', 'NHẬT QUANG', 'PHƯƠNG ĐÔNG XANH', 'SƠN HÀ VIỆT', 'TÍN NGHĨA PHÁT', 'TRÍ VIỆT', 'VĨNH AN KHANG',
  'ÁNH DƯƠNG', 'CHÂU Á THÁI BÌNH', 'HỢP NHẤT PHÁT', 'KIẾN TRÚC MỚI', 'LAM SƠN', 'THẢO NGUYÊN XANH', 'BẮC NAM LOGISTICS',
  'TINH HOA ẨM THỰC']
const LOAI_HINH = ['CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ', 'CÔNG TY TNHH', 'CÔNG TY CỔ PHẦN', 'CÔNG TY TNHH XÂY DỰNG',
  'CÔNG TY TNHH SẢN XUẤT', 'CÔNG TY CỔ PHẦN ĐẦU TƯ']
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý']
const DEM = ['Văn', 'Thị', 'Minh', 'Thanh', 'Ngọc', 'Hoàng', 'Quốc', 'Thu', 'Gia', 'Đức']
const TEN = ['An', 'Bình', 'Châu', 'Dũng', 'Hà', 'Hải', 'Hạnh', 'Khoa', 'Lan', 'Long', 'Mai', 'Nam', 'Ngân', 'Phúc', 'Quân',
  'Sơn', 'Tâm', 'Thảo', 'Trang', 'Tuấn', 'Vy', 'Yến']
const QUAN = ['Quận 1', 'Quận 3', 'Quận 5', 'Quận 7', 'Quận 10', 'Quận Bình Thạnh', 'Quận Tân Bình', 'Quận Phú Nhuận',
  'TP Thủ Đức', 'Quận Gò Vấp']
const DUONG = ['Nguyễn Trãi', 'Lê Lợi', 'Hai Bà Trưng', 'Điện Biên Phủ', 'Cách Mạng Tháng Tám', 'Võ Văn Tần', 'Lý Thường Kiệt',
  'Nguyễn Đình Chiểu', 'Phan Xích Long', 'Trường Chinh']

// ── Tổ chức ──────────────────────────────────────────────────────────────────────────
export const PHONG = [
  { k: 'kt1', name: 'Kế toán 1', type: 'main' },        // app tự thêm chữ "Phòng" khi hiển thị
  { k: 'kt2', name: 'Kế toán 2', type: 'main' },
  { k: 'hcns', name: 'HCNS', type: 'hcns' },
  { k: 'kd', name: 'Kinh doanh', type: 'kinhdoanh' },
  { k: 'pl', name: 'Pháp lý', type: 'phaply' },
]
// demo: tài khoản đăng nhập anh gửi khách (email @demo.savitax.vn). Người còn lại chỉ là dữ liệu, không đăng nhập.
export const NHAN_VIEN = [
  { k: 'giamdoc', ten: 'Nguyễn Minh Quân', role: 'admin', phong: null, demo: 'giamdoc', cap: 'GD', luong: 30000000 },
  { k: 'tp1', ten: 'Trần Thu Hà', role: 'leader', phong: 'kt1', demo: 'truongphong', cap: 'TP', luong: 15000000 },
  { k: 'nv1', ten: 'Lê Hoàng Anh', role: 'staff', phong: 'kt1', demo: 'nhanvien', cap: 'KT2', luong: 9000000 },
  { k: 'nv2', ten: 'Ngô Thanh Tùng', role: 'staff', phong: 'kt1', cap: 'KT3', luong: 11000000 },
  { k: 'nv3', ten: 'Bùi Khánh Linh', role: 'staff', phong: 'kt1', cap: 'KT1', luong: 7500000, thuViec: true },
  { k: 'tp2', ten: 'Hoàng Văn Phúc', role: 'leader', phong: 'kt2', cap: 'TP', luong: 15000000 },
  { k: 'nv4', ten: 'Đỗ Minh Thư', role: 'staff', phong: 'kt2', cap: 'KT3', luong: 11000000 },
  { k: 'nv5', ten: 'Huỳnh Gia Huy', role: 'staff', phong: 'kt2', cap: 'KT2', luong: 9000000 },
  { k: 'nv6', ten: 'Phan Mỹ Duyên', role: 'staff', phong: 'kt2', cap: 'KT2', luong: 9000000 },
  { k: 'nb', ten: 'Phạm Ngọc Lan', role: 'nhan_vien_nb', phong: 'kt1', demo: 'ketoannoibo', cap: 'KT3', luong: 11000000 },
  { k: 'hcns', ten: 'Võ Thị Mai', role: 'hcns_leader', phong: 'hcns', demo: 'hcns', cap: 'TP', luong: 13000000 },
  { k: 'hcns2', ten: 'Lý Thu Trang', role: 'hcns', phong: 'hcns', cap: 'KT2', luong: 8500000 },
  { k: 'kd', ten: 'Đặng Quốc Bảo', role: 'sales_leader', phong: 'kd', demo: 'kinhdoanh', cap: 'TP', luong: 13000000 },
  { k: 'kd2', ten: 'Trịnh Đức Long', role: 'sales', phong: 'kd', cap: 'KT2', luong: 8000000 },
  { k: 'pl', ten: 'Mai Anh Tuấn', role: 'phaply_leader', phong: 'pl', cap: 'TP', luong: 13000000 },
]
export const TAI_KHOAN_DEMO = NHAN_VIEN.filter(n => n.demo).map(n => ({ k: n.k, email: n.demo + '@demo.savitax.vn', ten: n.ten }))

// Công ty mỗi nhân viên kế toán phụ trách chính
const PHAN_CONG = { tp1: 2, nv1: 6, nv2: 6, nv3: 4, nb: 2, tp2: 2, nv4: 6, nv5: 6, nv6: 5 }
const PHI_THANG = [1080000, 1620000, 2160000, 2700000, 3240000, 4320000, 5400000, 6480000, 8640000, 10800000]

// ═════════════════════════════════════════════════════════════════════════════════════
export function sinhBoDemo({ now = new Date(), cauHinh, authId = {} }) {
  const r = prng(20261101)
  const chon = a => a[Math.floor(r() * a.length)]
  const giua = (a, b) => a + Math.floor(r() * (b - a + 1))
  const vn = new Date(now.getTime() + 7 * 3600e3)
  const Y = vn.getUTCFullYear(), M = vn.getUTCMonth() + 1, D = vn.getUTCDate()
  const homNayYM = ym(Y, M)
  const daQua = (y, m, d, h = 0) => isoVN(y, m, d, h) <= now.toISOString()
  const dau = themThang(Y, M, -11)                  // cửa sổ dữ liệu: 12 tháng gần nhất
  const THANG = Array.from({ length: 12 }, (_, i) => themThang(dau.y, dau.m, i))
  const B = {}
  const them = (t, row) => (B[t] = B[t] || []).push(row)

  // ── Cấu hình sản phẩm (chụp từ production) ──
  for (const t of ['roles', 'permissions', 'role_permissions', 'task_definitions', 'hcns_service_templates',
    'hcns_service_template_tasks', 'sales_channels', 'tax_filing_types', 'tax_holidays', 'luong_ngay_le', 'luong_hoa_hong_bac'])
    B[t] = (cauHinh[t] || []).map(x => ({ ...x }))

  // ── Phòng, nhân viên ──
  const phongId = {}
  for (const p of PHONG) { phongId[p.k] = uid('room', p.k); them('rooms', { id: phongId[p.k], name: p.name, type: p.type }) }
  const nvId = {}
  NHAN_VIEN.forEach((n, i) => {
    nvId[n.k] = (n.demo && authId[n.demo + '@demo.savitax.vn']) || uid('staff', n.k)
    them('staff', {
      id: nvId[n.k], room_id: n.phong ? phongId[n.phong] : null, full_name: n.ten,
      email: n.demo ? n.demo + '@demo.savitax.vn' : n.k + '@nhanvien.demo.savitax.vn',
      role: n.role, is_active: true, phone: '0900000' + pad(100 + i).slice(-3), ma_nhan_vien: 'NV' + pad(i + 1),
      ngay_vao_lam: ymd(Y - 1 - (i % 3), (i % 12) + 1, 1), cham_cong_may: n.role !== 'admin', created_at: isoVN(Y - 2, 1, 2),
    })
  })
  // Trưởng phòng KT1 kiêm nhiệm trưởng phòng Pháp lý? — không; ví dụ kiêm nhiệm: giám đốc kinh doanh kiêm KT2
  them('staff_extra_roles', { id: uid('xr', 1), staff_id: nvId.kd, room_id: phongId.kt2, role: 'staff' })

  // ── Công ty khách hàng ──
  const congTy = []
  let stt = 0
  for (const [nv, so] of Object.entries(PHAN_CONG)) {
    for (let j = 0; j < so; j++) {
      const ten = TEN_CTY[stt % TEN_CTY.length]
      const hkd = stt % 9 === 4
      const quy = !hkd && stt % 8 === 3                              // thu phí theo quý
      const reportQuy = hkd || r() < 0.85
      const phiThang = PHI_THANG[Math.floor(Math.pow(r(), 1.6) * PHI_THANG.length)]
      const c = {
        k: 'c' + stt, nv, id: uid('client', stt),
        name: hkd ? 'HỘ KINH DOANH ' + chon(HO).toUpperCase() + ' ' + ten : (stt % 5 === 0 ? LOAI_HINH[0] : chon(LOAI_HINH)) + ' ' + ten,
        code: ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Đ/g, 'D').replace(/[^A-Z]/g, '').slice(0, 12),
        mst: '88' + String(10000000 + Math.floor(r() * 89999999)), hkd, quy,
        fee: quy ? phiThang * 3 : phiThang, phiThang,
        reportQuy, hcns: !hkd && stt % 5 === 1, kieu: r() < 0.7 ? 'tot' : r() < 0.65 ? 'cham' : 'no',
        ngung: stt === 7 || stt === 23, khongVat: stt === 11, giaHan: stt === 16 ? 2 : 0,
        noCu: [5, 18, 30].includes(stt) ? lamTron(phiThang * giua(2, 5), 10000) : 0,
      }
      if (nv === 'nv1') c.kieu = j === 2 ? 'cham' : 'tot'   // tài khoản nhanvien@demo khách hay đăng nhập thử: số đẹp, vẫn có 1 công ty trả chậm
      if (c.ngung) c.kieu = 'no'
      congTy.push(c); stt++
    }
  }
  const startWin = ymd(dau.y, dau.m, 1)
  for (const c of congTy) {
    const ngungTu = c.ngung ? themThang(Y, M, c.k === 'c7' ? -2 : -4) : null
    c.ngungYM = ngungTu ? ym(ngungTu.y, ngungTu.m) : null
    them('clients', {
      id: c.id, name: c.name, tax_code: c.mst, assigned_to: nvId[c.nv], room_id: null, debt_cycle: 'monthly',
      is_active: !c.ngung, created_at: isoVN(dau.y, dau.m, 1, 8), status: c.ngung ? 'inactive' : 'active',
      monthly_fee: c.fee, fee_period: c.quy ? 'quarterly' : 'monthly',
      address: giua(10, 350) + ' ' + chon(DUONG) + ', ' + chon(QUAN) + ', TP Hồ Chí Minh', tax_status: 'NNT đang hoạt động',
      report_type: c.reportQuy ? 'quarterly' : 'monthly', client_code: c.code, representative: chon(HO) + ' ' + chon(DEM) + ' ' + chon(TEN),
      other_debt: c.noCu, contract_start: ymd(Y - 1 - (c.k.length % 2), giua(1, 12), 1), uses_hcns: c.hcns, is_hkd: c.hkd,
      service_end: ngungTu ? ymd(ngungTu.y, ngungTu.m, 1) : null, dvk_only: false,
      gioi_thieu_boi: ['c2', 'c9', 'c14', 'c27'].includes(c.k) ? nvId[c.k === 'c27' ? 'nv4' : 'nv1'] : null,
      gioi_thieu_tu: ['c2', 'c9', 'c14', 'c27'].includes(c.k) ? startWin : null,
      khong_vat: c.khongVat, gia_han_thu_thang: c.giaHan, gia_han_thu_ly_do: c.giaHan ? 'Khách xin trả chậm 2 tháng do chờ thu hồi công nợ, Giám đốc đồng ý' : null,
    })
    // nhân viên phụ: trưởng phòng theo dõi vài công ty
    if (['c3', 'c12', 'c24'].includes(c.k)) them('client_secondary_staff', { id: uid('sec', c.k), client_id: c.id, staff_id: nvId[c.k === 'c24' ? 'tp2' : 'tp1'], added_by: nvId.giamdoc })
  }
  const dangDung = (c, y, m) => c.ngungYM === null || ym(y, m) < c.ngungYM

  // ── Checklist công việc ──
  const defs = B.task_definitions.filter(d => d.is_active !== false)
  for (const c of congTy) {
    const tre = c.kieu === 'no' ? 0.22 : c.nv === 'nv3' ? 0.18 : 0.07
    for (const { y, m } of THANG) {
      if (!dangDung(c, y, m)) continue
      for (const d of defs) {
        if (d.report_type !== (c.reportQuy ? 'quarterly' : 'monthly') || Number(d.month) !== m) continue
        const han = effectiveDeadlineDate(y, m, d.deadline_day)                 // 0h ngày hạn giờ VN
        const hanD = new Date(han.getTime() + 7 * 3600e3)
        const hy = hanD.getUTCFullYear(), hm = hanD.getUTCMonth() + 1, hd = hanD.getUTCDate()
        const quaHan = !daQua(hy, hm, hd, 24) ? false : true
        let done = false, doneAt = null
        const x = r()
        if (quaHan) {
          if (x < 1 - tre - 0.03) { done = true; const lui = giua(0, 6); const t = new Date(Date.UTC(hy, hm - 1, hd - lui, 2 + giua(0, 8))); doneAt = t.toISOString() }
          else if (x < 1 - 0.03) { done = true; const t = new Date(Date.UTC(hy, hm - 1, hd + giua(1, 9), 3 + giua(0, 7))); doneAt = (t > now ? new Date(now.getTime() - 3600e3) : t).toISOString() }
        } else if (x < 0.35) {
          const t = new Date(Math.min(now.getTime() - 2 * 3600e3, Date.UTC(hy, hm - 1, hd - giua(1, 8), 3)))
          if (t >= new Date(Date.UTC(y, m - 1, 1))) { done = true; doneAt = t.toISOString() }
        }
        them('task_records', { id: uid('tr', c.k, y, m, d.id), client_id: c.id, task_def_id: d.id, year: y, month: m, is_done: done, done_by: done ? nvId[c.nv] : null, done_at: doneAt, note: null })
      }
      // TP đã kiểm tra checklist các tháng đã qua
      if (ym(y, m) < homNayYM - 1 && r() < 0.5) them('checklist_reviews', { id: uid('rv', c.k, y, m), client_id: c.id, year: y, month: m, reviewed_by: nvId[c.nv.startsWith('nv') && ['nv4', 'nv5', 'nv6'].includes(c.nv) ? 'tp2' : 'tp1'], reviewed_at: isoVN(...Object.values(themThang(y, m, 1)), 12, 10), done_count: 0 })
    }
  }

  // ── Công nợ phí kế toán (luỹ kế một dòng / công ty / kỳ) ──
  const daThu = []    // [{c, y, m, tien, ngay}] dùng cho đối soát ngân hàng
  const thu = (c, y, m, tien, ngayISO, loai = 'ketoan', note = null) => {
    them('service_fees', { id: uid('sf', c.k, y, m, loai), client_id: c.id, year: y, month: m, amount: tien, type: loai, note, created_by: nvId[c.nv], created_at: ngayISO })
    if (loai === 'ketoan') daThu.push({ c, y, m, tien, ngay: ngayISO })
  }
  for (const c of congTy) {
    for (const { y, m } of THANG) {
      if (!dangDung(c, y, m)) continue
      if (c.quy && m % 3 !== 0) continue
      const ke = themThang(y, m, 1)
      let tien = c.fee, ngay
      const x = r()
      if (c.kieu === 'tot') ngay = x < 0.7 ? [y, m, giua(3, 25)] : [ke.y, ke.m, giua(1, 9)]
      else if (c.kieu === 'cham') {
        if (x < 0.45) ngay = [ke.y, ke.m, giua(2, 9)]
        else if (x < 0.75) ngay = [y, m, giua(15, 28)]
        else if (x < 0.9) ngay = [ke.y, ke.m, giua(1, 8)]
        else { tien = lamTron(c.fee / 2, 10000); ngay = [ke.y, ke.m, giua(3, 9)] }
      } else {
        if (x < 0.5) ngay = [ke.y, ke.m, giua(5, 9)]
        else { tien = x < 0.65 ? lamTron(c.fee * 0.5, 10000) : 0; ngay = [ke.y, ke.m, giua(1, 9)] }
      }
      if (c.giaHan && ym(y, m) >= homNayYM - 2) tien = 0                       // đang gia hạn: chưa thu
      // Kỳ đang chạy: khách tốt hay trả sớm / trả trước cuối tháng trước — để trang chủ đầu tháng không trống trơn
      if (tien && ym(y, m) === homNayYM && !daQua(ngay[0], ngay[1], ngay[2], 16) && c.kieu !== 'no' && r() < (c.kieu === 'tot' ? (c.nv === 'nv1' ? 0.8 : 0.6) : 0.3)) {
        const tr = themThang(y, m, -1)
        ngay = D > 1 ? [y, m, giua(1, D - 1)] : [tr.y, tr.m, giua(24, 28)]
      }
      if (!tien || !daQua(ngay[0], ngay[1], ngay[2], 16)) continue
      thu(c, y, m, tien, isoVN(ngay[0], ngay[1], Math.min(ngay[2], soNgay(ngay[0], ngay[1])), giua(9, 16), giua(0, 59)))
    }
  }

  // ── HCNS (phí HCNS tách riêng từ T9/2026) ──
  const tplLap = B.hcns_service_templates.filter(t => t.is_recurring)
  const tplVu = B.hcns_service_templates.filter(t => !t.is_recurring)
  const tasksCua = id => B.hcns_service_template_tasks.filter(t => t.template_id === id && t.is_active !== false)
  const hcnsTu = Math.max(ym(2026, 9), ym(dau.y, dau.m))   // HCNS_TU (lib/dongTienPhong.js)
  for (const c of congTy.filter(c => c.hcns)) {
    const hid = uid('hc', c.k)
    const phi = chon([600000, 900000, 1200000, 1500000])
    const hDau = themThang(Math.floor(hcnsTu / 12), (hcnsTu % 12) + 1, 0)
    them('hcns_clients', { id: hid, category: 'thoi_ky', name: c.name, linked_client_id: c.id, client_code: c.code, tax_code: c.mst,
      assigned_to: nvId[c.k.endsWith('1') ? 'hcns' : 'hcns2'], hcns_fee: phi, fee_period: 'monthly', status: 'active', is_active: true,
      created_at: isoVN(hDau.y, hDau.m, 1, 8) })
    for (const { y, m } of THANG) {
      if (ym(y, m) < hcnsTu) continue
      const ke = themThang(y, m, 1)
      const ngay = r() < 0.75 ? [y, m, giua(5, 25)] : [ke.y, ke.m, giua(2, 9)]
      if (daQua(ngay[0], ngay[1], ngay[2], 16) && r() < 0.88)
        them('hcns_service_fees', { id: uid('hsf', c.k, y, m), hcns_client_id: hid, year: y, month: m, amount: phi, type: 'hcns', created_by: nvId.hcns, created_at: isoVN(ngay[0], ngay[1], ngay[2], 10) })
      for (const tpl of tplLap) for (const t of tasksCua(tpl.id)) {
        const xong = ym(y, m) < homNayYM ? r() < 0.93 : r() < 0.3
        them('hcns_recurring_tasks', { id: uid('hrt', c.k, y, m, t.id), hcns_client_id: hid, template_task_id: t.id, year: y, month: m, done: xong, done_by: xong ? nvId.hcns2 : null, done_at: xong ? isoVN(y, m, Math.min(soNgay(y, m), t.deadline_day || 20) - giua(0, 3), 10) : null })
        if (t.requires_headcount && (ym(y, m) < homNayYM)) them('hcns_headcount', { id: uid('hh', c.k, y, m), hcns_client_id: hid, year: y, month: m, headcount: 5 + (c.k.length * 3 + m) % 20, unchanged: r() < 0.6, entered_by: nvId.hcns2, entered_at: isoVN(y, m, 15, 10) })
      }
    }
  }
  // Hồ sơ Thời điểm (theo vụ việc)
  const VU = ['CÔNG TY TNHH NỘI THẤT ÁNH SAO', 'CÔNG TY CP CÔNG NGHỆ HẠ LONG', 'CÔNG TY TNHH VẬN TẢI PHÚ AN', 'CÔNG TY TNHH DƯỢC PHẨM TÂM ĐỨC',
    'CÔNG TY TNHH GIÁO DỤC TƯƠNG LAI', 'CÔNG TY TNHH THỰC PHẨM XANH']
  VU.forEach((ten, i) => {
    const hid = uid('hcv', i)
    them('hcns_clients', { id: hid, category: 'thoi_diem', name: ten, case_code: 'HS' + pad(i + 1), tax_code: '88' + (20000000 + i * 1371), phone: '09000002' + pad(i),
      assigned_to: nvId[i % 2 ? 'hcns2' : 'hcns'], hcns_fee: 0, status: 'active', is_active: true, created_at: isoVN(...Object.values(themThang(Y, M, -(i % 4))), 1, 9) })
    const soDv = 1 + (i % 3)
    for (let j = 0; j < soDv; j++) {
      const tpl = tplVu[(i * 3 + j) % tplVu.length]; if (!tpl) continue
      const nhan = themThang(Y, M, -((i + j) % 4))
      const nhanNgay = ymd(nhan.y, nhan.m, Math.min(D > 1 && nhan.m === M && nhan.y === Y ? D - 1 : 25, 3 + i * 4) || 1)
      const sid = uid('hcs', i, j)
      const due = hcnsDueDate(nhanNgay, tpl.sla_days || 10)
      const ds = tasksCua(tpl.id)
      const xongHet = (i + j) % 3 !== 0 && due <= ymd(Y, M, D)
      const cost = [1500000, 2500000, 3500000, 3000000][(i + j) % 4]
      them('hcns_case_services', { id: sid, hcns_client_id: hid, template_id: tpl.id, cost, received_at: nhanNgay, expected_at: due, due_at: due,
        status: xongHet ? 'hoan_thanh' : 'thu_thap', note: null, created_at: isoVN(...nhanNgay.split('-').map(Number), 9), completed_at: xongHet ? isoVN(...due.split('-').map(Number), 15) : null })
      ds.forEach((t, k) => {
        const xong = xongHet || k < ds.length / 2
        them('hcns_case_service_tasks', { id: uid('hct', i, j, t.id), case_service_id: sid, template_task_id: t.id, done: xong, done_by: xong ? nvId.hcns : null, done_at: xong ? isoVN(...nhanNgay.split('-').map(Number), 14) : null })
      })
      if (j === 0) them('hcns_case_payments', { id: uid('hcp', i), hcns_client_id: hid, case_service_id: sid, amount: xongHet ? cost : lamTron(cost / 2, 100000), note: 'Khách chuyển khoản', created_by: nvId.hcns, created_at: isoVN(...nhanNgay.split('-').map(Number), 16), paid_at: nhanNgay })
      if (j === 0) them('hcns_case_notes', { id: uid('hcn', i), case_service_id: sid, hcns_client_id: hid, content: xongHet ? 'Đã nộp hồ sơ, có kết quả, đã gửi bản chụp cho khách.' : 'Đang chờ khách gửi bổ sung giấy tờ.', created_by: nvId.hcns, created_at: isoVN(...nhanNgay.split('-').map(Number), 17) })
    }
  })

  // ── Dịch vụ khác ──
  const DVK = [['Quyết toán thuế TNCN năm', 3500000], ['Đăng ký BHXH lần đầu', 3000000], ['Hồ sơ chuyển quận', 2500000], ['Đào tạo đọc BCTC cho Ban Giám đốc', 5000000], ['Đăng ký mã số thuế nhà thầu', 1500000], ['Thay đổi đăng ký kinh doanh', 2000000]]
  DVK.forEach(([ten, tien], i) => {
    const c = congTy[(i * 7 + 2) % congTy.length]; const t = themThang(Y, M, -(i % 4))
    const sid = uid('os', i); const tra = i % 3 === 0 ? tien : i % 3 === 1 ? lamTron(tien / 2, 100000) : 0
    them('other_services', { id: sid, client_id: c.id, name: ten, amount: tien, year: t.y, month: t.m, status: tra >= tien ? 'done' : 'open', note: null, created_by: nvId[c.nv], created_at: isoVN(t.y, t.m, 5, 10), closed_at: tra >= tien ? isoVN(t.y, t.m, 20, 10) : null, closed_by: tra >= tien ? nvId[c.nv] : null })
    if (tra) them('other_service_payments', { id: uid('osp', i), service_id: sid, client_id: c.id, amount: tra, year: t.y, month: t.m, note: null, created_by: nvId[c.nv], created_at: isoVN(t.y, t.m, 18, 10) })
    if (tra && i < 3) them('luong_dvk_khai', { id: uid('dvk', i), staff_id: nvId[c.nv], nam: t.y, thang: t.m, service_id: sid, client_id: c.id, ten_dv: ten, so_tien: tra, ty_le: 10, tien_thuong: Math.round(tra / (c.khongVat ? 1 : 1.08) * 0.1), ghi_chu: null, trang_thai: i === 2 ? 'cho_duyet' : 'da_duyet', duyet_boi: i === 2 ? null : nvId.tp1, duyet_luc: i === 2 ? null : isoVN(t.y, t.m, 25, 10) })
  })

  // Vi phạm KPI
  them('kpi_violations', { id: uid('vp', 1), staff_id: nvId.nv3, year: themThang(Y, M, -1).y, month: themThang(Y, M, -1).m, reason: 'Nộp tờ khai trễ hạn, khách bị nhắc nợ thuế', created_by: nvId.tp1 })

  // ── Kinh doanh ──
  const kenh = B.sales_channels.filter(k => k.is_active !== false)
  const GD = ['tu_van', 'gui_khao_sat', 'bao_gia', 'chot_bao_gia', 'gui_hd', 'chot', 'that_bai']
  const NHU_CAU = ['Kế toán trọn gói', 'Kế toán + HCNS', 'Báo cáo tài chính năm', 'Dọn dẹp sổ sách', 'Thành lập công ty + kế toán']
  let soBg = 0
  for (let i = 0; i < 28; i++) {
    const lid = uid('lead', i)
    const gd = GD[[0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 5, 5, 5, 6, 6][i % 16]]
    const tao = themThang(Y, M, -(i % 6))
    const ngayTao = isoVN(tao.y, tao.m, Math.min(1 + (i * 3) % 27, tao.m === M && tao.y === Y ? Math.max(1, D) : 28), 9)
    const tenCty = (i % 4 === 0 ? 'CÔNG TY CỔ PHẦN ' : 'CÔNG TY TNHH ') + ['HƯNG THỊNH', 'MINH PHÁT', 'AN NHIÊN', 'THÀNH CÔNG', 'TÂM VIỆT', 'SÀI GÒN XANH', 'PHÚC LỘC', 'ĐẠI THÀNH', 'VIỆT HÀN', 'HOA SEN', 'NHẬT MINH', 'TRƯỜNG PHÁT', 'KIM PHÁT', 'BẢO AN'][i % 14] + (i >= 14 ? ' ' + ['MEDIA', 'FOOD', 'TECH', 'HOME', 'LOGISTICS', 'BEAUTY', 'TRAVEL'][i % 7] : '')
    const nguoi = nvId[i % 3 ? 'kd2' : 'kd']
    them('sales_leads', { id: lid, company_name: tenCty, contact_name: chon(HO) + ' ' + chon(DEM) + ' ' + chon(TEN), phone: '0900001' + pad(100 + i).slice(-3), phone_norm: '0900001' + pad(100 + i).slice(-3),
      email: null, tax_code: i % 3 ? '88' + (30000000 + i * 977) : null, tax_norm: i % 3 ? '88' + (30000000 + i * 977) : null, address: chon(QUAN) + ', TP Hồ Chí Minh', need: NHU_CAU[i % 5],
      channel_id: kenh.length ? kenh[i % kenh.length].id : null, source_note: null, assigned_to: nguoi, stage: gd, lost_reason: gd === 'that_bai' ? 'Khách chọn đơn vị khác giá thấp hơn' : null,
      next_follow_up: ['tu_van', 'gui_khao_sat', 'bao_gia'].includes(gd) ? ymd(...Object.values(themThang(Y, M, 0)), Math.min(soNgay(Y, M), D + 2 + (i % 10))) : null,
      note: null, created_by: nguoi, created_at: ngayTao, updated_at: ngayTao, stage_changed_at: ngayTao, is_deleted: false })
    them('sales_lead_activities', { id: uid('la', i, 0), lead_id: lid, kind: 'goi', content: 'Gọi điện tư vấn lần đầu, khách quan tâm ' + NHU_CAU[i % 5].toLowerCase(), created_by: nguoi, created_at: ngayTao })
    if (GD.indexOf(gd) >= 2 && gd !== 'that_bai' || (gd === 'that_bai' && i % 2)) {
      const survey = { company: tenCty, sector: ['tm', 'dv', 'sx'][i % 3], revenueYear: [0, 3e9, 8e9, 12e9, 4e9][i % 5], invIn: [10, 25, 40, 60][i % 4], invOut: [8, 20, 35, 50][i % 4],
        bankStmt: [5, 10, 20][i % 3], laborBh: [0, 3, 8, 15][i % 4], laborNoBh: i % 2, wantHcns: i % 4 === 1, hcnsHeads: i % 4 === 1 ? 6 : 0, area: ['none', 'a', 'b'][i % 3], monthlyFiling: i % 5 === 2 }
      const giam = i % 6 === 2
      const pq = priceQuote(survey, giam ? { on: true, amount: 0 } : null)
      const mf = giam ? lamTron(pq.standardMonthly * 0.9, 100000) : pq.monthlyFinal
      const qd = new Date(new Date(ngayTao).getTime() + 3 * 86400e3)
      const qdVN = new Date(Math.min(qd.getTime(), now.getTime()) + 7 * 3600e3)
      soBg++
      const qDate = qdVN.toISOString().slice(0, 10)
      const contract = contractForStage(gd, gd === 'that_bai' ? 'sent' : 'draft')
      them('sales_quotes', { id: uid('q', i), lead_id: lid, quote_date: qDate, seq: soBg, quote_no: qDate.slice(8, 10) + qDate.slice(5, 7) + pad(soBg),
        author_id: nguoi, author_name: NHAN_VIEN.find(n => nvId[n.k] === nguoi).ten, company_name: tenCty, tax_code: null,
        survey: pq.survey, fees: pq.fees, standard_monthly: pq.standardMonthly, monthly_final: mf, override_on: giam, override_amount: giam ? mf : null,
        override_reason: giam ? 'Khách ký hợp đồng 2 năm, đề xuất giảm 10%' : null, price_status: giam ? (i % 12 === 2 ? 'pending' : 'approved') : 'ok',
        reviewed_by: giam && i % 12 !== 2 ? nvId.giamdoc : null, reviewed_at: giam && i % 12 !== 2 ? qd.toISOString() : null,
        contract_status: contract, contract_changed_at: contract !== 'draft' ? qd.toISOString() : null, is_deleted: false, created_at: qd.toISOString(), updated_at: qd.toISOString() })
      them('sales_lead_activities', { id: uid('la', i, 1), lead_id: lid, kind: 'he_thong', content: 'Lập báo giá số ' + qDate.slice(8, 10) + qDate.slice(5, 7) + pad(soBg), created_by: nguoi, created_at: qd.toISOString() })
    }
  }

  // ── Đối soát ngân hàng: giao dịch 40 ngày gần nhất ──
  const tu40 = new Date(now.getTime() - 40 * 86400e3).toISOString()
  let soGd = 0
  const gd = (row) => them('bank_transactions', { id: uid('bt', soGd), source: soGd % 3 ? 'acb' : 'tcb', ext_id: 'DEMO' + pad(soGd++).padStart(6, '0'), account: soGd % 3 ? '0000 1111 2222 (ACB)' : '1903 0000 1111 (TCB)', created_at: row.tx_time, ...row })
  const kyChu = (y, m, c) => c.quy ? 'Q' + Math.ceil(m / 3) : 'T' + pad(m)
  for (const p of daThu.filter(p => p.ngay >= tu40 && p.tien === p.c.fee)) {
    const kieu = (soGd % 4)
    const memo = (kieu === 3 ? p.c.mst : p.c.code) + ' TT PHI DICH VU ' + kyChu(p.y, p.m, p.c) + ' ' + p.y + ' CONG TY CO PHAN TU VAN THUE SAVITAX'
    const id = uid('bt', soGd)
    if (kieu === 0) {
      gd({ tx_time: p.ngay, amount: p.tien, memo, state: 'posted', client_id: p.c.id, period_year: p.y, period_month: p.m, posted_at: p.ngay, posted_by: null,
        post_detail: { plan: [{ kind: 'ketoan', year: p.y, month: p.m, amount: p.tien }], done: [{ kind: 'ketoan', year: p.y, month: p.m, amount: p.tien }], tuDong: true }, note: 'Tự ghi công nợ' })
      them('bank_action_logs', { id: uid('bal', id), tx_id: id, client_id: p.c.id, action: 'post', detail: 'Tự ghi công nợ: Kế toán T' + p.m + '/' + p.y + ' ' + p.tien.toLocaleString('vi-VN') + 'đ', note: 'Tự động', staff_id: null, created_at: p.ngay })
    } else if (kieu === 1) {
      gd({ tx_time: p.ngay, amount: p.tien, memo, state: 'ignored', client_id: p.c.id, period_year: p.y, period_month: p.m, posted_at: p.ngay, note: 'Tự khớp sổ — nhân viên đã ghi tay khoản này' })
      them('bank_action_logs', { id: uid('bal', id), tx_id: id, client_id: p.c.id, action: 'ignore', detail: 'Tự khớp sổ — nhân viên đã ghi tay khoản này', note: 'Tự động', staff_id: null, created_at: p.ngay })
    } else gd({ tx_time: p.ngay, amount: p.tien, memo, state: 'open' })          // trang tự nhận ra "Đã khớp sổ"
  }
  // Tiền về chưa ai ghi: một số đúng mã + kỳ (Sẵn sàng), một số chỉ có tên (Cần xem), một số lạ
  const chuaThu = congTy.filter(c => !c.ngung && !c.quy && c.kieu !== 'no').slice(0, 6)
  const truoc = themThang(Y, M, -1)
  chuaThu.forEach((c, i) => {
    const daCo = (B.service_fees || []).some(f => f.client_id === c.id && f.year === truoc.y && f.month === truoc.m && f.type === 'ketoan')
    if (daCo) return
    const t = new Date(now.getTime() - (i + 1) * 5 * 3600e3).toISOString()
    gd({ tx_time: t, amount: c.fee, memo: i % 2 ? c.name.replace(/CÔNG TY (TNHH|CỔ PHẦN)( THƯƠNG MẠI DỊCH VỤ| ĐẦU TƯ| XÂY DỰNG| SẢN XUẤT)?/, 'CTY') + ' CHUYEN TIEN PHI KE TOAN' : c.code + ' TTPHIDICHVU T' + pad(truoc.m) + ' ' + truoc.y, state: 'open' })
  })
  // "Sẵn sàng ghi" để khách bấm thử: đúng mã + kỳ + đủ tiền, nhưng công ty còn nợ tồn nên KHÔNG tự ghi
  congTy.filter(c => c.noCu && !c.quy && !c.ngung).forEach((c, i) => {
    if ((B.service_fees || []).some(f => f.client_id === c.id && f.year === Y && f.month === M && f.type === 'ketoan')) return
    gd({ tx_time: new Date(now.getTime() - (3 + i * 7) * 3600e3).toISOString(), amount: c.fee, memo: c.code + ' TTPHIDICHVU T' + pad(M) + ' ' + Y, state: 'open' })
  })
  gd({ tx_time: new Date(now.getTime() - 26 * 3600e3).toISOString(), amount: 15000000, memo: 'HOAN TIEN DAT COC VAN PHONG', state: 'open' })
  gd({ tx_time: new Date(now.getTime() - 50 * 3600e3).toISOString(), amount: 2000000, memo: 'NGUYEN VAN B CHUYEN TIEN', state: 'open' })

  // ── Tờ khai: tài khoản cổng (mật khẩu giả, mã hoá ở bước nạp) ──
  for (const c of congTy) {
    if (c.ngung) continue
    them('tax_accounts', { id: uid('ta', c.k), client_id: c.id, portal: 'dvc', username: c.mst, password_enc: '__MA_HOA__:DemoMatKhau@' + c.k, status: c.k === 'c19' ? 'wrong_password' : 'active',
      last_success_at: c.k === 'c19' ? null : new Date(now.getTime() - (2 + (c.k.length % 5)) * 86400e3).toISOString(), consent_by: nvId[c.nv], consent_at: isoVN(dau.y, dau.m, 2, 9) })
    const cred = [['thue', 'Thuế điện tử', c.mst], ['hoadon', 'Hóa đơn điện tử', c.mst], ['bhxh', 'BHXH', 'BHXH' + c.mst.slice(-6)]]
    cred.forEach(([cat, label, user], j) => them('client_credentials', { id: uid('cc', c.k, j), client_id: c.id, category: cat, label, username: user, password: null, password_enc: '__MA_HOA__:DemoMatKhau@' + c.k + j, sort_order: j, updated_by: nvId[c.nv] }))
  }

  // ── Tiền lương ──
  const CAP = [['KT1', 'Kế toán bậc 1', 'nhan_vien', 1, 7500000, 15000000, 5500000, 'Mới vào nghề, làm 4–6 công ty. Lên bậc 2 sau 12 tháng đạt KPI ≥ 90%.'],
    ['KT2', 'Kế toán bậc 2', 'nhan_vien', 2, 9000000, 25000000, 6500000, 'Phụ trách 6–8 công ty. Lên bậc 3 sau 18 tháng.'],
    ['KT3', 'Kế toán bậc 3', 'nhan_vien', 3, 11000000, 35000000, 7500000, 'Phụ trách 8–10 công ty, kèm nhân viên mới.'],
    ['TP', 'Trưởng phòng', 'quan_ly', 4, 15000000, null, 9000000, 'Quản lý phòng, duyệt checklist, chịu KPI phòng.'],
    ['GD', 'Giám đốc', 'quan_ly', 5, 30000000, null, 12000000, 'Ban giám đốc.']]
  for (const [ma, ten, nhom, tt, lcb, dt, bh, mt] of CAP) them('luong_cap_bac', { ma, ten, nhom, thu_tu: tt, luong_co_ban: lcb, doanh_thu_toi_thieu: dt, luong_bhxh: bh, mo_ta: mt })
  const thangLuong = themThang(Y, M, -1)
  for (const n of NHAN_VIEN) {
    const sid = nvId[n.k]; const cap = CAP.find(x => x[0] === n.cap)
    them('luong_nhan_vien', { id: uid('lnv', n.k), staff_id: sid, ap_dung_tu: startWin, cap_bac: n.cap, luong_co_ban: n.luong, doanh_thu_toi_thieu: cap?.[5] ?? null, luong_bhxh: n.thuViec ? null : cap?.[6], tham_gia_bhxh: !n.thuViec, ghi_chu: n.thuViec ? 'Thử việc' : null, tao_boi: nvId.nb, so_nguoi_phu_thuoc: n.k.length % 3 === 0 ? 1 : 0 })
    them('luong_ngan_hang', { staff_id: sid, ngan_hang: 'Ngân hàng TMCP Á Châu (ACB)', ma_ngan_hang: 'ACB', so_tai_khoan: '9' + String(100000000 + NHAN_VIEN.indexOf(n) * 1234567).slice(0, 9), chu_tai_khoan: n.ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase(), sua_boi: nvId.nb })
    // Hai tháng trước: đã xác nhận ngày công. Tháng này để trống cho khách tự khai thử.
    for (const t of [themThang(Y, M, -2), thangLuong]) {
      const chuan = ngayCongChuan(t.y, t.m, (B.luong_ngay_le || []).map(x => String(x.ngay).slice(0, 10))).chuan
      const nghi = (NHAN_VIEN.indexOf(n) + t.m) % 4 === 0 ? 1 : 0
      them('luong_cham_cong', { id: uid('lcc', n.k, t.y, t.m), staff_id: sid, nam: t.y, thang: t.m, ngay_di_lam: chuan - nghi, nghi_phep: nghi, nghi_khong_luong: 0,
        ngay_cong_chuan: chuan, ghi_chu: null, trang_thai: 'da_xac_nhan', xac_nhan_luc: isoVN(...Object.values(themThang(t.y, t.m, 1)), 2, 10),
        so_lan_vi_pham: n.k === 'nv3' ? 1 : 0, nguon: 'tu_khai' })
    }
  }
  them('luong_dieu_chinh', { nam: thangLuong.y, thang: thangLuong.m, staff_id: nvId.nv2, phu_cap: 500000, dieu_chinh: 0, ly_do: 'Phụ cấp xăng xe đi khách', sua_boi: nvId.nb })
  them('luong_dieu_chinh', { nam: thangLuong.y, thang: thangLuong.m, staff_id: nvId.nv5, phu_cap: 0, dieu_chinh: -200000, ly_do: 'Trừ đi muộn 2 lần', sua_boi: nvId.nb })

  // Nhật ký sửa thông tin công ty (vài dòng cho trang Lịch sử)
  congTy.slice(0, 5).forEach((c, i) => them('client_change_log', { id: uid('ccl', i), client_id: c.id, entity: 'client', entity_label: c.name, field: 'address', old_value: 'Địa chỉ cũ', new_value: 'Cập nhật địa chỉ theo giấy phép mới', action: 'update', changed_by: nvId[c.nv], changed_at: isoVN(...Object.values(themThang(Y, M, -(i + 1))), 10, 9) }))

  return {
    bang: B,
    // Việc làm SAU khi nạp — đi qua đúng hàm của app (lib/demo/datLai.js)
    sauNap: {
      Y, M, congTy: congTy.map(c => ({ id: c.id, k: c.k, nv: c.nv, mst: c.mst, ngung: c.ngung, kieu: c.kieu, quy: c.quy, fee: c.fee })),
      nvId,
      thangChotLuong: themThang(Y, M, -2),
      thangLuongGui: themThang(Y, M, -2),
    },
  }
}
