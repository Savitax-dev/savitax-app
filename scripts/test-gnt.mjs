// Kiểm giấy nộp tiền: đọc XML (lib/gntXml.js) + dựng PDF mẫu C1-02/NS (lib/gntPdf.js).
//   node scripts/test-gnt.mjs                                  # dữ liệu GIẢ, chạy offline
//   node scripts/test-gnt.mjs <gnt.xml> <bản PDF cổng in.pdf> [ra.pdf]
//        → so từng cụm chữ (vị trí x/y) với bản gốc cổng; cần pdfjs-dist. File thật để NGOÀI repo.
import fs from 'node:fs'
import path from 'node:path'
import { docGnt, kyApp, sacThueNdkt, soThanhChu, laGnt } from '../lib/gntXml.js'
import { dungPdfGnt, coTheDungPdfGnt } from '../lib/gntPdf.js'
import { laGntLoi, docDiaChiSso, docForm, laTrangTraCuuGnt, docBangGnt, ycGnt, xmlTuPhanHoi, tenTheoNoiDung } from '../lib/gntCong.js'
import { tenFileGnt, duongDanGnt, THU_MUC_GNT, laCungThuMuc } from '../lib/tokhaiThuMuc.js'

const PHONG = Object.fromEntries([
  ['thuong', 'Tinos-Regular'], ['dam', 'Tinos-Bold'], ['nghieng', 'Tinos-Italic'],
  ['khongChan', 'Arimo-Regular'], ['khongChanNghieng', 'Arimo-Italic'], ['khongChanDam', 'Arimo-Bold'],
].map(([k, f]) => [k, new Uint8Array(fs.readFileSync(path.join('public', 'fonts', f + '.ttf')))]))

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi), dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

// ── Chế độ so với bản gốc ─────────────────────────────────────────────────────
if (process.argv[2]) {
  const [fXml, fGoc, fRa] = process.argv.slice(2)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const xml = fs.readFileSync(fXml, 'utf8')
  console.log('Dựng được:', JSON.stringify(coTheDungPdfGnt(xml)))
  const ra = await dungPdfGnt(xml, PHONG)
  if (fRa) fs.writeFileSync(fRa, ra)
  console.log('PDF app:', Math.round(ra.length / 1024) + ' KB')
  if (!fGoc) process.exit(0)
  const chu = async buf => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
    const pg = await doc.getPage(1), Hh = pg.getViewport({ scale: 1 }).height
    return (await pg.getTextContent()).items.filter(i => i.str.trim())
      .map(i => ({ x: i.transform[4], y: Hh - i.transform[5], s: i.str.normalize('NFC').trim() }))
  }
  const A = await chu(fs.readFileSync(fGoc)), B = await chu(ra)
  const k = s => s.replace(/\s+/g, '')
  let lech = 0, thieu = 0
  for (const a of A) {
    // cùng chữ, gần vị trí nhất (cụm chữ của hai bên có thể cắt khác nhau)
    const ung = B.filter(b => !b.dung && (k(b.s) === k(a.s) || k(b.s).startsWith(k(a.s)) || k(a.s).startsWith(k(b.s))))
      .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))
    const b = ung[0]
    if (!b) { thieu++; console.log(`  THIẾU (${a.x.toFixed(1)},${a.y.toFixed(1)}) ${a.s}`); continue }
    b.dung = true
    if (Math.abs(b.x - a.x) > 1.5 || Math.abs(b.y - a.y) > 1.5) { lech++; console.log(`  LỆCH  dx=${(b.x - a.x).toFixed(1)} dy=${(b.y - a.y).toFixed(1)} ${a.s.slice(0, 70)}`) }
  }
  console.log(`${A.length} cụm chữ gốc: lệch >1,5pt ${lech}, không thấy ${thieu}`)
  process.exit(0)
}

// ── Dữ liệu giả ───────────────────────────────────────────────────────────────
const dongGia = (nd, ndkt, ky, tien) => `<ROW_CTIET><ID_KNOP>0406445490580001</ID_KNOP><SO_TK_TB_QD/><NDUNG_NOP>${nd}</NDUNG_NOP><MA_NDKT>${ndkt}</MA_NDKT><MA_CHUONG>754</MA_CHUONG><KY_THUE>${ky}</KY_THUE><TIEN_PNOP>${tien}</TIEN_PNOP><MA_DBHC_THU>26734</MA_DBHC_THU><GHI_CHU/></ROW_CTIET>`
const xmlGia = (dong, tong) => `<?xml version="1.0" encoding="UTF-8"?><CHUNGTU><NDUNG_CTU_NH><MAHIEU_CTU/><SO_CTU>123</SO_CTU><NDUNG_CTU><CHUNGTU_HDR><SO_GNT>999</SO_GNT><MST_NNOP>0312345678</MST_NNOP><TEN_NNOP>CÔNG TY TNHH THỬ NGHIỆM</TEN_NNOP><DIACHI_NNOP>1 Đường A</DIACHI_NNOP><TEN_TINH_NNOP>Thành phố Hồ Chí Minh</TEN_TINH_NNOP><TEN_NHANG_NOP>Ngân hàng X</TEN_NHANG_NOP><STK_NHANG_NOP>111</STK_NHANG_NOP><TEN_KBAC>KBNN Y</TEN_KBAC><STK_THU>7111</STK_THU><MA_CQTHU>1</MA_CQTHU><TEN_CQTHU>Thuế cơ sở 1</TEN_CQTHU><NGAY_LAP>20/10/2026</NGAY_LAP><TONG_TIEN>${tong}</TONG_TIEN><MA_NGUYENTE>VND</MA_NGUYENTE><MA_THAMCHIEU>001</MA_THAMCHIEU></CHUNGTU_HDR><CHUNGTU_CTIET>${dong.join('')}</CHUNGTU_CTIET></NDUNG_CTU></NDUNG_CTU_NH><Signature><X509Data><X509SubjectName>UID=MST:0312345678,CN=CÔNG TY TNHH THỬ NGHIỆM,C=VN</X509SubjectName></X509Data><Object><SignatureProperties><SignatureProperty><DateTimeStamp>20102026091500</DateTimeStamp></SignatureProperty></SignatureProperties></Object></Signature><Signature><X509Data><X509SubjectName>CN=CỤC THUẾ,O=BỘ TÀI CHÍNH,C=VN|TGKY=20102026091530</X509SubjectName></X509Data></Signature></CHUNGTU>`

console.log('\n[1] Đọc XML')
const x1 = xmlGia([dongGia('Thuế giá trị gia tăng hàng sản xuất, kinh doanh trong nước', '1701', '00/09/2026', 5000000), dongGia('Thuế thu nhập từ tiền lương, tiền công', '1001', '00/Q3/2026', 1250000)], 6250000)
const d1 = docGnt(x1)
kiem('nhận ra là GNT', [laGnt(x1), laGnt('<HSoThueDTu/>')], [true, false])
kiem('2 dòng nộp, tổng tiền', [d1.dong.length, d1.tongTien], [2, 6250000])
kiem('người ký + giờ ký (DateTimeStamp, và |TGKY= khi thiếu)', d1.ky, [{ ten: 'CÔNG TY TNHH THỬ NGHIỆM', luc: '20/10/2026 09:15:00' }, { ten: 'CỤC THUẾ', luc: '20/10/2026 09:15:30' }])
kiem('kỳ thuế -> mã kỳ app', ['00/Q3/2026', '00/09/2026', '00/CN/2025', '15/10/2026', ''].map(kyApp), ['Q3.2026', 'T09.2026', 'NAM.2025', null, null])
kiem('mã NDKT -> sắc thuế', ['1001', '1052', '1701', '2862', '4254', '4917', '9999', ''].map(sacThueNdkt), ['TNCN', 'TNDN', 'GTGT', 'MONBAI', 'PHAT', 'CHAMNOP', 'KHAC', 'KHAC'])

console.log('\n[2] Đọc số thành chữ')
kiem('bản cổng in (TÂN NGUYÊN PHÚC Q3/2026)', soThanhChu(9697800), 'Chín triệu sáu trăm chín mươi bảy nghìn tám trăm đồng')
kiem('mốt / lăm / tư / lẻ / mười', [21, 15, 25, 24, 14, 105, 110].map(soThanhChu), ['Hai mươi mốt đồng', 'Mười lăm đồng', 'Hai mươi lăm đồng', 'Hai mươi tư đồng', 'Mười bốn đồng', 'Một trăm lẻ năm đồng', 'Một trăm mười đồng'])
kiem('nhóm giữa đọc đủ "không trăm"', soThanhChu(1005000), 'Một triệu không trăm lẻ năm nghìn đồng')
kiem('hàng tỷ', [1e9, 2500000000].map(soThanhChu), ['Một tỷ đồng', 'Hai tỷ năm trăm triệu đồng'])
kiem('0 đồng', soThanhChu(0), 'Không đồng')

console.log('\n[3] Dựng PDF')
kiem('dựng được GNT, từ chối file khác', [coTheDungPdfGnt(x1).duoc, coTheDungPdfGnt('<HSoThueDTu/>').duoc], [true, false])
const pdf = await dungPdfGnt(x1, PHONG)
kiem('ra PDF (%PDF), dưới 150 KB', [String.fromCharCode(...pdf.slice(0, 4)), pdf.length < 150 * 1024], ['%PDF', true])

console.log('\n[4] Gọi cổng eTax (lib/gntCong.js) — HTML mô phỏng theo bản đo 04/11/2026')
kiem('địa chỉ SSO: chuỗi trần / bọc ngoặc kép / lạ',
  [docDiaChiSso('https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=X&module=330410'), docDiaChiSso('"https://thuedientu.gdt.gov.vn/etaxnnt/?a=1"'), docDiaChiSso('<html>lỗi</html>')],
  ['https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=X&module=330410', 'https://thuedientu.gdt.gov.vn/etaxnnt/?a=1', null])
const htmlTraCuu = `<html><form name="reportForm" id="reportForm" method="post" action="/etaxnnt/Request">
<input type="hidden" name="dse_sessionId" value="SESS"><input type="hidden" name="dse_applicationId" value="-1">
<input type="hidden" name="dse_operationName" value="corpQueryTaxProc"><input type="hidden" name="dse_pageId" value="36">
<input type="hidden" name="dse_processorState" value="viewQueryPage"><input type="hidden" name="dse_processorId" value="ABC">
<input type="hidden" name="dse_errorPage" value="/etax/query_tax_information.jsp"><input type="hidden" name="dse_nextEventName" value="">
<input type="hidden" name="pn" value="1"><input type="hidden" name="ctuId" value="">
<input type="checkbox" name="type_tax" value="01" checked><input type="checkbox" name="type_tax" value="02">
<input type="text" name="ngay_lap_tu_ngay" id="ngay_lap_tu_ngay" value="01/10/2026"><input type="text" name="ngay_lap_den_ngay" value="31/10/2026">
<select name="trang_thai"><option value="">--Tất cả--</option><option value="1">Thành công</option></select>
<input type="button" value="Tra cứu" onclick="traCuuChungTu()"></form>
<table><tr><th>STT</th></tr><tr><td>1</td><td>00102026042439670900</td><td></td><td></td><td><a href="#">00000031309537710202639653686</a></td><td>9,697,800</td><td>VND</td><td>Nộp thuế thành công</td><td>1856456</td><td>16/10/2026 13:47:03</td><td>16/10/2026 13:54:29</td><td>16/10/2026 13:56:13</td><td></td><td></td><td></td><td>Nộp tại cổng eTax</td><td>Ngân hàng</td><td>19028920522011</td><td><a href="javascript: downloadGNT(59402154);">Tải về</a></td><td></td></tr></table>
<div>1 Trang 1/1. Có 1 bản ghi.</div></html>`
const f = docForm(htmlTraCuu)
kiem('đọc biểu mẫu: ô ẩn, ô đánh dấu ĐANG chọn, select, bỏ nút', [f.action, f.truong.dse_pageId, f.truong.dse_processorId, f.truong.__multi, f.truong.trang_thai, 'Tra cứu' in f.truong],
  ['/etaxnnt/Request', '36', 'ABC', [['type_tax', '01']], '', false])
kiem('nhận ra trang tra cứu GNT / trang khác', [laTrangTraCuuGnt(htmlTraCuu), laTrangTraCuuGnt('<html><form id="x"></form></html>')], [true, false])
const bang = docBangGnt(htmlTraCuu)
kiem('bảng kết quả: mã tải, số GNT, tiền, trạng thái, ngày lập; số trang', [bang.ds[0], bang.trang, bang.soTrang],
  [{ id: '59402154', soThamChieu: '00102026042439670900', soGnt: '00000031309537710202639653686', soTien: '9,697,800', trangThai: 'Nộp thuế thành công', ngayLap: '16/10/2026 13:47:03', ngayNop: '16/10/2026 13:56:13' }, 1, 1])
const ycTai = ycGnt.guiForm(f, { dse_nextEventName: 'download', ctuId: '59402154' })
const thanTai = new URLSearchParams(ycTai.body)
kiem('lệnh tải: POST /etaxnnt/Request, đè đúng 2 ô, giữ ô đánh dấu', [ycTai.method, ycTai.url, thanTai.get('dse_nextEventName'), thanTai.get('ctuId'), thanTai.getAll('type_tax'), thanTai.get('dse_sessionId')],
  ['POST', 'https://thuedientu.gdt.gov.vn/etaxnnt/Request', 'download', '59402154', ['01'], 'SESS'])
kiem('phản hồi tải: chữ XML / base64 / không phải GNT', [!!xmlTuPhanHoi({ noiDung: x1 }), !!xmlTuPhanHoi({ laNhiPhan: true, noiDung: Buffer.from(x1).toString('base64') }), xmlTuPhanHoi({ noiDung: '<html/>' })], [true, true, null])
kiem('tên theo nội dung: dòng TIỀN LỚN NHẤT quyết định kỳ + sắc thuế', tenTheoNoiDung(x1).sacThue + ' ' + tenTheoNoiDung(x1).periodCode, 'GTGT T09.2026')
const xPhat = xmlGia([dongGia('Tiền phạt vi phạm hành chính', '4254', '15/10/2026', 2000000)], 2000000)
kiem('kỳ không phải kỳ thuế (tiền phạt) -> phát sinh theo ngày lập', tenTheoNoiDung(xPhat).periodCode, 'PS.2026-10-20')
kiem('tên file + thư mục', [tenFileGnt({ sacThue: 'TNCN', periodCode: 'Q3.2026', maKH: 'TANNGUYENPHUC' }), duongDanGnt({ periodCode: 'Q3.2026', maKH: 'TANNGUYENPHUC' })],
  ['GNT_TNCN_Q3.2026_TANNGUYENPHUC.xml', []])
// Thư mục '10. GIẤY NỘP TIỀN' ngang hàng '7. BỘ BÁO CÁO' (anh chốt 06/11/2026); thư mục có sẵn đặt kiểu khác vẫn nhận ra
kiem('thư mục GNT: tên + nhận thư mục có sẵn', [THU_MUC_GNT, laCungThuMuc('10.GIẤY NỘP TIỀN', THU_MUC_GNT), laCungThuMuc('GIẤY NỘP TIỀN', THU_MUC_GNT), laCungThuMuc('7. BỘ BÁO CÁO', THU_MUC_GNT)],
  ['10. GIẤY NỘP TIỀN', true, true, false])

// Giấy ngân hàng báo lỗi thì không tải (anh chốt 06/11/2026, ca ZENIS)
kiem('bỏ giấy lỗi theo trạng thái', [
  'Nộp thuế thành công',
  'Xử lý chứng từ không thành công tại Ngân hàng do Lỗi khi thực hiện thanh toán thuế (Lỗi do core bank trả ra)',
  'Đã gửi ngân hàng', 'Ngân hàng từ chối', 'Đã hủy',
].map(laGntLoi), [false, true, false, true, true])

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
