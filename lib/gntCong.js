// Giấy nộp tiền (GNT) trên cổng eTax — phần MÁY CHỦ dựng lệnh gọi + đọc phản hồi. Tiện ích Chrome gọi hộ
// (máy chủ KHÔNG gọi cổng — xem project_tokhai_dvc_portal). Dùng trong app/api/admin/tokhai/tai-file.
//
// Luồng đã đo trên cổng thật 04/11/2026 (TÂN NGUYÊN PHÚC):
//   1. DVC  POST /tthc/sso/redirect-to-service?module=330410 (X-XSRF-TOKEN của phiên DVC)
//           → trả CHUỖI địa chỉ https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=…&module=330410
//   2. eTax GET địa chỉ đó → 200, vào trang "Tra cứu giấy nộp tiền" (biểu mẫu reportForm, các ô dse_*).
//           Trang này KHÔNG đòi eSigner (chỉ trang menu trong khung DVC kiểm), KHÔNG có captcha.
//   3. eTax POST /etaxnnt/Request  reportForm + dse_nextEventName=query + khoảng "Ngày lập GNT"
//           → trả cả trang, bảng kết quả có link downloadGNT(<số>) mỗi dòng.
//   4. eTax POST /etaxnnt/Request  reportForm + ctuId=<số> + dse_nextEventName=download → file chungtu.xml.
// Các ô ẩn dse_pageId / dse_processorId đổi theo từng trang → luôn đọc lại biểu mẫu từ trang VỪA nhận.
import { docGnt, kyApp, sacThueNdkt, laGnt } from './gntXml.js'

const DVC = 'https://dichvucong.gdt.gov.vn/tthc/'
const ETAX = 'https://thuedientu.gdt.gov.vn'
export const MODULE_TRA_CUU_GNT = '330410'
// Khai như trình duyệt mở trang (fetch mặc định gửi */*)
const KIEU_TRANG = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

export const ycGnt = {
  sso: csrf => ({
    url: `${DVC}sso/redirect-to-service?module=${MODULE_TRA_CUU_GNT}`, method: 'POST',
    headers: { 'X-XSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest', Referer: DVC + 'dich-vu-khac', Origin: 'https://dichvucong.gdt.gov.vn' },
  }),
  // theoChuyenHuong: eTax trả 302 nhiều lượt sau SSO — cần tiện ích 1.2 (bản cũ bỏ qua cờ này, thấy status 0)
  mo: url => ({ url, method: 'GET', theoChuyenHuong: true, headers: { Accept: KIEU_TRANG, Referer: DVC + 'dich-vu-khac' } }),
  // Ghé trang chủ eTax lấy cookie trước khi SSO (xem gnt_lam_nong trong route tải file)
  lamNong: () => ({ url: ETAX + '/etaxnnt/', method: 'GET', theoChuyenHuong: true, headers: { Accept: KIEU_TRANG } }),
  // Gửi lại biểu mẫu y như trình duyệt bấm nút (các ô lấy từ trang vừa nhận, chỉ đè vài ô).
  guiForm: (form, de) => ({
    url: ETAX + (form.action || '/etaxnnt/Request'), method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: ETAX + '/etaxnnt/Request', Origin: ETAX },
    body: new URLSearchParams([...Object.entries({ ...form.truong, ...de }).filter(([k]) => k !== '__multi'), ...(form.truong.__multi || [])]).toString(),
  }),
}

// Phản hồi bước 1: chuỗi địa chỉ (có thể bị bọc ngoặc kép kiểu JSON). Không phải địa chỉ eTax → null.
export function docDiaChiSso(noiDung) {
  let s = String(noiDung || '').trim()
  if (s.startsWith('"')) { try { s = JSON.parse(s) } catch { s = s.replace(/^"|"$/g, '') } }
  return /^https:\/\/thuedientu\.gdt\.gov\.vn\/etaxnnt\//.test(s) ? s : null
}

const giaiMa = s => String(s ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const thuocTinh = (the, ten) => giaiMa(the.match(new RegExp(`\\b${ten}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find(v => v !== undefined) ?? '')

// Đọc biểu mẫu reportForm: action + mọi ô (input ẩn/chữ, ô đánh dấu ĐANG CHỌN, select đang chọn).
// Ô đánh dấu cùng tên chọn nhiều (type_tax) gom vào __multi để gửi lặp đúng như trình duyệt.
export function docForm(html, ten = 'reportForm') {
  const s = String(html || '')
  const m = s.match(new RegExp(`<form\\b[^>]*(?:id|name)\\s*=\\s*["']?${ten}["']?[^>]*>([\\s\\S]*?)<\\/form>`, 'i'))
  if (!m) return null
  const moThe = m[0].match(/^<form\b[^>]*>/i)[0]
  const than = m[1]
  const truong = {}, multi = []
  for (const [the] of than.matchAll(/<input\b[^>]*>/gi)) {
    const name = thuocTinh(the, 'name'); if (!name) continue
    const type = thuocTinh(the, 'type').toLowerCase()
    const value = thuocTinh(the, 'value')
    if (type === 'checkbox' || type === 'radio') { if (/\bchecked\b/i.test(the)) multi.push([name, value]); continue }
    if (type === 'button' || type === 'submit' || type === 'image') continue
    truong[name] = value
  }
  for (const [, moSel, trong] of than.matchAll(/(<select\b[^>]*>)([\s\S]*?)<\/select>/gi)) {
    const name = thuocTinh(moSel, 'name'); if (!name) continue
    const chon = trong.match(/<option\b[^>]*\bselected\b[^>]*>/i)
    truong[name] = chon ? thuocTinh(chon[0], 'value') : ''
  }
  truong.__multi = multi
  return { action: (thuocTinh(moThe, 'action') || '/etaxnnt/Request').split('?')[0], truong }
}

// Trang tra cứu GNT đúng là trang ta cần (không phải trang lỗi / hết phiên)
export const laTrangTraCuuGnt = html => { const f = docForm(html); return !!f && 'ngay_lap_tu_ngay' in f.truong && 'dse_nextEventName' in f.truong }

const sachO = s => giaiMa(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// Bảng kết quả: mỗi dòng có downloadGNT(<số>). Cột theo bản đo 04/11/2026:
// 0 STT · 1 Số tham chiếu · 2 Mã GD DS chi tiết · 3 Lần nộp · 4 Số GNT · 5 Số tiền · 6 Loại tiền · 7 Trạng thái
// 8 Số chứng từ · 9 Ngày lập · 10 Ngày gửi · 11 Ngày nộp thuế · … · 18 "Tải về"
export function docBangGnt(html) {
  const s = String(html || '')
  const ds = []
  for (const [tr] of s.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const id = tr.match(/downloadGNT\(\s*'?(\d+)'?\s*\)/)?.[1]
    if (!id) continue
    const o = [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, c]) => sachO(c))
    ds.push({ id, soThamChieu: o[1] || '', soGnt: o[4] || '', soTien: o[5] || '', trangThai: o[7] || '', ngayLap: o[9] || '', ngayNop: o[11] || '' })
  }
  const trang = s.match(/Trang\s+(\d+)\s*\/\s*(\d+)/)
  return { ds, trang: trang ? Number(trang[1]) : 1, soTrang: trang ? Number(trang[2]) : 1 }
}

// Phản hồi bước 4 → chữ XML (tiện ích gửi base64 nếu cổng khai kiểu nhị phân)
export function xmlTuPhanHoi(ph) {
  const t = ph?.laNhiPhan ? Buffer.from(String(ph.noiDung || ''), 'base64').toString('utf8') : String(ph?.noiDung || '')
  return laGnt(t) ? t : null
}

// Kỳ + sắc thuế để đặt tên file, theo DÒNG NỘP SỐ TIỀN LỚN NHẤT của giấy (một giấy có thể gộp nhiều khoản).
// Kỳ thuế không phải kỳ (vd tiền phạt theo quyết định) → kỳ phát sinh theo ngày lập: 'PS.2026-10-16'.
export function tenTheoNoiDung(xml) {
  const d = docGnt(xml)
  const chinh = [...d.dong].sort((a, b) => b.soTien - a.soTien)[0]
  const [dd, mm, yyyy] = String(d.ngayLap || '').split('/')
  const periodCode = kyApp(chinh?.kyThue) || (yyyy ? `PS.${yyyy}-${mm}-${dd}` : null)
  return { periodCode, sacThue: sacThueNdkt(chinh?.maNdkt), soGnt: d.soGnt, tongTien: d.tongTien }
}
