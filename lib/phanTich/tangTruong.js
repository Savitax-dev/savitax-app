// Tăng trưởng & phí — 6 chỉ tiêu theo quý + căn cứ điều chỉnh phí (kế hoạch mục 3b, mockup soat-6-tang-truong).
//
// Hàm THUẦN: nhận số liệu đã đọc từ thư mục từng năm (docHoSo.js) + thông tin phí (route /api/admin/phantich/phi)
// → bảng quý, so sánh, phí theo biểu phí. Không đọc file, không gọi mạng → kiểm bằng node (test-phantich-tangtruong).
//
// Nguyên tắc (anh chốt 25–26/10/2026):
// - Quý thiếu nguồn hiện "—", không đoán. Mỗi số có nhãn nguồn.
// - Chỉ tính quý ĐÃ KẾT THÚC.
// - Phí: dùng ĐÚNG engine biểu phí của phân hệ Kinh doanh (lib/salesPricing.js computeFees), ngành mặc định thương
//   mại. Biểu phí là giá CHƯA VAT → × HE_SO_VAT (1,08, hằng số chung với phân hệ Lương). Mọi số phí hiển thị GỒM VAT.
// - Phí đang thu: clients.monthly_fee đã gồm VAT; công ty thu theo QUÝ thì đó là tiền cả quý → chia 3.
import { computeFees, normalizeSurvey } from '../salesPricing.js'
import { HE_SO_VAT } from '../luong/thuong.js'
import { laBanChuaNop } from './soatKy.js'

export const CHI_TIEU = [
  { k: 'doanhThu', nhan: 'Doanh thu', donVi: 'đồng' },
  { k: 'laoDong', nhan: 'Lao động trên bảng lương', donVi: 'người' },
  { k: 'hdVao', nhan: 'Hóa đơn đầu vào', donVi: 'hóa đơn' },
  { k: 'hdRa', nhan: 'Hóa đơn đầu ra', donVi: 'hóa đơn' },
  { k: 'haiQuan', nhan: 'Tờ khai hải quan', donVi: 'tờ khai' },
  { k: 'saoKe', nhan: 'Giao dịch sao kê ngân hàng', donVi: 'giao dịch' },
]

const thangQ = so => [3 * so - 2, 3 * so - 1, 3 * so]
const khoaT = (nam, t) => `${nam}-${String(t).padStart(2, '0')}`
const ketThucQ = (nam, so) => `${nam}-${String(3 * so).padStart(2, '0')}-${so === 1 || so === 4 ? 31 : 30}`
export const tenQ = (nam, so) => `Q${so}/${String(nam).slice(2)}`
const pt = (a, b) => (a == null || b == null || b === 0 ? null : (a - b) / b)

// ── Từng chỉ tiêu của một quý ───────────────────────────────────────────────

// Doanh thu: Σ[34] tờ khai 01/GTGT các kỳ trong quý (bản nộp sau cùng; chỉ có bản chưa nộp thì dùng bản đó).
function doanhThuQ(toKhai, nam, so, bangKe) {
  const gtgt = toKhai.filter(t => t.loai === '01/GTGT' && t.ky?.nam === nam)
  const theoKy = new Map()
  for (const t of gtgt) {
    const ma = t.ky.loai === 'Q' ? 'Q' + t.ky.so : 'T' + t.ky.so
    const cu = theoKy.get(ma)
    const hon = !cu || (laBanChuaNop(cu) && !laBanChuaNop(t)) || (laBanChuaNop(cu) === laBanChuaNop(t) && (t.lanBoSung > cu.lanBoSung || (t.lanBoSung === cu.lanBoSung && String(t.ngayLap) > String(cu.ngayLap))))
    if (hon) theoKy.set(ma, t)
  }
  const q = theoKy.get('Q' + so)
  if (q) return { v: q.chiTieu['34'] ?? null, nguon: 'Σ[34] tờ khai 01/GTGT' }
  const thang = thangQ(so).map(t => theoKy.get('T' + t))
  if (thang.some(Boolean)) {
    const thieu = thangQ(so).filter((t, i) => !thang[i])
    return { v: thang.reduce((s, t) => s + (t?.chiTieu['34'] || 0), 0), nguon: 'Σ[34] tờ khai 01/GTGT', thieu: thieu.length ? thieu.map(t => 'T' + t) : null }
  }
  // Dự phòng: tổng tiền chưa thuế hóa đơn bán ra trên bảng kê cổng (đã bỏ hóa đơn hủy / bị thay thế)
  const cong = bangKe.filter(b => b.mau === 'cong' && b.chieu === 'ban_ra')
  const coThang = thangQ(so).filter(t => cong.some(b => b.tienTheoThang?.[khoaT(nam, t)] != null))
  if (!coThang.length) return { v: null }
  const v = coThang.reduce((s, t) => s + cong.reduce((x, b) => x + (b.tienTheoThang?.[khoaT(nam, t)] || 0), 0), 0)
  const thieu = thangQ(so).filter(t => !coThang.includes(t))
  return { v, nguon: 'Bảng kê bán ra cổng HĐĐT', thieu: thieu.length ? thieu.map(t => 'T' + t) : null }
}

// Số hóa đơn duy nhất của quý theo một chiều: bảng kê cổng → (thiếu) bảng kê phần mềm → (mua vào) file XML
function soHoaDonQ(bangKe, hoaDonTep, nam, so, chieu) {
  const dem = (mau) => {
    const ds = bangKe.filter(b => (mau === 'cong' ? b.mau === 'cong' : b.mau?.startsWith('pm_')) && b.chieu === chieu)
    const khoa = new Set(), coThang = new Set()
    for (const t of thangQ(so)) for (const b of ds) { const k = b.khoaTheoThang?.[khoaT(nam, t)]; if (k) { coThang.add(t); k.forEach(x => khoa.add(x)) } }
    return coThang.size ? { v: khoa.size, thieu: thangQ(so).filter(t => !coThang.has(t)) } : null
  }
  const nhan = chieu === 'mua_vao' ? 'mua vào' : 'bán ra'
  const c = dem('cong')
  if (c) return { v: c.v, nguon: `Bảng kê ${nhan} cổng HĐĐT`, thieu: c.thieu.length ? c.thieu.map(t => 'T' + t) : null }
  const p = dem('pm')
  if (p) return { v: p.v, nguon: `Bảng kê ${nhan} kèm tờ khai`, thieu: p.thieu.length ? p.thieu.map(t => 'T' + t) : null }
  if (chieu === 'mua_vao') {
    const xml = hoaDonTep.filter(t => t.chieu === 'mua_vao' && t.duoi === 'xml' && t.thang?.length && t.thang.every(m => thangQ(so).includes(m)))
    if (xml.length) return { v: xml.length, nguon: 'File hóa đơn XML mua vào' }
  }
  return { v: null }
}

// Lao động: bình quân số người có lương các tháng trong quý; dự phòng [16] tờ khai 05/KK-TNCN
function laoDongQ(bangLuong, toKhai, nam, so) {
  const thang = thangQ(so).map(t => bangLuong.find(b => (b.nam ?? nam) === nam && b.thang === t)).filter(Boolean)
  if (thang.length) {
    const tb = thang.reduce((s, b) => s + b.tong.soNguoi, 0) / thang.length
    const coBh = thang.reduce((s, b) => s + b.tong.soNguoiDongBh, 0) / thang.length
    const thieu = thangQ(so).filter(t => !bangLuong.some(b => (b.nam ?? nam) === nam && b.thang === t))
    return { v: Math.round(tb * 10) / 10, nguon: 'Bình quân tháng · bảng lương', coBh: Math.round(coBh * 10) / 10, thieu: thieu.length ? thieu.map(t => 'T' + t) : null }
  }
  const tncn = toKhai.find(t => t.loai === '05/KK-TNCN' && t.ky?.nam === nam && t.ky.loai === 'Q' && t.ky.so === so)
  if (tncn?.chiTieu['16'] != null) return { v: tncn.chiTieu['16'], nguon: '[16] tờ khai 05/KK-TNCN' }
  return { v: null }
}

function haiQuanQ(hq, nam, so) {
  if (!hq) return { v: null }
  if (hq.kps) return { v: 0, nguon: 'Thư mục 4. TỜ KHAI HẢI QUAN (kps)' }
  if (!hq.toKhai.length && !hq.khongRoNgay.length && !hq.coThuMuc) return { v: null }
  const v = hq.toKhai.filter(t => t.ngay && Number(t.ngay.slice(0, 4)) === nam && thangQ(so).includes(Number(t.ngay.slice(5, 7)))).length
  return { v, nguon: 'Thư mục 4. TỜ KHAI HẢI QUAN · theo ngày đăng ký', khongRoNgay: hq.khongRoNgay.length || null }
}

function saoKeQ(sk, nam, so) {
  if (!sk || !sk.soFile) return { v: null }
  const dem = thangQ(so).map(t => sk.giaoDich.filter(g => g.ngay.startsWith(khoaT(nam, t))).length)
  if (dem.every(n => n === 0)) return { v: null, nguon: 'Sổ phụ ngân hàng', thieu: thangQ(so).map(t => 'T' + t) }
  const thieu = thangQ(so).filter((t, i) => !dem[i])
  return { v: dem.reduce((a, b) => a + b, 0), nguon: 'Sổ phụ ngân hàng · mọi tài khoản', thieu: thieu.length ? thieu.map(t => 'T' + t) : null }
}

// ── Bảng quý ─────────────────────────────────────────────────────────────────

// duLieu: { [nam]: { toKhai, bangKe, bangLuong, saoKe, haiQuan, hoaDonTep } }
export function tinhQuy(duLieu, { homNay } = {}) {
  homNay = homNay || new Date().toISOString().slice(0, 10)
  const ra = []
  for (const nam of Object.keys(duLieu).map(Number).sort((a, b) => a - b)) {
    const d = duLieu[nam]
    for (const so of [1, 2, 3, 4]) {
      if (ketThucQ(nam, so) >= homNay) continue                        // quý chưa kết thúc
      const ct = {
        doanhThu: doanhThuQ(d.toKhai || [], nam, so, d.bangKe || []),
        laoDong: laoDongQ(d.bangLuong || [], d.toKhai || [], nam, so),
        hdVao: soHoaDonQ(d.bangKe || [], d.hoaDonTep || [], nam, so, 'mua_vao'),
        hdRa: soHoaDonQ(d.bangKe || [], d.hoaDonTep || [], nam, so, 'ban_ra'),
        haiQuan: haiQuanQ(d.haiQuan, nam, so),
        saoKe: saoKeQ(d.saoKe, nam, so),
      }
      const coSo = Object.values(ct).some(x => x.v != null)
      if (!coSo) continue
      // Chứng từ/tháng = (HĐ vào + HĐ ra + giao dịch sao kê) ÷ 3 — đúng đơn vị biểu phí phân hệ Kinh doanh
      const phan = [ct.hdVao.v, ct.hdRa.v, ct.saoKe.v]
      const chungTu = phan.some(x => x != null) ? Math.round(phan.reduce((s, x) => s + (x || 0), 0) / 3) : null
      ct.chungTu = { v: chungTu, nguon: '(HĐ vào + HĐ ra + sao kê) ÷ 3', thieu: chungTu != null && phan.some(x => x == null) ? ['thiếu ' + ['HĐ vào', 'HĐ ra', 'sao kê'].filter((_, i) => phan[i] == null).join(', ')] : null }
      ra.push({ nam, so, ma: tenQ(nam, so), chiTieu: ct, kyKhaiThang: (d.toKhai || []).some(t => t.loai === '01/GTGT' && t.ky?.nam === nam && t.ky.loai === 'T') })
    }
  }
  return ra
}

// So sánh một chỉ tiêu của quý i với quý trước, cùng kỳ năm trước, và mốc
export function soSanh(quy, i, k, iMoc) {
  const q = quy[i]
  const truoc = quy.find(x => (x.nam * 4 + x.so) === (q.nam * 4 + q.so - 1))
  const cungKy = quy.find(x => x.nam === q.nam - 1 && x.so === q.so)
  const moc = iMoc != null ? quy[iMoc] : null
  const v = q.chiTieu[k]?.v
  return { qTruoc: pt(v, truoc?.chiTieu[k]?.v), cungKy: pt(v, cungKy?.chiTieu[k]?.v), moc: moc && moc !== q ? pt(v, moc.chiTieu[k]?.v) : null }
}

// ── Phí ──────────────────────────────────────────────────────────────────────

// Mốc so sánh: quý của lần đổi phí gần nhất (fee_plan), chưa từng đổi thì quý bắt đầu hợp đồng
export function chonMoc(quy, { feePlans = [], contractStart = null } = {}) {
  const gan = [...feePlans].sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0]
  let nam, so, lyDo
  if (gan) { nam = gan.year; so = Math.ceil(gan.month / 3); lyDo = 'lần đổi phí gần nhất' }
  else if (contractStart) { nam = +String(contractStart).slice(0, 4); so = Math.ceil(+String(contractStart).slice(5, 7) / 3); lyDo = 'bắt đầu hợp đồng' }
  if (nam == null) return { i: quy.length ? 0 : null, lyDo: 'quý đầu tiên có dữ liệu (chưa có mốc đổi phí)', ngoaiDuLieu: false }
  const i = quy.findIndex(q => q.nam === nam && q.so === so)
  if (i >= 0) return { i, lyDo, ten: tenQ(nam, so) }
  // Mốc nằm ngoài khoảng dữ liệu (thường là năm cũ chưa trỏ thư mục) → lấy quý đầu tiên, nói rõ
  return { i: quy.length ? 0 : null, lyDo, ten: tenQ(nam, so), ngoaiDuLieu: true }
}

// Doanh thu 4 quý tính tới quý i (đủ 4 quý thì cộng; ít hơn thì quy ra năm theo số quý có)
export function doanhThu4Quy(quy, i) {
  const ds = quy.slice(Math.max(0, i - 3), i + 1).map(q => q.chiTieu.doanhThu.v).filter(v => v != null)
  if (!ds.length) return { v: null }
  const tong = ds.reduce((a, b) => a + b, 0)
  return ds.length === 4 ? { v: tong, du: true } : { v: Math.round(tong * 4 / ds.length), du: false, soQuy: ds.length }
}

// Phí theo biểu phí (đã GỒM VAT) với khối lượng của quý i
export function phiTheoBieuPhi(quy, i) {
  const q = quy[i]
  if (!q) return null
  const ct = q.chiTieu
  const coHaiQuan = quy.slice(Math.max(0, i - 3), i + 1).some(x => (x.chiTieu.haiQuan.v || 0) > 0)
  const dt = doanhThu4Quy(quy, i)
  const survey = normalizeSurvey({
    sector: 'tm', customs: coHaiQuan, revenueYear: dt.v || 0, monthlyFiling: q.kyKhaiThang,
    invIn: Math.round((ct.hdVao.v || 0) / 3), invOut: Math.round((ct.hdRa.v || 0) / 3), bankStmt: Math.round((ct.saoKe.v || 0) / 3),
  })
  const fees = computeFees(survey)
  return {
    quy: q.ma, chungTu: survey.docs, coHaiQuan, doanhThu4Quy: dt, keKhaiThang: q.kyKhaiThang,
    chuaVat: fees.monthly, gomVat: Math.round(fees.monthly * HE_SO_VAT), canCu: fees.basis, canhBao: fees.warnings,
  }
}

// Phí đang thu quy về THÁNG, gồm VAT (monthly_fee đã gồm VAT; thu theo quý → chia 3)
export const phiDangThuThang = (monthlyFee, feePeriod) => (monthlyFee == null ? null : Math.round(Number(monthlyFee) / (feePeriod === 'quarterly' ? 3 : 1)))

// ── Bản gửi khách hàng ───────────────────────────────────────────────────────

const soVN = (n, k) => (k === 'doanhThu' ? (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ đồng' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 }))
const DON_VI = { doanhThu: '', laoDong: ' người', hdVao: ' hóa đơn', hdRa: ' hóa đơn', haiQuan: ' tờ khai', saoKe: ' giao dịch' }
const CAU = { doanhThu: 'Doanh thu', laoDong: 'Số lao động bình quân trên bảng lương', hdVao: 'Số hóa đơn đầu vào', hdRa: 'Số hóa đơn đầu ra', haiQuan: 'Số tờ khai hải quan', saoKe: 'Số giao dịch sao kê ngân hàng' }
const phanTramVN = p => (Math.abs(p) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'

// Nhận xét CHỈ NÊU SỐ (kế hoạch 3b): mỗi chỉ tiêu một câu, so cùng kỳ năm trước nếu có, không thì quý trước.
// Không đánh giá tốt / xấu. Chỉ tiêu không có số → bỏ qua (không đoán).
export function nhanXetKhach(quy, i) {
  const q = quy[i]
  if (!q) return []
  const ra = []
  for (const c of CHI_TIEU) {
    const v = q.chiTieu[c.k]?.v
    if (v == null) continue
    if (c.k === 'haiQuan' && v === 0) { ra.push(`Quý ${q.so}/${q.nam} không phát sinh tờ khai hải quan.`); continue }
    const ss = soSanh(quy, i, c.k)
    const [p, moc] = ss.cungKy != null ? [ss.cungKy, 'cùng kỳ năm trước'] : ss.qTruoc != null ? [ss.qTruoc, 'quý trước'] : [null, '']
    const dau = `${CAU[c.k]} quý ${q.so}/${q.nam} là ${soVN(v, c.k)}${DON_VI[c.k]}`
    ra.push(p == null ? dau + '.' : Math.abs(p) < 0.0005 ? `${dau}, không đổi so với ${moc}.` : `${dau}, ${p > 0 ? 'tăng' : 'giảm'} ${phanTramVN(p)} so với ${moc}.`)
  }
  return ra
}

// Đoạn đề xuất phí gửi khách: KHÔNG có phí theo biểu phí ở mốc, KHÔNG có cảnh báo nội bộ của engine (kế hoạch 3b).
// phiDeXuat: số cuối cùng (có thể đã sửa tay), gồm VAT.
export function deXuatPhiKhach(quy, i, iMoc, phiNay, phiDangThu, phiDeXuat) {
  const q = quy[i], m = iMoc != null ? quy[iMoc] : null
  if (!q || !phiNay || phiDeXuat == null) return null
  // Quý THIẾU nguồn (vd chưa có bảng kê hóa đơn) thì số chứng từ thấp giả → không đem ra so trong bản gửi khách
  const ctNay = q.chiTieu.chungTu.thieu ? null : q.chiTieu.chungTu.v
  const ctMoc = m && m !== q && !m.chiTieu.chungTu.thieu ? m.chiTieu.chungTu.v : null
  const doan = []
  if (ctMoc != null && ctNay != null && ctNay !== ctMoc) {
    const [dong, toi] = ctNay > ctMoc ? ['tăng', 'lên'] : ['giảm', 'xuống']
    doan.push(`Khối lượng chứng từ kế toán bình quân ${dong} từ ${soVN(ctMoc)} chứng từ/tháng (quý ${m.so}/${m.nam}) ${toi} ${soVN(ctNay)} chứng từ/tháng (quý ${q.so}/${q.nam}).`)
  } else if (ctNay != null) doan.push(`Khối lượng chứng từ kế toán bình quân quý ${q.so}/${q.nam} là ${soVN(ctNay)} chứng từ/tháng.`)
  for (const c of phiNay.canCu) doan.push(c)
  return { doan, phiDangThu, phiDeXuat, chenh: phiDangThu != null ? phiDeXuat - phiDangThu : null, ghiChu: 'Giá đã bao gồm VAT.' }
}
