// Đọc file XML GIẤY NỘP TIỀN (GNT) cổng thuế trả về — Phân hệ Tờ khai (anh yêu cầu 04/11/2026).
//
// Nguồn: thuedientu.gdt.gov.vn → Nộp thuế → Tra cứu GNT → "Tải về" (dse_nextEventName=download), file tên
// `chungtu.xml`. Gốc `<CHUNGTU>`: NDUNG_CTU_NH/NDUNG_CTU gồm CHUNGTU_HDR (người nộp, ngân hàng, kho bạc,
// tổng tiền) + CHUNGTU_CTIET/ROW_CTIET (từng khoản: nội dung, mã NDKT, kỳ thuế, số tiền), kèm 3 chữ ký số
// (doanh nghiệp, CỤC THUẾ, ngân hàng). Mẫu thật: TÂN NGUYÊN PHÚC, TNCN Q3/2026, 9.697.800đ.
//
// Hàm THUẦN, không gọi mạng — kiểm bằng scripts/test-gnt.mjs.
import { the, motKhoi } from './tokhaiXml.js'

export const laGnt = xml => /<CHUNGTU\b/.test(String(xml || '')) && /<CHUNGTU_HDR\b/.test(String(xml || ''))

// 'ddMMyyyyHHmmss' -> '16/10/2026 13:54:20'
function gioKy(s) {
  const m = String(s || '').match(/^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})$/)
  return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]}` : ''
}

export function docGnt(xml) {
  const s = String(xml || '')
  // Bỏ khối chữ ký trước khi đọc nội dung: chữ ký có thẻ trùng tên vô tình (vd trong chứng thư số)
  const than = s.replace(/<Signature\b[\s\S]*?<\/Signature>/g, '')
  const hdr = motKhoi(than, 'CHUNGTU_HDR')
  const g = t => the(hdr, t)
  const dong = [...than.matchAll(/<ROW_CTIET>[\s\S]*?<\/ROW_CTIET>/g)].map(([k]) => ({
    soToKhai: the(k, 'SO_TK_TB_QD') || the(k, 'ID_KNOP'),
    kyThue: the(k, 'KY_THUE'),
    noiDung: the(k, 'NDUNG_NOP'),
    ghiChu: the(k, 'GHI_CHU'),
    maChuong: the(k, 'MA_CHUONG'),
    maNdkt: the(k, 'MA_NDKT'),
    maDbhc: the(k, 'MA_DBHC_THU'),
    soTien: Number(the(k, 'TIEN_PNOP') || 0),
  }))
  // Người ký: CN trong X509SubjectName; giờ ký: DateTimeStamp của khối ký đó, thiếu thì lấy |TGKY= ở cuối tên
  const ky = [...s.matchAll(/<Signature\b[\s\S]*?<\/Signature>/g)].map(([k]) => {
    const chuThe = the(k, 'X509SubjectName')
    return {
      ten: (String(chuThe).match(/(?:^|,)\s*CN=([^,|]+)/)?.[1] || '').trim(),
      luc: gioKy(the(k, 'DateTimeStamp') || String(chuThe).match(/TGKY=(\d{14})/)?.[1]),
    }
  }).filter(k => k.ten)
  return {
    soCtu: the(than, 'SO_CTU'), maHieu: the(than, 'MAHIEU_CTU'),
    soGnt: g('SO_GNT'), maThamChieu: g('MA_THAMCHIEU'), idCtu: g('ID_CTU'),
    hinhThuc: g('HTHUC_NOP'), nguyenTe: g('MA_NGUYENTE') || 'VND',
    mst: g('MST_NNOP'), ten: g('TEN_NNOP'), diaChi: g('DIACHI_NNOP'), huyen: g('TEN_HUYEN_NNOP'), tinh: g('TEN_TINH_NNOP'),
    mstThay: g('MST_NTHAY'), tenThay: g('TEN_NTHAY'), diaChiThay: g('DIACHI_NTHAY'), huyenThay: g('TEN_HUYEN_NTHAY'), tinhThay: g('TEN_TINH_NTHAY'),
    nganHang: g('TEN_NHANG_NOP'), soTk: g('STK_NHANG_NOP'),
    khoBac: g('TEN_KBAC'), tinhKhoBac: g('TEN_TINH_KBAC'), nganHangUnt: g('TEN_NHANG_UNT'),
    tkThu: g('STK_THU'), coQuanThu: g('TEN_CQTHU'), maCoQuanThu: g('MA_CQTHU'),
    ngayLap: g('NGAY_LAP'), tongTien: Number(g('TONG_TIEN') || 0) || dong.reduce((a, d) => a + d.soTien, 0),
    dong, ky,
  }
}

// Kỳ thuế của MỘT dòng nộp -> mã kỳ của app ('Q3.2026', 'T09.2026', 'NAM.2025'); không đọc được -> null.
// Cổng ghi: '00/Q3/2026' (quý), '00/09/2026' (tháng), '00/CN/2025' (năm). Dạng ngày thật 'dd/MM/yyyy' (ngày
// quyết định / thông báo, vd tiền phạt) thì không phải kỳ -> null.
export function kyApp(kyThue) {
  const s = String(kyThue || '').trim().toUpperCase()
  let m = s.match(/^00\/Q([1-4])\/(\d{4})$/)
  if (m) return `Q${m[1]}.${m[2]}`
  m = s.match(/^00\/(0[1-9]|1[0-2])\/(\d{4})$/)
  if (m) return `T${m[1]}.${m[2]}`
  m = s.match(/^00\/(CN|NAM)\/(\d{4})$/)
  if (m) return `NAM.${m[2]}`
  return null
}

// Sắc thuế theo mã nội dung kinh tế (Mã NDKT — mục lục NSNN) -> chữ dùng trong tên file, cùng kiểu tờ khai
// (TK_TNCN_…, TK_GTGT_…). Khoảng mã theo mục lục NSNN; mã ngoài các khoảng dưới đây -> 'KHAC'.
export function sacThueNdkt(maNdkt) {
  const n = Number(maNdkt)
  if (!n) return 'KHAC'
  if (n >= 1000 && n <= 1049) return 'TNCN'
  if (n >= 1050 && n <= 1099) return 'TNDN'
  if (n >= 1700 && n <= 1799) return 'GTGT'
  if (n >= 2860 && n <= 2869) return 'MONBAI'
  if (n >= 4250 && n <= 4299) return 'PHAT'
  if (n >= 4900 && n <= 4949) return 'CHAMNOP'
  return 'KHAC'
}

// ── Đọc số thành chữ (tiền đồng) ─────────────────────────────────────────────
// 9697800 -> 'Chín triệu sáu trăm chín mươi bảy nghìn tám trăm đồng' (khớp bản cổng in).
const SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
function baChuSo(n, dayDu) {
  const tr = Math.floor(n / 100), ch = Math.floor((n % 100) / 10), dv = n % 10
  const ra = []
  if (dayDu || tr) ra.push(SO[tr], 'trăm')
  if (ch === 0) { if (dv && (dayDu || tr)) ra.push('lẻ') }
  else if (ch === 1) ra.push('mười')
  else ra.push(SO[ch], 'mươi')
  if (dv) {
    if (dv === 1 && ch > 1) ra.push('mốt')
    else if (dv === 5 && ch > 0) ra.push('lăm')
    else if (dv === 4 && ch > 1) ra.push('tư')
    else ra.push(SO[dv])
  }
  return ra.join(' ')
}
// Đơn vị theo nhóm 3 chữ số, từ phải sang: đồng, nghìn, triệu, tỷ, nghìn tỷ, triệu tỷ.
const DON_VI = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
export function soThanhChu(so) {
  let n = Math.round(Math.abs(Number(so) || 0))
  if (!n) return 'Không đồng'
  const nhom = []
  while (n > 0) { nhom.push(n % 1000); n = Math.floor(n / 1000) }
  const ra = []
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (!nhom[i]) continue
    // Nhóm đứng sau nhóm cao nhất đọc đủ "không trăm" / "lẻ": 1.005.000 -> một triệu không trăm lẻ năm nghìn
    ra.push(baChuSo(nhom[i], i < nhom.length - 1))
    if (DON_VI[i]) ra.push(DON_VI[i])
  }
  const chu = ra.join(' ')
  return chu.charAt(0).toUpperCase() + chu.slice(1) + ' đồng'
}
